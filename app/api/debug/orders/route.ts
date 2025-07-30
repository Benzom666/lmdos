import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logError } from "@/lib/error-handler"

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

export async function GET(request: NextRequest) {
  console.log("🔍 Debugging orders...")

  try {
    // Get all orders with their details
    const { data: orders, error: ordersError } = await supabaseServiceRole
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)

    if (ordersError) {
      console.error("❌ Error fetching orders:", ordersError)
      return NextResponse.json({ error: "Failed to fetch orders", details: ordersError }, { status: 500 })
    }

    // Get Shopify connections
    const { data: connections, error: connectionsError } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .order("created_at", { ascending: false })

    if (connectionsError) {
      console.error("❌ Error fetching connections:", connectionsError)
    }

    // Analyze orders
    const analysis = {
      total_orders: orders.length,
      shopify_orders: orders.filter((o) => o.source === "shopify").length,
      orders_with_shopify_id: orders.filter((o) => o.shopify_order_id).length,
      orders_with_connection: orders.filter((o) => o.shopify_connection_id).length,
      pending_fulfillment: orders.filter((o) => o.sync_status === "pending").length,
      delivered_orders: orders.filter((o) => o.status === "delivered").length,
    }

    // Get specific orders mentioned in the issue
    const specificOrders = orders.filter((o) => ["1009", "1008"].includes(o.order_number))

    return NextResponse.json({
      success: true,
      analysis,
      connections: connections || [],
      recent_orders: orders.slice(0, 10).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        source: order.source,
        shopify_order_id: order.shopify_order_id,
        shopify_connection_id: order.shopify_connection_id,
        sync_status: order.sync_status,
        created_at: order.created_at,
      })),
      specific_orders: specificOrders.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        source: order.source,
        shopify_order_id: order.shopify_order_id,
        shopify_connection_id: order.shopify_connection_id,
        sync_status: order.sync_status,
        created_at: order.created_at,
      })),
    })
  } catch (error) {
    console.error("❌ Debug orders error:", error)
    logError(error, { endpoint: "debug_orders" })

    return NextResponse.json(
      {
        error: "Debug orders failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  console.log("🔧 Fixing order data...")

  try {
    const { action, orderIds } = await request.json()

    if (action === "mark_as_shopify") {
      if (!orderIds || !Array.isArray(orderIds)) {
        return NextResponse.json({ error: "Order IDs array is required" }, { status: 400 })
      }

      // Get active Shopify connection
      const { data: connection, error: connectionError } = await supabaseServiceRole
        .from("shopify_connections")
        .select("*")
        .eq("is_active", true)
        .single()

      if (connectionError || !connection) {
        return NextResponse.json(
          { error: "No active Shopify connection found", details: connectionError },
          { status: 400 },
        )
      }

      // Update orders to mark them as Shopify orders
      const updates = []
      for (const orderId of orderIds) {
        const { data: order, error: orderError } = await supabaseServiceRole
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single()

        if (orderError || !order) {
          console.error(`❌ Order ${orderId} not found:`, orderError)
          continue
        }

        // Generate a mock Shopify order ID if missing
        const shopifyOrderId = order.shopify_order_id || `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const updateData = {
          source: "shopify",
          shopify_order_id: shopifyOrderId,
          shopify_connection_id: connection.id,
          sync_status: order.status === "delivered" ? "pending" : "not_applicable",
        }

        const { error: updateError } = await supabaseServiceRole.from("orders").update(updateData).eq("id", orderId)

        if (updateError) {
          console.error(`❌ Failed to update order ${orderId}:`, updateError)
        } else {
          console.log(`✅ Updated order ${order.order_number} as Shopify order`)
          updates.push({
            order_id: orderId,
            order_number: order.order_number,
            updated: true,
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Updated ${updates.length} orders as Shopify orders`,
        updates,
      })
    }

    if (action === "sync_from_shopify") {
      // Get active Shopify connection
      const { data: connection, error: connectionError } = await supabaseServiceRole
        .from("shopify_connections")
        .select("*")
        .eq("is_active", true)
        .single()

      if (connectionError || !connection) {
        return NextResponse.json(
          { error: "No active Shopify connection found", details: connectionError },
          { status: 400 },
        )
      }

      // Fetch recent orders from Shopify
      const shopifyOrders = await fetchShopifyOrders(connection.shop_domain, connection.access_token)

      if (!shopifyOrders.success) {
        return NextResponse.json({ error: "Failed to fetch Shopify orders", details: shopifyOrders.error })
      }

      // Import/update orders
      const imported = []
      for (const shopifyOrder of shopifyOrders.orders) {
        const orderData = {
          order_number: shopifyOrder.order_number || shopifyOrder.name?.replace("#", ""),
          source: "shopify",
          shopify_order_id: shopifyOrder.id.toString(),
          shopify_connection_id: connection.id,
          status: mapShopifyStatus(shopifyOrder.fulfillment_status),
          sync_status: shopifyOrder.fulfillment_status === "fulfilled" ? "synced" : "pending",
          customer_name: `${shopifyOrder.customer?.first_name || ""} ${shopifyOrder.customer?.last_name || ""}`.trim(),
          customer_email: shopifyOrder.customer?.email,
          customer_phone: shopifyOrder.customer?.phone,
          delivery_address: formatShopifyAddress(shopifyOrder.shipping_address),
          total_amount: Number.parseFloat(shopifyOrder.total_price || "0"),
          created_at: shopifyOrder.created_at,
        }

        // Check if order already exists
        const { data: existingOrder } = await supabaseServiceRole
          .from("orders")
          .select("id")
          .eq("shopify_order_id", shopifyOrder.id.toString())
          .single()

        if (existingOrder) {
          // Update existing order
          const { error: updateError } = await supabaseServiceRole
            .from("orders")
            .update(orderData)
            .eq("id", existingOrder.id)

          if (!updateError) {
            imported.push({ action: "updated", order_number: orderData.order_number })
          }
        } else {
          // Insert new order
          const { error: insertError } = await supabaseServiceRole.from("orders").insert(orderData)

          if (!insertError) {
            imported.push({ action: "created", order_number: orderData.order_number })
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Imported ${imported.length} orders from Shopify`,
        imported,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("❌ Fix orders error:", error)
    logError(error, { endpoint: "fix_orders" })

    return NextResponse.json(
      {
        error: "Fix orders failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function fetchShopifyOrders(shopDomain: string, accessToken: string) {
  try {
    const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")
    const url = `https://${cleanDomain}/admin/api/2023-10/orders.json?limit=50&status=any`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        "User-Agent": "DeliveryOS/1.0",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Shopify API error (${response.status}): ${errorText}` }
    }

    const data = await response.json()
    return { success: true, orders: data.orders || [] }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

function mapShopifyStatus(fulfillmentStatus: string): string {
  switch (fulfillmentStatus) {
    case "fulfilled":
      return "delivered"
    case "partial":
      return "in_transit"
    case "unfulfilled":
    case null:
    case undefined:
      return "pending"
    default:
      return "pending"
  }
}

function formatShopifyAddress(address: any): string {
  if (!address) return ""

  const parts = [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip,
    address.country,
  ].filter(Boolean)

  return parts.join(", ")
}
