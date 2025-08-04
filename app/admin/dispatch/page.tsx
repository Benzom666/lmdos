"use client"

import { useState, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Search, RefreshCw, Package, Truck, Navigation, AlertCircle, CheckCircle, Eye } from "lucide-react"
import { MapboxMap } from "@/components/mapbox-map"

interface Driver {
  id: string
  user_id: string
  name: string
  email: string
  phone: string
  status: string
  created_by: string
  admin_id?: string
  assigned_orders: number
  in_transit_orders: number
  delivered_orders: number
  last_seen?: string
  current_location?: [number, number]
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  status: string
  driver_id?: string
  created_at: string
  coordinates?: [number, number]
}

interface DispatchZone {
  id: string
  name: string
  bounds: [number, number, number, number] // [minLat, minLng, maxLat, maxLng]
  drivers: Driver[]
  orders: Order[]
  color: string
}

export default function DispatchPage() {
  const { profile } = useAuth()
  const { toast } = useToast()

  // State management
  const [activeDrivers, setActiveDrivers] = useState<Driver[]>([])
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([])
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedZone, setSelectedZone] = useState("all")
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Dispatch zones for GTA
  const dispatchZones: DispatchZone[] = [
    {
      id: "downtown",
      name: "Downtown Toronto",
      bounds: [43.62, -79.42, 43.68, -79.36],
      drivers: [],
      orders: [],
      color: "#3b82f6",
    },
    {
      id: "north_york",
      name: "North York",
      bounds: [43.7, -79.45, 43.78, -79.35],
      drivers: [],
      orders: [],
      color: "#10b981",
    },
    {
      id: "scarborough",
      name: "Scarborough",
      bounds: [43.7, -79.35, 43.8, -79.15],
      drivers: [],
      orders: [],
      color: "#f59e0b",
    },
    {
      id: "etobicoke",
      name: "Etobicoke",
      bounds: [43.6, -79.6, 43.72, -79.45],
      drivers: [],
      orders: [],
      color: "#8b5cf6",
    },
  ]

  // Fetch data on component mount and set up real-time updates
  useEffect(() => {
    if (profile) {
      fetchDispatchData()

      // Set up real-time updates every 30 seconds
      const interval = setInterval(() => {
        fetchDispatchData()
      }, 30000)

      setRefreshInterval(interval)

      return () => {
        if (interval) clearInterval(interval)
      }
    }
  }, [profile])

  const fetchDispatchData = async () => {
    if (!profile) return

    try {
      console.log("🔄 Fetching dispatch data for admin:", profile.user_id)

      // Fetch all orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("created_by", profile.user_id)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Fetch drivers with order counts
      const { data: driversData, error: driversError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .or(`created_by.eq.${profile.user_id},admin_id.eq.${profile.user_id}`)

      if (driversError) throw driversError

      console.log(`📦 Loaded ${ordersData?.length || 0} orders`)
      console.log(`👥 Found ${driversData?.length || 0} drivers`)

      // Process orders
      const orders: Order[] = (ordersData || []).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        delivery_address: order.delivery_address,
        priority: order.priority || "normal",
        status: order.status,
        driver_id: order.driver_id,
        created_at: order.created_at,
        coordinates: order.coordinates ? [order.coordinates[0], order.coordinates[1]] : undefined,
      }))

      // Process drivers with order statistics
      const driversWithStats: Driver[] = await Promise.all(
        (driversData || []).map(async (driver) => {
          // Count orders for this driver
          const driverOrders = orders.filter((order) => order.driver_id === driver.user_id)
          const assignedOrders = driverOrders.filter((order) => order.status === "assigned").length
          const inTransitOrders = driverOrders.filter((order) => order.status === "in_transit").length
          const deliveredOrders = driverOrders.filter((order) => order.status === "delivered").length

          return {
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
            assigned_orders: assignedOrders,
            in_transit_orders: inTransitOrders,
            delivered_orders: deliveredOrders,
            last_seen: driver.last_seen || new Date().toISOString(),
            current_location: driver.current_location || [
              43.6532 + (Math.random() - 0.5) * 0.1,
              -79.3832 + (Math.random() - 0.5) * 0.1,
            ],
          }
        }),
      )

      // Filter active drivers (those with 1+ orders)
      const activeDriversList = driversWithStats.filter(
        (driver) => driver.assigned_orders > 0 || driver.in_transit_orders > 0,
      )

      // Get unassigned orders
      const unassignedOrdersList = orders.filter((order) => !order.driver_id && order.status === "pending")

      setActiveDrivers(activeDriversList)
      setUnassignedOrders(unassignedOrdersList)
      setAllOrders(orders)
      setLastUpdate(new Date())

      console.log(
        `✅ Dispatch data updated: ${activeDriversList.length} active drivers, ${unassignedOrdersList.length} unassigned orders`,
      )
    } catch (error) {
      console.error("❌ Error fetching dispatch data:", error)
      toast({
        title: "Error",
        description: "Failed to load dispatch data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Filter drivers based on search and zone
  const filteredDrivers = useMemo(() => {
    let filtered = activeDrivers

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (driver) =>
          driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.email.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Zone filter (simplified - in real implementation, you'd check driver location against zone bounds)
    if (selectedZone !== "all") {
      // For demo purposes, randomly assign drivers to zones
      filtered = filtered.filter((_, index) => {
        const zoneIndex = index % dispatchZones.length
        return dispatchZones[zoneIndex].id === selectedZone
      })
    }

    return filtered
  }, [activeDrivers, searchTerm, selectedZone])

  const handleAssignOrder = async (orderId: string, driverId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: driverId,
          status: "assigned",
          assigned_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      if (error) throw error

      const driver = activeDrivers.find((d) => d.user_id === driverId)
      const order = unassignedOrders.find((o) => o.id === orderId)

      toast({
        title: "Order Assigned",
        description: `Order #${order?.order_number} assigned to ${driver?.name}`,
      })

      // Refresh data
      fetchDispatchData()
    } catch (error) {
      console.error("Error assigning order:", error)
      toast({
        title: "Error",
        description: "Failed to assign order. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getDriverStatusBadge = (driver: Driver) => {
    const totalActiveOrders = driver.assigned_orders + driver.in_transit_orders

    if (totalActiveOrders === 0) {
      return <Badge className="bg-gray-100 text-gray-800">Available</Badge>
    } else if (totalActiveOrders <= 3) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>
    } else if (totalActiveOrders <= 6) {
      return <Badge className="bg-yellow-100 text-yellow-800">Busy</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800">Overloaded</Badge>
    }
  }

  // Prepare data for map
  const driverLocations = filteredDrivers.map((driver) => ({
    id: driver.user_id,
    name: driver.name,
    location: driver.current_location || [43.6532, -79.3832],
    orders: driver.assigned_orders + driver.in_transit_orders,
    status: driver.status,
    last_seen: driver.last_seen || new Date().toISOString(),
  }))

  const ordersForMap = allOrders
    .filter((order) => order.coordinates)
    .map((order) => ({
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      delivery_address: order.delivery_address,
      priority: order.priority,
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
            <h1 className="text-2xl font-bold">Live Dispatch Center</h1>
            <p className="text-muted-foreground">
              Real-time driver tracking and order assignment with route optimization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <RefreshCw className="h-3 w-3 mr-1" />
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Badge>
            <Button onClick={fetchDispatchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeDrivers.length}</div>
              <p className="text-xs text-muted-foreground">
                {activeDrivers.filter((d) => d.assigned_orders > 0).length} with assigned orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unassigned Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{unassignedOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                {unassignedOrders.filter((o) => o.priority === "urgent").length} urgent priority
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {activeDrivers.reduce((sum, driver) => sum + driver.in_transit_orders, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Orders being delivered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {activeDrivers.reduce((sum, driver) => sum + driver.delivered_orders, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Successfully delivered</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {dispatchZones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Drivers List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Active Drivers ({filteredDrivers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDrivers.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {filteredDrivers.map((driver) => (
                    <div key={driver.user_id} className="p-4 border rounded-lg bg-white hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{driver.name}</h4>
                        {getDriverStatusBadge(driver)}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mb-2">
                        <div className="text-center">
                          <div className="font-medium text-blue-600">{driver.assigned_orders}</div>
                          <div>Assigned</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-purple-600">{driver.in_transit_orders}</div>
                          <div>In Transit</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-green-600">{driver.delivered_orders}</div>
                          <div>Delivered</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Last seen: {new Date(driver.last_seen || "").toLocaleTimeString()}
                        </span>
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          Track
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Drivers</h3>
                  <p className="text-gray-500">No drivers currently have assigned orders.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Dispatch Map */}
          <Card className="lg:col-span-2">
            <MapboxMap
              orders={ordersForMap}
              driverLocations={driverLocations}
              warehouseLocation={[43.6532, -79.3832]}
              warehouseName="Main Distribution Center"
              title="Live Dispatch Map"
              height="600px"
              showRouteOptimization={true}
              onOrderClick={(orderId) => {
                console.log("Order clicked:", orderId)
              }}
            />
          </Card>
        </div>

        {/* Unassigned Orders */}
        {unassignedOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Unassigned Orders ({unassignedOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassignedOrders.slice(0, 6).map((order) => (
                  <div key={order.id} className="p-4 border rounded-lg bg-orange-50 border-orange-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">#{order.order_number}</h4>
                      <Badge
                        className={`text-xs ${
                          order.priority === "urgent"
                            ? "bg-red-100 text-red-800"
                            : order.priority === "high"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {order.priority}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-1">{order.customer_name}</p>
                    <p className="text-xs text-gray-500 mb-3">{order.delivery_address}</p>

                    <div className="flex gap-2">
                      <Select onValueChange={(driverId) => handleAssignOrder(order.id, driverId)}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Assign Driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeDrivers.map((driver) => (
                            <SelectItem key={driver.user_id} value={driver.user_id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{driver.name}</span>
                                <Badge variant="outline" className="ml-2">
                                  {driver.assigned_orders + driver.in_transit_orders} orders
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              {unassignedOrders.length > 6 && (
                <div className="mt-4 text-center">
                  <Button variant="outline">View All {unassignedOrders.length} Unassigned Orders</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
