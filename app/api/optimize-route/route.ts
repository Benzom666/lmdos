import { type NextRequest, NextResponse } from "next/server"
import { routeOptimizer } from "@/lib/route-optimizer"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { waypoints, options = {} } = body

    console.log("🚀 Route optimization API called with:", { waypoints: waypoints?.length, options })

    if (!waypoints || !Array.isArray(waypoints)) {
      return NextResponse.json({ error: "Waypoints array is required" }, { status: 400 })
    }

    if (waypoints.length < 2) {
      return NextResponse.json({ error: "At least 2 waypoints are required" }, { status: 400 })
    }

    if (waypoints.length > 12) {
      return NextResponse.json({ error: "Maximum 12 waypoints allowed for Mapbox Optimization API" }, { status: 400 })
    }

    // Validate waypoints format
    const invalidWaypoints = waypoints.filter((wp: any) => {
      return (
        !wp.coordinates ||
        !Array.isArray(wp.coordinates) ||
        wp.coordinates.length !== 2 ||
        isNaN(wp.coordinates[0]) ||
        isNaN(wp.coordinates[1])
      )
    })

    if (invalidWaypoints.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid waypoint format",
          details: `${invalidWaypoints.length} waypoints have invalid coordinates`,
        },
        { status: 400 },
      )
    }

    const result = await routeOptimizer.optimizeRoute(waypoints, options)

    return NextResponse.json({
      success: true,
      data: result,
      summary: {
        distance: routeOptimizer.formatDistance(result.distance),
        duration: routeOptimizer.formatDuration(result.duration),
        waypoints: result.waypoints.length,
      },
    })
  } catch (error) {
    console.error("❌ Route optimization API error:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const statusCode = errorMessage.includes("Mapbox API error") ? 502 : 500

    return NextResponse.json(
      {
        success: false,
        error: "Failed to optimize route",
        message: errorMessage,
      },
      { status: statusCode },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Route Optimization API",
    endpoints: {
      POST: "/api/optimize-route",
    },
    parameters: {
      waypoints: "Array of waypoint objects with coordinates [lat, lng]",
      options: "Optional optimization settings",
    },
    limits: {
      minWaypoints: 2,
      maxWaypoints: 12,
    },
  })
}
