import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

interface ParsedOrder {
  order_number: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  pickup_address: string
  delivery_address: string
  priority: string
  delivery_notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const adminId = formData.get("adminId") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    console.log("📁 Processing file:", file.name, "Size:", file.size, "Type:", file.type)

    // Read file content
    const fileContent = await file.text()
    console.log("📄 File content preview:", fileContent.substring(0, 200))

    // Parse CSV with better error handling
    const lines = fileContent.split(/\r?\n/).filter((line) => line.trim())
    console.log("📊 Total lines found:", lines.length)

    if (lines.length < 2) {
      return NextResponse.json(
        {
          error: "File must contain at least a header row and one data row",
          debug: { linesFound: lines.length, preview: lines },
        },
        { status: 400 },
      )
    }

    // Parse header
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine)
    console.log("📋 Headers found:", headers)

    // Validate required headers
    const requiredHeaders = ["order_number", "customer_name", "pickup_address", "delivery_address"]
    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.some((h) => h.toLowerCase().includes(header.toLowerCase())),
    )

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required headers: ${missingHeaders.join(", ")}`,
          debug: {
            foundHeaders: headers,
            requiredHeaders,
            missingHeaders,
          },
        },
        { status: 400 },
      )
    }

    // Create header mapping
    const headerMap = createHeaderMapping(headers)
    console.log("🗺️ Header mapping:", headerMap)

    // Parse data rows
    const validOrders: ParsedOrder[] = []
    const validationErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = parseCSVLine(line)
        console.log(`📝 Row ${i} values:`, values)

        if (values.length < headers.length) {
          validationErrors.push(`Row ${i}: Expected ${headers.length} columns, got ${values.length}`)
          continue
        }

        const order: ParsedOrder = {
          order_number: getValueByHeader(values, headerMap, "order_number") || `ORD-${Date.now()}-${i}`,
          customer_name: getValueByHeader(values, headerMap, "customer_name") || "",
          customer_phone: getValueByHeader(values, headerMap, "customer_phone") || undefined,
          customer_email: getValueByHeader(values, headerMap, "customer_email") || undefined,
          pickup_address: getValueByHeader(values, headerMap, "pickup_address") || "",
          delivery_address: getValueByHeader(values, headerMap, "delivery_address") || "",
          priority: getValueByHeader(values, headerMap, "priority") || "normal",
          delivery_notes: getValueByHeader(values, headerMap, "delivery_notes") || undefined,
        }

        // Validate required fields
        if (!order.customer_name) {
          validationErrors.push(`Row ${i}: Customer name is required`)
          continue
        }
        if (!order.pickup_address) {
          validationErrors.push(`Row ${i}: Pickup address is required`)
          continue
        }
        if (!order.delivery_address) {
          validationErrors.push(`Row ${i}: Delivery address is required`)
          continue
        }

        // Validate priority
        const validPriorities = ["low", "normal", "high", "urgent"]
        if (!validPriorities.includes(order.priority.toLowerCase())) {
          order.priority = "normal"
        }

        validOrders.push(order)
        console.log(`✅ Row ${i} parsed successfully:`, order.order_number)
      } catch (error) {
        console.error(`❌ Error parsing row ${i}:`, error)
        validationErrors.push(`Row ${i}: ${error instanceof Error ? error.message : "Parse error"}`)
      }
    }

    console.log(`📊 Parsing complete: ${validOrders.length} valid orders, ${validationErrors.length} errors`)

    if (validOrders.length === 0) {
      return NextResponse.json(
        {
          error: "No valid orders found in file",
          debug: {
            totalRows: lines.length - 1,
            validOrders: validOrders.length,
            validationErrors: validationErrors.slice(0, 10), // Limit errors shown
            headerMap,
            sampleRow: lines[1] ? parseCSVLine(lines[1]) : null,
          },
        },
        { status: 400 },
      )
    }

    // Insert orders into database
    const ordersToInsert = validOrders.map((order) => ({
      ...order,
      created_by: adminId,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    console.log("💾 Inserting orders into database:", ordersToInsert.length)

    const { data, error } = await supabase.from("orders").insert(ordersToInsert).select()

    if (error) {
      console.error("❌ Database insert error:", error)
      return NextResponse.json(
        {
          error: "Failed to insert orders into database",
          debug: {
            supabaseError: error.message,
            validOrders: validOrders.length,
          },
        },
        { status: 500 },
      )
    }

    console.log("✅ Successfully inserted orders:", data?.length)

    return NextResponse.json({
      imported: data?.length || 0,
      total_processed: lines.length - 1,
      validation_errors: validationErrors.length > 0 ? validationErrors.slice(0, 10) : undefined,
      success: true,
    })
  } catch (error) {
    console.error("❌ Upload processing error:", error)
    return NextResponse.json(
      {
        error: "Failed to process upload",
        debug: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  // Add the last field
  result.push(current.trim())

  return result
}

function createHeaderMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}

  headers.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "_")

    // Map common variations
    if (cleanHeader.includes("order") && cleanHeader.includes("number")) {
      mapping.order_number = index
    } else if (cleanHeader.includes("customer") && cleanHeader.includes("name")) {
      mapping.customer_name = index
    } else if (cleanHeader.includes("customer") && cleanHeader.includes("phone")) {
      mapping.customer_phone = index
    } else if (cleanHeader.includes("customer") && cleanHeader.includes("email")) {
      mapping.customer_email = index
    } else if (cleanHeader.includes("pickup") && cleanHeader.includes("address")) {
      mapping.pickup_address = index
    } else if (cleanHeader.includes("delivery") && cleanHeader.includes("address")) {
      mapping.delivery_address = index
    } else if (cleanHeader.includes("priority")) {
      mapping.priority = index
    } else if (cleanHeader.includes("delivery") && cleanHeader.includes("notes")) {
      mapping.delivery_notes = index
    } else if (cleanHeader.includes("notes")) {
      mapping.delivery_notes = index
    }
  })

  return mapping
}

function getValueByHeader(values: string[], headerMap: Record<string, number>, key: string): string | undefined {
  const index = headerMap[key]
  if (index !== undefined && index < values.length) {
    const value = values[index]?.replace(/^"|"$/g, "").trim() // Remove quotes and trim
    return value || undefined
  }
  return undefined
}
