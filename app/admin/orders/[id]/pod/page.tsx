"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order, type OrderUpdate } from "@/lib/supabase"
import { ArrowLeft, FileText, Download, Camera, Clock, Package, CheckCircle } from "lucide-react"

export default function ProofOfDeliveryPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [deliveryUpdate, setDeliveryUpdate] = useState<OrderUpdate | null>(null)

  const orderId = params.id as string

  useEffect(() => {
    if (orderId && profile) {
      fetchPODDetails()
    }
  }, [orderId, profile])

  const fetchPODDetails = async () => {
    if (!profile) return

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

      // Fetch delivery update (POD)
      const { data: updateData, error: updateError } = await supabase
        .from("order_updates")
        .select("*")
        .eq("order_id", orderId)
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (updateError && updateError.code !== "PGRST116") {
        throw updateError
      }

      setDeliveryUpdate(updateData as OrderUpdate)
    } catch (error) {
      console.error("Error fetching POD details:", error)
      toast({
        title: "Error",
        description: "Failed to load proof of delivery. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadPOD = () => {
    if (!order || !deliveryUpdate) return

    const podData = {
      orderNumber: order.order_number,
      customerName: order.customer_name,
      deliveryAddress: order.delivery_address,
      deliveredAt: deliveryUpdate.created_at,
      deliveryNotes: deliveryUpdate.notes,
      photoUrl: deliveryUpdate.photo_url,
    }

    const dataStr = JSON.stringify(podData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `POD-${order.order_number}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">Loading proof of delivery...</div>
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

  if (order.status !== "delivered" || !deliveryUpdate) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Proof of Delivery</h1>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Proof of delivery is not available for this order.</p>
                <p className="text-sm text-muted-foreground mt-2">POD is only available for delivered orders.</p>
              </div>
            </CardContent>
          </Card>
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
            <h1 className="text-2xl font-bold">Proof of Delivery</h1>
            <p className="text-muted-foreground">Order #{order.order_number}</p>
          </div>
          <div className="ml-auto">
            <Button onClick={downloadPOD}>
              <Download className="mr-2 h-4 w-4" />
              Download POD
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Delivery Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Order Number</p>
                <p className="text-sm text-muted-foreground">{order.order_number}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Customer</p>
                <p className="text-sm text-muted-foreground">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Delivery Address</p>
                <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Package className="mr-1 h-3 w-3" />
                  Delivered
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Delivered At</p>
                <p className="text-sm text-muted-foreground">{new Date(deliveryUpdate.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Delivery Location</p>
                <p className="text-sm text-muted-foreground">
                  {deliveryUpdate.latitude && deliveryUpdate.longitude
                    ? `${deliveryUpdate.latitude}, ${deliveryUpdate.longitude}`
                    : "Location not recorded"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Delivery Notes</p>
                <p className="text-sm text-muted-foreground">{deliveryUpdate.notes || "No additional notes"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {deliveryUpdate.photo_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Delivery Photo{(() => {
                  try {
                    const photos = JSON.parse(deliveryUpdate.photo_url)
                    return Array.isArray(photos) && photos.length > 1 ? "s" : ""
                  } catch {
                    return ""
                  }
                })()}
              </CardTitle>
              <CardDescription>
                Photo{(() => {
                  try {
                    const photos = JSON.parse(deliveryUpdate.photo_url)
                    return Array.isArray(photos) && photos.length > 1 ? "s" : ""
                  } catch {
                    return ""
                  }
                })()} taken at the time of delivery as proof of completion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(() => {
                  try {
                    const photos = JSON.parse(deliveryUpdate.photo_url)
                    if (Array.isArray(photos)) {
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {photos.map((photo, index) => (
                            <div key={index} className="relative">
                              <img
                                src={photo || "/placeholder.svg"}
                                alt={`Proof of delivery ${index + 1}`}
                                className="w-full h-48 object-cover rounded-lg border"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = "/placeholder.svg"
                                }}
                              />
                              <Badge className="absolute top-2 left-2 text-xs">Photo {index + 1}</Badge>
                            </div>
                          ))}
                        </div>
                      )
                    } else {
                      // Single photo (legacy format)
                      return (
                        <div className="max-w-md mx-auto">
                          <img
                            src={deliveryUpdate.photo_url || "/placeholder.svg"}
                            alt="Proof of delivery"
                            className="w-full h-auto rounded-lg border"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/placeholder.svg"
                            }}
                          />
                        </div>
                      )
                    }
                  } catch (error) {
                    // Fallback for invalid JSON
                    return (
                      <div className="max-w-md mx-auto">
                        <img
                          src={deliveryUpdate.photo_url || "/placeholder.svg"}
                          alt="Proof of delivery"
                          className="w-full h-auto rounded-lg border"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/placeholder.svg"
                          }}
                        />
                      </div>
                    )
                  }
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Digital Signature
            </CardTitle>
            <CardDescription>
              {(() => {
                try {
                  const notes = deliveryUpdate.notes || ""
                  return notes.includes("SIGNATURE DATA:")
                    ? "Customer signature captured"
                    : "Confirmation of successful delivery"
                } catch {
                  return "Confirmation of successful delivery"
                }
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              try {
                const notes = deliveryUpdate.notes || ""
                const signatureMatch = notes.match(/SIGNATURE DATA:\s*([\s\S]*?)(?:\n\n|$)/)

                if (signatureMatch && signatureMatch[1]) {
                  const signatureData = signatureMatch[1].trim()
                  return (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50">
                        <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Customer Signature Captured</span>
                        </div>
                        <div
                          className="bg-white border rounded-lg p-4 max-h-48 overflow-auto"
                          dangerouslySetInnerHTML={{ __html: signatureData }}
                        />
                      </div>
                    </div>
                  )
                } else {
                  return (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Digitally Confirmed</p>
                        <p className="text-xs text-muted-foreground">
                          This delivery was confirmed by the driver at the time of completion
                        </p>
                        <div className="flex items-center justify-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Verified Delivery</span>
                        </div>
                      </div>
                    </div>
                  )
                }
              } catch {
                return (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Digitally Confirmed</p>
                      <p className="text-xs text-muted-foreground">
                        This delivery was confirmed by the driver at the time of completion
                      </p>
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Verified Delivery</span>
                      </div>
                    </div>
                  </div>
                )
              }
            })()}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
