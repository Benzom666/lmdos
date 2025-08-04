// Enhanced geocoding service with comprehensive error handling and optimization
interface GeocodingCache {
  [address: string]: {
    coordinates: [number, number]
    timestamp: number
    expires: number
    accuracy: "high" | "medium" | "low"
    city: string
    country: string
    formatted_address: string
  }
}

interface GeocodingResult {
  address: string
  coordinates: [number, number] | null
  fromCache: boolean
  accuracy: "high" | "medium" | "low"
  city?: string
  country?: string
  formatted_address?: string
}

class GeocodingService {
  private cache: GeocodingCache = {}
  private pendingRequests: Map<string, Promise<[number, number] | null>> = new Map()
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days
  private readonly BATCH_SIZE = 5
  private readonly REQUEST_DELAY = 1000 // 1 second delay between requests
  private readonly MAX_RETRIES = 3
  private requestCount = 0
  private lastRequestTime = 0

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    try {
      const cached = localStorage.getItem("geocoding-cache-v4")
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
      localStorage.setItem("geocoding-cache-v4", JSON.stringify(this.cache))
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

  private getCachedCoordinates(address: string): GeocodingResult | null {
    const entry = this.cache[address]
    if (entry && entry.expires > Date.now()) {
      return {
        address,
        coordinates: entry.coordinates,
        fromCache: true,
        accuracy: entry.accuracy,
        city: entry.city,
        country: entry.country,
        formatted_address: entry.formatted_address,
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
    formatted_address = address,
  ): void {
    const now = Date.now()
    this.cache[address] = {
      coordinates,
      timestamp: now,
      expires: now + this.CACHE_DURATION,
      accuracy,
      city,
      country,
      formatted_address,
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

  private async geocodeSingleAddress(address: string, retryCount = 0): Promise<GeocodingResult> {
    try {
      const cleanAddress = this.cleanAddress(address)
      const encodedAddress = encodeURIComponent(cleanAddress)

      console.log(`🔍 Geocoding address: ${cleanAddress}`)

      // Try Mapbox Geocoding API first (more accurate)
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      if (mapboxToken) {
        try {
          const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&country=ca&proximity=-79.3832,43.6532`
          const mapboxResponse = await this.rateLimitedFetch(mapboxUrl)

          if (mapboxResponse.ok) {
            const mapboxData = await mapboxResponse.json()
            if (mapboxData.features && mapboxData.features.length > 0) {
              const feature = mapboxData.features[0]
              const [lng, lat] = feature.center
              const coordinates: [number, number] = [lat, lng]

              const result: GeocodingResult = {
                address: cleanAddress,
                coordinates,
                fromCache: false,
                accuracy: feature.relevance > 0.8 ? "high" : feature.relevance > 0.5 ? "medium" : "low",
                city: this.extractCity(feature.context),
                country: "Canada",
                formatted_address: feature.place_name,
              }

              this.setCachedCoordinates(
                address,
                coordinates,
                result.accuracy,
                result.city,
                result.country,
                result.formatted_address,
              )

              console.log(`✅ Mapbox geocoded: ${cleanAddress} -> [${lat}, ${lng}] (${result.city})`)
              return result
            }
          }
        } catch (error) {
          console.warn("Mapbox geocoding failed, falling back to Nominatim:", error)
        }
      }

      // Fallback to Nominatim (OpenStreetMap)
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1&countrycodes=ca&bounded=1&viewbox=-79.639219,43.580952,-79.115906,43.855457`
      const response = await this.rateLimitedFetch(nominatimUrl)

      if (!response.ok) {
        if (response.status === 429 && retryCount < this.MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * (retryCount + 1)))
          return this.geocodeSingleAddress(address, retryCount + 1)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data && data.length > 0) {
        const result = data[0]
        const lat = Number.parseFloat(result.lat)
        const lng = Number.parseFloat(result.lon)

        if (!isNaN(lat) && !isNaN(lng)) {
          const coordinates: [number, number] = [lat, lng]
          const accuracy = Number.parseFloat(result.importance || 0) > 0.7 ? "high" : "medium"
          const addressComponents = result.address || {}
          const city =
            addressComponents.city ||
            addressComponents.town ||
            addressComponents.municipality ||
            addressComponents.suburb ||
            "Toronto"
          const country = addressComponents.country || "Canada"

          const geocodingResult: GeocodingResult = {
            address: cleanAddress,
            coordinates,
            fromCache: false,
            accuracy,
            city,
            country,
            formatted_address: result.display_name,
          }

          this.setCachedCoordinates(address, coordinates, accuracy, city, country, result.display_name)

          console.log(`✅ Nominatim geocoded: ${cleanAddress} -> [${lat}, ${lng}] (${city})`)
          return geocodingResult
        }
      }

      console.warn(`❌ No coordinates found for address: ${cleanAddress}`)
      return {
        address: cleanAddress,
        coordinates: null,
        fromCache: false,
        accuracy: "low",
      }
    } catch (error) {
      console.error("Geocoding error for address:", address, error)

      if (retryCount < this.MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
        return this.geocodeSingleAddress(address, retryCount + 1)
      }

      return {
        address,
        coordinates: null,
        fromCache: false,
        accuracy: "low",
      }
    }
  }

  private cleanAddress(address: string): string {
    return address
      .trim()
      .replace(/\s+/g, " ")
      .replace(/,\s*,/g, ",") // Remove double commas
      .replace(/^,|,$/g, "") // Remove leading/trailing commas
  }

  private extractCity(context: any[]): string {
    if (!context) return "Toronto"

    for (const item of context) {
      if (item.id && item.id.includes("place")) {
        return item.text
      }
    }
    return "Toronto"
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || address.trim().length === 0) {
      return {
        address: "",
        coordinates: null,
        fromCache: false,
        accuracy: "low",
      }
    }

    const cleanAddress = this.cleanAddress(address)

    // Check cache first
    const cached = this.getCachedCoordinates(cleanAddress)
    if (cached) {
      console.log(`💾 Using cached coordinates for: ${cleanAddress}`)
      return cached
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(cleanAddress)
    if (pending) {
      const coordinates = await pending
      return {
        address: cleanAddress,
        coordinates,
        fromCache: false,
        accuracy: coordinates ? "medium" : "low",
      }
    }

    // Create new request
    const request = this.geocodeSingleAddress(cleanAddress).then((result) => result.coordinates)
    this.pendingRequests.set(cleanAddress, request)

    try {
      const result = await this.geocodeSingleAddress(cleanAddress)
      return result
    } finally {
      this.pendingRequests.delete(cleanAddress)
    }
  }

  async geocodeBatch(addresses: string[]): Promise<GeocodingResult[]> {
    const results: GeocodingResult[] = []
    const toGeocode: string[] = []

    console.log(`🚀 Starting batch geocoding for ${addresses.length} addresses`)

    // First pass: check cache
    for (const address of addresses) {
      const cached = this.getCachedCoordinates(address)
      if (cached) {
        results.push(cached)
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

    console.log(`💾 Found ${results.filter((r) => r.fromCache).length} cached, need to geocode ${toGeocode.length}`)

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
            results[resultIndex] = batchResults[index]
          }
        })

        // Delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    }

    const successCount = results.filter((r) => r.coordinates).length
    console.log(`✅ Batch geocoding completed: ${successCount}/${results.length} successful`)
    return results
  }

  clearCache(): void {
    this.cache = {}
    localStorage.removeItem("geocoding-cache-v4")
    console.log("🗑️ Geocoding cache cleared")
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
}

export const geocodingService = new GeocodingService()
