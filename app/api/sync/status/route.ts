import { NextResponse } from "next/server"
import { getSyncProcessor } from "@/lib/shopify-sync-processor"

export async function GET() {
  try {
    const processor = getSyncProcessor()
    const status = await processor.getQueueStatus()

    return NextResponse.json({
      success: true,
      status,
      processor_active: true,
    })
  } catch (error) {
    console.error("❌ Error getting sync status:", error)
    return NextResponse.json(
      {
        error: "Failed to get sync status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
