// Enhanced geocoding service with comprehensive error handling and optimization
interface GeocodingCache {
  [address: string]: {
    coordinates: [number, number]
    timestamp: number
    expires: number
    accuracy: "high" | "medium" | "low"
    city: string
    country: string
  }
}

interface GeocodingResult {
  address: string
  coordinates: [number, number] | null
  fromCache: boolean
  accuracy: "high" | "medium" | "low"
  city?: string
  country?: string
}

class GeocodingService {
  private cache: GeocodingCache = {}
  private pendingRequests: Map<string, Promise<[number, number] | null>> = new Map()
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days for better persistence
  private readonly BATCH_SIZE = 3
  private readonly REQUEST_DELAY = 500 // Increased delay for better reliability
  private readonly MAX_RETRIES = 3
  private requestCount = 0
  private lastRequestTime = 0

  // Default fallback coordinates (can be configured per deployment)
  private readonly DEFAULT_FALLBACK_COORDS = [
    [43.6532, -79.3832], // Downtown
    [43.6426, -79.3871], // Business District
    [43.6629, -79.3957], // Market Area
    [43.6481, -79.4042], // Industrial Area
    [43.6596, -79.3977], // West End
    [43.6677, -79.3948], // North District
    [43.6532, -79.3698], // East District
    [43.6319, -79.3716], // Southeast
    [43.689, -79.3848], // North Central
    [43.6205, -79.3132], // Eastern Area
    [43.7615, -79.4111], // Northern Suburbs
    [43.7731, -79.2584], // Eastern Suburbs
    [43.6205, -79.5132], // Western Suburbs
    [43.689, -79.4532], // Central North
    [43.6319, -79.4216], // Southwest
  ]

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    try {
      const cached = localStorage.getItem("geocoding-cache-v3")
      if (cached) {
        this.cache = JSON.parse(cached)
        this.cleanExpiredCache()
      }
    } catch (error) {
      console.warn("Failed to load geocoding cache:", error)
      this.cache = {}
    }
  }

  private saveCache(): void {
    try {
      localStorage.setItem("geocoding-cache-v3", JSON.stringify(this.cache))
    } catch (error) {
      console.warn("Failed to save geocoding cache:", error)
    }
  }

  private cleanExpiredCache(): void {
    const now = Date.now()
    let hasExpired = false

    for (const [address, entry] of Object.entries(this.cache)) {
      if (entry.expires < now) {
        delete this.cache[address]
        hasExpired = true
      }
    }

    if (hasExpired) {
      this.saveCache()
    }
  }

  private getCachedCoordinates(
    address: string,
  ): { coordinates: [number, number]; accuracy: "high" | "medium" | "low"; city: string; country: string } | null {
    const entry = this.cache[address]
    if (entry && entry.expires > Date.now()) {
      return {
        coordinates: entry.coordinates,
        accuracy: entry.accuracy,
        city: entry.city,
        country: entry.country,
      }
    }
    return null
  }

  private setCachedCoordinates(
    address: string,
    coordinates: [number, number],
    accuracy: "high" | "medium" | "low" = "high",
    city = "Unknown",
    country = "Unknown",
  ): void {
    const now = Date.now()
    this.cache[address] = {
      coordinates,
      timestamp: now,
      expires: now + this.CACHE_DURATION,
      accuracy,
      city,
      country,
    }
    this.saveCache()
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      await new Promise((resolve) => setTimeout(resolve, this.REQUEST_DELAY - timeSinceLastRequest))
    }

    this.lastRequestTime = Date.now()
    this.requestCount++

    return fetch(url, {
      headers: {
        "User-Agent": "DeliverySystem/1.0 (Contact: admin@deliverysystem.com)",
      },
    })
  }

  private async geocodeSingleAddress(address: string, retryCount = 0): Promise<[number, number] | null> {
    try {
      const cleanAddress = address.trim().replace(/\s+/g, " ")
      const encodedAddress = encodeURIComponent(cleanAddress)

      console.log(`Geocoding address: ${cleanAddress}`)

      const response = await this.rateLimitedFetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5&addressdetails=1&extratags=1`,
      )

      if (!response.ok) {
        if (response.status === 429 && retryCount < this.MAX_RETRIES) {
          // Rate limited, wait longer and retry
          await new Promise((resolve) => setTimeout(resolve, 2000 * (retryCount + 1)))
          return this.geocodeSingleAddress(address, retryCount + 1)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data && data.length > 0) {
        // Sort by importance/accuracy
        const sortedResults = data.sort((a: any, b: any) => {
          const aImportance = Number.parseFloat(a.importance || 0)
          const bImportance = Number.parseFloat(b.importance || 0)
          return bImportance - aImportance
        })

        const bestResult = sortedResults[0]
        const lat = Number.parseFloat(bestResult.lat)
        const lon = Number.parseFloat(bestResult.lon)

        if (!isNaN(lat) && !isNaN(lon)) {
          const coordinates: [number, number] = [lat, lon]

          // Determine accuracy based on result quality
          const accuracy = bestResult.importance > 0.7 ? "high" : bestResult.importance > 0.4 ? "medium" : "low"

          // Extract city and country from result
          const addressComponents = bestResult.address || {}
          const city = addressComponents.city || addressComponents.town || addressComponents.municipality || "Unknown"
          const country = addressComponents.country || "Unknown"

          this.setCachedCoordinates(address, coordinates, accuracy, city, country)

          console.log(`Successfully geocoded: ${address} -> [${lat}, ${lon}] (${city}, ${country})`)
          return coordinates
        }
      }

      console.warn(`No valid coordinates found for address: ${address}`)
      return null
    } catch (error) {
      console.error("Geocoding error for address:", address, error)

      if (retryCount < this.MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.geocodeSingleAddress(address, retryCount + 1)
      }

      return null
    }
  }

  private generateFallbackCoordinates(address: string, index: number): [number, number] {
    // Generate realistic coordinates based on address hash
    let hash = 0
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    const normalizedHash = Math.abs(hash) / 2147483647 // Normalize to 0-1
    const fallbackIndex = Math.floor(normalizedHash * this.DEFAULT_FALLBACK_COORDS.length)
    const baseCoords = this.DEFAULT_FALLBACK_COORDS[fallbackIndex]

    // Add small random offset to avoid exact overlaps
    const latOffset = (Math.random() - 0.5) * 0.01 // ~1km variation
    const lonOffset = (Math.random() - 0.5) * 0.01

    const coordinates: [number, number] = [baseCoords[0] + latOffset, baseCoords[1] + lonOffset]

    console.log(`Generated fallback coordinates for: ${address} -> [${coordinates[0]}, ${coordinates[1]}]`)
    return coordinates
  }

  async geocodeAddress(address: string): Promise<[number, number] | null> {
    if (!address || address.trim().length === 0) {
      return null
    }

    const cleanAddress = address.trim()

    // Check cache first
    const cached = this.getCachedCoordinates(cleanAddress)
    if (cached) {
      console.log(
        `Using cached coordinates for: ${cleanAddress} -> [${cached.coordinates[0]}, ${cached.coordinates[1]}] (${cached.city})`,
      )
      return cached.coordinates
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(cleanAddress)
    if (pending) {
      return pending
    }

    // Create new request
    const request = this.geocodeSingleAddress(cleanAddress)
    this.pendingRequests.set(cleanAddress, request)

    try {
      const result = await request
      return result
    } finally {
      this.pendingRequests.delete(cleanAddress)
    }
  }

  async geocodeBatch(addresses: string[]): Promise<GeocodingResult[]> {
    const results: GeocodingResult[] = []
    const toGeocode: string[] = []

    console.log(`Starting batch geocoding for ${addresses.length} addresses`)

    // First pass: check cache and prepare uncached addresses
    for (const address of addresses) {
      const cached = this.getCachedCoordinates(address)
      if (cached) {
        results.push({
          address,
          coordinates: cached.coordinates,
          fromCache: true,
          accuracy: cached.accuracy,
          city: cached.city,
          country: cached.country,
        })
      } else {
        toGeocode.push(address)
        results.push({
          address,
          coordinates: null,
          fromCache: false,
          accuracy: "low",
        })
      }
    }

    console.log(`Found ${results.filter((r) => r.fromCache).length} cached, need to geocode ${toGeocode.length}`)

    // Second pass: geocode uncached addresses in batches
    if (toGeocode.length > 0) {
      const batches: string[][] = []
      for (let i = 0; i < toGeocode.length; i += this.BATCH_SIZE) {
        batches.push(toGeocode.slice(i, i + this.BATCH_SIZE))
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (address, index) => {
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.REQUEST_DELAY * index))
          }
          return this.geocodeAddress(address)
        })

        const batchResults = await Promise.all(batchPromises)

        batch.forEach((address, index) => {
          const resultIndex = results.findIndex((r) => r.address === address && !r.fromCache)
          if (resultIndex !== -1) {
            results[resultIndex].coordinates = batchResults[index]
            results[resultIndex].accuracy = batchResults[index] ? "high" : "low"
          }
        })

        // Delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
      }
    }

    console.log(
      `Batch geocoding completed: ${results.filter((r) => r.coordinates).length}/${results.length} successful`,
    )
    return results
  }

  async geocodeWithFallback(
    addresses: string[],
  ): Promise<
    Array<{ address: string; coordinates: [number, number]; accuracy: "high" | "medium" | "low"; city: string }>
  > {
    const results: Array<{
      address: string
      coordinates: [number, number]
      accuracy: "high" | "medium" | "low"
      city: string
    }> = []

    console.log(`Geocoding ${addresses.length} addresses with fallback`)

    // Provide immediate fallback coordinates
    addresses.forEach((address, index) => {
      const cached = this.getCachedCoordinates(address)
      results.push({
        address,
        coordinates: cached?.coordinates || this.generateFallbackCoordinates(address, index),
        accuracy: cached?.accuracy || "low",
        city: cached?.city || "Unknown",
      })
    })

    // Start background geocoding for uncached addresses
    const uncachedAddresses = addresses.filter((addr) => !this.getCachedCoordinates(addr))

    if (uncachedAddresses.length > 0) {
      console.log(`Starting background geocoding for ${uncachedAddresses.length} uncached addresses`)

      this.geocodeBatch(uncachedAddresses)
        .then((geocodedResults) => {
          const successCount = geocodedResults.filter((r) => r.coordinates).length
          console.log(`Background geocoded ${successCount}/${geocodedResults.length} addresses`)
        })
        .catch((error) => {
          console.warn("Background geocoding failed:", error)
        })
    }

    return results
  }

  clearCache(): void {
    this.cache = {}
    localStorage.removeItem("geocoding-cache-v3")
    console.log("Geocoding cache cleared")
  }

  getCacheStats(): {
    total: number
    expired: number
    size: string
    accuracy: { high: number; medium: number; low: number }
    cities: { [city: string]: number }
  } {
    const now = Date.now()
    const total = Object.keys(this.cache).length
    const expired = Object.values(this.cache).filter((entry) => entry.expires < now).length
    const size = new Blob([JSON.stringify(this.cache)]).size

    const accuracy = Object.values(this.cache).reduce(
      (acc, entry) => {
        acc[entry.accuracy]++
        return acc
      },
      { high: 0, medium: 0, low: 0 },
    )

    const cities = Object.values(this.cache).reduce(
      (acc, entry) => {
        acc[entry.city] = (acc[entry.city] || 0) + 1
        return acc
      },
      {} as { [city: string]: number },
    )

    return {
      total,
      expired,
      size: `${(size / 1024).toFixed(1)} KB`,
      accuracy,
      cities,
    }
  }

  getRequestStats(): { count: number; lastRequest: number } {
    return {
      count: this.requestCount,
      lastRequest: this.lastRequestTime,
    }
  }
}

export const geocodingService = new GeocodingService()
