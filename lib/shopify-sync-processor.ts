import { createClient } from "@supabase/supabase-js"

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

export class ShopifySyncProcessor {
  private isProcessing = false
  private processingInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startProcessing()
  }

  startProcessing() {
    if (this.processingInterval) return

    console.log("🚀 Starting Shopify sync processor...")

    // Process pending tasks every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processPendingTasks()
    }, 30000)

    // Process immediately
    this.processPendingTasks()
  }

  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      console.log("⏹️ Stopped Shopify sync processor")
    }
  }

  async processPendingTasks() {
    if (this.isProcessing) return

    this.isProcessing = true

    try {
      // Get pending tasks that are ready to be processed
      const { data: pendingTasks, error } = await supabaseServiceRole
        .from("shopify_sync_queue")
        .select("id, sync_type, scheduled_at, attempts")
        .eq("status", "pending")
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(10)

      if (error) {
        console.error("❌ Error fetching pending sync tasks:", error)
        return
      }

      if (!pendingTasks || pendingTasks.length === 0) {
        return
      }

      console.log(`📋 Processing ${pendingTasks.length} pending sync tasks...`)

      // Process tasks in parallel (but limit concurrency)
      const promises = pendingTasks.map((task) => this.processTask(task.id))
      await Promise.allSettled(promises)

      console.log(`✅ Completed processing ${pendingTasks.length} sync tasks`)
    } catch (error) {
      console.error("❌ Error in sync processor:", error)
    } finally {
      this.isProcessing = false
    }
  }

  private async processTask(queueId: string) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sync/shopify-realtime`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ queueId }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error(`❌ Failed to process sync task ${queueId}:`, error)
      } else {
        const result = await response.json()
        console.log(`✅ Successfully processed sync task ${queueId}:`, result.message)
      }
    } catch (error) {
      console.error(`❌ Network error processing sync task ${queueId}:`, error)
    }
  }

  async queueFulfillment(orderId: string, shopifyConnectionId: string) {
    const { error } = await supabaseServiceRole.from("shopify_sync_queue").insert({
      order_id: orderId,
      shopify_connection_id: shopifyConnectionId,
      sync_type: "fulfillment",
      scheduled_at: new Date().toISOString(),
    })

    if (error) {
      console.error("❌ Error queuing fulfillment sync:", error)
      throw error
    }

    console.log(`📋 Queued fulfillment sync for order ${orderId}`)
  }

  async getQueueStatus() {
    const { data, error } = await supabaseServiceRole
      .from("shopify_sync_queue")
      .select("status, sync_type")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    if (error) {
      console.error("❌ Error getting queue status:", error)
      return null
    }

    const stats = data.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        acc.total++
        return acc
      },
      { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 },
    )

    return stats
  }
}

// Global instance
let syncProcessor: ShopifySyncProcessor | null = null

export function getSyncProcessor() {
  if (!syncProcessor) {
    syncProcessor = new ShopifySyncProcessor()
  }
  return syncProcessor
}

export function startSyncProcessor() {
  const processor = getSyncProcessor()
  processor.startProcessing()
  return processor
}
