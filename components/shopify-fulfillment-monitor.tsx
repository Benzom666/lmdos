"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { RefreshCw, CheckCircle, Clock, AlertTriangle, XCircle, Play, Zap } from "lucide-react"

interface SyncStatus {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
}

interface FulfillmentTask {
  id: string
  order_number: string
  status: string
  sync_type: string
  attempts: number
  error_message?: string
  created_at: string
  scheduled_at: string
  processed_at?: string
}

export function ShopifyFulfillmentMonitor() {
  const { toast } = useToast()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [recentTasks, setRecentTasks] = useState<FulfillmentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/fulfillment/sync")
      if (response.ok) {
        const data = await response.json()
        setStatus(data.status)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error("Error fetching sync status:", error)
    } finally {
      setLoading(false)
    }
  }

  const triggerSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/fulfillment/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Sync Triggered",
          description: data.message,
        })
        await fetchStatus()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to trigger sync")
      }
    } catch (error) {
      console.error("Error triggering sync:", error)
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to trigger sync",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading fulfillment sync status...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Shopify Fulfillment Sync Monitor
              </CardTitle>
              <CardDescription>
                Real-time monitoring of Shopify order fulfillment synchronization
                {lastUpdate && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="default" size="sm" onClick={triggerSync} disabled={syncing}>
                {syncing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div className="text-2xl font-bold">{status.pending}</div>
                <Badge variant="secondary" className="text-xs">
                  Pending
                </Badge>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                </div>
                <div className="text-2xl font-bold">{status.processing}</div>
                <Badge variant="secondary" className="text-xs bg-blue-100">
                  Processing
                </Badge>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold">{status.completed}</div>
                <Badge variant="default" className="text-xs bg-green-500">
                  Completed
                </Badge>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold">{status.failed}</div>
                <Badge variant="destructive" className="text-xs">
                  Failed
                </Badge>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <AlertTriangle className="h-5 w-5 text-gray-500" />
                </div>
                <div className="text-2xl font-bold">{status.total}</div>
                <Badge variant="outline" className="text-xs">
                  Total
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">No sync data available</div>
          )}

          {status && status.total > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="text-sm">
                <div className="flex justify-between items-center">
                  <span>Success Rate:</span>
                  <span className="font-medium">
                    {status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0}%
                  </span>
                </div>
                {status.failed > 0 && (
                  <div className="flex justify-between items-center text-red-600 mt-1">
                    <span>Failed Tasks:</span>
                    <span className="font-medium">{status.failed} require attention</span>
                  </div>
                )}
                {status.pending > 0 && (
                  <div className="flex justify-between items-center text-yellow-600 mt-1">
                    <span>Pending Tasks:</span>
                    <span className="font-medium">{status.pending} in queue</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Troubleshooting Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Fulfillment Sync Troubleshooting</CardTitle>
          <CardDescription>Common issues and solutions for Shopify fulfillment synchronization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Orders Not Fulfilling in Shopify</p>
                <p className="text-sm text-muted-foreground">
                  Ensure your Shopify app has "Fulfillments: Read and write" permissions and the access token is valid
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Failed Sync Tasks</p>
                <p className="text-sm text-muted-foreground">
                  Check that your Shopify connection is active and the store domain is accessible
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Delayed Fulfillment Updates</p>
                <p className="text-sm text-muted-foreground">
                  Fulfillments are processed in a queue. Use "Sync Now" to process pending tasks immediately
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">How Fulfillment Sync Works:</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>When an order is marked as "delivered", it's automatically queued for Shopify fulfillment</li>
              <li>The system processes the queue every 30 seconds in the background</li>
              <li>Each order is fulfilled in Shopify with a tracking number (DEL-[ORDER_NUMBER])</li>
              <li>The fulfillment status is updated in both systems</li>
              <li>Failed fulfillments are automatically retried with exponential backoff</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
