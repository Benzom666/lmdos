"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { OrderTemplateGenerator } from "@/components/order-template-generator"
import DeliveryMap from "@/components/delivery-map"
import { generateBulkLabels } from "@/lib/label-utils"
import {
  Package,
  Clock,
  CheckCircle,
  MapPin,
  Navigation,
  Search,
  AlertTriangle,
  Truck,
  Edit,
  Plus,
  Upload,
  Download,
  Trash2,
  UserCheck,
  RefreshCw,
  Printer,
  Store,
  ExternalLink,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OrdersList } from "@/components/admin/orders-list"

interface OrderWithActions extends Order {
  driver_name?: string
  shop_domain?: string
  shopify_order_number?: string
  is_shopify_order?: boolean
}

interface ShopifyConnection {
  id: string
  shop_domain: string
  is_active: boolean
  orders_synced: number
  last_sync: string
}

interface BulkUploadResult {
  imported: number
  total_processed: number
  validation_errors?: string[]
  insert_errors?: string[]
}

export default function AdminOrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [orders, setOrders] = useState<OrderWithActions[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [driverFilter, setDriverFilter] = useState("all")
  const [storeFilter, setStoreFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("all")
  const [showMap, setShowMap] = useState(false)
  const [mapOrders, setMapOrders] = useState<OrderWithActions[]>([])
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>([])
  const [shopifyConnections, setShopifyConnections] = useState<ShopifyConnection[]>([])

  // Bulk operations state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)

  useEffect(() => {
    if (profile) {
      fetchOrders()
      fetchDrivers()
      fetchShopifyConnections()

      // Set up real-time subscription for new orders
      const subscription = supabase
        .channel("orders_changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `created_by=eq.${profile.user_id}`,
          },
          (payload) => {
            console.log("🔔 New order received:", payload.new)
            fetchOrders() // Refresh orders list
            toast({
              title: "New Order Received",
              description: `Order ${payload.new.order_number} has been added`,
            })
          },
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [profile])

  const fetchShopifyConnections = async () => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from("shopify_connections")
        .select("id, shop_domain, is_active, orders_synced, last_sync")
        .eq("admin_id", profile.user_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      setShopifyConnections(data || [])
    } catch (error) {
      console.error("Error fetching Shopify connections:", error)
    }
  }

  const fetchDrivers = async () => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, user_id")
        .eq("role", "driver")
        .eq("admin_id", profile.user_id)

      if (error) throw error

      const driverList = (data || []).map((driver) => ({
        id: driver.user_id,
        name: `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || "Unknown Driver",
      }))

      setDrivers(driverList)
    } catch (error) {
      console.error("Error fetching drivers:", error)
    }
  }

  const fetchOrders = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // Fetch orders without trying to join with shopify_connections
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("created_by", profile.user_id)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Fetch shopify connections to get shop domains
      const { data: connectionsData, error: connectionsError } = await supabase
        .from("shopify_connections")
        .select("id, shop_domain")
        .eq("admin_id", profile.user_id)

      if (connectionsError) throw connectionsError

      // Create a map of connection_id to shop_domain
      const connectionMap = new Map()
      connectionsData?.forEach((connection) => {
        connectionMap.set(connection.id, connection.shop_domain)
      })

      // Fetch driver information
      const { data: driversData, error: driversError } = await supabase
        .from("user_profiles")
        .select("user_id, first_name, last_name")
        .eq("role", "driver")

      if (driversError) throw driversError

      // Create a map of driver_id to driver info
      const driverMap = new Map()
      driversData?.forEach((driver) => {
        driverMap.set(driver.user_id, `${driver.first_name || ""} ${driver.last_name || ""}`.trim())
      })

      // Combine orders with driver names and Shopify info
      const ordersWithDetails = (ordersData || []).map((order: any) => {
        const shopDomain = connectionMap.get(order.shopify_connection_id) || null

        return {
          ...order,
          driver_name: order.driver_id ? driverMap.get(order.driver_id) || "Unknown Driver" : "Unassigned",
          shop_domain: shopDomain,
          is_shopify_order: !!order.shopify_order_id,
          shopify_order_number: order.shopify_order_id ? `#${order.shopify_order_id}` : null,
        }
      })

      console.log(
        `📦 Loaded ${ordersWithDetails.length} orders (${ordersWithDetails.filter((o) => o.is_shopify_order).length} from Shopify)`,
      )
      setOrders(ordersWithDetails)
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Bulk file upload handler
  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    const formData = new FormData()
    formData.append("file", file)
    formData.append("adminId", profile.user_id)

    setUploadProgress(0)
    setUploadStatus("Uploading file...")
    setShowBulkUpload(true)
    setUploadResult(null)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch("/api/upload-orders", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      setUploadStatus("Upload completed successfully!")
      setUploadResult(result)

      toast({
        title: "Upload Successful",
        description: `${result.imported} orders imported successfully`,
      })

      // Refresh orders list
      await fetchOrders()
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus("Upload failed")
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload orders",
        variant: "destructive",
      })
    }

    // Reset file input
    event.target.value = ""
  }

  // Bulk actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentTabOrders = getOrdersByTab(activeTab)
      setSelectedOrders(new Set(currentTabOrders.map((order) => order.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders)
    if (checked) {
      newSelected.add(orderId)
    } else {
      newSelected.delete(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleBulkAssignDriver = async (driverId: string) => {
    if (selectedOrders.size === 0) return

    setBulkActionLoading(true)
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: driverId,
          status: "assigned",
          assigned_at: new Date().toISOString(),
        })
        .in("id", Array.from(selectedOrders))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedOrders.size} orders assigned to driver`,
      })

      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error("Bulk assign error:", error)
      toast({
        title: "Error",
        description: "Failed to assign orders to driver",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkStatusChange = async (status: string) => {
    if (selectedOrders.size === 0) return

    setBulkActionLoading(true)
    try {
      const { error } = await supabase.from("orders").update({ status }).in("id", Array.from(selectedOrders))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedOrders.size} orders updated to ${status}`,
      })

      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error("Bulk status change error:", error)
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedOrders.size} orders? This action cannot be undone.`)) {
      return
    }

    setBulkActionLoading(true)
    try {
      const { error } = await supabase.from("orders").delete().in("id", Array.from(selectedOrders))

      if (error) throw error

      toast({
        title: "Success",
        description: `${selectedOrders.size} orders deleted`,
      })

      setSelectedOrders(new Set())
      await fetchOrders()
    } catch (error) {
      console.error("Bulk delete error:", error)
      toast({
        title: "Error",
        description: "Failed to delete orders",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkPrintLabels = async () => {
    if (selectedOrders.size === 0) return

    setBulkActionLoading(true)
    try {
      const selectedOrdersArray = orders.filter((order) => selectedOrders.has(order.id))
      await generateBulkLabels(selectedOrdersArray, false)

      toast({
        title: "Success",
        description: `Printing ${selectedOrders.size} shipping labels`,
      })
    } catch (error) {
      console.error("Bulk print error:", error)
      toast({
        title: "Error",
        description: "Failed to print shipping labels",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDownloadLabels = async () => {
    if (selectedOrders.size === 0) return

    setBulkActionLoading(true)
    try {
      const selectedOrdersArray = orders.filter((order) => selectedOrders.has(order.id))
      await generateBulkLabels(selectedOrdersArray, true)

      toast({
        title: "Success",
        description: `Downloaded ${selectedOrders.size} shipping labels`,
      })
    } catch (error) {
      console.error("Bulk download error:", error)
      toast({
        title: "Error",
        description: "Failed to download shipping labels",
        variant: "destructive",
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  const exportSelectedOrders = () => {
    const currentTabOrders = getOrdersByTab(activeTab)
    const ordersToExport =
      selectedOrders.size > 0 ? currentTabOrders.filter((order) => selectedOrders.has(order.id)) : currentTabOrders

    const csvHeaders = [
      "Order Number",
      "Customer Name",
      "Customer Phone",
      "Customer Email",
      "Pickup Address",
      "Delivery Address",
      "Status",
      "Priority",
      "Driver",
      "Store",
      "Shopify Order",
      "Created Date",
    ]

    const csvData = ordersToExport.map((order) => [
      order.order_number,
      order.customer_name,
      order.customer_phone || "",
      order.customer_email || "",
      order.pickup_address,
      order.delivery_address,
      order.status,
      order.priority,
      order.driver_name || "Unassigned",
      order.shop_domain || "Manual",
      order.shopify_order_number || "N/A",
      new Date(order.created_at).toLocaleDateString(),
    ])

    const csvContent = [csvHeaders, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `orders-export-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: "Export Complete",
      description: `${ordersToExport.length} orders exported to CSV`,
    })
  }

  const viewOrdersOnMap = async () => {
    const currentTabOrders = getOrdersByTab(activeTab)
    const ordersToShow =
      selectedOrders.size > 0 ? currentTabOrders.filter((order) => selectedOrders.has(order.id)) : currentTabOrders

    if (ordersToShow.length === 0) {
      toast({
        title: "No Orders",
        description: "No orders to display on map.",
        variant: "destructive",
      })
      return
    }

    setMapOrders(ordersToShow)
    setShowMap(true)

    toast({
      title: "Map Loaded",
      description: `Displaying ${ordersToShow.length} orders on map`,
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-gray-50 text-gray-700 border-gray-200", icon: Clock, label: "Pending" },
      assigned: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, label: "Assigned" },
      in_transit: { color: "bg-orange-50 text-orange-700 border-orange-200", icon: Navigation, label: "In Transit" },
      delivered: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle, label: "Delivered" },
      failed: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, label: "Failed" },
      cancelled: { color: "bg-gray-50 text-gray-700 border-gray-200", icon: AlertTriangle, label: "Cancelled" },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: Package,
      label: status.replace("_", " "),
    }

    const Icon = config.icon

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: { color: "bg-red-100 text-red-800 border-red-200", label: "Urgent" },
      high: { color: "bg-orange-100 text-orange-800 border-orange-200", label: "High" },
      normal: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Normal" },
      low: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Low" },
    }

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal

    return (
      <Badge variant="outline" className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    )
  }

  const getStoreBadge = (order: OrderWithActions) => {
    if (order.is_shopify_order && order.shop_domain) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Store className="mr-1 h-3 w-3" />
          {order.shop_domain.split(".")[0]}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
        Manual
      </Badge>
    )
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.driver_name && order.driver_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.shop_domain && order.shop_domain.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter
    const matchesDriver = driverFilter === "all" || order.driver_id === driverFilter
    const matchesStore =
      storeFilter === "all" ||
      (storeFilter === "manual" && !order.is_shopify_order) ||
      (storeFilter === "shopify" && order.is_shopify_order) ||
      (order.shop_domain && order.shop_domain === storeFilter)

    return matchesSearch && matchesStatus && matchesPriority && matchesDriver && matchesStore
  })

  const getOrdersByTab = (tab: string) => {
    switch (tab) {
      case "active":
        return filteredOrders.filter((order) => !["delivered", "failed", "cancelled"].includes(order.status))
      case "completed":
        return filteredOrders.filter((order) => order.status === "delivered")
      case "failed":
        return filteredOrders.filter((order) => order.status === "failed")
      default:
        return filteredOrders
    }
  }

  const getTabCount = (tab: string) => {
    return getOrdersByTab(tab).length
  }

  const currentTabOrders = getOrdersByTab(activeTab)
  const allSelected = currentTabOrders.length > 0 && currentTabOrders.every((order) => selectedOrders.has(order.id))
  const someSelected = currentTabOrders.some((order) => selectedOrders.has(order.id))

  if (!profile) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Multi-Store Order Management</h1>
            <p className="text-muted-foreground">
              Manage orders from {shopifyConnections.length} connected Shopify stores and manual orders
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/admin/integrations")} variant="outline">
              <Store className="mr-2 h-4 w-4" />
              Manage Stores
            </Button>
            <Button onClick={viewOrdersOnMap} variant="outline">
              <MapPin className="mr-2 h-4 w-4" />
              View on Map
            </Button>
            <Button onClick={() => router.push("/admin/orders/create")}>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        {/* Shopify Stores Overview */}
        {shopifyConnections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Connected Shopify Stores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shopifyConnections.map((connection) => (
                  <div key={connection.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{connection.shop_domain}</h4>
                      <Badge variant={connection.is_active ? "default" : "secondary"}>
                        {connection.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Orders synced: {connection.orders_synced || 0}</p>
                      <p>
                        Last sync:{" "}
                        {connection.last_sync ? new Date(connection.last_sync).toLocaleDateString() : "Never"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => window.open(`https://${connection.shop_domain}/admin`, "_blank")}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Open Store
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk Upload Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Bulk Operations</h3>
                  <p className="text-sm text-muted-foreground">Upload multiple orders or perform bulk actions</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleBulkUpload}
                    className="hidden"
                    id="bulk-upload"
                  />
                  <Button variant="outline" onClick={() => document.getElementById("bulk-upload")?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Orders
                  </Button>
                  <Button variant="outline" onClick={exportSelectedOrders}>
                    <Download className="mr-2 h-4 w-4" />
                    Export {selectedOrders.size > 0 ? `(${selectedOrders.size})` : "All"}
                  </Button>
                </div>
              </div>

              {/* Upload Progress */}
              {showBulkUpload && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{uploadStatus}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />

                  {uploadResult && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-medium text-green-900">Upload Results</h4>
                      <div className="mt-2 text-sm text-green-700">
                        <p>✅ {uploadResult.imported} orders imported successfully</p>
                        <p>📊 {uploadResult.total_processed} total orders processed</p>
                        {uploadResult.validation_errors && uploadResult.validation_errors.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-red-600">
                              ⚠️ {uploadResult.validation_errors.length} validation errors
                            </summary>
                            <ul className="mt-1 ml-4 list-disc text-red-600">
                              {uploadResult.validation_errors.slice(0, 5).map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                              {uploadResult.validation_errors.length > 5 && (
                                <li>... and {uploadResult.validation_errors.length - 5} more</li>
                              )}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bulk Actions */}
              {selectedOrders.size > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">{selectedOrders.size} orders selected</span>
                  <div className="flex gap-2 ml-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={bulkActionLoading}>
                          <UserCheck className="mr-2 h-4 w-4" />
                          Assign Driver
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Select Driver</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {drivers.map((driver) => (
                          <DropdownMenuItem key={driver.id} onClick={() => handleBulkAssignDriver(driver.id)}>
                            {driver.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={bulkActionLoading}>
                          <Edit className="mr-2 h-4 w-4" />
                          Change Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Select Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("pending")}>Pending</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("assigned")}>Assigned</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("in_transit")}>
                          In Transit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("delivered")}>
                          Delivered
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("failed")}>Failed</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("cancelled")}>
                          Cancelled
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={bulkActionLoading}>
                          <Printer className="mr-2 h-4 w-4" />
                          Labels
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Shipping Labels</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleBulkPrintLabels}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print Labels
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleBulkDownloadLabels}>
                          <Download className="mr-2 h-4 w-4" />
                          Download Labels (PDF)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={bulkActionLoading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Template Generator */}
        <OrderTemplateGenerator />

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search orders by number, customer, address, driver, or store..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    <SelectItem value="manual">Manual Orders</SelectItem>
                    <SelectItem value="shopify">Shopify Orders</SelectItem>
                    {shopifyConnections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.shop_domain}>
                        {connection.shop_domain.split(".")[0]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchOrders}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              All ({getTabCount("all")})
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Active ({getTabCount("active")})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed ({getTabCount("completed")})
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Failed ({getTabCount("failed")})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("all")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getStoreBadge={getStoreBadge}
              onBulkAssignDriver={handleBulkAssignDriver}
              onBulkDelete={handleBulkDelete}
              router={router}
            />
          </TabsContent>

          <TabsContent value="active" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("active")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getStoreBadge={getStoreBadge}
              onBulkAssignDriver={handleBulkAssignDriver}
              onBulkDelete={handleBulkDelete}
              router={router}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("completed")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getStoreBadge={getStoreBadge}
              onBulkAssignDriver={handleBulkAssignDriver}
              onBulkDelete={handleBulkDelete}
              router={router}
            />
          </TabsContent>

          <TabsContent value="failed" className="mt-6">
            <OrdersList
              orders={getOrdersByTab("failed")}
              loading={loading}
              selectedOrders={selectedOrders}
              onSelectAll={handleSelectAll}
              onSelectOrder={handleSelectOrder}
              allSelected={allSelected}
              someSelected={someSelected}
              getStatusBadge={getStatusBadge}
              getPriorityBadge={getPriorityBadge}
              getStoreBadge={getStoreBadge}
              onBulkAssignDriver={handleBulkAssignDriver}
              onBulkDelete={handleBulkDelete}
              router={router}
            />
          </TabsContent>
        </Tabs>

        {/* Delivery Map Modal */}
        {showMap && (
          <DeliveryMap
            orders={mapOrders.map((order) => ({
              id: order.id,
              order_number: order.order_number,
              customer_name: order.customer_name,
              delivery_address: order.delivery_address,
              priority: order.priority,
              status: order.status,
            }))}
            driverLocation={null}
            onClose={() => setShowMap(false)}
            isOptimized={false}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
