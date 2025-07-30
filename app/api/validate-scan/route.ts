import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { qrData, driverId } = await request.json()

    if (!qrData || !driverId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Parse QR code data
    let parsedData
    try {
      parsedData = JSON.parse(qrData)
    } catch (error) {
      return NextResponse.json(
        {
          isValid: false,
          errors: ["Invalid QR code format"],
          warnings: [],
        },
        { status: 400 },
      )
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Basic validation
    if (!parsedData.orderId) errors.push("Missing order ID")
    if (!parsedData.orderNumber) errors.push("Missing order number")
    if (!parsedData.customerName) errors.push("Missing customer name")
    if (!parsedData.deliveryAddress) errors.push("Missing delivery address")

    // Check if order exists in database
    const { data: orderData, error: dbError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", parsedData.orderId)
      .single()

    if (dbError || !orderData) {
      errors.push("Order not found in database")
    } else {
      // Validate order assignment
      if (orderData.driver_id && orderData.driver_id !== driverId) {
        warnings.push("Order is assigned to a different driver")
      }

      // Check order status
      if (orderData.status === "delivered") {
        warnings.push("Order is already marked as delivered")
      } else if (orderData.status === "cancelled") {
        errors.push("Order has been cancelled")
      }

      // Validate data consistency
      if (orderData.order_number !== parsedData.orderNumber) {
        errors.push("Order number mismatch")
      }
      if (orderData.customer_name !== parsedData.customerName) {
        warnings.push("Customer name mismatch")
      }
    }

    // Log scan attempt
    await supabase.from("scan_logs").insert({
      driver_id: driverId,
      order_id: parsedData.orderId,
      scan_data: qrData,
      is_valid: errors.length === 0,
      errors: JSON.stringify(errors),
      warnings: JSON.stringify(warnings),
      scanned_at: new Date().toISOString(),
    })

    return NextResponse.json({
      isValid: errors.length === 0,
      errors,
      warnings,
      orderData: errors.length === 0 ? orderData : null,
    })
  } catch (error) {
    console.error("Scan validation error:", error)
    return NextResponse.json(
      {
        isValid: false,
        errors: ["Validation service error"],
        warnings: [],
      },
      { status: 500 },
    )
  }
}
