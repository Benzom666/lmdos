"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, AlertCircle, RefreshCw, List, Navigation } from "lucide-react"

// Mapbox GL JS types
declare global {
  interface Window {
    mapboxgl: any
  }
}

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

interface MapboxMapProps {
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

// Generate consistent coordinates based on order ID
const generateOrderCoordinates = (orderId: string): [number, number] => {
  let hash = 0
  for (let i = 0; i < orderId.length; i++) {
    const char = orderId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  // Toronto area coordinates with more spread
  const baseLatitude = 43.6532
  const baseLongitude = -79.3832
  const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.3 // ±0.15 degrees (~17km)
  const lngOffset = (((Math.abs(hash) >> 10) % 1000) / 1000 - 0.5) * 0.4 // ±0.2 degrees (~20km)

  return [baseLatitude + latOffset, baseLongitude + lngOffset]
}

export function MapboxMap({
  orders = [],
  driverLocations = [],
  routeZones = [],
  warehouseLocation,
  warehouseName = "Warehouse",
  title = "Delivery Map",
  height = "400px",
  onOrderClick,
  className,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const markersRef = useRef<any[]>([])

  // Load Mapbox GL JS
  useEffect(() => {
    const loadMapbox = async () => {
      try {
        // Check if Mapbox is already loaded
        if (window.mapboxgl) {
          initializeMap()
          return
        }

        // Load Mapbox GL JS CSS
        const cssLink = document.createElement("link")
        cssLink.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
        cssLink.rel = "stylesheet"
        document.head.appendChild(cssLink)

        // Load Mapbox GL JS
        const script = document.createElement("script")
        script.src = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"
        script.onload = () => {
          console.log("✅ Mapbox GL JS loaded successfully")
          initializeMap()
        }
        script.onerror = () => {
          console.error("❌ Failed to load Mapbox GL JS")
          setMapError("Failed to load map library")
          setShowFallback(true)
        }
        document.head.appendChild(script)
      } catch (error) {
        console.error("❌ Error loading Mapbox:", error)
        setMapError("Failed to initialize map")
        setShowFallback(true)
      }
    }

    loadMapbox()

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  const initializeMap = useCallback(() => {
    if (!mapContainer.current || map.current || !window.mapboxgl) return

    try {
      // Set access token
      window.mapboxgl.accessToken =
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
        "pk.eyJ1IjoiZGVsaXZlcnlvcyIsImEiOiJjbTRxeWJkZGcwMGNzMmxzZWVqZGNkZGVkIn0.example"

      // Create map
      map.current = new window.mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: warehouseLocation ? [warehouseLocation[1], warehouseLocation[0]] : [-79.3832, 43.6532], // Toronto
        zoom: 11,
        attributionControl: false,
      })

      // Add navigation controls
      map.current.addControl(new window.mapboxgl.NavigationControl(), "top-right")

      map.current.on("load", () => {
        console.log("✅ Mapbox map loaded successfully")
        setMapLoaded(true)
        setMapError(null)
        addMarkersToMap()
      })

      map.current.on("error", (e: any) => {
        console.error("❌ Mapbox error:", e)
        setMapError("Map failed to load properly")
        setShowFallback(true)
      })
    } catch (error) {
      console.error("❌ Error initializing map:", error)
      setMapError("Failed to create map")
      setShowFallback(true)
    }
  }, [warehouseLocation])

  const addMarkersToMap = useCallback(() => {
    if (!map.current || !window.mapboxgl) return

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const bounds = new window.mapboxgl.LngLatBounds()

    // Add warehouse marker
    if (warehouseLocation) {
      const warehouseEl = document.createElement("div")
      warehouseEl.className = "warehouse-marker"
      warehouseEl.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #1e40af, #1d4ed8);
          border: 3px solid white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
            <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
          </svg>
        </div>
      `

      const warehouseMarker = new window.mapboxgl.Marker(warehouseEl)
        .setLngLat([warehouseLocation[1], warehouseLocation[0]])
        .setPopup(
          new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 12px;">
              <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">🏢 ${warehouseName}</h3>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">Distribution Center</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;">
                📍 ${warehouseLocation[0].toFixed(4)}, ${warehouseLocation[1].toFixed(4)}
              </p>
            </div>
          `),
        )
        .addTo(map.current)

      markersRef.current.push(warehouseMarker)
      bounds.extend([warehouseLocation[1], warehouseLocation[0]])
    }

    // Add order markers
    if (orders && orders.length > 0) {
      orders.forEach((order) => {
        const [lat, lng] = generateOrderCoordinates(order.id)

        const orderEl = document.createElement("div")
        orderEl.className = "order-marker"

        const priorityColors = {
          urgent: "#ef4444",
          high: "#f97316",
          normal: "#3b82f6",
          low: "#6b7280",
        }

        const statusColors = {
          pending: "#f59e0b",
          assigned: "#3b82f6",
          in_transit: "#8b5cf6",
          delivered: "#10b981",
          failed: "#ef4444",
        }

        const color = priorityColors[order.priority] || priorityColors.normal
        const size = order.priority === "urgent" ? 32 : order.priority === "high" ? 28 : 24

        orderEl.innerHTML = `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            position: relative;
          ">
            <svg width="12" height="12" fill="white" viewBox="0 0 24 24">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
            </svg>
            ${
              order.priority === "urgent"
                ? `
              <div style="
                position: absolute;
                top: -2px;
                right: -2px;
                width: 8px;
                height: 8px;
                background: #fbbf24;
                border: 1px solid white;
                border-radius: 50%;
                animation: pulse 2s infinite;
              "></div>
            `
                : ""
            }
          </div>
        `

        const orderMarker = new window.mapboxgl.Marker(orderEl)
          .setLngLat([lng, lat])
          .setPopup(
            new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 12px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">#${order.order_number}</h3>
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #374151;">${order.customer_name}</p>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">${order.delivery_address}</p>
                <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                  <span style="
                    padding: 2px 6px;
                    font-size: 10px;
                    border-radius: 4px;
                    background: ${color}20;
                    color: ${color};
                    font-weight: 500;
                  ">${order.priority}</span>
                  <span style="
                    padding: 2px 6px;
                    font-size: 10px;
                    border-radius: 4px;
                    background: ${statusColors[order.status as keyof typeof statusColors] || "#6b7280"}20;
                    color: ${statusColors[order.status as keyof typeof statusColors] || "#6b7280"};
                    font-weight: 500;
                  ">${order.status}</span>
                </div>
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}
                </p>
              </div>
            `),
          )
          .addTo(map.current)

        // Add click handler
        orderEl.addEventListener("click", () => {
          if (onOrderClick) {
            onOrderClick(order.id)
          }
        })

        markersRef.current.push(orderMarker)
        bounds.extend([lng, lat])
      })
    }

    // Add driver markers
    if (driverLocations && driverLocations.length > 0) {
      driverLocations.forEach((driver) => {
        const driverEl = document.createElement("div")
        driverEl.className = "driver-marker"
        driverEl.innerHTML = `
          <div style="
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #10b981, #059669);
            border: 4px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
            position: relative;
          ">
            <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
            <div style="
              position: absolute;
              top: -2px;
              right: -2px;
              width: 12px;
              height: 12px;
              background: #22c55e;
              border: 2px solid white;
              border-radius: 50%;
              animation: pulse 2s infinite;
            "></div>
          </div>
        `

        const driverMarker = new window.mapboxgl.Marker(driverEl)
          .setLngLat([driver.location[1], driver.location[0]])
          .setPopup(
            new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 12px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #059669;">🚛 ${driver.name}</h3>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #374151;">${driver.orders} active orders</p>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Status: ${driver.status}</p>
                <p style="margin: 0 0 8px 0; font-size: 11px; color: #9ca3af;">
                  Last seen: ${new Date(driver.last_seen).toLocaleTimeString()}
                </p>
                <div style="
                  padding: 4px 8px;
                  font-size: 10px;
                  border-radius: 4px;
                  background: #dcfce7;
                  color: #166534;
                  font-weight: 500;
                  text-align: center;
                ">🟢 Live Tracking</div>
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #9ca3af;">
                  📍 ${driver.location[0].toFixed(4)}, ${driver.location[1].toFixed(4)}
                </p>
              </div>
            `),
          )
          .addTo(map.current)

        markersRef.current.push(driverMarker)
        bounds.extend([driver.location[1], driver.location[0]])
      })
    }

    // Add route zones if available
    if (routeZones && routeZones.length > 0) {
      routeZones.forEach((zone) => {
        // Add zone circle
        if (map.current.getSource(`zone-${zone.id}`)) {
          map.current.removeLayer(`zone-${zone.id}-fill`)
          map.current.removeLayer(`zone-${zone.id}-line`)
          map.current.removeSource(`zone-${zone.id}`)
        }

        const radiusInMeters = zone.radius * 1000 // Convert km to meters
        const center = [zone.center[1], zone.center[0]] // [lng, lat]

        // Create circle polygon
        const createCircle = (center: number[], radiusInMeters: number, points = 64) => {
          const coords = []
          for (let i = 0; i < points; i++) {
            const angle = (i / points) * 2 * Math.PI
            const dx = radiusInMeters * Math.cos(angle)
            const dy = radiusInMeters * Math.sin(angle)
            const lat = center[1] + dy / 111320
            const lng = center[0] + dx / (111320 * Math.cos((center[1] * Math.PI) / 180))
            coords.push([lng, lat])
          }
          coords.push(coords[0]) // Close the polygon
          return coords
        }

        map.current.addSource(`zone-${zone.id}`, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [createCircle(center, radiusInMeters)],
            },
          },
        })

        map.current.addLayer({
          id: `zone-${zone.id}-fill`,
          type: "fill",
          source: `zone-${zone.id}`,
          paint: {
            "fill-color": zone.color,
            "fill-opacity": 0.1,
          },
        })

        map.current.addLayer({
          id: `zone-${zone.id}-line`,
          type: "line",
          source: `zone-${zone.id}`,
          paint: {
            "line-color": zone.color,
            "line-width": 2,
            "line-opacity": 0.8,
          },
        })
      })
    }

    // Fit map to show all markers
    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
      })
    }

    // Add pulsing animation CSS
    const style = document.createElement("style")
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
    `
    document.head.appendChild(style)
  }, [orders, driverLocations, routeZones, warehouseLocation, warehouseName, onOrderClick])

  // Update markers when data changes
  useEffect(() => {
    if (mapLoaded) {
      addMarkersToMap()
    }
  }, [mapLoaded, addMarkersToMap])

  const toggleView = () => {
    setShowFallback(!showFallback)
  }

  // Fallback list view
  if (showFallback || mapError) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              {title} - List View
            </CardTitle>
            <div className="flex items-center gap-2">
              {orders && orders.length > 0 && (
                <Badge variant="outline">
                  {orders.length} order{orders.length !== 1 ? "s" : ""}
                </Badge>
              )}
              {!mapError && (
                <Button variant="outline" size="sm" onClick={toggleView}>
                  <MapPin className="h-4 w-4 mr-1" />
                  Map View
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4" style={{ height }}>
            {mapError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Map Error: {mapError}</span>
                </div>
              </div>
            )}

            {/* Warehouse */}
            {warehouseLocation && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-sm"></div>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-900">{warehouseName}</h4>
                    <p className="text-xs text-blue-700">
                      📍 {warehouseLocation[0].toFixed(4)}, {warehouseLocation[1].toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Orders */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {orders && orders.length > 0 ? (
                orders.map((order) => {
                  const [lat, lng] = generateOrderCoordinates(order.id)
                  return (
                    <div
                      key={order.id}
                      className="p-3 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer"
                      onClick={() => onOrderClick?.(order.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">#{order.order_number}</span>
                        <Badge
                          className={`text-xs ${
                            order.priority === "urgent"
                              ? "bg-red-100 text-red-800"
                              : order.priority === "high"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {order.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.delivery_address}</p>
                      <p className="text-xs text-gray-400">
                        📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No orders to display</p>
                </div>
              )}
            </div>

            {/* Drivers */}
            {driverLocations && driverLocations.length > 0 && (
              <div className="space-y-2">
                {driverLocations.map((driver) => (
                  <div key={driver.id} className="p-3 border rounded-lg bg-green-50">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                        <Navigation className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-medium text-green-900">{driver.name}</span>
                      <Badge className="bg-green-100 text-green-800 text-xs">🟢 Live</Badge>
                    </div>
                    <p className="text-xs text-green-700">
                      📍 {driver.location[0].toFixed(4)}, {driver.location[1].toFixed(4)}
                    </p>
                    <p className="text-xs text-green-600">{driver.orders} active orders</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {orders && orders.length > 0 && (
              <Badge variant="outline">
                {orders.length} order{orders.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {driverLocations && driverLocations.length > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Navigation className="h-3 w-3 mr-1" />
                {driverLocations.length} drivers
              </Badge>
            )}
            {routeZones && routeZones.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {routeZones.length} zones
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={toggleView}>
              <List className="h-4 w-4 mr-1" />
              List View
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div ref={mapContainer} className="w-full rounded-lg overflow-hidden" style={{ height }} />
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Loading interactive map...</p>
                <p className="text-xs text-gray-500 mt-1">Initializing Mapbox GL JS</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
