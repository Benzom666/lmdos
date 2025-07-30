"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { X, Navigation, RefreshCw, ZoomIn, ZoomOut } from "lucide-react"
import { geocodingService } from "@/lib/geocoding-service"

interface DeliveryOrder {
  id: string
  order_number: string
  customer_name: string
  delivery_address: string
  priority: string
  status: string
}

interface DeliveryMapProps {
  orders: DeliveryOrder[]
  driverLocation: [number, number] | null
  onClose: () => void
  isOptimized?: boolean
}

export default function DeliveryMap({ orders, driverLocation, onClose, isOptimized = false }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const routeLineRef = useRef<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geocodedOrders, setGeocodedOrders] = useState<Array<DeliveryOrder & { coordinates: [number, number] }>>([])
  const [isGeocoding, setIsGeocoding] = useState(true)
  const [currentZoom, setCurrentZoom] = useState(11)

  // Load Leaflet dynamically with error handling
  useEffect(() => {
    const loadLeaflet = async () => {
      try {
        if ((window as any).L) {
          setIsLoaded(true)
          return
        }

        // Load CSS first
        const cssLink = document.createElement("link")
        cssLink.rel = "stylesheet"
        cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        cssLink.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        cssLink.crossOrigin = ""
        document.head.appendChild(cssLink)

        // Load JavaScript
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        script.crossOrigin = ""

        script.onload = () => {
          console.log("Leaflet loaded successfully")
          setIsLoaded(true)
        }

        script.onerror = (e) => {
          console.error("Failed to load Leaflet:", e)
          setError("Failed to load map library")
        }

        document.head.appendChild(script)
      } catch (err) {
        console.error("Error loading Leaflet:", err)
        setError("Failed to initialize map")
      }
    }

    loadLeaflet()
  }, [])

  // Enhanced geocoding with better error handling
  useEffect(() => {
    const geocodeAllOrders = async () => {
      if (orders.length === 0) {
        setIsGeocoding(false)
        return
      }

      setIsGeocoding(true)

      try {
        const geocoded: Array<DeliveryOrder & { coordinates: [number, number] }> = []

        // Process orders in batches to avoid rate limiting
        const batchSize = 3
        for (let i = 0; i < orders.length; i += batchSize) {
          const batch = orders.slice(i, i + batchSize)

          const batchPromises = batch.map(async (order, index) => {
            // Add delay between requests
            if (index > 0) {
              await new Promise((resolve) => setTimeout(resolve, 200))
            }

            const coordinates = await geocodingService.geocodeAddress(order.delivery_address)
            return { order, coordinates }
          })

          const batchResults = await Promise.all(batchPromises)

          batchResults.forEach(({ order, coordinates }) => {
            if (coordinates) {
              geocoded.push({ ...order, coordinates })
            } else {
              // Use deterministic fallback coordinates
              const fallbackCoords: [number, number] = [
                40.7128 + (geocoded.length * 0.01 - 0.05),
                -74.006 + (geocoded.length * 0.01 - 0.05),
              ]
              geocoded.push({ ...order, coordinates: fallbackCoords })
            }
          })

          // Small delay between batches
          if (i + batchSize < orders.length) {
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        }

        setGeocodedOrders(geocoded)
      } catch (error) {
        console.error("Geocoding failed:", error)
        // Create fallback coordinates for all orders
        const fallbackOrders = orders.map((order, index) => ({
          ...order,
          coordinates: [40.7128 + (index * 0.01 - 0.05), -74.006 + (index * 0.01 - 0.05)] as [number, number],
        }))
        setGeocodedOrders(fallbackOrders)
      } finally {
        setIsGeocoding(false)
      }
    }

    geocodeAllOrders()
  }, [orders])

  // Initialize map with proper error handling
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    try {
      const L = (window as any).L
      if (!L) {
        setError("Leaflet library not available")
        return
      }

      const map = L.map(mapRef.current, {
        center: [40.7128, -74.006],
        zoom: 11,
        zoomControl: false, // We'll add custom controls
        attributionControl: true,
      })

      // Add tile layer with error handling
      const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
        errorTileUrl:
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOTk5Ij5NYXAgVGlsZSBOb3QgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==",
      })

      tileLayer.on("tileerror", (e: any) => {
        console.warn("Tile loading error:", e)
      })

      tileLayer.addTo(map)

      // Add zoom event listener
      map.on("zoomend", () => {
        setCurrentZoom(map.getZoom())
      })

      // Add error handling for map events
      map.on("error", (e: any) => {
        console.error("Map error:", e)
      })

      mapInstanceRef.current = map

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
  }, [isLoaded])

  // Create popup content
  const createPopupContent = useCallback(
    (order: DeliveryOrder, index: number) => {
      const priorityColor =
        order.priority === "urgent" || order.priority === "high"
          ? "#dc2626"
          : order.priority === "normal"
            ? "#059669"
            : "#6b7280"

      return `
      <div style="min-width: 220px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="margin-bottom: 8px;">
          <span style="
            background-color: ${priorityColor};
            color: white;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          ">${order.priority}</span>
          <span style="
            background-color: #f3f4f6;
            color: #374151;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            margin-left: 4px;
          ">${isOptimized ? `Stop ${index + 1}` : `Order ${index + 1}`}</span>
        </div>
        <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #1f2937;">
          #${order.order_number}
        </h4>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #374151; font-weight: 500;">
          ${order.customer_name}
        </p>
        <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; line-height: 1.4;">
          ${order.delivery_address}
        </p>
        <button onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}', '_blank')" 
          style="
            background-color: #3b82f6;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            transition: background-color 0.2s;
          "
          onmouseover="this.style.backgroundColor='#2563eb'"
          onmouseout="this.style.backgroundColor='#3b82f6'">
          🧭 Navigate Here
        </button>
      </div>
    `
    },
    [isOptimized],
  )

  // Render markers and route with improved error handling
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || geocodedOrders.length === 0 || isGeocoding) return

    const L = (window as any).L
    if (!L) return

    try {
      // Clear existing markers and route
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

      // Add driver location marker if available and optimized
      if (driverLocation && isOptimized) {
        const driverIcon = L.divIcon({
          html: `
            <div style="
              background-color: #1f2937;
              width: 36px;
              height: 36px;
              border-radius: 50%;
              border: 4px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 14px;
              box-shadow: 0 3px 10px rgba(0,0,0,0.5);
              font-family: system-ui, -apple-system, sans-serif;
            ">🚚</div>
          `,
          className: "driver-location-marker",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const driverMarker = L.marker(driverLocation, { icon: driverIcon }).addTo(mapInstanceRef.current)

        driverMarker.bindPopup(`
          <div style="min-width: 180px; font-family: system-ui, -apple-system, sans-serif;">
            <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #1f2937;">
              📍 Starting Location
            </h4>
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
              Route optimization starting point
            </p>
          </div>
        `)

        markersRef.current.push(driverMarker)
        bounds.extend(driverLocation)
        routeCoordinates.push(driverLocation)
      }

      // Add delivery markers
      geocodedOrders.forEach((order, index) => {
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

      // Draw route line for optimized routes
      if (isOptimized && routeCoordinates.length > 1) {
        routeLineRef.current = L.polyline(routeCoordinates, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.8,
          dashArray: "10, 10",
        }).addTo(mapInstanceRef.current)

        routeLineRef.current.bindPopup(`
          <div style="font-family: system-ui, -apple-system, sans-serif; text-align: center;">
            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
              🛣️ Optimized Route
            </h4>
            <p style="margin: 0; font-size: 12px; color: #6b7280;">
              ${geocodedOrders.length} stops • Distance optimized
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
  }, [geocodedOrders, driverLocation, isLoaded, isOptimized, createPopupContent, isGeocoding])

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
              {isOptimized ? "Optimized Delivery Route" : "Delivery Locations"}
            </h3>
            <p className="text-sm text-gray-600">
              {orders.length} delivery locations • Zoom: {currentZoom}x
              {isOptimized ? " • Distance optimized route" : " • Order sequence display"}
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
