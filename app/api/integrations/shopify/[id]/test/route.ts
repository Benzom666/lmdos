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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  console.log("=== TEST SHOPIFY CONNECTION ===")
  console.log("Connection ID:", params.id)

  try {
    const { id } = params

    // Get connection details
    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from("shopify_connections")
      .select("*")
      .eq("id", id)
      .single()

    if (connectionError || !connection) {
      console.log("❌ Connection not found:", connectionError)
      return NextResponse.json({ error: "Connection not found" }, { status: 404 })
    }

    console.log("✅ Testing connection to:", connection.shop_domain)

    // Test the Shopify API connection
    try {
      const testResult = await testShopifyConnection(connection.shop_domain, connection.access_token)

      console.log("✅ Connection test successful")
      return NextResponse.json({
        success: true,
        message: "Successfully connected to Shopify store",
        shop_info: testResult,
      })
    } catch (error) {
      console.error("❌ Connection test failed:", error)

      let errorMessage = "Failed to connect to Shopify store"
      let errorDetails = "Unknown error"

      if (error instanceof Error) {
        errorDetails = error.message

        if (error.message.includes("Failed to fetch")) {
          errorMessage = "Network error"
          errorDetails = "Unable to connect to Shopify API. Please check your internet connection."
        } else if (error.message.includes("401")) {
          errorMessage = "Authentication failed"
          errorDetails = "Invalid access token. Please check your Shopify app credentials."
        } else if (error.message.includes("403")) {
          errorMessage = "Access forbidden"
          errorDetails = "Your Shopify app doesn't have the required permissions."
        } else if (error.message.includes("404")) {
          errorMessage = "Store not found"
          errorDetails = "The specified Shopify store domain could not be found."
        }
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("💥 Critical error in test endpoint:", error)
    return NextResponse.json(
      {
        error: "Failed to test connection",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function testShopifyConnection(shopDomain: string, accessToken: string) {
  // Clean up shop domain
  const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")

  // Test with a simple shop info endpoint
  const url = `https://${cleanDomain}/admin/api/2023-10/shop.json`

  console.log("🧪 Testing Shopify connection:", url)

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
      "User-Agent": "DeliveryOS/1.0",
    },
    signal: AbortSignal.timeout(15000), // 15 second timeout for test
  })

  console.log("📡 Test response status:", response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error("❌ Test failed:", response.status, errorText)

    switch (response.status) {
      case 401:
        throw new Error(`Authentication failed (401): Invalid access token`)
      case 403:
        throw new Error(`Access forbidden (403): Insufficient permissions`)
      case 404:
        throw new Error(`Store not found (404): Check your shop domain`)
      case 429:
        throw new Error(`Rate limit exceeded (429): Too many requests`)
      default:
        throw new Error(`Shopify API error (${response.status}): ${errorText}`)
    }
  }

  const data = await response.json()
  console.log("✅ Test successful, shop info:", data.shop?.name)

  return {
    shop_name: data.shop?.name,
    shop_domain: data.shop?.domain,
    shop_email: data.shop?.email,
    currency: data.shop?.currency,
    timezone: data.shop?.timezone,
  }
}
