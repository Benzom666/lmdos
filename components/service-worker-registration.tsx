"use client"

import { useEffect } from "react"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Only register service worker in browser environment
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      registerServiceWorker()
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      // Check if service worker file exists first
      const response = await fetch("/sw.js", { method: "HEAD" })
      if (!response.ok) {
        console.log("Service worker file not found, skipping registration")
        return
      }

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
    }
  }

  return null
}
