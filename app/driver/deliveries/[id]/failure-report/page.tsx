"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import {
  ArrowLeft,
  AlertTriangle,
  MapPin,
  Clock,
  FileText,
  ImageIcon,
  Calendar,
  User,
  Phone,
  RotateCcw,
  CheckCircle,
  X,
  MessageSquare,
} from "lucide-react"

interface FailureReport {
  id: string
  order_id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  delivery_address: string
  failure_reason: string
  notes: string
  attempted_delivery: boolean
  contacted_customer: boolean
  left_at_location: boolean
  reschedule_requested: boolean
  reschedule_date?: string
  location: string
  photos: string[]
  created_at: string
  driver_name: string
}

export default function FailureReportPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<FailureReport | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  const reportId = params.id as string

  useEffect(() => {
    if (reportId && profile) {
      fetchFailureReport()
    }
  }, [reportId, profile])

  const fetchFailureReport = async () => {
    if (!profile) return

    try {
      setLoading(true)
      const response = await fetch(`/api/failure-reports/${reportId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch failure report")
      }

      const data = await response.json()
      setReport(data.report)
    } catch (error) {
      console.error("Error fetching failure report:", error)
      toast({
        title: "Error",
        description: "Failed to load failure report. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const retryDelivery = async () => {
    if (!report) return

    try {
      const response = await fetch(`/api/deliveries/${report.order_id}/retry`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to retry delivery")
      }

      toast({
        title: "Delivery Retry Scheduled",
        description: "The delivery has been scheduled for retry",
      })

      router.push("/driver/orders")
    } catch (error) {
      console.error("Error retrying delivery:", error)
      toast({
        title: "Error",
        description: "Failed to retry delivery. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Loading failure report...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!report) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Failure report not found.</p>
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
          <div>
            <h1 className="text-2xl font-bold">Delivery Failure Report</h1>
            <p className="text-muted-foreground">Order #{report.order_number}</p>
          </div>
          <div className="ml-auto">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Failed Delivery
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Report Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Customer</p>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{report.customer_name}</span>
                      </div>
                    </div>
                    {report.customer_phone && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone</p>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{report.customer_phone}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Delivery Address</p>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-sm">{report.delivery_address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Failure Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Failure Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Failure Reason</p>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-red-800 font-medium">{report.failure_reason}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Detailed Notes</p>
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <p className="text-gray-700 whitespace-pre-wrap">{report.notes}</p>
                  </div>
                </div>

                {report.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Driver Location</p>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{report.location}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Attempts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Delivery Attempts
                </CardTitle>
                <CardDescription>Actions attempted before marking as failed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3">
                    {report.attempted_delivery ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">Attempted delivery at the address</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {report.contacted_customer ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">Contacted customer via phone/message</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {report.left_at_location ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">Left delivery notice at location</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {report.reschedule_requested ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">Customer requested reschedule</span>
                  </div>
                </div>

                {report.reschedule_requested && report.reschedule_date && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Requested Reschedule Date</span>
                    </div>
                    <p className="text-blue-700 mt-1">{new Date(report.reschedule_date).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evidence Photos */}
            {report.photos && report.photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-purple-500" />
                    Evidence Photos ({report.photos.length})
                  </CardTitle>
                  <CardDescription>Photos taken as evidence of the delivery failure</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {report.photos.map((photo, index) => (
                      <Dialog key={index}>
                        <DialogTrigger asChild>
                          <div className="relative group cursor-pointer">
                            <img
                              src={photo || "/placeholder.svg"}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border hover:opacity-90 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <img
                            src={photo || "/placeholder.svg"}
                            alt={`Evidence ${index + 1}`}
                            className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                          />
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Report Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Report Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Reported:</span>
                  <span className="font-medium">{new Date(report.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">{new Date(report.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Driver:</span>
                  <span className="font-medium">{report.driver_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Evidence:</span>
                  <span className="font-medium">{report.photos?.length || 0} photos</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={retryDelivery} className="w-full">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry Delivery
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/driver/communication/${report.order_id}`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Contact Admin
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(report.delivery_address)}`,
                    )
                  }
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  View Location
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
