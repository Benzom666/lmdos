"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Download,
  Phone,
  MessageSquare,
  MapPin,
  Users,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"

interface Driver {
  id: string
  name: string
  email: string
  phone?: string
  status: "active" | "inactive" | "busy"
  current_location?: string
  avatar_url?: string
  orders_completed_today: number
  current_route?: string
  created_by?: string
  total_orders_assigned: number
}

interface Stats {
  activeDrivers: number
  completedRoutes: number
  totalOrders: number
  pendingOrders: number
}

export default function DispatchPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [stats, setStats] = useState<Stats>({
    activeDrivers: 0,
    completedRoutes: 0,
    totalOrders: 0,
    pendingOrders: 0,
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const { user } = useAuth()

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      console.log("Fetching dispatch data...")

      if (!user?.id) {
        console.log("No user ID available")
        setLoading(false)
        return
      }

      // Fetch drivers from user_profiles table, not drivers table
      const { data: allDriversData, error: allDriversError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")

      if (allDriversError) {
        console.error("Error fetching drivers:", allDriversError)
        throw allDriversError
      }

      console.log("All drivers data:", allDriversData)

      // Filter drivers assigned to this admin
      const filteredDriversData = allDriversData?.filter((driver) => driver.admin_id === user.id) || []

      console.log("Filtered drivers data:", filteredDriversData)

      // Fetch orders separately
      const { data: ordersData, error: ordersError } = await supabase.from("orders").select("*")

      if (ordersError) {
        console.error("Error fetching orders:", ordersError)
        throw ordersError
      }

      console.log("Orders data:", ordersData)

      // Process drivers data by matching with orders
      const processedDrivers =
        filteredDriversData?.map((driver) => {
          const driverOrders = ordersData?.filter((order) => order.driver_id === driver.user_id) || []
          const todayOrders = driverOrders.filter(
            (order) => order.created_at && new Date(order.created_at).toDateString() === new Date().toDateString(),
          )

          // Calculate total orders assigned (not just completed)
          const totalOrdersAssigned = driverOrders.length
          const completedToday = todayOrders.filter((order) => order.status === "delivered").length

          // Use actual driver name from user_profiles
          const driverName =
            `${driver.first_name || ""} ${driver.last_name || ""}`.trim() || driver.email || "Unknown Driver"

          console.log(`Driver ${driver.id}: name="${driverName}", email="${driver.email}"`)

          return {
            id: driver.user_id || driver.id,
            name: driverName,
            email: driver.email || "",
            phone: driver.phone || undefined,
            status: totalOrdersAssigned > 0 ? "active" : "inactive",
            current_location: undefined,
            avatar_url: undefined,
            orders_completed_today: completedToday,
            current_route:
              driverOrders.find((order) => ["assigned", "picked_up", "in_transit"].includes(order.status))?.id ||
              undefined,
            created_by: driver.admin_id,
            total_orders_assigned: totalOrdersAssigned,
          }
        }) || []

      console.log("Processed drivers:", processedDrivers)
      setDrivers(processedDrivers)

      // Calculate stats from orders data (only for current admin's drivers)
      const today = new Date().toDateString()
      const adminDriverIds = processedDrivers.map((d) => d.id)
      const adminOrders = ordersData?.filter((order) => adminDriverIds.includes(order.driver_id)) || []
      const todayOrders = adminOrders.filter(
        (order) => order.created_at && new Date(order.created_at).toDateString() === today,
      )

      const newStats = {
        activeDrivers: processedDrivers.filter((d) => d.status === "active").length,
        completedRoutes: todayOrders.filter((order) => order.status === "delivered").length,
        totalOrders: todayOrders.length,
        pendingOrders: todayOrders.filter((order) =>
          ["pending", "assigned", "picked_up", "in_transit"].includes(order.status || ""),
        ).length,
      }

      console.log("Calculated stats:", newStats)
      setStats(newStats)
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Error fetching dispatch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDrivers = drivers.filter((driver) => {
    // Add null checks for all string operations
    const driverName = driver.name || ""
    const driverEmail = driver.email || ""
    const searchTermLower = searchTerm.toLowerCase()

    const matchesSearch =
      driverName.toLowerCase().includes(searchTermLower) || driverEmail.toLowerCase().includes(searchTermLower)

    const matchesFilter = filterStatus === "all" || driver.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const handleRefresh = () => {
    setLoading(true)
    fetchData()
  }

  const handleDriverSelect = (driver: Driver) => {
    setSelectedDriver(driver)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "busy":
        return "bg-yellow-500"
      case "inactive":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const getDriverInitials = (name: string) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dispatch Center</h1>
            <p className="text-muted-foreground">
              Real-time operational overview of your delivery drivers and order statuses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Reports
            </Button>
            <div className="text-sm text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDrivers}</div>
              <p className="text-xs text-muted-foreground">Currently on shift</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Routes</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedRoutes}</div>
              <p className="text-xs text-muted-foreground">Routes finished today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">Your orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingOrders}</div>
              <p className="text-xs text-muted-foreground">Awaiting delivery</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Routes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Routes</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Driver List */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Driver Overview</TabsTrigger>
                <TabsTrigger value="map">Live Map</TabsTrigger>
                <TabsTrigger value="analytics">Route Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Drivers ({filteredDrivers.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      </div>
                    ) : filteredDrivers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No drivers found matching your criteria</p>
                        <p className="text-sm mt-2">Only drivers with orders are shown</p>
                      </div>
                    ) : (
                      filteredDrivers.map((driver) => (
                        <div
                          key={driver.id}
                          className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedDriver?.id === driver.id ? "bg-muted border-primary" : ""
                          }`}
                          onClick={() => handleDriverSelect(driver)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={driver.avatar_url || "/placeholder.svg"} />
                                <AvatarFallback>{getDriverInitials(driver.name)}</AvatarFallback>
                              </Avatar>
                              <div
                                className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(driver.status)}`}
                              />
                            </div>
                            <div>
                              <div className="font-medium">{driver.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {driver.current_route ? `Route #${driver.current_route.slice(-8)}` : "Available"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={driver.status === "active" ? "default" : "secondary"}>
                              {driver.status === "active" ? "Active" : driver.status}
                            </Badge>
                            <div className="text-sm text-muted-foreground">
                              {driver.total_orders_assigned} total orders | {driver.orders_completed_today} completed
                              today
                            </div>
                            {driver.orders_completed_today > 0 && (
                              <Badge variant="outline" className="text-green-600">
                                ✓ Complete
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost">
                              <Phone className="h-4 w-4" />
                              Call
                            </Button>
                            <Button size="sm" variant="ghost">
                              <MessageSquare className="h-4 w-4" />
                              Message
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="map">
                <Card>
                  <CardHeader>
                    <CardTitle>Live Driver Locations</CardTitle>
                    <CardDescription>Real-time tracking of all active drivers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Map integration coming soon</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics">
                <Card>
                  <CardHeader>
                    <CardTitle>Route Performance Analytics</CardTitle>
                    <CardDescription>Analyze delivery efficiency and optimization opportunities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">Analytics dashboard coming soon</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Driver Details Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Driver Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDriver ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedDriver.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{getDriverInitials(selectedDriver.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{selectedDriver.name}</div>
                        <div className="text-sm text-muted-foreground">{selectedDriver.email || "No email"}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant={selectedDriver.status === "active" ? "default" : "secondary"}>
                          {selectedDriver.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Orders</span>
                        <span className="text-sm font-medium">{selectedDriver.total_orders_assigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Orders Today</span>
                        <span className="text-sm font-medium">{selectedDriver.orders_completed_today}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Current Route</span>
                        <span className="text-sm font-medium">
                          {selectedDriver.current_route ? `#${selectedDriver.current_route.slice(-8)}` : "None"}
                        </span>
                      </div>
                      {selectedDriver.phone && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Phone</span>
                          <span className="text-sm font-medium">{selectedDriver.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <Phone className="h-4 w-4 mr-2" />
                        Call
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 bg-transparent">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Select a driver to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
