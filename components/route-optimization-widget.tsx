"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { MapboxMap } from "@/components/mapbox-map"
import { routeOptimizer } from "@/lib/route-optimizer"
import { Navigation, Plus, Trash2, RefreshCw, Clock, MapPin } from "lucide-react"

interface Waypoint {
  id: string
  name: string
  address: string
  coordinates: [number, number]
}

interface OptimizedRouteData {
  waypoints: Array<{
    coordinates: [number, number]
    name?: string
    waypointIndex?: number
  }>
  distance: number
  duration: number
  geometry: [number, number][]
}

export function RouteOptimizationWidget() {
  const { toast } = useToast()
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [newWaypoint, setNewWaypoint] = useState({ name: "", address: "" })
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRouteData | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Generate coordinates for demonstration (in real app, use geocoding)
  const generateCoordinates = (address: string): [number, number] => {
    let hash = 0
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }

    const baseLatitude = 43.6532
    const baseLongitude = -79.3832
    const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.3
    const lngOffset = (((Math.abs(hash) >> 10) % 1000) / 1000 - 0.5) * 0.4

    return [baseLatitude + latOffset, baseLongitude + lngOffset]
  }

  const addWaypoint = () => {
    if (!newWaypoint.name || !newWaypoint.address) {
      toast({
        title: "Error",
        description: "Please enter both name and address",
        variant: "destructive",
      })
      return
    }

    const coordinates = generateCoordinates(newWaypoint.address)
    const waypoint: Waypoint = {
      id: Date.now().toString(),
      name: newWaypoint.name,
      address: newWaypoint.address,
      coordinates,
    }

    setWaypoints([...waypoints, waypoint])
    setNewWaypoint({ name: "", address: "" })
    setOptimizedRoute(null) // Clear previous optimization
  }

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter((wp) => wp.id !== id))
    setOptimizedRoute(null)
  }

  const optimizeRoute = async () => {
    if (waypoints.length < 2) {
      toast({
        title: "Error",
        description: "At least 2 waypoints are required for optimization",
        variant: "destructive",
      })
      return
    }

    setIsOptimizing(true)

    try {
      const optimizationWaypoints = waypoints.map((wp) => ({
        coordinates: [wp.coordinates[1], wp.coordinates[0]] as [number, number], // Convert to [lng, lat]
        name: wp.name,
      }))

      const result = await routeOptimizer.optimizeRoute(optimizationWaypoints)
      setOptimizedRoute(result)

      toast({
        title: "Route Optimized!",
        description: `Found optimal route with ${routeOptimizer.formatDistance(result.distance)} total distance and ${routeOptimizer.formatDuration(result.duration)} estimated time.`,
      })
    } catch (error) {
      console.error("Optimization error:", error)
      toast({
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "Failed to optimize route",
        variant: "destructive",
      })
    } finally {
      setIsOptimizing(false)
    }
  }

  const clearAll = () => {
    setWaypoints([])
    setOptimizedRoute(null)
  }

  // Convert waypoints to orders format for map display
  const ordersForMap = waypoints.map((wp, index) => ({
    id: wp.id,
    order_number: `STOP${index + 1}`,
    customer_name: wp.name,
    delivery_address: wp.address,
    priority: "normal" as const,
    status: "pending",
  }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Route Optimization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Waypoint Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="waypoint-name">Stop Name</Label>
              <Input
                id="waypoint-name"
                placeholder="e.g., Customer A"
                value={newWaypoint.name}
                onChange={(e) => setNewWaypoint({ ...newWaypoint, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="waypoint-address">Address</Label>
              <Input
                id="waypoint-address"
                placeholder="e.g., 123 Main St, Toronto"
                value={newWaypoint.address}
                onChange={(e) => setNewWaypoint({ ...newWaypoint, address: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addWaypoint} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Stop
              </Button>
            </div>
          </div>

          {/* Waypoints List */}
          {waypoints.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Stops ({waypoints.length})</h3>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {waypoints.map((waypoint, index) => (
                  <div key={waypoint.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {optimizedRoute
                          ? `Stop ${optimizedRoute.waypoints.findIndex((wp) => wp.name === waypoint.name) + 1}`
                          : `#${index + 1}`}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{waypoint.name}</p>
                        <p className="text-xs text-muted-foreground">{waypoint.address}</p>
                        <p className="text-xs text-muted-foreground">
                          📍 {waypoint.coordinates[0].toFixed(4)}, {waypoint.coordinates[1].toFixed(4)}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeWaypoint(waypoint.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optimization Controls */}
          {waypoints.length >= 2 && (
            <div className="flex gap-2">
              <Button onClick={optimizeRoute} disabled={isOptimizing} className="flex-1">
                {isOptimizing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Optimize Route
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Optimization Results */}
          {optimizedRoute && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">Optimization Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span>Total Distance: {routeOptimizer.formatDistance(optimizedRoute.distance)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span>Estimated Time: {routeOptimizer.formatDuration(optimizedRoute.duration)}</span>
                </div>
              </div>
              <p className="text-xs text-green-700 mt-2">
                Route has been optimized for minimum travel time and distance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Map Display */}
      {waypoints.length > 0 && (
        <MapboxMap
          orders={ordersForMap}
          title="Route Optimization Map"
          height="500px"
          optimizedRoute={optimizedRoute?.geometry}
          onOrderClick={(orderId) => {
            const waypoint = waypoints.find((wp) => wp.id === orderId)
            if (waypoint) {
              toast({
                title: waypoint.name,
                description: waypoint.address,
              })
            }
          }}
        />
      )}
    </div>
  )
}
