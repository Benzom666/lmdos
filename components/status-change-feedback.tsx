"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle, Clock, Truck, Package, AlertCircle, Navigation, XCircle, Store, Loader2 } from "lucide-react"

interface StatusChangeFeedbackProps {
  orderId: string
  currentStatus: string
  orderNumber: string
  hasShopifyConnection?: boolean
  onStatusChanged?: () => void
}

const statusOptions = [
  { value: "pending", label: "Pending", icon: Clock, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "assigned", label: "Assigned", icon: Truck, color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "picked_up", label: "Picked Up", icon: Package, color: "bg-purple-50 text-purple-700 border-purple-200" },
  {
    value: "in_transit",
    label: "In Transit",
    icon: Navigation,
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  { value: "delivered", label: "Delivered", icon: CheckCircle, color: "bg-green-50 text-green-700 border-green-200" },
  { value: "failed", label: "Failed", icon: AlertCircle, color: "bg-red-50 text-red-700 border-red-200" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, color: "bg-gray-50 text-gray-700 border-gray-200" },
]

export function StatusChangeFeedback({
  orderId,
  currentStatus,
  orderNumber,
  hasShopifyConnection = false,
  onStatusChanged,
}: StatusChangeFeedbackProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)
  const [notes, setNotes] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [shopifyUpdated, setShopifyUpdated] = useState(false)
  const { toast } = useToast()

  const handleStatusChange = async () => {
    if (selectedStatus === currentStatus) {
      toast({
        title: "No Change",
        description: "Please select a different status to update.",
        variant: "default",
      })
      return
    }

    setIsUpdating(true)
    setShopifyUpdated(false)

    try {
      const response = await fetch("/api/change-order-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          status: selectedStatus,
          notes: notes.trim() || null,
          adminId: "current-admin-id", // This should be passed from the parent component
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update order status")
      }

      // Check if Shopify was updated
      if (result.shopify_updated) {
        setShopifyUpdated(true)
      }

      toast({
        title: "Status Updated",
        description: `Order ${orderNumber} status changed to ${selectedStatus.replace("_", " ")}${
          result.shopify_updated ? " and Shopify store has been updated" : ""
        }`,
        variant: "default",
      })

      // Call the callback to refresh the parent component
      if (onStatusChanged) {
        onStatusChanged()
      }
    } catch (error) {
      console.error("Error updating order status:", error)
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update order status",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const getCurrentStatusInfo = () => {
    return statusOptions.find((option) => option.value === currentStatus)
  }

  const getSelectedStatusInfo = () => {
    return statusOptions.find((option) => option.value === selectedStatus)
  }

  const currentStatusInfo = getCurrentStatusInfo()
  const selectedStatusInfo = getSelectedStatusInfo()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Update Order Status
        </CardTitle>
        <CardDescription>
          Change the status of order {orderNumber}
          {hasShopifyConnection && (
            <span className="flex items-center gap-1 mt-1 text-blue-600">
              <Store className="h-3 w-3" />
              Connected to Shopify - will auto-update store when delivered
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Current Status</Label>
          {currentStatusInfo && (
            <Badge variant="outline" className={`mt-1 ${currentStatusInfo.color}`}>
              <currentStatusInfo.icon className="mr-1 h-3 w-3" />
              {currentStatusInfo.label}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-select">New Status</Label>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select new status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <option.icon className="h-4 w-4" />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add any notes about this status change..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {selectedStatus === "delivered" && hasShopifyConnection && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <Store className="h-4 w-4" />
              <span className="font-medium">Shopify Integration</span>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              This order will be automatically marked as fulfilled in your Shopify store when delivered.
            </p>
          </div>
        )}

        {shopifyUpdated && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Shopify Updated</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              The order has been successfully marked as fulfilled in your Shopify store.
            </p>
          </div>
        )}

        <Button
          onClick={handleStatusChange}
          disabled={selectedStatus === currentStatus || isUpdating}
          className="w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Status...
            </>
          ) : (
            <>
              Update to {selectedStatusInfo?.label}
              {selectedStatus === "delivered" && hasShopifyConnection && <Store className="ml-2 h-4 w-4" />}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
