import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

export async function GET(request: NextRequest) {
  try {
    console.log("=== SHOPIFY DEBUG ENDPOINT ===")

    // Check environment variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: process.env.NODE_ENV,
    }

    // Test database connection
    const { data: testQuery, error: testError } = await supabaseServiceRole
      .from("shopify_connections")
      .select("id, shop_domain, is_active")
      .limit(5)

    // Test RPC functions
    const { data: rpcTest, error: rpcError } = await supabaseServiceRole.rpc("check_shopify_order_exists", {
      p_shopify_order_id: "test123",
      p_connection_id: "test-connection-id",
    })

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: {
        connection_test: testError ? "FAILED" : "SUCCESS",
        connections_found: testQuery?.length || 0,
        test_error: testError?.message,
      },
      rpc_functions: {
        check_shopify_order_exists: rpcError ? "FAILED" : "SUCCESS",
        rpc_error: rpcError?.message,
      },
      shopify_connections: testQuery || [],
    })
  } catch (error) {
    console.error("Debug endpoint error:", error)
    return NextResponse.json(
      {
        error: "Debug failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
