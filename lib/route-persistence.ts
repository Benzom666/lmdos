// Route persistence service for maintaining optimized routes across sessions
interface PersistedRouteData {
  id: string
  driverId: string
  shiftDate: string
  isOptimized: boolean
  optimizedOrders: any[]
  persistentRoute: any
  lastOptimizedAt: string
  version: number
}

class RoutePersistenceService {
  private readonly STORAGE_KEY = "delivery-route-state-v2"
  private readonly VERSION = 2

  // Save route state to localStorage
  saveRouteState(
    driverId: string,
    routeData: {
      isOptimized: boolean
      optimizedOrders: any[]
      persistentRoute: any
      lastOptimizedAt: string
    },
  ): void {
    try {
      const shiftDate = new Date().toISOString().split("T")[0]
      const persistedData: PersistedRouteData = {
        id: `${driverId}-${shiftDate}`,
        driverId,
        shiftDate,
        isOptimized: routeData.isOptimized,
        optimizedOrders: routeData.optimizedOrders,
        persistentRoute: routeData.persistentRoute,
        lastOptimizedAt: routeData.lastOptimizedAt,
        version: this.VERSION,
      }

      const storageKey = `${this.STORAGE_KEY}-${driverId}`
      localStorage.setItem(storageKey, JSON.stringify(persistedData))

      console.log(`Route state saved for driver ${driverId}:`, {
        isOptimized: routeData.isOptimized,
        orderCount: routeData.optimizedOrders.length,
        lastOptimized: routeData.lastOptimizedAt,
      })
    } catch (error) {
      console.error("Failed to save route state:", error)
    }
  }

  // Load route state from localStorage
  loadRouteState(driverId: string): PersistedRouteData | null {
    try {
      const storageKey = `${this.STORAGE_KEY}-${driverId}`
      const stored = localStorage.getItem(storageKey)

      if (!stored) {
        console.log(`No persisted route state found for driver ${driverId}`)
        return null
      }

      const data: PersistedRouteData = JSON.parse(stored)

      // Check if data is for today and valid version
      const today = new Date().toISOString().split("T")[0]
      if (data.shiftDate !== today || data.version !== this.VERSION) {
        console.log(`Persisted route state expired or outdated for driver ${driverId}`)
        this.clearRouteState(driverId)
        return null
      }

      console.log(`Route state loaded for driver ${driverId}:`, {
        isOptimized: data.isOptimized,
        orderCount: data.optimizedOrders.length,
        lastOptimized: data.lastOptimizedAt,
      })

      return data
    } catch (error) {
      console.error("Failed to load route state:", error)
      return null
    }
  }

  // Clear route state
  clearRouteState(driverId: string): void {
    try {
      const storageKey = `${this.STORAGE_KEY}-${driverId}`
      localStorage.removeItem(storageKey)
      console.log(`Route state cleared for driver ${driverId}`)
    } catch (error) {
      console.error("Failed to clear route state:", error)
    }
  }

  // Check if route state exists and is valid
  hasValidRouteState(driverId: string): boolean {
    const data = this.loadRouteState(driverId)
    return data !== null && data.isOptimized && data.optimizedOrders.length > 0
  }

  // Update specific fields in route state
  updateRouteState(
    driverId: string,
    updates: Partial<{
      isOptimized: boolean
      optimizedOrders: any[]
      persistentRoute: any
      lastOptimizedAt: string
    }>,
  ): void {
    const existing = this.loadRouteState(driverId)
    if (existing) {
      const updated = {
        isOptimized: updates.isOptimized ?? existing.isOptimized,
        optimizedOrders: updates.optimizedOrders ?? existing.optimizedOrders,
        persistentRoute: updates.persistentRoute ?? existing.persistentRoute,
        lastOptimizedAt: updates.lastOptimizedAt ?? existing.lastOptimizedAt,
      }
      this.saveRouteState(driverId, updated)
    }
  }

  // Get all persisted route states (for debugging)
  getAllRouteStates(): { [driverId: string]: PersistedRouteData } {
    const states: { [driverId: string]: PersistedRouteData } = {}

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.STORAGE_KEY)) {
          const value = localStorage.getItem(key)
          if (value) {
            const data = JSON.parse(value)
            states[data.driverId] = data
          }
        }
      }
    } catch (error) {
      console.error("Failed to get all route states:", error)
    }

    return states
  }

  // Clean up old route states
  cleanupOldStates(): void {
    try {
      const today = new Date().toISOString().split("T")[0]
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.STORAGE_KEY)) {
          const value = localStorage.getItem(key)
          if (value) {
            const data = JSON.parse(value)
            if (data.shiftDate !== today) {
              keysToRemove.push(key)
            }
          }
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key))

      if (keysToRemove.length > 0) {
        console.log(`Cleaned up ${keysToRemove.length} old route states`)
      }
    } catch (error) {
      console.error("Failed to cleanup old states:", error)
    }
  }
}

export const routePersistenceService = new RoutePersistenceService()
