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

export async function POST(request: NextRequest) {
  try {
    const { orderId, trackingNumber, trackingCompany, notifyCustomer = true } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get order details including Shopify connection info
    const { data: order, error: orderError } = await supabaseServiceRole
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      console.error("Error fetching order:", orderError)
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Check if this is a Shopify order
    if (!order.shopify_order_id || !order.shopify_connection_id) {
      return NextResponse.json({
        success: false,
        message: "Not a Shopify order",
        shopify_updated: false,
      })
    }

    // Get Shopify connection details
    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .eq("id", order.shopify_connection_id)
      .single()

    if (connectionError || !connection) {
      console.error("Error fetching Shopify connection:", connectionError)
      return NextResponse.json({ error: "Shopify connection not found" }, { status: 404 })
    }

    // Check if connection is active
    if (!connection.is_active) {
      return NextResponse.json({
        success: false,
        message: "Shopify connection is not active",
        shopify_updated: false,
      })
    }

    // Fulfill the order in Shopify
    console.log(`🏪 Fulfilling Shopify order: ${order.shopify_order_id}`)

    try {
      const fulfillmentData = {
        fulfillment: {
          location_id: null, // Shopify will use the first location
          tracking_number: trackingNumber || `DEL-${orderId.slice(-8)}`,
          tracking_company: trackingCompany || "Local Delivery",
          notify_customer: notifyCustomer,
        },
      }

      const shopifyResponse = await fetch(
        `https://${connection.shop_domain}/admin/api/2023-10/orders/${order.shopify_order_id}/fulfillments.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": connection.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fulfillmentData),
        },
      )

      if (!shopifyResponse.ok) {
        const errorText = await shopifyResponse.text()
        console.error("❌ Shopify fulfillment error:", shopifyResponse.status, errorText)
        throw new Error(`Shopify fulfillment error: ${shopifyResponse.status} ${errorText}`)
      }

      const fulfillmentResult = await shopifyResponse.json()
      console.log("✅ Shopify fulfillment created:", fulfillmentResult.fulfillment.id)

      // Update order with fulfillment details
      await supabaseServiceRole
        .from("orders")
        .update({
          shopify_fulfillment_id: fulfillmentResult.fulfillment.id.toString(),
          shopify_fulfilled_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      return NextResponse.json({
        success: true,
        message: "Shopify order fulfilled successfully",
        shopify_updated: true,
        fulfillment_id: fulfillmentResult.fulfillment.id,
      })
    } catch (fulfillmentError) {
      console.error("Error fulfilling Shopify order:", fulfillmentError)
      return NextResponse.json({
        success: false,
        message: fulfillmentError instanceof Error ? fulfillmentError.message : "Failed to fulfill Shopify order",
        shopify_updated: false,
      })
    }
  } catch (error) {
    console.error("Error in fulfill-order endpoint:", error)
    logError(error, { endpoint: "shopify_fulfill_order" })
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fulfill order",
        details: error instanceof Error ? error.message : "Unknown error",
        shopify_updated: false,
      },
      { status: 500 },
    )
  }
}
