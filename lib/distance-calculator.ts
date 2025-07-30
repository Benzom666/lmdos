// Enhanced distance calculation service with multiple algorithms and real-world considerations
interface DistanceMatrix {
  [fromIndex: number]: {
    [toIndex: number]: {
      distance: number
      duration: number
      accuracy: "high" | "medium" | "low"
      calculatedAt: number
    }
  }
}

interface RouteSegment {
  from: [number, number]
  to: [number, number]
  distance: number
  duration: number
  roadType?: "highway" | "arterial" | "local" | "residential"
}

class DistanceCalculator {
  private distanceCache: DistanceMatrix = {}
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private readonly EARTH_RADIUS_KM = 6371
  private readonly SPEED_ESTIMATES = {
    highway: 80, // km/h
    arterial: 50, // km/h
    local: 40, // km/h
    residential: 30, // km/h
    default: 35, // km/h average urban speed
  }

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    try {
      const cached = localStorage.getItem("distance-matrix-cache")
      if (cached) {
        this.distanceCache = JSON.parse(cached)
        this.cleanExpiredCache()
      }
    } catch (error) {
      console.warn("Failed to load distance cache:", error)
      this.distanceCache = {}
    }
  }

  private saveCache(): void {
    try {
      localStorage.setItem("distance-matrix-cache", JSON.stringify(this.distanceCache))
    } catch (error) {
      console.warn("Failed to save distance cache:", error)
    }
  }

  private cleanExpiredCache(): void {
    const now = Date.now()
    let hasExpired = false

    for (const fromIndex in this.distanceCache) {
      for (const toIndex in this.distanceCache[fromIndex]) {
        const entry = this.distanceCache[fromIndex][toIndex]
        if (entry.calculatedAt + this.CACHE_DURATION < now) {
          delete this.distanceCache[fromIndex][toIndex]
          hasExpired = true
        }
      }
      if (Object.keys(this.distanceCache[fromIndex]).length === 0) {
        delete this.distanceCache[fromIndex]
      }
    }

    if (hasExpired) {
      this.saveCache()
    }
  }

  // Haversine formula for great-circle distance
  private calculateHaversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lon1] = coord1
    const [lat2, lon2] = coord2

    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return this.EARTH_RADIUS_KM * c
  }

  // Manhattan distance for urban grid-like road networks
  private calculateManhattanDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lon1] = coord1
    const [lat2, lon2] = coord2

    // Convert to approximate distance in km
    const latDistance = Math.abs(lat2 - lat1) * 111 // 1 degree lat ≈ 111 km
    const lonDistance = Math.abs(lon2 - lon1) * 111 * Math.cos(this.toRadians((lat1 + lat2) / 2))

    return latDistance + lonDistance
  }

  // Enhanced distance calculation considering road network patterns
  calculateRealWorldDistance(coord1: [number, number], coord2: [number, number]): number {
    const haversineDistance = this.calculateHaversineDistance(coord1, coord2)
    const manhattanDistance = this.calculateManhattanDistance(coord1, coord2)

    // Use a weighted combination based on distance
    // For short distances, Manhattan is more accurate (urban grid)
    // For longer distances, Haversine with road factor is better
    if (haversineDistance < 2) {
      // Short distance: favor Manhattan with slight road factor
      return manhattanDistance * 1.1
    } else if (haversineDistance < 10) {
      // Medium distance: blend both with road factor
      const weight = haversineDistance / 10
      return (manhattanDistance * (1 - weight) + haversineDistance * weight) * 1.25
    } else {
      // Long distance: favor Haversine with highway factor
      return haversineDistance * 1.3
    }
  }

  // Calculate estimated travel time based on distance and road conditions
  calculateTravelTime(distance: number, roadType: keyof typeof this.SPEED_ESTIMATES = "default"): number {
    const speed = this.SPEED_ESTIMATES[roadType]
    const timeHours = distance / speed
    const timeMinutes = timeHours * 60

    // Add buffer time for stops, traffic, etc.
    const bufferTime = Math.min(distance * 2, 10) // 2 min per km, max 10 min
    return timeMinutes + bufferTime
  }

  // Get or calculate distance between two points with caching
  getDistance(
    fromCoord: [number, number],
    toCoord: [number, number],
    fromIndex: number,
    toIndex: number,
  ): { distance: number; duration: number; accuracy: "high" | "medium" | "low" } {
    // Check cache first
    const cached = this.distanceCache[fromIndex]?.[toIndex]
    if (cached && cached.calculatedAt + this.CACHE_DURATION > Date.now()) {
      return {
        distance: cached.distance,
        duration: cached.duration,
        accuracy: cached.accuracy,
      }
    }

    // Calculate new distance
    const distance = this.calculateRealWorldDistance(fromCoord, toCoord)
    const duration = this.calculateTravelTime(distance)

    // Cache the result
    if (!this.distanceCache[fromIndex]) {
      this.distanceCache[fromIndex] = {}
    }

    this.distanceCache[fromIndex][toIndex] = {
      distance,
      duration,
      accuracy: "medium", // Real-world estimation
      calculatedAt: Date.now(),
    }

    this.saveCache()

    return { distance, duration, accuracy: "medium" }
  }

  // Build complete distance matrix for all locations
  buildDistanceMatrix(coordinates: [number, number][]): number[][] {
    const matrix: number[][] = []

    for (let i = 0; i < coordinates.length; i++) {
      matrix[i] = []
      for (let j = 0; j < coordinates.length; j++) {
        if (i === j) {
          matrix[i][j] = 0
        } else {
          const result = this.getDistance(coordinates[i], coordinates[j], i, j)
          matrix[i][j] = result.distance
        }
      }
    }

    return matrix
  }

  // Calculate total route distance
  calculateRouteDistance(route: number[], distanceMatrix: number[][]): number {
    let totalDistance = 0
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += distanceMatrix[route[i]][route[i + 1]]
    }
    return totalDistance
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  // Clear cache for testing or maintenance
  clearCache(): void {
    this.distanceCache = {}
    localStorage.removeItem("distance-matrix-cache")
  }

  // Get cache statistics
  getCacheStats(): { entries: number; size: string; hitRate: number } {
    let entries = 0
    for (const fromIndex in this.distanceCache) {
      entries += Object.keys(this.distanceCache[fromIndex]).length
    }

    const size = new Blob([JSON.stringify(this.distanceCache)]).size
    return {
      entries,
      size: `${(size / 1024).toFixed(1)} KB`,
      hitRate: 0, // Would need to track hits vs misses
    }
  }
}

export const distanceCalculator = new DistanceCalculator()
