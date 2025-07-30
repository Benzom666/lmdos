"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

export default function SuperAdminStatsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [orderStats, setOrderStats] = useState<any[]>([])
  const [statusDistribution, setStatusDistribution] = useState<any[]>([])
  const [adminDriverCounts, setAdminDriverCounts] = useState<any[]>([])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // Fetch order stats by day for the last 7 days
      const today = new Date()
      const dates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        return date.toISOString().split("T")[0]
      }).reverse()

      const orderStatsByDay = await Promise.all(
        dates.map(async (date) => {
          const nextDay = new Date(date)
          nextDay.setDate(nextDay.getDate() + 1)
          const nextDayStr = nextDay.toISOString().split("T")[0]

          const { data, error } = await supabase
            .from("orders")
            .select("id")
            .gte("created_at", date)
            .lt("created_at", nextDayStr)

          if (error) throw error

          return {
            date: date,
            orders: data.length,
          }
        }),
      )

      setOrderStats(orderStatsByDay)

      // Fetch order status distribution
      const statuses = ["pending", "assigned", "in_progress", "delivered", "failed"]
      const statusCounts = await Promise.all(
        statuses.map(async (status) => {
          const { data, error } = await supabase.from("orders").select("id").eq("status", status)

          if (error) throw error

          return {
            status: status.charAt(0).toUpperCase() + status.slice(1).replace("_", " "),
            count: data.length,
          }
        }),
      )

      setStatusDistribution(statusCounts)

      // Fetch admin and driver counts
      const { data: admins, error: adminsError } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .eq("role", "admin")

      if (adminsError) throw adminsError

      const adminDriverData = await Promise.all(
        admins.map(async (admin) => {
          const { data: drivers, error: driversError } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("role", "driver")
            .eq("admin_id", admin.id)

          if (driversError) throw driversError

          return {
            name: `${admin.first_name} ${admin.last_name}`,
            drivers: drivers.length,
          }
        }),
      )

      setAdminDriverCounts(adminDriverData)
    } catch (error) {
      console.error("Error fetching stats:", error)
      toast({
        title: "Error",
        description: "Failed to load statistics. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Platform Statistics</h1>

        {loading ? (
          <div className="text-center py-8">Loading statistics...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Orders by Day</CardTitle>
                <CardDescription>Number of orders created in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={orderStats}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="orders" fill="#8884d8" name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Status Distribution</CardTitle>
                <CardDescription>Current status of all orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="status"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Drivers per Admin</CardTitle>
                <CardDescription>Number of drivers assigned to each admin</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={adminDriverCounts}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="drivers" fill="#82ca9d" name="Drivers" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
