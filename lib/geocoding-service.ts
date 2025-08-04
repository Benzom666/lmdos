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
    confidence: number
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
  confidence?: number
}

class GeocodingService {
  private cache: GeocodingCache = {}
  private pendingRequests: Map<string, Promise<GeocodingResult>> = new Map()
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days
  private readonly BATCH_SIZE = 3 // Reduced for better accuracy
  private readonly REQUEST_DELAY = 1500 // Increased delay for better results
  private readonly MAX_RETRIES = 3
  private requestCount = 0
  private lastRequestTime = 0

  constructor() {
    this.loadCache()
  }

  private loadCache(): void {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("geocoding-cache-v6")
        if (cached) {
          this.cache = JSON.parse(cached)
          this.cleanExpiredCache()
          console.log(`📍 Loaded ${Object.keys(this.cache).length} cached locations`)
        }
      }
    } catch (error) {
      console.warn("Failed to load geocoding cache:", error)
      this.cache = {}
    }
  }

  private saveCache(): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("geocoding-cache-v6", JSON.stringify(this.cache))
      }
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
    const cleanAddress = this.cleanAddress(address)
    const entry = this.cache[cleanAddress]
    if (entry && entry.expires > Date.now()) {
      console.log(`💾 Cache hit for: ${cleanAddress} -> [${entry.coordinates[0]}, ${entry.coordinates[1]}]`)
      return {
        address: cleanAddress,
        coordinates: entry.coordinates,
        fromCache: true,
        accuracy: entry.accuracy,
        city: entry.city,
        country: entry.country,
        formatted_address: entry.formatted_address,
        confidence: entry.confidence,
      }
    }
    return null
  }

  private setCachedCoordinates(
    address: string,
    coordinates: [number, number],
    accuracy: "high" | "medium" | "low" = "high",
    city = "Unknown",
    country = "Canada",
    formatted_address = address,
    confidence = 1.0,
  ): void {
    const cleanAddress = this.cleanAddress(address)
    const now = Date.now()
    this.cache[cleanAddress] = {
      coordinates,
      timestamp: now,
      expires: now + this.CACHE_DURATION,
      accuracy,
      city,
      country,
      formatted_address,
      confidence,
    }
    this.saveCache()
    console.log(`💾 Cached: ${cleanAddress} -> [${coordinates[0]}, ${coordinates[1]}] (${accuracy})`)
  }

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      const waitTime = this.REQUEST_DELAY - timeSinceLastRequest
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()
    this.requestCount++

    return fetch(url, {
      headers: {
        "User-Agent": "DeliveryOS/1.0 (Contact: admin@deliveryos.com)",
        Accept: "application/json",
      },
    })
  }

  private cleanAddress(address: string): string {
    return address
      .trim()
      .replace(/\s+/g, " ")
      .replace(/,\s*,/g, ",")
      .replace(/^,|,$/g, "")
      .replace(/\b(apt|apartment|unit|suite|ste)\s*\.?\s*\w+/gi, "")
      .toLowerCase()
  }

  private normalizeAddress(address: string): string {
    // Add Canada if not present and clean up common variations
    let normalized = address.trim()

    // Add Canada if not present
    if (
      !normalized.toLowerCase().includes("canada") &&
      !normalized.toLowerCase().includes("ontario") &&
      !normalized.toLowerCase().includes("toronto")
    ) {
      normalized += ", Ontario, Canada"
    }

    // Standardize common abbreviations
    normalized = normalized
      .replace(/\bst\b/gi, "Street")
      .replace(/\bave\b/gi, "Avenue")
      .replace(/\brd\b/gi, "Road")
      .replace(/\bblvd\b/gi, "Boulevard")
      .replace(/\bdr\b/gi, "Drive")
      .replace(/\bcres\b/gi, "Crescent")
      .replace(/\bpl\b/gi, "Place")
      .replace(/\bct\b/gi, "Court")

    return normalized
  }

  private isValidCanadianCoordinate(lat: number, lng: number): boolean {
    // More precise bounds for Greater Toronto Area and surrounding regions
    return (
      lat >= 43.0 &&
      lat <= 45.0 && // Latitude bounds for GTA region
      lng >= -80.5 &&
      lng <= -78.5 && // Longitude bounds for GTA region
      !isNaN(lat) &&
      !isNaN(lng)
    )
  }

  private extractCity(context: any[]): string {
    if (!context) return "Toronto"

    for (const item of context) {
      if (item.id && (item.id.includes("place") || item.id.includes("locality"))) {
        return item.text || item.text_en || "Toronto"
      }
    }
    return "Toronto"
  }

  private async geocodeSingleAddress(address: string, retryCount = 0): Promise<GeocodingResult> {
    try {
      const cleanAddress = this.cleanAddress(address)
      const normalizedAddress = this.normalizeAddress(address)

      console.log(`🔍 Geocoding: "${address}" -> normalized: "${normalizedAddress}"`)

      // Try Mapbox Geocoding API first (most accurate for Canadian addresses)
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      if (mapboxToken) {
        try {
          const encodedAddress = encodeURIComponent(normalizedAddress)
          const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&country=ca&proximity=-79.3832,43.6532&types=address,poi&language=en`

          console.log(`📡 Mapbox request: ${mapboxUrl}`)
          const mapboxResponse = await this.rateLimitedFetch(mapboxUrl)

          if (mapboxResponse.ok) {
            const mapboxData = await mapboxResponse.json()
            console.log(`📡 Mapbox response:`, mapboxData)

            if (mapboxData.features && mapboxData.features.length > 0) {
              const feature = mapboxData.features[0]
              const [lng, lat] = feature.center
              const relevance = feature.relevance || 0

              console.log(`📍 Mapbox coordinates: [${lat}, ${lng}], relevance: ${relevance}`)

              if (this.isValidCanadianCoordinate(lat, lng) && relevance > 0.6) {
                const coordinates: [number, number] = [lat, lng]
                const accuracy = relevance > 0.9 ? "high" : relevance > 0.7 ? "medium" : "low"
                const city = this.extractCity(feature.context)

                const result: GeocodingResult = {
                  address: cleanAddress,
                  coordinates,
                  fromCache: false,
                  accuracy,
                  city,
                  country: "Canada",
                  formatted_address: feature.place_name,
                  confidence: relevance,
                }

                this.setCachedCoordinates(address, coordinates, accuracy, city, "Canada", feature.place_name, relevance)

                console.log(`✅ Mapbox success: ${address} -> [${lat}, ${lng}] (${city}, confidence: ${relevance})`)
                return result
              } else {
                console.warn(
                  `⚠️ Mapbox coordinates out of bounds or low relevance: [${lat}, ${lng}], relevance: ${relevance}`,
                )
              }
            }
          } else {
            console.warn(`⚠️ Mapbox API error: ${mapboxResponse.status} ${mapboxResponse.statusText}`)
          }
        } catch (error) {
          console.warn("Mapbox geocoding failed:", error)
        }
      }

      // Fallback to Nominatim with enhanced Canadian focus
      try {
        const encodedAddress = encodeURIComponent(normalizedAddress)
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&addressdetails=1&countrycodes=ca&bounded=1&viewbox=-80.5,45.0,-78.5,43.0&dedupe=1`

        console.log(`📡 Nominatim request: ${nominatimUrl}`)
        const response = await this.rateLimitedFetch(nominatimUrl)

        if (!response.ok) {
          if (response.status === 429 && retryCount < this.MAX_RETRIES) {
            const waitTime = 3000 * (retryCount + 1)
            console.log(`⏳ Rate limited, waiting ${waitTime}ms before retry ${retryCount + 1}`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            return this.geocodeSingleAddress(address, retryCount + 1)
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`📡 Nominatim response:`, data)

        if (data && data.length > 0) {
          const result = data[0]
          const lat = Number.parseFloat(result.lat)
          const lng = Number.parseFloat(result.lon)
          const importance = Number.parseFloat(result.importance || 0)

          console.log(`📍 Nominatim coordinates: [${lat}, ${lng}], importance: ${importance}`)

          if (this.isValidCanadianCoordinate(lat, lng)) {
            const coordinates: [number, number] = [lat, lng]
            const accuracy = importance > 0.7 ? "high" : importance > 0.5 ? "medium" : "low"
            const addressComponents = result.address || {}
            const city =
              addressComponents.city ||
              addressComponents.town ||
              addressComponents.municipality ||
              addressComponents.suburb ||
              "Toronto"

            const geocodingResult: GeocodingResult = {
              address: cleanAddress,
              coordinates,
              fromCache: false,
              accuracy,
              city,
              country: "Canada",
              formatted_address: result.display_name,
              confidence: importance,
            }

            this.setCachedCoordinates(address, coordinates, accuracy, city, "Canada", result.display_name, importance)

            console.log(`✅ Nominatim success: ${address} -> [${lat}, ${lng}] (${city}, importance: ${importance})`)
            return geocodingResult
          } else {
            console.warn(`⚠️ Nominatim coordinates out of bounds: [${lat}, ${lng}]`)
          }
        }
      } catch (error) {
        console.warn("Nominatim geocoding failed:", error)
      }

      console.warn(`❌ No valid coordinates found for address: ${address}`)
      return {
        address: cleanAddress,
        coordinates: null,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
      }
    } catch (error) {
      console.error(`❌ Geocoding error for address "${address}":`, error)

      if (retryCount < this.MAX_RETRIES) {
        const waitTime = 2000 * (retryCount + 1)
        console.log(`🔄 Retrying geocoding for "${address}" in ${waitTime}ms (attempt ${retryCount + 1})`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        return this.geocodeSingleAddress(address, retryCount + 1)
      }

      return {
        address,
        coordinates: null,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
      }
    }
  }

  async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || address.trim().length === 0) {
      return {
        address: "",
        coordinates: null,
        fromCache: false,
        accuracy: "low",
        confidence: 0,
      }
    }

    const cleanAddress = this.cleanAddress(address)

    // Check cache first
    const cached = this.getCachedCoordinates(address)
    if (cached) {
      return cached
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(cleanAddress)
    if (pending) {
      console.log(`⏳ Waiting for pending request: ${cleanAddress}`)
      return await pending
    }

    // Create new request
    const request = this.geocodeSingleAddress(address)
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
    const toGeocode: { address: string; index: number }[] = []

    console.log(`🚀 Starting batch geocoding for ${addresses.length} addresses`)

    // First pass: check cache and prepare results array
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i]
      const cached = this.getCachedCoordinates(address)
      if (cached) {
        results[i] = cached
      } else {
        results[i] = {
          address,
          coordinates: null,
          fromCache: false,
          accuracy: "low",
          confidence: 0,
        }
        toGeocode.push({ address, index: i })
      }
    }

    console.log(`💾 Found ${results.filter((r) => r.fromCache).length} cached, need to geocode ${toGeocode.length}`)

    // Second pass: geocode uncached addresses in smaller batches
    if (toGeocode.length > 0) {
      const batches: { address: string; index: number }[][] = []
      for (let i = 0; i < toGeocode.length; i += this.BATCH_SIZE) {
        batches.push(toGeocode.slice(i, i + this.BATCH_SIZE))
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} addresses)`)

        const batchPromises = batch.map(async ({ address, index }, batchItemIndex) => {
          // Stagger requests within batch
          if (batchItemIndex > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.REQUEST_DELAY * batchItemIndex))
          }

          const result = await this.geocodeAddress(address)
          return { result, index }
        })

        const batchResults = await Promise.all(batchPromises)

        // Update results array
        batchResults.forEach(({ result, index }) => {
          results[index] = result
        })

        // Delay between batches
        if (batchIndex < batches.length - 1) {
          const delayTime = 3000
          console.log(`⏳ Waiting ${delayTime}ms before next batch`)
          await new Promise((resolve) => setTimeout(resolve, delayTime))
        }
      }
    }

    const successCount = results.filter((r) => r.coordinates).length
    const highAccuracyCount = results.filter((r) => r.accuracy === "high").length

    console.log(
      `✅ Batch geocoding completed: ${successCount}/${results.length} successful (${highAccuracyCount} high accuracy)`,
    )

    return results
  }

  clearCache(): void {
    this.cache = {}
    if (typeof window !== "undefined") {
      localStorage.removeItem("geocoding-cache-v6")
    }
    console.log("🗑️ Geocoding cache cleared")
  }

  getCacheStats(): {
    total: number
    expired: number
    size: string
    accuracy: { high: number; medium: number; low: number }
    cities: { [city: string]: number }
    averageConfidence: number
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

    const averageConfidence =
      total > 0 ? Object.values(this.cache).reduce((sum, entry) => sum + (entry.confidence || 0), 0) / total : 0

    return {
      total,
      expired,
      size: `${(size / 1024).toFixed(1)} KB`,
      accuracy,
      cities,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
    }
  }

  // Get detailed geocoding info for debugging
  getGeocodingInfo(address: string): any {
    const cleanAddress = this.cleanAddress(address)
    const cached = this.cache[cleanAddress]
    return {
      originalAddress: address,
      cleanAddress,
      cached: !!cached,
      cacheEntry: cached || null,
    }
  }
}

export const geocodingService = new GeocodingService()
