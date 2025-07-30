import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import crypto from "crypto"

export async function GET(request: NextRequest) {
  try {
    const supabaseServer = createServerSupabaseClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabaseServer
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch API keys for this admin
    const { data: apiKeys, error } = await supabaseServer
      .from("api_keys")
      .select("*")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ apiKeys: apiKeys || [] })
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServer = createServerSupabaseClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabaseServer
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { name, permissions } = await request.json()

    if (!name || !permissions) {
      return NextResponse.json({ error: "Name and permissions are required" }, { status: 400 })
    }

    // Generate a secure API key
    const apiKey = `dk_${crypto.randomBytes(32).toString("hex")}`
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex")

    // Insert the API key
    const { data: newApiKey, error } = await supabaseServer
      .from("api_keys")
      .insert({
        admin_id: user.id,
        name,
        key_hash: keyHash,
        permissions,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Return the API key with the actual key (only shown once)
    return NextResponse.json({
      apiKey: {
        ...newApiKey,
        key: apiKey, // Only returned on creation
      },
    })
  } catch (error) {
    console.error("Error creating API key:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
