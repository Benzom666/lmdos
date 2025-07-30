"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { LoadingSpinner } from "@/components/loading-spinner"

interface RouteGuardProps {
  children: React.ReactNode
  requiredRole?: "super_admin" | "admin" | "driver"
  allowedRoles?: ("super_admin" | "admin" | "driver")[]
}

export function RouteGuard({ children, requiredRole, allowedRoles }: RouteGuardProps) {
  const { user, profile, loading, initialized } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Don't check authorization until auth is fully initialized
    if (!initialized) {
      return
    }

    console.log("🔒 Route Guard - Checking authorization...")
    console.log("👤 User:", user ? "✅ Authenticated" : "❌ Not authenticated")
    console.log("👤 Profile:", profile ? `✅ Role: ${profile.role}` : "❌ No profile")
    console.log("🎯 Required Role:", requiredRole)
    console.log("🎯 Allowed Roles:", allowedRoles)

    // If no user, redirect to login
    if (!user) {
      console.log("🚫 No user - redirecting to login")
      router.replace("/")
      setAuthChecked(true)
      return
    }

    // If no profile yet, wait a bit more
    if (!profile) {
      console.log("⏳ No profile yet - waiting...")
      // Set a timeout to prevent infinite waiting
      const timeout = setTimeout(() => {
        console.log("⏰ Profile timeout - redirecting to login")
        router.replace("/")
        setAuthChecked(true)
      }, 5000)

      return () => clearTimeout(timeout)
    }

    // Check role authorization
    let authorized = false

    if (requiredRole) {
      authorized = profile.role === requiredRole
      console.log(`🔍 Required role check: ${profile.role} === ${requiredRole} = ${authorized}`)
    } else if (allowedRoles) {
      authorized = allowedRoles.includes(profile.role)
      console.log(`🔍 Allowed roles check: ${allowedRoles.join(", ")} includes ${profile.role} = ${authorized}`)
    } else {
      // No specific role required, just need to be authenticated
      authorized = true
      console.log("🔍 No role restriction - authorized")
    }

    if (!authorized) {
      console.log("🚫 Not authorized - redirecting to appropriate dashboard")
      // Redirect to appropriate dashboard based on user role
      switch (profile.role) {
        case "super_admin":
          router.replace("/super-admin")
          break
        case "admin":
          router.replace("/admin/dashboard")
          break
        case "driver":
          router.replace("/driver/home")
          break
        default:
          router.replace("/")
      }
    } else {
      console.log("✅ Authorized - allowing access")
      setIsAuthorized(true)
    }

    setAuthChecked(true)
  }, [initialized, user, profile, requiredRole, allowedRoles, router])

  // Show loading while auth is initializing or being checked
  if (!initialized || loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">{!initialized ? "Initializing..." : "Checking authorization..."}</p>
        </div>
      </div>
    )
  }

  // Show loading if not authorized (redirect in progress)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  // Render children if authorized
  return <>{children}</>
}
