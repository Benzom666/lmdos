"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { Users, Truck, Package, TrendingUp, RefreshCw, Shuffle, MapPinIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import DeliveryMap from "@/components/delivery-map"

interface DashboardStats {
  totalAdmins: number
  totalDrivers: number
  totalOrders: number
  completedOrders: number
  pendingOrders: number
  assignedOrders: number
  inTransitOrders: number
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: string
  status: string
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAdmins: 0,
    totalDrivers: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    assignedOrders: 0,
    inTransitOrders: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [adminLocation, setAdminLocation] = useState<[number, number] | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchStats()
    getAdminLocation()

    // Set up real-time subscriptions
    const profilesSubscription = supabase
      .channel("profiles-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_profiles",
        },
        (payload) => {
          console.log("👤 Profile change detected:", payload)
          fetchStats()
        },
      )
      .subscribe()

    const ordersSubscription = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("📦 Order change detected:", payload)
          fetchStats()
        },
      )
      .subscribe()

    return () => {
      profilesSubscription.unsubscribe()
      ordersSubscription.unsubscribe()
    }
  }, [])

  const getAdminLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAdminLocation([position.coords.latitude, position.coords.longitude])
        },
        (error) => {
          console.log("Geolocation error:", error)
          // Default to NYC headquarters location
          setAdminLocation([40.7589, -73.9851])
        },
      )
    } else {
      // Default to NYC headquarters location
      setAdminLocation([40.7589, -73.9851])
    }
  }

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("🔄 Fetching super admin dashboard stats...")

      // Fetch all user profiles
      const { data: allProfiles, error: profilesError } = await supabase.from("user_profiles").select("role")

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError)
        throw profilesError
      }

      console.log("Fetched profiles:", allProfiles)

      // Fetch all orders
      const { data: allOrdersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, delivery_address, priority, status")

      if (ordersError) {
        console.error("Error fetching orders:", ordersError)
        throw ordersError
      }

      console.log("Fetched orders:", allOrdersData)
      setAllOrders(allOrdersData || [])

      // Count by role and status
      const adminCount = allProfiles?.filter((p) => p.role === "admin").length || 0
      const driverCount = allProfiles?.filter((p) => p.role === "driver").length || 0
      const totalOrderCount = allOrdersData?.length || 0
      const completedOrderCount = allOrdersData?.filter((o) => o.status === "delivered").length || 0
      const pendingOrderCount = allOrdersData?.filter((o) => o.status === "pending").length || 0
      const assignedOrderCount = allOrdersData?.filter((o) => o.status === "assigned").length || 0
      const inTransitOrderCount = allOrdersData?.filter((o) => o.status === "in_transit").length || 0

      const newStats: DashboardStats = {
        totalAdmins: adminCount,
        totalDrivers: driverCount,
        totalOrders: totalOrderCount,
        completedOrders: completedOrderCount,
        pendingOrders: pendingOrderCount,
        assignedOrders: assignedOrderCount,
        inTransitOrders: inTransitOrderCount,
      }

      console.log("📊 Calculated stats:", newStats)
      setStats(newStats)

      toast({
        title: "Dashboard Updated",
        description: `Found ${allProfiles?.length || 0} profiles and ${allOrdersData?.length || 0} orders`,
      })
    } catch (error: any) {
      console.error("❌ Error fetching stats:", error)
      setError(`Failed to load dashboard statistics: ${error.message}`)
      toast({
        title: "Error",
        description: `Failed to load dashboard statistics: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const viewAllOrdersOnMap = async () => {
    if (allOrders.length === 0) {
      toast({
        title: "No Orders",
        description: "No orders available to display on map.",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)
    try {
      // Filter active orders for mapping
      const activeOrders = allOrders.filter((order) => !["delivered", "failed", "cancelled"].includes(order.status))

      if (activeOrders.length === 0) {
        toast({
          title: "No Active Orders",
          description: "No active orders to display on map.",
          variant: "destructive",
        })
        return
      }

      setShowMap(true)
      toast({
        title: "Map Loaded",
        description: `Displaying ${activeOrders.length} active orders on map`,
      })
    } catch (error) {
      console.error("Error loading map:", error)
      toast({
        title: "Error",
        description: "Failed to load map. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  const completionRate = stats.totalOrders > 0 ? ((stats.completedOrders / stats.totalOrders) * 100).toFixed(1) : "0"

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <div className="flex gap-2">
            {adminLocation && (
              <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                <MapPinIcon className="h-3 w-3" />
                Location detected
              </div>
            )}
            <Button onClick={viewAllOrdersOnMap} disabled={isOptimizing} variant="outline">
              {isOptimizing ? (
                "Loading..."
              ) : (
                <>
                  <Shuffle className="mr-2 h-4 w-4" />
                  View All Orders Map
                </>
              )}
            </Button>
            <Button onClick={fetchStats} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Admins</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div> : stats.totalAdmins}
              </div>
              <p className="text-xs text-muted-foreground">Registered admin users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div> : stats.totalDrivers}
              </div>
              <p className="text-xs text-muted-foreground">Registered driver users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div> : stats.totalOrders}
              </div>
              <p className="text-xs text-muted-foreground">All delivery orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <div className="animate-pulse bg-gray-200 h-8 w-12 rounded"></div> : stats.completedOrders}
              </div>
              <p className="text-xs text-muted-foreground">{completionRate}% completion rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Additional detailed stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pending:</span>
                <span className="font-medium">{loading ? "..." : stats.pendingOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Assigned:</span>
                <span className="font-medium">{loading ? "..." : stats.assignedOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">In Transit:</span>
                <span className="font-medium">{loading ? "..." : stats.inTransitOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Delivered:</span>
                <span className="font-medium">{loading ? "..." : stats.completedOrders}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Database:</span>
                <span className="font-medium text-green-600">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Real-time:</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Update:</span>
                <span className="font-medium text-xs">{new Date().toLocaleTimeString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href="/super-admin/admins">Manage Admins</a>
              </Button>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href="/super-admin/drivers">Manage Drivers</a>
              </Button>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href="/super-admin/stats">View Analytics</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">User Distribution</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Super Admins:</span>
                    <span>1</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Admins:</span>
                    <span>{stats.totalAdmins}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Drivers:</span>
                    <span>{stats.totalDrivers}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Order Performance</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Success Rate:</span>
                    <span>{completionRate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Active Orders:</span>
                    <span>{stats.assignedOrders + stats.inTransitOrders}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Pending Orders:</span>
                    <span>{stats.pendingOrders}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Map Modal */}
        {showMap && (
          <DeliveryMap
            orders={allOrders
              .filter((order) => !["delivered", "failed", "cancelled"].includes(order.status))
              .map((order) => ({
                id: order.id,
                order_number: order.order_number,
                customer_name: order.customer_name,
                delivery_address: order.delivery_address,
                priority: order.priority,
                status: order.status,
              }))}
            driverLocation={adminLocation}
            onClose={() => setShowMap(false)}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
