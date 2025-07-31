"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

interface UserProfile {
  id: string
  user_id: string
  email: string
  first_name?: string
  last_name?: string
  role: "super_admin" | "admin" | "driver"
  phone?: string
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ data?: any; error?: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("user_profiles").select("*").eq("user_id", userId).single()

      if (error) {
        console.error("Error fetching user profile:", error)
        return null
      }

      return data
    } catch (error) {
      console.error("Error in fetchUserProfile:", error)
      return null
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("Sign in error:", error)
        return { error }
      }

      if (data.user) {
        setUser(data.user)
        const userProfile = await fetchUserProfile(data.user.id)
        setProfile(userProfile)
      }

      return { data, error: null }
    } catch (error) {
      console.error("Error in signIn:", error)
      return { error }
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get initial session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("Error getting session:", error)
          if (mounted) {
            setLoading(false)
            setInitialized(true)
          }
          return
        }

        if (session?.user && mounted) {
          setUser(session.user)
          const userProfile = await fetchUserProfile(session.user.id)
          if (mounted) {
            setProfile(userProfile)
          }
        }

        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initializeAuth()

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || !initialized) return

      console.log("Auth state changed:", event)

      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)
        const userProfile = await fetchUserProfile(session.user.id)
        if (mounted) {
          setProfile(userProfile)
        }
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Error signing out:", error)
        throw error
      }
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error("Error in signOut:", error)
      throw error
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
