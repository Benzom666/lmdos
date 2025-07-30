"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { X, RefreshCw, ZoomIn, ZoomOut, Navigation } from "lucide-react"
import { geocodingService } from "@/lib/geocoding-service"

interface DeliveryOrder {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: string
  status: string
  stop_number?: number
}

interface OptimizedDeliveryMapProps {
  orders: DeliveryOrder[]
  driverLocation: [number, number] | null
  onClose: () => void
  isOptimized?: boolean
  persistentRoute?: any
}

export default function OptimizedDeliveryMap({
  orders,
  driverLocation,
  onClose,
  isOptimized = false,
  persistentRoute,
}: OptimizedDeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const routeLineRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentZoom, setCurrentZoom] = useState(12)
  const [mapReady, setMapReady] = useState(false)
  const [coordinatesLoaded, setCoordinatesLoaded] = useState(false)
  const [geocodedOrders, setGeocodedOrders] = useState<any[]>([])
  const [isGeocoding, setIsGeocoding] = useState(false)

  // Default center coordinates
  const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832]

  // Enhanced validation for route data
  const hasValidRouteData = useMemo(() => {
    console.log("Checking route data validity:", {
      isOptimized,
      ordersCount: orders.length,
      hasStopNumbers: orders.some((order) => order.stop_number),
      persistentRoute: !!persistentRoute,
    })

    return isOptimized && orders.length > 0 && orders.some((order) => order.stop_number)
  }, [isOptimized, orders, persistentRoute])

  // Memoized coordinates with proper geocoding
  const orderCoordinates = useMemo(() => {
    console.log("Calculating coordinates for", orders.length, "orders")

    const coords = orders.map((order, index) => ({
      order,
      coordinates: null as [number, number] | null,
      fromCache: false,
    }))

    // Start background geocoding for addresses
    if (orders.length > 0) {
      setIsGeocoding(true)
      const addresses = orders.map((order) => order.delivery_address)
      geocodingService
        .geocodeWithFallback(addresses)
        .then((results) => {
          console.log(`Geocoding completed: ${results.length} addresses processed`)
          setCoordinatesLoaded(true)
          setIsGeocoding(false)

          const newGeocodedOrders = results.map((result, index) => ({
            order: orders[index],
            coordinates: result.coordinates,
            fromCache: false,
            stop_number: orders[index].stop_number,
            priority: orders[index].priority,
            status: orders[index].status,
            order_number: orders[index].order_number,
            customer_name: orders[index].customer_name,
            delivery_address: orders[index].delivery_address,
          }))

          setGeocodedOrders(newGeocodedOrders)

          // Force map re-render with new coordinates
          if (mapInstanceRef.current) {
            setTimeout(() => {
              renderMarkersAndRoute(newGeocodedOrders)
            }, 100)
          }
        })
        .catch((error) => {
          console.error("Geocoding failed:", error)
          setCoordinatesLoaded(true)
          setIsGeocoding(false)
        })
    }

    return coords
  }, [orders])

  // Load Leaflet with better error handling
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        if ((window as any).L) {
          setIsLoaded(true)
          return
        }

        await Promise.all([
          new Promise<void>((resolve, reject) => {
            const cssLink = document.createElement("link")
            cssLink.rel = "stylesheet"
            cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            cssLink.onload = () => resolve()
            cssLink.onerror = reject
            document.head.appendChild(cssLink)
          }),
          new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            script.onload = () => resolve()
            script.onerror = reject
            document.head.appendChild(script)
          }),
        ])

        setIsLoaded(true)
      } catch (err) {
        console.error("Error loading Leaflet:", err)
        setError("Failed to load map library")
      }
    }

    loadLeaflet()
  }, [])

  // Initialize map centered on default location
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    try {
      const L = (window as any).L
      if (!L) {
        setError("Leaflet library not available")
        return
      }

      // Center map on driver location or default center
      const mapCenter = driverLocation || DEFAULT_CENTER
      console.log(`Initializing map centered on: [${mapCenter[0]}, ${mapCenter[1]}]`)

      const map = L.map(mapRef.current, {
        center: mapCenter,
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
        maxZoom: 18,
        minZoom: 9,
      })

      // Use OpenStreetMap tiles
      const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
        tileSize: 256,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 2,
      })

      tileLayer.addTo(map)

      map.on("zoomend", () => {
        setCurrentZoom(map.getZoom())
      })

      map.on("load", () => {
        setMapReady(true)
      })

      mapInstanceRef.current = map

      // Trigger load event manually
      setTimeout(() => setMapReady(true), 100)

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove()
          mapInstanceRef.current = null
        }
      }
    } catch (err) {
      console.error("Failed to create map:", err)
      setError("Failed to create map")
    }
  }, [isLoaded, driverLocation])

  // Optimized marker creation
  const createOptimizedMarker = useCallback(
    (order: DeliveryOrder, coordinates: [number, number], index: number) => {
      const L = (window as any).L
      if (!L) return null

      const markerColor =
        order.priority === "urgent" || order.priority === "high"
          ? "#dc2626"
          : order.priority === "normal"
            ? "#059669"
            : "#6b7280"

      const isCompleted = order.status === "delivered"
      const stopNumber = order.stop_number || index + 1

      const customIcon = L.divIcon({
        html: `
        <div style="
          background-color: ${isCompleted ? "#6b7280" : markerColor};
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          font-family: system-ui, -apple-system, sans-serif;
          ${isCompleted ? "opacity: 0.8;" : ""}
        ">${stopNumber}</div>
      `,
        className: `delivery-marker ${isCompleted ? "completed" : "pending"}`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })

      const marker = L.marker(coordinates, {
        icon: customIcon,
        riseOnHover: true,
      })

      // Enhanced popup content
      const popupContent = `
      <div style="min-width: 240px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="margin-bottom: 10px;">
          <span style="
            background-color: ${markerColor};
            color: white;
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
          ">${order.priority}</span>
          <span style="
            background-color: ${isCompleted ? "#6b7280" : "#3b82f6"};
            color: white;
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 10px;
            font-weight: 500;
            margin-left: 8px;
          ">Stop ${stopNumber}</span>
          ${hasValidRouteData ? '<span style="background-color: #10b981; color: white; padding: 4px 10px; border-radius: 14px; font-size: 10px; font-weight: 500; margin-left: 8px;">Optimized</span>' : ""}
        </div>
        <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
          #${order.order_number}
        </h4>
        <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151; font-weight: 500;">
          ${order.customer_name}
        </p>
        <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">
          📍 ${order.delivery_address}
        </p>
        <div style="margin-bottom: 8px; padding: 6px 8px; background-color: #f0f9ff; border-radius: 6px; font-size: 11px; color: #0369a1;">
          🌍 Coordinates: ${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}
        </div>
        ${
          !isCompleted
            ? `
          <button onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}', '_blank')" 
            style="
              background-color: #3b82f6;
              color: white;
              border: none;
              padding: 10px 14px;
              border-radius: 8px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              width: 100%;
            ">
            🧭 Navigate to Location
          </button>
        `
            : `
          <div style="
            background-color: #f3f4f6;
            color: #6b7280;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 12px;
            text-align: center;
            font-weight: 500;
          ">
            ✅ Delivery Completed
          </div>
        `
        }
      </div>
    `

      marker.bindPopup(popupContent, {
        maxWidth: 260,
        className: "optimized-popup",
      })

      return marker
    },
    [hasValidRouteData],
  )

  const createPopupContent = useCallback(
    (order: any, index: number) => {
      const markerColor =
        order.priority === "urgent" || order.priority === "high"
          ? "#dc2626"
          : order.priority === "normal"
            ? "#059669"
            : "#6b7280"

      const isCompleted = order.status === "delivered"
      const stopNumber = order.stop_number || index + 1

      return `
        <div style="min-width: 240px; font-family: system-ui, -apple-system, sans-serif;">
          <div style="margin-bottom: 10px;">
            <span style="
              background-color: ${markerColor};
              color: white;
              padding: 4px 10px;
              border-radius: 14px;
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
            ">${order.priority}</span>
            <span style="
              background-color: ${isCompleted ? "#6b7280" : "#3b82f6"};
              color: white;
              padding: 4px 10px;
              border-radius: 14px;
              font-size: 10px;
              font-weight: 500;
              margin-left: 8px;
            ">Stop ${stopNumber}</span>
            ${hasValidRouteData ? '<span style="background-color: #10b981; color: white; padding: 4px 10px; border-radius: 14px; font-size: 10px; font-weight: 500; margin-left: 8px;">Optimized</span>' : ""}
          </div>
          <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
            #${order.order_number}
          </h4>
          <p style="margin: 0 0 6px 0; font-size: 14px; color: #374151; font-weight: 500;">
            ${order.customer_name}
          </p>
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">
            📍 ${order.delivery_address}
          </p>
          <div style="margin-bottom: 8px; padding: 6px 8px; background-color: #f0f9ff; border-radius: 6px; font-size: 11px; color: #0369a1;">
            🌍 Coordinates: ${order.coordinates[0].toFixed(4)}, ${order.coordinates[1].toFixed(4)}
          </div>
          ${
            !isCompleted
              ? `
            <button onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}', '_blank')" 
              style="
                background-color: #3b82f6;
                color: white;
                border: none;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                width: 100%;
              ">
              🧭 Navigate to Location
            </button>
          `
              : `
            <div style="
              background-color: #f3f4f6;
              color: #6b7280;
              padding: 10px 14px;
              border-radius: 8px;
              font-size: 12px;
              text-align: center;
              font-weight: 500;
            ">
              ✅ Delivery Completed
            </div>
          `
          }
        </div>
      `
    },
    [hasValidRouteData],
  )

  const renderMarkersAndRoute = useCallback(
    (orders: any[]) => {
      if (!mapInstanceRef.current || !isLoaded) return

      const L = (window as any).L
      if (!L) return

      try {
        console.log("Rendering markers for", orders.length, "orders")

        // Clear existing markers
        markersRef.current.forEach((marker) => {
          if (mapInstanceRef.current && marker) {
            mapInstanceRef.current.removeLayer(marker)
          }
        })
        markersRef.current = []

        if (routeLineRef.current) {
          mapInstanceRef.current.removeLayer(routeLineRef.current)
          routeLineRef.current = null
        }

        const bounds = L.latLngBounds([])
        const routeCoordinates: [number, number][] = []

        // Add driver location marker if available and route is optimized
        if (driverLocation && hasValidRouteData) {
          const driverIcon = L.divIcon({
            html: `
              <div style="
                background-color: #1f2937;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: 4px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 16px;
                box-shadow: 0 6px 16px rgba(0,0,0,0.5);
                font-family: system-ui, -apple-system, sans-serif;
              ">🚚</div>
            `,
            className: "driver-marker",
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })

          const driverMarker = L.marker(driverLocation, { icon: driverIcon })
          driverMarker.addTo(mapInstanceRef.current)
          driverMarker.bindPopup(`
            <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center;">
              <h4 style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #1f2937;">
                📍 Your Current Location
              </h4>
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">
                Optimized route starting point
              </p>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                ${driverLocation[0].toFixed(4)}, ${driverLocation[1].toFixed(4)}
              </p>
            </div>
          `)

          markersRef.current.push(driverMarker)
          bounds.extend(driverLocation)
          routeCoordinates.push(driverLocation)
        }

        // Sort orders by stop number if optimized
        const sortedOrders = hasValidRouteData
          ? [...orders].sort((a, b) => (a.stop_number || 0) - (b.stop_number || 0))
          : orders

        // Add delivery markers
        sortedOrders.forEach((order, index) => {
          const [lat, lng] = order.coordinates

          const markerColor =
            order.priority === "urgent" || order.priority === "high"
              ? "#dc2626"
              : order.priority === "normal"
                ? "#059669"
                : "#6b7280"

          const customIcon = L.divIcon({
            html: `
              <div style="
                background-color: ${markerColor};
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 3px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 13px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                font-family: system-ui, -apple-system, sans-serif;
              ">${index + 1}</div>
            `,
            className: "custom-delivery-marker",
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })

          const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current)

          marker.bindPopup(createPopupContent(order, index), {
            maxWidth: 250,
            className: "custom-popup",
          })

          markersRef.current.push(marker)
          bounds.extend([lat, lng])
          routeCoordinates.push([lat, lng])
        })

        // Draw route if optimized and has multiple points
        if (hasValidRouteData && routeCoordinates.length > 1) {
          routeLineRef.current = L.polyline(routeCoordinates, {
            color: "#3b82f6",
            weight: 4,
            opacity: 0.8,
            dashArray: "10, 10",
            smoothFactor: 2,
          }).addTo(mapInstanceRef.current)

          routeLineRef.current.bindPopup(`
            <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center;">
              <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
                🛣️ Optimized Delivery Route
              </h4>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                ${orders.length} stops • Distance optimized
              </p>
            </div>
          `)
        }

        // Fit map to show all markers
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, {
            padding: [30, 30],
            maxZoom: 15,
          })
        }
      } catch (err) {
        console.error("Failed to add markers:", err)
        setError("Failed to display markers")
      }
    },
    [driverLocation, isLoaded, isOptimized, createPopupContent, hasValidRouteData],
  )

  // Render markers and route function
  useEffect(() => {
    renderMarkersAndRoute(geocodedOrders)
  }, [
    geocodedOrders,
    driverLocation,
    isLoaded,
    isOptimized,
    createPopupContent,
    hasValidRouteData,
    renderMarkersAndRoute,
  ])

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn()
    }
  }

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut()
    }
  }

  const refreshMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize()
      setTimeout(() => {
        if (geocodedOrders.length > 0) {
          const L = (window as any).L
          const bounds = L.latLngBounds(geocodedOrders.map((order) => order.coordinates))
          if (driverLocation && isOptimized) {
            bounds.extend(driverLocation)
          }
          mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
        }
      }, 100)
    }
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-red-600">Map Error</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()} className="flex-1">
              Reload Page
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-600" />
              {hasValidRouteData ? "Optimized Delivery Route" : "Delivery Locations"}
              {hasValidRouteData && <span className="text-green-600">✓</span>}
            </h3>
            <p className="text-sm text-gray-600">
              {orders.length} delivery locations • Zoom: {currentZoom}x
              {hasValidRouteData ? " • Distance optimized route" : " • Order sequence display"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={refreshMap}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          {(!isLoaded || isGeocoding) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-lg font-medium text-gray-700">
                  {isGeocoding ? "Getting precise locations..." : "Loading map..."}
                </p>
                <p className="text-sm text-gray-500">
                  {isGeocoding
                    ? `Processing ${orders.length} delivery addresses`
                    : "Initializing interactive map with markers"}
                </p>
              </div>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Legend */}
        <div className="p-4 border-t bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
            {isOptimized && driverLocation && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-800 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs">
                  🚚
                </div>
                <span className="font-medium">Starting Location</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold">
                1
              </div>
              <span className="font-medium">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold">
                2
              </div>
              <span className="font-medium">Normal Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-600 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold">
                3
              </div>
              <span className="font-medium">Low Priority</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>📍 Interactive map with real address geocoding and responsive design</span>
            <span className="font-medium">
              Markers: {geocodedOrders.length}/{orders.length} • Cache: {geocodingService.getCacheStats().total}{" "}
              addresses
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
