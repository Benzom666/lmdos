// PWA utility functions
export const registerServiceWorker = async (): Promise<void> => {
  // Only register in browser environment and production
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.log("Service workers not supported or not in browser")
    return
  }

  try {
    console.log("Registering service worker...")
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })

    registration.addEventListener("updatefound", () => {
      console.log("Service worker update found")
      const newWorker = registration.installing

      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("New service worker installed")
          }
        })
      }
    })

    console.log("Service worker registered successfully")
  } catch (error) {
    console.log("Service worker registration failed, continuing without offline support:", error)
    // Don't throw - app should work without service worker
  }
}

export const checkForUpdates = async (): Promise<void> => {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        registration.update()
      }
    } catch (error) {
      console.log("Service worker update check failed:", error)
    }
  }
}

export const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
}

export const canInstallPWA = (): boolean => {
  if (typeof window === "undefined") return false
  return "serviceWorker" in navigator && "PushManager" in window
}

// iOS Safari detection
export const isIOSSafari = (): boolean => {
  if (typeof window === "undefined") return false
  const userAgent = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
}

// Check if app is installed
export const isAppInstalled = (): boolean => {
  if (typeof window === "undefined") return false
  return isStandalone() || window.matchMedia("(display-mode: standalone)").matches
}
