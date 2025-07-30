import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: "Service role key is required" }, { status: 500 })
    }

    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get request body
    const { userId, password } = await req.json()

    if (!userId || !password) {
      return NextResponse.json({ error: "User ID and password are required" }, { status: 400 })
    }

    // Update the user's password
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
    })

    if (error) {
      return NextResponse.json({ error: "Error resetting password: " + error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: "Password reset successfully",
    })
  } catch (error) {
    console.error("Unexpected error resetting password:", error)
    return NextResponse.json({ error: "Unexpected error resetting password" }, { status: 500 })
  }
}
