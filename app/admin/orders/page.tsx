"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Package,
  Search,
  Download,
  Upload,
  Trash2,
  UserPlus,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Edit,
  MapPin,
  Route,
  Printer,
  Settings,
  Warehouse,
  Navigation,
  Target,
  Zap,
} from "lucide-react"
import { MapboxMap } from "@/components/mapbox-map"

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  status: string
  driver_id?: string
  created_by: string
  created_at: string
  updated_at: string
  delivery_window_start?: string
  delivery_window_end?: string
  special_requirements?: string
  package_weight?: number
  shopify_order_id?: string
  shopify_order_number?: string
  coordinates?: [number, number]
}

interface Driver {
  id: string
  user_id: string
  name: string
  email: string
  phone: string
  status: string
  created_by: string
  admin_id?: string
}

interface RouteZone {
  id: string
  name: string
  color: string
  orders: Order[]
  center: [number, number]
  radius: number
  estimatedTime: number
  totalDistance: number
}

interface OptimizationSettings {
  warehouseLocation: [number, number]
  warehouseName: string
  maxZones: number
  maxOrdersPerZone: number
  optimizationMethod: "distance" | "time" | "hybrid"
  considerTraffic: boolean
  considerPriority: boolean
  considerTimeWindows: boolean
  vehicleCapacity: number
  workingHours: {
    start: string
    end: string
  }
}

