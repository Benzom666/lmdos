// Production health check endpoint
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  try {
    const startTime = Date.now()

    // Check database connection
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { error: dbError } = await supabase.from("user_profiles").select("id").limit(1)

    if (dbError) {
      throw new Error(`Database check failed: ${dbError.message}`)
    }

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV,
      checks: {
        database: "healthy",
        api: "healthy",
      },
      performance: {
        responseTime: `${responseTime}ms`,
      },
    })
  } catch (error) {
    console.error("Health check failed:", error)

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    )
  }
}
