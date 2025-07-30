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

export async function POST(request: NextRequest) {
  console.log("🔄 Processing fulfillment status update...")

  try {
    const { orderId, status, driverId, adminId } = await request.json()

    if (!orderId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Only process delivered/completed orders
    if (status !== "delivered" && status !== "completed") {
      return NextResponse.json({
        success: true,
        message: "Status update processed, no Shopify fulfillment needed",
      })
    }

    // Get order details including Shopify connection info
    const { data: order, error: orderError } = await supabaseServiceRole
      .from("orders")
      .select(`
        *,
        shopify_connections!shopify_connection_id (
          id,
          shop_domain,
          access_token,
          is_active,
          settings
        )
      `)
      .eq("id", orderId)
      .single()

    if (orderError || !order) {
      console.error("❌ Error fetching order:", orderError)
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Check if this is a Shopify order that needs fulfillment
    if (!order.shopify_order_id || !order.shopify_connections) {
      console.log("ℹ️ Order is not from Shopify, skipping fulfillment update")
      return NextResponse.json({
        success: true,
        message: "Order updated, not a Shopify order",
      })
    }

    const connection = order.shopify_connections

    if (!connection.is_active || !connection.access_token) {
      console.log("⚠️ Shopify connection is inactive or missing access token")
      return NextResponse.json({
        success: true,
        message: "Order updated, Shopify connection inactive",
      })
    }

    // Check if already fulfilled
    if (order.shopify_fulfillment_id) {
      console.log("ℹ️ Order already fulfilled in Shopify")
      return NextResponse.json({
        success: true,
        message: "Order already fulfilled in Shopify",
      })
    }

    try {
      // Fulfill the order in Shopify
      const fulfillmentResult = await fulfillShopifyOrder(
        connection.shop_domain,
        connection.access_token,
        order.shopify_order_id,
        order.order_number,
        driverId || adminId || "system",
      )

      // Update our record with fulfillment info
      await supabaseServiceRole
        .from("orders")
        .update({
          shopify_fulfillment_id: fulfillmentResult.fulfillment_id,
          shopify_fulfilled_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      // Update the shopify_orders table to reflect the new status
      await supabaseServiceRole
        .from("shopify_orders")
        .update({
          fulfillment_status: "fulfilled",
          synced_at: new Date().toISOString(),
        })
        .eq("shopify_order_id", order.shopify_order_id)
        .eq("shopify_connection_id", connection.id)

      console.log(`✅ Successfully fulfilled Shopify order: ${order.order_number}`)

      return NextResponse.json({
        success: true,
        message: "Order delivered and Shopify fulfillment updated",
        shopify_fulfillment_id: fulfillmentResult.fulfillment_id,
      })
    } catch (shopifyError) {
      console.error("❌ Failed to update Shopify fulfillment:", shopifyError)

      return NextResponse.json(
        {
          success: false,
          error: "Failed to update Shopify fulfillment",
          details: shopifyError instanceof Error ? shopifyError.message : "Unknown error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("❌ Error updating fulfillment status:", error)
    logError(error, { endpoint: "update_fulfillment_status", order_id: request.body?.orderId })

    return NextResponse.json(
      {
        error: "Failed to update fulfillment status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function fulfillShopifyOrder(
  shopDomain: string,
  accessToken: string,
  shopifyOrderId: string,
  orderNumber: string,
  userId: string,
): Promise<{ fulfillment_id: string }> {
  console.log(`🏪 Fulfilling Shopify order: ${shopifyOrderId} on ${shopDomain}`)

  // Get user info for tracking
  const { data: user } = await supabaseServiceRole
    .from("user_profiles")
    .select("first_name, last_name, role")
    .eq("user_id", userId)
    .single()

  const userName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || `${user.role || "User"}`
    : "Delivery Service"

  const fulfillmentData = {
    fulfillment: {
      location_id: null, // Shopify will use the first location
      tracking_number: `DEL-${orderNumber}`,
      tracking_company: "DeliveryOS Local Delivery",
      tracking_url: null,
      notify_customer: true,
      line_items: [], // Empty array means fulfill all items
    },
  }

  const response = await fetch(`https://${shopDomain}/admin/api/2023-10/orders/${shopifyOrderId}/fulfillments.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fulfillmentData),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error("❌ Shopify fulfillment error:", response.status, errorText)
    throw new Error(`Shopify fulfillment failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  console.log(`✅ Shopify fulfillment created: ${result.fulfillment.id}`)

  return {
    fulfillment_id: result.fulfillment.id.toString(),
  }
}
