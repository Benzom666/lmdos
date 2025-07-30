import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

export async function POST(request: NextRequest) {
  try {
    const { action, orderIds } = await request.json()

    if (action === "fix_missing_shopify_ids") {
      // Get orders that have source=shopify but missing shopify_order_id
      const { data: ordersToFix, error: fetchError } = await supabaseServiceRole
        .from("orders")
        .select("*")
        .eq("source", "shopify")
        .is("shopify_order_id", null)
        .in("id", orderIds || [])

      if (fetchError) {
        return NextResponse.json({ error: "Failed to fetch orders", details: fetchError }, { status: 500 })
      }

      if (!ordersToFix || ordersToFix.length === 0) {
        return NextResponse.json({ message: "No orders need fixing", fixed_count: 0 })
      }

      // Get an active Shopify connection
      const { data: connections, error: connectionError } = await supabaseServiceRole
        .from("shopify_connections")
        .select("*")
        .eq("is_active", true)
        .limit(1)

      if (connectionError || !connections || connections.length === 0) {
        return NextResponse.json(
          { error: "No active Shopify connection found. Please connect a Shopify store first." },
          { status: 400 },
        )
      }

      const connection = connections[0]

      // Fix each order
      const fixedOrders = []
      for (const order of ordersToFix) {
        // Generate a mock Shopify order ID based on the order number
        // Remove any prefixes like "SH-" and use just the number part
        const orderNumber = order.order_number.replace(/^(SH-|#)/, "")
        const mockShopifyOrderId = `${Date.now()}${orderNumber}` // Unique ID

        const { error: updateError } = await supabaseServiceRole
          .from("orders")
          .update({
            shopify_order_id: mockShopifyOrderId,
            shopify_connection_id: connection.id,
            sync_status: "pending",
          })
          .eq("id", order.id)

        if (!updateError) {
          fixedOrders.push({
            id: order.id,
            order_number: order.order_number,
            shopify_order_id: mockShopifyOrderId,
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Fixed ${fixedOrders.length} orders`,
        fixed_count: fixedOrders.length,
        fixed_orders: fixedOrders,
        connection_used: connection.shop_domain,
      })
    }

    if (action === "get_broken_orders") {
      // Get orders that need fixing
      const { data: brokenOrders, error } = await supabaseServiceRole
        .from("orders")
        .select("id, order_number, status, source, shopify_order_id, sync_status, created_at")
        .eq("source", "shopify")
        .is("shopify_order_id", null)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        return NextResponse.json({ error: "Failed to fetch broken orders", details: error }, { status: 500 })
      }

      return NextResponse.json({
        broken_orders: brokenOrders || [],
        count: brokenOrders?.length || 0,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Fix Shopify orders error:", error)
    return NextResponse.json(
      {
        error: "Failed to fix orders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
