import { type NextRequest, NextResponse } from "next/server"
import { routeOptimizer } from "@/lib/route-optimizer"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { waypoints, options = {} } = body

    console.log("🚀 Route optimization API called with:", {
      waypoints: waypoints?.length,
      options,
      firstWaypoint: waypoints?.[0],
      lastWaypoint: waypoints?.[waypoints?.length - 1],
    })

    if (!waypoints || !Array.isArray(waypoints)) {
      return NextResponse.json({ error: "Waypoints array is required" }, { status: 400 })
    }

    if (waypoints.length < 2) {
      return NextResponse.json({ error: "At least 2 waypoints are required" }, { status: 400 })
    }

    if (waypoints.length > 12) {
      return NextResponse.json({ error: "Maximum 12 waypoints allowed for Mapbox Optimization API" }, { status: 400 })
    }

    // Enhanced waypoint validation
    const invalidWaypoints = waypoints.filter((wp: any, index: number) => {
      const isValid =
        wp.coordinates &&
        Array.isArray(wp.coordinates) &&
        wp.coordinates.length === 2 &&
        !isNaN(wp.coordinates[0]) &&
        !isNaN(wp.coordinates[1]) &&
        Math.abs(wp.coordinates[0]) <= 90 &&
        Math.abs(wp.coordinates[1]) <= 180

      if (!isValid) {
        console.warn(`Invalid waypoint at index ${index}:`, wp)
      }
      return !isValid
      return !isValid
    })

    if (invalidWaypoints.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid waypoint format",
          details: `${invalidWaypoints.length} waypoints have invalid coordinates`,
          invalidWaypoints: invalidWaypoints.map((wp, idx) => ({ index: idx, waypoint: wp })),
        },
        { status: 400 },
      )
    }

    // Validate coordinates are within reasonable bounds (focusing on Canada/GTA)
    const outOfBoundsWaypoints = waypoints.filter((wp: any, index: number) => {
      const [lat, lng] = wp.coordinates
      const inBounds = lat >= 43.0 && lat <= 45.0 && lng >= -80.5 && lng <= -78.5
      if (!inBounds) {
        console.warn(`Waypoint ${index} out of GTA bounds: [${lat}, ${lng}]`)
      }
      return !inBounds
    })

    if (outOfBoundsWaypoints.length > 0) {
      console.warn(`${outOfBoundsWaypoints.length} waypoints are outside GTA bounds, but proceeding with optimization`)
    }

    console.log("📍 Waypoints validation passed, calling route optimizer...")

    const result = await routeOptimizer.optimizeRoute(waypoints, options)

    console.log("✅ Route optimization completed successfully:", {
      distance: result.distance,
      duration: result.duration,
      waypointCount: result.waypoints.length,
    })

    return NextResponse.json({
      success: true,
      data: result,
      summary: {
        distance: routeOptimizer.formatDistance(result.distance),
        duration: routeOptimizer.formatDuration(result.duration),
        waypoints: result.waypoints.length,
        outOfBoundsCount: outOfBoundsWaypoints.length,
      },
    })
  } catch (error) {
    console.error("❌ Route optimization API error:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    let statusCode = 500

    // Determine appropriate status code based on error type
    if (errorMessage.includes("Mapbox API error")) {
      statusCode = 502
    } else if (errorMessage.includes("access token")) {
      statusCode = 401
    } else if (errorMessage.includes("waypoints")) {
      statusCode = 400
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to optimize route",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Mapbox Route Optimization API",
    version: "2.0",
    endpoints: {
      POST: "/api/optimize-route",
    },
    parameters: {
      waypoints: "Array of waypoint objects with coordinates [lat, lng]",
      options: "Optional optimization settings (profile, source, destination, etc.)",
    },
    limits: {
      minWaypoints: 2,
      maxWaypoints: 12,
      supportedProfiles: ["driving", "walking", "cycling"],
    },
    features: [
      "Precise coordinate validation",
      "GTA bounds checking",
      "Enhanced error handling",
      "Detailed optimization statistics",
    ],
  })
}
