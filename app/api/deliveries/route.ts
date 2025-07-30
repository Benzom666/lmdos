import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const driverId = searchParams.get("driverId")

    if (!driverId) {
      return NextResponse.json({ error: "Driver ID is required" }, { status: 400 })
    }

    // Fetch completed and failed deliveries
    const { data: deliveries, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        customer_name,
        customer_phone,
        delivery_address,
        status,
        priority,
        created_at,
        updated_at,
        delivery_failures (
          failure_reason,
          photos,
          created_at
        )
      `)
      .eq("driver_id", driverId)
      .in("status", ["delivered", "failed"])
      .order("updated_at", { ascending: false })

    if (error) throw error

    // Transform data to include failure info and photo counts
    const transformedDeliveries =
      deliveries?.map((delivery) => ({
        ...delivery,
        completed_at: delivery.status === "delivered" ? delivery.updated_at : null,
        failed_at: delivery.status === "failed" ? delivery.updated_at : null,
        failure_reason: delivery.delivery_failures?.[0]?.failure_reason || null,
        pod_photos: delivery.status === "delivered" ? Math.floor(Math.random() * 4) : 0, // Mock data
        failure_photos:
          delivery.status === "failed"
            ? delivery.delivery_failures?.[0]?.photos
              ? JSON.parse(delivery.delivery_failures[0].photos).length
              : 0
            : 0,
      })) || []

    return NextResponse.json({ deliveries: transformedDeliveries })
  } catch (error) {
    console.error("Error fetching deliveries:", error)
    return NextResponse.json({ error: "Failed to fetch deliveries" }, { status: 500 })
  }
}
