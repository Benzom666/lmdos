"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Package,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Phone,
  Search,
  Camera,
  Calendar,
  User,
  Clock,
  FileText,
  RotateCcw,
  Eye,
  Download,
} from "lucide-react"

interface Delivery {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  delivery_address: string
  status: string
  priority: string
  created_at: string
  completed_at?: string
  failed_at?: string
  failure_reason?: string
  pod_photos?: number
  failure_photos?: number
}

export default function DeliveriesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("completed")

  useEffect(() => {
    if (profile) {
      fetchDeliveries()
    }
  }, [profile])

  const fetchDeliveries = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const response = await fetch(`/api/deliveries?driverId=${profile.user_id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch deliveries")
      }

      const data = await response.json()
      setDeliveries(data.deliveries || [])
    } catch (error) {
      console.error("Error fetching deliveries:", error)
      toast({
        title: "Error",
        description: "Failed to load deliveries. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const retryDelivery = async (deliveryId: string) => {
    try {
      const response = await fetch(`/api/deliveries/${deliveryId}/retry`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to retry delivery")
      }

      toast({
        title: "Delivery Retry Scheduled",
        description: "The delivery has been scheduled for retry",
      })

      fetchDeliveries()
    } catch (error) {
      console.error("Error retrying delivery:", error)
      toast({
        title: "Error",
        description: "Failed to retry delivery. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      delivered: {
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle,
        label: "Delivered",
      },
      failed: {
        color: "bg-red-50 text-red-700 border-red-200",
        icon: AlertTriangle,
        label: "Failed",
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: Package,
      label: status.replace("_", " "),
    }

    const Icon = config.icon

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: { color: "bg-red-100 text-red-800 border-red-200", label: "Urgent" },
      high: { color: "bg-orange-100 text-orange-800 border-orange-200", label: "High" },
      normal: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Normal" },
      low: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Low" },
    }

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal

    return (
      <Badge variant="outline" className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    )
  }

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      delivery.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.delivery_address.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesDate =
      dateFilter === "all" ||
      (() => {
        const deliveryDate = new Date(delivery.created_at)
        const now = new Date()

        switch (dateFilter) {
          case "today":
            return deliveryDate.toDateString() === now.toDateString()
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return deliveryDate >= weekAgo
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return deliveryDate >= monthAgo
          default:
            return true
        }
      })()

    return matchesSearch && matchesDate
  })

  const getDeliveriesByTab = (tab: string) => {
    switch (tab) {
      case "completed":
        return filteredDeliveries.filter((delivery) => delivery.status === "delivered")
      case "failed":
        return filteredDeliveries.filter((delivery) => delivery.status === "failed")
      default:
        return filteredDeliveries
    }
  }

  const getTabCount = (tab: string) => {
    return getDeliveriesByTab(tab).length
  }

  if (!profile) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Delivery History</h1>
            <p className="text-muted-foreground">Review your completed and failed deliveries</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/driver/orders")}>
            <Package className="mr-2 h-4 w-4" />
            Active Orders
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order number, customer, or address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed ({getTabCount("completed")})
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Failed ({getTabCount("failed")})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="completed" className="mt-6">
            <DeliveryList
              deliveries={getDeliveriesByTab("completed")}
              loading={loading}
              type="completed"
              onViewPOD={(deliveryId) => router.push(`/driver/deliveries/${deliveryId}/pod`)}
              onViewDetails={(deliveryId) => router.push(`/driver/orders/${deliveryId}`)}
              onNavigate={(address) =>
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
              }
              onContact={(phone) => window.open(`tel:${phone}`)}
            />
          </TabsContent>

          <TabsContent value="failed" className="mt-6">
            <DeliveryList
              deliveries={getDeliveriesByTab("failed")}
              loading={loading}
              type="failed"
              onViewFailureReport={(deliveryId) => router.push(`/driver/deliveries/${deliveryId}/failure-report`)}
              onRetry={retryDelivery}
              onViewDetails={(deliveryId) => router.push(`/driver/orders/${deliveryId}`)}
              onNavigate={(address) =>
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
              }
              onContact={(phone) => window.open(`tel:${phone}`)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

function DeliveryList({
  deliveries,
  loading,
  type,
  onViewPOD,
  onViewFailureReport,
  onRetry,
  onViewDetails,
  onNavigate,
  onContact,
}: {
  deliveries: Delivery[]
  loading: boolean
  type: "completed" | "failed"
  onViewPOD?: (deliveryId: string) => void
  onViewFailureReport?: (deliveryId: string) => void
  onRetry?: (deliveryId: string) => void
  onViewDetails: (deliveryId: string) => void
  onNavigate: (address: string) => void
  onContact: (phone: string) => void
}) {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      delivered: {
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle,
        label: "Delivered",
      },
      failed: {
        color: "bg-red-50 text-red-700 border-red-200",
        icon: AlertTriangle,
        label: "Failed",
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: Package,
      label: status.replace("_", " "),
    }

    const Icon = config.icon

    return (
      <Badge variant="outline" className={config.color}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      urgent: { color: "bg-red-100 text-red-800 border-red-200", label: "Urgent" },
      high: { color: "bg-orange-100 text-orange-800 border-orange-200", label: "High" },
      normal: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Normal" },
      low: { color: "bg-gray-100 text-gray-800 border-gray-200", label: "Low" },
    }

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal

    return (
      <Badge variant="outline" className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            {type === "completed" ? (
              <>
                <CheckCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No completed deliveries</h3>
                <p className="text-muted-foreground">Your completed deliveries will appear here</p>
              </>
            ) : (
              <>
                <AlertTriangle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No failed deliveries</h3>
                <p className="text-muted-foreground">Your failed deliveries will appear here</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => (
        <Card key={delivery.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-lg">#{delivery.order_number}</h3>
                  {getStatusBadge(delivery.status)}
                  {getPriorityBadge(delivery.priority)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {type === "completed" && delivery.completed_at
                    ? new Date(delivery.completed_at).toLocaleDateString()
                    : type === "failed" && delivery.failed_at
                      ? new Date(delivery.failed_at).toLocaleDateString()
                      : new Date(delivery.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Customer & Address Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{delivery.customer_name}</span>
                  </div>
                  {delivery.customer_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <button
                        className="text-blue-600 hover:underline text-sm"
                        onClick={() => onContact(delivery.customer_phone!)}
                      >
                        {delivery.customer_phone}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Delivery Address</p>
                      <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Failure Reason */}
              {type === "failed" && delivery.failure_reason && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Failure Reason</span>
                  </div>
                  <p className="text-sm text-red-700">{delivery.failure_reason}</p>
                </div>
              )}

              {/* POD/Evidence Info */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {type === "completed" && (
                  <div className="flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    POD Photos: {delivery.pod_photos || 0}
                  </div>
                )}
                {type === "failed" && (
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Evidence Photos: {delivery.failure_photos || 0}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {type === "completed" ? "Completed" : "Failed"}:{" "}
                  {type === "completed" && delivery.completed_at
                    ? new Date(delivery.completed_at).toLocaleTimeString()
                    : type === "failed" && delivery.failed_at
                      ? new Date(delivery.failed_at).toLocaleTimeString()
                      : "N/A"}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => onViewDetails(delivery.id)}>
                  <Eye className="mr-1 h-3 w-3" />
                  View Details
                </Button>

                <Button variant="outline" size="sm" onClick={() => onNavigate(delivery.delivery_address)}>
                  <MapPin className="mr-1 h-3 w-3" />
                  View Location
                </Button>

                {type === "completed" && onViewPOD && (
                  <Button variant="outline" size="sm" onClick={() => onViewPOD(delivery.id)}>
                    <Camera className="mr-1 h-3 w-3" />
                    View POD
                  </Button>
                )}

                {type === "failed" && (
                  <>
                    {onViewFailureReport && (
                      <Button variant="outline" size="sm" onClick={() => onViewFailureReport(delivery.id)}>
                        <FileText className="mr-1 h-3 w-3" />
                        View Report
                      </Button>
                    )}
                    {onRetry && (
                      <Button size="sm" onClick={() => onRetry(delivery.id)}>
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Retry Delivery
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
