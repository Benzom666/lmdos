import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logError } from "@/lib/error-handler"
import { shopifyFulfillmentSync } from "@/lib/shopify-fulfillment-sync"

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
  console.log("📦 Processing delivery completion...")

  try {
    const { orderId, driverId, completionData } = await request.json()

    if (!orderId || !driverId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
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

    // Update the delivery order status
    const { error: updateError } = await supabaseServiceRole
      .from("orders")
      .update({
        status: "delivered",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: "pending", // Mark for sync
        ...completionData, // Include any additional completion data (photos, notes, etc.)
      })
      .eq("id", orderId)

    if (updateError) {
      console.error("❌ Error updating order:", updateError)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }

    console.log(`✅ Marked delivery order ${order.order_number} as completed`)

    // Queue for Shopify fulfillment sync if this is a Shopify order
    let shopifyQueued = false
    let fulfillmentResult = null

    if (order.shopify_order_id && order.shopify_connections?.is_active) {
      try {
        // Queue for background processing
        await shopifyFulfillmentSync.queueOrderForFulfillment(orderId)
        shopifyQueued = true
        console.log(`📦 Queued order ${order.order_number} for Shopify fulfillment sync`)

        // Also try immediate fulfillment
        fulfillmentResult = await shopifyFulfillmentSync.fulfillShopifyOrder(
          order.shopify_connections.shop_domain,
          order.shopify_connections.access_token,
          order.shopify_order_id,
          order.order_number,
          driverId,
        )

        if (fulfillmentResult.success) {
          // Update our record with fulfillment info
          await supabaseServiceRole
            .from("orders")
            .update({
              shopify_fulfillment_id: fulfillmentResult.fulfillment_id,
              shopify_fulfilled_at: new Date().toISOString(),
              sync_status: "synced",
            })
            .eq("id", orderId)

          console.log(`✅ Immediate Shopify fulfillment successful for order: ${order.order_number}`)
        } else {
          console.log(`⚠️ Immediate fulfillment failed, queued for retry: ${fulfillmentResult.error}`)
        }
      } catch (fulfillmentError) {
        console.error("⚠️ Failed to process Shopify fulfillment:", fulfillmentError)
        // Don't fail the entire request if fulfillment processing fails
      }
    }

    // Send notification to admin
    await sendCompletionNotification(order, driverId, shopifyQueued || fulfillmentResult?.success)

    return NextResponse.json({
      success: true,
      message: "Delivery completed successfully",
      shopify_sync: {
        queued: shopifyQueued,
        immediate_success: fulfillmentResult?.success || false,
        fulfillment_id: fulfillmentResult?.fulfillment_id,
        error: fulfillmentResult?.error,
      },
    })
  } catch (error) {
    console.error("❌ Error completing delivery:", error)
    logError(error, { endpoint: "complete_delivery", order_id: request.body?.orderId })

    return NextResponse.json(
      {
        error: "Failed to complete delivery",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function sendCompletionNotification(order: any, driverId: string, shopifySync: boolean) {
  try {
    // Get driver info
    const { data: driver } = await supabaseServiceRole
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("user_id", driverId)
      .single()

    const driverName = driver ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || "Driver" : "Driver"

    const shopifyMessage = order.shopify_order_id
      ? shopifySync
        ? " and Shopify fulfillment has been updated"
        : " (Shopify sync in progress)"
      : ""

    const notificationData = {
      user_id: order.created_by,
      title: "Delivery Completed",
      message: `Order ${order.order_number} has been delivered by ${driverName}${shopifyMessage}`,
      type: "success",
      read: false,
      created_at: new Date().toISOString(),
    }

    await supabaseServiceRole.from("notifications").insert(notificationData)
    console.log(`🔔 Sent completion notification for order: ${order.order_number}`)
  } catch (error) {
    console.error("❌ Error sending completion notification:", error)
  }
}
