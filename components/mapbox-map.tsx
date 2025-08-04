"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { MapPin, AlertCircle, RefreshCw, List, Navigation, Route, Zap } from "lucide-react"
import { geocodingService } from "@/lib/geocoding-service"
import { routeOptimizer } from "@/lib/route-optimizer"

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
  coordinates?: [number, number]
}

interface DriverLocation {
  id: string
  name: string
  location: [number, number]
  orders: number
  status: string
  last_seen: string
}

interface OptimizedRoute {
  waypoints: Array<{
    coordinates: [number, number]
    name: string
    address?: string
  }>
  distance: number
  duration: number
  geometry: [number, number][]
}

interface MapboxMapProps {
  orders: Order[]
  driverLocations?: DriverLocation[]
  warehouseLocation?: [number, number]
  warehouseName?: string
  title?: string
  height?: string
  onOrderClick?: (orderId: string) => void
  className?: string
  showRouteOptimization?: boolean
}

export function MapboxMap({
  orders = [],
  driverLocations = [],
  warehouseLocation,
  warehouseName = "Warehouse",
  title = "Delivery Map",
  height = "400px",
  onOrderClick,
  className,
  showRouteOptimization = false,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [geocodingProgress, setGeocodingProgress] = useState<{
    current: number
    total: number
    isGeocoding: boolean
  }>({ current: 0, total: 0, isGeocoding: false })
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const markersRef = useRef<any[]>([])
  const { toast } = useToast()

  // Load Mapbox GL JS
  useEffect(() => {
    const loadMapbox = async () => {
      try {
        if (window.mapboxgl) {
          initializeMap()
          return
        }

        const cssLink = document.createElement("link")
        cssLink.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
        cssLink.rel = "stylesheet"
        document.head.appendChild(cssLink)

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
      window.mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

      map.current = new window.mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: warehouseLocation ? [warehouseLocation[1], warehouseLocation[0]] : [-79.3832, 43.6532],
        zoom: 11,
        attributionControl: false,
      })

      map.current.addControl(new window.mapboxgl.NavigationControl(), "top-right")

      map.current.on("load", () => {
        console.log("✅ Mapbox map loaded successfully")
        setMapLoaded(true)
        setMapError(null)
        geocodeAndAddMarkers()
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

  const geocodeAndAddMarkers = useCallback(async () => {
    if (!map.current || !window.mapboxgl || orders.length === 0) return

    try {
      setGeocodingProgress({ current: 0, total: orders.length, isGeocoding: true })

      // Get addresses that need geocoding
      const addressesToGeocode = orders
        .filter((order) => !order.coordinates && order.delivery_address)
        .map((order) => order.delivery_address)

      if (addressesToGeocode.length > 0) {
        console.log(`🔍 Geocoding ${addressesToGeocode.length} addresses...`)

        // Batch geocode addresses
        const geocodingResults = await geocodingService.geocodeBatch(addressesToGeocode)

        // Update orders with geocoded coordinates
        const updatedOrders = orders.map((order) => {
          if (order.coordinates) return order

          const geocodingResult = geocodingResults.find((result) => result.address === order.delivery_address)
          if (geocodingResult && geocodingResult.coordinates) {
            return {
              ...order,
              coordinates: geocodingResult.coordinates,
            }
          }
          return order
        })

        // Add markers to map
        await addMarkersToMap(updatedOrders)

        const successCount = geocodingResults.filter((r) => r.coordinates).length
        const cachedCount = geocodingResults.filter((r) => r.fromCache).length

        toast({
          title: "Geocoding Complete",
          description: `Successfully geocoded ${successCount}/${addressesToGeocode.length} addresses (${cachedCount} from cache)`,
        })
      } else {
        // All orders already have coordinates
        await addMarkersToMap(orders)
      }
    } catch (error) {
      console.error("❌ Geocoding error:", error)
      toast({
        title: "Geocoding Failed",
        description: "Some addresses could not be geocoded. Using fallback locations.",
        variant: "destructive",
      })
      // Still try to add markers with existing coordinates
      await addMarkersToMap(orders)
    } finally {
      setGeocodingProgress({ current: 0, total: 0, isGeocoding: false })
    }
  }, [orders, toast])

  const addMarkersToMap = useCallback(
    async (ordersWithCoords: Order[]) => {
      if (!map.current || !window.mapboxgl) return

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

      const bounds = new window.mapboxgl.LngLatBounds()

      // Add warehouse marker
      if (warehouseLocation) {
        const warehouseEl = document.createElement("div")
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

      // Add order markers with real geocoded coordinates
      ordersWithCoords.forEach((order, index) => {
        if (!order.coordinates) return

        const [lat, lng] = order.coordinates

        const orderEl = document.createElement("div")
        const priorityColors = {
          urgent: "#ef4444",
          high: "#f97316",
          normal: "#3b82f6",
          low: "#6b7280",
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
            font-weight: bold;
            color: white;
            font-size: 10px;
          ">
            ${index + 1}
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
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">
                  Stop ${index + 1}: #${order.order_number}
                </h3>
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
                    background: #10b98120;
                    color: #10b981;
                    font-weight: 500;
                  ">${order.status}</span>
                </div>
                <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                  📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}
                </p>
              </div>
            `),
          )
          .addTo(map.current)

        orderEl.addEventListener("click", () => {
          if (onOrderClick) {
            onOrderClick(order.id)
          }
        })

        markersRef.current.push(orderMarker)
        bounds.extend([lng, lat])
      })

      // Add driver markers
      driverLocations.forEach((driver) => {
        const driverEl = document.createElement("div")
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
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
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
              </div>
            `),
          )
          .addTo(map.current)

        markersRef.current.push(driverMarker)
        bounds.extend([driver.location[1], driver.location[0]])
      })

      // Fit map to show all markers
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
        })
      }

      // Add pulsing animation CSS
      if (!document.getElementById("map-animations")) {
        const style = document.createElement("style")
        style.id = "map-animations"
        style.textContent = `
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
        `
        document.head.appendChild(style)
      }
    },
    [driverLocations, warehouseLocation, warehouseName, onOrderClick],
  )

  const optimizeRoute = useCallback(async () => {
    if (!orders.length || orders.length < 2) {
      toast({
        title: "Route Optimization",
        description: "At least 2 orders are required for route optimization.",
        variant: "destructive",
      })
      return
    }

    if (orders.length > 12) {
      toast({
        title: "Route Optimization",
        description: "Maximum 12 orders allowed for route optimization.",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)

    try {
      // First ensure all orders have coordinates
      const ordersNeedingGeocode = orders.filter((order) => !order.coordinates)
      if (ordersNeedingGeocode.length > 0) {
        toast({
          title: "Geocoding Required",
          description: `Geocoding ${ordersNeedingGeocode.length} addresses before optimization...`,
        })

        const addresses = ordersNeedingGeocode.map((order) => order.delivery_address)
        const geocodingResults = await geocodingService.geocodeBatch(addresses)

        // Update orders with coordinates
        orders.forEach((order, index) => {
          if (!order.coordinates) {
            const result = geocodingResults.find((r) => r.address === order.delivery_address)
            if (result && result.coordinates) {
              order.coordinates = result.coordinates
            }
          }
        })
      }

      // Filter orders with valid coordinates
      const validOrders = orders.filter((order) => order.coordinates)
      if (validOrders.length < 2) {
        throw new Error("Not enough orders with valid coordinates for optimization")
      }

      // Prepare waypoints for optimization
      const waypoints = validOrders.map((order, index) => ({
        coordinates: order.coordinates!,
        name: `Stop ${index + 1}: ${order.customer_name}`,
        address: order.delivery_address,
      }))

      // Add warehouse as starting point if available
      if (warehouseLocation) {
        waypoints.unshift({
          coordinates: warehouseLocation,
          name: warehouseName,
          address: "Warehouse/Distribution Center",
        })
      }

      console.log(`🚀 Optimizing route for ${waypoints.length} waypoints`)

      // Call route optimization API
      const response = await fetch("/api/optimize-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          waypoints,
          options: {
            profile: "driving",
            source: "first",
            destination: "last",
            roundtrip: false,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Route optimization failed")
      }

      const result = await response.json()
      const optimizedRoute = result.data

      setOptimizedRoute(optimizedRoute)

      // Add route to map
      if (map.current && optimizedRoute.geometry) {
        // Remove existing route
        if (map.current.getSource("optimized-route")) {
          map.current.removeLayer("optimized-route-line")
          map.current.removeSource("optimized-route")
        }

        // Add route source
        map.current.addSource("optimized-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: optimizedRoute.geometry.map((coord: [number, number]) => [coord[1], coord[0]]), // Convert to [lng, lat]
            },
          },
        })

        // Add route layer
        map.current.addLayer({
          id: "optimized-route-line",
          type: "line",
          source: "optimized-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3b82f6",
            "line-width": 4,
            "line-opacity": 0.8,
          },
        })
      }

      toast({
        title: "Route Optimized Successfully!",
        description: `Distance: ${routeOptimizer.formatDistance(optimizedRoute.distance)}, Time: ${routeOptimizer.formatDuration(optimizedRoute.duration)}`,
      })
    } catch (error) {
      console.error("❌ Route optimization error:", error)
      toast({
        title: "Route Optimization Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsOptimizing(false)
    }
  }, [orders, warehouseLocation, warehouseName, toast])

  // Update markers when data changes
  useEffect(() => {
    if (mapLoaded) {
      geocodeAndAddMarkers()
    }
  }, [mapLoaded, geocodeAndAddMarkers])

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

            {/* Orders */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {orders && orders.length > 0 ? (
                orders.map((order, index) => (
                  <div
                    key={order.id}
                    className="p-3 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer"
                    onClick={() => onOrderClick?.(order.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        Stop {index + 1}: #{order.order_number}
                      </span>
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
                    {order.coordinates && (
                      <p className="text-xs text-gray-400">
                        📍 {order.coordinates[0].toFixed(6)}, {order.coordinates[1].toFixed(6)}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No orders to display</p>
                </div>
              )}
            </div>
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
            {geocodingProgress.isGeocoding && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Geocoding {geocodingProgress.current}/{geocodingProgress.total}
              </Badge>
            )}
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
            {optimizedRoute && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                <Route className="h-3 w-3 mr-1" />
                Optimized: {routeOptimizer.formatDistance(optimizedRoute.distance)}
              </Badge>
            )}
            {showRouteOptimization && orders.length >= 2 && (
              <Button variant="outline" size="sm" onClick={optimizeRoute} disabled={isOptimizing}>
                <Zap className={`h-4 w-4 mr-1 ${isOptimizing ? "animate-spin" : ""}`} />
                {isOptimizing ? "Optimizing..." : "Optimize Route"}
              </Button>
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
          {geocodingProgress.isGeocoding && (
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium">
                  Geocoding addresses... {geocodingProgress.current}/{geocodingProgress.total}
                </span>
              </div>
            </div>
          )}
        </div>
        {optimizedRoute && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">🚀 Route Optimized Successfully!</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-green-600">Total Distance:</span>
                <span className="font-medium ml-2">{routeOptimizer.formatDistance(optimizedRoute.distance)}</span>
              </div>
              <div>
                <span className="text-green-600">Estimated Time:</span>
                <span className="font-medium ml-2">{routeOptimizer.formatDuration(optimizedRoute.duration)}</span>
              </div>
              <div>
                <span className="text-green-600">Stops:</span>
                <span className="font-medium ml-2">{optimizedRoute.waypoints.length}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
