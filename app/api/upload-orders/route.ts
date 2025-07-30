import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Create a Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Parse the multipart form data
    const formData = await req.formData()
    const file = formData.get("file") as File
    const adminId = formData.get("adminId") as string

    if (!file || !adminId) {
      return NextResponse.json({ error: "File and admin ID are required" }, { status: 400 })
    }

    // Read the file content
    const fileContent = await file.text()

    // Parse CSV (simple implementation - in a real app, use a CSV parser library)
    const lines = fileContent.split("\n").filter((line) => line.trim())
    if (lines.length < 2) {
      return NextResponse.json({ error: "File must contain at least a header row and one data row" }, { status: 400 })
    }

    const headers = lines[0].split(",").map((header) => header.trim().replace(/"/g, ""))

    // Validate headers - only require the essential fields
    const requiredHeaders = ["order_number", "customer_name", "pickup_address", "delivery_address"]
    const optionalHeaders = ["customer_phone", "customer_email", "delivery_notes", "priority", "status"]
    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header))

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required headers: ${missingHeaders.join(", ")}. Required: ${requiredHeaders.join(", ")}`,
        },
        { status: 400 },
      )
    }

    // Parse rows
    const orders = []
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue // Skip empty lines

      // Handle CSV parsing with quoted fields
      const values =
        lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map((val) => val.replace(/^"(.*)"$/, "$1").trim()) || []

      if (values.length < requiredHeaders.length) {
        errors.push(`Row ${i + 1}: Missing required fields`)
        continue
      }

      const order: Record<string, any> = {}
      headers.forEach((header, index) => {
        const value = values[index]
        // Handle empty values properly
        if (value === undefined || value === "" || value === '""') {
          order[header] = null
        } else {
          order[header] = value
        }
      })

      // Validate required fields - ensure they're not null or empty
      const missingRequiredFields = requiredHeaders.filter((field) => !order[field] || order[field].trim() === "")

      if (missingRequiredFields.length > 0) {
        errors.push(`Row ${i + 1}: Missing required fields: ${missingRequiredFields.join(", ")}`)
        continue
      }

      // Check for duplicate order number
      const existingOrderCheck = await supabase
        .from("orders")
        .select("id")
        .eq("order_number", order.order_number)
        .maybeSingle()

      if (existingOrderCheck.data) {
        errors.push(`Row ${i + 1}: Order number "${order.order_number}" already exists`)
        continue
      }

      // Set default values and admin info
      order.created_by = adminId
      order.status = order.status || "pending"
      order.priority = order.priority || "normal"

      // Handle coordinate fields
      order.pickup_latitude = Number.parseFloat(order.pickup_latitude) || 0
      order.pickup_longitude = Number.parseFloat(order.pickup_longitude) || 0
      order.delivery_latitude = Number.parseFloat(order.delivery_latitude) || 0
      order.delivery_longitude = Number.parseFloat(order.delivery_longitude) || 0

      // Set timestamps
      order.created_at = new Date().toISOString()
      order.updated_at = new Date().toISOString()

      // Validate priority if provided
      if (order.priority && !["low", "normal", "high", "urgent"].includes(order.priority)) {
        errors.push(`Row ${i + 1}: Invalid priority "${order.priority}". Must be: low, normal, high, urgent`)
        continue
      }

      // Validate status if provided
      if (
        order.status &&
        !["pending", "assigned", "picked_up", "in_transit", "delivered", "cancelled"].includes(order.status)
      ) {
        errors.push(`Row ${i + 1}: Invalid status "${order.status}"`)
        continue
      }

      // Clean up the order object - remove any undefined values and extra fields
      const cleanOrder = {
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone || null,
        customer_email: order.customer_email || null,
        pickup_address: order.pickup_address,
        delivery_address: order.delivery_address,
        pickup_latitude: order.pickup_latitude,
        pickup_longitude: order.pickup_longitude,
        delivery_latitude: order.delivery_latitude,
        delivery_longitude: order.delivery_longitude,
        status: order.status,
        priority: order.priority,
        driver_id: null, // Will be assigned later
        created_by: order.created_by,
        assigned_at: null,
        estimated_delivery_time: null,
        delivery_notes: order.delivery_notes || null,
        created_at: order.created_at,
        updated_at: order.updated_at,
      }

      orders.push(cleanOrder)
    }

    if (orders.length === 0) {
      return NextResponse.json(
        {
          error: "No valid orders found in file",
          details: errors,
        },
        { status: 400 },
      )
    }

    // Insert orders into database in batches to avoid timeout
    const batchSize = 50
    let insertedCount = 0
    const insertErrors = []

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize)

      try {
        const { data, error } = await supabase.from("orders").insert(batch)

        if (error) {
          console.error("Batch insert error:", error)
          insertErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
        } else {
          insertedCount += batch.length
        }
      } catch (batchError) {
        console.error("Batch processing error:", batchError)
        insertErrors.push(
          `Batch ${Math.floor(i / batchSize) + 1}: ${batchError instanceof Error ? batchError.message : "Unknown error"}`,
        )
      }
    }

    if (insertErrors.length > 0 && insertedCount === 0) {
      return NextResponse.json(
        {
          error: "Failed to insert any orders",
          details: [...errors, ...insertErrors],
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      message: "Orders uploaded successfully",
      imported: insertedCount,
      total_processed: orders.length,
      validation_errors: errors.length > 0 ? errors : undefined,
      insert_errors: insertErrors.length > 0 ? insertErrors : undefined,
    })
  } catch (error) {
    console.error("Error uploading orders:", error)
    return NextResponse.json(
      {
        error: "Unexpected error uploading orders: " + (error instanceof Error ? error.message : "Unknown error"),
      },
      { status: 500 },
    )
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
