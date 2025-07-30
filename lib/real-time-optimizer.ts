// Real-time route optimization service for dynamic updates
import { routeOptimizer } from "./route-optimizer"
import { distanceCalculator } from "./distance-calculator"

interface RealTimeUpdate {
  driverId: string
  currentLocation: [number, number]
  timestamp: Date
  remainingDeliveries: any[]
  completedDeliveries: any[]
  vehicleStatus: {
    currentLoad: number
    fuelLevel?: number
    maintenanceAlerts?: string[]
  }
}

interface OptimizationTrigger {
  type: "location_update" | "new_delivery" | "delivery_completed" | "traffic_update" | "time_window_alert"
  priority: "low" | "medium" | "high" | "critical"
  data: any
}

class RealTimeOptimizer {
  private readonly UPDATE_THRESHOLD_DISTANCE = 0.5 // km
  private readonly UPDATE_THRESHOLD_TIME = 5 * 60 * 1000 // 5 minutes
  private readonly REOPTIMIZATION_COOLDOWN = 2 * 60 * 1000 // 2 minutes

  private lastOptimization = new Map<string, number>()
  private activeRoutes = new Map<string, any>()
  private pendingUpdates = new Map<string, OptimizationTrigger[]>()

  // Main real-time optimization entry point
  async processRealTimeUpdate(update: RealTimeUpdate): Promise<{
    shouldReoptimize: boolean
    newRoute?: any[]
    alerts?: string[]
    estimatedImpact?: {
      timeSaved: number
      distanceSaved: number
      deliveriesAffected: number
    }
  }> {
    console.log(`Processing real-time update for driver ${update.driverId}`)

    const triggers = this.analyzeUpdateTriggers(update)
    const shouldReoptimize = this.shouldTriggerReoptimization(update.driverId, triggers)

    if (!shouldReoptimize) {
      return {
        shouldReoptimize: false,
        alerts: this.generateAlerts(triggers),
      }
    }

    // Perform real-time optimization
    const currentRoute = this.activeRoutes.get(update.driverId)
    const newRoute = await this.optimizeFromCurrentLocation(update)

    // Calculate impact
    const impact = this.calculateOptimizationImpact(currentRoute, newRoute)

    // Update tracking
    this.lastOptimization.set(update.driverId, Date.now())
    this.activeRoutes.set(update.driverId, newRoute)

    return {
      shouldReoptimize: true,
      newRoute: newRoute?.stops || [],
      alerts: this.generateAlerts(triggers),
      estimatedImpact: impact,
    }
  }

  // Optimize route from driver's current location
  private async optimizeFromCurrentLocation(update: RealTimeUpdate): Promise<any> {
    if (update.remainingDeliveries.length === 0) {
      return { stops: [], totalDistance: 0, totalTime: 0 }
    }

    // Convert remaining deliveries to optimization format
    const deliveryStops = update.remainingDeliveries.map((order) => ({
      id: order.id,
      coordinates: [order.latitude || 0, order.longitude || 0] as [number, number],
      timeWindow: order.delivery_window_start
        ? {
            start: new Date(order.delivery_window_start),
            end: new Date(order.delivery_window_end),
            priority: order.priority || "normal",
          }
        : undefined,
      estimatedServiceTime: this.calculateServiceTime(order),
      packageWeight: order.package_weight || 1,
      priority: order.priority || "normal",
      specialRequirements: order.special_requirements?.split(",") || [],
      order,
    }))

    // Define current vehicle constraints
    const vehicleConstraints = {
      maxCapacity: 50,
      currentLoad: update.vehicleStatus.currentLoad,
      maxDeliveries: 20,
      workingHours: {
        start: new Date(),
        end: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours remaining
      },
    }

    // Run optimization
    const result = await routeOptimizer.optimizeDeliveryRoute(
      update.currentLocation,
      deliveryStops,
      vehicleConstraints,
      update.timestamp,
    )

    return {
      stops: result.route.map((index, i) => ({
        order: deliveryStops[index].order,
        estimatedTime: deliveryStops[index].estimatedServiceTime,
        distance:
          i === 0
            ? 0
            : distanceCalculator.calculateRealWorldDistance(
                i === 0 ? update.currentLocation : deliveryStops[result.route[i - 1]].coordinates,
                deliveryStops[index].coordinates,
              ),
        sequence: i + 1,
        coordinates: deliveryStops[index].coordinates,
        estimatedArrival: result.estimatedArrivalTimes[i],
        trafficAdjustment: result.trafficAdjustments[i],
      })),
      totalDistance: result.totalDistance,
      totalTime: result.totalTime,
      algorithm: result.algorithm,
    }
  }

  // Analyze what triggered the update
  private analyzeUpdateTriggers(update: RealTimeUpdate): OptimizationTrigger[] {
    const triggers: OptimizationTrigger[] = []

    // Check for significant location change
    const lastLocation = this.getLastKnownLocation(update.driverId)
    if (lastLocation) {
      const distance = distanceCalculator.calculateRealWorldDistance(lastLocation, update.currentLocation)

      if (distance > this.UPDATE_THRESHOLD_DISTANCE) {
        triggers.push({
          type: "location_update",
          priority: "medium",
          data: { distance, previousLocation: lastLocation },
        })
      }
    }

    // Check for time window alerts
    const timeWindowAlerts = this.checkTimeWindowAlerts(update.remainingDeliveries)
    triggers.push(...timeWindowAlerts)

    // Check for vehicle status issues
    if (update.vehicleStatus.fuelLevel && update.vehicleStatus.fuelLevel < 0.2) {
      triggers.push({
        type: "traffic_update", // Using as general alert
        priority: "high",
        data: { alert: "Low fuel level", fuelLevel: update.vehicleStatus.fuelLevel },
      })
    }

    return triggers
  }

