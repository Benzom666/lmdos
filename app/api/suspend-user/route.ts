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
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Suspend the user
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "87600h", // 10 years
    })

    if (error) {
      return NextResponse.json({ error: "Error suspending user: " + error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: "User suspended successfully",
    })
  } catch (error) {
    console.error("Unexpected error suspending user:", error)
    return NextResponse.json({ error: "Unexpected error suspending user" }, { status: 500 })
  }
}
