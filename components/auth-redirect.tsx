"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { LoadingSpinner } from "@/components/loading-spinner"

export function AuthRedirect() {
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && user && profile) {
      // Redirect based on role
      const dashboardPath =
        profile.role === "super_admin"
          ? "/super-admin"
          : profile.role === "admin"
            ? "/admin/dashboard"
            : profile.role === "driver"
              ? "/driver/home"
              : "/"

      console.log("Redirecting to:", dashboardPath)
      window.location.href = dashboardPath
    }
  }, [user, profile, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) {
    return null // Stay on login page
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <LoadingSpinner />
        <p>Redirecting to your dashboard...</p>
      </div>
    </div>
  )
}
