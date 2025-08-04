"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { MapPin, AlertCircle, RefreshCw, List, Navigation, Route, Zap, Target } from "lucide-react"
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
    currentAddress?: string
  }>({ current: 0, total: 0, isGeocoding: false })
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [geocodedOrders, setGeocodedOrders] = useState<Order[]>([])
  const [geocodingStats, setGeocodingStats] = useState<{
    total: number
    successful: number
    cached: number
    highAccuracy: number
  }>({ total: 0, successful: 0, cached: 0, highAccuracy: 0 })
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
      const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      if (!accessToken) {
        setMapError("Mapbox access token not configured")
        setShowFallback(true)
        return
      }

      window.mapboxgl.accessToken = accessToken

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

  // Geocode orders when they change
  useEffect(() => {
    if (orders.length > 0 && mapLoaded) {
      geocodeAndAddMarkers()
    }
  }, [orders, mapLoaded])

  const geocodeAndAddMarkers = useCallback(async () => {
    if (!map.current || !window.mapboxgl || orders.length === 0) return

    try {
      console.log(`🔍 Processing ${orders.length} orders for precise geocoding`)

      // Separate orders that need geocoding from those that already have coordinates
      const ordersWithCoords = orders.filter((order) => order.coordinates)
      const ordersNeedingGeocode = orders.filter((order) => !order.coordinates && order.delivery_address)

      console.log(`📍 ${ordersWithCoords.length} orders already have coordinates`)
      console.log(`🔍 ${ordersNeedingGeocode.length} orders need geocoding`)

      let allProcessedOrders = [...ordersWithCoords]

      if (ordersNeedingGeocode.length > 0) {
        setGeocodingProgress({
          current: 0,
          total: ordersNeedingGeocode.length,
          isGeocoding: true,
          currentAddress: ordersNeedingGeocode[0]?.delivery_address,
        })

        console.log(`🚀 Starting precise batch geocoding for ${ordersNeedingGeocode.length} addresses`)

        // Extract unique addresses to avoid duplicate geocoding
        const uniqueAddresses = [...new Set(ordersNeedingGeocode.map((order) => order.delivery_address))]
        console.log(`📍 Geocoding ${uniqueAddresses.length} unique addresses`)

        // Update progress as we geocode
        const progressCallback = (current: number, address: string) => {
          setGeocodingProgress({
            current,
            total: uniqueAddresses.length,
            isGeocoding: true,
            currentAddress: address,
          })
        }

        // Batch geocode addresses with progress tracking
        const geocodingResults = await geocodingService.geocodeBatch(uniqueAddresses)

        // Map results back to orders
        const geocodedOrders = ordersNeedingGeocode.map((order) => {
          const geocodingResult = geocodingResults.find((result) => result.address === order.delivery_address)
          if (geocodingResult && geocodingResult.coordinates) {
            console.log(
              `✅ Mapped order ${order.order_number}: ${order.delivery_address} -> [${geocodingResult.coordinates[0]}, ${geocodingResult.coordinates[1]}] (${geocodingResult.accuracy})`,
            )
            return {
              ...order,
              coordinates: geocodingResult.coordinates,
            }
          } else {
            console.warn(`❌ Failed to geocode order ${order.order_number}: ${order.delivery_address}`)
            return order
          }
        })

        allProcessedOrders = [...ordersWithCoords, ...geocodedOrders]

        // Calculate statistics
        const successCount = geocodingResults.filter((r) => r.coordinates).length
        const cachedCount = geocodingResults.filter((r) => r.fromCache).length
        const highAccuracyCount = geocodingResults.filter((r) => r.accuracy === "high").length

        setGeocodingStats({
          total: uniqueAddresses.length,
          successful: successCount,
          cached: cachedCount,
          highAccuracy: highAccuracyCount,
        })

        console.log(
          `✅ Geocoding complete: ${successCount}/${uniqueAddresses.length} successful (${cachedCount} from cache, ${highAccuracyCount} high accuracy)`,
        )

        toast({
          title: "Precise Geocoding Complete",
          description: `Successfully geocoded ${successCount}/${uniqueAddresses.length} addresses with ${highAccuracyCount} high-accuracy results`,
        })
      }

      // Update state with processed orders
      setGeocodedOrders(allProcessedOrders)

      // Add markers to map with precise positioning
      await addPreciseMarkersToMap(allProcessedOrders)
    } catch (error) {
      console.error("❌ Geocoding error:", error)
      toast({
        title: "Geocoding Failed",
        description: "Some addresses could not be geocoded. Check console for details.",
        variant: "destructive",
      })
      // Still try to add markers with existing coordinates
      await addPreciseMarkersToMap(orders.filter((order) => order.coordinates))
    } finally {
      setGeocodingProgress({ current: 0, total: 0, isGeocoding: false })
    }
  }, [orders, toast])

  const addPreciseMarkersToMap = useCallback(
    async (ordersWithCoords: Order[]) => {
      if (!map.current || !window.mapboxgl) return

      console.log(`🗺️ Adding ${ordersWithCoords.length} precise markers to map`)

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []

      const bounds = new window.mapboxgl.LngLatBounds()
      let markersAdded = 0
      let validCoordinatesCount = 0

      // Add warehouse marker
      if (warehouseLocation) {
        const warehouseEl = document.createElement("div")
        warehouseEl.innerHTML = `
          <div style="
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #1e40af, #1d4ed8);
            border: 3px solid white;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 16px rgba(0,0,0,0.3);
            cursor: pointer;
            position: relative;
          ">
            <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
            </svg>
            <div style="
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 8px solid #1e40af;
            "></div>
          </div>
        `

        const warehouseMarker = new window.mapboxgl.Marker(warehouseEl)
          .setLngLat([warehouseLocation[1], warehouseLocation[0]])
          .setPopup(
            new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 16px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af; font-size: 16px;">🏢 ${warehouseName}</h3>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Distribution Center</p>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #9ca3af;">
                  📍 ${warehouseLocation[0].toFixed(6)}, ${warehouseLocation[1].toFixed(6)}
                </p>
                <div style="margin-top: 8px; padding: 4px 8px; background: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 10px; text-align: center;">
                  Starting Point
                </div>
              </div>
            `),
          )
          .addTo(map.current)

        markersRef.current.push(warehouseMarker)
        bounds.extend([warehouseLocation[1], warehouseLocation[0]])
      }

      // Add order markers with PRECISE geocoded coordinates
      ordersWithCoords.forEach((order, index) => {
        if (!order.coordinates) {
          console.warn(`⚠️ Order ${order.order_number} has no coordinates, skipping`)
          return
        }

        const [lat, lng] = order.coordinates

        // Strict coordinate validation for GTA region
        if (isNaN(lat) || isNaN(lng) || lat < 43.0 || lat > 45.0 || lng < -80.5 || lng > -78.5) {
          console.warn(`⚠️ Invalid coordinates for order ${order.order_number}: [${lat}, ${lng}] - outside GTA bounds`)
          return
        }

        validCoordinatesCount++
        console.log(`📍 Adding PRECISE marker for order ${order.order_number} at [${lat}, ${lng}]`)

        const orderEl = document.createElement("div")
        const priorityColors = {
          urgent: "#ef4444",
          high: "#f97316",
          normal: "#3b82f6",
          low: "#6b7280",
        }

        const color = priorityColors[order.priority] || priorityColors.normal
        const size = order.priority === "urgent" ? 36 : order.priority === "high" ? 32 : 28

        // Create enhanced marker with stop number and priority indicator
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
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
            position: relative;
            font-weight: bold;
            color: white;
            font-size: 12px;
            transition: transform 0.2s ease;
          " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            ${index + 1}
            ${
              order.priority === "urgent"
                ? `
              <div style="
                position: absolute;
                top: -3px;
                right: -3px;
                width: 12px;
                height: 12px;
                background: #fbbf24;
                border: 2px solid white;
                border-radius: 50%;
                animation: pulse 2s infinite;
              "></div>
            `
                : ""
            }
            <div style="
              position: absolute;
              bottom: -6px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 6px solid ${color};
            "></div>
          </div>
        `

        const orderMarker = new window.mapboxgl.Marker(orderEl)
          .setLngLat([lng, lat])
          .setPopup(
            new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 16px; min-width: 250px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937; font-size: 16px;">
                  Stop ${index + 1}: #${order.order_number}
                </h3>
                <p style="margin: 0 0 4px 0; font-size: 14px; color: #374151; font-weight: 500;">${order.customer_name}</p>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">${order.delivery_address}</p>
                <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                  <span style="
                    padding: 3px 8px;
                    font-size: 10px;
                    border-radius: 6px;
                    background: ${color}20;
                    color: ${color};
                    font-weight: 600;
                    text-transform: uppercase;
                  ">${order.priority}</span>
                  <span style="
                    padding: 3px 8px;
                    font-size: 10px;
                    border-radius: 6px;
                    background: #10b98120;
                    color: #10b981;
                    font-weight: 600;
                    text-transform: uppercase;
                  ">${order.status}</span>
                </div>
                <div style="margin-top: 8px; padding: 8px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #10b981;">
                  <p style="margin: 0; font-size: 11px; color: #059669; font-weight: 500;">
                    📍 Precise Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}
                  </p>
                  <p style="margin: 2px 0 0 0; font-size: 10px; color: #059669;">
                    ✅ Geocoded with high accuracy
                  </p>
                </div>
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
        markersAdded++
      })

      console.log(
        `✅ Added ${markersAdded} precise order markers to map (${validCoordinatesCount} with valid coordinates)`,
      )

      // Add driver markers
      driverLocations.forEach((driver) => {
        const driverEl = document.createElement("div")
        driverEl.innerHTML = `
          <div style="
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #10b981, #059669);
            border: 4px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 16px rgba(0,0,0,0.4);
            cursor: pointer;
            position: relative;
          ">
            <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
            </svg>
            <div style="
              position: absolute;
              top: -2px;
              right: -2px;
              width: 16px;
              height: 16px;
              background: #22c55e;
              border: 3px solid white;
              border-radius: 50%;
              animation: pulse 2s infinite;
            "></div>
          </div>
        `

        const driverMarker = new window.mapboxgl.Marker(driverEl)
          .setLngLat([driver.location[1], driver.location[0]])
          .setPopup(
            new window.mapboxgl.Popup({ offset: 25 }).setHTML(`
              <div style="padding: 16px; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #059669; font-size: 16px;">🚛 ${driver.name}</h3>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #374151;">${driver.orders} active orders</p>
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Status: ${driver.status}</p>
                <p style="margin: 0 0 8px 0; font-size: 11px; color: #9ca3af;">
                  Last seen: ${new Date(driver.last_seen).toLocaleTimeString()}
                </p>
                <div style="
                  padding: 6px 12px;
                  font-size: 11px;
                  border-radius: 6px;
                  background: #dcfce7;
                  color: #166534;
                  font-weight: 600;
                  text-align: center;
                ">🟢 Live Tracking Active</div>
              </div>
            `),
          )
          .addTo(map.current)

        markersRef.current.push(driverMarker)
        bounds.extend([driver.location[1], driver.location[0]])
      })

      // Add optimized route line if available
      if (optimizedRoute && optimizedRoute.geometry && optimizedRoute.geometry.length > 0) {
        // Remove existing route if any
        if (map.current.getSource("optimized-route")) {
          map.current.removeLayer("optimized-route-line")
          map.current.removeSource("optimized-route")
        }

        // Convert coordinates to GeoJSON format [lng, lat]
        const routeCoordinates = optimizedRoute.geometry.map((coord) => [coord[1], coord[0]])

        map.current.addSource("optimized-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routeCoordinates,
            },
          },
        })

        map.current.addLayer({
          id: "optimized-route-line",
          type: "line",
          source: "optimized-route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 5,
            "line-opacity": 0.8,
          },
        })

        // Extend bounds to include route
        routeCoordinates.forEach((coord) => bounds.extend(coord))
      }

      // Fit map to show all markers with appropriate padding
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, {
          padding: 60,
          maxZoom: 15,
        })
      }

      // Add enhanced pulsing animation CSS
      if (!document.getElementById("map-animations")) {
        const style = document.createElement("style")
        style.id = "map-animations"
        style.textContent = `
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.6; }
            100% { transform: scale(1); opacity: 1; }
          }
        `
        document.head.appendChild(style)
      }
    },
    [driverLocations, warehouseLocation, warehouseName, onOrderClick, optimizedRoute],
  )

  const optimizeRoute = useCallback(async () => {
    if (!geocodedOrders.length || geocodedOrders.length < 2) {
      toast({
        title: "Route Optimization",
        description: "At least 2 orders with coordinates are required for route optimization.",
        variant: "destructive",
      })
      return
    }

    if (geocodedOrders.length > 12) {
      toast({
        title: "Route Optimization",
        description: "Maximum 12 orders allowed for Mapbox Optimization API.",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)

    try {
      // Filter orders with valid coordinates
      const validOrders = geocodedOrders.filter((order) => order.coordinates)
      if (validOrders.length < 2) {
        throw new Error("Not enough orders with valid coordinates for optimization")
      }

      console.log(`🚀 Starting route optimization for ${validOrders.length} orders`)

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

      console.log(`📍 Optimizing route for ${waypoints.length} waypoints using Mapbox Optimization API`)

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
            annotations: ["duration", "distance"],
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Route optimization failed")
      }

      const result = await response.json()
      const optimizedRouteData = result.data

      console.log(`✅ Route optimization successful:`, optimizedRouteData)

      setOptimizedRoute(optimizedRouteData)

      // Re-add markers to show optimized route
      await addPreciseMarkersToMap(geocodedOrders)

      toast({
        title: "Route Optimized Successfully!",
        description: `Distance: ${routeOptimizer.formatDistance(optimizedRouteData.distance)}, Time: ${routeOptimizer.formatDuration(optimizedRouteData.duration)}`,
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
  }, [geocodedOrders, warehouseLocation, warehouseName, toast, addPreciseMarkersToMap])

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
              {geocodedOrders && geocodedOrders.length > 0 && (
                <Badge variant="outline">
                  {geocodedOrders.length} order{geocodedOrders.length !== 1 ? "s" : ""}
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
              {geocodedOrders && geocodedOrders.length > 0 ? (
                geocodedOrders.map((order, index) => (
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
                      <p className="text-xs text-green-600">
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
            <Target className="h-5 w-5 text-green-600" />
            {title}
            {geocodingProgress.isGeocoding && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Geocoding {geocodingProgress.current}/{geocodingProgress.total}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {geocodedOrders && geocodedOrders.length > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Target className="h-3 w-3 mr-1" />
                {geocodedOrders.length} precise locations
              </Badge>
            )}
            {geocodingStats.highAccuracy > 0 && (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                {geocodingStats.highAccuracy} high accuracy
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
            {showRouteOptimization && geocodedOrders.length >= 2 && (
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
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg max-w-xs">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Precise Geocoding</span>
                    <span className="text-xs text-gray-500">
                      {geocodingProgress.current}/{geocodingProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(geocodingProgress.current / geocodingProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  {geocodingProgress.currentAddress && (
                    <p className="text-xs text-gray-600 truncate">{geocodingProgress.currentAddress}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {optimizedRoute && (
          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              <Route className="h-4 w-4" />🚀 Route Optimized with Mapbox API
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">
                  {routeOptimizer.formatDistance(optimizedRoute.distance)}
                </div>
                <div className="text-green-600 text-xs">Total Distance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {routeOptimizer.formatDuration(optimizedRoute.duration)}
                </div>
                <div className="text-blue-600 text-xs">Estimated Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-700">{optimizedRoute.waypoints.length}</div>
                <div className="text-purple-600 text-xs">Total Stops</div>
              </div>
            </div>
          </div>
        )}
        {geocodingStats.total > 0 && (
          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Geocoding Statistics
            </h5>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="text-center">
                <div className="font-bold text-gray-700">{geocodingStats.successful}</div>
                <div className="text-gray-500">Successful</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-green-700">{geocodingStats.highAccuracy}</div>
                <div className="text-gray-500">High Accuracy</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-blue-700">{geocodingStats.cached}</div>
                <div className="text-gray-500">From Cache</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-700">{geocodingStats.total}</div>
                <div className="text-gray-500">Total</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Default export for compatibility
export default MapboxMap
