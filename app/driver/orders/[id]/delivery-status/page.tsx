"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, CheckCircle, AlertTriangle, Package, MapPin, Clock, Camera, FileText } from "lucide-react"

export default function DeliveryStatusPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const orderId = params.id as string

  const handleDeliveryStatus = async (status: "delivered" | "failed") => {
    setLoading(true)
    try {
      // Update order status temporarily
      const { error } = await supabase
        .from("orders")
        .update({
          status: status === "delivered" ? "in_transit" : "in_transit", // Keep as in_transit until POD is submitted
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)

      if (error) throw error

      // Navigate to appropriate POD page
      if (status === "delivered") {
        router.push(`/driver/orders/${orderId}/pod`)
      } else {
        router.push(`/driver/orders/${orderId}/failure`)
      }
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update delivery status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Delivery Status</h1>
            <p className="text-muted-foreground">Order #{orderId}</p>
          </div>
        </div>

        {/* Status Selection */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Package className="h-6 w-6" />
              How did the delivery go?
            </CardTitle>
            <CardDescription>Select the delivery outcome to proceed with the appropriate documentation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Successful Delivery Option */}
            <Card className="border-2 border-green-200 hover:border-green-300 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <Button
                  onClick={() => handleDeliveryStatus("delivered")}
                  disabled={loading}
                  className="w-full h-auto p-6 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <div className="flex flex-col items-center gap-3">
                    <CheckCircle className="h-12 w-12" />
                    <div className="text-center">
                      <div className="text-lg font-semibold">Delivery Successful</div>
                      <div className="text-sm opacity-90">Package delivered to customer</div>
                    </div>
                  </div>
                </Button>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Camera className="h-4 w-4" />
                    <span>Take delivery photos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <FileText className="h-4 w-4" />
                    <span>Get customer signature</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <MapPin className="h-4 w-4" />
                    <span>Record delivery location</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Failed Delivery Option */}
            <Card className="border-2 border-red-200 hover:border-red-300 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <Button
                  onClick={() => handleDeliveryStatus("failed")}
                  disabled={loading}
                  variant="destructive"
                  className="w-full h-auto p-6"
                  size="lg"
                >
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle className="h-12 w-12" />
                    <div className="text-center">
                      <div className="text-lg font-semibold">Delivery Failed</div>
                      <div className="text-sm opacity-90">Unable to complete delivery</div>
                    </div>
                  </div>
                </Button>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <FileText className="h-4 w-4" />
                    <span>Document failure reason</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <Camera className="h-4 w-4" />
                    <span>Take evidence photos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <Clock className="h-4 w-4" />
                    <span>Record attempt details</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 rounded-full p-2">
                  <Package className="h-4 w-4 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-medium text-blue-900">Important</h4>
                  <p className="text-sm text-blue-700">
                    You must complete the appropriate Proof of Delivery (POD) documentation regardless of the delivery
                    outcome. This ensures proper record keeping and customer service.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
