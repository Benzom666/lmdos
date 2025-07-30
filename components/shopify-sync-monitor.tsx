"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, CheckCircle, Clock, AlertTriangle, XCircle } from "lucide-react"

interface SyncStatus {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
}

export function ShopifySyncMonitor() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/sync/status")
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
            Loading sync status...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Real-time Sync Monitor
            </CardTitle>
            <CardDescription>
              Shopify fulfillment synchronization status (Last 24 hours)
              {lastUpdate && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStatus}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
