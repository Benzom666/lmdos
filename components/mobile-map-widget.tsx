"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import MapboxMap from "@/components/mapbox-map"
import { Navigation, Maximize2, Eye } from "lucide-react"

interface MobileMapWidgetProps {
  orders?: Array<{
    id: string
    order_number: string
    customer_name: string
    delivery_address: string
    priority: string
    status: string
    stop_number?: number
  }>
  driverLocation?: [number, number]
  isOptimized?: boolean
  title?: string
  className?: string
}

export default function MobileMapWidget({
  orders = [],
  driverLocation,
  isOptimized = false,
  title = "Delivery Map",
  className = "",
}: MobileMapWidgetProps) {
  const [showFullMap, setShowFullMap] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  if (showFullMap) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="outline" size="sm" onClick={() => setShowFullMap(false)}>
              Close
            </Button>
          </div>
          <div className="flex-1">
            <MapboxMap
              orders={orders}
              driverLocation={driverLocation}
              height="100%"
              title=""
              showFullscreenToggle={false}
              className="h-full"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Navigation className="h-4 w-4 text-blue-600" />
            {title}
            {orders.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {orders.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            {isMobile && (
              <Button variant="outline" size="sm" onClick={() => setShowFullMap(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <MapboxMap
            orders={orders}
            driverLocation={driverLocation}
            height={isMobile ? "250px" : "400px"}
            title=""
            showControls={!isMobile}
            showFullscreenToggle={false}
          />

          {/* Mobile overlay for better UX */}
          {isMobile && (
            <div className="absolute inset-0 bg-transparent" onClick={() => setShowFullMap(true)}>
              <div className="absolute bottom-2 right-2">
                <Button size="sm" className="shadow-lg">
                  <Eye className="h-4 w-4 mr-1" />
                  View Full
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
