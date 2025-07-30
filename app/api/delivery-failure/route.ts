import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const orderId = formData.get("orderId") as string
    const reason = formData.get("reason") as string
    const notes = formData.get("notes") as string
    const attemptedDelivery = formData.get("attemptedDelivery") === "true"
    const contactedCustomer = formData.get("contactedCustomer") === "true"
    const leftAtLocation = formData.get("leftAtLocation") === "true"
    const rescheduleRequested = formData.get("rescheduleRequested") === "true"
    const rescheduleDate = formData.get("rescheduleDate") as string
    const location = formData.get("location") as string
    const driverId = formData.get("driverId") as string

    // Handle photo uploads (simplified - in production, upload to storage service)
    const photos: string[] = []
    for (let i = 0; i < 3; i++) {
      const photo = formData.get(`photo_${i}`) as File
      if (photo) {
        // In production, upload to cloud storage and get URL
        photos.push(`/uploads/failure-photos/${Date.now()}-${i}.jpg`)
      }
    }

    // Update order status to failed
    const { error: orderError } = await supabase
      .from("orders")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (orderError) throw orderError

    // Create failure report
    const { error: reportError } = await supabase.from("delivery_failures").insert({
      order_id: orderId,
      driver_id: driverId,
      failure_reason: reason,
      notes,
      attempted_delivery: attemptedDelivery,
      contacted_customer: contactedCustomer,
      left_at_location: leftAtLocation,
      reschedule_requested: rescheduleRequested,
      reschedule_date: rescheduleDate || null,
      location,
      photos: JSON.stringify(photos),
      created_at: new Date().toISOString(),
    })

    if (reportError) throw reportError

    // Create order update record
    await supabase.from("order_updates").insert({
      order_id: orderId,
      driver_id: driverId,
      status: "failed",
      notes: `Delivery failed: ${reason}. ${notes}`,
      latitude: null,
      longitude: null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing failure report:", error)
    return NextResponse.json({ error: "Failed to process failure report" }, { status: 500 })
  }
}
