"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  MapPin,
  User,
  Package,
  Clock,
  CheckCircle,
  Navigation,
  Phone,
  Mail,
  MessageSquare,
  AlertTriangle,
  Route,
  Play,
} from "lucide-react"

export default function DriverOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [eta, setEta] = useState<string | null>(null)

  const orderId = params.id as string

  useEffect(() => {
    if (orderId && profile) {
      fetchOrderDetails()
      calculateETA()
    }
  }, [orderId, profile])

  const fetchOrderDetails = async () => {
    if (!profile) return

    try {
      setLoading(true)

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("driver_id", profile.user_id)
        .single()

      if (orderError) throw orderError

      setOrder(orderData as Order)
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

  const calculateETA = () => {
    // Simulate ETA calculation based on distance and traffic
    const baseTime = 15 + Math.floor(Math.random() * 30) // 15-45 minutes
    const etaTime = new Date()
    etaTime.setMinutes(etaTime.getMinutes() + baseTime)
    setEta(etaTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
  }

  const updateOrderStatus = async (newStatus: string, notes?: string) => {
    if (!order || !profile) return

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      if (error) throw error

      // Create order update record
      await supabase.from("order_updates").insert({
        order_id: order.id,
        driver_id: profile.user_id,
        status: newStatus,
        notes: notes || `Order status updated to ${newStatus}`,
        latitude: null, // Would get from geolocation in real app
        longitude: null,
      })

      setOrder({ ...order, status: newStatus })

      toast({
        title: "Status Updated",
        description: `Order status updated to ${newStatus.replace("_", " ")}`,
      })
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Error",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "assigned":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="mr-1 h-3 w-3" />
            Assigned
          </Badge>
        )
      case "picked_up":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
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
      default:
        return <Badge variant="outline">{status.replace("_", " ")}</Badge>
    }
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
            <p className="text-muted-foreground">
              {order.customer_name} • ETA: {eta || "Calculating..."}
            </p>
          </div>
          <div className="ml-auto flex gap-2">{getStatusBadge(order.status)}</div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          {order.status === "assigned" && (
            <Button onClick={() => updateOrderStatus("picked_up")}>
              <Play className="mr-2 h-4 w-4" />
              Start Pickup
            </Button>
          )}
          {order.status === "picked_up" && (
            <Button onClick={() => updateOrderStatus("in_transit")}>
              <Navigation className="mr-2 h-4 w-4" />
              Start Delivery
            </Button>
          )}
          {order.status === "in_transit" && (
            <Button onClick={() => router.push(`/driver/orders/${order.id}/delivery-status`)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Update Status
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`,
              )
            }
          >
            <MapPin className="mr-2 h-4 w-4" />
            Navigate
          </Button>
          <Button variant="outline" onClick={() => router.push(`/driver/communication/${order.id}`)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Contact
          </Button>
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Order Details</TabsTrigger>
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
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
                  {order.customer_phone && (
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                        <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${order.customer_phone}`)}>
                          <Phone className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
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
                    <Package className="h-5 w-5" />
                    Delivery Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Priority</p>
                    <Badge variant={order.priority === "urgent" ? "destructive" : "outline"}>{order.priority}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Estimated Delivery</p>
                    <p className="text-sm text-muted-foreground">{eta ? `Today at ${eta}` : "Calculating..."}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Special Instructions</p>
                    <p className="text-sm text-muted-foreground">{order.delivery_notes || "No special instructions"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Addresses
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Pickup Address</p>
                      <p className="text-sm text-muted-foreground mb-2">{order.pickup_address}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.pickup_address)}`,
                          )
                        }
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Navigate to Pickup
                      </Button>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Delivery Address</p>
                      <p className="text-sm text-muted-foreground mb-2">{order.delivery_address}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`,
                          )
                        }
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Navigate to Delivery
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="navigation" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Route Navigation</CardTitle>
                <CardDescription>Optimized route for your delivery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Route className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                      <p className="font-medium">Route Map</p>
                      <p className="text-sm text-muted-foreground">Interactive map would be displayed here</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Button
                      className="w-full"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(order.pickup_address)}&destination=${encodeURIComponent(order.delivery_address)}`,
                        )
                      }
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      Open in Google Maps
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => router.push("/driver/route-optimizer")}>
                      <Route className="mr-2 h-4 w-4" />
                      Optimize Route
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communication" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Customer</CardTitle>
                  <CardDescription>Communicate with the customer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.customer_phone && (
                    <Button className="w-full justify-start" onClick={() => window.open(`tel:${order.customer_phone}`)}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call Customer
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/driver/communication/${order.id}?type=customer`)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Send Message
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Admin</CardTitle>
                  <CardDescription>Report issues or get support</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/driver/communication/${order.id}?type=admin`)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Contact Admin
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/driver/orders/${order.id}/report-issue`)}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Report Issue
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
