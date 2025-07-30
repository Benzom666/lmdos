import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { shopifyFulfillmentSync } from "@/lib/shopify-fulfillment-sync"
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
  console.log("🔧 Manual sync triggered...")

  try {
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      // Sync all pending orders
      const { data: pendingOrders, error } = await supabaseServiceRole
        .from("orders")
        .select("id, order_number")
        .eq("status", "delivered")
        .eq("sync_status", "pending")
        .not("shopify_order_id", "is", null)
        .limit(50)

      if (error) {
        throw new Error(`Failed to fetch pending orders: ${error.message}`)
      }

      if (!pendingOrders || pendingOrders.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No pending orders to sync",
          processed: 0,
        })
      }

      console.log(`🔄 Found ${pendingOrders.length} pending orders to sync`)

      const results = []
      for (const order of pendingOrders) {
        try {
          await shopifyFulfillmentSync.queueOrderForFulfillment(order.id)
          results.push({ orderId: order.id, orderNumber: order.order_number, success: true })
        } catch (error) {
          console.error(`❌ Failed to queue order ${order.order_number}:`, error)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }

      // Process the queue immediately
      await shopifyFulfillmentSync.processQueuedFulfillments()

      return NextResponse.json({
        success: true,
        message: `Queued ${results.filter((r) => r.success).length} orders for sync`,
        processed: results.length,
        results,
      })
    } else {
      // Sync specific orders
      const results = []
      for (const orderId of orderIds) {
        try {
          await shopifyFulfillmentSync.queueOrderForFulfillment(orderId)
          results.push({ orderId, success: true })
        } catch (error) {
          console.error(`❌ Failed to queue order ${orderId}:`, error)
          results.push({
            orderId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }

      // Process the queue immediately
      await shopifyFulfillmentSync.processQueuedFulfillments()

      return NextResponse.json({
        success: true,
        message: `Processed ${results.filter((r) => r.success).length} orders`,
        results,
      })
    }
  } catch (error) {
    console.error("❌ Manual sync error:", error)
    logError(error, { endpoint: "manual_sync" })

    return NextResponse.json(
      {
        error: "Manual sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
