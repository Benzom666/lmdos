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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let orderNumber = searchParams.get("order")

    if (!orderNumber) {
      return NextResponse.json({
        error: "Order number is required",
        details: "Please provide an order number to debug",
      })
    }

    // Clean any remaining SH- prefix from input
    orderNumber = orderNumber.replace(/^SH-/i, "")
    console.log(`🔍 Debugging order: ${orderNumber}`)

    // Get order details
    const { data: order, error: orderError } = await supabaseServiceRole
      .from("orders")
      .select("*")
      .eq("order_number", orderNumber)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        error: "Order not found",
        details: `No order found with number: ${orderNumber}`,
        debug_info: {
          searched_for: orderNumber,
          error: orderError?.message,
        },
      })
    }

    // Get Shopify connection if this is a Shopify order
    let connection = null
    if (order.shopify_connection_id) {
      const { data: connData, error: connError } = await supabaseServiceRole
        .from("shopify_connections")
        .select("*")
        .eq("id", order.shopify_connection_id)
        .single()

      if (!connError && connData) {
        connection = {
          shop_domain: connData.shop_domain,
          is_active: connData.is_active,
          has_token: !!connData.access_token,
          token_length: connData.access_token?.length || 0,
        }
      }
    }

    // Determine if order can be fulfilled
    const canFulfill = !!(
      order.status === "delivered" &&
      order.shopify_order_id &&
      order.shopify_connection_id &&
      connection?.is_active &&
      connection?.has_token
    )

    const fulfillmentReady = canFulfill && !order.shopify_fulfillment_id

    return NextResponse.json({
      success: true,
      order: {
        order_number: order.order_number,
        status: order.status,
        source: order.shopify_order_id ? "shopify" : "manual",
        shopify_order_id: order.shopify_order_id,
        shopify_fulfillment_id: order.shopify_fulfillment_id,
        completed_at: order.completed_at,
      },
      connection,
      debug_info: {
        can_fulfill: canFulfill,
        fulfillment_ready: fulfillmentReady,
        reasons: {
          is_delivered: order.status === "delivered",
          has_shopify_order_id: !!order.shopify_order_id,
          has_connection: !!order.shopify_connection_id,
          connection_active: connection?.is_active || false,
          has_access_token: connection?.has_token || false,
          not_already_fulfilled: !order.shopify_fulfillment_id,
        },
        recommendations: fulfillmentReady
          ? ["Order is ready to be fulfilled in Shopify"]
          : [
              !order.shopify_order_id && "This is not a Shopify order",
              order.status !== "delivered" && "Order must be marked as delivered first",
              !connection?.is_active && "Shopify connection is not active",
              !connection?.has_token && "Missing Shopify access token",
              order.shopify_fulfillment_id && "Order is already fulfilled in Shopify",
            ].filter(Boolean),
      },
    })
  } catch (error) {
    console.error("❌ Debug fulfillment error:", error)
    return NextResponse.json({
      error: "Debug failed",
      details: error instanceof Error ? error.message : "Unknown error occurred",
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { orderId, force = false } = body

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: "Order ID is required",
      })
    }

    // Clean any remaining SH- prefix from input
    orderId = orderId.replace(/^SH-/i, "")
    console.log(`🚀 Attempting to fulfill order: ${orderId}`)

    // Get order details with connection info
    const { data: order, error: orderError } = await supabaseServiceRole
      .from("orders")
      .select(`
        *,
        shopify_connections!shopify_connection_id (
          id,
          shop_domain,
          access_token,
          is_active
        )
      `)
      .eq("order_number", orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: "Order not found",
        details: `No order found with number: ${orderId}`,
      })
    }

    // Validate this is a Shopify order
    if (!order.shopify_order_id || !order.shopify_connections) {
      return NextResponse.json({
        success: false,
        error: "Not a Shopify order",
        details: "This order is not from Shopify and cannot be fulfilled",
      })
    }

    const connection = order.shopify_connections

    // Check if connection is active
    if (!connection.is_active) {
      return NextResponse.json({
        success: false,
        error: "Shopify connection inactive",
        details: "The Shopify connection is not active",
      })
    }

    // Check if order is delivered (or force)
    if (order.status !== "delivered" && !force) {
      return NextResponse.json({
        success: false,
        error: "Order not delivered",
        details: "Order must be marked as delivered before fulfillment",
      })
    }

    // Check if already fulfilled
    if (order.shopify_fulfillment_id) {
      return NextResponse.json({
        success: false,
        error: "Already fulfilled",
        details: `Order already fulfilled with ID: ${order.shopify_fulfillment_id}`,
      })
    }

    // Use the Shopify order ID directly (should be the long number like 17494466319971009)
    const shopifyOrderId = order.shopify_order_id
    console.log(`🏪 Fulfilling Shopify order: ${shopifyOrderId}`)

    const fulfillmentData = {
      fulfillment: {
        location_id: null,
        tracking_number: `DEL-${order.order_number}`,
        tracking_company: "DeliveryOS Local Delivery",
        notify_customer: true,
      },
    }

    const shopifyResponse = await fetch(
      `https://${connection.shop_domain}/admin/api/2023-10/orders/${shopifyOrderId}/fulfillments.json`,
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

      return NextResponse.json({
        success: false,
        error: "Shopify fulfillment failed",
        details: `HTTP ${shopifyResponse.status}: ${errorText}`,
        debug_info: {
          shopify_order_id: shopifyOrderId,
          order_number: order.order_number,
          tracking_number: `DEL-${order.order_number}`,
          url: `https://${connection.shop_domain}/admin/api/2023-10/orders/${shopifyOrderId}/fulfillments.json`,
        },
      })
    }

    const fulfillmentResult = await shopifyResponse.json()
    console.log("✅ Shopify fulfillment created:", fulfillmentResult.fulfillment.id)

    // Update order with fulfillment details
    await supabaseServiceRole
      .from("orders")
      .update({
        shopify_fulfillment_id: fulfillmentResult.fulfillment.id.toString(),
        shopify_fulfilled_at: new Date().toISOString(),
        sync_status: "synced",
      })
      .eq("id", order.id)

    return NextResponse.json({
      success: true,
      message: "Order fulfilled successfully in Shopify",
      fulfillment_id: fulfillmentResult.fulfillment.id,
      tracking_number: fulfillmentResult.fulfillment.tracking_number,
    })
  } catch (error) {
    console.error("❌ Fulfillment error:", error)
    return NextResponse.json({
      success: false,
      error: "Fulfillment failed",
      details: error instanceof Error ? error.message : "Unknown error occurred",
    })
  }
}
