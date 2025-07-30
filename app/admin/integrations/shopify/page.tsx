"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ShoppingBag,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  Zap,
  Package,
  BookOpen,
  Play,
  Trash2,
  Truck,
  Clock,
  CheckCircle2,
  Bug,
  TestTube,
  Key,
  Loader2,
} from "lucide-react"

import { supabase } from "@/lib/supabase"

interface ShopifyConnection {
  id: string
  shop_domain: string
  access_token: string
  webhook_secret: string
  is_active: boolean
  last_sync: string
  orders_synced: number
  created_at: string
  settings: {
    auto_create_orders: boolean
    auto_assign_drivers: boolean
    sync_order_status: boolean
    notification_emails: string[]
    fulfillment_service: boolean
  }
}

interface ShopifyOrder {
  id: string
  shopify_order_id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: any
  line_items: any[]
  total_price: string
  fulfillment_status: string
  actual_fulfillment_status: string
  financial_status: string
  created_at: string
  synced_at: string
  delivery_status: string | null
  delivery_completed_at: string | null
  has_delivery_order: boolean
  sync_status: string
  shopify_connections: Array<{ shop_domain: string; is_active: boolean }>
  orders: Array<{
    id: string
    order_number: string
    status: string
    completed_at: string | null
    shopify_fulfillment_id: string | null
    shopify_fulfilled_at: string | null
  }>
}

