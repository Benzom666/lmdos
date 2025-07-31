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

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      // Fetch drivers
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select(`
          id,
          name,
          email,
          phone,
          status,
          current_location,
          avatar_url,
          orders!orders_driver_id_fkey(id, status, created_at)
        `)
        .eq("status", "active")

      if (driversError) throw driversError

      // Process drivers data
      const processedDrivers =
        driversData?.map((driver) => ({
          ...driver,
          orders_completed_today:
            driver.orders?.filter(
              (order) =>
                order.status === "delivered" && new Date(order.created_at).toDateString() === new Date().toDateString(),
            ).length || 0,
          current_route:
            driver.orders?.find((order) => ["assigned", "picked_up", "in_transit"].includes(order.status))?.id || null,
        })) || []

      setDrivers(processedDrivers)

      // Fetch stats
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, status, created_at, driver_id")

      if (ordersError) throw ordersError

      const today = new Date().toDateString()
      const todayOrders = ordersData?.filter((order) => new Date(order.created_at).toDateString() === today) || []

      setStats({
        activeDrivers: processedDrivers.filter((d) => d.status === "active").length,
        completedRoutes: todayOrders.filter((order) => order.status === "delivered").length,
        totalOrders: todayOrders.length,
        pendingOrders: todayOrders.filter((order) =>
          ["pending", "assigned", "picked_up", "in_transit"].includes(order.status),
        ).length,
      })

      setLastUpdated(new Date())
    } catch (error) {
      console.error("Error fetching dispatch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchTerm.toLowerCase())
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
                                <AvatarFallback>
                                  {driver.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div
                                className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background ${getStatusColor(driver.status)}`}
                              />
                            </div>
                            <div>
                              <div className="font-medium">{driver.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {driver.current_route ? `Route ${driver.current_route}` : "Available"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={driver.status === "active" ? "default" : "secondary"}>
                              {driver.status === "active" ? "Route Completed" : driver.status}
                            </Badge>
                            <div className="text-sm text-muted-foreground">
                              {driver.orders_completed_today}/1 orders
                            </div>
                            <Badge variant="outline" className="text-green-600">
                              ✓ 3hrs Complete
                            </Badge>
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
                        <AvatarFallback>
                          {selectedDriver.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{selectedDriver.name}</div>
                        <div className="text-sm text-muted-foreground">{selectedDriver.email}</div>
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
                        <span className="text-sm text-muted-foreground">Orders Today</span>
                        <span className="text-sm font-medium">{selectedDriver.orders_completed_today}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Current Route</span>
                        <span className="text-sm font-medium">{selectedDriver.current_route || "None"}</span>
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
