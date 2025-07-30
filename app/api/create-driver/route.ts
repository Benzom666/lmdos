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
    const { email, password, firstName, lastName, phone, adminId } = await req.json()

    if (!email || !password || !firstName) {
      return NextResponse.json({ error: "Email, password, and first name are required" }, { status: 400 })
    }

    // Create the user
    const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "driver",
        first_name: firstName,
        last_name: lastName,
      },
    })

    if (createUserError) {
      return NextResponse.json({ error: "Error creating driver user: " + createUserError.message }, { status: 500 })
    }

    // Create driver profile
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .insert({
        user_id: authUser.user.id,
        email,
        first_name: firstName,
        last_name: lastName || "",
        phone: phone || null,
        role: "driver",
        admin_id: adminId,
      })
      .select("*")
      .single()

    if (profileError) {
      return NextResponse.json({ error: "Error creating driver profile: " + profileError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: "Driver created successfully",
      user: authUser.user,
      profile,
    })
  } catch (error) {
    console.error("Unexpected error creating driver:", error)
    return NextResponse.json({ error: "Unexpected error creating driver" }, { status: 500 })
  }
}
