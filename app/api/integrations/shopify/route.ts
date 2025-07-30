import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    // Get the session from the request headers
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Create authenticated Supabase client
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    )

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Verify user is an admin
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Fetch connections for this admin
    const { data: connections, error } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ connections: connections || [] })
  } catch (error) {
    console.error("Error fetching Shopify connections:", error)
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the session from the request headers
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Create authenticated Supabase client
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    )

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Verify user is an admin
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (profileError || !userProfile || userProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { shop_domain, access_token, webhook_secret } = body

    if (!shop_domain || !access_token) {
      return NextResponse.json({ error: "Shop domain and access token are required" }, { status: 400 })
    }

    // Validate Shopify connection
    const shopifyResponse = await fetch(`https://${shop_domain}/admin/api/2023-10/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": access_token,
      },
    })

    if (!shopifyResponse.ok) {
      return NextResponse.json({ error: "Invalid Shopify credentials" }, { status: 400 })
    }

    const shopData = await shopifyResponse.json()

    // Save connection to database with proper admin_id
    const { data: connection, error } = await supabase
      .from("shopify_connections")
      .insert({
        admin_id: user.id,
        shop_domain,
        access_token,
        webhook_secret,
        is_active: true,
        last_sync: new Date().toISOString(),
        orders_synced: 0,
        settings: {
          auto_create_orders: true,
          auto_assign_drivers: false,
          sync_order_status: true,
          notification_emails: [],
          fulfillment_service: false,
        },
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      throw error
    }

    return NextResponse.json({ connection })
  } catch (error) {
    console.error("Error creating Shopify connection:", error)
    return NextResponse.json({ error: "Failed to create connection" }, { status: 500 })
  }
}
