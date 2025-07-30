"use client"

import type React from "react"

import { useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  Camera,
  Upload,
  X,
  AlertTriangle,
  MapPin,
  Clock,
  FileText,
  CheckCircle,
  Calendar,
} from "lucide-react"

interface FailurePhoto {
  id: string
  file: File
  preview: string
}

export default function DeliveryFailurePage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [photos, setPhotos] = useState<FailurePhoto[]>([])
  const [failureForm, setFailureForm] = useState({
    reason: "",
    customReason: "",
    notes: "",
    attemptedDelivery: false,
    contactedCustomer: false,
    leftAtLocation: false,
    rescheduleRequested: false,
    rescheduleDate: "",
    location: "",
  })

  const orderId = params.id as string

  const failureReasons = [
    "Customer not available",
    "Incorrect address",
    "Access denied to building/area",
    "Package damaged during transport",
    "Customer refused delivery",
    "Weather conditions",
    "Vehicle breakdown",
    "Safety concerns",
    "Other (specify below)",
  ]

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (photos.length >= 3) {
        toast({
          title: "Photo Limit Reached",
          description: "You can upload a maximum of 3 photos",
          variant: "destructive",
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const newPhoto: FailurePhoto = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          file,
          preview: e.target?.result as string,
        }
        setPhotos((prev) => [...prev, newPhoto])
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
  }

  const handleSubmit = async () => {
    if (!failureForm.reason) {
      toast({
        title: "Missing Information",
        description: "Please select a failure reason",
        variant: "destructive",
      })
      return
    }

    if (failureForm.reason === "Other (specify below)" && !failureForm.customReason) {
      toast({
        title: "Missing Information",
        description: "Please specify the custom reason",
        variant: "destructive",
      })
      return
    }

    if (!failureForm.notes) {
      toast({
        title: "Missing Information",
        description: "Please provide detailed notes about the failure",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append("orderId", orderId)
      formData.append(
        "reason",
        failureForm.reason === "Other (specify below)" ? failureForm.customReason : failureForm.reason,
      )
      formData.append("notes", failureForm.notes)
      formData.append("attemptedDelivery", failureForm.attemptedDelivery.toString())
      formData.append("contactedCustomer", failureForm.contactedCustomer.toString())
      formData.append("leftAtLocation", failureForm.leftAtLocation.toString())
      formData.append("rescheduleRequested", failureForm.rescheduleRequested.toString())
      formData.append("rescheduleDate", failureForm.rescheduleDate)
      formData.append("location", failureForm.location)
      formData.append("driverId", profile?.user_id || "")

      // Add photos
      photos.forEach((photo, index) => {
        formData.append(`photo_${index}`, photo.file)
      })

      const response = await fetch("/api/delivery-failure", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to submit failure report")
      }

      toast({
        title: "Failure Report Submitted",
        description: "Your delivery failure report has been recorded successfully",
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

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Report Delivery Failure</h1>
            <p className="text-muted-foreground">Order #{orderId}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Failure Reason */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Failure Reason
                </CardTitle>
                <CardDescription>Select the primary reason for the delivery failure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Primary Reason *</Label>
                  <Select
                    value={failureForm.reason}
                    onValueChange={(value) => setFailureForm((prev) => ({ ...prev, reason: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {failureReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {failureForm.reason === "Other (specify below)" && (
                  <div className="space-y-2">
                    <Label>Custom Reason *</Label>
                    <Input
                      value={failureForm.customReason}
                      onChange={(e) => setFailureForm((prev) => ({ ...prev, customReason: e.target.value }))}
                      placeholder="Please specify the reason"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Detailed Notes *</Label>
                  <Textarea
                    value={failureForm.notes}
                    onChange={(e) => setFailureForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Provide detailed information about what happened, any attempts made, and relevant circumstances..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Delivery Attempts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                  Delivery Attempts
                </CardTitle>
                <CardDescription>Check all actions you attempted before marking as failed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attemptedDelivery"
                      checked={failureForm.attemptedDelivery}
                      onCheckedChange={(checked) =>
                        setFailureForm((prev) => ({ ...prev, attemptedDelivery: checked as boolean }))
                      }
                    />
                    <Label htmlFor="attemptedDelivery" className="text-sm font-medium">
                      Attempted delivery at the address
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="contactedCustomer"
                      checked={failureForm.contactedCustomer}
                      onCheckedChange={(checked) =>
                        setFailureForm((prev) => ({ ...prev, contactedCustomer: checked as boolean }))
                      }
                    />
                    <Label htmlFor="contactedCustomer" className="text-sm font-medium">
                      Contacted customer via phone/message
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="leftAtLocation"
                      checked={failureForm.leftAtLocation}
                      onCheckedChange={(checked) =>
                        setFailureForm((prev) => ({ ...prev, leftAtLocation: checked as boolean }))
                      }
                    />
                    <Label htmlFor="leftAtLocation" className="text-sm font-medium">
                      Left delivery notice at location
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rescheduleRequested"
                      checked={failureForm.rescheduleRequested}
                      onCheckedChange={(checked) =>
                        setFailureForm((prev) => ({ ...prev, rescheduleRequested: checked as boolean }))
                      }
                    />
                    <Label htmlFor="rescheduleRequested" className="text-sm font-medium">
                      Customer requested reschedule
                    </Label>
                  </div>
                </div>

                {failureForm.rescheduleRequested && (
                  <div className="space-y-2 mt-4 p-4 bg-blue-50 rounded-lg border">
                    <Label>Requested Reschedule Date</Label>
                    <Input
                      type="datetime-local"
                      value={failureForm.rescheduleDate}
                      onChange={(e) => setFailureForm((prev) => ({ ...prev, rescheduleDate: e.target.value }))}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evidence Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-purple-500" />
                  Evidence Photos
                </CardTitle>
                <CardDescription>Upload up to 3 photos as evidence (optional but recommended)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={photos.length >= 3}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photos.length >= 3}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </Button>
                </div>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoCapture}
                  className="hidden"
                />

                {photos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={photo.preview || "/placeholder.svg"}
                          alt="Evidence"
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removePhoto(photo.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Photos help provide context and evidence for the delivery failure. Include images of the delivery
                  location, access issues, or package condition.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Location Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-500" />
                  Location Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Location (Optional)</Label>
                  <Input
                    value={failureForm.location}
                    onChange={(e) => setFailureForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Describe your current location"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <MapPin className="mr-2 h-4 w-4" />
                  Get Current Location
                </Button>
              </CardContent>
            </Card>

            {/* Timestamp */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Report Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Report Time:</span>
                  <span className="font-medium">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Photos:</span>
                  <span className="font-medium">{photos.length}/3</span>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !failureForm.reason || !failureForm.notes}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Report...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Submit Failure Report
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  This will mark the delivery as failed and notify the admin
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
