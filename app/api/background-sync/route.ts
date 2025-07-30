import { type NextRequest, NextResponse } from "next/server"
import { shopifyFulfillmentSync } from "@/lib/shopify-fulfillment-sync"
import { logError } from "@/lib/error-handler"

// This endpoint is called by a cron job or background service
export async function POST(request: NextRequest) {
  console.log("🔄 Background sync process started...")

  try {
    // Verify this is an internal request (you might want to add authentication)
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Process all pending fulfillments
    await shopifyFulfillmentSync.processQueuedFulfillments()

    const status = await shopifyFulfillmentSync.getQueueStatus()

    console.log("✅ Background sync process completed")

    return NextResponse.json({
      success: true,
      message: "Background sync completed",
      status,
    })
  } catch (error) {
    console.error("❌ Error in background sync:", error)
    logError(error, { endpoint: "background_sync" })

    return NextResponse.json(
      {
        error: "Background sync failed",
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
    console.error("❌ Error getting background sync status:", error)
    return NextResponse.json(
      {
        error: "Failed to get sync status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
