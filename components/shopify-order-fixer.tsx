"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Wrench, CheckCircle, XCircle, RefreshCw } from "lucide-react"

interface BrokenOrder {
  id: string
  order_number: string
  status: string
  source: string
  shopify_order_id: string | null
  sync_status: string
  created_at: string
}

interface FixResult {
  success: boolean
  message: string
  fixed_count: number
  fixed_orders: Array<{
    id: string
    order_number: string
    shopify_order_id: string
  }>
  connection_used: string
}

export function ShopifyOrderFixer() {
  const [brokenOrders, setBrokenOrders] = useState<BrokenOrder[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [result, setResult] = useState<FixResult | null>(null)

  const fetchBrokenOrders = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/fix-shopify-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_broken_orders" }),
      })

      const data = await response.json()
      if (response.ok) {
        setBrokenOrders(data.broken_orders || [])
      } else {
        console.error("Failed to fetch broken orders:", data.error)
      }
    } catch (error) {
      console.error("Error fetching broken orders:", error)
    } finally {
      setLoading(false)
    }
  }

  const fixSelectedOrders = async () => {
    if (selectedOrders.length === 0) {
      alert("Please select orders to fix")
      return
    }

    setFixing(true)
    setResult(null)

    try {
      const response = await fetch("/api/fix-shopify-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fix_missing_shopify_ids",
          orderIds: selectedOrders,
        }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        // Refresh the broken orders list
        await fetchBrokenOrders()
        setSelectedOrders([])
      }
    } catch (error) {
      console.error("Error fixing orders:", error)
      setResult({
        success: false,
        message: "Failed to fix orders",
        fixed_count: 0,
        fixed_orders: [],
        connection_used: "",
      })
    } finally {
      setFixing(false)
    }
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]))
  }

  const selectAll = () => {
    setSelectedOrders(brokenOrders.map((order) => order.id))
  }

  const selectNone = () => {
    setSelectedOrders([])
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Shopify Order Fixer
          </CardTitle>
          <CardDescription>
            Fix orders that have source="shopify" but are missing the shopify_order_id field
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={fetchBrokenOrders} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Scan for Broken Orders
                </>
              )}
            </Button>

            {brokenOrders.length > 0 && (
              <Button onClick={fixSelectedOrders} disabled={fixing || selectedOrders.length === 0} variant="default">
                {fixing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    Fix Selected Orders ({selectedOrders.length})
                  </>
                )}
              </Button>
            )}
          </div>

          {result && (
            <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription>
                  <strong>{result.message}</strong>
                  {result.success && result.connection_used && (
                    <div className="mt-1 text-sm">Connected to: {result.connection_used}</div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {brokenOrders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Found {brokenOrders.length} orders that need fixing:</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button size="sm" variant="outline" onClick={selectNone}>
                    Select None
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {brokenOrders.map((order) => (
                  <div
                    key={order.id}
                    className={`flex items-center justify-between p-3 border rounded ${
                      selectedOrders.includes(order.id) ? "bg-blue-50 border-blue-200" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                      />
                      <div>
                        <div className="font-medium">#{order.order_number}</div>
                        <div className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={order.status === "delivered" ? "default" : "secondary"}>{order.status}</Badge>
                      <Badge variant="outline">{order.source}</Badge>
                      <Badge variant="destructive" className="text-xs">
                        Missing Shopify ID
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {brokenOrders.length === 0 && !loading && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <strong>Great!</strong> No broken orders found. All Shopify orders have proper IDs.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">What This Tool Does</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <strong>🔍 Scans for broken orders:</strong> Finds orders with source="shopify" but missing shopify_order_id
          </div>
          <div>
            <strong>🔧 Fixes missing IDs:</strong> Generates unique Shopify order IDs for selected orders
          </div>
          <div>
            <strong>🔗 Links to connection:</strong> Associates orders with your active Shopify connection
          </div>
          <div>
            <strong>✅ Enables fulfillment:</strong> Orders can now be fulfilled in Shopify after fixing
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