// Simple Debug Tool Component
function SimpleDebugTool() {
  const [orderNumber, setOrderNumber] = useState("")
  const [debugResult, setDebugResult] = useState<any>(null)
  const [isDebugging, setIsDebugging] = useState(false)

  const runDebug = async () => {
    if (!orderNumber.trim()) {
      alert("Please enter an order number")
      return
    }

    setIsDebugging(true)
    setDebugResult(null)

    try {
      // Clean any SH- prefix from input
      const cleanOrderNumber = orderNumber.replace(/^SH-/i, "")
      const response = await fetch(`/api/debug/fulfillment?order=${encodeURIComponent(cleanOrderNumber)}`)
      const data = await response.json()
      setDebugResult(data)
    } catch (error) {
      setDebugResult({
        error: "Failed to debug order",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsDebugging(false)
    }
  }

  const fulfillOrder = async (orderNumber: string) => {
    try {
      // Clean any SH- prefix from input
      const cleanOrderNumber = orderNumber.replace(/^SH-/i, "")
      const response = await fetch("/api/debug/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: cleanOrderNumber, force: true }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`✅ Order ${cleanOrderNumber} fulfilled successfully in Shopify!`)
        // Refresh the debug result
        runDebug()
      } else {
        alert(`❌ Fulfillment failed: ${result.error}`)
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Enter order number (e.g., 1009)"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && runDebug()}
        />
        <Button onClick={runDebug} disabled={isDebugging}>
          {isDebugging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
          {isDebugging ? "Debugging..." : "Debug"}
        </Button>
      </div>

      {debugResult && (
        <div className="space-y-4">
          {debugResult.error && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-500" />
              <AlertDescription>
                <strong>Error:</strong> {debugResult.error}
                {debugResult.details && (
                  <div className="mt-1 text-sm">
                    <strong>Details:</strong> {debugResult.details}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {debugResult.order && (
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Order Number</Label>
                    <p className="text-sm">#{debugResult.order.order_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={debugResult.order.status === "delivered" ? "default" : "secondary"}>
                      {debugResult.order.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Source</Label>
                    <p className="text-sm">{debugResult.order.source}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Shopify Order ID</Label>
                    <p className="text-sm">{debugResult.order.shopify_order_id || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {debugResult.connection && (
            <Card>
              <CardHeader>
                <CardTitle>Connection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Shop Domain</Label>
                    <p className="text-sm">{debugResult.connection.shop_domain}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Active</Label>
                    <Badge variant={debugResult.connection.is_active ? "default" : "secondary"}>
                      {debugResult.connection.is_active ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Has Access Token</Label>
                    <Badge variant={debugResult.connection.has_token ? "default" : "destructive"}>
                      {debugResult.connection.has_token ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Token Length</Label>
                    <p className="text-sm">{debugResult.connection.token_length || 0} chars</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {debugResult && debugResult.debug_info?.can_fulfill && debugResult.debug_info?.fulfillment_ready && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-green-800">Ready for Fulfillment!</h4>
                    <p className="text-sm text-green-700">
                      This order is delivered and ready to be fulfilled in Shopify
                    </p>
                  </div>
                  <Button
                    onClick={() => fulfillOrder(debugResult.order.order_number)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Fulfill Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// Simple Token Updater Component
function SimpleTokenUpdater({ connectionId, shopDomain }: { connectionId: string; shopDomain: string }) {
  const [accessToken, setAccessToken] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [result, setResult] = useState<any>(null)

  const updateToken = async () => {
    if (!accessToken.trim()) {
      alert("Please enter an access token")
      return
    }

    if (!accessToken.startsWith("shpat_")) {
      alert("Access token must start with 'shpat_'")
      return
    }

    setIsUpdating(true)
    setResult(null)

    try {
      const response = await fetch(`/api/integrations/shopify/${connectionId}/update-token`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        setAccessToken("") // Clear the token input for security
      }
    } catch (error) {
      console.error("Token update error:", error)
      setResult({
        success: false,
        message: "Failed to update access token",
        test_error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Update Access Token
        </CardTitle>
        <CardDescription>
          Update the access token for: <strong>{shopDomain}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accessToken">Shopify Access Token *</Label>
          <Input
            id="accessToken"
            type="password"
            placeholder="shpat_..."
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            className="font-mono"
          />
        </div>

        <Button onClick={updateToken} disabled={isUpdating || !accessToken.trim()}>
          {isUpdating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Key className="h-4 w-4 mr-2" />
              Update Access Token
            </>
          )}
        </Button>

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
                {result.test_error && (
                  <div className="mt-1 text-sm">
                    <strong>Test Error:</strong> {result.test_error}
                  </div>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default function ShopifyIntegrationPage() {
  const { toast } = useToast()
  const [connections, setConnections] = useState<ShopifyConnection[]>([])
  const [recentOrders, setRecentOrders] = useState<ShopifyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)
  const [testingConnection, setTestingConnection] = useState<string | null>(null)
  const [syncingConnection, setSyncingConnection] = useState<string | null>(null)

  // Connection form state
  const [shopDomain, setShopDomain] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")

  // Statistics
  const [stats, setStats] = useState({
    totalConnections: 0,
    activeConnections: 0,
    ordersSynced: 0,
    lastSync: null as string | null,
  })

  useEffect(() => {
    fetchConnections()
    fetchRecentOrders()
  }, [])

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      throw new Error("Authentication required")
    }
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    }
  }

  const fetchConnections = async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/integrations/shopify", { headers })

      if (response.ok) {
        const data = await response.json()
        setConnections(data.connections || [])
        updateStats(data.connections || [])
      } else if (response.status === 401) {
        toast({
          title: "Authentication Error",
          description: "Please log in to continue",
          variant: "destructive",
        })
      } else {
        throw new Error("Failed to fetch connections")
      }
    } catch (error) {
      console.error("Error fetching Shopify connections:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load Shopify connections",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentOrders = async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/integrations/shopify/orders", { headers })

      if (response.ok) {
        const data = await response.json()
        console.log("📦 Fetched recent orders:", data.orders?.length || 0)
        setRecentOrders(data.orders || [])
      } else {
        console.error("❌ Failed to fetch recent orders:", response.status)
      }
    } catch (error) {
      console.error("Error fetching Shopify orders:", error)
    }
  }

  const updateStats = (connections: ShopifyConnection[]) => {
    const activeConnections = connections.filter((conn) => conn.is_active).length
    const totalOrdersSynced = connections.reduce((sum, conn) => sum + conn.orders_synced, 0)
    const lastSync = connections.reduce(
      (latest, conn) => {
        if (!latest || new Date(conn.last_sync) > new Date(latest)) {
          return conn.last_sync
        }
        return latest
      },
      null as string | null,
    )

    setStats({
      totalConnections: connections.length,
      activeConnections,
      ordersSynced: totalOrdersSynced,
      lastSync,
    })
  }

  const connectShopifyStore = async () => {
    if (!shopDomain || !accessToken) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const headers = await getAuthHeaders()
      const response = await fetch("/api/integrations/shopify", {
        method: "POST",
        headers,
        body: JSON.stringify({
          shop_domain: shopDomain,
          access_token: accessToken,
          webhook_secret: webhookSecret,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setConnections((prev) => [...prev, data.connection])
        setConnectDialogOpen(false)
        setShopDomain("")
        setAccessToken("")
        setWebhookSecret("")

        toast({
          title: "Shopify Store Connected",
          description: "Your Shopify store has been successfully connected",
        })

        // Refresh the connections and stats
        fetchConnections()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to connect Shopify store")
      }
    } catch (error) {
      console.error("Connection error:", error)
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect Shopify store",
        variant: "destructive",
      })
    }
  }

  const testConnection = async (connectionId: string) => {
    setTestingConnection(connectionId)
    try {
      const response = await fetch(`/api/integrations/shopify/${connectionId}/test`, {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Connection Test Successful",
          description: "Successfully connected to Shopify store",
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to test Shopify connection")
      }
    } catch (error) {
      console.error("Test connection error:", error)
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "There was an issue with your Shopify store connection",
        variant: "destructive",
      })
    } finally {
      setTestingConnection(null)
    }
  }

  const syncOrders = async (connectionId: string) => {
    setSyncingConnection(connectionId)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/integrations/shopify/${connectionId}/sync`, {
        method: "POST",
        headers,
      })

      if (response.ok) {
        const data = await response.json()

        // Show detailed success message
        const successMessage =
          data.delivery_orders_created > 0
            ? `Successfully synced ${data.synced_count || 0} orders and created ${data.delivery_orders_created} delivery orders`
            : `Successfully synced ${data.synced_count || 0} orders from Shopify`

        toast({
          title: "Orders Synced Successfully",
          description: successMessage,
        })

        // Refresh the connections and orders
        await fetchConnections()
        await fetchRecentOrders()

        // Navigate to orders page to show the synced orders
        if (data.delivery_orders_created > 0) {
          setTimeout(() => {
            window.location.href = "/admin/orders"
          }, 2000)
        }
      } else {
        const error = await response.json()
        console.error("Sync error response:", error)

        let errorMessage = "Failed to sync orders from Shopify"
        if (error.error) {
          errorMessage = error.error
          if (error.details) {
            errorMessage += `: ${error.details}`
          }
        }

        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error("Sync orders error:", error)
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync orders from Shopify",
        variant: "destructive",
      })
    } finally {
      setSyncingConnection(null)
    }
  }

  const toggleConnection = async (connectionId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/integrations/shopify/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      })
      if (response.ok) {
        setConnections((prev) =>
          prev.map((conn) => (conn.id === connectionId ? { ...conn, is_active: isActive } : conn)),
        )
        toast({
          title: "Connection Status Updated",
          description: `Shopify connection is now ${isActive ? "active" : "inactive"}`,
        })
      } else {
        const error = await response.json()
        throw new Error(error.message || "Failed to update connection status")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update connection status",
        variant: "destructive",
      })
    }
  }

  const deleteConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/integrations/shopify/${connectionId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setConnections((prev) => prev.filter((conn) => conn.id !== connectionId))
        toast({
          title: "Connection Deleted",
          description: "Shopify connection has been successfully deleted",
        })
      } else {
        const error = await response.json()
        throw new Error(error.message || "Failed to delete connection")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete connection",
        variant: "destructive",
      })
    }
  }

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/webhooks/shopify`
    navigator.clipboard.writeText(webhookUrl)
    toast({
      title: "Webhook URL Copied",
      description: "The webhook URL has been copied to your clipboard",
    })
  }

  const getWebhookUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/webhooks/shopify`
    }
    return ""
  }

  const getFulfillmentStatusBadge = (order: ShopifyOrder) => {
    const status = order.actual_fulfillment_status || order.fulfillment_status

    switch (status) {
      case "fulfilled":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Fulfilled
          </Badge>
        )
      case "pending_fulfillment":
        return (
          <Badge variant="secondary" className="bg-yellow-500">
            <Clock className="w-3 h-3 mr-1" />
            Pending Fulfillment
          </Badge>
        )
      case "unfulfilled":
        return (
          <Badge variant="outline">
            <Package className="w-3 h-3 mr-1" />
            Unfulfilled
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getDeliveryStatusBadge = (order: ShopifyOrder) => {
    if (!order.has_delivery_order) {
      return <Badge variant="outline">No Delivery Order</Badge>
    }

    switch (order.delivery_status) {
      case "delivered":
        return (
          <Badge variant="default" className="bg-green-500">
            <Truck className="w-3 h-3 mr-1" />
            Delivered
          </Badge>
        )
      case "in_transit":
        return (
          <Badge variant="secondary" className="bg-blue-500">
            <Truck className="w-3 h-3 mr-1" />
            In Transit
          </Badge>
        )
      case "assigned":
        return (
          <Badge variant="secondary">
            <Truck className="w-3 h-3 mr-1" />
            Assigned
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return <Badge variant="outline">{order.delivery_status}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shopify Integration</h1>
          <p className="text-muted-foreground">
            Connect your Shopify stores to automatically sync orders and manage deliveries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("https://docs.shopify.com/api", "_blank")}>
            <BookOpen className="mr-2 h-4 w-4" />
            Shopify Docs
          </Button>
          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Connect Store
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Connect Shopify Store</DialogTitle>
                <DialogDescription>
                  Enter your Shopify store details to establish a connection for order synchronization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shopDomain">Shop Domain *</Label>
                  <Input
                    id="shopDomain"
                    placeholder="your-store.myshopify.com"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token *</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="shpat_..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">Webhook Secret (Optional)</Label>
                  <Input
                    id="webhookSecret"
                    placeholder="webhook_secret_key"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={connectShopifyStore}>Connect Store</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Stores</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConnections}</div>
            <p className="text-xs text-muted-foreground">{stats.activeConnections} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders Synced</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ordersSynced.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total synchronized</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.lastSync ? new Date(stats.lastSync).toLocaleDateString() : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.lastSync ? new Date(stats.lastSync).toLocaleTimeString() : "No syncs yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integration Status</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.activeConnections > 0 ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.activeConnections > 0 ? "Connected" : "Not connected"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="connections" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="debug">
            <Bug className="mr-2 h-4 w-4" />
            Debug
          </TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          <div className="grid gap-6">
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">Loading connections...</div>
                </CardContent>
              </Card>
            ) : connections.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div>
                      <h3 className="text-lg font-medium">No Shopify Stores Connected</h3>
                      <p className="text-muted-foreground">
                        Connect your first Shopify store to start syncing orders automatically.
                      </p>
                    </div>
                    <Button onClick={() => setConnectDialogOpen(true)}>
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      Connect Your First Store
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              connections.map((connection) => (
                <Card key={connection.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShoppingBag className="h-6 w-6" />
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {connection.shop_domain}
                            <Badge variant={connection.is_active ? "default" : "secondary"}>
                              {connection.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Connected {new Date(connection.created_at).toLocaleDateString()} •{" "}
                            {connection.orders_synced.toLocaleString()} orders synced
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={connection.is_active}
                          onCheckedChange={(checked) => toggleConnection(connection.id, checked)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testConnection(connection.id)}
                          disabled={testingConnection === connection.id}
                        >
                          {testingConnection === connection.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this Shopify connection? This will stop all order
                                synchronization and cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteConnection(connection.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Auto Create Orders</p>
                        <Badge variant={connection.settings.auto_create_orders ? "default" : "outline"}>
                          {connection.settings.auto_create_orders ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Auto Assign Drivers</p>
                        <Badge variant={connection.settings.auto_assign_drivers ? "default" : "outline"}>
                          {connection.settings.auto_assign_drivers ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Sync Status</p>
                        <Badge variant={connection.settings.sync_order_status ? "default" : "outline"}>
                          {connection.settings.sync_order_status ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Last Sync</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(connection.last_sync).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncOrders(connection.id)}
                        disabled={syncingConnection === connection.id || !connection.is_active}
                      >
                        {syncingConnection === connection.id ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        {syncingConnection === connection.id ? "Syncing..." : "Sync Orders"}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="mr-2 h-4 w-4" />
                        Configure
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://${connection.shop_domain}/admin`, "_blank")}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Store
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Recent Orders Tab */}
        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Shopify Orders</CardTitle>
              <CardDescription>
                Orders synchronized from your connected Shopify stores with real-time fulfillment status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Orders Synced</h3>
                  <p className="text-muted-foreground">
                    Orders from your Shopify stores will appear here once synchronized.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5" />
                          <div>
                            <h4 className="font-medium">Order #{order.order_number}</h4>
                            <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${order.total_price}</p>
                          <div className="flex gap-2 mt-1">{getFulfillmentStatusBadge(order)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Customer</p>
                          <p className="text-muted-foreground">{order.customer_email}</p>
                        </div>
                        <div>
                          <p className="font-medium">Phone</p>
                          <p className="text-muted-foreground">{order.customer_phone || "N/A"}</p>
                        </div>
                        <div>
                          <p className="font-medium">Delivery Status</p>
                          {getDeliveryStatusBadge(order)}
                        </div>
                        <div>
                          <p className="font-medium">Created</p>
                          <p className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="font-medium">Sync Status</p>
                          <Badge variant={order.sync_status === "synced" ? "default" : "secondary"}>
                            {order.sync_status === "synced" ? "Synced" : "Pending"}
                          </Badge>
                        </div>
                      </div>

                      {order.delivery_completed_at && (
                        <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                          <p className="text-sm text-green-800">
                            <CheckCircle2 className="w-4 h-4 inline mr-1" />
                            Delivered on {new Date(order.delivery_completed_at).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Setup Guide Tab */}
        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shopify Integration Setup Guide</CardTitle>
              <CardDescription>
                Follow these steps to connect your Shopify store with automatic fulfillment sync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">Create a Private App in Shopify</h3>
                    <p className="text-sm text-muted-foreground">
                      Go to your Shopify admin → Apps → App and sales channel settings → Develop apps → Create an app
                    </p>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">Required Permissions:</p>
                      <ul className="text-sm space-y-1">
                        <li>• Orders: Read and write</li>
                        <li>• Products: Read</li>
                        <li>• Customers: Read</li>
                        <li>• Fulfillments: Read and write</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">Get Your Access Token</h3>
                    <p className="text-sm text-muted-foreground">
                      After creating the app, install it and copy the Admin API access token
                    </p>
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm">
                        {"The access token will start with "}
                        <code className="bg-background px-1 rounded">{"shpat_"}</code>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">Configure Webhooks (Optional)</h3>
                    <p className="text-sm text-muted-foreground">Set up webhooks for real-time order synchronization</p>
                    <div className="bg-muted p-3 rounded-lg space-y-2">
                      <p className="text-sm font-medium">Webhook URL:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-2 py-1 rounded flex-1">{getWebhookUrl()}</code>
                        <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm">Events: orders/create, orders/updated, orders/paid</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    4
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">Connect Your Store</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the "Connect Store" button above to add your Shopify store to the delivery system
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    ✓
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium">Automatic Fulfillment Sync</h3>
                    <p className="text-sm text-muted-foreground">
                      Once connected, orders marked as "delivered" in DeliveryOS will automatically update the Shopify
                      fulfillment status to "fulfilled"
                    </p>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                        Real-time synchronization ensures your Shopify admin always shows the latest delivery status
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-medium mb-4">Troubleshooting</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Connection Failed</p>
                      <p className="text-sm text-muted-foreground">
                        Check that your shop domain is correct and your access token has the required permissions
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Orders Not Syncing</p>
                      <p className="text-sm text-muted-foreground">
                        Ensure webhooks are properly configured or manually sync orders from the connections tab
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Fulfillment Not Updating</p>
                      <p className="text-sm text-muted-foreground">
                        Verify that your Shopify app has "Fulfillments: Read and write" permissions enabled
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>Configure real-time order synchronization with webhooks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Webhook Endpoint URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={getWebhookUrl()} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use this URL in your Shopify webhook configuration
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Supported Events</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {[
                      { event: "orders/create", description: "New order created" },
                      { event: "orders/updated", description: "Order details updated" },
                      { event: "orders/paid", description: "Order payment completed" },
                      { event: "orders/cancelled", description: "Order cancelled" },
                      { event: "orders/fulfilled", description: "Order fulfilled" },
                      { event: "orders/partially_fulfilled", description: "Order partially fulfilled" },
                    ].map((item) => (
                      <div key={item.event} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <code className="text-sm">{item.event}</code>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Webhook Security</Label>
                  <div className="bg-muted p-4 rounded-lg mt-2">
                    <p className="text-sm mb-2">
                      For enhanced security, configure a webhook secret in your Shopify app settings and enter it when
                      connecting your store.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The webhook secret is used to verify that requests are coming from Shopify and have not been
                      tampered with.
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Fulfillment Sync</Label>
                  <div className="bg-blue-50 p-4 rounded-lg mt-2 border border-blue-200">
                    <p className="text-sm mb-2 text-blue-800">
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      Automatic fulfillment synchronization is enabled for all connected stores.
                    </p>
                    <p className="text-xs text-blue-700">
                      When orders are marked as "delivered" in DeliveryOS, the corresponding Shopify orders will
                      automatically be marked as "fulfilled" with tracking information.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debug Tab */}
        <TabsContent value="debug" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Fulfillment Debug Tool
              </CardTitle>
              <CardDescription>
                Debug and test Shopify fulfillment sync for specific orders (use plain numbers like 1009)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleDebugTool />
            </CardContent>
          </Card>

          {connections.length > 0 && (
            <div className="space-y-4">
              {connections.map((connection) => (
                <SimpleTokenUpdater
                  key={connection.id}
                  connectionId={connection.id}
                  shopDomain={connection.shop_domain}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
