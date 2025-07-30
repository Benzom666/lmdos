import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Use service role client that bypasses RLS
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
  console.log("=== SHOPIFY ORDERS ENDPOINT CALLED ===")

  try {
    // Get the session from the request headers for authentication
    const authHeader = request.headers.get("authorization")
    console.log("Auth header present:", !!authHeader)

    if (!authHeader) {
      console.log("❌ No authorization header")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Create authenticated Supabase client for user verification
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
    console.log("Getting user from auth...")
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError) {
      console.log("❌ Auth error:", authError)
      return NextResponse.json({ error: "Authentication failed", details: authError.message }, { status: 401 })
    }

    if (!user) {
      console.log("❌ No user found")
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    console.log("✅ User authenticated:", user.id)

    // Verify user is an admin using service role client
    console.log("Checking user role...")
    const { data: userProfile, error: profileError } = await supabaseServiceRole
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (profileError) {
      console.log("❌ Profile error:", profileError)
      return NextResponse.json({ error: "Failed to verify user role", details: profileError.message }, { status: 500 })
    }

    if (!userProfile || userProfile.role !== "admin") {
      console.log("❌ User is not admin. Role:", userProfile?.role)
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    console.log("✅ User is admin")

    // Fetch Shopify orders for this admin
    console.log("Fetching Shopify orders...")
    const { data: shopifyOrders, error: shopifyOrdersError } = await supabaseServiceRole
      .from("shopify_orders")
      .select(`
        *,
        shopify_connections!shopify_connection_id (
          shop_domain,
          is_active
        )
      `)
      .eq("shopify_connections.admin_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (shopifyOrdersError) {
      console.error("❌ Error fetching Shopify orders:", shopifyOrdersError)
      return NextResponse.json(
        { error: "Failed to fetch Shopify orders", details: shopifyOrdersError.message },
        { status: 500 },
      )
    }

    console.log(`📦 Found ${shopifyOrders?.length || 0} Shopify orders`)

    if (!shopifyOrders || shopifyOrders.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        message: "No Shopify orders found",
      })
    }

    // Get corresponding delivery orders
    console.log("Fetching corresponding delivery orders...")
    const shopifyOrderIds = shopifyOrders.map((order) => order.shopify_order_id)

    const { data: deliveryOrders, error: deliveryOrdersError } = await supabaseServiceRole
      .from("orders")
      .select("id, order_number, status, completed_at, external_order_id, shopify_fulfillment_id, shopify_fulfilled_at")
      .eq("source", "shopify")
      .in("external_order_id", shopifyOrderIds)

    if (deliveryOrdersError) {
      console.error("⚠️ Error fetching delivery orders:", deliveryOrdersError)
      // Continue without delivery order data
    }

    console.log(`🚚 Found ${deliveryOrders?.length || 0} corresponding delivery orders`)

    // Create a map for efficient lookup
    const deliveryOrderMap = new Map()
    if (deliveryOrders) {
      deliveryOrders.forEach((order) => {
        deliveryOrderMap.set(order.external_order_id, order)
      })
    }

    // Enhance Shopify orders with delivery information
    const enhancedOrders = shopifyOrders.map((shopifyOrder) => {
      const deliveryOrder = deliveryOrderMap.get(shopifyOrder.shopify_order_id)

      // Determine actual fulfillment status based on delivery status
      let actualFulfillmentStatus = shopifyOrder.fulfillment_status
      let syncStatus = "synced"

      if (deliveryOrder) {
        if (deliveryOrder.status === "delivered" && shopifyOrder.fulfillment_status !== "fulfilled") {
          actualFulfillmentStatus = "pending_fulfillment" // Needs to be updated in Shopify
          syncStatus = "pending"
        } else if (deliveryOrder.status === "delivered" && shopifyOrder.fulfillment_status === "fulfilled") {
          actualFulfillmentStatus = "fulfilled"
          syncStatus = "synced"
        }
      }

      return {
        ...shopifyOrder,
        actual_fulfillment_status: actualFulfillmentStatus,
        delivery_status: deliveryOrder?.status || null,
        delivery_completed_at: deliveryOrder?.completed_at || null,
        has_delivery_order: !!deliveryOrder,
        sync_status: syncStatus,
        orders: deliveryOrder ? [deliveryOrder] : [],
      }
    })

    console.log(`✅ Enhanced ${enhancedOrders.length} orders with delivery information`)

    return NextResponse.json({
      success: true,
      orders: enhancedOrders,
      total: enhancedOrders.length,
    })
  } catch (error) {
    console.error("💥 Critical error in Shopify orders endpoint:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch Shopify orders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
