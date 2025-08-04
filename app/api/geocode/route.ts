import { type NextRequest, NextResponse } from "next/server"
import { geocodingService } from "@/lib/geocoding-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { addresses, address } = body

    if (address) {
      // Single address geocoding
      const result = await geocodingService.geocodeAddress(address)
      return NextResponse.json({
        success: true,
        data: result,
      })
    }

    if (addresses && Array.isArray(addresses)) {
      // Batch geocoding
      if (addresses.length > 50) {
        return NextResponse.json({ error: "Maximum 50 addresses allowed for batch geocoding" }, { status: 400 })
      }

      const results = await geocodingService.geocodeBatch(addresses)
      const successCount = results.filter((r) => r.coordinates).length

      return NextResponse.json({
        success: true,
        data: results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
          cached: results.filter((r) => r.fromCache).length,
        },
      })
    }

    return NextResponse.json({ error: "Either 'address' or 'addresses' parameter is required" }, { status: 400 })
  } catch (error) {
    console.error("Geocoding API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to geocode address(es)",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Geocoding API",
    endpoints: {
      POST: "/api/geocode",
    },
    parameters: {
      address: "Single address string for geocoding",
      addresses: "Array of address strings for batch geocoding (max 50)",
    },
    cacheStats: geocodingService.getCacheStats(),
  })
}
