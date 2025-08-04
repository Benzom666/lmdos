"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { MapboxMap } from "@/components/mapbox-map"
import { RouteOptimizationWidget } from "@/components/route-optimization-widget"
import { Users, Navigation, Clock, RefreshCw, Phone, MessageSquare, CheckCircle, Truck, Package } from "lucide-react"

interface Driver {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  status: string
  is_available: boolean
  current_location?: [number, number]
  last_seen: string
  active_orders: number
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
}

export default function DispatchPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (user) {
      fetchDispatchData()
      // Set up real-time updates
      const interval = setInterval(fetchDispatchData, 30000) // Update every 30 seconds
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchDispatchData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      // Fetch drivers
      const { data: driversData, error: driversError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .eq("created_by", user.id)

      if (driversError) throw driversError

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("created_by", user.id)
        .in("status", ["pending", "assigned", "picked_up", "in_transit"])
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Process drivers with location and order count
      const processedDrivers = (driversData || []).map((driver) => {
        const driverOrders = (ordersData || []).filter((order) => order.driver_id === driver.user_id)

        // Generate mock location for demonstration
        const mockLocation = generateDriverLocation(driver.user_id)

        return {
          id: driver.id,
          user_id: driver.user_id,
          first_name: driver.first_name || "Unknown",
          last_name: driver.last_name || "",
          email: driver.email,
          phone: driver.phone,
          status: driverOrders.length > 0 ? "active" : "available",
          is_available: driverOrders.length < 5, // Max 5 orders per driver
          current_location: mockLocation,
          last_seen: new Date().toISOString(),
          active_orders: driverOrders.length,
        }
      })

      setDrivers(processedDrivers)
      setOrders(ordersData || [])
    } catch (error) {
      console.error("Error fetching dispatch data:", error)
      toast({
        title: "Error",
        description: "Failed to load dispatch data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Generate consistent driver location based on user_id
  const generateDriverLocation = (userId: string): [number, number] => {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }

    const baseLatitude = 43.6532
    const baseLongitude = -79.3832
    const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.2
    const lngOffset = (((Math.abs(hash) >> 10) % 1000) / 1000 - 0.5) * 0.3

    return [baseLatitude + latOffset, baseLongitude + lngOffset]
  }

  const assignOrderToDriver = async (orderId: string, driverId: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          driver_id: driverId,
          status: "assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      if (error) throw error

      toast({
        title: "Order Assigned",
        description: "Order has been successfully assigned to driver.",
      })

      fetchDispatchData() // Refresh data
    } catch (error) {
      console.error("Error assigning order:", error)
      toast({
        title: "Assignment Failed",
        description: "Failed to assign order to driver.",
        variant: "destructive",
      })
    }
  }

  const filteredDrivers = drivers.filter(
    (driver) =>
      driver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const activeOrders = orders.filter((order) => ["assigned", "picked_up", "in_transit"].includes(order.status))
  const pendingOrders = orders.filter((order) => order.status === "pending")

  // Convert drivers to driver locations for map
  const driverLocations = drivers
    .filter((driver) => driver.current_location)
    .map((driver) => ({
      id: driver.id,
      name: `${driver.first_name} ${driver.last_name}`,
      location: driver.current_location!,
      orders: driver.active_orders,
      status: driver.status,
      last_seen: driver.last_seen,
    }))

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading dispatch center...
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dispatch Center</h1>
            <p className="text-muted-foreground">Manage drivers and assign orders in real-time.</p>
          </div>
          <Button onClick={fetchDispatchData} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{drivers.filter((d) => d.status === "active").length}</div>
              <p className="text-xs text-muted-foreground">of {drivers.length} total drivers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingOrders.length}</div>
              <p className="text-xs text-muted-foreground">awaiting assignment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Navigation className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeOrders.length}</div>
              <p className="text-xs text-muted-foreground">currently delivering</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Drivers</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{drivers.filter((d) => d.is_available).length}</div>
              <p className="text-xs text-muted-foreground">ready for assignment</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Active Drivers */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Drivers ({drivers.filter((d) => d.status === "active").length})
                </CardTitle>
                <Input
                  placeholder="Search drivers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </CardHeader>
              <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                {filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDriver === driver.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedDriver(driver.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                          <Truck className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium">
                            {driver.first_name} {driver.last_name}
                          </h4>
                          <p className="text-xs text-muted-foreground">{driver.email}</p>
                        </div>
                      </div>
                      <Badge
                        variant={driver.is_available ? "default" : "secondary"}
                        className={
                          driver.status === "active"
                            ? "bg-green-100 text-green-800"
                            : driver.is_available
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                        }
                      >
                        {driver.status === "active" ? "🟢 Live" : driver.is_available ? "Available" : "Busy"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{driver.active_orders} active orders</span>
                      <span>Updated {new Date(driver.last_seen).toLocaleTimeString()}</span>
                    </div>
                    {driver.phone && (
                      <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm">
                          <Phone className="h-3 w-3 mr-1" />
                          Call
                        </Button>
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Message
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {filteredDrivers.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No drivers found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Dispatch Map */}
          <div className="lg:col-span-2">
            <MapboxMap
              orders={activeOrders}
              driverLocations={driverLocations}
              title="Live Dispatch Map"
              height="500px"
              onOrderClick={(orderId) => {
                window.open(`/admin/orders/${orderId}`, "_blank")
              }}
            />
          </div>
        </div>

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Pending Orders ({pendingOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">#{order.order_number}</h4>
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
                      {drivers
                        .filter((driver) => driver.is_available)
                        .slice(0, 3)
                        .map((driver) => (
                          <Button
                            key={driver.id}
                            variant="outline"
                            size="sm"
                            onClick={() => assignOrderToDriver(order.id, driver.user_id)}
                          >
                            Assign to {driver.first_name}
                          </Button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route Optimization */}
        <RouteOptimizationWidget />
      </div>
    </DashboardLayout>
  )
}
