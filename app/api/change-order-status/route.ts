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
  console.log("🔄 Processing order status change...")

  try {
    const { orderId, status, notes, driverId, adminId } = await request.json()

    if (!orderId || !status) {
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

    // Prepare update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    // Add completion timestamp if status is delivered
    if (status === "delivered") {
      updateData.completed_at = new Date().toISOString()
    }

    // Add assignment timestamp if status is assigned
    if (status === "assigned" && driverId) {
      updateData.assigned_at = new Date().toISOString()
      updateData.driver_id = driverId
    }

    // Update the order status
    const { error: updateError } = await supabaseServiceRole.from("orders").update(updateData).eq("id", orderId)

    if (updateError) {
      console.error("❌ Error updating order:", updateError)
      return NextResponse.json({ error: "Failed to update order status" }, { status: 500 })
    }

    console.log(`✅ Order ${order.order_number} status updated to: ${status}`)

    // Create order update record
    if (driverId || adminId) {
      const orderUpdateData = {
        order_id: orderId,
        driver_id: driverId || null,
        admin_id: adminId || null,
        status,
        notes: notes || null,
        created_at: new Date().toISOString(),
      }

      await supabaseServiceRole.from("order_updates").insert(orderUpdateData)
    }

    // Handle Shopify fulfillment if order is delivered and has Shopify connection
    let shopifyResult = null
    if ((status === "delivered" || status === "completed") && order.shopify_order_id && order.shopify_connections) {
      const connection = order.shopify_connections

      if (connection.is_active && connection.access_token && !order.shopify_fulfillment_id) {
        try {
          shopifyResult = await fulfillShopifyOrder(
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
              shopify_fulfillment_id: shopifyResult.fulfillment_id,
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

          console.log(`🏪 Shopify fulfillment updated for order: ${order.order_number}`)
        } catch (shopifyError) {
          console.error("⚠️ Failed to update Shopify fulfillment:", shopifyError)
          // Don't fail the entire request if Shopify update fails
          shopifyResult = { error: shopifyError.message }
        }
      }
    }

    // Send notifications based on status change
    await sendStatusChangeNotifications(order, status, driverId, adminId)

    return NextResponse.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: {
        id: order.id,
        order_number: order.order_number,
        status,
        updated_at: updateData.updated_at,
        completed_at: updateData.completed_at,
      },
      shopify_updated: !!shopifyResult && !shopifyResult?.error,
      shopify_result: shopifyResult,
    })
  } catch (error) {
    console.error("❌ Error changing order status:", error)
    logError(error, { endpoint: "change_order_status", order_id: request.body?.orderId })

    return NextResponse.json(
      {
        error: "Failed to change order status",
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

  // Get user info for tracking (could be driver or admin)
  const { data: user } = await supabaseServiceRole
    .from("user_profiles")
    .select("first_name, last_name, role")
    .eq("user_id", userId)
    .single()

  const userName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || `${user.role || "User"}`
    : "DeliveryOS"

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

async function sendStatusChangeNotifications(order: any, status: string, driverId?: string, adminId?: string) {
  try {
    const notifications = []

    // Notification for the order creator (admin)
    if (order.created_by && order.created_by !== adminId) {
      notifications.push({
        user_id: order.created_by,
        title: "Order Status Updated",
        message: `Order ${order.order_number} status changed to ${status.replace("_", " ")}${
          order.shopify_order_id && status === "delivered" ? " and Shopify has been updated" : ""
        }`,
        type: getNotificationType(status),
        read: false,
        created_at: new Date().toISOString(),
      })
    }

    // Notification for the driver if assigned
    if (driverId && driverId !== order.created_by) {
      let message = ""
      switch (status) {
        case "assigned":
          message = `You have been assigned to order ${order.order_number}`
          break
        case "delivered":
          message = `Order ${order.order_number} has been marked as delivered`
          break
        default:
          message = `Order ${order.order_number} status updated to ${status.replace("_", " ")}`
      }

      notifications.push({
        user_id: driverId,
        title: "Order Assignment",
        message,
        type: getNotificationType(status),
        read: false,
        created_at: new Date().toISOString(),
      })
    }

    if (notifications.length > 0) {
      await supabaseServiceRole.from("notifications").insert(notifications)
      console.log(`🔔 Sent ${notifications.length} status change notifications`)
    }
  } catch (error) {
    console.error("❌ Error sending status change notifications:", error)
  }
}

function getNotificationType(status: string): "info" | "success" | "warning" | "error" {
  switch (status) {
    case "delivered":
      return "success"
    case "failed":
    case "cancelled":
      return "error"
    case "assigned":
    case "picked_up":
    case "in_transit":
      return "info"
    default:
      return "info"
  }
}
