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
  console.log("🚚 Driver completing order...")

  try {
    const { orderId, driverId, completionData } = await request.json()

    if (!orderId || !driverId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the driver is assigned to this order
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
      .eq("driver_id", driverId)
      .single()

    if (orderError || !order) {
      console.error("❌ Order not found or not assigned to driver:", orderError)
      return NextResponse.json({ error: "Order not found or not assigned to you" }, { status: 404 })
    }

    // Update the order status to delivered
    const updateData = {
      status: "delivered",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: "pending", // Mark for sync
      ...completionData, // Include photos, notes, signature, etc.
    }

    const { error: updateError } = await supabaseServiceRole.from("orders").update(updateData).eq("id", orderId)

    if (updateError) {
      console.error("❌ Error updating order:", updateError)
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
    }

    console.log(`✅ Order ${order.order_number} marked as delivered by driver`)

    // Queue for Shopify fulfillment sync if this is a Shopify order
    let shopifyQueued = false
    if (order.shopify_order_id && order.shopify_connections?.is_active) {
      try {
        await shopifyFulfillmentSync.queueOrderForFulfillment(orderId)
        shopifyQueued = true
        console.log(`📦 Queued order ${order.order_number} for Shopify fulfillment sync`)
      } catch (fulfillmentError) {
        console.error("⚠️ Failed to queue order for fulfillment sync:", fulfillmentError)
        // Don't fail the entire request if fulfillment queuing fails
      }
    }

    // Also try immediate fulfillment for faster response (fallback to queue if this fails)
    let immediateResult = null
    if (order.shopify_order_id && order.shopify_connections?.is_active) {
      try {
        immediateResult = await shopifyFulfillmentSync.fulfillShopifyOrder(
          order.shopify_connections.shop_domain,
          order.shopify_connections.access_token,
          order.shopify_order_id,
          order.order_number,
          driverId,
        )

        if (immediateResult.success) {
          // Update our record with fulfillment info
          await supabaseServiceRole
            .from("orders")
            .update({
              shopify_fulfillment_id: immediateResult.fulfillment_id,
              shopify_fulfilled_at: new Date().toISOString(),
              sync_status: "synced",
            })
            .eq("id", orderId)

          console.log(`🏪 Immediate Shopify fulfillment successful for order: ${order.order_number}`)
        }
      } catch (shopifyError) {
        console.error("⚠️ Immediate Shopify fulfillment failed, will rely on queue:", shopifyError)
        // Queue will handle this
      }
    }

    // Send notifications
    await Promise.all([
      sendDriverCompletionNotification(order, driverId),
      sendAdminCompletionNotification(order, driverId, immediateResult?.success || shopifyQueued),
    ])

    return NextResponse.json({
      success: true,
      message: "Order completed successfully",
      order: {
        id: order.id,
        order_number: order.order_number,
        status: "delivered",
        completed_at: updateData.completed_at,
      },
      shopify_sync: {
        queued: shopifyQueued,
        immediate_success: immediateResult?.success || false,
        fulfillment_id: immediateResult?.fulfillment_id,
      },
    })
  } catch (error) {
    console.error("❌ Error completing order:", error)
    logError(error, { endpoint: "driver_complete_order" })

    return NextResponse.json(
      {
        error: "Failed to complete order",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function sendDriverCompletionNotification(order: any, driverId: string) {
  try {
    const notificationData = {
      user_id: driverId,
      title: "Delivery Completed",
      message: `You have successfully completed delivery for order ${order.order_number}`,
      type: "success",
      read: false,
      created_at: new Date().toISOString(),
    }

    await supabaseServiceRole.from("notifications").insert(notificationData)
    console.log(`🔔 Sent completion notification to driver: ${driverId}`)
  } catch (error) {
    console.error("❌ Error sending driver notification:", error)
  }
}

async function sendAdminCompletionNotification(order: any, driverId: string, shopifySync: boolean) {
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
        ? " and Shopify fulfillment is being processed"
        : " (Shopify sync pending)"
      : ""

    const notificationData = {
      user_id: order.created_by,
      title: "Order Delivered",
      message: `Order ${order.order_number} has been successfully delivered by ${driverName}${shopifyMessage}`,
      type: "success",
      read: false,
      created_at: new Date().toISOString(),
    }

    await supabaseServiceRole.from("notifications").insert(notificationData)
    console.log(`🔔 Sent completion notification to admin: ${order.created_by}`)
  } catch (error) {
    console.error("❌ Error sending admin notification:", error)
  }
}
