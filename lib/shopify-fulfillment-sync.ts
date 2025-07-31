import { createClient } from "@supabase/supabase-js"
import { logError } from "@/lib/error-handler"
import { supabase } from "./supabase"

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

export interface ShopifyFulfillmentResult {
  success: boolean
  fulfillment_id?: string
  tracking_number?: string
  error?: string
  details?: string
}

export const shopifyFulfillmentSync = {
  // Helper function to remove "SH-" prefix from order numbers
  normalizeOrderNumber(orderNumber: string): string {
    // Remove "SH-" prefix if present
    return orderNumber.replace(/^SH-/i, "")
  },

  async fulfillShopifyOrder(
    shopDomain: string,
    accessToken: string,
    shopifyOrderId: string,
    orderNumber: string,
    driverId?: string,
  ): Promise<ShopifyFulfillmentResult> {
    try {
      console.log(`🚀 Fulfilling Shopify order: ${shopifyOrderId} (${orderNumber})`)

      // Normalize the order number (remove SH- prefix)
      const normalizedOrderNumber = this.normalizeOrderNumber(orderNumber)

      // Prepare fulfillment data
      const fulfillmentData = {
        fulfillment: {
          location_id: null, // Use default location
          tracking_number: `DEL-${normalizedOrderNumber}`,
          tracking_company: "DeliveryOS Local Delivery",
          notify_customer: true,
          tracking_urls: [`${process.env.NEXT_PUBLIC_APP_URL}/track/${normalizedOrderNumber}`],
        },
      }

      // Add driver info if available
      if (driverId) {
        const { data: driver } = await supabase.from("drivers").select("name, phone").eq("id", driverId).single()

        if (driver) {
          fulfillmentData.fulfillment.tracking_company = `DeliveryOS - ${driver.name}`
          // Add driver contact info to tracking info
          if (driver.phone) {
            fulfillmentData.fulfillment.tracking_company += ` (${driver.phone})`
          }
        }
      }

      // Use the normalized Shopify order ID (without SH- prefix if it's the order number)
      const normalizedShopifyOrderId = shopifyOrderId.includes("SH-")
        ? this.normalizeOrderNumber(shopifyOrderId)
        : shopifyOrderId

      // Make API request to Shopify
      const response = await fetch(
        `https://${shopDomain}/admin/api/2023-10/orders/${normalizedShopifyOrderId}/fulfillments.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
            "User-Agent": "DeliveryOS/1.0",
          },
          body: JSON.stringify(fulfillmentData),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Shopify fulfillment error (${response.status}):`, errorText)
        return {
          success: false,
          error: `Shopify API error: ${response.status} - ${errorText}`,
        }
      }

      const result = await response.json()
      console.log("✅ Fulfillment created:", result.fulfillment.id)

      return {
        success: true,
        fulfillment_id: result.fulfillment.id,
        tracking_number: result.fulfillment.tracking_number,
      }
    } catch (error) {
      console.error("❌ Fulfillment error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },

  processingQueue: new Set<string>(),

  async queueOrderForFulfillment(orderId: string): Promise<void> {
    try {
      // Get order details with Shopify connection
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
        console.error("❌ Order not found for fulfillment queue:", orderError)
        return
      }

      // Only queue Shopify orders
      if (!order.shopify_order_id || !order.shopify_connections) {
        console.log("ℹ️ Order is not from Shopify, skipping fulfillment queue")
        return
      }

      // Check if connection is active
      if (!order.shopify_connections.is_active) {
        console.log("⚠️ Shopify connection is inactive, skipping fulfillment queue")
        return
      }

      // Add to sync queue
      const { error: queueError } = await supabaseServiceRole.from("shopify_sync_queue").insert({
        order_id: orderId,
        shopify_connection_id: order.shopify_connection_id,
        sync_type: "fulfillment",
        status: "pending",
        scheduled_at: new Date().toISOString(),
        payload: {
          order_number: order.order_number,
          shopify_order_id: order.shopify_order_id,
        },
      })

      if (queueError) {
        console.error("❌ Error queuing fulfillment sync:", queueError)
        throw queueError
      }

      console.log(`📋 Queued fulfillment sync for order ${order.order_number}`)
    } catch (error) {
      console.error("❌ Error in queueOrderForFulfillment:", error)
      logError(error, { orderId, context: "queueOrderForFulfillment" })
    }
  },

  async checkOrderStatus(
    shopDomain: string,
    accessToken: string,
    shopifyOrderId: string,
  ): Promise<{
    success: boolean
    fulfillment_status?: string
    fulfillment_id?: string
    error?: string
  }> {
    try {
      const orderUrl = `https://${shopDomain}/admin/api/2023-10/orders/${shopifyOrderId}.json`
      const response = await fetch(orderUrl, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
          "User-Agent": "DeliveryOS/1.0",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `Failed to check order status (${response.status}): ${errorText}`,
        }
      }

      const data = await response.json()
      const order = data.order

      if (!order) {
        return { success: false, error: "Order not found in response" }
      }

      // Check fulfillment status
      const fulfillmentStatus = order.fulfillment_status || "unfulfilled"
      let fulfillmentId = null

      // Get fulfillment ID if exists
      if (order.fulfillments && order.fulfillments.length > 0) {
        fulfillmentId = order.fulfillments[0].id.toString()
      }

      console.log(`📊 Order ${shopifyOrderId} status: ${fulfillmentStatus}`)

      return {
        success: true,
        fulfillment_status: fulfillmentStatus,
        fulfillment_id: fulfillmentId,
      }
    } catch (error) {
      console.error("❌ Error checking order status:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },

  async processQueuedFulfillments(): Promise<void> {
    try {
      // Get pending fulfillment tasks
      const { data: pendingTasks, error } = await supabaseServiceRole
        .from("shopify_sync_queue")
        .select(`
          *,
          orders!inner (
            id,
            order_number,
            status,
            shopify_order_id,
            driver_id,
            completed_at
          ),
          shopify_connections!inner (
            id,
            shop_domain,
            access_token,
            is_active
          )
        `)
        .eq("status", "pending")
        .eq("sync_type", "fulfillment")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(10)

      if (error) {
        console.error("❌ Error fetching pending fulfillment tasks:", error)
        return
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        return
      }

      console.log(`📋 Processing ${pendingTasks.length} pending fulfillment tasks...`)

      for (const task of pendingTasks) {
        await this.processSingleFulfillment(task)
      }
    } catch (error) {
      console.error("❌ Error processing queued fulfillments:", error)
      logError(error, { context: "processQueuedFulfillments" })
    }
  },

  async processSingleFulfillment(task: any): Promise<void> {
    const { id: taskId, orders: order, shopify_connections: connection } = task

    try {
      // Mark as processing
      await supabaseServiceRole
        .from("shopify_sync_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", taskId)

      // Only process delivered orders
      if (order.status !== "delivered") {
        await supabaseServiceRole
          .from("shopify_sync_queue")
          .update({
            status: "failed",
            error_message: `Order status is ${order.status}, not delivered`,
            processed_at: new Date().toISOString(),
          })
          .eq("id", taskId)
        return
      }

      // Check connection is active
      if (!connection.is_active) {
        await supabaseServiceRole
          .from("shopify_sync_queue")
          .update({
            status: "failed",
            error_message: "Shopify connection is inactive",
            processed_at: new Date().toISOString(),
          })
          .eq("id", taskId)
        return
      }

      // Fulfill the order
      const result = await this.fulfillShopifyOrder(
        connection.shop_domain,
        connection.access_token,
        order.shopify_order_id,
        order.order_number,
        order.driver_id,
      )

      if (result.success) {
        // Update order with fulfillment info
        await supabaseServiceRole
          .from("orders")
          .update({
            shopify_fulfillment_id: result.fulfillment_id,
            shopify_fulfilled_at: new Date().toISOString(),
            sync_status: "synced",
          })
          .eq("id", order.id)

        // Mark task as completed
        await supabaseServiceRole
          .from("shopify_sync_queue")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
            payload: { ...task.payload, result },
          })
          .eq("id", taskId)

        console.log(`✅ Successfully processed fulfillment for order ${order.order_number}`)
      } else {
        // Handle failure with retry logic
        const newAttempts = (task.attempts || 0) + 1
        const maxAttempts = 3

        if (newAttempts >= maxAttempts) {
          await supabaseServiceRole
            .from("shopify_sync_queue")
            .update({
              status: "failed",
              error_message: result.error || "Unknown error",
              attempts: newAttempts,
              processed_at: new Date().toISOString(),
            })
            .eq("id", taskId)

          await supabaseServiceRole.from("orders").update({ sync_status: "failed" }).eq("id", order.id)
        } else {
          // Schedule retry with exponential backoff
          const retryDelay = Math.pow(2, newAttempts) * 60 * 1000 // 2^n minutes
          const scheduledAt = new Date(Date.now() + retryDelay)

          await supabaseServiceRole
            .from("shopify_sync_queue")
            .update({
              status: "pending",
              error_message: result.error || "Unknown error",
              attempts: newAttempts,
              scheduled_at: scheduledAt.toISOString(),
            })
            .eq("id", taskId)
        }

        console.error(`❌ Failed to process fulfillment for order ${order.order_number}: ${result.error}`)
      }
    } catch (error) {
      console.error(`❌ Critical error processing fulfillment task ${taskId}:`, error)

      await supabaseServiceRole
        .from("shopify_sync_queue")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Critical error",
          processed_at: new Date().toISOString(),
        })
        .eq("id", taskId)
    }
  },

  async getQueueStatus() {
    const { data, error } = await supabaseServiceRole
      .from("shopify_sync_queue")
      .select("status, sync_type")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    if (error) {
      console.error("❌ Error getting queue status:", error)
      return null
    }

    const stats = data.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        acc.total++
        return acc
      },
      { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 },
    )

    return stats
  },
}
