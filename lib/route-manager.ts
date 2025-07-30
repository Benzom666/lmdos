import { supabase } from "./supabase"
import { geocodingService } from "./geocoding-service"
import { routeOptimizer } from "./route-optimizer"
import { distanceCalculator } from "./distance-calculator"

// Add these new interfaces at the top of the file after existing imports
interface DynamicDeliveryStop {
  id: string
  coordinates: [number, number]
  timeWindow?: {
    start: Date
    end: Date
    priority: "urgent" | "high" | "normal" | "low"
  }
  estimatedServiceTime: number
  packageWeight?: number
  priority: "urgent" | "high" | "normal" | "low"
  specialRequirements?: string[]
  order: any
}

interface VehicleConstraints {
  maxCapacity: number
  currentLoad: number
  maxDeliveries: number
  workingHours: { start: Date; end: Date }
}

export interface RouteStop {
  order: any
  estimatedTime: number
  distance: number
  type: "delivery"
  status: "pending" | "completed" | "failed" | "cancelled"
  completedAt?: string
  actualTime?: number
  actualDistance?: number
  sequence: number
  coordinates?: [number, number]
  clusterGroup?: number
  optimizationScore?: number
}

export interface RouteHistory {
  id: string
  timestamp: string
  action: "created" | "updated" | "completed" | "cancelled" | "recalculated"
  description: string
  stopCount: number
  totalDistance: number
  totalTime: number
  metadata?: any
}

export interface PersistentRoute {
  id: string
  driverId: string
  shiftDate: string
  status: "active" | "completed" | "cancelled"
  stops: RouteStop[]
  history: RouteHistory[]
  totalDistance: number
  totalTime: number
  completedDistance: number
  completedTime: number
  createdAt: string
  updatedAt: string
  centerLocation: [number, number]
  optimizationMetrics?: {
    algorithm: string
    totalDistance: number
    averageSegmentDistance: number
    longestSegment: number
    shortestSegment: number
    clusteringScore: number
    improvement: number
  }
}

class RouteManager {
  private readonly DEFAULT_CENTER: [number, number] = [43.6532, -79.3832] // Default center
  private readonly DEFAULT_DEPOT: [number, number] = [43.6426, -79.3871] // Default depot location

