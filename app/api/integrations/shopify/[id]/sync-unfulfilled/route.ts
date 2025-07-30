import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logError } from "@/lib/error-handler"

// Use service role client that bypasses RLS
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("=== SYNC UNFULFILLED ORDERS ENDPOINT CALLED ===")
  console.log("Connection ID:", params.id)
  console.log("Environment:", process.env.NODE_ENV)

  try {
    const { id } = params // This is shopify_connection_id

    // Get the session from the request headers for authentication
    const authHeader = request.headers.get("authorization")
    console.log("Auth header present:", !!authHeader)

    if (!authHeader) {
      console.log("❌ No authorization header")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Create authenticated Supabase client for user verification
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    )

    // Get the current user
    console.log("Getting user from auth...")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError) {
      console.log("❌ Auth error:", authError)
      return NextResponse.json({ error: "Authentication failed", details: authError.message }, { status: 401 })
    }

    if (!user) {
      console.log("❌ No user found")
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    console.log("✅ User authenticated:", user.id)

    // Verify user is an admin using service role client
    console.log("Checking user role...")
    const { data: userProfile, error: profileError } = await supabaseServiceRole
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (profileError) {
      console.log("❌ Profile error:", profileError)
      return NextResponse.json({ error: "Failed to verify user role", details: profileError.message }, { status: 500 })
    }

    if (!userProfile || userProfile.role !== "admin") {
      console.log("❌ User is not admin. Role:", userProfile?.role)
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    console.log("✅ User is admin")

    // Get connection details and verify ownership using service role client
    console.log("Fetching connection details...")
    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .eq("id", id)
      .eq("admin_id", user.id) // Ensure the connection belongs to this admin
      .single()

    if (connectionError) {
      console.log("❌ Connection error:", connectionError)
      return NextResponse.json({ error: "Database error", details: connectionError.message }, { status: 500 })
    }

    if (!connection) {
      console.log("❌ Connection not found for ID:", id, "and admin:", user.id)
      return NextResponse.json({ error: "Connection not found or access denied" }, { status: 404 })
    }

    console.log("✅ Connection found:", connection.shop_domain)

    if (!connection.is_active) {
      console.log("❌ Connection is not active")
      return NextResponse.json({ error: "Connection is not active" }, { status: 400 })
    }

    // Validate connection details
    if (!connection.shop_domain || !connection.access_token) {
      console.log("❌ Invalid connection configuration")
      return NextResponse.json({ error: "Invalid connection configuration" }, { status: 400 })
    }

    console.log(`🔄 Syncing UNFULFILLED orders for shop: ${connection.shop_domain}`)

    // Fetch only unfulfilled orders from Shopify - no mock data
    let orders: any[] = []
    let isRealShopifyData = false

    if (connection.access_token.startsWith("shpat_")) {
      try {
        console.log("🌐 Fetching UNFULFILLED orders from Shopify API...")
        orders = await fetchUnfulfilledShopifyOrders(connection.shop_domain, connection.access_token)
        isRealShopifyData = true
        console.log(`✅ Fetched ${orders.length} unfulfilled orders from Shopify`)
      } catch (shopifyError) {
        console.error("❌ Shopify API failed:", shopifyError)
        return NextResponse.json(
          {
            error: "Failed to fetch unfulfilled orders from Shopify",
            details: shopifyError instanceof Error ? shopifyError.message : "Unknown error",
          },
          { status: 500 },
        )
      }
    } else {
      console.log("❌ Invalid Shopify access token - must start with 'shpat_'")
      return NextResponse.json(
        {
          error: "Invalid Shopify access token",
          details: "Access token must be a valid Shopify private app token starting with 'shpat_'",
        },
        { status: 400 },
      )
    }

    if (orders.length === 0) {
      console.log("ℹ️ No unfulfilled orders found in Shopify store")
      return NextResponse.json({
        success: true,
        synced_count: 0,
        total_orders: 0,
        error_count: 0,
        delivery_orders_created: 0,
        message: "No unfulfilled orders found in Shopify store",
        data_source: "shopify_api",
      })
    }

    let syncedCount = 0
    let errorCount = 0
    let deliveryOrdersCreated = 0

    console.log(`🔄 Processing ${orders.length} unfulfilled orders...`)

    for (const order of orders) {
      try {
        console.log(`Processing unfulfilled order: ${order.order_number || order.name || order.id}`)

        // Check if we already have a delivery order for this Shopify order
        const { data: existingDeliveryOrder } = await supabaseServiceRole
          .from("orders")
          .select("id")
          .eq("shopify_order_id", order.id.toString())
          .eq("created_by", user.id)
          .single()

        if (existingDeliveryOrder) {
          console.log(`ℹ️ Delivery order already exists for: ${order.order_number || order.name}`)
          continue
        }

        // Check if order exists in shopify_orders table
        const { data: existingOrderCheck, error: checkError } = await supabaseServiceRole.rpc(
          "check_shopify_order_exists",
          {
            p_shopify_order_id: order.id.toString(),
            p_connection_id: id, // shopify_connection_id
          },
        )

        if (checkError) {
          console.error(`❌ Error checking if order ${order.id} exists:`, checkError)
          errorCount++
          continue
        }

        const orderExists = existingOrderCheck

        if (!orderExists) {
          const orderData = {
            shopify_connection_id: id, // shopify_connection_id
            shopify_order_id: order.id.toString(),
            order_number: order.order_number || order.name || `#${order.id}`,
            customer_name: order.customer
              ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || "Unknown Customer"
              : "Unknown Customer",
            customer_email: order.customer?.email || "",
            customer_phone: order.customer?.phone || "",
            shipping_address: order.shipping_address || {},
            line_items: order.line_items || [],
            total_price: Number.parseFloat(order.total_price || "0.00"), // Ensure this is a number
            fulfillment_status: order.fulfillment_status || "unfulfilled",
            financial_status: order.financial_status || "pending",
            created_at: order.created_at || new Date().toISOString(),
            synced_at: new Date().toISOString(),
          }

          console.log(`💾 Inserting Shopify order: ${orderData.order_number}`)
          const { error: insertError } = await supabaseServiceRole.rpc("insert_shopify_order", {
            p_data: orderData, // This will be stringified by the Supabase client
          })

          if (insertError) {
            console.error(`❌ Error inserting order ${order.id} (${order.order_number || order.name}):`, insertError)
            errorCount++
            continue
          } else {
            syncedCount++
            console.log(`✅ Synced Shopify order: ${order.order_number || order.name}`)
          }
        }

        // ALWAYS create delivery order for unfulfilled orders (ready for assignment and delivery)
        console.log(`🔍 Creating delivery order for unfulfilled order: ${order.order_number || order.name}`)

        if (order.shipping_address) {
          try {
            console.log(`📦 Creating delivery order for: ${order.order_number || order.name}`)
            await createDeliveryOrder(order, connection, user.id)
            deliveryOrdersCreated++
            console.log(`✅ Successfully created delivery order for: ${order.order_number || order.name}`)
          } catch (deliveryError) {
            console.error(`❌ Error creating delivery order for ${order.id}:`, deliveryError)
            // Don't increment error count for delivery order failures, as Shopify order was synced successfully
          }
        } else {
          console.log(`ℹ️ No shipping address for: ${order.order_number || order.name}`)
        }
      } catch (orderError) {
        console.error(`❌ Error processing order ${order.id}:`, orderError)
        errorCount++
      }
    }

    // Update connection stats
    try {
      console.log("📊 Updating connection stats...")
      await supabaseServiceRole
        .from("shopify_connections")
        .update({
          last_sync: new Date().toISOString(),
          orders_synced: (connection.orders_synced || 0) + syncedCount,
        })
        .eq("id", id)
        .eq("admin_id", user.id)
      console.log("✅ Connection stats updated")
    } catch (updateError) {
      console.error("⚠️ Error updating connection stats:", updateError)
    }

    const message = `Successfully synced ${syncedCount} unfulfilled orders from Shopify${deliveryOrdersCreated > 0 ? ` and created ${deliveryOrdersCreated} delivery orders ready for assignment` : ""}${errorCount > 0 ? ` (${errorCount} errors)` : ""}`

    console.log(
      `🎉 Sync completed: ${syncedCount} synced, ${deliveryOrdersCreated} delivery orders created, ${errorCount} errors`,
    )

    return NextResponse.json({
      success: true,
      synced_count: syncedCount,
      total_orders: orders.length,
      error_count: errorCount,
      delivery_orders_created: deliveryOrdersCreated,
      unfulfilled_orders_only: true,
      message,
      data_source: "shopify_api",
    })
  } catch (error) {
    console.error("💥 Critical error in sync endpoint:", error)
    logError(error, { endpoint: "shopify_sync_unfulfilled", connection_id: params.id })
    return NextResponse.json(
      {
        error: "Failed to sync orders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function fetchUnfulfilledShopifyOrders(shopDomain: string, accessToken: string): Promise<any[]> {
  // Fetch only unfulfilled orders
  const url = `https://${shopDomain}/admin/api/2023-10/orders.json?status=any&fulfillment_status=unfulfilled&limit=50`

  console.log("🌐 Fetching UNFULFILLED orders from Shopify API:", url)

  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("❌ Shopify API error:", response.status, errorText)
    throw new Error(`Shopify API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  console.log(`✅ Shopify API returned ${data.orders?.length || 0} unfulfilled orders`)
  return data.orders || []
}

async function createDeliveryOrder(shopifyOrder: any, connection: any, adminId: string) {
  try {
    console.log(`📦 Creating delivery order for Shopify order: ${shopifyOrder.order_number || shopifyOrder.id}`)

    // Generate a base order number
    const baseOrderNumber = `SH-${shopifyOrder.order_number || shopifyOrder.id}`

    // Check if an order with this number already exists
    const { data: existingOrder, error: checkError } = await supabaseServiceRole
      .from("orders")
      .select("id")
      .eq("order_number", baseOrderNumber)
      .maybeSingle()

    if (checkError) {
      console.error("❌ Error checking for existing order:", checkError)
    }

    // If order number already exists, make it unique by adding a timestamp suffix
    let orderNumber = baseOrderNumber
    if (existingOrder) {
      const timestamp = new Date().getTime().toString().slice(-6)
      orderNumber = `${baseOrderNumber}-${timestamp}`
      console.log(`⚠️ Order number ${baseOrderNumber} already exists, using ${orderNumber} instead`)
    }

    const deliveryOrderData = {
      order_number: orderNumber,
      customer_name: shopifyOrder.customer
        ? `${shopifyOrder.customer.first_name || ""} ${shopifyOrder.customer.last_name || ""}`.trim() ||
          "Unknown Customer"
        : "Unknown Customer",
      customer_phone: shopifyOrder.customer?.phone || "",
      customer_email: shopifyOrder.customer?.email || "",
      pickup_address: connection.settings?.pickup_address || "Store Location - Please update in connection settings",
      delivery_address: formatAddress(shopifyOrder.shipping_address),
      delivery_notes: [
        "🛍️ Shopify Order Items:",
        ...(shopifyOrder.line_items || []).map(
          (item: any) => `• ${item.quantity || 1}x ${item.title || item.name || "Item"} ($${item.price || "0.00"})`,
        ),
        "",
        `💰 Order Total: $${shopifyOrder.total_price || "0.00"}`,
        `💳 Payment Status: ${shopifyOrder.financial_status || "pending"}`,
        shopifyOrder.note ? `📝 Customer Note: ${shopifyOrder.note}` : "",
        `🏪 Shopify Order ID: ${shopifyOrder.id}`,
        "",
        "⚠️ This order will auto-update Shopify when delivered",
      ]
        .filter(Boolean)
        .join("\n"),
      priority: "normal" as const,
      status: "pending" as const,
      created_by: adminId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Store Shopify connection info for later fulfillment updates
      shopify_order_id: shopifyOrder.id.toString(),
      shopify_connection_id: connection.id,
    }

    const { data: insertResult, error } = await supabaseServiceRole
      .from("orders")
      .insert(deliveryOrderData)
      .select("id, order_number")

    if (error) {
      console.error("❌ Error creating delivery order:", error)
      throw error
    } else {
      console.log(`✅ Created delivery order:`, insertResult)
    }
  } catch (error) {
    console.error("❌ Error in createDeliveryOrder:", error)
    throw error
  }
}

function formatAddress(address: any): string {
  if (!address) return "No shipping address provided"
  const parts = [
    address.address1,
    address.address2,
    address.city,
    address.province || address.province_code,
    address.zip || address.postal_code,
    address.country || address.country_code,
  ].filter(Boolean)
  return parts.join(", ")
}
