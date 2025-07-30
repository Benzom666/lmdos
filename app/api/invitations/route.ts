import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: "Service role key is required" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { type, email, inviterUserId, message } = await req.json()

    if (!type || !email || !inviterUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate inviter exists
    const { data: inviter, error: inviterError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", inviterUserId)
      .single()

    if (inviterError || !inviter) {
      return NextResponse.json({ error: "Inviter not found" }, { status: 404 })
    }

    // Find the target user by email
    const { data: targetUser, error: targetError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", email)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json({ error: "User with this email not found" }, { status: 404 })
    }

    // Validate invitation type and roles
    if (type === "admin_to_driver") {
      if (inviter.role !== "admin") {
        return NextResponse.json({ error: "Only admins can invite drivers" }, { status: 403 })
      }
      if (targetUser.role !== "driver") {
        return NextResponse.json({ error: "Target user is not a driver" }, { status: 400 })
      }
      if (targetUser.admin_id) {
        return NextResponse.json({ error: "Driver is already assigned to an admin" }, { status: 400 })
      }
    } else if (type === "driver_to_admin") {
      if (inviter.role !== "driver") {
        return NextResponse.json({ error: "Only drivers can request admin assignment" }, { status: 403 })
      }
      if (targetUser.role !== "admin") {
        return NextResponse.json({ error: "Target user is not an admin" }, { status: 400 })
      }
      if (inviter.admin_id) {
        return NextResponse.json({ error: "Driver is already assigned to an admin" }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Invalid invitation type" }, { status: 400 })
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("inviter_user_id", inviterUserId)
      .eq("target_user_id", targetUser.user_id)
      .eq("type", type)
      .eq("status", "pending")
      .maybeSingle()

    if (existingInvitation) {
      return NextResponse.json({ error: "Invitation already sent and pending" }, { status: 400 })
    }

    // Create invitation
    const { data: invitation, error: createError } = await supabase
      .from("invitations")
      .insert({
        type,
        inviter_user_id: inviterUserId,
        target_user_id: targetUser.user_id,
        inviter_email: inviter.email,
        target_email: targetUser.email,
        message: message || null,
        status: "pending",
      })
      .select("*")
      .single()

    if (createError) {
      return NextResponse.json({ error: "Failed to create invitation: " + createError.message }, { status: 500 })
    }

    // Create notification for target user
    await supabase.from("notifications").insert({
      user_id: targetUser.user_id,
      title: type === "admin_to_driver" ? "Admin Invitation" : "Driver Request",
      message: `${inviter.first_name} ${inviter.last_name} has ${
        type === "admin_to_driver" ? "invited you to join their team" : "requested to join your team"
      }`,
      type: "info",
      read: false,
    })

    return NextResponse.json({
      message: "Invitation sent successfully",
      invitation,
    })
  } catch (error) {
    console.error("Unexpected error creating invitation:", error)
    return NextResponse.json({ error: "Unexpected error creating invitation" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const type = searchParams.get("type") // 'sent' or 'received'

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    let query = supabase.from("invitations").select("*")

    if (type === "sent") {
      query = query.eq("inviter_user_id", userId)
    } else if (type === "received") {
      query = query.eq("target_user_id", userId)
    } else {
      query = query.or(`inviter_user_id.eq.${userId},target_user_id.eq.${userId}`)
    }

    const { data: invitations, error } = await query.order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch invitations: " + error.message }, { status: 500 })
    }

    // Fetch user profiles separately to avoid join issues
    const invitationsWithProfiles = await Promise.all(
      (invitations || []).map(async (invitation) => {
        // Get inviter profile
        const { data: inviterProfile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, email, role")
          .eq("user_id", invitation.inviter_user_id)
          .single()

        // Get target profile
        const { data: targetProfile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name, email, role")
          .eq("user_id", invitation.target_user_id)
          .single()

        return {
          ...invitation,
          inviter: inviterProfile || {
            first_name: "Unknown",
            last_name: "User",
            email: invitation.inviter_email,
            role: "unknown",
          },
          target: targetProfile || {
            first_name: "Unknown",
            last_name: "User",
            email: invitation.target_email,
            role: "unknown",
          },
        }
      }),
    )

    return NextResponse.json({ invitations: invitationsWithProfiles })
  } catch (error) {
    console.error("Unexpected error fetching invitations:", error)
    return NextResponse.json({ error: "Unexpected error fetching invitations" }, { status: 500 })
  }
}
