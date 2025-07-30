// Optimized marker management with clustering and virtual rendering
interface MarkerData {
  id: string
  coordinates: [number, number]
  content: any
  priority: string
  visible: boolean
}

interface MarkerCluster {
  coordinates: [number, number]
  markers: MarkerData[]
  zoom: number
}

class MarkerManager {
  private map: any = null
  private markers: Map<string, any> = new Map()
  private clusters: MarkerCluster[] = []
  private visibleMarkers: Set<string> = new Set()
  private readonly CLUSTER_DISTANCE = 50 // pixels
  private readonly MAX_ZOOM_FOR_CLUSTERING = 15

  setMap(map: any): void {
    this.map = map
  }

  private shouldCluster(zoom: number): boolean {
    return zoom < this.MAX_ZOOM_FOR_CLUSTERING
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    if (!this.map) return 0

    const L = (window as any).L
    const point1 = this.map.latLngToContainerPoint(coord1)
    const point2 = this.map.latLngToContainerPoint(coord2)

    return Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2))
  }

  private createCluster(markers: MarkerData[]): any {
    if (!this.map) return null

    const L = (window as any).L
    const center = this.calculateClusterCenter(markers)
    const count = markers.length

    const clusterIcon = L.divIcon({
      html: `
        <div style="
          background-color: #3b82f6;
          width: ${Math.min(40 + count * 2, 60)}px;
          height: ${Math.min(40 + count * 2, 60)}px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${Math.min(14 + count, 18)}px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          font-family: system-ui, -apple-system, sans-serif;
        ">${count}</div>
      `,
      className: "marker-cluster",
      iconSize: [Math.min(40 + count * 2, 60), Math.min(40 + count * 2, 60)],
      iconAnchor: [Math.min(20 + count, 30), Math.min(20 + count, 30)],
    })

    const cluster = L.marker(center, { icon: clusterIcon })

    // Add click handler to zoom in
    cluster.on("click", () => {
      const bounds = L.latLngBounds(markers.map((m) => m.coordinates))
      this.map.fitBounds(bounds, { padding: [20, 20] })
    })

    return cluster
  }

  private calculateClusterCenter(markers: MarkerData[]): [number, number] {
    const totalLat = markers.reduce((sum, marker) => sum + marker.coordinates[0], 0)
    const totalLng = markers.reduce((sum, marker) => sum + marker.coordinates[1], 0)

    return [totalLat / markers.length, totalLng / markers.length]
  }

  private clusterMarkers(markersData: MarkerData[], zoom: number): MarkerCluster[] {
    if (!this.shouldCluster(zoom)) {
      return markersData.map((marker) => ({
        coordinates: marker.coordinates,
        markers: [marker],
        zoom,
      }))
    }

    const clusters: MarkerCluster[] = []
    const processed = new Set<string>()

    for (const marker of markersData) {
      if (processed.has(marker.id)) continue

      const cluster: MarkerData[] = [marker]
      processed.add(marker.id)

      // Find nearby markers to cluster
      for (const otherMarker of markersData) {
        if (processed.has(otherMarker.id)) continue

        const distance = this.calculateDistance(marker.coordinates, otherMarker.coordinates)
        if (distance < this.CLUSTER_DISTANCE) {
          cluster.push(otherMarker)
          processed.add(otherMarker.id)
        }
      }

      clusters.push({
        coordinates: this.calculateClusterCenter(cluster),
        markers: cluster,
        zoom,
      })
    }

    return clusters
  }

  private createSingleMarker(markerData: MarkerData, index: number): any {
    if (!this.map) return null

    const L = (window as any).L
    const { coordinates, content, priority } = markerData

    // Color by priority
    const markerColor =
      priority === "urgent" || priority === "high"
        ? "#dc2626" // Red for urgent and high priority
        : priority === "normal"
          ? "#059669" // Green for normal
          : "#6b7280" // Gray for low

    const customIcon = L.divIcon({
      html: `
        <div style="
          background-color: ${markerColor};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 13px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          font-family: system-ui, -apple-system, sans-serif;
        ">${index + 1}</div>
      `,
      className: "custom-delivery-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })

    const marker = L.marker(coordinates, { icon: customIcon })

    if (content) {
      marker.bindPopup(content, {
        maxWidth: 250,
        className: "custom-popup",
      })
    }

    return marker
  }

  addMarkers(markersData: MarkerData[], progressive = false): void {
    if (!this.map) return

    const L = (window as any).L
    const currentZoom = this.map.getZoom()

    // Clear existing markers
    this.clearMarkers()

    if (progressive) {
      // Add markers progressively
      this.addMarkersProgressively(markersData, currentZoom)
    } else {
      // Add all markers at once
      this.addMarkersImmediate(markersData, currentZoom)
    }
  }

  private addMarkersProgressively(markersData: MarkerData[], zoom: number): void {
    const BATCH_SIZE = 10
    const BATCH_DELAY = 50 // ms

    const addBatch = (startIndex: number) => {
      const endIndex = Math.min(startIndex + BATCH_SIZE, markersData.length)
      const batch = markersData.slice(startIndex, endIndex)

      // Process batch
      if (this.shouldCluster(zoom)) {
        const clusters = this.clusterMarkers(batch, zoom)
        this.renderClusters(clusters)
      } else {
        batch.forEach((markerData, index) => {
          const marker = this.createSingleMarker(markerData, startIndex + index)
          if (marker) {
            marker.addTo(this.map)
            this.markers.set(markerData.id, marker)
            this.visibleMarkers.add(markerData.id)
          }
        })
      }

      // Schedule next batch
      if (endIndex < markersData.length) {
        setTimeout(() => addBatch(endIndex), BATCH_DELAY)
      }
    }

    addBatch(0)
  }

  private addMarkersImmediate(markersData: MarkerData[], zoom: number): void {
    if (this.shouldCluster(zoom)) {
      const clusters = this.clusterMarkers(markersData, zoom)
      this.renderClusters(clusters)
    } else {
      markersData.forEach((markerData, index) => {
        const marker = this.createSingleMarker(markerData, index)
        if (marker) {
          marker.addTo(this.map)
          this.markers.set(markerData.id, marker)
          this.visibleMarkers.add(markerData.id)
        }
      })
    }
  }

  private renderClusters(clusters: MarkerCluster[]): void {
    clusters.forEach((cluster) => {
      if (cluster.markers.length === 1) {
        // Single marker
        const marker = this.createSingleMarker(cluster.markers[0], 0)
        if (marker) {
          marker.addTo(this.map)
          this.markers.set(cluster.markers[0].id, marker)
          this.visibleMarkers.add(cluster.markers[0].id)
        }
      } else {
        // Cluster marker
        const clusterMarker = this.createCluster(cluster.markers)
        if (clusterMarker) {
          clusterMarker.addTo(this.map)
          const clusterId = `cluster-${cluster.markers.map((m) => m.id).join("-")}`
          this.markers.set(clusterId, clusterMarker)
        }
      }
    })
  }

  clearMarkers(): void {
    this.markers.forEach((marker) => {
      if (this.map && marker) {
        this.map.removeLayer(marker)
      }
    })
    this.markers.clear()
    this.visibleMarkers.clear()
  }

  updateMarkersOnZoom(): void {
    // Re-render markers when zoom changes
    const markersData = Array.from(this.markers.entries())
      .filter(([id]) => !id.startsWith("cluster-"))
      .map(([id, marker]) => ({
        id,
        coordinates: marker.getLatLng
          ? ([marker.getLatLng().lat, marker.getLatLng().lng] as [number, number])
          : ([0, 0] as [number, number]),
        content: null,
        priority: "normal",
        visible: true,
      }))

    if (markersData.length > 0) {
      this.addMarkers(markersData, false)
    }
  }

  getVisibleMarkers(): string[] {
    return Array.from(this.visibleMarkers)
  }

  getMarkerCount(): number {
    return this.markers.size
  }
}

export const markerManager = new MarkerManager()
