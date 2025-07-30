"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order, type OrderUpdate, type UserProfile } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowLeft,
  MapPin,
  User,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  Phone,
  Mail,
  Calendar,
  Navigation,
  FileText,
  Camera,
} from "lucide-react"
import { StatusChangeFeedback } from "@/components/status-change-feedback"

// Mock live tracking component - in real app, integrate with Google Maps or similar
const LiveTrackingMap = ({ order, driver }: { order: Order; driver: UserProfile | null }) => {
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!driver || order.status !== "in_transit") return

    // Simulate live tracking updates
    const interval = setInterval(() => {
      // In real app, fetch from driver's location updates
      setDriverLocation({
        lat: 40.7128 + (Math.random() - 0.5) * 0.01,
        lng: -74.006 + (Math.random() - 0.5) * 0.01,
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [driver, order.status])

  if (order.status !== "in_transit" || !driver) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Live tracking available when order is in transit</p>
      </div>
    )
  }

  return (
    <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center relative">
      <div className="text-center">
        <Navigation className="h-8 w-8 mx-auto mb-2 text-blue-600" />
        <p className="font-medium">Live Tracking Active</p>
        <p className="text-sm text-muted-foreground">
          Driver: {driver.first_name} {driver.last_name}
        </p>
        {driverLocation && (
          <p className="text-xs text-muted-foreground mt-1">Last update: {new Date().toLocaleTimeString()}</p>
        )}
      </div>
      {driverLocation && <div className="absolute top-2 right-2 bg-green-500 w-3 h-3 rounded-full animate-pulse"></div>}
    </div>
  )
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [orderUpdates, setOrderUpdates] = useState<OrderUpdate[]>([])
  const [driver, setDriver] = useState<UserProfile | null>(null)

  const orderId = params.id as string

  // Handle the "new" case - redirect to create order page
  useEffect(() => {
    if (orderId === "new") {
      router.push("/admin/orders/create")
      return
    }
  }, [orderId, router])

  useEffect(() => {
    if (orderId && orderId !== "new" && profile) {
      fetchOrderDetails()
    }
  }, [orderId, profile])

  // Add UUID validation
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  const fetchOrderDetails = async () => {
    if (!profile || !isValidUUID(orderId)) {
      toast({
        title: "Error",
        description: "Invalid order ID format.",
        variant: "destructive",
      })
      router.push("/admin/orders")
      return
    }

    try {
      setLoading(true)

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("created_by", profile.user_id)
        .single()

      if (orderError) throw orderError

      setOrder(orderData as Order)

      // Fetch order updates
      const { data: updatesData, error: updatesError } = await supabase
        .from("order_updates")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })

      if (updatesError) throw updatesError

      setOrderUpdates(updatesData as OrderUpdate[])

      // Fetch driver details if assigned
      if (orderData.driver_id) {
        const { data: driverData, error: driverError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", orderData.driver_id)
          .single()

        if (driverError) {
          console.error("Error fetching driver:", driverError)
        } else {
          setDriver(driverData as UserProfile)
        }
      }
    } catch (error) {
      console.error("Error fetching order details:", error)
      toast({
        title: "Error",
        description: "Failed to load order details. Please try again.",
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

  const openMapsForNavigation = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const mapsUrl = isIOS
      ? `maps:?q=${encodedAddress}`
      : `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
    window.open(mapsUrl, "_blank")
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading order details...</div>
      </DashboardLayout>
    )
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Order not found.</p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
            <p className="text-muted-foreground">Created on {new Date(order.created_at).toLocaleDateString()}</p>
          </div>
          <div className="ml-auto flex gap-2">
            {getStatusBadge(order.status)}
            {order.status === "delivered" && (
              <Button variant="outline" onClick={() => router.push(`/admin/orders/${order.id}/pod`)}>
                <FileText className="mr-2 h-4 w-4" />
                View POD
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Phone</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                  <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${order.customer_phone}`)}>
                    <Phone className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {order.customer_email && (
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    <Button variant="ghost" size="sm" onClick={() => window.open(`mailto:${order.customer_email}`)}>
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Driver Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {driver ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p className="text-sm text-muted-foreground">
                      {driver.first_name} {driver.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{driver.phone || "Not provided"}</p>
                      {driver.phone && (
                        <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${driver.phone}`)}>
                          <Phone className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{driver.email}</p>
                      <Button variant="ghost" size="sm" onClick={() => window.open(`mailto:${driver.email}`)}>
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No driver assigned</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Delivery Details</TabsTrigger>
            <TabsTrigger value="tracking">Live Tracking</TabsTrigger>
            <TabsTrigger value="updates">Order Updates</TabsTrigger>
            <TabsTrigger value="status">Status Management</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Pickup Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">{order.pickup_address}</p>
                  <Button variant="outline" size="sm" onClick={() => openMapsForNavigation(order.pickup_address)}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Open in Maps
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Delivery Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">{order.delivery_address}</p>
                  <Button variant="outline" size="sm" onClick={() => openMapsForNavigation(order.delivery_address)}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Open in Maps
                  </Button>
                </CardContent>
              </Card>

              {order.delivery_notes && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Delivery Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{order.delivery_notes}</p>
                  </CardContent>
                </Card>
              )}

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Order Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Created:</span>
                      <span>{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                    {order.assigned_at && (
                      <div className="flex justify-between text-sm">
                        <span>Assigned:</span>
                        <span>{new Date(order.assigned_at).toLocaleString()}</span>
                      </div>
                    )}
                    {order.estimated_delivery_time && (
                      <div className="flex justify-between text-sm">
                        <span>Estimated Delivery:</span>
                        <span>{new Date(order.estimated_delivery_time).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Last Updated:</span>
                      <span>{new Date(order.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tracking" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Driver Tracking</CardTitle>
                <CardDescription>Real-time location of the assigned driver</CardDescription>
              </CardHeader>
              <CardContent>
                <LiveTrackingMap order={order} driver={driver} />
                {order.status === "in_transit" && driver && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <Navigation className="h-4 w-4" />
                      <span className="font-medium">Driver is en route</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      {driver.first_name} {driver.last_name} is currently delivering your order
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="updates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Updates</CardTitle>
                <CardDescription>Track the progress of this order</CardDescription>
              </CardHeader>
              <CardContent>
                {orderUpdates.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No updates available for this order.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Photo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderUpdates.map((update) => (
                        <TableRow key={update.id}>
                          <TableCell>{getStatusBadge(update.status)}</TableCell>
                          <TableCell>{update.notes || "—"}</TableCell>
                          <TableCell>{new Date(update.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            {update.photo_url ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(update.photo_url!, "_blank")}
                              >
                                <Camera className="mr-2 h-4 w-4" />
                                View Photo
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="status" className="mt-4">
            <StatusChangeFeedback
              orderId={order.id}
              currentStatus={order.status}
              orderNumber={order.order_number}
              hasShopifyConnection={!!order.shopify_order_id}
              onStatusChanged={fetchOrderDetails}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
