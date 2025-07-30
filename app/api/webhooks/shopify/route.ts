import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { logError, AppError } from "@/lib/error-handler"

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

function verifyShopifyWebhook(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(body, "utf8")
  const calculatedSignature = hmac.digest("base64")
  return crypto.timingSafeEqual(Buffer.from(signature, "base64"), Buffer.from(calculatedSignature, "base64"))
}

export async function POST(request: NextRequest) {
  console.log("🔔 Shopify webhook received")

  try {
    const body = await request.text()
    const signature = request.headers.get("x-shopify-hmac-sha256")
    const topic = request.headers.get("x-shopify-topic")
    const shopDomain = request.headers.get("x-shopify-shop-domain")

    console.log(`📦 Webhook: ${topic} from ${shopDomain}`)

    if (!signature || !topic || !shopDomain) {
      throw new AppError("Missing required Shopify headers", 400)
    }

    const data = JSON.parse(body)

    // Handle different webhook topics for real-time sync
    switch (topic) {
      case "orders/create":
        await handleNewOrder(data, shopDomain)
        break
      case "orders/updated":
        await handleOrderUpdate(data, shopDomain)
        break
      case "orders/cancelled":
        await handleOrderCancellation(data, shopDomain)
        break
      case "orders/fulfilled":
      case "orders/partially_fulfilled":
        await handleOrderFulfillment(data, shopDomain)
        break
      default:
        console.log(`ℹ️ Unhandled webhook topic: ${topic}`)
    }

    console.log(`✅ Webhook processed: ${topic}`)
    return NextResponse.json({ success: true, processed: topic })
  } catch (error) {
    console.error("❌ Webhook processing failed:", error)
    logError(error, {
      endpoint: "shopify_webhook",
      shop: request.headers.get("x-shopify-shop-domain"),
      topic: request.headers.get("x-shopify-topic"),
    })

    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function handleNewOrder(order: any, shopDomain: string) {
  console.log(`🆕 Processing new order: ${order.order_number || order.name} from ${shopDomain}`)

  try {
    // Find the active connection for this shop
    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .eq("shop_domain", shopDomain)
      .eq("is_active", true)
      .single()

    if (connectionError || !connection) {
      console.log(`⚠️ No active connection found for shop: ${shopDomain}`)
      return
    }

    // Check if order already exists in shopify_orders table
    const { data: existingShopifyOrder } = await supabaseServiceRole
      .from("shopify_orders")
      .select("id")
      .eq("shopify_order_id", order.id.toString())
      .eq("shopify_connection_id", connection.id)
      .maybeSingle()

    if (existingShopifyOrder) {
      console.log(`ℹ️ Shopify order ${order.order_number} already exists, skipping`)
      return
    }

    // Store the Shopify order data
    const shopifyOrderData = {
      shopify_connection_id: connection.id,
      shopify_order_id: order.id.toString(),
      order_number: order.order_number || order.name || `#${order.id}`,
      customer_name: getCustomerName(order.customer),
      customer_email: order.customer?.email || "",
      customer_phone: order.customer?.phone || "",
      shipping_address: order.shipping_address || {},
      line_items: order.line_items || [],
      total_price: Number.parseFloat(order.total_price || "0.00"),
      fulfillment_status: order.fulfillment_status || "unfulfilled",
      financial_status: order.financial_status || "pending",
      created_at: order.created_at || new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }

    const { error: insertError } = await supabaseServiceRole.from("shopify_orders").insert(shopifyOrderData)

    if (insertError) {
      console.error("❌ Error storing Shopify order:", insertError)
      throw insertError
    }

    console.log(`✅ Stored Shopify order: ${order.order_number}`)

    // Auto-create delivery order if enabled and has shipping address
    if (connection.settings?.auto_create_orders && order.shipping_address) {
      await createDeliveryOrder(order, connection)
      console.log(`📦 Auto-created delivery order for: ${order.order_number}`)

      // Send real-time notification to admin
      await sendOrderNotification(connection.admin_id, order, "new_order")
    }
  } catch (error) {
    console.error(`❌ Error handling new order ${order.id}:`, error)
    throw error
  }
}

async function handleOrderUpdate(order: any, shopDomain: string) {
  console.log(`🔄 Processing order update: ${order.order_number || order.name} from ${shopDomain}`)

  try {
    const { data: connection } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .eq("shop_domain", shopDomain)
      .eq("is_active", true)
      .single()

    if (!connection) return

    // Update the Shopify order record
    const { error } = await supabaseServiceRole
      .from("shopify_orders")
      .update({
        fulfillment_status: order.fulfillment_status || "unfulfilled",
        financial_status: order.financial_status || "pending",
        synced_at: new Date().toISOString(),
      })
      .eq("shopify_order_id", order.id.toString())
      .eq("shopify_connection_id", connection.id)

    if (error) {
      console.error("❌ Error updating Shopify order:", error)
    } else {
      console.log(`✅ Updated Shopify order: ${order.order_number}`)
    }
  } catch (error) {
    console.error(`❌ Error handling order update ${order.id}:`, error)
  }
}

async function handleOrderCancellation(order: any, shopDomain: string) {
  console.log(`❌ Processing order cancellation: ${order.order_number || order.name} from ${shopDomain}`)

  try {
    const { data: connection } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .eq("shop_domain", shopDomain)
      .eq("is_active", true)
      .single()

    if (!connection) return

    // Update Shopify order status
    await supabaseServiceRole
      .from("shopify_orders")
      .update({
        fulfillment_status: "cancelled",
        synced_at: new Date().toISOString(),
      })
      .eq("shopify_order_id", order.id.toString())
      .eq("shopify_connection_id", connection.id)

    // Cancel corresponding delivery order if exists
    await supabaseServiceRole
      .from("orders")
      .update({ status: "cancelled" })
      .eq("shopify_order_id", order.id.toString())
      .eq("shopify_connection_id", connection.id)

    console.log(`✅ Cancelled order: ${order.order_number}`)
  } catch (error) {
    console.error(`❌ Error handling order cancellation ${order.id}:`, error)
  }
}

async function handleOrderFulfillment(order: any, shopDomain: string) {
  console.log(`📦 Processing order fulfillment: ${order.order_number || order.name} from ${shopDomain}`)

  try {
    const { data: connection } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .eq("shop_domain", shopDomain)
      .eq("is_active", true)
      .single()

    if (!connection) return

    await supabaseServiceRole
      .from("shopify_orders")
      .update({
        fulfillment_status: "fulfilled",
        synced_at: new Date().toISOString(),
      })
      .eq("shopify_order_id", order.id.toString())
      .eq("shopify_connection_id", connection.id)

    console.log(`✅ Marked order as fulfilled: ${order.order_number}`)
  } catch (error) {
    console.error(`❌ Error handling order fulfillment ${order.id}:`, error)
  }
}

async function createDeliveryOrder(shopifyOrder: any, connection: any) {
  try {
    // Generate unique order number
    const baseOrderNumber = `${connection.shop_domain.split(".")[0].toUpperCase()}-${shopifyOrder.order_number || shopifyOrder.id}`
    let orderNumber = baseOrderNumber

    // Check for duplicates and make unique if needed
    const { data: existingOrder } = await supabaseServiceRole
      .from("orders")
      .select("id")
      .eq("order_number", baseOrderNumber)
      .maybeSingle()

    if (existingOrder) {
      const timestamp = Date.now().toString().slice(-6)
      orderNumber = `${baseOrderNumber}-${timestamp}`
    }

    const deliveryOrderData = {
      order_number: orderNumber,
      customer_name: getCustomerName(shopifyOrder.customer),
      customer_phone: shopifyOrder.customer?.phone || "",
      customer_email: shopifyOrder.customer?.email || "",
      pickup_address: connection.settings?.pickup_address || `${connection.shop_domain} Store`,
      delivery_address: formatAddress(shopifyOrder.shipping_address),
      delivery_notes: formatLineItems(shopifyOrder.line_items),
      priority: determinePriority(shopifyOrder),
      status: "pending",
      created_by: connection.admin_id,
      shopify_order_id: shopifyOrder.id.toString(),
      shopify_connection_id: connection.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabaseServiceRole.from("orders").insert(deliveryOrderData)
    if (error) throw error

    console.log(`✅ Created delivery order: ${orderNumber}`)
    return orderNumber
  } catch (error) {
    console.error("❌ Error creating delivery order:", error)
    throw error
  }
}

async function sendOrderNotification(adminId: string, order: any, type: string) {
  try {
    const notificationData = {
      user_id: adminId,
      title: "New Shopify Order",
      message: `New order ${order.order_number || order.name} received from ${getCustomerName(order.customer)}`,
      type: "info",
      read: false,
      created_at: new Date().toISOString(),
    }

    await supabaseServiceRole.from("notifications").insert(notificationData)
    console.log(`🔔 Sent notification to admin: ${adminId}`)
  } catch (error) {
    console.error("❌ Error sending notification:", error)
  }
}

function getCustomerName(customer: any): string {
  if (!customer) return "Unknown Customer"
  const firstName = customer.first_name || ""
  const lastName = customer.last_name || ""
  return `${firstName} ${lastName}`.trim() || "Unknown Customer"
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

function formatLineItems(lineItems: any[]): string {
  if (!lineItems || lineItems.length === 0) return "Shopify Order Items"
  return lineItems.map((item: any) => `${item.quantity || 1}x ${item.title || item.name || "Item"}`).join(", ")
}

function determinePriority(order: any): "low" | "normal" | "high" | "urgent" {
  const totalPrice = Number.parseFloat(order.total_price || "0")
  if (totalPrice > 500) return "high"
  if (totalPrice > 200) return "normal"
  return "low"
}