  // Determine if reoptimization should be triggered
  private shouldTriggerReoptimization(driverId: string, triggers: OptimizationTrigger[]): boolean {
    // Check cooldown period
    const lastOpt = this.lastOptimization.get(driverId) || 0
    if (Date.now() - lastOpt < this.REOPTIMIZATION_COOLDOWN) {
      return false
    }

    // Check trigger priorities
    const hasCritical = triggers.some((t) => t.priority === "critical")
    const hasHigh = triggers.some((t) => t.priority === "high")
    const hasMedium = triggers.some((t) => t.priority === "medium")

    return hasCritical || hasHigh || (hasMedium && triggers.length > 1)
  }

  // Check for time window alerts
  private checkTimeWindowAlerts(deliveries: any[]): OptimizationTrigger[] {
    const alerts: OptimizationTrigger[] = []
    const now = new Date()

    for (const delivery of deliveries) {
      if (delivery.delivery_window_end) {
        const deadline = new Date(delivery.delivery_window_end)
        const timeToDeadline = deadline.getTime() - now.getTime()
        const hoursToDeadline = timeToDeadline / (1000 * 60 * 60)

        if (hoursToDeadline < 0.5) {
          alerts.push({
            type: "time_window_alert",
            priority: "critical",
            data: {
              orderId: delivery.id,
              deadline,
              hoursRemaining: hoursToDeadline,
            },
          })
        } else if (hoursToDeadline < 1) {
          alerts.push({
            type: "time_window_alert",
            priority: "high",
            data: {
              orderId: delivery.id,
              deadline,
              hoursRemaining: hoursToDeadline,
            },
          })
        }
      }
    }

    return alerts
  }

  // Calculate optimization impact
  private calculateOptimizationImpact(
    oldRoute: any,
    newRoute: any,
  ): {
    timeSaved: number
    distanceSaved: number
    deliveriesAffected: number
  } {
    if (!oldRoute || !newRoute) {
      return { timeSaved: 0, distanceSaved: 0, deliveriesAffected: 0 }
    }

    const timeSaved = (oldRoute.totalTime || 0) - (newRoute.totalTime || 0)
    const distanceSaved = (oldRoute.totalDistance || 0) - (newRoute.totalDistance || 0)
    const deliveriesAffected = newRoute.stops?.length || 0

    return { timeSaved, distanceSaved, deliveriesAffected }
  }

  // Generate alerts for drivers
  private generateAlerts(triggers: OptimizationTrigger[]): string[] {
    const alerts: string[] = []

    for (const trigger of triggers) {
      switch (trigger.type) {
        case "time_window_alert":
          if (trigger.priority === "critical") {
            alerts.push(
              `URGENT: Delivery ${trigger.data.orderId} deadline in ${trigger.data.hoursRemaining.toFixed(1)} hours`,
            )
          } else if (trigger.priority === "high") {
            alerts.push(`WARNING: Delivery ${trigger.data.orderId} deadline approaching`)
          }
          break
        case "traffic_update":
          if (trigger.data.alert) {
            alerts.push(trigger.data.alert)
          }
          break
        case "location_update":
          if (trigger.data.distance > 2) {
            alerts.push(
              `Route updated based on your new location (${trigger.data.distance.toFixed(1)}km from last position)`,
            )
          }
          break
      }
    }

    return alerts
  }

  // Helper methods
  private getLastKnownLocation(driverId: string): [number, number] | null {
    // In real implementation, this would fetch from database
    return null
  }

  private calculateServiceTime(order: any): number {
    let baseTime = 10 // Base service time in minutes

    if (order.special_requirements) {
      baseTime += order.special_requirements.split(",").length * 2
    }

    if (order.priority === "urgent") {
      baseTime += 5 // Extra care time
    }

    return baseTime
  }

  // Public methods for external integration
  async addNewDelivery(driverId: string, newDelivery: any): Promise<void> {
    const triggers = this.pendingUpdates.get(driverId) || []
    triggers.push({
      type: "new_delivery",
      priority: "high",
      data: newDelivery,
    })
    this.pendingUpdates.set(driverId, triggers)
  }

  async markDeliveryCompleted(driverId: string, deliveryId: string): Promise<void> {
    const triggers = this.pendingUpdates.get(driverId) || []
    triggers.push({
      type: "delivery_completed",
      priority: "medium",
      data: { deliveryId },
    })
    this.pendingUpdates.set(driverId, triggers)
  }

  getOptimizationStats(driverId: string): {
    lastOptimization: Date | null
    totalOptimizations: number
    averageImprovement: number
  } {
    const lastOpt = this.lastOptimization.get(driverId)
    return {
      lastOptimization: lastOpt ? new Date(lastOpt) : null,
      totalOptimizations: 0, // Would track in real implementation
      averageImprovement: 0, // Would calculate from historical data
    }
  }
}

export const realTimeOptimizer = new RealTimeOptimizer()
