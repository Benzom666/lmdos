import { type NextRequest, NextResponse } from "next/server"
import { routeOptimizer } from "@/lib/route-optimizer"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { waypoints } = body

    if (!waypoints || !Array.isArray(waypoints)) {
      return NextResponse.json({ error: "Waypoints array is required" }, { status: 400 })
    }

    if (waypoints.length < 2) {
      return NextResponse.json({ error: "At least 2 waypoints are required" }, { status: 400 })
    }

    if (waypoints.length > 25) {
      return NextResponse.json({ error: "Maximum 25 waypoints allowed" }, { status: 400 })
    }

    const result = await routeOptimizer.optimizeRoute(waypoints)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Route optimization API error:", error)
    return NextResponse.json(
      {
        error: "Failed to optimize route",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
