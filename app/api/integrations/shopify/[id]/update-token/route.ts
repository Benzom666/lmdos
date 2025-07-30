import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { access_token } = await request.json()
    const connectionId = params.id

    if (!access_token) {
      return NextResponse.json(
        {
          success: false,
          message: "Access token is required",
        },
        { status: 400 },
      )
    }

    if (!access_token.startsWith("shpat_")) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid access token format. Must start with "shpat_"',
        },
        { status: 400 },
      )
    }

    console.log(`🔑 Updating access token for connection: ${connectionId}`)

    // First, get the connection to get the shop domain
    const { data: connection, error: fetchError } = await supabase
      .from("shopify_connections")
      .select("shop_domain")
      .eq("id", connectionId)
      .single()

    if (fetchError || !connection) {
      console.error("❌ Connection not found:", fetchError)
      return NextResponse.json(
        {
          success: false,
          message: "Shopify connection not found",
        },
        { status: 404 },
      )
    }

    // Test the token before saving it
    console.log(`🧪 Testing access token for ${connection.shop_domain}`)

    try {
      const testResponse = await fetch(`https://${connection.shop_domain}/admin/api/2023-10/shop.json`, {
        headers: {
          "X-Shopify-Access-Token": access_token,
          "Content-Type": "application/json",
        },
      })

      if (!testResponse.ok) {
        const errorText = await testResponse.text()
        console.error("❌ Token test failed:", testResponse.status, errorText)

        return NextResponse.json(
          {
            success: false,
            message: "Access token test failed",
            test_error: `HTTP ${testResponse.status}: ${errorText}`,
          },
          { status: 400 },
        )
      }

      const shopData = await testResponse.json()
      console.log(`✅ Token test successful for shop: ${shopData.shop?.name}`)
    } catch (testError) {
      console.error("❌ Token test error:", testError)
      return NextResponse.json(
        {
          success: false,
          message: "Failed to test access token",
          test_error: testError instanceof Error ? testError.message : "Unknown test error",
        },
        { status: 400 },
      )
    }

    // Update the access token
    const { error: updateError } = await supabase
      .from("shopify_connections")
      .update({
        access_token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)

    if (updateError) {
      console.error("❌ Failed to update token:", updateError)
      return NextResponse.json(
        {
          success: false,
          message: "Failed to update access token",
          details: updateError.message,
        },
        { status: 500 },
      )
    }

    console.log(`✅ Access token updated successfully for ${connection.shop_domain}`)

    return NextResponse.json({
      success: true,
      message: "Access token updated and tested successfully",
      shop_domain: connection.shop_domain,
      updated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Update token error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
