"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { DriverDashboardLayout } from "@/components/driver-dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import {
  ArrowLeft,
  Camera,
  Download,
  Share,
  MapPin,
  User,
  Phone,
  Calendar,
  Package,
  CheckCircle,
  ImageIcon,
  ZoomIn,
  AlertTriangle,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface PODPhoto {
  id: string
  url: string
  caption?: string
  timestamp: string
}

export default function PODViewPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [photos, setPhotos] = useState<PODPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<PODPhoto | null>(null)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)

  useEffect(() => {
    if (profile && orderId) {
      fetchOrderAndPOD()
    }
  }, [profile, orderId])

  const fetchOrderAndPOD = async () => {
    try {
      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("driver_id", profile?.user_id)
        .single()

      if (orderError) throw orderError

      setOrder(orderData)

      // Parse photo URLs from the order
      if (orderData.photo_url) {
        try {
          const photoUrls = JSON.parse(orderData.photo_url)
          const podPhotos: PODPhoto[] = photoUrls.map((url: string, index: number) => ({
            id: `photo_${index}`,
            url,
            caption: `Proof of Delivery ${index + 1}`,
            timestamp: orderData.completed_at || orderData.updated_at,
          }))
          setPhotos(podPhotos)
        } catch (parseError) {
          // If it's a single URL string, treat it as one photo
          setPhotos([
            {
              id: "photo_1",
              url: orderData.photo_url,
              caption: "Proof of Delivery",
              timestamp: orderData.completed_at || orderData.updated_at,
            },
          ])
        }
      }
    } catch (error) {
      console.error("Error fetching order and POD:", error)
      toast({
        title: "Error",
        description: "Failed to load proof of delivery. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadPhoto = async (photo: PODPhoto) => {
    try {
      const response = await fetch(photo.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `POD_${order?.order_number}_${photo.id}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download Started",
        description: "Photo download has started",
      })
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download photo. Please try again.",
        variant: "destructive",
      })
    }
  }

  const sharePhoto = async (photo: PODPhoto) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Proof of Delivery - ${order?.order_number}`,
          text: `Delivery completed for order ${order?.order_number}`,
          url: photo.url,
        })
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(photo.url)
      toast({
        title: "Link Copied",
        description: "Photo link copied to clipboard",
      })
    }
  }

  const openPhotoDialog = (photo: PODPhoto) => {
    setSelectedPhoto(photo)
    setPhotoDialogOpen(true)
  }

  if (loading) {
    return (
      <DriverDashboardLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DriverDashboardLayout>
    )
  }

  if (!order) {
    return (
      <DriverDashboardLayout title="Order Not Found">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The requested order could not be found or you don't have access to it.
          </p>
          <Button onClick={() => router.push("/driver/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </div>
      </DriverDashboardLayout>
    )
  }

  return (
    <DriverDashboardLayout
      title="Proof of Delivery"
      headerActions={
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order #{order.order_number}
              </CardTitle>
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="mr-1 h-3 w-3" />
                Delivered
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Information */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{order.customer_name}</p>
                    {order.customer_phone && <p className="text-sm text-muted-foreground">{order.customer_phone}</p>}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Delivery Address</p>
                    <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Completed</p>
                    <p className="text-sm text-muted-foreground">
                      {order.completed_at
                        ? new Date(order.completed_at).toLocaleString()
                        : new Date(order.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {order.delivery_notes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Delivery Notes</p>
                    <p className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">{order.delivery_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proof of Delivery Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Proof of Delivery Photos ({photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Photos Available</h3>
                <p className="text-muted-foreground">No proof of delivery photos were captured for this order.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Photo Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <div
                        className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openPhotoDialog(photo)}
                      >
                        <img
                          src={photo.url || "/placeholder.svg"}
                          alt={photo.caption || "Proof of delivery"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/placeholder.svg?height=300&width=300&text=Image+Not+Found"
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      {/* Photo Actions */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadPhoto(photo)
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            sharePhoto(photo)
                          }}
                        >
                          <Share className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Photo Caption */}
                      <div className="mt-2">
                        <p className="text-sm font-medium">{photo.caption}</p>
                        <p className="text-xs text-muted-foreground">{new Date(photo.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bulk Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      photos.forEach((photo) => downloadPhoto(photo))
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download All Photos
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (photos.length > 0) {
                        sharePhoto(photos[0])
                      }
                    }}
                  >
                    <Share className="mr-2 h-4 w-4" />
                    Share Delivery Proof
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => router.push(`/driver/orders/${orderId}`)}>
                View Full Order Details
              </Button>
              <Button variant="outline" onClick={() => router.push("/driver/deliveries")}>
                View All Deliveries
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`,
                  )
                }
              >
                <MapPin className="mr-2 h-4 w-4" />
                View on Map
              </Button>
              {order.customer_phone && (
                <Button variant="outline" onClick={() => window.open(`tel:${order.customer_phone}`)}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call Customer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Photo Viewer Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedPhoto?.caption}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => selectedPhoto && downloadPhoto(selectedPhoto)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => selectedPhoto && sharePhoto(selectedPhoto)}>
                  <Share className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>{selectedPhoto && new Date(selectedPhoto.timestamp).toLocaleString()}</DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-0">
            {selectedPhoto && (
              <div className="relative">
                <img
                  src={selectedPhoto.url || "/placeholder.svg"}
                  alt={selectedPhoto.caption || "Proof of delivery"}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=400&width=600&text=Image+Not+Found"
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DriverDashboardLayout>
  )
}
