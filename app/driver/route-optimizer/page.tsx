"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type Order } from "@/lib/supabase"
import { routeManager } from "@/lib/route-manager"
import {
  Route,
  MapPin,
  Clock,
  Shuffle,
  Package,
  AlertCircle,
  History,
  RefreshCw,
  CheckCircle,
  XCircle,
  Truck,
} from "lucide-react"

// Dynamic import to avoid SSR issues with Leaflet
const RouteMap = dynamic(() => import("@/components/route-map"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">Loading map...</div>
  ),
})

interface RouteStop {
  order: Order
  estimatedTime: number
  distance: number
  type: "delivery"
  status: "pending" | "completed" | "failed" | "cancelled"
  completedAt?: string
  actualTime?: number
  actualDistance?: number
}

interface RouteHistory {
  id: string
  timestamp: string
  action: "created" | "updated" | "completed" | "cancelled" | "recalculated"
  description: string
  stopCount: number
  totalDistance: number
  totalTime: number
}

export default function RouteOptimizerPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [optimizing, setOptimizing] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [currentRoute, setCurrentRoute] = useState<RouteStop[]>([])
  const [routeHistory, setRouteHistory] = useState<RouteHistory[]>([])
  const [totalDistance, setTotalDistance] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [completedDistance, setCompletedDistance] = useState(0)
  const [completedTime, setCompletedTime] = useState(0)
  const [showMap, setShowMap] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [routeId, setRouteId] = useState<string | null>(null)
  const [shiftStarted, setShiftStarted] = useState(false)

  useEffect(() => {
    if (profile) {
      initializeRoute()
    }
  }, [profile])

  const initializeRoute = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // Check if there's an existing route for today
      const existingRoute = await routeManager.getCurrentRoute(profile.user_id)

      if (existingRoute) {
        // Load existing route
        setRouteId(existingRoute.id)
        setCurrentRoute(existingRoute.stops)
        setRouteHistory(existingRoute.history)
        setTotalDistance(existingRoute.totalDistance)
        setTotalTime(existingRoute.totalTime)
        setCompletedDistance(existingRoute.completedDistance)
        setCompletedTime(existingRoute.completedTime)
        setShiftStarted(true)

        toast({
          title: "Route Loaded",
          description: `Continuing with existing route: ${existingRoute.stops.length} stops`,
        })
      }

      // Fetch current orders
      await fetchActiveOrders()
    } catch (error) {
      console.error("Error initializing route:", error)
      toast({
        title: "Error",
        description: "Failed to initialize route. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveOrders = async () => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", profile.user_id)
        .in("status", ["assigned", "picked_up", "out_for_delivery"])
        .order("priority", { ascending: false })

      if (error) throw error

      setOrders(data as Order[])
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive",
      })
    }
  }

  const startShift = async () => {
    if (orders.length === 0) {
      toast({
        title: "No Orders",
        description: "No orders available to start shift.",
        variant: "destructive",
      })
      return
    }

    setOptimizing(true)
    try {
      // Create initial optimized route
      const optimizedRoute = await routeManager.createOptimizedRoute(profile!.user_id, orders)

      setRouteId(optimizedRoute.id)
      setCurrentRoute(optimizedRoute.stops)
      setRouteHistory(optimizedRoute.history)
      setTotalDistance(optimizedRoute.totalDistance)
      setTotalTime(optimizedRoute.totalTime)
      setCompletedDistance(0)
      setCompletedTime(0)
      setShiftStarted(true)

      toast({
        title: "Shift Started",
        description: `Route optimized with ${optimizedRoute.stops.length} stops`,
      })
    } catch (error) {
      console.error("Error starting shift:", error)
      toast({
        title: "Error",
        description: "Failed to start shift. Please try again.",
        variant: "destructive",
      })
    } finally {
      setOptimizing(false)
    }
  }

  const completeDelivery = async (orderId: string, actualTime?: number, actualDistance?: number) => {
    if (!routeId || !profile) return

    try {
      const updatedRoute = await routeManager.completeDelivery(routeId, orderId, actualTime, actualDistance)

      setCurrentRoute(updatedRoute.stops)
      setRouteHistory(updatedRoute.history)
      setCompletedDistance(updatedRoute.completedDistance)
      setCompletedTime(updatedRoute.completedTime)

      toast({
        title: "Delivery Completed",
        description: "Route updated with delivery completion",
      })
    } catch (error) {
      console.error("Error completing delivery:", error)
      toast({
        title: "Error",
        description: "Failed to update route. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleNewDeliveryAssigned = async (newOrder: Order) => {
    if (!routeId || !profile) return

    try {
      const updatedRoute = await routeManager.addDeliveryToRoute(routeId, newOrder)

      setCurrentRoute(updatedRoute.stops)
      setRouteHistory(updatedRoute.history)
      setTotalDistance(updatedRoute.totalDistance)
      setTotalTime(updatedRoute.totalTime)

      toast({
        title: "New Delivery Added",
        description: "Route updated with new delivery assignment",
      })
    } catch (error) {
      console.error("Error adding delivery to route:", error)
      toast({
        title: "Error",
        description: "Failed to update route with new delivery.",
        variant: "destructive",
      })
    }
  }

  const handleDeliveryCancellation = async (orderId: string, reason: string) => {
    if (!routeId) return

    try {
      const updatedRoute = await routeManager.cancelDelivery(routeId, orderId, reason)

      setCurrentRoute(updatedRoute.stops)
      setRouteHistory(updatedRoute.history)
      setTotalDistance(updatedRoute.totalDistance)
      setTotalTime(updatedRoute.totalTime)

      toast({
        title: "Delivery Cancelled",
        description: "Route updated to reflect cancellation",
      })
    } catch (error) {
      console.error("Error cancelling delivery:", error)
      toast({
        title: "Error",
        description: "Failed to cancel delivery.",
        variant: "destructive",
      })
    }
  }

  const recalculateRoute = async () => {
    if (!routeId || !profile) return

    setOptimizing(true)
    try {
      const pendingOrders = currentRoute.filter((stop) => stop.status === "pending").map((stop) => stop.order)

      const updatedRoute = await routeManager.recalculateRoute(routeId, pendingOrders)

      setCurrentRoute(updatedRoute.stops)
      setRouteHistory(updatedRoute.history)
      setTotalDistance(updatedRoute.totalDistance)
      setTotalTime(updatedRoute.totalTime)

      toast({
        title: "Route Recalculated",
        description: "Route optimized based on current conditions",
      })
    } catch (error) {
      console.error("Error recalculating route:", error)
      toast({
        title: "Error",
        description: "Failed to recalculate route.",
        variant: "destructive",
      })
    } finally {
      setOptimizing(false)
    }
  }

  const endShift = async () => {
    if (!routeId) return

    try {
      await routeManager.endShift(routeId)

      setRouteId(null)
      setCurrentRoute([])
      setRouteHistory([])
      setShiftStarted(false)
      setTotalDistance(0)
      setTotalTime(0)
      setCompletedDistance(0)
      setCompletedTime(0)

      toast({
        title: "Shift Ended",
        description: "Route completed and archived",
      })
    } catch (error) {
      console.error("Error ending shift:", error)
      toast({
        title: "Error",
        description: "Failed to end shift.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            Completed
          </Badge>
        )
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return (
          <Badge variant="destructive" className="text-xs">
            Urgent
          </Badge>
        )
      case "high":
        return (
          <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
            High
          </Badge>
        )
      case "normal":
        return (
          <Badge variant="outline" className="text-xs">
            Normal
          </Badge>
        )
      case "low":
        return (
          <Badge variant="outline" className="text-xs text-gray-600">
            Low
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Normal
          </Badge>
        )
    }
  }

  const pendingStops = currentRoute.filter((stop) => stop.status === "pending")
  const completedStops = currentRoute.filter((stop) => stop.status === "completed")
  const remainingDistance = totalDistance - completedDistance
  const remainingTime = totalTime - completedTime

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Persistent Route Manager</h1>
            <p className="text-muted-foreground">
              {shiftStarted
                ? `Active route: ${completedStops.length}/${currentRoute.length} completed`
                : "Start your shift to create an optimized route"}
            </p>
          </div>
          <div className="flex gap-2">
            {!shiftStarted ? (
              <Button onClick={startShift} disabled={orders.length === 0 || optimizing}>
                {optimizing ? "Creating Route..." : "Start Shift"}
              </Button>
            ) : (
              <>
                <Button onClick={() => setShowHistory(!showHistory)} variant="outline">
                  <History className="mr-2 h-4 w-4" />
                  History
                </Button>
                <Button onClick={recalculateRoute} disabled={optimizing} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalculate
                </Button>
                <Button onClick={() => setShowMap(!showMap)} variant="outline">
                  <MapPin className="mr-2 h-4 w-4" />
                  {showMap ? "Hide Map" : "Show Map"}
                </Button>
                <Button onClick={endShift} variant="destructive">
                  End Shift
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Route Statistics */}
        {shiftStarted && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Stops</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentRoute.length}</div>
                <p className="text-xs text-muted-foreground">
                  {completedStops.length} completed, {pendingStops.length} pending
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Distance</CardTitle>
                <Route className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalDistance.toFixed(1)} mi</div>
                <p className="text-xs text-muted-foreground">
                  {completedDistance.toFixed(1)} completed, {remainingDistance.toFixed(1)} remaining
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(totalTime)} min</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round(completedTime)} completed, {Math.round(remainingTime)} remaining
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progress</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentRoute.length > 0 ? Math.round((completedStops.length / currentRoute.length) * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Route completion</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Route History */}
        {showHistory && routeHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Route History
              </CardTitle>
              <CardDescription>Track all changes and updates to your route</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {routeHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {entry.action === "created" && <Truck className="h-4 w-4 text-blue-600" />}
                        {entry.action === "updated" && <RefreshCw className="h-4 w-4 text-orange-600" />}
                        {entry.action === "completed" && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {entry.action === "cancelled" && <XCircle className="h-4 w-4 text-red-600" />}
                        {entry.action === "recalculated" && <Shuffle className="h-4 w-4 text-purple-600" />}
                        <span className="text-sm font-medium capitalize">{entry.action}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{entry.description}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interactive Route Map */}
        {showMap && currentRoute.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Live Route Map
              </CardTitle>
              <CardDescription>Real-time view of your optimized route with completion status</CardDescription>
            </CardHeader>
            <CardContent>
              <RouteMap stops={currentRoute} />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Available Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Available Orders ({orders.length})</CardTitle>
              <CardDescription>
                {shiftStarted ? "New orders will be added to your route" : "Orders ready for route optimization"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active orders</p>
                  <p className="text-sm text-muted-foreground mt-2">Orders will appear here when assigned to you</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">#{order.order_number}</h4>
                          {getPriorityBadge(order.priority)}
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {order.delivery_address}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Route */}
          <Card>
            <CardHeader>
              <CardTitle>Current Route</CardTitle>
              <CardDescription>
                {shiftStarted
                  ? "Your optimized delivery sequence with real-time updates"
                  : "Start your shift to see your optimized route"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentRoute.length === 0 ? (
                <div className="text-center py-8">
                  <Route className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{shiftStarted ? "No route active" : "No route created yet"}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {shiftStarted
                      ? "Route completed or no orders assigned"
                      : "Start your shift to create an optimized route"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentRoute.map((stop, index) => (
                    <div key={`${stop.order.id}-${index}`} className="border rounded-lg p-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(stop.status)}
                          {getPriorityBadge(stop.order.priority)}
                        </div>
                      </div>

                      <div className="ml-9 space-y-1">
                        <p className="font-medium text-sm">#{stop.order.order_number}</p>
                        <p className="text-sm text-muted-foreground">{stop.order.customer_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {stop.order.delivery_address}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {stop.status === "completed" && stop.actualTime
                              ? `${stop.actualTime} min (actual)`
                              : `${stop.estimatedTime} min (est)`}
                          </span>
                          <span className="flex items-center gap-1">
                            <Route className="h-3 w-3" />
                            {stop.status === "completed" && stop.actualDistance
                              ? `${stop.actualDistance.toFixed(1)} mi (actual)`
                              : `${stop.distance.toFixed(1)} mi (est)`}
                          </span>
                        </div>
                        {stop.completedAt && (
                          <p className="text-xs text-green-600">
                            Completed: {new Date(stop.completedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Route Management Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Persistent Route Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">How It Works:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Route calculated once at shift start</li>
                  <li>• Updates incrementally as deliveries complete</li>
                  <li>• Persists across browser sessions</li>
                  <li>• Handles new assignments automatically</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Features:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Complete route history tracking</li>
                  <li>• Real-time progress monitoring</li>
                  <li>• Automatic route adjustments</li>
                  <li>• Edge case handling (cancellations, etc.)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
