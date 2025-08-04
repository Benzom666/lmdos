"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import {
  Package,
  Truck,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Navigation,
  RefreshCw,
  Plus,
  Eye,
} from "lucide-react"
import SafeMapWrapper from "@/components/safe-map-wrapper"
import Link from "next/link"

interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  inTransitOrders: number
  deliveredOrders: number
  totalDrivers: number
  activeDrivers: number
  todayDeliveries: number
  successRate: number
}

interface RecentOrder {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  status: string
  priority?: string
  created_at: string
  driver_id?: string
}

interface Driver {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: string
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    inTransitOrders: 0,
    deliveredOrders: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    todayDeliveries: 0,
    successRate: 0,
  })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      fetchDashboardData()
      // Set up real-time updates
      const interval = setInterval(fetchDashboardData, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchDashboardData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      // Fetch all orders for this admin
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError

      // Fetch all drivers for this admin
      const { data: driversData, error: driversError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .eq("created_by", user.id)

      if (driversError) throw driversError

      const orders = ordersData || []
      const driversList = driversData || []

      // Calculate statistics
      const today = new Date().toDateString()
      const todayDeliveries = orders.filter(
        (order) => order.status === "delivered" && new Date(order.updated_at).toDateString() === today,
      ).length

      const totalDelivered = orders.filter((order) => order.status === "delivered").length
      const totalFailed = orders.filter((order) => order.status === "failed").length
      const successRate = totalDelivered + totalFailed > 0 ? (totalDelivered / (totalDelivered + totalFailed)) * 100 : 0

      const activeDriversCount = driversList.filter((driver) => {
        const driverOrders = orders.filter((order) => order.driver_id === driver.user_id)
        return driverOrders.some((order) => ["assigned", "picked_up", "in_transit"].includes(order.status))
      }).length

      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter((order) => order.status === "pending").length,
        inTransitOrders: orders.filter((order) => order.status === "in_transit").length,
        deliveredOrders: orders.filter((order) => order.status === "delivered").length,
        totalDrivers: driversList.length,
        activeDrivers: activeDriversCount,
        todayDeliveries,
        successRate: Math.round(successRate),
      })

      // Set recent orders (last 10)
      setRecentOrders(orders.slice(0, 10))
      setDrivers(driversList)

      // Set active orders for map
      const activeOrdersForMap = orders
        .filter((order) => ["assigned", "picked_up", "in_transit"].includes(order.status))
        .map((order) => ({
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          delivery_address: order.delivery_address,
          priority: order.priority || "normal",
          status: order.status,
        }))

      setActiveOrders(activeOrdersForMap)
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      case "assigned":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Truck className="mr-1 h-3 w-3" />
            Assigned
          </Badge>
        )
      case "picked_up":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <Package className="mr-1 h-3 w-3" />
            Picked Up
          </Badge>
        )
      case "in_transit":
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <Navigation className="mr-1 h-3 w-3" />
            In Transit
          </Badge>
        )
      case "delivered":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            Delivered
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status.replace("_", " ")}</Badge>
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading dashboard...
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
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's what's happening with your deliveries.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchDashboardData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Link href="/admin/orders/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">{stats.pendingOrders} pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Navigation className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inTransitOrders}</div>
              <p className="text-xs text-muted-foreground">Currently delivering</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDrivers}</div>
              <p className="text-xs text-muted-foreground">of {stats.totalDrivers} total drivers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">{stats.todayDeliveries} delivered today</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Orders */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Orders</CardTitle>
                  <Link href="/admin/orders">
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      View All
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">#{order.order_number}</h4>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.delivery_address}</p>
                    </div>
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
                {recentOrders.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No orders yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Delivery Map */}
          <div className="lg:col-span-2">
            <SafeMapWrapper
              orders={activeOrders}
              title="Live Delivery Tracking"
              height="500px"
              onOrderClick={(orderId) => {
                window.open(`/admin/orders/${orderId}`, "_blank")
              }}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link href="/admin/orders/create">
                <Button variant="outline" className="w-full h-20 flex-col bg-transparent">
                  <Plus className="h-6 w-6 mb-2" />
                  Create Order
                </Button>
              </Link>
              <Link href="/admin/dispatch">
                <Button variant="outline" className="w-full h-20 flex-col bg-transparent">
                  <Navigation className="h-6 w-6 mb-2" />
                  Dispatch Center
                </Button>
              </Link>
              <Link href="/admin/drivers">
                <Button variant="outline" className="w-full h-20 flex-col bg-transparent">
                  <Users className="h-6 w-6 mb-2" />
                  Manage Drivers
                </Button>
              </Link>
              <Link href="/admin/integrations">
                <Button variant="outline" className="w-full h-20 flex-col bg-transparent">
                  <TrendingUp className="h-6 w-6 mb-2" />
                  Integrations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
