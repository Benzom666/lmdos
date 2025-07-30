import { type NextRequest, NextResponse } from "next/server"
import { shopifyFulfillmentSync } from "@/lib/shopify-fulfillment-sync"
import { logError } from "@/lib/error-handler"

export async function POST(request: NextRequest) {
  console.log("🔄 Manual fulfillment sync triggered...")

  try {
    const { orderId, force = false } = await request.json()

    if (orderId) {
      // Sync specific order
      await shopifyFulfillmentSync.queueOrderForFulfillment(orderId)
      return NextResponse.json({
        success: true,
        message: `Order ${orderId} queued for fulfillment sync`,
      })
    } else {
      // Process all pending fulfillments
      await shopifyFulfillmentSync.processQueuedFulfillments()
      return NextResponse.json({
        success: true,
        message: "Processed all pending fulfillment syncs",
      })
    }
  } catch (error) {
    console.error("❌ Error in manual fulfillment sync:", error)
    logError(error, { endpoint: "fulfillment_sync" })

    return NextResponse.json(
      {
        error: "Failed to process fulfillment sync",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const status = await shopifyFulfillmentSync.getQueueStatus()
    return NextResponse.json({ status })
  } catch (error) {
    console.error("❌ Error getting fulfillment sync status:", error)
    return NextResponse.json(
      {
        error: "Failed to get sync status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
