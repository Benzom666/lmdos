// Seeded random number generator for consistent coordinates
class SeededRandom {
  private seed: number

  constructor(seed: string) {
    this.seed = this.hashCode(seed)
  }

  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}

// Toronto neighborhoods with realistic coordinate ranges
const TORONTO_NEIGHBORHOODS = [
  {
    name: "Downtown Toronto",
    bounds: {
      north: 43.6776,
      south: 43.6387,
      east: -79.3676,
      west: -79.4009,
    },
    streets: [
      "123 King Street West",
      "456 Queen Street West",
      "789 Bay Street",
      "321 Yonge Street",
      "654 Adelaide Street East",
      "987 Richmond Street West",
      "147 Front Street East",
      "258 Wellington Street West",
    ],
  },
  {
    name: "North York",
    bounds: {
      north: 43.7615,
      south: 43.72,
      east: -79.3849,
      west: -79.45,
    },
    streets: [
      "1234 Yonge Street",
      "5678 Finch Avenue West",
      "9012 Sheppard Avenue East",
      "3456 Don Mills Road",
      "7890 Leslie Street",
      "2468 Bayview Avenue",
      "1357 Victoria Park Avenue",
      "9753 Steeles Avenue West",
    ],
  },
  {
    name: "Scarborough",
    bounds: {
      north: 43.7731,
      south: 43.6532,
      east: -79.1568,
      west: -79.3,
    },
    streets: [
      "2345 Kingston Road",
      "6789 Eglinton Avenue East",
      "1234 Lawrence Avenue East",
      "5678 Markham Road",
      "9012 McCowan Road",
      "3456 Scarborough Golf Club Road",
      "7890 Ellesmere Road",
      "2468 Sheppard Avenue East",
    ],
  },
  {
    name: "Etobicoke",
    bounds: {
      north: 43.7394,
      south: 43.589,
      east: -79.45,
      west: -79.5943,
    },
    streets: [
      "3456 The Queensway",
      "7890 Dundas Street West",
      "1234 Bloor Street West",
      "5678 Royal York Road",
      "9012 Islington Avenue",
      "2468 Kipling Avenue",
      "1357 Lake Shore Boulevard West",
      "9753 Burnhamthorpe Road",
    ],
  },
  {
    name: "East York",
    bounds: {
      north: 43.7057,
      south: 43.6776,
      east: -79.32,
      west: -79.3676,
    },
    streets: [
      "4567 Danforth Avenue",
      "8901 O'Connor Drive",
      "2345 Pape Avenue",
      "6789 Cosburn Avenue",
      "1234 Mortimer Avenue",
      "5678 Thorncliffe Park Drive",
      "9012 Leaside Bridge",
      "3456 Bayview Avenue",
    ],
  },
  {
    name: "York",
    bounds: {
      north: 43.7057,
      south: 43.6532,
      east: -79.4009,
      west: -79.45,
    },
    streets: [
      "5678 St. Clair Avenue West",
      "9012 Dupont Street",
      "3456 Davenport Road",
      "7890 Ossington Avenue",
      "1234 Dufferin Street",
      "5678 Lansdowne Avenue",
      "9012 Roncesvalles Avenue",
      "2468 College Street",
    ],
  },
]

interface OrderCoordinate {
  lat: number
  lng: number
  address: string
  neighborhood: string
}

interface DriverCoordinate {
  lat: number
  lng: number
  neighborhood: string
}

export function generateOrderCoordinates(orders: any[]): Map<string, OrderCoordinate> {
  const coordinateMap = new Map<string, OrderCoordinate>()

  orders.forEach((order, index) => {
    // Use order ID and order number for consistent seeding
    const seed = `${order.id}-${order.order_number}`
    const rng = new SeededRandom(seed)

    // Select neighborhood based on seeded random
    const neighborhoodIndex = Math.floor(rng.next() * TORONTO_NEIGHBORHOODS.length)
    const neighborhood = TORONTO_NEIGHBORHOODS[neighborhoodIndex]

    // Generate coordinates within neighborhood bounds
    const lat = neighborhood.bounds.south + rng.next() * (neighborhood.bounds.north - neighborhood.bounds.south)
    const lng = neighborhood.bounds.west + rng.next() * (neighborhood.bounds.east - neighborhood.bounds.west)

    // Select street address based on seeded random
    const streetIndex = Math.floor(rng.next() * neighborhood.streets.length)
    const address = neighborhood.streets[streetIndex]

    coordinateMap.set(order.id, {
      lat,
      lng,
      address,
      neighborhood: neighborhood.name,
    })
  })

  return coordinateMap
}

export function generateDriverLocation(driverId: string, driverName: string): DriverCoordinate {
  // Use driver ID and name for consistent seeding
  const seed = `driver-${driverId}-${driverName}`
  const rng = new SeededRandom(seed)

  // Drivers are more likely to be in central areas (Downtown, North York)
  const centralNeighborhoods = [0, 1] // Downtown and North York indices
  const neighborhoodIndex = centralNeighborhoods[Math.floor(rng.next() * centralNeighborhoods.length)]
  const neighborhood = TORONTO_NEIGHBORHOODS[neighborhoodIndex]

  // Generate coordinates within neighborhood bounds
  const lat = neighborhood.bounds.south + rng.next() * (neighborhood.bounds.north - neighborhood.bounds.south)
  const lng = neighborhood.bounds.west + rng.next() * (neighborhood.bounds.east - neighborhood.bounds.west)

  return {
    lat,
    lng,
    neighborhood: neighborhood.name,
  }
}

export function generateRouteZoneCoordinates(zoneId: string, zoneName: string): OrderCoordinate {
  const seed = `zone-${zoneId}-${zoneName}`
  const rng = new SeededRandom(seed)

  // Zones are typically in central areas
  const neighborhood = TORONTO_NEIGHBORHOODS[0] // Downtown

  const lat = neighborhood.bounds.south + rng.next() * (neighborhood.bounds.north - neighborhood.bounds.south)
  const lng = neighborhood.bounds.west + rng.next() * (neighborhood.bounds.east - neighborhood.bounds.west)

  return {
    lat,
    lng,
    address: `${zoneName} Zone Center`,
    neighborhood: neighborhood.name,
  }
}