  // Calculate distance between two coordinates (Haversine formula)
  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lon1] = coord1
    const [lat2, lon2] = coord2
    const R = 6371 // Earth's radius in kilometers

    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Enhanced geocoding with proper address handling
  private async geocodeOrderAddresses(orders: any[]): Promise<Map<string, [number, number]>> {
    const addressMap = new Map<string, [number, number]>()

    if (orders.length === 0) {
      console.log("No orders to geocode")
      return addressMap
    }

    const addresses = orders.map((order) => order.delivery_address).filter((addr) => addr && addr.trim().length > 0)

    console.log(`Geocoding ${addresses.length} addresses for route optimization`)

    if (addresses.length === 0) {
      console.warn("No valid addresses found in orders")
      // Generate fallback coordinates for all orders
      orders.forEach((order, index) => {
        if (order.delivery_address) {
          const fallbackCoords = this.generateFallbackCoordinates(order.delivery_address, index)
          addressMap.set(order.delivery_address, fallbackCoords)
        }
      })
      return addressMap
    }

    try {
      const geocodedResults = await geocodingService.geocodeWithFallback(addresses)

      geocodedResults.forEach((result, index) => {
        if (result.coordinates) {
          const originalOrder = orders.find((o) => o.delivery_address === addresses[index])
          if (originalOrder) {
            addressMap.set(originalOrder.delivery_address, result.coordinates)
            console.log(
              `Mapped address: ${originalOrder.delivery_address} -> [${result.coordinates[0]}, ${result.coordinates[1]}] (${result.city})`,
            )
          }
        }
      })

      console.log(`Successfully geocoded ${addressMap.size}/${orders.length} addresses`)
    } catch (error) {
      console.error("Error geocoding addresses:", error)
    }

    // Generate fallback coordinates for any orders that weren't geocoded
    orders.forEach((order, index) => {
      if (order.delivery_address && !addressMap.has(order.delivery_address)) {
        const fallbackCoords = this.generateFallbackCoordinates(order.delivery_address, index)
        addressMap.set(order.delivery_address, fallbackCoords)
        console.log(`Generated fallback for: ${order.delivery_address} -> [${fallbackCoords[0]}, ${fallbackCoords[1]}]`)
      }
    })

    return addressMap
  }

  // Generate fallback coordinates
  private generateFallbackCoordinates(address: string, index: number): [number, number] {
    // Use address hash for consistent positioning
    let hash = 0
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }

    const normalizedHash = Math.abs(hash) / 2147483647

    // Generate coordinates around the default center
    const latRange = 0.28
    const lonRange = 0.52

    const lat = this.DEFAULT_CENTER[0] - latRange / 2 + normalizedHash * latRange + ((index * 0.001) % latRange)
    const lon = this.DEFAULT_CENTER[1] - lonRange / 2 + normalizedHash * 0.7 * lonRange + ((index * 0.001) % lonRange)

    return [lat, lon]
  }

  // Get driver's current location using Geolocation API
  private async getDriverLocation(): Promise<[number, number] | null> {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords: [number, number] = [position.coords.latitude, position.coords.longitude]
            console.log(`Driver location detected: [${coords[0]}, ${coords[1]}]`)
            resolve(coords)
          },
          (error) => {
            console.log("Geolocation error:", error)
            resolve(null)
          },
        )
      } else {
        console.log("Geolocation not available")
        resolve(null)
      }
    })
  }

  // Calculate average coordinates of delivery addresses
  private async calculateAverageCoordinates(orders: any[]): Promise<[number, number]> {
    let totalLat = 0
    let totalLon = 0
    let validCoordsCount = 0

    const addressCoordinates = await this.geocodeOrderAddresses(orders)

    for (const order of orders) {
      const coords = addressCoordinates.get(order.delivery_address)
      if (coords) {
        totalLat += coords[0]
        totalLon += coords[1]
        validCoordsCount++
      }
    }

    if (validCoordsCount > 0) {
      const avgLat = totalLat / validCoordsCount
      const avgLon = totalLon / validCoordsCount
      console.log(`Calculated average coordinates: [${avgLat}, ${avgLon}]`)
      return [avgLat, avgLon]
    } else {
      console.log("No valid coordinates found, using default center")
      return this.DEFAULT_CENTER
    }
  }

  // Enhanced route optimization with multiple algorithms and real-world distance calculation
  private async optimizeRoute(orders: any[], startLocation: [number, number]): Promise<RouteStop[]> {
    if (orders.length === 0) {
      console.log("No orders to optimize")
      return []
    }

    console.log(`Starting nearest neighbor route optimization for ${orders.length} orders`)
    console.log(`Driver starting location: [${startLocation[0]}, ${startLocation[1]}]`)
    console.log(
      "Orders to optimize:",
      orders.map((o) => ({
        id: o.id,
        number: o.order_number,
        address: o.delivery_address,
        status: o.status,
      })),
    )

    // Validate orders have required fields
    const validOrders = orders.filter(
      (order) => order.id && order.delivery_address && order.delivery_address.trim().length > 0,
    )

    if (validOrders.length === 0) {
      console.error("No valid orders found after filtering")
      return []
    }

    if (validOrders.length < orders.length) {
      console.warn(`Filtered out ${orders.length - validOrders.length} invalid orders`)
    }

    // Get real coordinates for all addresses
    const addressCoordinates = await this.geocodeOrderAddresses(validOrders)
    console.log("Address coordinates:", addressCoordinates.size, "addresses geocoded")

    if (addressCoordinates.size === 0) {
      console.error("No addresses could be geocoded")
      return []
    }

    // Convert orders to dynamic delivery stops
    const deliveryStops: DynamicDeliveryStop[] = []

    for (let index = 0; index < validOrders.length; index++) {
      const order = validOrders[index]
      const coords = addressCoordinates.get(order.delivery_address)

      if (!coords) {
        console.warn(`Could not find coordinates for address: ${order.delivery_address}`)
        continue
      }

      // Parse delivery time window if available
      let timeWindow
      if (order.delivery_window_start && order.delivery_window_end) {
        timeWindow = {
          start: new Date(order.delivery_window_start),
          end: new Date(order.delivery_window_end),
          priority: order.priority || "normal",
        }
      }

      deliveryStops.push({
        id: order.id,
        coordinates: coords,
        timeWindow,
        estimatedServiceTime: this.calculateDeliveryTime(order),
        packageWeight: order.package_weight || 1,
        priority: order.priority || "normal",
        specialRequirements: order.special_requirements ? order.special_requirements.split(",") : [],
        order,
      })
    }

    console.log("Created", deliveryStops.length, "delivery stops")

    if (deliveryStops.length === 0) {
      console.error("No delivery stops created")
      return []
    }

    // Define vehicle constraints
    const vehicleConstraints: VehicleConstraints = {
      maxCapacity: 50,
      currentLoad: 0,
      maxDeliveries: 20,
      workingHours: {
        start: new Date(),
        end: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    }

    // Run nearest neighbor optimization starting from driver location
    try {
      console.log("Running nearest neighbor optimization starting from driver location...")

      const optimizationResult = await routeOptimizer.optimizeDeliveryRoute(
        startLocation,
        deliveryStops,
        vehicleConstraints,
        new Date(),
      )

      console.log(`Nearest neighbor optimization completed:`)
      console.log(`- Algorithm: ${optimizationResult.algorithm}`)
      console.log(`- Total distance: ${optimizationResult.totalDistance.toFixed(2)} km`)
      console.log(`- Total time: ${optimizationResult.totalTime.toFixed(1)} minutes`)
      console.log(`- Route length: ${optimizationResult.route.length}`)
      console.log(`- Route sequence: [${optimizationResult.route.join(" -> ")}]`)

      if (optimizationResult.route.length === 0) {
        console.error("Optimization returned empty route")
        throw new Error("Optimization returned empty route")
      }

      // Convert back to RouteStop objects with proper sequencing
      const stops: RouteStop[] = []
      let cumulativeDistance = 0

      for (let i = 0; i < optimizationResult.route.length; i++) {
        const deliveryIndex = optimizationResult.route[i]
        const delivery = deliveryStops[deliveryIndex]

        if (!delivery) {
          console.warn(`Missing delivery at index ${deliveryIndex}`)
          continue
        }

        // Calculate segment distance
        const prevLocation = i === 0 ? startLocation : deliveryStops[optimizationResult.route[i - 1]].coordinates
        const segmentDistance = distanceCalculator.calculateRealWorldDistance(prevLocation, delivery.coordinates)
        cumulativeDistance += segmentDistance

        // Get estimated arrival time and traffic adjustment
        const estimatedArrival = optimizationResult.estimatedArrivalTimes[i] || new Date()
        const trafficAdjustment = optimizationResult.trafficAdjustments[i] || 1.0

        stops.push({
          order: delivery.order,
          estimatedTime: delivery.estimatedServiceTime,
          distance: segmentDistance,
          type: "delivery",
          status: "pending",
          sequence: i + 1,
          coordinates: delivery.coordinates,
          optimizationScore: this.calculateDynamicOptimizationScore(
            delivery,
            estimatedArrival,
            trafficAdjustment,
            i,
            optimizationResult.route.length,
          ),
        })

        console.log(
          `Stop ${i + 1}: Order ${delivery.order.order_number} at [${delivery.coordinates[0]}, ${delivery.coordinates[1]}], distance: ${segmentDistance.toFixed(2)}km`,
        )
      }

      console.log("Created", stops.length, "route stops with nearest neighbor optimization")
      console.log(`Total optimized distance: ${cumulativeDistance.toFixed(2)}km`)

      if (stops.length === 0) {
        console.error("No route stops created from optimization result")
        throw new Error("No route stops created from optimization result")
      }

      return stops
    } catch (error) {
      console.error("Error in route optimization:", error)
      throw error
    }
  }

  // Calculate delivery time based on order characteristics
  private calculateDeliveryTime(order: any): number {
    let baseTime = 10 // Base delivery time in minutes

    // Adjust based on order priority
    switch (order.priority) {
      case "urgent":
        baseTime += 5 // Extra time for careful handling
        break
      case "high":
        baseTime += 2
        break
      case "low":
        baseTime -= 2
        break
    }

    // Adjust based on delivery notes complexity
    if (order.delivery_notes && order.delivery_notes.length > 100) {
      baseTime += 3 // Extra time for complex instructions
    }

    // Add random variation (±2 minutes)
    baseTime += (Math.random() - 0.5) * 4

    return Math.max(baseTime, 5) // Minimum 5 minutes
  }

  // Calculate optimization score for individual stops
  private calculateOptimizationScore(
    order: any,
    coordinates: [number, number],
    allCoordinates: [number, number][],
    route: number[],
    position: number,
  ): number {
    let score = 100 // Base score

    // Penalty for long segments
    if (position > 0) {
      const prevCoords = allCoordinates[route[position - 1]]
      const distance = distanceCalculator.calculateRealWorldDistance(prevCoords, coordinates)
      if (distance > 10) score -= 20 // Penalty for segments > 10km
      if (distance > 20) score -= 30 // Additional penalty for segments > 20km
    }

    // Bonus for priority orders being early in route
    const routeProgress = position / route.length
    switch (order.priority) {
      case "urgent":
        score += (1 - routeProgress) * 20 // Up to 20 point bonus for early delivery
        break
      case "high":
        score += (1 - routeProgress) * 10
        break
    }

    // Bonus for good clustering (nearby stops)
    let nearbyCount = 0
    for (let i = Math.max(1, position - 2); i <= Math.min(route.length - 1, position + 2); i++) {
      if (i !== position) {
        const otherCoords = allCoordinates[route[i]]
        const distance = distanceCalculator.calculateRealWorldDistance(coordinates, otherCoords)
        if (distance < 5) nearbyCount++ // Within 5km
      }
    }
    score += nearbyCount * 5 // 5 points per nearby stop

    return Math.max(0, Math.min(100, score))
  }

  // Add this new method for dynamic optimization scoring
  private calculateDynamicOptimizationScore(
    delivery: DynamicDeliveryStop,
    estimatedArrival: Date,
    trafficAdjustment: number,
    position: number,
    totalStops: number,
  ): number {
    let score = 100

    // Position efficiency (earlier positions get bonus for urgent deliveries)
    const positionRatio = position / totalStops
    switch (delivery.priority) {
      case "urgent":
        score += (1 - positionRatio) * 30
        break
      case "high":
        score += (1 - positionRatio) * 20
        break
      case "normal":
        score += (1 - positionRatio) * 10
        break
    }

    // Time window compliance
    if (delivery.timeWindow) {
      if (estimatedArrival <= delivery.timeWindow.end) {
        score += 25 // On time bonus

        // Early arrival bonus (but not too early)
        const timeToWindow = delivery.timeWindow.start.getTime() - estimatedArrival.getTime()
        const hoursEarly = timeToWindow / (1000 * 60 * 60)

        if (hoursEarly >= 0 && hoursEarly <= 1) {
          score += 15 // Perfect timing
        } else if (hoursEarly > 1) {
          score -= hoursEarly * 5 // Penalty for being too early
        }
      } else {
        score -= 40 // Late penalty
      }
    }

    // Traffic efficiency
    if (trafficAdjustment > 1.2) {
      score -= (trafficAdjustment - 1.0) * 20 // Penalty for heavy traffic
    } else if (trafficAdjustment < 1.1) {
      score += 10 // Bonus for light traffic
    }

    // Special requirements penalty (more complex deliveries)
    if (delivery.specialRequirements && delivery.specialRequirements.length > 0) {
      score -= delivery.specialRequirements.length * 5
    }

    return Math.max(0, Math.min(100, score))
  }

  // Check if required tables exist
  private async checkTablesExist(): Promise<boolean> {
    try {
      const { error } = await supabase.from("driver_routes").select("id").limit(1)
      return !error
    } catch (error) {
      console.log("Route tables don't exist yet:", error)
      return false
    }
  }

  // Create a new optimized route with advanced algorithms
  async createOptimizedRoute(driverId: string, orders: any[]): Promise<PersistentRoute> {
    try {
      console.log(`Creating optimized route for driver ${driverId} with ${orders.length} orders`)

      if (orders.length === 0) {
        throw new Error("No orders provided for route optimization")
      }

      // Check if tables exist first
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        console.log("Route tables don't exist, falling back to in-memory route")
        return this.createInMemoryRoute(driverId, orders)
      }

      // Get driver's current location
      let startLocation = await this.getDriverLocation()

      // If geolocation fails, use the average of delivery addresses
      if (!startLocation) {
        console.log("Geolocation failed, calculating average coordinates")
        startLocation = await this.calculateAverageCoordinates(orders)
      }

      // Optimize the route with advanced algorithms
      const optimizedStops = await this.optimizeRoute(orders, startLocation)

      if (optimizedStops.length === 0) {
        console.error("Route optimization produced no stops")
        throw new Error("Route optimization failed: No valid stops could be created")
      }

      console.log("Optimization successful, creating", optimizedStops.length, "stops")

      const totalDistance = optimizedStops.reduce((sum, stop) => sum + stop.distance, 0)
      const totalTime = optimizedStops.reduce((sum, stop) => sum + stop.estimatedTime, 0)

      // Calculate optimization metrics
      const allCoordinates = [startLocation, ...optimizedStops.map((stop) => stop.coordinates!)]
      const routeIndices = Array.from({ length: allCoordinates.length }, (_, i) => i)
      const routeAnalysis = routeOptimizer.analyzeRoute(routeIndices, allCoordinates)

      // Create route record in database
      const routeData = {
        driver_id: driverId,
        shift_date: new Date().toISOString().split("T")[0],
        status: "active",
        total_distance: totalDistance,
        total_time: totalTime,
        completed_distance: 0,
        completed_time: 0,
        optimization_metrics: JSON.stringify({
          algorithm: "advanced_multi_strategy",
          totalDistance,
          averageSegmentDistance: routeAnalysis.averageSegmentDistance,
          longestSegment: routeAnalysis.longestSegment,
          shortestSegment: routeAnalysis.shortestSegment,
          clusteringScore: routeAnalysis.clusteringScore,
          improvement: 0,
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: route, error: routeError } = await supabase
        .from("driver_routes")
        .insert(routeData)
        .select()
        .single()

      if (routeError) {
        console.error("Error creating route:", routeError)
        throw new Error(`Failed to create route: ${routeError.message}`)
      }

      // Create route stops with coordinates and optimization data
      const stopsData = optimizedStops.map((stop) => ({
        route_id: route.id,
        order_id: stop.order.id,
        sequence: stop.sequence,
        estimated_time: stop.estimatedTime,
        estimated_distance: stop.distance,
        status: stop.status,
        coordinates: JSON.stringify(stop.coordinates),
        optimization_score: stop.optimizationScore,
        cluster_group: stop.clusterGroup,
        created_at: new Date().toISOString(),
      }))

      const { error: stopsError } = await supabase.from("route_stops").insert(stopsData)

      if (stopsError) {
        console.error("Error creating route stops:", stopsError)
        throw new Error(`Failed to create route stops: ${stopsError.message}`)
      }

      // Create initial history entry
      const historyEntry: RouteHistory = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action: "created",
        description: `Advanced optimized route created with ${optimizedStops.length} stops using multi-strategy algorithm`,
        stopCount: optimizedStops.length,
        totalDistance,
        totalTime,
        metadata: {
          startLocation,
          orderCount: orders.length,
          algorithm: "advanced_multi_strategy",
          optimizationMetrics: routeAnalysis,
        },
      }

      await this.addHistoryEntry(route.id, historyEntry)

      const persistentRoute: PersistentRoute = {
        id: route.id,
        driverId,
        shiftDate: route.shift_date,
        status: route.status,
        stops: optimizedStops,
        history: [historyEntry],
        totalDistance,
        totalTime,
        completedDistance: 0,
        completedTime: 0,
        createdAt: route.created_at,
        updatedAt: route.updated_at,
        centerLocation: this.DEFAULT_CENTER,
        optimizationMetrics: {
          algorithm: "advanced_multi_strategy",
          totalDistance,
          averageSegmentDistance: routeAnalysis.averageSegmentDistance,
          longestSegment: routeAnalysis.longestSegment,
          shortestSegment: routeAnalysis.shortestSegment,
          clusteringScore: routeAnalysis.clusteringScore,
          improvement: 0,
        },
      }

      console.log(`Successfully created advanced optimized route with ${optimizedStops.length} stops`)
      console.log(`Total distance: ${totalDistance.toFixed(2)} km, Total time: ${totalTime.toFixed(1)} minutes`)
      return persistentRoute
    } catch (error) {
      console.error("Error creating optimized route:", error)
      // Fallback to in-memory route if database operations fail
      return this.createInMemoryRoute(driverId, orders)
    }
  }

  // Create an in-memory route when database tables don't exist
  private async createInMemoryRoute(driverId: string, orders: any[]): Promise<PersistentRoute> {
    console.log(`Creating in-memory route for ${orders.length} orders`)

    if (orders.length === 0) {
      console.log("No orders to optimize")
      const now = new Date().toISOString()
      return {
        id: crypto.randomUUID(),
        driverId,
        shiftDate: now.split("T")[0],
        status: "active",
        stops: [],
        history: [],
        totalDistance: 0,
        totalTime: 0,
        completedDistance: 0,
        completedTime: 0,
        createdAt: now,
        updatedAt: now,
        centerLocation: this.DEFAULT_CENTER,
      }
    }

    // Get driver's current location
    let startLocation = await this.getDriverLocation()

    // If geolocation fails, use the average of delivery addresses
    if (!startLocation) {
      console.log("Geolocation failed, calculating average coordinates")
      startLocation = await this.calculateAverageCoordinates(orders)
    }

    console.log("Optimizing route with start location:", startLocation)

    try {
      const optimizedStops = await this.optimizeRoute(orders, startLocation)
      console.log("Optimization complete, created", optimizedStops.length, "stops")

      const totalDistance = optimizedStops.reduce((sum, stop) => sum + stop.distance, 0)
      const totalTime = optimizedStops.reduce((sum, stop) => sum + stop.estimatedTime, 0)
      const now = new Date().toISOString()

      return {
        id: crypto.randomUUID(),
        driverId,
        shiftDate: now.split("T")[0],
        status: "active",
        stops: optimizedStops,
        history: [
          {
            id: crypto.randomUUID(),
            timestamp: now,
            action: "created",
            description: `In-memory advanced route created with ${optimizedStops.length} stops`,
            stopCount: optimizedStops.length,
            totalDistance,
            totalTime,
            metadata: { inMemory: true, algorithm: "advanced_multi_strategy" },
          },
        ],
        totalDistance,
        totalTime,
        completedDistance: 0,
        completedTime: 0,
        createdAt: now,
        updatedAt: now,
        centerLocation: this.DEFAULT_CENTER,
        optimizationMetrics: {
          algorithm: "advanced_multi_strategy",
          totalDistance,
          averageSegmentDistance:
            optimizedStops.length > 0
              ? optimizedStops.reduce((sum, stop) => sum + stop.distance, 0) / optimizedStops.length
              : 0,
          longestSegment: optimizedStops.length > 0 ? Math.max(...optimizedStops.map((stop) => stop.distance)) : 0,
          shortestSegment: optimizedStops.length > 0 ? Math.min(...optimizedStops.map((stop) => stop.distance)) : 0,
          clusteringScore: 0,
          improvement: 0,
        },
      }
    } catch (error) {
      console.error("Error in in-memory route creation:", error)
      throw error
    }
  }

  // Get current active route for driver with coordinates
  async getCurrentRoute(driverId: string): Promise<PersistentRoute | null> {
    try {
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        return null
      }

      const today = new Date().toISOString().split("T")[0]

      const { data: route, error: routeError } = await supabase
        .from("driver_routes")
        .select("*")
        .eq("driver_id", driverId)
        .eq("shift_date", today)
        .eq("status", "active")
        .single()

      if (routeError || !route) return null

      // Get route stops with order details and coordinates
      const { data: stops, error: stopsError } = await supabase
        .from("route_stops")
        .select(`
          *,
          orders (*)
        `)
        .eq("route_id", route.id)
        .order("sequence")

      if (stopsError) {
        console.error("Error fetching route stops:", stopsError)
        return null
      }

      // Get route history
      const { data: history, error: historyError } = await supabase
        .from("route_history")
        .select("*")
        .eq("route_id", route.id)
        .order("timestamp")

      if (historyError) {
        console.error("Error fetching route history:", historyError)
      }

      const routeStops: RouteStop[] = stops
        .filter((stop) => stop.orders) // Filter out stops without orders
        .map((stop) => ({
          order: stop.orders,
          estimatedTime: stop.estimated_time,
          distance: stop.estimated_distance,
          type: "delivery",
          status: stop.status,
          completedAt: stop.completed_at,
          actualTime: stop.actual_time,
          actualDistance: stop.actual_distance,
          sequence: stop.sequence,
          coordinates: stop.coordinates ? JSON.parse(stop.coordinates) : undefined,
          optimizationScore: stop.optimization_score,
          clusterGroup: stop.cluster_group,
        }))

      console.log("Loaded route with", routeStops.length, "valid stops")

      if (routeStops.length === 0) {
        console.warn("Route exists but has no valid stops")
        return null
      }

      // Parse optimization metrics if available
      let optimizationMetrics
      try {
        optimizationMetrics = route.optimization_metrics ? JSON.parse(route.optimization_metrics) : undefined
      } catch (error) {
        console.warn("Failed to parse optimization metrics:", error)
      }

      return {
        id: route.id,
        driverId: route.driver_id,
        shiftDate: route.shift_date,
        status: route.status,
        stops: routeStops,
        history: history || [],
        totalDistance: route.total_distance,
        totalTime: route.total_time,
        completedDistance: route.completed_distance,
        completedTime: route.completed_time,
        createdAt: route.created_at,
        updatedAt: route.updated_at,
        centerLocation: this.DEFAULT_CENTER,
        optimizationMetrics,
      }
    } catch (error) {
      console.error("Error getting current route:", error)
      return null
    }
  }

  // Complete a delivery and update route
  async completeDelivery(
    routeId: string,
    orderId: string,
    actualTime?: number,
    actualDistance?: number,
  ): Promise<PersistentRoute> {
    try {
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        throw new Error("Route tables not available")
      }

      const completedAt = new Date().toISOString()

      // Update route stop
      const { error: stopError } = await supabase
        .from("route_stops")
        .update({
          status: "completed",
          completed_at: completedAt,
          actual_time: actualTime,
          actual_distance: actualDistance,
          updated_at: completedAt,
        })
        .eq("route_id", routeId)
        .eq("order_id", orderId)

      if (stopError) {
        console.error("Error updating route stop:", stopError)
        throw new Error(`Failed to update route stop: ${stopError.message}`)
      }

      // Get updated route data
      const route = await this.getCurrentRoute("")
      if (!route) throw new Error("Route not found")

      // Calculate new completed totals
      const completedStops = route.stops.filter((stop) => stop.status === "completed")
      const newCompletedDistance = completedStops.reduce((sum, stop) => sum + (stop.actualDistance || stop.distance), 0)
      const newCompletedTime = completedStops.reduce((sum, stop) => sum + (stop.actualTime || stop.estimatedTime), 0)

      // Update route totals
      const { error: routeError } = await supabase
        .from("driver_routes")
        .update({
          completed_distance: newCompletedDistance,
          completed_time: newCompletedTime,
          updated_at: completedAt,
        })
        .eq("id", routeId)

      if (routeError) {
        console.error("Error updating route:", routeError)
        throw new Error(`Failed to update route: ${routeError.message}`)
      }

      // Add history entry
      const historyEntry: RouteHistory = {
        id: crypto.randomUUID(),
        timestamp: completedAt,
        action: "completed",
        description: `Delivery completed for order ${orderId}`,
        stopCount: route.stops.length,
        totalDistance: route.totalDistance,
        totalTime: route.totalTime,
        metadata: { orderId, actualTime, actualDistance },
      }

      await this.addHistoryEntry(routeId, historyEntry)

      // Return updated route
      return {
        ...route,
        completedDistance: newCompletedDistance,
        completedTime: newCompletedTime,
        updatedAt: completedAt,
      }
    } catch (error) {
      console.error("Error completing delivery:", error)
      throw new Error("Failed to complete delivery")
    }
  }

  // Add new delivery to existing route with re-optimization
  async addDeliveryToRoute(routeId: string, newOrder: any): Promise<PersistentRoute> {
    try {
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        throw new Error("Route tables not available")
      }

      const route = await this.getCurrentRoute("")
      if (!route) throw new Error("Route not found")

      // Get all pending orders including the new one
      const pendingOrders = route.stops
        .filter((stop) => stop.status === "pending")
        .map((stop) => stop.order)
        .concat([newOrder])

      // Re-optimize the route with the new order
      const reoptimizedStops = await this.optimizeRoute(pendingOrders, this.DEFAULT_DEPOT)

      // Update route totals
      const newTotalDistance = route.completedDistance + reoptimizedStops.reduce((sum, stop) => sum + stop.distance, 0)
      const newTotalTime = route.completedTime + reoptimizedStops.reduce((sum, stop) => sum + stop.estimatedTime, 0)

      // Delete existing pending stops
      await supabase.from("route_stops").delete().eq("route_id", routeId).eq("status", "pending")

      // Insert re-optimized stops
      const stopsData = reoptimizedStops.map((stop) => ({
        route_id: routeId,
        order_id: stop.order.id,
        sequence: stop.sequence,
        estimated_time: stop.estimatedTime,
        estimated_distance: stop.distance,
        status: stop.status,
        coordinates: JSON.stringify(stop.coordinates),
        optimization_score: stop.optimizationScore,
        cluster_group: stop.clusterGroup,
        created_at: new Date().toISOString(),
      }))

      const { error: stopsError } = await supabase.from("route_stops").insert(stopsData)

      if (stopsError) {
        console.error("Error adding route stops:", stopsError)
        throw new Error(`Failed to add route stops: ${stopsError.message}`)
      }

      // Update route totals
      const { error: routeError } = await supabase
        .from("driver_routes")
        .update({
          total_distance: newTotalDistance,
          total_time: newTotalTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", routeId)

      if (routeError) {
        console.error("Error updating route totals:", routeError)
        throw new Error(`Failed to update route totals: ${routeError.message}`)
      }

      // Add history entry
      const historyEntry: RouteHistory = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action: "updated",
        description: `New delivery added and route re-optimized: ${newOrder.order_number}`,
        stopCount: reoptimizedStops.length,
        totalDistance: newTotalDistance,
        totalTime: newTotalTime,
        metadata: { orderId: newOrder.id, orderNumber: newOrder.order_number, reoptimized: true },
      }

      await this.addHistoryEntry(routeId, historyEntry)

      // Return updated route
      const updatedRoute = await this.getCurrentRoute("")
      return updatedRoute!
    } catch (error) {
      console.error("Error adding delivery to route:", error)
      throw new Error("Failed to add delivery to route")
    }
  }

  // Cancel a delivery
  async cancelDelivery(routeId: string, orderId: string, reason: string): Promise<PersistentRoute> {
    try {
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        throw new Error("Route tables not available")
      }

      const cancelledAt = new Date().toISOString()

      // Update route stop
      const { error: stopError } = await supabase
        .from("route_stops")
        .update({
          status: "cancelled",
          completed_at: cancelledAt,
          updated_at: cancelledAt,
        })
        .eq("route_id", routeId)
        .eq("order_id", orderId)

      if (stopError) {
        console.error("Error cancelling route stop:", stopError)
        throw new Error(`Failed to cancel route stop: ${stopError.message}`)
      }

      // Add history entry
      const historyEntry: RouteHistory = {
        id: crypto.randomUUID(),
        timestamp: cancelledAt,
        action: "cancelled",
        description: `Delivery cancelled: ${reason}`,
        stopCount: 0,
        totalDistance: 0,
        totalTime: 0,
        metadata: { orderId, reason },
      }

      await this.addHistoryEntry(routeId, historyEntry)

      // Return updated route
      const updatedRoute = await this.getCurrentRoute("")
      return updatedRoute!
    } catch (error) {
      console.error("Error cancelling delivery:", error)
      throw new Error("Failed to cancel delivery")
    }
  }

  // Recalculate route for pending deliveries with advanced optimization
  async recalculateRoute(routeId: string, pendingOrders: any[]): Promise<PersistentRoute> {
    try {
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        throw new Error("Route tables not available")
      }

      const startLocation: [number, number] = this.DEFAULT_DEPOT
      const optimizedStops = await this.optimizeRoute(pendingOrders, startLocation)

      // Update pending stops with new optimization
      for (const stop of optimizedStops) {
        const { error } = await supabase
          .from("route_stops")
          .update({
            sequence: stop.sequence,
            estimated_time: stop.estimatedTime,
            estimated_distance: stop.distance,
            coordinates: JSON.stringify(stop.coordinates),
            optimization_score: stop.optimizationScore,
            cluster_group: stop.clusterGroup,
            updated_at: new Date().toISOString(),
          })
          .eq("route_id", routeId)
          .eq("order_id", stop.order.id)
          .eq("status", "pending")

        if (error) {
          console.error("Error updating route stop:", error)
        }
      }

      // Add history entry
      const historyEntry: RouteHistory = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action: "recalculated",
        description: `Route recalculated with advanced optimization for ${optimizedStops.length} pending deliveries`,
        stopCount: optimizedStops.length,
        totalDistance: 0,
        totalTime: 0,
        metadata: { pendingCount: optimizedStops.length, algorithm: "advanced_multi_strategy" },
      }

      await this.addHistoryEntry(routeId, historyEntry)

      // Return updated route
      const updatedRoute = await this.getCurrentRoute("")
      return updatedRoute!
    } catch (error) {
      console.error("Error recalculating route:", error)
      throw new Error("Failed to recalculate route")
    }
  }

  // End shift and archive route
  async endShift(routeId: string): Promise<void> {
    try {
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        console.log("Route tables not available, skipping database operations for shift end")
        return // Gracefully handle missing tables
      }

      const endedAt = new Date().toISOString()

      // Update route status
      const { error: routeError } = await supabase
        .from("driver_routes")
        .update({
          status: "completed",
          updated_at: endedAt,
        })
        .eq("id", routeId)

      if (routeError) {
        console.error("Error ending shift:", routeError)
        throw new Error(`Failed to end shift: ${routeError.message}`)
      }

      // Add final history entry
      const historyEntry: RouteHistory = {
        id: crypto.randomUUID(),
        timestamp: endedAt,
        action: "completed",
        description: "Shift ended and optimized route archived",
        stopCount: 0,
        totalDistance: 0,
        totalTime: 0,
        metadata: { shiftEnded: true },
      }

      await this.addHistoryEntry(routeId, historyEntry)
    } catch (error) {
      console.error("Error ending shift:", error)
      // Don't throw error for missing tables - just log it
      if (error.message?.includes("Route tables not available")) {
        console.log("Shift end completed (in-memory mode)")
        return
      }
      throw new Error("Failed to end shift")
    }
  }

  // Safely end route (works for both database and in-memory routes)
  async safeEndRoute(routeId: string | null): Promise<void> {
    try {
      if (!routeId) {
        console.log("No route ID provided, clearing in-memory state only")
        return
      }

      const tablesExist = await this.checkTablesExist()
      if (tablesExist) {
        await this.endShift(routeId)
      } else {
        console.log("Route tables not available, ending in-memory route")
      }
    } catch (error) {
      console.error("Error safely ending route:", error)
      // Don't throw - just log the error
    }
  }

  // Add history entry
  private async addHistoryEntry(routeId: string, entry: RouteHistory): Promise<void> {
    try {
      const tablesExist = await this.checkTablesExist()
      if (!tablesExist) {
        console.log("Route history table not available, skipping history entry")
        return
      }

      const { error } = await supabase.from("route_history").insert({
        id: entry.id,
        route_id: routeId,
        timestamp: entry.timestamp,
        action: entry.action,
        description: entry.description,
        stop_count: entry.stopCount,
        total_distance: entry.totalDistance,
        total_time: entry.totalTime,
        metadata: entry.metadata,
      })

      if (error) {
        console.error("Error adding history entry:", error)
      }
    } catch (error) {
      console.error("Error adding history entry:", error)
    }
  }
}

export const routeManager = new RouteManager()
