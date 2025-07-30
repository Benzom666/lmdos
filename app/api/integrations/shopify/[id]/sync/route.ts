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
  console.log("=== SYNC ORDERS ENDPOINT CALLED ===")
  console.log("Connection ID:", params.id)
  console.log("Environment:", process.env.NODE_ENV)
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)

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

    console.log(`🔄 Syncing orders for shop: ${connection.shop_domain}`)

    // Only use real Shopify API with proper error handling
    let orders: any[] = []

    if (!connection.access_token.startsWith("shpat_")) {
      console.log("❌ Invalid Shopify access token - must start with 'shpat_'")
      return NextResponse.json(
        {
          error: "Invalid Shopify access token",
          details: "Access token must be a valid Shopify private app token starting with 'shpat_'",
        },
        { status: 400 },
      )
    }

    try {
      console.log("🌐 Fetching real orders from Shopify API...")
      orders = await fetchShopifyOrders(connection.shop_domain, connection.access_token)
      console.log(`✅ Fetched ${orders.length} real orders from Shopify`)
    } catch (shopifyError) {
      console.error("❌ Shopify API failed:", shopifyError)

      // Provide more detailed error information
      let errorMessage = "Failed to fetch orders from Shopify"
      let errorDetails = "Unknown error"

      if (shopifyError instanceof Error) {
        errorDetails = shopifyError.message

        // Check for specific error types
        if (shopifyError.message.includes("Failed to fetch") || shopifyError.message.includes("fetch failed")) {
          errorMessage = "Network error connecting to Shopify"
          errorDetails =
            "Unable to connect to Shopify API. This could be due to network connectivity issues, firewall restrictions, or Shopify API being temporarily unavailable. Please check your internet connection and try again."
        } else if (shopifyError.message.includes("NETWORK_ERROR")) {
          errorMessage = "Network connectivity issue"
          errorDetails = "Cannot reach Shopify servers. Please check your network connection and try again."
        } else if (shopifyError.message.includes("TIMEOUT")) {
          errorMessage = "Request timeout"
          errorDetails = "The request to Shopify API timed out. Please try again."
        } else if (shopifyError.message.includes("401")) {
          errorMessage = "Invalid Shopify credentials"
          errorDetails = "Your Shopify access token is invalid or has expired. Please check your connection settings."
        } else if (shopifyError.message.includes("403")) {
          errorMessage = "Insufficient Shopify permissions"
          errorDetails = "Your Shopify app doesn't have the required permissions to read orders."
        } else if (shopifyError.message.includes("404")) {
          errorMessage = "Shopify store not found"
          errorDetails = "The specified Shopify store domain could not be found."
        } else if (shopifyError.message.includes("429")) {
          errorMessage = "Shopify API rate limit exceeded"
          errorDetails = "Too many requests to Shopify API. Please wait a moment and try again."
        }
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          troubleshooting: {
            steps: [
              "Verify your internet connection is working",
              "Check that your Shopify store domain is correct",
              "Ensure your access token is valid and starts with 'shpat_'",
              "Verify your Shopify app has the required permissions",
              "Try again in a few minutes if this is a temporary issue",
            ],
          },
        },
        { status: 500 },
      )
    }

    if (orders.length === 0) {
      console.log("ℹ️ No orders found in Shopify store")
      return NextResponse.json({
        success: true,
        synced_count: 0,
        total_orders: 0,
        error_count: 0,
        message: "No orders found in Shopify store",
        data_source: "shopify_api",
      })
    }

    let syncedCount = 0
    let errorCount = 0
    let deliveryOrdersCreated = 0

    console.log(`🔄 Processing ${orders.length} orders...`)

    for (const order of orders) {
      try {
        console.log(`Processing order: ${order.order_number || order.name || order.id}`)

        const { data: existingOrderCheck, error: checkError } = await supabaseServiceRole.rpc(
          "check_shopify_order_exists",
          {
            p_shopify_order_id: order.id.toString(),
            p_connection_id: id,
          },
        )

        if (checkError) {
          console.error(`❌ Error checking if order ${order.id} exists:`, checkError)
          errorCount++
          continue
        }

        const orderExists = existingOrderCheck

        if (!orderExists) {
          // Normalize fulfillment status to match our constraints
          const normalizeFulfillmentStatus = (status: string | null | undefined): string => {
            if (!status) return "unfulfilled"
            const normalized = status.toLowerCase().trim()
            const validStatuses = ["fulfilled", "unfulfilled", "partial", "restocked", "pending", "open", "cancelled"]
            return validStatuses.includes(normalized) ? normalized : "unfulfilled"
          }

          // Normalize financial status to match our constraints
          const normalizeFinancialStatus = (status: string | null | undefined): string => {
            if (!status) return "pending"
            const normalized = status.toLowerCase().trim()
            const validStatuses = [
              "pending",
              "authorized",
              "partially_paid",
              "paid",
              "partially_refunded",
              "refunded",
              "voided",
              "cancelled",
            ]
            return validStatuses.includes(normalized) ? normalized : "pending"
          }

          const orderData = {
            shopify_connection_id: id,
            shopify_order_id: order.id.toString(),
            order_number: order.order_number || order.name || `${order.id}`,
            customer_name: order.customer
              ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() || "Unknown Customer"
              : "Unknown Customer",
            customer_email: order.customer?.email || "",
            customer_phone: order.customer?.phone || "",
            shipping_address: order.shipping_address || {},
            line_items: order.line_items || [],
            total_price: Number.parseFloat(order.total_price || "0.00"),
            fulfillment_status: normalizeFulfillmentStatus(order.fulfillment_status),
            financial_status: normalizeFinancialStatus(order.financial_status),
            created_at: order.created_at || new Date().toISOString(),
            synced_at: new Date().toISOString(),
          }

          console.log(`💾 Inserting order: ${orderData.order_number}`)
          console.log(`   - Fulfillment status: ${order.fulfillment_status} -> ${orderData.fulfillment_status}`)
          console.log(`   - Financial status: ${order.financial_status} -> ${orderData.financial_status}`)
          const { error: insertError } = await supabaseServiceRole.rpc("insert_shopify_order", {
            p_data: orderData,
          })

          if (insertError) {
            console.error(`❌ Error inserting order ${order.id} (${order.order_number || order.name}):`, insertError)
            errorCount++
          } else {
            syncedCount++
            console.log(`✅ Synced order: ${order.order_number || order.name}`)

            // Create delivery order if auto-create is enabled
            if (connection.settings?.auto_create_orders && order.shipping_address) {
              try {
                const deliveryCreated = await createDeliveryOrder(order, connection, user.id)
                if (deliveryCreated) {
                  deliveryOrdersCreated++
                  console.log(`📦 Created delivery order for: ${order.order_number || order.name}`)
                }
              } catch (deliveryError) {
                console.error(`❌ Error creating delivery order for ${order.id}:`, deliveryError)
              }
            }
          }
        } else {
          console.log(`ℹ️ Order ${order.order_number || order.name} already exists, skipping`)
        }
      } catch (orderError) {
        console.error(`❌ Error processing order ${order.id}:`, orderError)
        errorCount++
      }
    }

    // Update connection stats with correct count
    try {
      console.log("📊 Updating connection stats...")
      const { data: currentConnection } = await supabaseServiceRole
        .from("shopify_connections")
        .select("orders_synced")
        .eq("id", id)
        .single()

      const newOrdersCount = (currentConnection?.orders_synced || 0) + syncedCount

      await supabaseServiceRole
        .from("shopify_connections")
        .update({
          last_sync: new Date().toISOString(),
          orders_synced: newOrdersCount,
        })
        .eq("id", id)
        .eq("admin_id", user.id)
      console.log(`✅ Connection stats updated - Total orders synced: ${newOrdersCount}`)
    } catch (updateError) {
      console.error("⚠️ Error updating connection stats:", updateError)
    }

    const message = `Successfully synced ${syncedCount} orders from Shopify${deliveryOrdersCreated > 0 ? ` and created ${deliveryOrdersCreated} delivery orders` : ""}${errorCount > 0 ? ` (${errorCount} errors)` : ""}`

    console.log(
      `🎉 Sync completed: ${syncedCount} synced, ${deliveryOrdersCreated} delivery orders created, ${errorCount} errors`,
    )
    return NextResponse.json({
      success: true,
      synced_count: syncedCount,
      delivery_orders_created: deliveryOrdersCreated,
      total_orders: orders.length,
      error_count: errorCount,
      message,
      data_source: "shopify_api",
    })
  } catch (error) {
    console.error("💥 Critical error in sync endpoint:", error)
    logError(error, { endpoint: "shopify_sync", connection_id: params.id })
    return NextResponse.json(
      {
        error: "Failed to sync orders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function fetchShopifyOrders(shopDomain: string, accessToken: string): Promise<any[]> {
  // Validate inputs
  if (!shopDomain || !accessToken) {
    throw new Error("Shop domain and access token are required")
  }

  // Clean up shop domain (remove protocol if present)
  const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")

  const url = `https://${cleanDomain}/admin/api/2023-10/orders.json?status=any&limit=50`

  console.log("🌐 Fetching from Shopify API:", url)
  console.log("🔑 Using access token:", accessToken.substring(0, 10) + "...")

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("TIMEOUT: Request took longer than 30 seconds")), 30000)
  })

  try {
    // Race between fetch and timeout
    const fetchPromise = fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        "User-Agent": "DeliveryOS/1.0",
        Accept: "application/json",
      },
    })

    console.log("📡 Making request to Shopify API...")
    const response = (await Promise.race([fetchPromise, timeoutPromise])) as Response

    console.log("📡 Shopify API response status:", response.status)
    console.log("📡 Shopify API response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Shopify API error:", response.status, errorText)

      // Provide specific error messages based on status code
      switch (response.status) {
        case 401:
          throw new Error(`Shopify API authentication failed (401): Invalid access token`)
        case 403:
          throw new Error(`Shopify API access forbidden (403): Insufficient permissions`)
        case 404:
          throw new Error(`Shopify store not found (404): Check your shop domain`)
        case 429:
          throw new Error(`Shopify API rate limit exceeded (429): Too many requests`)
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error(`Shopify API server error (${response.status}): Please try again later`)
        default:
          throw new Error(`Shopify API error (${response.status}): ${errorText}`)
      }
    }

    const data = await response.json()
    console.log(`✅ Shopify API returned ${data.orders?.length || 0} orders`)

    // Validate response structure
    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from Shopify API")
    }

    return data.orders || []
  } catch (error) {
    console.error("❌ Fetch error details:", error)

    // Handle different types of errors
    if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
      throw new Error(
        "NETWORK_ERROR: Unable to connect to Shopify API. Please check your internet connection and ensure the Shopify domain is correct.",
      )
    }

    if (error instanceof Error && error.message.includes("TIMEOUT")) {
      throw new Error("TIMEOUT: Shopify API took too long to respond. Please try again.")
    }

    // Re-throw the error if it's already a custom error
    throw error
  }
}

