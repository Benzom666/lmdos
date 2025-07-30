"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WifiOff, RefreshCw, Home, Truck } from "lucide-react"

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)

    // Initial check
    updateOnlineStatus()

    return () => {
      window.removeEventListener("online", updateOnlineStatus)
      window.removeEventListener("offline", updateOnlineStatus)
    }
  }, [])

  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.href = "/"
    } else {
      window.location.reload()
    }
  }

  const handleGoHome = () => {
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-slate-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">
            {isOnline ? "Page Not Available" : "You're Offline"}
          </CardTitle>
          <CardDescription className="text-slate-600">
            {isOnline
              ? "This page is not available offline. Please check your connection."
              : "Please check your internet connection and try again."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`}></div>
              {isOnline ? "Connected" : "Disconnected"}
            </div>
          </div>

          <div className="space-y-2">
            <Button onClick={handleRetry} className="w-full" variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={handleGoHome} className="w-full" variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Truck className="w-4 h-4" />
              <span>Delivery System - Offline Mode</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
