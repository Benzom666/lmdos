"use client"
import { useEffect, useState } from "react"
import { MapboxMap } from "@/components/mapbox-map"

interface Order {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: "urgent" | "high" | "normal" | "low"
  status: string
}

interface DriverLocation {
  id: string
  name: string
  location: [number, number]
  orders: number
  status: string
  last_seen: string
}

interface RouteZone {
  id: string
  name: string
  color: string
  orders: Order[]
  center: [number, number]
  radius: number
  estimatedTime?: number
  totalDistance?: number
}

interface SafeMapWrapperProps {
  orders: Order[]
  driverLocations?: DriverLocation[]
  routeZones?: RouteZone[]
  warehouseLocation?: [number, number]
  warehouseName?: string
  title?: string
  height?: string
  onOrderClick?: (orderId: string) => void
  className?: string
}

const SafeMapWrapper = ({
  orders = [],
  driverLocations = [],
  routeZones = [],
  warehouseLocation,
  warehouseName = "Warehouse",
  title = "Delivery Map",
  height = "400px",
  onOrderClick,
  className,
}: SafeMapWrapperProps) => {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="flex items-center justify-center rounded-md bg-secondary p-8" style={{ height }}>
        <p className="text-sm text-muted-foreground">Map loading...</p>
      </div>
    )
  }

  return (
    <MapboxMap
      orders={orders}
      driverLocations={driverLocations}
      routeZones={routeZones}
      warehouseLocation={warehouseLocation}
      warehouseName={warehouseName}
      title={title}
      height={height}
      onOrderClick={onOrderClick}
      className={className}
    />
  )
}

export default SafeMapWrapper
