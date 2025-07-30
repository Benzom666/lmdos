"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

interface UserProfile {
  user_id: string
  email: string
  role: "super_admin" | "admin" | "driver"
  status: "active" | "suspended" | "pending"
  full_name?: string
  first_name?: string
  last_name?: string
  phone?: string
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Add timeout for authentication operations
  const AUTH_TIMEOUT = 10000 // 10 seconds

  const withTimeout = useCallback(<T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Authentication timeout")), timeoutMs)),
    ])
  }, [])

  const fetchUserProfile = useCallback(
    async (userId: string, retryCount = 0): Promise<void> => {
      const MAX_RETRIES = 3
      const RETRY_DELAY = 1000 * Math.pow(2, retryCount) // Exponential backoff

      try {
        setError(null)

        if (retryCount > 0) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
        }

        const profilePromise = supabase.from("user_profiles").select("*").eq("user_id", userId).single()

        const { data, error: profileError } = await withTimeout(profilePromise, AUTH_TIMEOUT)

        if (profileError) {
          console.error("Profile fetch error:", profileError)

          // Handle specific error cases
          if (profileError.code === "PGRST116") {
            console.log("User profile not found, user may need to complete registration")
            setProfile(null)
            setLoading(false)
            return
          }

          // Handle rate limiting with retry
          if (profileError.message?.includes("Too Many") || profileError.message?.includes("rate limit")) {
            if (retryCount < MAX_RETRIES) {
              console.log(`Rate limited, retrying in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
              return fetchUserProfile(userId, retryCount + 1)
            } else {
              throw new Error("Rate limit exceeded. Please try again later.")
            }
          }

          // Network or connection errors - retry
          if (profileError.message?.includes("network") || profileError.message?.includes("connection")) {
            if (retryCount < MAX_RETRIES) {
              console.log(`Network error, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
              return fetchUserProfile(userId, retryCount + 1)
            } else {
              throw new Error("Network connection failed. Please check your internet connection.")
            }
          }

          throw profileError
        }

        if (data) {
          setProfile(data)

          // Only redirect if we're on login/home pages to avoid infinite redirects
          const currentPath = window.location.pathname
          if (currentPath === "/" || currentPath === "/login") {
            redirectBasedOnRole(data)
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error)

        if (retryCount < MAX_RETRIES && !(error instanceof Error && error.message.includes("timeout"))) {
          console.log(`Retrying profile fetch... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
          return fetchUserProfile(userId, retryCount + 1)
        }

        const errorMessage = error instanceof Error ? error.message : "Failed to load user profile"
        setError(errorMessage)

        // Don't clear profile on network errors to prevent auth loops
        if (!(error instanceof Error && error.message.includes("network"))) {
          setProfile(null)
        }
      } finally {
        setLoading(false)
      }
    },
    [withTimeout, router],
  )

  const redirectBasedOnRole = useCallback(
    (profileData: UserProfile) => {
      if (profileData.status === "pending") {
        if (profileData.role === "driver") {
          router.push("/driver/pending")
        }
      } else if (profileData.status === "active") {
        switch (profileData.role) {
          case "super_admin":
            router.push("/super-admin")
            break
          case "admin":
            router.push("/admin/dashboard")
            break
          case "driver":
            router.push("/driver/orders")
            break
          default:
            router.push("/")
        }
      }
    },
    [router],
  )

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      setLoading(true)
      await fetchUserProfile(user.id)
    }
  }, [user?.id, fetchUserProfile])

  useEffect(() => {
    let mounted = true
    let authTimeout: NodeJS.Timeout

    const initializeAuth = async () => {
      try {
        setError(null)

        // Get initial session with timeout
        const sessionPromise = supabase.auth.getSession()
        const {
          data: { session },
          error: sessionError,
        } = await withTimeout(sessionPromise, AUTH_TIMEOUT)

        if (sessionError) {
          throw sessionError
        }

        if (!mounted) return

        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchUserProfile(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : "Authentication failed"
          setError(errorMessage)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes with debouncing and error handling
    let debounceTimeout: NodeJS.Timeout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log("Auth state change:", event, session?.user?.id)

      // Clear any pending timeout
      if (debounceTimeout) clearTimeout(debounceTimeout)
      if (authTimeout) clearTimeout(authTimeout)

      // Debounce auth state changes
      debounceTimeout = setTimeout(async () => {
        try {
          setError(null)
          setUser(session?.user ?? null)

          if (session?.user) {
            await fetchUserProfile(session.user.id)
          } else {
            setProfile(null)
            setLoading(false)
          }
        } catch (error) {
          console.error("Auth state change error:", error)
          if (mounted) {
            const errorMessage = error instanceof Error ? error.message : "Authentication state change failed"
            setError(errorMessage)
            setLoading(false)
          }
        }
      }, 100)

      // Set a timeout for the entire auth process
      authTimeout = setTimeout(() => {
        if (mounted && loading) {
          console.warn("Auth process timeout")
          setError("Authentication is taking longer than expected. Please refresh the page.")
          setLoading(false)
        }
      }, AUTH_TIMEOUT)
    })

    return () => {
      mounted = false
      if (debounceTimeout) clearTimeout(debounceTimeout)
      if (authTimeout) clearTimeout(authTimeout)
      subscription.unsubscribe()
    }
  }, [withTimeout, fetchUserProfile, loading])

  const signOut = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)

      const signOutPromise = supabase.auth.signOut()
      await withTimeout(signOutPromise, AUTH_TIMEOUT)

      setUser(null)
      setProfile(null)
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
      const errorMessage = error instanceof Error ? error.message : "Sign out failed"
      setError(errorMessage)

      // Force clear state even if signOut fails
      setUser(null)
      setProfile(null)
      router.push("/")
    } finally {
      setLoading(false)
    }
  }, [withTimeout, router])

  const contextValue: AuthContextType = {
    user,
    profile,
    loading,
    error,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
