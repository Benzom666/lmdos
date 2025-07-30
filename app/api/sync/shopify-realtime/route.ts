import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { makeShopifyRequest } from "@/lib/shopify-api"

const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

export async function POST(request: NextRequest) {
  console.log("🔄 Processing Shopify real-time sync...")

  try {
    const { queueId, force = false } = await request.json()

    if (!queueId) {
      return NextResponse.json({ error: "Queue ID is required" }, { status: 400 })
    }

    // Get the sync task
    const { data: syncTask, error: taskError } = await supabaseServiceRole
      .from("shopify_sync_queue")
      .select(`
        *,
        orders!inner (
          id,
          order_number,
          status,
          external_order_id,
          completed_at,
          driver_id
        ),
        shopify_connections!inner (
          id,
          shop_domain,
          access_token,
          is_active
        )
      `)
      .eq("id", queueId)
      .eq("status", force ? undefined : "pending")
      .single()

    if (taskError || !syncTask) {
      console.error("❌ Sync task not found:", taskError)
      return NextResponse.json({ error: "Sync task not found" }, { status: 404 })
    }

    // Check if connection is active
    if (!syncTask.shopify_connections.is_active) {
      await updateSyncTask(queueId, "failed", "Shopify connection is inactive")
      return NextResponse.json({ error: "Shopify connection is inactive" }, { status: 400 })
    }

    // Mark as processing
    await updateSyncTask(queueId, "processing")

    try {
      let result
      switch (syncTask.sync_type) {
        case "fulfillment":
          result = await processFulfillment(syncTask)
          break
        case "cancellation":
          result = await processCancellation(syncTask)
          break
        case "update":
          result = await processUpdate(syncTask)
          break
        default:
          throw new Error(`Unknown sync type: ${syncTask.sync_type}`)
      }

      // Mark as completed
      await updateSyncTask(queueId, "completed", null, result)

      // Update the order sync status
      await supabaseServiceRole
        .from("orders")
        .update({
          sync_status: "synced",
          shopify_fulfillment_id: result.fulfillment_id || null,
          shopify_fulfilled_at: result.fulfilled_at || null,
        })
        .eq("id", syncTask.order_id)

      console.log(`✅ Sync completed for order ${syncTask.orders.order_number}`)

      return NextResponse.json({
        success: true,
        message: "Sync completed successfully",
        result,
      })
    } catch (syncError) {
      console.error("❌ Sync failed:", syncError)

      // Increment attempts
      const newAttempts = syncTask.attempts + 1
      const maxAttempts = syncTask.max_attempts || 3

      if (newAttempts >= maxAttempts) {
        await updateSyncTask(queueId, "failed", syncError.message, null, newAttempts)
        await supabaseServiceRole.from("orders").update({ sync_status: "failed" }).eq("id", syncTask.order_id)
      } else {
        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(2, newAttempts) * 60 * 1000 // 2^n minutes
        const scheduledAt = new Date(Date.now() + retryDelay)

        await updateSyncTask(queueId, "pending", syncError.message, null, newAttempts, scheduledAt)
      }

      return NextResponse.json(
        {
          error: "Sync failed",
          details: syncError.message,
          attempts: newAttempts,
          maxAttempts,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("❌ Critical error in sync endpoint:", error)
    return NextResponse.json(
      {
        error: "Critical sync error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function processFulfillment(syncTask: any) {
  const { shopify_connections: connection, orders: order, payload } = syncTask

  console.log(`🏪 Processing fulfillment for order ${order.order_number}`)

  // Get driver info for tracking
  let driverName = "DeliveryOS"
  if (order.driver_id) {
    const { data: driver } = await supabaseServiceRole
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("user_id", order.driver_id)
      .single()

    if (driver) {
      driverName = `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || "DeliveryOS Driver"
    }
  }

  const fulfillmentData = {
    fulfillment: {
      location_id: null,
      tracking_number: `DEL-${order.order_number}`,
      tracking_company: "DeliveryOS Local Delivery",
      tracking_url: null,
      notify_customer: true,
      line_items: [], // Fulfill all items
    },
  }

  const url = `https://${connection.shop_domain}/admin/api/2023-10/orders/${order.external_order_id}/fulfillments.json`

  const response = await makeShopifyRequest(url, connection.access_token, {
    method: "POST",
    body: JSON.stringify(fulfillmentData),
  })

  return {
    fulfillment_id: response.fulfillment.id.toString(),
    fulfilled_at: new Date().toISOString(),
    tracking_number: `DEL-${order.order_number}`,
  }
}

async function processCancellation(syncTask: any) {
  const { shopify_connections: connection, orders: order } = syncTask

  console.log(`❌ Processing cancellation for order ${order.order_number}`)

  const cancelData = {
    reason: order.status === "failed" ? "other" : "customer",
    email: true,
    refund: false, // Don't automatically refund
  }

  const url = `https://${connection.shop_domain}/admin/api/2023-10/orders/${order.external_order_id}/cancel.json`

  await makeShopifyRequest(url, connection.access_token, {
    method: "POST",
    body: JSON.stringify(cancelData),
  })

  return {
    cancelled_at: new Date().toISOString(),
    reason: cancelData.reason,
  }
}

async function processUpdate(syncTask: any) {
  const { shopify_connections: connection, orders: order } = syncTask

  console.log(`📝 Processing update for order ${order.order_number}`)

  // Add a note to the order about the status change
  const noteData = {
    note: {
      body: `Delivery status updated to: ${order.status}`,
      author: "DeliveryOS",
    },
  }

  const url = `https://${connection.shop_domain}/admin/api/2023-10/orders/${order.external_order_id}/notes.json`

  await makeShopifyRequest(url, connection.access_token, {
    method: "POST",
    body: JSON.stringify(noteData),
  })

  return {
    updated_at: new Date().toISOString(),
    note_added: true,
  }
}

async function updateSyncTask(
  queueId: string,
  status: string,
  errorMessage?: string | null,
  result?: any,
  attempts?: number,
  scheduledAt?: Date,
) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (errorMessage !== undefined) updateData.error_message = errorMessage
  if (result) updateData.payload = { ...updateData.payload, result }
  if (attempts !== undefined) updateData.attempts = attempts
  if (scheduledAt) updateData.scheduled_at = scheduledAt.toISOString()
  if (status === "completed" || status === "failed") updateData.processed_at = new Date().toISOString()

  await supabaseServiceRole.from("shopify_sync_queue").update(updateData).eq("id", queueId)
}
