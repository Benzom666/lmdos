"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Save, Package, AlertTriangle, CheckCircle, User, Edit, History } from "lucide-react"

interface DeliveryFailure {
  id: string
  failure_reason: string
  notes: string
  attempted_delivery: boolean
  contacted_customer: boolean
  left_at_location: boolean
  reschedule_requested: boolean
  reschedule_date: string | null
  location: string
  photos: string[]
  created_at: string
}

interface OrderUpdate {
  id: string
  status: string
  notes: string
  photo_url: string | null
  created_at: string
}

export default function EditDeliveryPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [deliveryFailure, setDeliveryFailure] = useState<DeliveryFailure | null>(null)
  const [orderUpdates, setOrderUpdates] = useState<OrderUpdate[]>([])

  const [editForm, setEditForm] = useState({
    customerName: "",
    notes: "",
    failureReason: "",
    failureNotes: "",
    location: "",
  })

  const orderId = params.id as string

  useEffect(() => {
    if (orderId && profile) {
      fetchOrderDetails()
    }
  }, [orderId, profile])

  const fetchOrderDetails = async () => {
    if (!profile) return

    try {
      setLoading(true)

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("driver_id", profile.user_id)
        .single()

      if (orderError) throw orderError

      setOrder(orderData as Order)
      setEditForm((prev) => ({
        ...prev,
        customerName: orderData.customer_name,
      }))

      // Fetch delivery failure if order failed
      if (orderData.status === "failed") {
        const { data: failureData, error: failureError } = await supabase
          .from("delivery_failures")
          .select("*")
          .eq("order_id", orderId)
          .single()

        if (!failureError && failureData) {
          const failure = failureData as any
          setDeliveryFailure({
            ...failure,
            photos: failure.photos ? JSON.parse(failure.photos) : [],
          })
          setEditForm((prev) => ({
            ...prev,
            failureReason: failure.failure_reason,
            failureNotes: failure.notes,
            location: failure.location || "",
          }))
        }
      }

      // Fetch order updates
      const { data: updatesData, error: updatesError } = await supabase
        .from("order_updates")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })

      if (!updatesError && updatesData) {
        setOrderUpdates(updatesData as OrderUpdate[])
        // Get the latest POD notes if delivered
        const podUpdate = updatesData.find((update) => update.status === "delivered")
        if (podUpdate) {
          setEditForm((prev) => ({
            ...prev,
            notes: podUpdate.notes || "",
          }))
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

  const handleSave = async () => {
    if (!order || !profile) return

    setSaving(true)
    try {
      if (order.status === "delivered") {
        // Update POD information
        const { error: updateError } = await supabase
          .from("order_updates")
          .update({
            notes: `PROOF OF DELIVERY UPDATED
Delivered to: ${editForm.customerName}
Updated Notes: ${editForm.notes}
Last Updated: ${new Date().toLocaleString()}`,
          })
          .eq("order_id", orderId)
          .eq("status", "delivered")

        if (updateError) throw updateError
      } else if (order.status === "failed" && deliveryFailure) {
        // Update failure information
        const { error: failureError } = await supabase
          .from("delivery_failures")
          .update({
            failure_reason: editForm.failureReason,
            notes: editForm.failureNotes,
            location: editForm.location,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deliveryFailure.id)

        if (failureError) throw failureError

        // Update order update record
        const { error: updateError } = await supabase
          .from("order_updates")
          .update({
            notes: `Delivery failed: ${editForm.failureReason}. ${editForm.failureNotes}`,
          })
          .eq("order_id", orderId)
          .eq("status", "failed")

        if (updateError) throw updateError
      }

      // Update customer name if changed
      if (editForm.customerName !== order.customer_name) {
        const { error: orderError } = await supabase
          .from("orders")
          .update({
            customer_name: editForm.customerName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        if (orderError) throw orderError
      }

      toast({
        title: "Changes Saved",
        description: "Your delivery information has been updated successfully.",
      })

      router.push("/driver/orders")
    } catch (error) {
      console.error("Error saving changes:", error)
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
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
            <AlertTriangle className="mr-1 h-3 w-3" />
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Edit Delivery</h1>
            <p className="text-muted-foreground">Order #{order.order_number}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(order.status)}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Original Customer</p>
                <p className="font-medium">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivery Address</p>
                <p className="font-medium">{order.delivery_address}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Order Date</p>
                <p className="font-medium">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="font-medium">{new Date(order.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Edit Details
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-6">
            <div className="space-y-6">
              {/* Common Fields */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={editForm.customerName}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, customerName: e.target.value }))}
                      placeholder="Enter customer name"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Delivered Order Fields */}
              {order.status === "delivered" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Delivery Details
                    </CardTitle>
                    <CardDescription>Edit the proof of delivery information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="notes">Delivery Notes</Label>
                      <Textarea
                        id="notes"
                        value={editForm.notes}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Additional delivery notes..."
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Failed Order Fields */}
              {order.status === "failed" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      Failure Details
                    </CardTitle>
                    <CardDescription>Edit the delivery failure information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="failureReason">Failure Reason</Label>
                      <Input
                        id="failureReason"
                        value={editForm.failureReason}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, failureReason: e.target.value }))}
                        placeholder="Reason for delivery failure"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="failureNotes">Failure Notes</Label>
                      <Textarea
                        id="failureNotes"
                        value={editForm.failureNotes}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, failureNotes: e.target.value }))}
                        placeholder="Detailed notes about the failure..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={editForm.location}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))}
                        placeholder="Location where failure occurred"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Order History
                </CardTitle>
                <CardDescription>Complete timeline of order updates</CardDescription>
              </CardHeader>
              <CardContent>
                {orderUpdates.length > 0 ? (
                  <div className="space-y-4">
                    {orderUpdates.map((update) => (
                      <div key={update.id} className="border-l-2 border-gray-200 pl-4 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{update.status.replace("_", " ")}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(update.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{update.notes}</p>
                        {update.photo_url && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">Photos attached</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No order history available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
