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
import { ArrowLeft, CheckCircle, AlertTriangle, Package, User, MapPin, Calendar, RefreshCw, Clock } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function ChangeStatusPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)

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

  const handleStatusChange = async (newStatus: "delivered" | "failed") => {
    if (!order || !profile) return

    setUpdating(true)
    try {
      // If changing to delivered, redirect to POD submission
      if (newStatus === "delivered") {
        // First update status to in_transit temporarily
        const { error: statusError } = await supabase
          .from("orders")
          .update({
            status: "in_transit",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        if (statusError) throw statusError

        // Add order update record
        await supabase.from("order_updates").insert({
          order_id: orderId,
          driver_id: profile.user_id,
          status: "status_change_requested",
          notes: `Driver requested status change from ${order.status} to delivered. Redirecting to POD submission.`,
          latitude: null,
          longitude: null,
        })

        toast({
          title: "Status Change Initiated",
          description: "Please complete the POD documentation to mark as delivered.",
        })

        // Redirect to POD submission
        router.push(`/driver/orders/${orderId}/pod`)
        return
      }

      // If changing to failed/undelivered
      if (newStatus === "failed") {
        // Update order status
        const { error: statusError } = await supabase
          .from("orders")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)

        if (statusError) throw statusError

        // Add order update record
        await supabase.from("order_updates").insert({
          order_id: orderId,
          driver_id: profile.user_id,
          status: "failed",
          notes: `Status changed from ${order.status} to failed by driver. Reason: Status correction requested.`,
          latitude: null,
          longitude: null,
        })

        // If there was a previous delivery failure record, we might want to update it
        // or create a new one indicating this was a status correction

        toast({
          title: "Status Updated",
          description: "Order status has been changed to undelivered.",
        })

        router.push("/driver/orders")
      }
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
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
            Undelivered
          </Badge>
        )
      default:
        return <Badge variant="outline">{status.replace("_", " ")}</Badge>
    }
  }

  const getNewStatusInfo = (currentStatus: string) => {
    if (currentStatus === "delivered") {
      return {
        newStatus: "failed",
        newLabel: "Undelivered",
        color: "red",
        icon: AlertTriangle,
        description: "Mark this delivery as undelivered/failed",
        requirements: [
          "Order will be marked as failed",
          "Previous POD documentation will be preserved",
          "Admin will be notified of the status change",
          "Customer may be contacted for re-delivery",
        ],
      }
    } else {
      return {
        newStatus: "delivered",
        newLabel: "Delivered",
        color: "green",
        icon: CheckCircle,
        description: "Mark this delivery as successfully delivered",
        requirements: [
          "Complete POD documentation required",
          "Take delivery photos",
          "Get customer signature or confirmation",
          "Record delivery location and time",
        ],
      }
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

  const statusInfo = getNewStatusInfo(order.status)
  const StatusIcon = statusInfo.icon

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Change Delivery Status</h1>
            <p className="text-muted-foreground">Order #{order.order_number}</p>
          </div>
        </div>

        {/* Current Order Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Current Order Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{order.customer_name}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                  {getStatusBadge(order.status)}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivery Address</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{order.delivery_address}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{new Date(order.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Change Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Change Status
            </CardTitle>
            <CardDescription>
              Update the delivery status for this order. This action will be recorded and may trigger additional
              workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* New Status Option */}
            <Card
              className={`border-2 border-${statusInfo.color}-200 hover:border-${statusInfo.color}-300 transition-colors`}
            >
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-full bg-${statusInfo.color}-100`}>
                      <StatusIcon className={`h-6 w-6 text-${statusInfo.color}-600`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Mark as {statusInfo.newLabel}</h3>
                      <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
                    </div>
                  </div>

                  {/* Requirements */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">What happens next:</p>
                    <ul className="space-y-1">
                      {statusInfo.requirements.map((requirement, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2 flex-shrink-0" />
                          <span>{requirement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className={`w-full ${statusInfo.color === "green" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                        disabled={updating}
                      >
                        {updating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Updating...
                          </>
                        ) : (
                          <>
                            <StatusIcon className="mr-2 h-4 w-4" />
                            Change to {statusInfo.newLabel}
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to change this order from "{order.status.replace("_", " ")}" to "
                          {statusInfo.newLabel.toLowerCase()}"?
                          {statusInfo.newStatus === "delivered" && (
                            <span className="block mt-2 font-medium">
                              You will be redirected to complete the POD documentation.
                            </span>
                          )}
                          {statusInfo.newStatus === "failed" && (
                            <span className="block mt-2 font-medium">
                              This will mark the delivery as unsuccessful and may trigger re-delivery processes.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleStatusChange(statusInfo.newStatus as "delivered" | "failed")}
                          className={
                            statusInfo.color === "green"
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-red-600 hover:bg-red-700"
                          }
                        >
                          Confirm Change
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-full p-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-blue-900">Important Notes</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Status changes are permanently recorded in the system</li>
                    <li>• Admins will be notified of all status modifications</li>
                    <li>• Previous documentation will be preserved for audit purposes</li>
                    <li>• Customer notifications may be triggered based on the new status</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
