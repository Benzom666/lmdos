"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { BottomNavigation } from "@/components/bottom-navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Settings, LogOut, WifiOff, Battery, Signal, Menu, MessageSquare, AlertTriangle } from "lucide-react"

interface DriverDashboardLayoutProps {
  children: React.ReactNode
  title?: string
  showHeader?: boolean
  headerActions?: React.ReactNode
}

export function DriverDashboardLayout({
  children,
  title,
  showHeader = true,
  headerActions,
}: DriverDashboardLayoutProps) {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const [isOnline, setIsOnline] = useState(true)
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)

  useEffect(() => {
    // Monitor online status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Get battery status if available
    if ("getBattery" in navigator) {
      ;(navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100))

        battery.addEventListener("levelchange", () => {
          setBatteryLevel(Math.round(battery.level * 100))
        })
      })
    }

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleEmergencyContact = () => {
    window.open("tel:911")
  }

  const handleSupportContact = () => {
    router.push("/driver/communication")
  }

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <div className="h-12 w-12 mx-auto bg-gray-300 rounded-full" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile-Optimized Header */}
      {showHeader && (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-semibold">
                {profile.first_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || "D"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white leading-none">
                {title || "Dashboard"}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {profile.first_name} {profile.last_name}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Status Indicators */}
            <div className="flex items-center space-x-1">
              {!isOnline && <WifiOff className="h-4 w-4 text-red-500" />}
              {batteryLevel !== null && batteryLevel < 20 && <Battery className="h-4 w-4 text-red-500" />}
              <Signal className="h-4 w-4 text-green-500" />
            </div>

            {/* Emergency Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmergencyContact}
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>

            {/* Notifications */}
            <NotificationsDropdown />

            {/* Profile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">
                      {profile.first_name} {profile.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                    <Badge variant="outline" className="w-fit text-xs">
                      Driver
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleSupportContact}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Contact Support
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => router.push("/driver/profile")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {headerActions}
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="container mx-auto px-4 py-6 max-w-4xl">{children}</div>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-16 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium z-50 flex items-center">
          <WifiOff className="h-4 w-4 mr-2" />
          You're offline. Some features may not work.
        </div>
      )}
    </div>
  )
}
