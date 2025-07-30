"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { MapPin, Package, Navigation, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"

// Define types for the map
interface RouteStop {
  order: {
    id: string
    order_number: string
    customer_name: string
    delivery_address: string
    priority: string
    status: string
  }
  estimatedTime: number
  distance: number
  type: "delivery"
}

interface RouteMapProps {
  stops: RouteStop[]
}

// Mock coordinates for demonstration (in a real app, you'd geocode addresses)
const getMockCoordinates = (address: string, index: number) => {
  // Base coordinates for a city area
  const baseLatitude = 40.7128
  const baseLongitude = -74.006

  // Create a grid-like pattern for better visualization
  const gridSize = Math.ceil(Math.sqrt(index + 1))
  const row = Math.floor(index / gridSize)
  const col = index % gridSize

  const latOffset = (row - gridSize / 2) * 0.02
  const lngOffset = (col - gridSize / 2) * 0.02

  return {
    lat: baseLatitude + latOffset,
    lng: baseLongitude + lngOffset,
  }
}

// Convert lat/lng to SVG coordinates
const coordsToSVG = (lat: number, lng: number, bounds: any, width: number, height: number) => {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width
  const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * height
  return { x, y }
}

export default function RouteMap({ stops }: RouteMapProps) {
  const [selectedStop, setSelectedStop] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)

  // Calculate bounds for all delivery stops
  const coordinates = stops.map((stop, index) => ({
    ...getMockCoordinates(stop.order.delivery_address, index),
    stop,
    index,
  }))

  const bounds = coordinates.reduce(
    (acc, coord) => ({
      minLat: Math.min(acc.minLat, coord.lat),
      maxLat: Math.max(acc.maxLat, coord.lat),
      minLng: Math.min(acc.minLng, coord.lng),
      maxLng: Math.max(acc.maxLng, coord.lng),
    }),
    {
      minLat: coordinates[0]?.lat || 0,
      maxLat: coordinates[0]?.lat || 0,
      minLng: coordinates[0]?.lng || 0,
      maxLng: coordinates[0]?.lng || 0,
    },
  )

  // Add padding to bounds
  const latPadding = (bounds.maxLat - bounds.minLat) * 0.1
  const lngPadding = (bounds.maxLng - bounds.minLng) * 0.1
  bounds.minLat -= latPadding
  bounds.maxLat += latPadding
  bounds.minLng -= lngPadding
  bounds.maxLng += lngPadding

  const mapWidth = 800
  const mapHeight = 600

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "#dc2626"
      case "high":
        return "#ea580c"
      case "normal":
        return "#059669"
      case "low":
        return "#6b7280"
      default:
        return "#059669"
    }
  }

  const openInMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank")
  }

  return (
    <div className="space-y-4">
      {/* Map Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Delivery Route Map
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom(Math.min(3, zoom + 0.25))} disabled={zoom >= 3}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Interactive Map */}
      <div className="relative bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border shadow-sm overflow-hidden">
        <div className="relative" style={{ height: "500px" }}>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Route lines connecting stops */}
            {coordinates.length > 1 && (
              <g>
                {coordinates.slice(0, -1).map((coord, index) => {
                  const currentPoint = coordsToSVG(coord.lat, coord.lng, bounds, mapWidth, mapHeight)
                  const nextCoord = coordinates[index + 1]
                  const nextPoint = coordsToSVG(nextCoord.lat, nextCoord.lng, bounds, mapWidth, mapHeight)

                  return (
                    <line
                      key={`route-${index}`}
                      x1={currentPoint.x}
                      y1={currentPoint.y}
                      x2={nextPoint.x}
                      y2={nextPoint.y}
                      stroke="#3b82f6"
                      strokeWidth="3"
                      strokeDasharray="5,5"
                      opacity="0.6"
                    />
                  )
                })}
              </g>
            )}

            {/* Delivery markers */}
            {coordinates.map((coord, index) => {
              const point = coordsToSVG(coord.lat, coord.lng, bounds, mapWidth, mapHeight)
              const isSelected = selectedStop === index
              const priorityColor = getPriorityColor(coord.stop.order.priority)

              return (
                <g key={`marker-${index}`}>
                  {/* Marker shadow */}
                  <circle cx={point.x + 2} cy={point.y + 2} r={isSelected ? "22" : "18"} fill="rgba(0,0,0,0.2)" />

                  {/* Marker background */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? "20" : "16"}
                    fill={priorityColor}
                    stroke="white"
                    strokeWidth="3"
                    className="cursor-pointer transition-all duration-200"
                    onClick={() => setSelectedStop(selectedStop === index ? null : index)}
                  />

                  {/* Marker number */}
                  <text
                    x={point.x}
                    y={point.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={isSelected ? "14" : "12"}
                    fontWeight="bold"
                    className="cursor-pointer select-none"
                    onClick={() => setSelectedStop(selectedStop === index ? null : index)}
                  >
                    {index + 1}
                  </text>

                  {/* Selection indicator */}
                  {isSelected && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="26"
                      fill="none"
                      stroke={priorityColor}
                      strokeWidth="2"
                      strokeDasharray="4,4"
                      opacity="0.8"
                    >
                      <animateTransform
                        attributeName="transform"
                        attributeType="XML"
                        type="rotate"
                        from={`0 ${point.x} ${point.y}`}
                        to={`360 ${point.x} ${point.y}`}
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Delivery details overlay */}
          {selectedStop !== null && (
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg border p-4 max-w-sm z-10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Stop {selectedStop + 1}</h4>
                <button onClick={() => setSelectedStop(null)} className="text-gray-400 hover:text-gray-600">
                  ×
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Delivery
                  </Badge>
                  <Badge
                    variant={
                      coordinates[selectedStop].stop.order.priority === "urgent"
                        ? "destructive"
                        : coordinates[selectedStop].stop.order.priority === "high"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {coordinates[selectedStop].stop.order.priority}
                  </Badge>
                </div>

                <div>
                  <p className="font-medium text-sm">#{coordinates[selectedStop].stop.order.order_number}</p>
                  <p className="text-sm text-gray-600">{coordinates[selectedStop].stop.order.customer_name}</p>
                  <p className="text-xs text-gray-500 mt-1">{coordinates[selectedStop].stop.order.delivery_address}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {coordinates[selectedStop].stop.estimatedTime} min
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {coordinates[selectedStop].stop.distance.toFixed(1)} mi
                  </span>
                </div>

                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => openInMaps(coordinates[selectedStop].stop.order.delivery_address)}
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Navigate
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Legend and Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Map Legend
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                U
              </div>
              <span>Urgent Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                H
              </div>
              <span>High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                N
              </div>
              <span>Normal Priority</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">Click on any marker to view delivery details</div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Route Summary
          </h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p>Total Deliveries: {stops.length}</p>
            <p>Total Distance: {stops.reduce((sum, stop) => sum + stop.distance, 0).toFixed(1)} mi</p>
            <p>Estimated Time: {Math.round(stops.reduce((sum, stop) => sum + stop.estimatedTime, 0))} min</p>
            <p className="text-xs text-gray-500 mt-2">Dashed lines show the optimized route sequence</p>
          </div>
        </div>
      </div>

      {/* Mobile-friendly delivery list */}
      <div className="md:hidden">
        <h4 className="font-medium text-sm mb-2">Delivery Stops</h4>
        <div className="space-y-2">
          {stops.map((stop, index) => (
            <div
              key={`${stop.order.id}-delivery`}
              className={`flex items-center gap-3 p-3 bg-white rounded border cursor-pointer transition-colors ${
                selectedStop === index ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
              }`}
              onClick={() => setSelectedStop(selectedStop === index ? null : index)}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: getPriorityColor(stop.order.priority) }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">#{stop.order.order_number}</p>
                <p className="text-xs text-gray-500 truncate">{stop.order.customer_name}</p>
                <p className="text-xs text-gray-400 truncate">{stop.order.delivery_address}</p>
              </div>
              <div className="text-right">
                <Badge
                  variant={
                    stop.order.priority === "urgent"
                      ? "destructive"
                      : stop.order.priority === "high"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-xs"
                >
                  {stop.order.priority}
                </Badge>
                <p className="text-xs text-gray-500 mt-1">{stop.estimatedTime} min</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
