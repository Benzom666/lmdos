import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: "Service role key is required" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { action, userId } = await req.json()
    const invitationId = params.id

    if (!action || !userId || !invitationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. Must be 'accept' or 'reject'" }, { status: 400 })
    }

    // Get the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    // Verify the user is the target of the invitation
    if (invitation.target_user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized to respond to this invitation" }, { status: 403 })
    }

    // Check if invitation is still pending
    if (invitation.status !== "pending") {
      return NextResponse.json({ error: "Invitation has already been responded to" }, { status: 400 })
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from("invitations")
      .update({
        status: action === "accept" ? "accepted" : "rejected",
        responded_at: new Date().toISOString(),
      })
      .eq("id", invitationId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to update invitation: " + updateError.message }, { status: 500 })
    }

    // If accepted, update the user relationships
    if (action === "accept") {
      if (invitation.type === "admin_to_driver") {
        // Update driver's admin_id
        const { error: profileUpdateError } = await supabase
          .from("user_profiles")
          .update({ admin_id: invitation.inviter_user_id })
          .eq("user_id", invitation.target_user_id)

        if (profileUpdateError) {
          console.error("Failed to update driver profile:", profileUpdateError)
          return NextResponse.json({ error: "Failed to assign driver to admin" }, { status: 500 })
        }
      } else if (invitation.type === "driver_to_admin") {
        // Update driver's admin_id
        const { error: profileUpdateError } = await supabase
          .from("user_profiles")
          .update({ admin_id: invitation.target_user_id })
          .eq("user_id", invitation.inviter_user_id)

        if (profileUpdateError) {
          console.error("Failed to update driver profile:", profileUpdateError)
          return NextResponse.json({ error: "Failed to assign driver to admin" }, { status: 500 })
        }
      }
    }

    // Create notification for inviter
    const { data: inviterProfile } = await supabase
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .single()

    const inviterName = inviterProfile ? `${inviterProfile.first_name} ${inviterProfile.last_name}` : "User"

    await supabase.from("notifications").insert({
      user_id: invitation.inviter_user_id,
      title: `Invitation ${action === "accept" ? "Accepted" : "Rejected"}`,
      message: `${inviterName} has ${action === "accept" ? "accepted" : "rejected"} your invitation`,
      type: action === "accept" ? "success" : "info",
      read: false,
    })

    return NextResponse.json({
      message: `Invitation ${action === "accept" ? "accepted" : "rejected"} successfully`,
      invitation: {
        ...invitation,
        status: action === "accept" ? "accepted" : "rejected",
        responded_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Unexpected error responding to invitation:", error)
    return NextResponse.json({ error: "Unexpected error responding to invitation" }, { status: 500 })
  }
}
