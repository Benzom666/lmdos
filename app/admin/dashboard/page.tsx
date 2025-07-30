"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { Truck, Package, Clock, CheckCircle, Plus, Users, ArrowRight, TrendingUp, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

interface AdminStats {
  totalDrivers: number
  totalOrders: number
  pendingOrders: number
  completedOrders: number
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [stats, setStats] = useState<AdminStats>({
    totalDrivers: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile) return

      try {
        // Fetch drivers managed by this admin
        const { count: driverCount, error: driversError } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "driver")
          .eq("admin_id", profile.user_id)

        if (driversError) throw driversError

        // Fetch orders created by this admin
        const { count: totalOrderCount, error: ordersError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("created_by", profile.user_id)

        if (ordersError) throw ordersError

        // Fetch pending orders
        const { count: pendingCount, error: pendingError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("created_by", profile.user_id)
          .in("status", ["pending", "assigned", "in_transit"])

        if (pendingError) throw pendingError

        // Fetch completed orders
        const { count: completedCount, error: completedError } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("created_by", profile.user_id)
          .eq("status", "delivered")

        if (completedError) throw completedError

        setStats({
          totalDrivers: driverCount || 0,
          totalOrders: totalOrderCount || 0,
          pendingOrders: pendingCount || 0,
          completedOrders: completedCount || 0,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
        toast({
          title: "Error",
          description: "Failed to load dashboard data.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (profile) {
      fetchStats()
    }
  }, [profile, toast])

  const completionRate = stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0

  return (
    <DashboardLayout>
      <div className="space-y-12">
        {/* Welcome Header */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl font-bold tracking-tight">Welcome back, {profile?.first_name || "Admin"}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Manage your delivery operations with ease. Here's an overview of your current performance.
          </p>
        </div>

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="h-16 px-8 text-lg" asChild>
            <Link href="/admin/orders/create">
              <Plus className="h-6 w-6 mr-3" />
              Create New Order
            </Link>
          </Button>
          {/* <Button size="lg" variant="outline" className="h-16 px-8 text-lg" asChild>
            <Link href="/admin/labels/create">
              <QrCode className="h-6 w-6 mr-3" />
              Generate Label
            </Link>
          </Button> */}
        </div>

        {/* Key Metrics */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-2 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
                  <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-right">
                  <CardTitle className="text-3xl font-bold">{loading ? "..." : stats.totalDrivers}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Active Drivers</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                <Link href="/admin/drivers">
                  Manage Drivers
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
                  <Package className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-right">
                  <CardTitle className="text-3xl font-bold">{loading ? "..." : stats.totalOrders}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Total Orders</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
                <Link href="/admin/orders">
                  View All Orders
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-xl">
                  <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-right">
                  <CardTitle className="text-3xl font-bold">{loading ? "..." : stats.pendingOrders}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">In Progress</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Needs attention</span>
                {stats.pendingOrders > 0 && (
                  <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                    Active
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-xl">
                  <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-right">
                  <CardTitle className="text-3xl font-bold">{loading ? "..." : `${completionRate}%`}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Success Rate</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-600 font-medium">{stats.completedOrders} completed</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Quick Actions</h2>
            <p className="text-muted-foreground">Common tasks to manage your delivery operations</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            <Card className="border-2 hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <Link href="/admin/orders" className="block">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto p-4 bg-blue-50 dark:bg-blue-950 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                    <Package className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl">Manage Orders</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground mb-4">View, edit, and track all your delivery orders</p>
                  <div className="flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                    Open Orders <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <Link href="/admin/drivers" className="block">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto p-4 bg-green-50 dark:bg-green-950 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                    <Users className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-xl">Manage Drivers</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground mb-4">Invite, monitor, and coordinate your delivery team</p>
                  <div className="flex items-center justify-center text-green-600 dark:text-green-400 font-medium">
                    View Team <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <Link href="/admin/settings" className="block">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto p-4 bg-orange-50 dark:bg-orange-950 rounded-2xl w-fit group-hover:scale-110 transition-transform">
                    <Activity className="h-10 w-10 text-orange-600 dark:text-orange-400" />
                  </div>
                  <CardTitle className="text-xl">Analytics</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-muted-foreground mb-4">View detailed reports and performance metrics</p>
                  <div className="flex items-center justify-center text-orange-600 dark:text-orange-400 font-medium">
                    View Reports <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        </div>

        {/* Account Summary */}
        <Card className="max-w-2xl mx-auto border-2">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-2xl">Your Account</CardTitle>
            <p className="text-muted-foreground">Account information and settings</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 text-center">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-lg font-medium">
                  {profile?.first_name} {profile?.last_name || ""}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-lg font-medium">{profile?.email}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="text-lg font-medium capitalize">{profile?.role}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="text-lg font-medium">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="lg" asChild>
                <Link href="/profile">Update Profile</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
