// Advanced route optimization algorithms with real-time dynamic optimization
import { distanceCalculator } from "./distance-calculator"

interface OptimizationResult {
  route: number[]
  totalDistance: number
  totalTime: number
  algorithm: string
  iterations: number
  improvement: number
  estimatedArrivalTimes: Date[]
  trafficAdjustments: number[]
  isValid: boolean
  errors: string[]
}

interface DeliveryWindow {
  start: Date
  end: Date
  priority: "urgent" | "high" | "normal" | "low"
}

interface TrafficCondition {
  segmentIndex: number
  delayFactor: number // 1.0 = normal, 1.5 = 50% slower
  congestionLevel: "light" | "moderate" | "heavy"
}

interface VehicleConstraints {
  maxCapacity: number
  currentLoad: number
  maxDeliveries: number
  workingHours: { start: Date; end: Date }
}

interface DeliveryStop {
  id: string
  coordinates: [number, number]
  timeWindow?: DeliveryWindow
  estimatedServiceTime: number // minutes
  packageWeight?: number
  priority: "urgent" | "high" | "normal" | "low"
  specialRequirements?: string[]
}

class RouteOptimizer {
  private readonly MAX_ITERATIONS = 1000
  private readonly IMPROVEMENT_THRESHOLD = 0.001
  private readonly CLUSTER_SIZE_LIMIT = 8
  private readonly TRAFFIC_UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes
  private readonly OPTIMIZATION_TIMEOUT = 30000 // 30 seconds
  private trafficCache = new Map<string, TrafficCondition>()
  private lastTrafficUpdate = 0

  // Main dynamic optimization function with enhanced error handling
  async optimizeDeliveryRoute(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    vehicleConstraints: VehicleConstraints,
    currentTime: Date = new Date(),
  ): Promise<OptimizationResult> {
    const startTime = Date.now()
    const errors: string[] = []

    console.log(`Starting dynamic route optimization for ${deliveries.length} deliveries`)
    console.log(`Driver location: [${driverLocation[0]}, ${driverLocation[1]}]`)

    try {
      // Input validation
      const validationResult = this.validateInputs(driverLocation, deliveries, vehicleConstraints)
      if (!validationResult.isValid) {
        return this.createErrorResult(validationResult.errors)
      }

      if (deliveries.length === 0) {
        console.log("No deliveries provided for optimization")
        return this.createEmptyResult()
      }

      // Validate deliveries have coordinates
      const validDeliveries = deliveries.filter(
        (d) =>
          d.coordinates &&
          d.coordinates.length === 2 &&
          !isNaN(d.coordinates[0]) &&
          !isNaN(d.coordinates[1]) &&
          Math.abs(d.coordinates[0]) <= 90 && // Valid latitude
          Math.abs(d.coordinates[1]) <= 180, // Valid longitude
      )

      console.log(`Valid deliveries after coordinate check: ${validDeliveries.length}/${deliveries.length}`)

      if (validDeliveries.length === 0) {
        errors.push("No valid deliveries with coordinates found")
        return this.createErrorResult(errors)
      }

      if (validDeliveries.length < deliveries.length) {
        const invalidCount = deliveries.length - validDeliveries.length
        errors.push(`Filtered out ${invalidCount} deliveries with invalid coordinates`)
        console.warn(`Filtered out ${invalidCount} deliveries with invalid coordinates`)
      }

      // Update traffic conditions with timeout
      try {
        await Promise.race([
          this.updateTrafficConditions(driverLocation, validDeliveries),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Traffic update timeout")), 5000)),
        ])
      } catch (error) {
        console.warn("Traffic update failed:", error)
        errors.push("Traffic data unavailable, using default estimates")
      }

      // Filter deliveries based on constraints - make this more lenient
      const feasibleDeliveries = this.filterFeasibleDeliveries(validDeliveries, vehicleConstraints, currentTime)

      console.log(`Feasible deliveries after constraint check: ${feasibleDeliveries.length}/${validDeliveries.length}`)

      if (feasibleDeliveries.length === 0) {
        console.log("No feasible deliveries found within constraints, using all valid deliveries")
        errors.push("Some deliveries may exceed vehicle constraints")
      }

      const deliveriesToOptimize = feasibleDeliveries.length > 0 ? feasibleDeliveries : validDeliveries

      // Run optimization with timeout
      const optimizationPromise = this.runOptimizationAlgorithms(driverLocation, deliveriesToOptimize, currentTime)
      const timeoutPromise = new Promise<OptimizationResult>((_, reject) =>
        setTimeout(() => reject(new Error("Optimization timeout")), this.OPTIMIZATION_TIMEOUT),
      )

      const result = await Promise.race([optimizationPromise, timeoutPromise])

      // Validate result
      const validatedResult = this.validateOptimizationResult(result, deliveriesToOptimize)
      validatedResult.errors = [...errors, ...validatedResult.errors]

      const endTime = Date.now()
      console.log(`Optimization completed in ${endTime - startTime}ms`)

      return validatedResult
    } catch (error) {
      console.error("Route optimization failed:", error)
      errors.push(error instanceof Error ? error.message : "Unknown optimization error")

      // Return fallback result
      return this.createFallbackResult(driverLocation, deliveries, currentTime, errors)
    }
  }

