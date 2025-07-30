"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Button } from "@/components/ui/button"

interface SimpleAuthCheckProps {
  children: React.ReactNode
  requiredRole?: "super_admin" | "admin" | "driver"
}

export function SimpleAuthCheck({ children, requiredRole }: SimpleAuthCheckProps) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          setLoading(false)
          return
        }

        // Get user profile
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .single()

        if (profile) {
          setUserRole(profile.role)

          if (!requiredRole || profile.role === requiredRole) {
            setAuthorized(true)
          }
        }
      } catch (error) {
        console.error("Auth check error:", error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [requiredRole])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            {userRole
              ? `Your role (${userRole}) doesn't have access to this page.`
              : "Please log in to access this page."}
          </p>
          <div className="space-x-2">
            <Button onClick={() => (window.location.href = "/")}>Go to Login</Button>
            {userRole && (
              <Button
                variant="outline"
                onClick={() => {
                  const dashboardPath =
                    userRole === "super_admin"
                      ? "/super-admin"
                      : userRole === "admin"
                        ? "/admin/dashboard"
                        : userRole === "driver"
                          ? "/driver/home"
                          : "/"
                  window.location.href = dashboardPath
                }}
              >
                Go to My Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
