"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  Camera,
  Upload,
  CheckCircle,
  MapPin,
  Pen,
  RotateCcw,
  User,
  Package,
  Clock,
  AlertCircle,
  X,
  ImageIcon,
  AlertTriangle,
  FileText,
  Calendar,
} from "lucide-react"

// Enhanced signature component with better touch support
const SignaturePad = ({ onSignatureChange }: { onSignatureChange: (signature: string) => void }) => {
  const [isDrawing, setIsDrawing] = useState(false)
  const [paths, setPaths] = useState<string[]>([])
  const [currentPath, setCurrentPath] = useState<string>("")
  const svgRef = useRef<SVGSVGElement>(null)

  const getCoordinates = (event: React.MouseEvent | React.TouchEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }

    const rect = svg.getBoundingClientRect()
    const clientX = "touches" in event ? event.touches[0].clientX : event.clientX
    const clientY = "touches" in event ? event.touches[0].clientY : event.clientY

    return {
      x: ((clientX - rect.left) / rect.width) * 400,
      y: ((clientY - rect.top) / rect.height) * 200,
    }
  }

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault()
    setIsDrawing(true)
    const { x, y } = getCoordinates(event)
    setCurrentPath(`M ${x} ${y}`)
  }

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    event.preventDefault()
    const { x, y } = getCoordinates(event)
    setCurrentPath((prev) => `${prev} L ${x} ${y}`)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    if (currentPath) {
      setPaths((prev) => [...prev, currentPath])
      setCurrentPath("")
    }
  }

  const clearSignature = () => {
    setPaths([])
    setCurrentPath("")
    onSignatureChange("")
  }

  useEffect(() => {
    if (paths.length > 0 || currentPath) {
      const svgString = `
        <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
          ${paths.map((path) => `<path d="${path}" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />`).join("")}
          ${currentPath ? `<path d="${currentPath}" stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />` : ""}
        </svg>
      `
      onSignatureChange(svgString)
    }
  }, [paths, currentPath, onSignatureChange])

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
        <svg
          ref={svgRef}
          width="100%"
          height="200"
          viewBox="0 0 400 200"
          className="border rounded cursor-crosshair bg-white touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ touchAction: "none" }}
        >
          {paths.map((path, index) => (
            <path
              key={index}
              d={path}
              stroke="black"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {currentPath && (
            <path
              d={currentPath}
              stroke="black"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-muted-foreground">Sign above to confirm delivery</p>
          <Button variant="ghost" size="sm" onClick={clearSignature}>
            <RotateCcw className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ProofOfDeliveryPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [deliveryMode, setDeliveryMode] = useState<"success" | "failure" | null>(null)

  // Enhanced photo capture states - now supporting multiple photos
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [cameraActive, setCameraActive] = useState(false)

  // Signature capture states
  const [signatureData, setSignatureData] = useState<string>("")

  // Form states for successful delivery
  const [customerName, setCustomerName] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [deliveryTime, setDeliveryTime] = useState<string>("")

  // Form states for failed delivery
  const [failureReason, setFailureReason] = useState<string>("")
  const [failureNotes, setFailureNotes] = useState<string>("")
  const [attemptedDelivery, setAttemptedDelivery] = useState(false)
  const [contactedCustomer, setContactedCustomer] = useState(false)
  const [leftAtLocation, setLeftAtLocation] = useState(false)
  const [rescheduleRequested, setRescheduleRequested] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState<string>("")

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const orderId = params.id as string
  const MINIMUM_PHOTOS = deliveryMode === "success" ? 3 : 1

  // Failure reason options
  const failureReasons = [
    { value: "customer_not_available", label: "Customer Not Available" },
    { value: "incorrect_address", label: "Incorrect Address" },
    { value: "access_denied", label: "Access Denied to Building/Area" },
    { value: "customer_refused", label: "Customer Refused Delivery" },
    { value: "damaged_package", label: "Package Damaged" },
    { value: "security_concerns", label: "Security Concerns" },
    { value: "weather_conditions", label: "Adverse Weather Conditions" },
    { value: "vehicle_breakdown", label: "Vehicle Breakdown" },
    { value: "traffic_delays", label: "Severe Traffic Delays" },
    { value: "customer_requested_reschedule", label: "Customer Requested Reschedule" },
    { value: "business_closed", label: "Business Closed" },
    { value: "no_safe_location", label: "No Safe Location to Leave Package" },
    { value: "other", label: "Other (Please specify in notes)" },
  ]

  useEffect(() => {
    if (orderId && profile) {
      fetchOrderDetails()
      getCurrentLocation()
      setDeliveryTime(new Date().toLocaleString())
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
      setCustomerName(orderData.customer_name)
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

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error getting location:", error)
          toast({
            title: "Location Error",
            description: "Unable to get current location. Documentation will be submitted without location data.",
            variant: "destructive",
          })
        },
      )
    }
  }

  // Enhanced photo capture functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please use file upload instead.",
        variant: "destructive",
      })
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && photos.length < 5) {
      const canvas = document.createElement("canvas")
      const video = videoRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context = canvas.getContext("2d")
      if (context) {
        context.drawImage(video, 0, 0)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `delivery-photo-${photos.length + 1}.jpg`, { type: "image/jpeg" })
              const preview = canvas.toDataURL()

              setPhotos((prev) => [...prev, file])
              setPhotoPreviews((prev) => [...prev, preview])

              if (photos.length + 1 >= MINIMUM_PHOTOS) {
                stopCamera()
              }

              toast({
                title: "Photo Captured",
                description: `Photo ${photos.length + 1} captured successfully.`,
              })
            }
          },
          "image/jpeg",
          0.8,
        )
      }
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      setCameraActive(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    if (photos.length + files.length > 5) {
      toast({
        title: "Too Many Photos",
        description: "Maximum 5 photos allowed. Please remove some photos first.",
        variant: "destructive",
      })
      return
    }

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPhotos((prev) => [...prev, file])
        setPhotoPreviews((prev) => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const uploadPromises = files.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    })

    return Promise.all(uploadPromises)
  }

  const submitSuccessfulDelivery = async () => {
    if (!order || !profile) return

    // Enhanced validation for successful delivery
    if (photos.length < MINIMUM_PHOTOS) {
      toast({
        title: "Insufficient Photos",
        description: `Please capture at least ${MINIMUM_PHOTOS} photos as proof of delivery.`,
        variant: "destructive",
      })
      return
    }

    // Signature is now optional - remove this validation block entirely

    if (!customerName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter the name of the person who received the package.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      // Upload all photos
      const photoDataArray = await uploadFiles(photos)

      // Update order status to delivered
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      if (orderError) throw orderError

      // Create comprehensive order update record with POD
      const podNotes = `
PROOF OF DELIVERY COMPLETED
Delivered to: ${customerName}
Delivery Time: ${deliveryTime}
Photos Captured: ${photos.length}
Signature: ${signatureData ? "Captured" : "Not Required"}
Additional Notes: ${notes || "Package delivered successfully"}

${signatureData ? `SIGNATURE DATA:\n${signatureData}` : "CONTACTLESS DELIVERY - No signature required"}
      `.trim()

      const { error: updateError } = await supabase.from("order_updates").insert({
        order_id: order.id,
        driver_id: profile.user_id,
        status: "delivered",
        notes: podNotes,
        photo_url: JSON.stringify(photoDataArray),
        latitude: location?.lat || null,
        longitude: location?.lng || null,
      })

      if (updateError) throw updateError

      toast({
        title: "Delivery Completed",
        description: `Proof of delivery submitted successfully with ${photos.length} photos and signature!`,
      })

      router.push("/driver/orders")
    } catch (error) {
      console.error("Error submitting POD:", error)
      toast({
        title: "Error",
        description: "Failed to submit proof of delivery. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const submitFailedDelivery = async () => {
    if (!order || !profile) return

    // Validation for failed delivery
    if (!failureReason) {
      toast({
        title: "Missing Information",
        description: "Please select a reason for the failed delivery.",
        variant: "destructive",
      })
      return
    }

    if (photos.length < MINIMUM_PHOTOS) {
      toast({
        title: "Evidence Required",
        description: "Please capture at least 1 photo as evidence of the delivery attempt.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      // Upload evidence photos
      const photoDataArray = await uploadFiles(photos)

      // Update order status to failed
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)

      if (orderError) throw orderError

      // Create failure report
      const { error: reportError } = await supabase.from("delivery_failures").insert({
        order_id: order.id,
        driver_id: profile.user_id,
        failure_reason: failureReasons.find((r) => r.value === failureReason)?.label || failureReason,
        notes: failureNotes,
        attempted_delivery: attemptedDelivery,
        contacted_customer: contactedCustomer,
        left_at_location: leftAtLocation,
        reschedule_requested: rescheduleRequested,
        reschedule_date: rescheduleDate || null,
        location: location ? `${location.lat}, ${location.lng}` : null,
        photos: JSON.stringify(photoDataArray),
      })

      if (reportError) throw reportError

      // Create order update record
      await supabase.from("order_updates").insert({
        order_id: order.id,
        driver_id: profile.user_id,
        status: "failed",
        notes: `Delivery failed: ${failureReasons.find((r) => r.value === failureReason)?.label}. ${failureNotes}`,
        photo_url: JSON.stringify(photoDataArray),
        latitude: location?.lat || null,
        longitude: location?.lng || null,
      })

      toast({
        title: "Failure Report Submitted",
        description: "Delivery failure has been documented successfully.",
      })

      router.push("/driver/orders")
    } catch (error) {
      console.error("Error submitting failure report:", error)
      toast({
        title: "Error",
        description: "Failed to submit failure report. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading order details...</p>
          </div>
        </div>
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

  // If no delivery mode selected, show selection screen
  if (!deliveryMode) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Delivery Documentation</h1>
              <p className="text-muted-foreground">Order #{order.order_number}</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="font-medium">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Time</p>
                  <p className="font-medium">{deliveryTime}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Delivery Address</p>
                  <p className="font-medium">{order.delivery_address}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Outcome Selection */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Select Delivery Outcome</CardTitle>
              <CardDescription>Choose the appropriate option to complete the delivery documentation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Successful Delivery Option */}
              <Card className="border-2 border-green-200 hover:border-green-300 transition-colors cursor-pointer">
                <CardContent className="pt-6">
                  <Button
                    onClick={() => setDeliveryMode("success")}
                    className="w-full h-auto p-6 bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <CheckCircle className="h-12 w-12" />
                      <div className="text-center">
                        <div className="text-lg font-semibold">Complete Delivery</div>
                        <div className="text-sm opacity-90">Package successfully delivered</div>
                      </div>
                    </div>
                  </Button>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Camera className="h-4 w-4" />
                      <span>Minimum 3 delivery photos required</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Pen className="h-4 w-4" />
                      <span>Customer signature required</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <User className="h-4 w-4" />
                      <span>Recipient name required</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Failed Delivery Option */}
              <Card className="border-2 border-red-200 hover:border-red-300 transition-colors cursor-pointer">
                <CardContent className="pt-6">
                  <Button
                    onClick={() => setDeliveryMode("failure")}
                    variant="destructive"
                    className="w-full h-auto p-6"
                    size="lg"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <AlertTriangle className="h-12 w-12" />
                      <div className="text-center">
                        <div className="text-lg font-semibold">Report Failed/Unsuccessful Delivery</div>
                        <div className="text-sm opacity-90">Unable to complete delivery</div>
                      </div>
                    </div>
                  </Button>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-red-700">
                      <FileText className="h-4 w-4" />
                      <span>Failure reason required</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-700">
                      <Camera className="h-4 w-4" />
                      <span>Evidence photo required</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-red-700">
                      <Clock className="h-4 w-4" />
                      <span>Attempt details required</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setDeliveryMode(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {deliveryMode === "success" ? "Proof of Delivery" : "Delivery Failure Report"}
            </h1>
            <p className="text-muted-foreground">Order #{order.order_number}</p>
          </div>
          <Badge variant={deliveryMode === "success" ? "default" : "destructive"} className="ml-auto">
            {deliveryMode === "success" ? "Successful Delivery" : "Failed Delivery"}
          </Badge>
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
                <p className="text-sm font-medium text-muted-foreground">Customer</p>
                <p className="font-medium">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Documentation Time</p>
                <p className="font-medium">{deliveryTime}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p className="font-medium">{order.delivery_address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation Form */}
        <Card>
          <CardHeader>
            <CardTitle>{deliveryMode === "success" ? "Delivery Confirmation" : "Failure Documentation"}</CardTitle>
            <CardDescription>
              {deliveryMode === "success"
                ? `Complete all sections below to confirm delivery. Minimum ${MINIMUM_PHOTOS} photos and signature required.`
                : "Document the delivery failure with reason and evidence."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Successful Delivery Form */}
            {deliveryMode === "success" && (
              <>
                {/* Customer Confirmation */}
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Received by (Required)
                  </Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter name of person who received the package"
                    required
                    className="font-medium"
                  />
                </div>

                {/* Signature Section */}
                <div className="space-y-4">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Pen className="h-4 w-4" />
                    Customer Signature (Optional)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Ask the customer to sign below to confirm receipt of the package (optional for contactless
                    deliveries).
                  </p>
                  <SignaturePad onSignatureChange={setSignatureData} />
                </div>

                {/* Delivery Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes about the delivery (e.g., left with neighbor, special instructions followed, etc.)"
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Failed Delivery Form */}
            {deliveryMode === "failure" && (
              <>
                {/* Failure Reason */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Failure Reason (Required)
                  </Label>
                  <Select value={failureReason} onValueChange={setFailureReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select the reason for delivery failure" />
                    </SelectTrigger>
                    <SelectContent>
                      {failureReasons.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Delivery Attempt Details */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Delivery Attempt Details</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="attemptedDelivery"
                        checked={attemptedDelivery}
                        onCheckedChange={(checked) => setAttemptedDelivery(checked as boolean)}
                      />
                      <Label htmlFor="attemptedDelivery" className="text-sm">
                        I attempted to deliver the package
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="contactedCustomer"
                        checked={contactedCustomer}
                        onCheckedChange={(checked) => setContactedCustomer(checked as boolean)}
                      />
                      <Label htmlFor="contactedCustomer" className="text-sm">
                        I contacted or attempted to contact the customer
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="leftAtLocation"
                        checked={leftAtLocation}
                        onCheckedChange={(checked) => setLeftAtLocation(checked as boolean)}
                      />
                      <Label htmlFor="leftAtLocation" className="text-sm">
                        I left a delivery notice at the location
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rescheduleRequested"
                        checked={rescheduleRequested}
                        onCheckedChange={(checked) => setRescheduleRequested(checked as boolean)}
                      />
                      <Label htmlFor="rescheduleRequested" className="text-sm">
                        Customer requested to reschedule delivery
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Reschedule Date */}
                {rescheduleRequested && (
                  <div className="space-y-2">
                    <Label htmlFor="rescheduleDate" className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Requested Reschedule Date
                    </Label>
                    <Input
                      id="rescheduleDate"
                      type="datetime-local"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                    />
                  </div>
                )}

                {/* Failure Notes */}
                <div className="space-y-2">
                  <Label htmlFor="failureNotes">Additional Details (Required)</Label>
                  <Textarea
                    id="failureNotes"
                    value={failureNotes}
                    onChange={(e) => setFailureNotes(e.target.value)}
                    placeholder="Provide detailed information about the delivery attempt and why it failed..."
                    rows={4}
                    required
                  />
                </div>
              </>
            )}

            {/* Photo Evidence Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {deliveryMode === "success" ? "Photo Evidence" : "Evidence Photos"}
                </Label>
                <Badge variant={photos.length >= MINIMUM_PHOTOS ? "default" : "destructive"}>
                  {photos.length}/{MINIMUM_PHOTOS} minimum
                </Badge>
              </div>

              {/* Photo Grid */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview || "/placeholder.svg"}
                        alt={`${deliveryMode === "success" ? "Delivery proof" : "Evidence"} ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Badge className="absolute bottom-2 left-2 text-xs">Photo {index + 1}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Camera and Upload Controls */}
              {!cameraActive && photos.length < 5 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {deliveryMode === "success"
                      ? `Capture photos of the delivered package, delivery location, and customer (if consented). Minimum ${MINIMUM_PHOTOS} photos required.`
                      : "Capture photos as evidence of the delivery attempt (e.g., building entrance, notice left, etc.)."}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" onClick={startCamera} className="h-20">
                      <div className="text-center">
                        <Camera className="h-6 w-6 mx-auto mb-2" />
                        <span className="text-sm">Take Photos</span>
                      </div>
                    </Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-20">
                      <div className="text-center">
                        <Upload className="h-6 w-6 mx-auto mb-2" />
                        <span className="text-sm">Upload Photos</span>
                      </div>
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}

              {/* Camera View */}
              {cameraActive && (
                <div className="space-y-4">
                  <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg border max-h-64" />
                  <div className="flex gap-2 justify-center">
                    <Button onClick={capturePhoto} disabled={photos.length >= 5}>
                      <Camera className="mr-2 h-4 w-4" />
                      Capture Photo ({photos.length + 1})
                    </Button>
                    <Button variant="outline" onClick={stopCamera}>
                      Done Taking Photos
                    </Button>
                  </div>
                  <p className="text-sm text-center text-muted-foreground">
                    {photos.length < MINIMUM_PHOTOS
                      ? `${MINIMUM_PHOTOS - photos.length} more photos needed`
                      : "Minimum photos captured. You can take up to 5 total."}
                  </p>
                </div>
              )}
            </div>

            {/* Location & Time Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Documentation Time</span>
                </div>
                <p className="text-sm text-blue-700">{deliveryTime}</p>
              </div>
              {location && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 mb-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm font-medium">Location Captured</span>
                  </div>
                  <p className="text-xs text-green-600">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>

            {/* Validation Warnings */}
            {deliveryMode === "success" && (photos.length < MINIMUM_PHOTOS || !customerName.trim()) && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Completion Required</span>
                </div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {photos.length < MINIMUM_PHOTOS && (
                    <li>
                      • {MINIMUM_PHOTOS - photos.length} more photos needed (minimum {MINIMUM_PHOTOS})
                    </li>
                  )}
                  {/* Signature is now optional */}
                  {!customerName.trim() && <li>• Recipient name required</li>}
                </ul>
              </div>
            )}

            {deliveryMode === "failure" && (photos.length < MINIMUM_PHOTOS || !failureReason || !failureNotes) && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Documentation Required</span>
                </div>
                <ul className="text-sm text-red-700 space-y-1">
                  {photos.length < MINIMUM_PHOTOS && <li>• At least 1 evidence photo required</li>}
                  {!failureReason && <li>• Failure reason must be selected</li>}
                  {!failureNotes && <li>• Additional details must be provided</li>}
                </ul>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setDeliveryMode(null)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Change Selection
              </Button>

              {deliveryMode === "success" ? (
                <Button
                  onClick={submitSuccessfulDelivery}
                  disabled={submitting || photos.length < MINIMUM_PHOTOS || !customerName.trim()}
                  className="flex-1"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Complete Delivery
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={submitFailedDelivery}
                  disabled={submitting || photos.length < MINIMUM_PHOTOS || !failureReason || !failureNotes}
                  variant="destructive"
                  className="flex-1"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 h-5 w-5" />
                      Submit Failure Report
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