async function createDeliveryOrder(shopifyOrder: any, connection: any, adminId: string) {
  try {
    console.log(`📦 Creating delivery order for Shopify order: ${shopifyOrder.order_number || shopifyOrder.id}`)

    // Generate order number based on Shopify order number/ID
    const orderNumber = `${shopifyOrder.order_number || shopifyOrder.id}`

    // Check if an order with this number already exists
    const { data: existingOrder, error: checkError } = await supabaseServiceRole
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .maybeSingle()

    if (checkError) {
      console.error("❌ Error checking for existing order:", checkError)
    }

    // If order number already exists, make it unique by adding a timestamp suffix
    let finalOrderNumber = orderNumber
    if (existingOrder) {
      const timestamp = new Date().getTime().toString().slice(-6)
      finalOrderNumber = `${orderNumber}-${timestamp}`
      console.log(`⚠️ Order number ${orderNumber} already exists, using ${finalOrderNumber} instead`)
    }

    // Get the Shopify connection ID from the connection object
    const shopifyConnectionId = connection.id

    // Prepare the delivery order data with the shopify_connection_id field
    const deliveryOrderData = {
      order_number: finalOrderNumber,
      customer_name: shopifyOrder.customer
        ? `${shopifyOrder.customer.first_name || ""} ${shopifyOrder.customer.last_name || ""}`.trim() ||
          "Unknown Customer"
        : "Unknown Customer",
      customer_phone: shopifyOrder.customer?.phone || "",
      customer_email: shopifyOrder.customer?.email || "",
      pickup_address: connection.settings?.pickup_address || "Store Location",
      delivery_address: formatAddress(shopifyOrder.shipping_address),
      delivery_notes:
        shopifyOrder.line_items
          ?.map((item: any) => `${item.quantity || 1}x ${item.title || item.name || "Item"}`)
          .join(", ") || "Shopify Order Items",
      priority: "normal" as const,
      status: "pending" as const,
      created_by: adminId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Store Shopify connection info for later fulfillment updates
      external_order_id: shopifyOrder.id.toString(),
      source: "shopify",
      shopify_connection_id: shopifyConnectionId, // Add this field to satisfy the constraint
    }

    console.log("📦 Delivery order data:", deliveryOrderData)

    const { error } = await supabaseServiceRole.from("orders").insert(deliveryOrderData)
    if (error) {
      console.error("❌ Error creating delivery order:", error)
      throw error
    } else {
      console.log(`✅ Created delivery order: ${finalOrderNumber}`)
      return true // Return success indicator
    }
  } catch (error) {
    console.error("❌ Error in createDeliveryOrder:", error)
    throw error
  }
}

function formatAddress(address: any): string {
  if (!address) return ""
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
