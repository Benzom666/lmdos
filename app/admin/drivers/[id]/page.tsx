"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase, type UserProfile, type Driver, type Order } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, User, Truck, MapPin, Package, Phone, Mail, Calendar } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function DriverDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [driverProfile, setDriverProfile] = useState<UserProfile | null>(null)
  const [driverDetails, setDriverDetails] = useState<Driver | null>(null)
  const [driverOrders, setDriverOrders] = useState<Order[]>([])

  const driverId = params.id as string

  useEffect(() => {
    if (driverId && profile) {
      fetchDriverData()
    }
  }, [driverId, profile])

  const fetchDriverData = async () => {
    if (!profile) return

    try {
      setLoading(true)

      // Fetch driver profile
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", driverId)
        .eq("role", "driver")
        .eq("admin_id", profile.id)
        .maybeSingle()

      if (profileError) {
        console.error("Error fetching driver profile:", profileError)
        throw profileError
      }

      if (!profileData) {
        console.error("Driver profile not found or access denied")
        return
      }

      setDriverProfile(profileData as UserProfile)

      // Fetch driver details
      const { data: detailsData, error: detailsError } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", driverId)
        .single()

      if (detailsError && detailsError.code !== "PGRST116") {
        console.error("Error fetching driver details:", detailsError)
      } else if (detailsData) {
        setDriverDetails(detailsData as Driver)
      }

      // Fetch driver's orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })

      if (ordersError) {
        console.error("Error fetching driver orders:", ordersError)
      } else {
        setDriverOrders(ordersData as Order[])
      }
    } catch (error) {
      console.error("Error fetching driver data:", error)
      toast({
        title: "Error",
        description: "Failed to load driver details. Please try again.",
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
            Pending
          </Badge>
        )
      case "assigned":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Assigned
          </Badge>
        )
      case "in_progress":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            In Progress
          </Badge>
        )
      case "delivered":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Delivered
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
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
        <div className="text-center py-8">Loading driver details...</div>
      </DashboardLayout>
    )
  }

  if (!driverProfile) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Driver not found.</p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const completedOrders = driverOrders.filter((order) => order.status === "delivered").length
  const totalOrders = driverOrders.length
  const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {driverProfile.first_name} {driverProfile.last_name}
            </h1>
            <p className="text-muted-foreground">Driver Profile</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOrders}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedOrders}</div>
              <p className="text-xs text-muted-foreground">Successfully delivered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground">Delivery success rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {driverDetails?.is_active ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Current status</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">First Name</p>
                    <p className="text-sm text-muted-foreground">{driverProfile.first_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Last Name</p>
                    <p className="text-sm text-muted-foreground">{driverProfile.last_name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </p>
                    <p className="text-sm text-muted-foreground">{driverProfile.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone
                    </p>
                    <p className="text-sm text-muted-foreground">{driverProfile.phone || "Not provided"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Joined
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(driverProfile.created_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicle" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                {driverDetails ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">License Number</p>
                        <p className="text-sm text-muted-foreground">
                          {driverDetails.license_number || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Vehicle Plate</p>
                        <p className="text-sm text-muted-foreground">{driverDetails.vehicle_plate || "Not provided"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Vehicle Model</p>
                      <p className="text-sm text-muted-foreground">{driverDetails.vehicle_model || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Availability Status</p>
                      <p className="text-sm text-muted-foreground">{driverDetails.availability_status || "Unknown"}</p>
                    </div>
                    {driverDetails.current_latitude && driverDetails.current_longitude && (
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Last Known Location
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {driverDetails.current_latitude}, {driverDetails.current_longitude}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated: {new Date(driverDetails.last_location_update || "").toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No vehicle information available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>All orders assigned to this driver</CardDescription>
              </CardHeader>
              <CardContent>
                {driverOrders.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No orders assigned to this driver yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {driverOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.customer_name}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/orders/${order.id}`)}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