export default function OrdersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  // State management
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [driversLoading, setDriversLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState("all")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [routeZones, setRouteZones] = useState<RouteZone[]>([])
  const [optimizingRoutes, setOptimizingRoutes] = useState(false)
  const [showOptimizationSettings, setShowOptimizationSettings] = useState(false)
  const [optimizedRoute, setOptimizedRoute] = useState<[number, number][] | null>(null)

  // Optimization settings with Toronto warehouse as default
  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>({
    warehouseLocation: [43.6532, -79.3832], // Toronto downtown
    warehouseName: "Main Warehouse",
    maxZones: 5,
    maxOrdersPerZone: 10,
    optimizationMethod: "hybrid",
    considerTraffic: true,
    considerPriority: true,
    considerTimeWindows: true,
    vehicleCapacity: 50,
    workingHours: {
      start: "08:00",
      end: "18:00",
    },
  })

  // Fetch data
  useEffect(() => {
    if (profile) {
      fetchOrders()
      fetchDrivers()
    }
  }, [profile])

  const fetchOrders = async () => {
    if (!profile) return

    try {
      console.log("🔍 Fetching orders for admin:", profile.user_id)

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("created_by", profile.user_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Add mock coordinates to orders
      const ordersWithCoordinates =
        data?.map((order) => ({
          ...order,
          coordinates: generateOrderCoordinates(order.id),
        })) || []

      console.log(`📦 Loaded ${ordersWithCoordinates?.length || 0} orders`)
      setOrders(ordersWithCoordinates)
    } catch (error) {
      console.error("❌ Error fetching orders:", error)
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchDrivers = async () => {
    if (!profile) return

    setDriversLoading(true)
    try {
      console.log("🔍 Fetching drivers for admin:", profile.user_id)

      // SECURITY FIX: Only get drivers that belong to this admin
      const { data: driversData, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .or(`created_by.eq.${profile.user_id},admin_id.eq.${profile.user_id}`)

      if (error) {
        console.error("❌ Error fetching drivers:", error)
        throw error
      }

      console.log(`👥 Found ${driversData?.length || 0} drivers for admin ${profile.user_id}`)

      // Format driver data
      const formattedDrivers: Driver[] = (driversData || []).map((driver) => ({
        id: driver.id,
        user_id: driver.user_id,
        name:
          `${driver.first_name || ""} ${driver.last_name || ""}`.trim() ||
          driver.email?.split("@")[0] ||
          "Unknown Driver",
        email: driver.email || "N/A",
        phone: driver.phone || "N/A",
        status: driver.status || "active",
        created_by: driver.created_by,
        admin_id: driver.admin_id,
      }))

      setDrivers(formattedDrivers)

      if (formattedDrivers.length === 0) {
        console.log("⚠️ No drivers found for this admin")
      } else {
        console.log(`✅ Successfully loaded ${formattedDrivers.length} drivers`)
      }
    } catch (error) {
      console.error("❌ Error fetching drivers:", error)
      toast({
        title: "Error",
        description: "Failed to load drivers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDriversLoading(false)
    }
  }

  // Filter orders based on search and filters
  const filteredOrders = useMemo(() => {
    let filtered = orders

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((order) => order.priority === priorityFilter)
    }

    // Tab filter
    // switch (activeTab) {
    //   case "active":
    //     filtered = filtered.filter((order) => ["pending", "assigned", "in_transit"].includes(order.status))
    //     break
    //   case "completed":
    //     filtered = filtered.filter((order) => order.status === "delivered")
    //     break
    //   case "failed":
    //     filtered = filtered.filter((order) => order.status === "failed")
    //     break
    // }

    return filtered
  }, [orders, searchTerm, statusFilter, priorityFilter, activeTab])

  // Advanced route optimization algorithm
  const optimizeRoutesAdvanced = async () => {
    if (selectedOrders.size === 0) {
      toast({
        title: "No Orders Selected",
        description: "Please select orders to optimize routes.",
        variant: "destructive",
      })
      return
    }

    setOptimizingRoutes(true)

    try {
      const selectedOrdersList = filteredOrders.filter((order) => selectedOrders.has(order.id))
      console.log(`🚀 Starting route optimization for ${selectedOrdersList.length} orders`)

      // Step 1: Generate coordinates for orders (in real app, this would be geocoded)
      const ordersWithCoords = selectedOrdersList.map((order) => ({
        ...order,
        coordinates: generateOrderCoordinates(order.id),
      }))

      // Step 2: Prepare waypoints for Mapbox Optimization API
      const waypoints = ordersWithCoords.map((order) => ({
        longitude: order.coordinates![1],
        latitude: order.coordinates![0],
      }))

      // Step 3: Call Mapbox Optimization API
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      const optimizationUrl = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${waypoints
        .map((wp) => `${wp.longitude},${wp.latitude}`)
        .join(
          ";",
        )}?source=first&destination=last&roundtrip=false&steps=true&geometries=geojson&access_token=${accessToken}`

      const response = await fetch(optimizationUrl)
      const data = await response.json()

      if (data.code !== "Ok") {
        console.error("Mapbox Optimization API error:", data.code, data.message)
        toast({
          title: "Route Optimization Failed",
          description: `Mapbox API error: ${data.code} - ${data.message}`,
          variant: "destructive",
        })
        return
      }

      // Step 4: Extract optimized route coordinates and order
      const optimizedCoordinates = data.trips[0].geometry.coordinates
      const optimizedOrder = data.trips[0].legs.map((leg: any) => leg.summary)

      console.log("✅ Route optimization completed")
      console.log("   - Optimized order:", optimizedOrder)
      console.log("   - Total distance:", data.trips[0].distance)
      console.log("   - Total duration:", data.trips[0].duration)

      // Step 5: Update state with optimized route and order
      setOptimizedRoute(optimizedCoordinates)

      toast({
        title: "Routes Optimized Successfully!",
        description: `Optimized route for ${selectedOrdersList.length} orders. Total distance: ${
          data.trips[0].distance
        }m, Est. time: ${data.trips[0].duration}s`,
      })
    } catch (error) {
      console.error("❌ Route optimization error:", error)
      toast({
        title: "Optimization Failed",
        description: "Failed to optimize routes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setOptimizingRoutes(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(new Set(filteredOrders.map((order) => order.id)))
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

  const handleBulkAssign = async (driverId: string) => {
    if (selectedOrders.size === 0) return

    try {
      const selectedOrderIds = Array.from(selectedOrders)
      const driver = drivers.find((d) => d.user_id === driverId)

      for (const orderId of selectedOrderIds) {
        const { error } = await supabase
          .from("orders")
          .update({
            driver_id: driverId,
            status: "assigned",
            assigned_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        if (error) throw error
      }

      toast({
        title: "Success",
        description: `Assigned ${selectedOrderIds.length} orders to ${driver?.name || "driver"}.`,
      })

      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error("Error bulk assigning orders:", error)
      toast({
        title: "Error",
        description: "Failed to assign orders. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedOrders.size === 0) return

    try {
      const selectedOrderIds = Array.from(selectedOrders)

      for (const orderId of selectedOrderIds) {
        const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId)
        if (error) throw error
      }

      toast({
        title: "Success",
        description: `Updated ${selectedOrderIds.length} orders to ${newStatus}.`,
      })

      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Error",
        description: "Failed to update orders. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) return

    try {
      const selectedOrderIds = Array.from(selectedOrders)

      for (const orderId of selectedOrderIds) {
        const { error } = await supabase.from("orders").delete().eq("id", orderId)
        if (error) throw error
      }

      toast({
        title: "Success",
        description: `Deleted ${selectedOrderIds.length} orders.`,
      })

      setSelectedOrders(new Set())
      setShowDeleteDialog(false)
      fetchOrders()
    } catch (error) {
      console.error("Error deleting orders:", error)
      toast({
        title: "Error",
        description: "Failed to delete orders. Please try again.",
        variant: "destructive",
      })
    }
  }

  const exportOrders = () => {
    const selectedOrdersList =
      selectedOrders.size > 0 ? filteredOrders.filter((order) => selectedOrders.has(order.id)) : filteredOrders

    const csv = [
      "Order Number,Customer Name,Email,Phone,Address,Priority,Status,Created At",
      ...selectedOrdersList.map(
        (order) =>
          `${order.order_number},${order.customer_name},${order.customer_email},${order.customer_phone},"${order.delivery_address}",${order.priority},${order.status},${order.created_at}`,
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Get order counts for tabs
  const orderCounts = {
    all: orders.length,
    active: orders.filter((o) => ["pending", "assigned", "in_transit"].includes(o.status)).length,
    completed: orders.filter((o) => o.status === "delivered").length,
    failed: orders.filter((o) => o.status === "failed").length,
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
      assigned: { color: "bg-blue-100 text-blue-800", icon: UserPlus },
      in_transit: { color: "bg-purple-100 text-purple-800", icon: Package },
      delivered: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      failed: { color: "bg-red-100 text-red-800", icon: AlertCircle },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: "bg-red-100 text-red-800",
      high: "bg-orange-100 text-orange-800",
      normal: "bg-blue-100 text-blue-800",
      low: "bg-gray-100 text-gray-800",
    }

    return (
      <Badge className={priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal}>
        {priority}
      </Badge>
    )
  }

  // Prepare orders for map display
  const ordersForMap = filteredOrders.map((order) => ({
    id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    delivery_address: order.delivery_address,
    priority: order.priority || "normal",
    status: order.status,
    coordinates: order.coordinates,
  }))

  if (!profile) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Orders Management</h1>
            <p className="text-muted-foreground">Manage and track all delivery orders</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportOrders}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Driver Status Alert */}
        {driversLoading ? (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                <div>
                  <h3 className="font-medium text-blue-800">Loading Drivers...</h3>
                  <p className="text-sm text-blue-700">Fetching available drivers for order assignment.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : drivers.length > 0 ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-800">Drivers Available</h3>
                  <p className="text-sm text-green-700">
                    {drivers.length} driver{drivers.length !== 1 ? "s" : ""} ready to receive order assignments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-medium text-orange-800">No Drivers Available</h3>
                  <p className="text-sm text-orange-700">
                    No drivers found. Please add drivers before assigning orders.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connected Shopify Stores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Connected Shopify Stores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">deliveryos.myshopify.com</h4>
                  <p className="text-sm text-muted-foreground">Last sync: 2 minutes ago</p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders by number, customer, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={priorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          {[
            { key: "all", label: "All", count: orderCounts.all },
            { key: "active", label: "Active", count: orderCounts.active },
            { key: "completed", label: "Completed", count: orderCounts.completed },
            { key: "failed", label: "Failed", count: orderCounts.failed },
          ].map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2"
            >
              {tab.label}
              <Badge variant="secondary" className="text-xs">
                {tab.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedOrders.size > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-800">{selectedOrders.size} orders selected</span>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" disabled={drivers.length === 0}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Assign Driver {drivers.length === 0 && "(No drivers)"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {drivers.length === 0 ? (
                          <DropdownMenuItem disabled>No drivers available</DropdownMenuItem>
                        ) : (
                          drivers.map((driver) => (
                            <DropdownMenuItem key={driver.user_id} onClick={() => handleBulkAssign(driver.user_id)}>
                              <div className="flex flex-col">
                                <span className="font-medium">{driver.name}</span>
                                <span className="text-xs text-muted-foreground">{driver.email}</span>
                              </div>
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Package className="h-4 w-4 mr-2" />
                          Change Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("pending")}>Pending</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("assigned")}>Assigned</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("in_transit")}>
                          In Transit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkStatusChange("delivered")}>
                          Delivered
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Dialog open={showOptimizationSettings} onOpenChange={setShowOptimizationSettings}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4 mr-2" />
                          Optimization Settings
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Warehouse className="h-5 w-5" />
                            Route Optimization Settings
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Warehouse Settings */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-medium flex items-center gap-2">
                              <Warehouse className="h-4 w-4" />
                              Warehouse Configuration
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="warehouse-name">Warehouse Name</Label>
                                <Input
                                  id="warehouse-name"
                                  value={optimizationSettings.warehouseName}
                                  onChange={(e) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      warehouseName: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Warehouse Location</Label>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Latitude"
                                    value={optimizationSettings.warehouseLocation[0]}
                                    onChange={(e) =>
                                      setOptimizationSettings({
                                        ...optimizationSettings,
                                        warehouseLocation: [
                                          Number.parseFloat(e.target.value) || 43.6532,
                                          optimizationSettings.warehouseLocation[1],
                                        ],
                                      })
                                    }
                                  />
                                  <Input
                                    placeholder="Longitude"
                                    value={optimizationSettings.warehouseLocation[1]}
                                    onChange={(e) =>
                                      setOptimizationSettings({
                                        ...optimizationSettings,
                                        warehouseLocation: [
                                          optimizationSettings.warehouseLocation[0],
                                          Number.parseFloat(e.target.value) || -79.3832,
                                        ],
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Zone Settings */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-medium flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              Zone Configuration
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Maximum Zones: {optimizationSettings.maxZones}</Label>
                                <Slider
                                  value={[optimizationSettings.maxZones]}
                                  onValueChange={([value]) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      maxZones: value,
                                    })
                                  }
                                  max={10}
                                  min={1}
                                  step={1}
                                  className="mt-2"
                                />
                              </div>
                              <div>
                                <Label>Orders per Zone: {optimizationSettings.maxOrdersPerZone}</Label>
                                <Slider
                                  value={[optimizationSettings.maxOrdersPerZone]}
                                  onValueChange={([value]) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      maxOrdersPerZone: value,
                                    })
                                  }
                                  max={20}
                                  min={5}
                                  step={1}
                                  className="mt-2"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Optimization Method */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-medium flex items-center gap-2">
                              <Navigation className="h-4 w-4" />
                              Optimization Method
                            </h3>
                            <Select
                              value={optimizationSettings.optimizationMethod}
                              onValueChange={(value: "distance" | "time" | "hybrid") =>
                                setOptimizationSettings({
                                  ...optimizationSettings,
                                  optimizationMethod: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="distance">Distance Optimization</SelectItem>
                                <SelectItem value="time">Time Optimization</SelectItem>
                                <SelectItem value="hybrid">Hybrid (Distance + Time)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Advanced Options */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-medium">Advanced Options</h3>
                            <div className="space-y-3">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="consider-traffic"
                                  checked={optimizationSettings.considerTraffic}
                                  onCheckedChange={(checked) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      considerTraffic: checked as boolean,
                                    })
                                  }
                                />
                                <Label htmlFor="consider-traffic">Consider Traffic Conditions</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="consider-priority"
                                  checked={optimizationSettings.considerPriority}
                                  onCheckedChange={(checked) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      considerPriority: checked as boolean,
                                    })
                                  }
                                />
                                <Label htmlFor="consider-priority">Prioritize Urgent Orders</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="consider-time-windows"
                                  checked={optimizationSettings.considerTimeWindows}
                                  onCheckedChange={(checked) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      considerTimeWindows: checked as boolean,
                                    })
                                  }
                                />
                                <Label htmlFor="consider-time-windows">Respect Delivery Time Windows</Label>
                              </div>
                            </div>
                          </div>

                          {/* Working Hours */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-medium">Working Hours</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="start-time">Start Time</Label>
                                <Input
                                  id="start-time"
                                  type="time"
                                  value={optimizationSettings.workingHours.start}
                                  onChange={(e) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      workingHours: {
                                        ...optimizationSettings.workingHours,
                                        start: e.target.value,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label htmlFor="end-time">End Time</Label>
                                <Input
                                  id="end-time"
                                  type="time"
                                  value={optimizationSettings.workingHours.end}
                                  onChange={(e) =>
                                    setOptimizationSettings({
                                      ...optimizationSettings,
                                      workingHours: {
                                        ...optimizationSettings.workingHours,
                                        end: e.target.value,
                                      },
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button size="sm" variant="outline" onClick={optimizeRoutesAdvanced} disabled={optimizingRoutes}>
                      <Zap className={`h-4 w-4 mr-2 ${optimizingRoutes ? "animate-spin" : ""}`} />
                      {optimizingRoutes ? "Optimizing..." : "Optimize Routes"}
                    </Button>

                    <Button size="sm" variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Print Labels
                    </Button>

                    <Button size="sm" variant="outline" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedOrders(new Set())}>
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders List and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Orders ({filteredOrders.length})</span>
                <Button variant="outline" size="sm" onClick={fetchOrders}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOrders.length > 0 ? (
                <div className="space-y-4">
                  {/* Select All */}
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox
                      checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium">Select All</span>
                  </div>

                  {/* Orders */}
                  <div className="max-h-[600px] overflow-y-auto space-y-3">
                    {filteredOrders.map((order) => (
                      <div
                        key={order.id}
                        className={`p-4 border rounded-lg transition-colors ${
                          selectedOrders.has(order.id) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedOrders.has(order.id)}
                            onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">#{order.order_number}</h4>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => router.push(`/admin/orders/${order.id}`)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Order
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Printer className="h-4 w-4 mr-2" />
                                    Print Label
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <p className="text-sm text-muted-foreground mb-1">Customer: {order.customer_name}</p>
                            <p className="text-xs text-muted-foreground mb-2">Address: {order.delivery_address}</p>

                            <div className="flex items-center gap-2 mb-2">
                              {getStatusBadge(order.status)}
                              {getPriorityBadge(order.priority)}
                            </div>

                            {order.driver_id && (
                              <p className="text-xs text-muted-foreground">
                                Driver: {drivers.find((d) => d.user_id === order.driver_id)?.name || "Unknown"}
                              </p>
                            )}

                            <p className="text-xs text-muted-foreground">
                              Created: {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                      ? "No orders match your current filters."
                      : "No orders have been created yet."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Orders Map
                {routeZones.length > 0 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <Route className="h-3 w-3 mr-1" />
                    {routeZones.length} zones optimized
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MapboxMap
                orders={ordersForMap}
                routeZones={routeZones}
                optimizedRoute={optimizedRoute}
                warehouseLocation={optimizationSettings.warehouseLocation}
                warehouseName={optimizationSettings.warehouseName}
                title="Orders Overview"
                height="500px"
                onOrderClick={(orderId) => {
                  router.push(`/admin/orders/${orderId}`)
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Route Zones Summary */}
        {routeZones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Optimized Route Zones
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  <Warehouse className="h-3 w-3 mr-1" />
                  Starting from {optimizationSettings.warehouseName}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {routeZones.map((zone, index) => (
                  <div key={zone.id} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: zone.color }} />
                      <h4 className="font-medium">{zone.name}</h4>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex justify-between">
                        <span>Orders:</span>
                        <span className="font-medium">{zone.orders.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Distance:</span>
                        <span className="font-medium">{zone.totalDistance}km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Est. Time:</span>
                        <span className="font-medium">
                          {Math.floor(zone.estimatedTime / 60)}h {zone.estimatedTime % 60}m
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Route:</span>
                        <span className="font-medium text-xs">
                          Warehouse →{" "}
                          {zone.orders
                            .slice(0, 2)
                            .map((o) => `#${o.order_number}`)
                            .join(" → ")}
                          {zone.orders.length > 2 && ` → +${zone.orders.length - 2} more`} → Warehouse
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" disabled={drivers.length === 0}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Assign Driver
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {drivers.length === 0 ? (
                            <DropdownMenuItem disabled>No drivers available</DropdownMenuItem>
                          ) : (
                            drivers.map((driver) => (
                              <DropdownMenuItem
                                key={driver.user_id}
                                onClick={async () => {
                                  // Assign all orders in this zone to the driver
                                  try {
                                    for (const order of zone.orders) {
                                      await supabase
                                        .from("orders")
                                        .update({
                                          driver_id: driver.user_id,
                                          status: "assigned",
                                          assigned_at: new Date().toISOString(),
                                        })
                                        .eq("id", order.id)
                                    }

                                    toast({
                                      title: "Zone Assigned Successfully!",
                                      description: `Assigned ${zone.orders.length} orders in ${zone.name} to ${driver.name}. Route: ${zone.totalDistance}km, ${Math.floor(zone.estimatedTime / 60)}h ${zone.estimatedTime % 60}m`,
                                    })

                                    fetchOrders()
                                  } catch (error) {
                                    console.error("Error assigning zone:", error)
                                    toast({
                                      title: "Assignment Failed",
                                      description: "Failed to assign zone to driver.",
                                      variant: "destructive",
                                    })
                                  }
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{driver.name}</span>
                                  <span className="text-xs text-muted-foreground">{driver.email}</span>
                                </div>
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button size="sm" variant="outline">
                        <Navigation className="h-4 w-4 mr-2" />
                        View Route
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Optimization Summary */}
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Optimization Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-green-600">Total Orders:</span>
                    <span className="font-medium ml-2">
                      {routeZones.reduce((sum, zone) => sum + zone.orders.length, 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600">Total Distance:</span>
                    <span className="font-medium ml-2">
                      {routeZones.reduce((sum, zone) => sum + zone.totalDistance, 0).toFixed(1)}km
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600">Total Time:</span>
                    <span className="font-medium ml-2">
                      {Math.floor(routeZones.reduce((sum, zone) => sum + zone.estimatedTime, 0) / 60)}h{" "}
                      {routeZones.reduce((sum, zone) => sum + zone.estimatedTime, 0) % 60}m
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600">Zones Created:</span>
                    <span className="font-medium ml-2">{routeZones.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrders.size} selected orders? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">
              Delete Orders
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

// Function to generate mock coordinates for orders
function generateOrderCoordinates(orderId: string): [number, number] {
  // Use a hash function to generate consistent coordinates based on the order ID
  let hash = 0
  for (let i = 0; i < orderId.length; i++) {
    hash = (hash << 5) - hash + orderId.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }

  // Use the hash to generate latitude and longitude offsets
  const latOffset = (hash % 1000) / 10000 // Latitude offset between -0.05 and 0.05
  const lngOffset = (hash % 1000) / 10000 // Longitude offset between -0.05 and 0.05

  // Base coordinates (e.g., downtown Toronto)
  const baseLatitude = 43.6532
  const baseLongitude = -79.3832

  // Generate the final coordinates
  const latitude = baseLatitude + latOffset
  const longitude = baseLongitude + lngOffset

  return [latitude, longitude]
}