  private validateInputs(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    vehicleConstraints: VehicleConstraints,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate driver location
    if (!driverLocation || driverLocation.length !== 2) {
      errors.push("Invalid driver location")
    } else if (isNaN(driverLocation[0]) || isNaN(driverLocation[1])) {
      errors.push("Driver location contains invalid coordinates")
    } else if (Math.abs(driverLocation[0]) > 90 || Math.abs(driverLocation[1]) > 180) {
      errors.push("Driver location coordinates out of valid range")
    }

    // Validate deliveries
    if (!Array.isArray(deliveries)) {
      errors.push("Deliveries must be an array")
    } else if (deliveries.length > 100) {
      errors.push("Too many deliveries (maximum 100)")
    }

    // Validate vehicle constraints
    if (!vehicleConstraints) {
      errors.push("Vehicle constraints are required")
    } else {
      if (vehicleConstraints.maxCapacity <= 0) {
        errors.push("Invalid vehicle capacity")
      }
      if (vehicleConstraints.currentLoad < 0) {
        errors.push("Invalid current load")
      }
      if (vehicleConstraints.currentLoad > vehicleConstraints.maxCapacity) {
        errors.push("Current load exceeds vehicle capacity")
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  private validateOptimizationResult(result: OptimizationResult, deliveries: DeliveryStop[]): OptimizationResult {
    const errors: string[] = [...result.errors]

    // Check if route contains all deliveries
    if (result.route.length !== deliveries.length) {
      errors.push(`Route missing deliveries: expected ${deliveries.length}, got ${result.route.length}`)
    }

    // Check for duplicate indices
    const uniqueIndices = new Set(result.route)
    if (uniqueIndices.size !== result.route.length) {
      errors.push("Route contains duplicate delivery indices")
    }

    // Check for invalid indices
    const invalidIndices = result.route.filter((index) => index < 0 || index >= deliveries.length)
    if (invalidIndices.length > 0) {
      errors.push(`Route contains invalid indices: ${invalidIndices.join(", ")}`)
    }

    // Validate distances and times
    if (result.totalDistance < 0 || isNaN(result.totalDistance)) {
      errors.push("Invalid total distance")
      result.totalDistance = 0
    }

    if (result.totalTime < 0 || isNaN(result.totalTime)) {
      errors.push("Invalid total time")
      result.totalTime = 0
    }

    return {
      ...result,
      isValid: errors.length === 0,
      errors,
    }
  }

  private async runOptimizationAlgorithms(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    console.log(`Processing ${deliveries.length} deliveries for optimization`)

    // Try multiple algorithms and pick the best result
    const algorithms = [
      () => this.nearestNeighborOptimization(driverLocation, deliveries, currentTime),
      () => this.timeWindowOptimization(driverLocation, deliveries, currentTime),
    ]

    if (deliveries.length <= this.CLUSTER_SIZE_LIMIT) {
      algorithms.push(() => this.hybridOptimization(driverLocation, deliveries, currentTime))
    }

    const results = await Promise.allSettled(algorithms.map((algo) => algo()))

    const successfulResults = results
      .filter(
        (result): result is PromiseFulfilledResult<OptimizationResult> =>
          result.status === "fulfilled" && result.value.route.length > 0,
      )
      .map((result) => result.value)

    if (successfulResults.length === 0) {
      console.log("All optimization algorithms failed, using fallback")
      return this.simpleSequentialOptimization(driverLocation, deliveries, currentTime)
    }

    // Return the best result (lowest total distance)
    const bestResult = successfulResults.reduce((best, current) =>
      current.totalDistance < best.totalDistance ? current : best,
    )

    console.log(`Best algorithm: ${bestResult.algorithm} with distance ${bestResult.totalDistance.toFixed(2)}km`)
    return bestResult
  }

  // Nearest neighbor optimization - always starts with closest delivery to driver
  private async nearestNeighborOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    if (deliveries.length === 0) {
      console.log("No deliveries for nearest neighbor optimization")
      return this.createEmptyResult()
    }

    console.log(`Running nearest neighbor optimization for ${deliveries.length} deliveries`)

    const route: number[] = []
    const visited = new Set<number>()
    let currentLocation = driverLocation
    let totalDistance = 0
    let totalTime = 0
    const estimatedArrivalTimes: Date[] = []
    const trafficAdjustments: number[] = []
    let currentDateTime = new Date(currentTime)

    try {
      // Step 1: Find the closest delivery to driver's starting location
      let firstStopIndex = -1
      let shortestDistanceToDriver = Number.POSITIVE_INFINITY

      for (let i = 0; i < deliveries.length; i++) {
        const delivery = deliveries[i]

        if (!delivery.coordinates || delivery.coordinates.length !== 2) {
          continue
        }

        try {
          const distanceToDriver = distanceCalculator.calculateRealWorldDistance(driverLocation, delivery.coordinates)

          if (distanceToDriver < shortestDistanceToDriver) {
            shortestDistanceToDriver = distanceToDriver
            firstStopIndex = i
          }
        } catch (error) {
          console.warn(`Error calculating distance for delivery ${delivery.id}:`, error)
          continue
        }
      }

      if (firstStopIndex === -1) {
        throw new Error("Could not find any valid first stop")
      }

      // Add the first stop
      const firstDelivery = deliveries[firstStopIndex]
      route.push(firstStopIndex)
      visited.add(firstStopIndex)

      const firstTravelTime = await this.calculateDynamicTravelTime(
        currentLocation,
        firstDelivery.coordinates,
        currentDateTime,
      )

      totalDistance += shortestDistanceToDriver
      totalTime += firstTravelTime + firstDelivery.estimatedServiceTime

      currentDateTime = new Date(
        currentDateTime.getTime() + (firstTravelTime + firstDelivery.estimatedServiceTime) * 60000,
      )
      estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - firstDelivery.estimatedServiceTime * 60000))
      trafficAdjustments.push(1.0)

      currentLocation = firstDelivery.coordinates

      // Step 2: Continue with nearest neighbor
      while (route.length < deliveries.length) {
        let nearestIndex = -1
        let nearestDistance = Number.POSITIVE_INFINITY
        let nearestTime = 0

        for (let i = 0; i < deliveries.length; i++) {
          if (visited.has(i)) continue

          const delivery = deliveries[i]

          if (!delivery.coordinates || delivery.coordinates.length !== 2) {
            continue
          }

          try {
            const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
            const travelTime = await this.calculateDynamicTravelTime(
              currentLocation,
              delivery.coordinates,
              currentDateTime,
            )

            // Apply priority weighting
            const priorityWeight = this.getPriorityWeight(delivery.priority)
            const weightedScore = distance / Math.max(priorityWeight * 0.1, 0.1)

            if (distance < nearestDistance) {
              nearestDistance = distance
              nearestIndex = i
              nearestTime = travelTime
            }
          } catch (error) {
            console.warn(`Error calculating distance for delivery ${delivery.id}:`, error)
            continue
          }
        }

        if (nearestIndex === -1) {
          console.warn("No more valid deliveries found")
          break
        }

        const delivery = deliveries[nearestIndex]
        route.push(nearestIndex)
        visited.add(nearestIndex)

        totalDistance += nearestDistance
        totalTime += nearestTime + delivery.estimatedServiceTime

        currentDateTime = new Date(currentDateTime.getTime() + (nearestTime + delivery.estimatedServiceTime) * 60000)
        estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))

        const trafficKey = `${currentLocation[0]},${currentLocation[1]}-${delivery.coordinates[0]},${delivery.coordinates[1]}`
        const trafficCondition = this.trafficCache.get(trafficKey)
        trafficAdjustments.push(trafficCondition?.delayFactor || 1.0)

        currentLocation = delivery.coordinates
      }

      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "nearest_neighbor_from_driver",
        iterations: deliveries.length,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      console.error("Nearest neighbor optimization failed:", error)
      return this.createErrorResult([error instanceof Error ? error.message : "Nearest neighbor optimization failed"])
    }
  }

  // Simple sequential optimization as fallback
  private async simpleSequentialOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    console.log(`Running simple sequential optimization for ${deliveries.length} deliveries`)

    if (deliveries.length === 0) {
      return this.createEmptyResult()
    }

    const route: number[] = []
    let totalDistance = 0
    let totalTime = 0
    const estimatedArrivalTimes: Date[] = []
    const trafficAdjustments: number[] = []
    let currentLocation = driverLocation
    let currentDateTime = new Date(currentTime)

    try {
      for (let i = 0; i < deliveries.length; i++) {
        const delivery = deliveries[i]

        if (!delivery.coordinates || delivery.coordinates.length !== 2) {
          continue
        }

        route.push(i)

        const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
        const travelTime = await this.calculateDynamicTravelTime(currentLocation, delivery.coordinates, currentDateTime)

        totalDistance += distance
        totalTime += travelTime + delivery.estimatedServiceTime

        currentDateTime = new Date(currentDateTime.getTime() + (travelTime + delivery.estimatedServiceTime) * 60000)
        estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))
        trafficAdjustments.push(1.0)

        currentLocation = delivery.coordinates
      }

      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "simple_sequential",
        iterations: 1,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      console.error("Simple sequential optimization failed:", error)
      return this.createErrorResult([error instanceof Error ? error.message : "Sequential optimization failed"])
    }
  }

  // Time window optimization
  private async timeWindowOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    try {
      // Sort deliveries by urgency and time windows
      const sortedDeliveries = [...deliveries].sort((a, b) => {
        const aUrgency = this.calculateUrgencyScore(a, currentTime)
        const bUrgency = this.calculateUrgencyScore(b, currentTime)
        return bUrgency - aUrgency
      })

      const route: number[] = []
      let currentLocation = driverLocation
      let totalDistance = 0
      let totalTime = 0
      const estimatedArrivalTimes: Date[] = []
      const trafficAdjustments: number[] = []
      let currentDateTime = new Date(currentTime)

      for (const delivery of sortedDeliveries) {
        const originalIndex = deliveries.indexOf(delivery)
        const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
        const travelTime = await this.calculateDynamicTravelTime(currentLocation, delivery.coordinates, currentDateTime)

        route.push(originalIndex)
        totalDistance += distance
        totalTime += travelTime + delivery.estimatedServiceTime

        currentDateTime = new Date(currentDateTime.getTime() + (travelTime + delivery.estimatedServiceTime) * 60000)
        estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))

        const trafficKey = `${currentLocation[0]},${currentLocation[1]}-${delivery.coordinates[0]},${delivery.coordinates[1]}`
        const trafficCondition = this.trafficCache.get(trafficKey)
        trafficAdjustments.push(trafficCondition?.delayFactor || 1.0)

        currentLocation = delivery.coordinates
      }

      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "time_window",
        iterations: deliveries.length,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      console.error("Time window optimization failed:", error)
      return this.createErrorResult([error instanceof Error ? error.message : "Time window optimization failed"])
    }
  }

  // Hybrid optimization combining multiple factors
  private async hybridOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    try {
      const vehicleConstraints: VehicleConstraints = {
        maxCapacity: 100,
        currentLoad: 0,
        maxDeliveries: deliveries.length,
        workingHours: {
          start: new Date(currentTime.getTime() - 60 * 60 * 1000),
          end: new Date(currentTime.getTime() + 8 * 60 * 60 * 1000),
        },
      }

      const route: number[] = []
      const visited = new Set<number>()
      let currentLocation = driverLocation
      let totalDistance = 0
      let totalTime = 0
      let currentLoad = vehicleConstraints.currentLoad
      const estimatedArrivalTimes: Date[] = []
      const trafficAdjustments: number[] = []
      let currentDateTime = new Date(currentTime)

      while (route.length < deliveries.length) {
        let bestIndex = -1
        let bestScore = -1

        for (let i = 0; i < deliveries.length; i++) {
          if (visited.has(i)) continue

          const delivery = deliveries[i]

          // Check capacity constraint
          const packageWeight = delivery.packageWeight || 1
          if (currentLoad + packageWeight > vehicleConstraints.maxCapacity) continue

          const score = await this.calculateHybridScore(currentLocation, delivery, currentDateTime, vehicleConstraints)

          if (score > bestScore) {
            bestScore = score
            bestIndex = i
          }
        }

        if (bestIndex !== -1) {
          const delivery = deliveries[bestIndex]
          route.push(bestIndex)
          visited.add(bestIndex)

          const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
          const travelTime = await this.calculateDynamicTravelTime(
            currentLocation,
            delivery.coordinates,
            currentDateTime,
          )

          totalDistance += distance
          totalTime += travelTime + delivery.estimatedServiceTime
          currentLoad += delivery.packageWeight || 1

          currentDateTime = new Date(currentDateTime.getTime() + (travelTime + delivery.estimatedServiceTime) * 60000)
          estimatedArrivalTimes.push(new Date(currentDateTime.getTime() - delivery.estimatedServiceTime * 60000))

          const trafficKey = `${currentLocation[0]},${currentLocation[1]}-${delivery.coordinates[0]},${delivery.coordinates[1]}`
          const trafficCondition = this.trafficCache.get(trafficKey)
          trafficAdjustments.push(trafficCondition?.delayFactor || 1.0)

          currentLocation = delivery.coordinates
        } else {
          break // No more feasible deliveries
        }
      }

      return {
        route,
        totalDistance,
        totalTime,
        algorithm: "hybrid",
        iterations: deliveries.length,
        improvement: 0,
        estimatedArrivalTimes,
        trafficAdjustments,
        isValid: true,
        errors: [],
      }
    } catch (error) {
      console.error("Hybrid optimization failed:", error)
      return this.createErrorResult([error instanceof Error ? error.message : "Hybrid optimization failed"])
    }
  }

  // Dynamic cluster optimization
  private async dynamicClusterOptimization(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    // Create clusters based on proximity and time windows
    const clusters = this.createDynamicClusters(deliveries, driverLocation)

    const route: number[] = []
    let currentLocation = driverLocation
    let totalDistance = 0
    let totalTime = 0
    const estimatedArrivalTimes: Date[] = []
    const trafficAdjustments: number[] = []
    let currentDateTime = new Date(currentTime)

    // Process clusters in order of proximity to current location
    const sortedClusters = clusters.sort((a, b) => {
      const distA = distanceCalculator.calculateRealWorldDistance(currentLocation, a.centroid)
      const distB = distanceCalculator.calculateRealWorldDistance(currentLocation, b.centroid)
      return distA - distB
    })

    for (const cluster of sortedClusters) {
      // Optimize within cluster
      const clusterResult = await this.optimizeCluster(currentLocation, cluster.deliveries, currentDateTime)

      // Add cluster route to main route
      for (let i = 0; i < clusterResult.route.length; i++) {
        const deliveryIndex = deliveries.indexOf(cluster.deliveries[clusterResult.route[i]])
        route.push(deliveryIndex)

        if (i < clusterResult.estimatedArrivalTimes.length) {
          estimatedArrivalTimes.push(clusterResult.estimatedArrivalTimes[i])
          trafficAdjustments.push(clusterResult.trafficAdjustments[i])
        }
      }

      totalDistance += clusterResult.totalDistance
      totalTime += clusterResult.totalTime
      currentDateTime = new Date(currentDateTime.getTime() + clusterResult.totalTime * 60000)

      if (cluster.deliveries.length > 0) {
        const lastDelivery = cluster.deliveries[clusterResult.route[clusterResult.route.length - 1]]
        currentLocation = lastDelivery.coordinates
      }
    }

    return {
      route,
      totalDistance,
      totalTime,
      algorithm: "dynamic_cluster",
      iterations: clusters.length,
      improvement: 0,
      estimatedArrivalTimes,
      trafficAdjustments,
      isValid: true,
      errors: [],
    }
  }

  // Calculate dynamic travel time considering traffic
  private async calculateDynamicTravelTime(
    from: [number, number],
    to: [number, number],
    departureTime: Date,
  ): Promise<number> {
    try {
      const baseTime = distanceCalculator.calculateTravelTime(distanceCalculator.calculateRealWorldDistance(from, to))

      // Get traffic condition
      const trafficKey = `${from[0]},${from[1]}-${to[0]},${to[1]}`
      const trafficCondition = this.trafficCache.get(trafficKey)

      if (trafficCondition) {
        return baseTime * trafficCondition.delayFactor
      }

      // Apply time-of-day adjustments
      const hour = departureTime.getHours()
      let timeMultiplier = 1.0

      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        timeMultiplier = 1.3 // Rush hour
      } else if (hour >= 22 || hour <= 6) {
        timeMultiplier = 0.8 // Night time
      }

      return Math.max(baseTime * timeMultiplier, 1) // Minimum 1 minute
    } catch (error) {
      console.warn("Error calculating travel time, using default:", error)
      return 15 // Default 15 minutes
    }
  }

  // Update traffic conditions (simulated)
  private async updateTrafficConditions(driverLocation: [number, number], deliveries: DeliveryStop[]): Promise<void> {
    const now = Date.now()
    if (now - this.lastTrafficUpdate < this.TRAFFIC_UPDATE_INTERVAL) {
      return // Use cached data
    }

    try {
      const allLocations = [driverLocation, ...deliveries.map((d) => d.coordinates)]

      for (let i = 0; i < allLocations.length; i++) {
        for (let j = i + 1; j < allLocations.length; j++) {
          const from = allLocations[i]
          const to = allLocations[j]
          const key = `${from[0]},${from[1]}-${to[0]},${to[1]}`

          // Simulate traffic condition
          const distance = distanceCalculator.calculateRealWorldDistance(from, to)
          let delayFactor = 1.0
          let congestionLevel: "light" | "moderate" | "heavy" = "light"

          if (distance > 10) {
            delayFactor = 1.2 + Math.random() * 0.3
            congestionLevel = "moderate"
          } else if (distance > 5) {
            delayFactor = 1.1 + Math.random() * 0.4
            congestionLevel = Math.random() > 0.7 ? "heavy" : "moderate"
          } else {
            delayFactor = 1.0 + Math.random() * 0.2
          }

          this.trafficCache.set(key, {
            segmentIndex: i,
            delayFactor,
            congestionLevel,
          })
        }
      }

      this.lastTrafficUpdate = now
    } catch (error) {
      console.warn("Error updating traffic conditions:", error)
      throw error
    }
  }

  // Filter deliveries based on vehicle constraints
  private filterFeasibleDeliveries(
    deliveries: DeliveryStop[],
    constraints: VehicleConstraints,
    currentTime: Date,
  ): DeliveryStop[] {
    return deliveries.filter((delivery) => {
      try {
        // Capacity check
        const packageWeight = delivery.packageWeight || 1
        if (constraints.currentLoad + packageWeight > constraints.maxCapacity * 1.2) {
          return false
        }

        // Working hours check
        const workingHoursBuffer = 2 * 60 * 60 * 1000 // 2 hour buffer
        if (
          currentTime < new Date(constraints.workingHours.start.getTime() - workingHoursBuffer) ||
          currentTime > new Date(constraints.workingHours.end.getTime() + workingHoursBuffer)
        ) {
          return false
        }

        // Time window check
        if (delivery.timeWindow) {
          const estimatedArrival = new Date(currentTime.getTime() + 60 * 60000) // 1 hour estimate
          if (estimatedArrival > new Date(delivery.timeWindow.end.getTime() + 2 * 60 * 60000)) {
            return false
          }
        }

        return true
      } catch (error) {
        console.warn(`Error filtering delivery ${delivery.id}:`, error)
        return true // Include delivery if filtering fails
      }
    })
  }

  // Calculate urgency score for time window optimization
  private calculateUrgencyScore(delivery: DeliveryStop, currentTime: Date): number {
    let score = 0

    // Priority score
    switch (delivery.priority) {
      case "urgent":
        score += 100
        break
      case "high":
        score += 75
        break
      case "normal":
        score += 50
        break
      case "low":
        score += 25
        break
    }

    // Time window urgency
    if (delivery.timeWindow) {
      const timeToDeadline = delivery.timeWindow.end.getTime() - currentTime.getTime()
      const hoursToDeadline = timeToDeadline / (1000 * 60 * 60)

      if (hoursToDeadline < 1) {
        score += 50
      } else if (hoursToDeadline < 2) {
        score += 30
      } else if (hoursToDeadline < 4) {
        score += 15
      }
    }

    return score
  }

  // Calculate hybrid score combining multiple factors
  private async calculateHybridScore(
    currentLocation: [number, number],
    delivery: DeliveryStop,
    currentTime: Date,
    constraints: VehicleConstraints,
  ): Promise<number> {
    try {
      const distance = distanceCalculator.calculateRealWorldDistance(currentLocation, delivery.coordinates)
      const travelTime = await this.calculateDynamicTravelTime(currentLocation, delivery.coordinates, currentTime)

      let score = 100

      // Distance penalty (closer is better)
      score -= distance * 2

      // Time penalty (faster is better)
      score -= travelTime * 0.5

      // Priority bonus
      score += this.getPriorityWeight(delivery.priority) * 10

      // Time window bonus/penalty
      if (delivery.timeWindow) {
        const estimatedArrival = new Date(currentTime.getTime() + travelTime * 60000)
        if (estimatedArrival <= delivery.timeWindow.end) {
          score += 20
        } else {
          score -= 50
        }
      }

      // Capacity efficiency
      const packageWeight = delivery.packageWeight || 1
      const remainingCapacity = constraints.maxCapacity - constraints.currentLoad
      if (packageWeight <= remainingCapacity * 0.5) {
        score += 10
      }

      return Math.max(score, 0)
    } catch (error) {
      console.warn("Error calculating hybrid score:", error)
      return 50
    }
  }

  // Get priority weight for calculations
  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case "urgent":
        return 4.0
      case "high":
        return 2.0
      case "normal":
        return 1.0
      case "low":
        return 0.5
      default:
        return 1.0
    }
  }

  // Create dynamic clusters
  private createDynamicClusters(deliveries: DeliveryStop[], driverLocation: [number, number]) {
    const clusters: { centroid: [number, number]; deliveries: DeliveryStop[] }[] = []
    const assigned = new Set<number>()

    for (let i = 0; i < deliveries.length; i++) {
      if (assigned.has(i)) continue

      const cluster = {
        centroid: deliveries[i].coordinates,
        deliveries: [deliveries[i]],
      }

      assigned.add(i)

      // Find nearby deliveries
      for (let j = 0; j < deliveries.length; j++) {
        if (assigned.has(j) || cluster.deliveries.length >= this.CLUSTER_SIZE_LIMIT) continue

        const distance = distanceCalculator.calculateRealWorldDistance(
          deliveries[i].coordinates,
          deliveries[j].coordinates,
        )

        if (distance < 3) {
          // Within 3km
          cluster.deliveries.push(deliveries[j])
          assigned.add(j)
        }
      }

      // Recalculate centroid
      if (cluster.deliveries.length > 1) {
        const avgLat = cluster.deliveries.reduce((sum, d) => sum + d.coordinates[0], 0) / cluster.deliveries.length
        const avgLon = cluster.deliveries.reduce((sum, d) => sum + d.coordinates[1], 0) / cluster.deliveries.length
        cluster.centroid = [avgLat, avgLon]
      }

      clusters.push(cluster)
    }

    return clusters
  }

  // Optimize within a cluster
  private async optimizeCluster(
    entryPoint: [number, number],
    deliveries: DeliveryStop[],
    startTime: Date,
  ): Promise<OptimizationResult> {
    if (deliveries.length <= 1) {
      return {
        route: deliveries.length === 1 ? [0] : [],
        totalDistance: 0,
        totalTime: 0,
        algorithm: "single_delivery",
        iterations: 0,
        improvement: 0,
        estimatedArrivalTimes: deliveries.length === 1 ? [startTime] : [],
        trafficAdjustments: deliveries.length === 1 ? [1.0] : [],
        isValid: true,
        errors: [],
      }
    }

    // Use proximity-based optimization within cluster
    return this.nearestNeighborOptimization(entryPoint, deliveries, startTime)
  }

  // Apply local optimization improvements
  private async applyLocalOptimization(
    result: OptimizationResult,
    coordinates: [number, number][],
    currentTime: Date,
  ): Promise<OptimizationResult> {
    try {
      // Apply 2-opt improvements
      let improved = true
      let iterations = 0
      let currentRoute = [...result.route]

      while (improved && iterations < 50) {
        improved = false
        iterations++

        for (let i = 1; i < currentRoute.length - 1; i++) {
          for (let j = i + 1; j < currentRoute.length; j++) {
            const newRoute = this.twoOptSwap(currentRoute, i, j)
            const newDistance = this.calculateRouteDistance(newRoute, coordinates)

            if (newDistance < result.totalDistance) {
              currentRoute = newRoute
              result.totalDistance = newDistance
              improved = true
            }
          }
        }
      }

      result.route = currentRoute
      result.improvement = iterations
      return result
    } catch (error) {
      console.warn("Error in local optimization:", error)
      return result
    }
  }

  // Helper methods for creating results
  private createEmptyResult(): OptimizationResult {
    return {
      route: [],
      totalDistance: 0,
      totalTime: 0,
      algorithm: "empty",
      iterations: 0,
      improvement: 0,
      estimatedArrivalTimes: [],
      trafficAdjustments: [],
      isValid: true,
      errors: [],
    }
  }

  private createErrorResult(errors: string[]): OptimizationResult {
    return {
      route: [],
      totalDistance: 0,
      totalTime: 0,
      algorithm: "error",
      iterations: 0,
      improvement: 0,
      estimatedArrivalTimes: [],
      trafficAdjustments: [],
      isValid: false,
      errors,
    }
  }

  private createFallbackResult(
    driverLocation: [number, number],
    deliveries: DeliveryStop[],
    currentTime: Date,
    errors: string[],
  ): OptimizationResult {
    // Create a simple sequential route as fallback
    const route = deliveries.map((_, index) => index)

    return {
      route,
      totalDistance: 0,
      totalTime: deliveries.length * 30, // Estimate 30 minutes per delivery
      algorithm: "fallback_sequential",
      iterations: 1,
      improvement: 0,
      estimatedArrivalTimes: deliveries.map((_, index) => new Date(currentTime.getTime() + (index + 1) * 30 * 60000)),
      trafficAdjustments: deliveries.map(() => 1.0),
      isValid: false,
      errors: [...errors, "Using fallback optimization due to errors"],
    }
  }

  // Add analyzeRoute method that was referenced but missing
  analyzeRoute(route: number[], coordinates: [number, number][]) {
    if (route.length === 0 || coordinates.length === 0) {
      return {
        averageSegmentDistance: 0,
        longestSegment: 0,
        shortestSegment: 0,
        clusteringScore: 0,
      }
    }

    const distances: number[] = []

    for (let i = 0; i < route.length - 1; i++) {
      const from = coordinates[route[i]]
      const to = coordinates[route[i + 1]]
      if (from && to) {
        try {
          distances.push(distanceCalculator.calculateRealWorldDistance(from, to))
        } catch (error) {
          console.warn("Error calculating segment distance:", error)
        }
      }
    }

    if (distances.length === 0) {
      return {
        averageSegmentDistance: 0,
        longestSegment: 0,
        shortestSegment: 0,
        clusteringScore: 0,
      }
    }

    return {
      averageSegmentDistance: distances.reduce((sum, d) => sum + d, 0) / distances.length,
      longestSegment: Math.max(...distances),
      shortestSegment: Math.min(...distances),
      clusteringScore: this.calculateClusteringScore(distances),
    }
  }

  private calculateClusteringScore(distances: number[]): number {
    if (distances.length === 0) return 0

    const avg = distances.reduce((sum, d) => sum + d, 0) / distances.length
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / distances.length

    // Lower variance = better clustering
    return Math.max(0, 100 - Math.sqrt(variance))
  }

  private compareResults(a: OptimizationResult, b: OptimizationResult): number {
    // Weighted comparison: distance (60%), time (30%), improvement (10%)
    const scoreA = a.totalDistance * 0.6 + a.totalTime * 0.3 - a.improvement * 0.1
    const scoreB = b.totalDistance * 0.6 + b.totalTime * 0.3 - b.improvement * 0.1
    return scoreB - scoreA // Lower is better
  }

  private twoOptSwap(route: number[], i: number, j: number): number[] {
    const newRoute = [...route]
    const segment = newRoute.slice(i, j + 1).reverse()
    newRoute.splice(i, j - i + 1, ...segment)
    return newRoute
  }

  private calculateRouteDistance(route: number[], coordinates: [number, number][]): number {
    let totalDistance = 0
    for (let i = 0; i < route.length - 1; i++) {
      if (coordinates[route[i]] && coordinates[route[i + 1]]) {
        totalDistance += distanceCalculator.calculateRealWorldDistance(coordinates[route[i]], coordinates[route[i + 1]])
      }
    }
    return totalDistance
  }
}

export const routeOptimizer = new RouteOptimizer()
