const CACHE_NAME = "delivery-system-v1"
const STATIC_CACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/offline",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
]

const DYNAMIC_CACHE_NAME = "delivery-system-dynamic-v1"
const MAX_CACHE_SIZE = 50

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...")
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Caching static assets")
        return cache.addAll(STATIC_CACHE_URLS.map((url) => new Request(url, { cache: "reload" })))
      })
      .then(() => {
        console.log("Service Worker: Installation complete")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("Service Worker: Installation failed", error)
      }),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...")
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                console.log("Service Worker: Deleting old cache", cacheName)
                return caches.delete(cacheName)
              }
            }),
          )
        }),
      // Claim clients
      self.clients.claim(),
    ]).then(() => {
      console.log("Service Worker: Activation complete")
    }),
  )
})

// Helper function to limit cache size
const limitCacheSize = (cacheName, size) => {
  return caches.open(cacheName).then((cache) => {
    return cache.keys().then((keys) => {
      if (keys.length > size) {
        return cache.delete(keys[0]).then(() => {
          return limitCacheSize(cacheName, size)
        })
      }
    })
  })
}

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return
  }

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return
  }

  // Skip API routes, Next.js internals, and service worker
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("/_next/") ||
    event.request.url.includes("/sw.js") ||
    event.request.url.includes("chrome-extension://") ||
    event.request.url.includes("moz-extension://")
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version if available
      if (cachedResponse) {
        console.log("Service Worker: Serving from cache", event.request.url)
        return cachedResponse
      }

      // Otherwise fetch from network
      return fetch(event.request)
        .then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          // Cache dynamic content (only HTML pages and important assets)
          if (
            event.request.destination === "document" ||
            event.request.destination === "script" ||
            event.request.destination === "style" ||
            event.request.url.includes("/icons/")
          ) {
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              console.log("Service Worker: Caching dynamic content", event.request.url)
              cache.put(event.request, responseToCache).then(() => {
                limitCacheSize(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE)
              })
            })
          }

          return response
        })
        .catch((error) => {
          console.error("Service Worker: Fetch failed", error)

          // Return offline page for navigation requests
          if (event.request.destination === "document") {
            return caches.match("/offline").then((offlineResponse) => {
              return (
                offlineResponse ||
                new Response(
                  `<!DOCTYPE html>
                <html>
                <head>
                  <title>Offline - Delivery System</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; }
                    .offline { color: #666; }
                  </style>
                </head>
                <body>
                  <h1>You're Offline</h1>
                  <p class="offline">Please check your internet connection and try again.</p>
                  <button onclick="window.location.reload()">Retry</button>
                </body>
                </html>`,
                  { headers: { "Content-Type": "text/html" } },
                )
              )
            })
          }

          throw error
        })
    }),
  )
})

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("Service Worker: Background sync", event.tag)

  if (event.tag === "background-sync") {
    event.waitUntil(
      // Handle background sync tasks
      console.log("Service Worker: Performing background sync"),
    )
  }
})

// Push notification handling
self.addEventListener("push", (event) => {
  console.log("Service Worker: Push received", event)

  const options = {
    body: event.data ? event.data.text() : "New notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  }

  event.waitUntil(self.registration.showNotification("Delivery System", options))
})

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("Service Worker: Notification clicked", event)

  event.notification.close()

  event.waitUntil(clients.openWindow("/"))
})
