import { type NextRequest, NextResponse } from "next/server"
import { geocodingService } from "@/lib/geocoding-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { addresses, address } = body

    console.log("🔍 Geocoding API called with:", {
      singleAddress: !!address,
      batchCount: addresses?.length,
    })

    if (address) {
      // Single address geocoding
      console.log(`📍 Geocoding single address: ${address}`)
      const result = await geocodingService.geocodeAddress(address)

      return NextResponse.json({
        success: true,
        data: result,
        debug: geocodingService.getGeocodingInfo(address),
      })
    }

    if (addresses && Array.isArray(addresses)) {
      // Batch geocoding
      if (addresses.length > 25) {
        return NextResponse.json(
          {
            error: "Maximum 25 addresses allowed for batch geocoding to ensure accuracy",
          },
          { status: 400 },
        )
      }

      console.log(`📍 Starting batch geocoding for ${addresses.length} addresses`)
      const startTime = Date.now()

      const results = await geocodingService.geocodeBatch(addresses)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      const successCount = results.filter((r) => r.coordinates).length
      const highAccuracyCount = results.filter((r) => r.accuracy === "high").length
      const cachedCount = results.filter((r) => r.fromCache).length

      console.log(`✅ Batch geocoding completed in ${processingTime}ms: ${successCount}/${addresses.length} successful`)

      return NextResponse.json({
        success: true,
        data: results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: results.length - successCount,
          cached: cachedCount,
          highAccuracy: highAccuracyCount,
          processingTimeMs: processingTime,
          averageTimePerAddress: Math.round(processingTime / addresses.length),
        },
        cacheStats: geocodingService.getCacheStats(),
      })
    }

    return NextResponse.json(
      {
        error: "Either 'address' or 'addresses' parameter is required",
      },
      { status: 400 },
    )
  } catch (error) {
    console.error("❌ Geocoding API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to geocode address(es)",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  const cacheStats = geocodingService.getCacheStats()

  return NextResponse.json({
    message: "Enhanced Geocoding API",
    version: "2.0",
    endpoints: {
      POST: "/api/geocode",
    },
    parameters: {
      address: "Single address string for precise geocoding",
      addresses: "Array of address strings for batch geocoding (max 25)",
    },
    features: [
      "Mapbox Geocoding API integration",
      "Nominatim fallback for reliability",
      "Intelligent caching (30-day persistence)",
      "Canadian address optimization",
      "GTA coordinate validation",
      "High-accuracy scoring",
    ],
    cacheStats,
    limits: {
      maxBatchSize: 25,
      rateLimitMs: 1500,
      maxRetries: 3,
    },
  })
}

export async function DELETE() {
  try {
    geocodingService.clearCache()
    return NextResponse.json({
      success: true,
      message: "Geocoding cache cleared successfully",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear cache",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
