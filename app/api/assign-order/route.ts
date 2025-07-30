import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notifications"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Create a Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get request body
    const { orderId, driverId, adminId } = await req.json()

    if (!orderId || !driverId) {
      return NextResponse.json({ error: "Order ID and driver ID are required" }, { status: 400 })
    }

    // If driverId is a profile ID, get the user_id
    let actualDriverId = driverId
    if (driverId.length > 20) {
      // Profile IDs are longer UUIDs
      const { data: driverProfile, error: driverError } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("id", driverId)
        .single()

      if (driverError || !driverProfile) {
        return NextResponse.json({ error: "Driver not found" }, { status: 404 })
      }

      actualDriverId = driverProfile.user_id
    }

    // Update order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .update({
        driver_id: actualDriverId, // Use the correct user_id
        status: "assigned",
        assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("*")
      .single()

    if (orderError) {
      return NextResponse.json({ error: "Error assigning order: " + orderError.message }, { status: 500 })
    }

    // Create order update record
    const { error: updateError } = await supabase.from("order_updates").insert({
      order_id: orderId,
      driver_id: driverId,
      status: "assigned",
      notes: "Order assigned to driver",
    })

    if (updateError) {
      console.error("Error creating order update:", updateError)
    }

    // Create notification for driver using the correct user_id
    await createNotification(
      actualDriverId, // Use actualDriverId instead of driverId
      "New Delivery Assigned",
      `You have been assigned a new delivery: Order #${order.order_number}`,
      "info",
    )

    // Log analytics event
    await supabase.from("analytics_events").insert({
      event_type: "order_assigned",
      event_data: { order_id: orderId, driver_id: driverId, admin_id: adminId },
      user_id: adminId,
    })

    return NextResponse.json({
      message: "Order assigned successfully",
      order,
    })
  } catch (error) {
    console.error("Error assigning order:", error)
    return NextResponse.json(
      { error: "Unexpected error assigning order", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
