export const MAPBOX_CONFIG = {
  accessToken:
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    "pk.eyJ1IjoiZGVsaXZlcnlvcyIsImEiOiJjbTRxeWJkZGcwMGNzMmxzZWVqZGNkZGVkIn0.example",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [-79.3832, 43.6532] as [number, number], // Toronto [lng, lat]
  zoom: 11,
  pitch: 0,
  bearing: 0,
}

export const MARKER_COLORS = {
  driver: "#10b981",
  warehouse: "#1e40af",
  pending: "#f59e0b",
  assigned: "#3b82f6",
  picked_up: "#8b5cf6",
  in_transit: "#f97316",
  delivered: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
  urgent: "#ef4444",
  high: "#f97316",
  normal: "#3b82f6",
  low: "#6b7280",
}

export const loadMapboxGL = async () => {
  try {
    if (typeof window === "undefined") {
      return null
    }

    // Check if already loaded
    if (window.mapboxgl) {
      return window.mapboxgl
    }

    // Load CSS
    const cssLink = document.createElement("link")
    cssLink.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
    cssLink.rel = "stylesheet"
    document.head.appendChild(cssLink)

    // Load JS
    return new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"
      script.onload = () => {
        window.mapboxgl.accessToken = MAPBOX_CONFIG.accessToken
        resolve(window.mapboxgl)
      }
      script.onerror = reject
      document.head.appendChild(script)
    })
  } catch (error) {
    console.error("Failed to load Mapbox GL:", error)
    return null
  }
}

export const isBrowser = typeof window !== "undefined"

// Utility function to generate consistent coordinates
export const generateCoordinates = (
  id: string,
  baseLocation: [number, number] = [43.6532, -79.3832],
): [number, number] => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }

  const latOffset = ((Math.abs(hash) % 1000) / 1000 - 0.5) * 0.3 // ±0.15 degrees
  const lngOffset = (((Math.abs(hash) >> 10) % 1000) / 1000 - 0.5) * 0.4 // ±0.2 degrees

  return [baseLocation[0] + latOffset, baseLocation[1] + lngOffset]
}
