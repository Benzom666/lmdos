"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { LoadingSpinner } from "@/components/loading-spinner"

interface AuthWrapperProps {
  children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { loading } = useAuth()
  const [showLoading, setShowLoading] = useState(true)

  // Only show loading spinner for a maximum of 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoading(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  // If still loading after initial timeout, show children anyway
  if (loading && showLoading) {
    return <LoadingSpinner message="Checking authentication..." />
  }

  return <>{children}</>
}
