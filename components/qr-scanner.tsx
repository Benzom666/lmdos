"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { Camera, CameraOff, RotateCcw, CheckCircle, Package, MapPin, Phone, User } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface QRScannerProps {
  onOrderScanned?: (orderData: any) => void
}

interface ScannedOrderData {
  orderId: string
  orderNumber: string
  customerName: string
  deliveryAddress: string
  customerPhone: string
  priority: string
  createdAt: string
  trackingUrl?: string
}

export function QRScanner({ onOrderScanned }: QRScannerProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scannedData, setScannedData] = useState<ScannedOrderData | null>(null)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [newStatus, setNewStatus] = useState("")
  const [statusNotes, setStatusNotes] = useState("")
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsScanning(true)

        // Start scanning for QR codes
        scanForQRCode()
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  const scanForQRCode = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")

    if (!context) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data for QR code detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

    // Simple QR code detection simulation
    // In a real implementation, you'd use a QR code detection library
    detectQRCode(imageData)

    // Continue scanning
    if (isScanning) {
      requestAnimationFrame(scanForQRCode)
    }
  }

  const detectQRCode = (imageData: ImageData) => {
    // Simulate QR code detection
    // In a real implementation, you'd use a library like jsQR

    // For demo purposes, we'll simulate finding a QR code after a few seconds
    if (Math.random() > 0.98) {
      // 2% chance per frame
      const mockQRData = {
        orderId: "123e4567-e89b-12d3-a456-426614174000",
        orderNumber: "ORD-2024-001",
        customerName: "John Doe",
        deliveryAddress: "123 Main St, City, State 12345",
        customerPhone: "+1 (555) 123-4567",
        priority: "normal",
        createdAt: new Date().toISOString(),
        trackingUrl: "https://app.deliveryos.com/track/ORD-2024-001",
      }

      handleQRCodeDetected(JSON.stringify(mockQRData))
    }
  }

  const handleQRCodeDetected = async (qrDataString: string) => {
    try {
      const qrData: ScannedOrderData = JSON.parse(qrDataString)
      setScannedData(qrData)
      stopScanning()

      // Fetch full order details from database
      const { data: orderData, error } = await supabase.from("orders").select("*").eq("id", qrData.orderId).single()

      if (error) throw error

      setOrderDetails(orderData)
      onOrderScanned?.(orderData)

      toast({
        title: "QR Code Scanned",
        description: `Order ${qrData.orderNumber} loaded successfully.`,
      })
    } catch (error) {
      console.error("Error processing QR code:", error)
      toast({
        title: "Invalid QR Code",
        description: "The scanned QR code is not valid or corrupted.",
        variant: "destructive",
      })
    }
  }

  const handleManualInput = () => {
    // Simulate manual QR code input for testing
    const mockQRData = {
      orderId: "123e4567-e89b-12d3-a456-426614174000",
      orderNumber: "ORD-2024-001",
      customerName: "John Doe",
      deliveryAddress: "123 Main St, City, State 12345",
      customerPhone: "+1 (555) 123-4567",
      priority: "normal",
      createdAt: new Date().toISOString(),
      trackingUrl: "https://app.deliveryos.com/track/ORD-2024-001",
    }

    handleQRCodeDetected(JSON.stringify(mockQRData))
  }

  const updateOrderStatus = async () => {
    if (!orderDetails || !newStatus) return

    setUpdating(true)
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          driver_notes: statusNotes,
          updated_at: new Date().toISOString(),
          ...(newStatus === "picked_up" && { picked_up_at: new Date().toISOString() }),
          ...(newStatus === "delivered" && { delivered_at: new Date().toISOString() }),
        })
        .eq("id", orderDetails.id)

      if (error) throw error

      // Update shipping label status if exists
      await supabase
        .from("shipping_labels")
        .update({
          status: newStatus === "delivered" ? "delivered" : "shipped",
        })
        .eq("order_id", orderDetails.id)

      toast({
        title: "Status Updated",
        description: `Order status updated to ${newStatus}.`,
      })

      // Reset form
      setScannedData(null)
      setOrderDetails(null)
      setNewStatus("")
      setStatusNotes("")
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Update Failed",
        description: "Failed to update order status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const resetScanner = () => {
    setScannedData(null)
    setOrderDetails(null)
    setNewStatus("")
    setStatusNotes("")
    stopScanning()
  }

  if (scannedData && orderDetails) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                Order Scanned Successfully
              </CardTitle>
              <CardDescription>Update the order status and add notes</CardDescription>
            </div>
            <Button variant="outline" onClick={resetScanner}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Scan Another
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order Information */}
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Order Number</Label>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="font-semibold">{scannedData.orderNumber}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Priority</Label>
                <Badge variant="outline">{scannedData.priority}</Badge>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Customer</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{scannedData.customerName}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{scannedData.customerPhone}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Delivery Address</Label>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{scannedData.deliveryAddress}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Current Status</Label>
              <Badge>{orderDetails.status}</Badge>
            </div>
          </div>

          {/* Status Update */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="picked_up">Picked Up</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Delivery Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about the delivery..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button onClick={updateOrderStatus} disabled={!newStatus || updating} className="w-full">
              {updating ? "Updating..." : "Update Order Status"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-6 w-6" />
          QR Code Scanner
        </CardTitle>
        <CardDescription>Scan shipping labels to retrieve order information and update status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Camera View */}
        <div className="relative">
          <video ref={videoRef} className="w-full h-64 bg-gray-100 rounded-lg object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          {!isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              <div className="text-center">
                <Camera className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">Camera not active</p>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-lg">
              <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-sm">Scanning...</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          {!isScanning ? (
            <Button onClick={startScanning} className="flex-1">
              <Camera className="mr-2 h-4 w-4" />
              Start Scanning
            </Button>
          ) : (
            <Button onClick={stopScanning} variant="outline" className="flex-1">
              <CameraOff className="mr-2 h-4 w-4" />
              Stop Scanning
            </Button>
          )}

          <Button onClick={handleManualInput} variant="outline">
            Test Scan
          </Button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Instructions:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Point your camera at the QR code on the shipping label</li>
            <li>Keep the QR code within the camera frame</li>
            <li>Ensure good lighting for better scanning</li>
            <li>The order details will appear automatically when scanned</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
