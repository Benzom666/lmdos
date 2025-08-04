"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { generateOrderCoordinates, generateDriverLocation } from "@/lib/coordinate-generator"
import {
  MapPin,
  Navigation,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package,
  Truck,
  Phone,
  MessageCircle,
} from "lucide-react"

interface OrderForMap {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: string
  status: string
}

interface DriverLocation {
  id: string
  name: string
  location: [number, number]
  orders: number
}

interface RouteZone {
  id: string
  name: string
  color: string
  orders: any[]
  center: [number, number]
  radius: number
}

interface FallbackMapProps {
  orders: OrderForMap[]
  driverLocations?: DriverLocation[]
  routeZones?: RouteZone[]
  onOrderClick?: (orderId: string) => void
  height?: string
}

export function FallbackMap({
  orders,
  driverLocations = [],
  routeZones = [],
  onOrderClick,
  height = "400px",
}: FallbackMapProps) {
  // Generate stable coordinates for orders
  const orderCoordinates = useMemo(() => {
    return generateOrderCoordinates(orders)
  }, [orders])

  // Generate stable coordinates for drivers
  const driverCoordinatesMap = useMemo(() => {
    const map = new Map()
    driverLocations.forEach((driver) => {
      const location = generateDriverLocation(driver.id, driver.name)
      map.set(driver.id, location)
    })
    return map
  }, [driverLocations])

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: Clock,
      assigned: Clock,
      in_transit: Navigation,
      delivered: CheckCircle,
      failed: AlertTriangle,
      cancelled: AlertTriangle,
    }
    return icons[status as keyof typeof icons] || Package
  }

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "text-gray-600 bg-gray-50 border-gray-200",
      assigned: "text-blue-600 bg-blue-50 border-blue-200",
      in_transit: "text-orange-600 bg-orange-50 border-orange-200",
      delivered: "text-green-600 bg-green-50 border-green-200",
      failed: "text-red-600 bg-red-50 border-red-200",
      cancelled: "text-gray-600 bg-gray-50 border-gray-200",
    }
    return colors[status as keyof typeof colors] || "text-gray-600 bg-gray-50 border-gray-200"
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: "text-red-700 bg-red-100 border-red-200",
      high: "text-orange-700 bg-orange-100 border-orange-200",
      normal: "text-blue-700 bg-blue-100 border-blue-200",
      low: "text-gray-700 bg-gray-100 border-gray-200",
    }
    return colors[priority as keyof typeof colors] || colors.normal
  }

  return (
    <div className="space-y-4" style={{ maxHeight: height, overflowY: "auto" }}>
      {/* Route Zones */}
      {routeZones.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-gray-700">Route Zones</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {routeZones.map((zone) => (
              <Card key={zone.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                    <span className="font-medium text-sm">{zone.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {zone.orders.length} orders
                  </Badge>
                </div>
                <div className="text-xs text-gray-600">
                  <p>
                    Center: {zone.center[0].toFixed(4)}, {zone.center[1].toFixed(4)}
                  </p>
                  <p>Radius: {zone.radius}km</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Drivers */}
      {driverLocations.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Active Drivers ({driverLocations.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {driverLocations.map((driver) => {
              const location = driverCoordinatesMap.get(driver.id)
              return (
                <Card key={driver.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-medium text-sm">{driver.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                      {driver.orders} orders
                    </Badge>
                  </div>
                  {location && (
                    <div className="text-xs text-gray-600 mb-2">
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {location.neighborhood}
                      </p>
                      <p>
                        Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="text-xs h-6 px-2 bg-transparent">
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-6 px-2 bg-transparent">
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Message
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Delivery Orders ({orders.length})
        </h4>
        <div className="space-y-2">
          {orders.map((order, index) => {
            const StatusIcon = getStatusIcon(order.status)
            const location = orderCoordinates.get(order.id)

            return (
              <Card
                key={order.id}
                className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onOrderClick?.(order.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">#{order.order_number}</p>
                      <p className="text-xs text-gray-600">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="outline" className={`text-xs ${getStatusColor(order.status)}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {order.status.replace("_", " ")}
                    </Badge>
                    {(order.priority === "urgent" || order.priority === "high") && (
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(order.priority)}`}>
                        {order.priority}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <p className="flex items-start gap-1">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{order.delivery_address}</span>
                  </p>
                  {location && (
                    <p className="text-gray-500">
                      📍 {location.neighborhood} • {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </p>
                  )}
                </div>

                <div className="flex gap-1 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 px-2 bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`,
                        "_blank",
                      )
                    }}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Navigate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 px-2 bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOrderClick?.(order.id)
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {orders.length === 0 && driverLocations.length === 0 && routeZones.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No data to display</p>
          </div>
        </div>
      )}
    </div>
  )
}
