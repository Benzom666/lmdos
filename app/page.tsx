"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Eye, EyeOff, Truck, Zap, Shield, ArrowRight, ChevronLeft, Settings } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("admin")
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [firstName, setFirstName] = useState<string>("")
  const [lastName, setLastName] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignup, setShowSignup] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [keepLoggedIn, setKeepLoggedIn] = useState<boolean>(false)

  // Super Admin mode state
  const [superAdminOpen, setSuperAdminOpen] = useState<boolean>(false)
  const [superAdminUsername, setSuperAdminUsername] = useState<string>("")
  const [superAdminPassword, setSuperAdminPassword] = useState<string>("")
  const [showSuperAdminPassword, setShowSuperAdminPassword] = useState<boolean>(false)
  const [superAdminLoading, setSuperAdminLoading] = useState<boolean>(false)
  const [superAdminError, setSuperAdminError] = useState<string | null>(null)

  // Animation states
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSuperAdminLogin = async () => {
    setSuperAdminError(null)
    setSuperAdminLoading(true)

    try {
      console.log("🔧 Super Admin: Attempting login...")

      if (!superAdminUsername || !superAdminPassword) {
        setSuperAdminError("Username and password are required")
        return
      }

      // Check for super admin credentials
      const superAdminEmail = "super.admin@delivery-system.com"
      const expectedPassword = "superadmin123"

      if (superAdminUsername !== "superadmin" || superAdminPassword !== expectedPassword) {
        setSuperAdminError("Invalid super admin credentials")
        return
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: superAdminEmail,
        password: expectedPassword,
      })

      if (signInError) {
        console.log("🔧 Creating super admin account...")

        try {
          const createResponse = await fetch("/api/create-super-admin")
          const createData = await createResponse.json()

          if (!createResponse.ok) {
            throw new Error(createData.error || "Failed to create super admin account")
          }

          console.log("✅ Super admin account created, attempting login...")

          const { data: retryData, error: retrySignInError } = await supabase.auth.signInWithPassword({
            email: superAdminEmail,
            password: expectedPassword,
          })

          if (retrySignInError) {
            throw new Error(retrySignInError.message || "Failed to sign in after account creation")
          }

          if (retryData.user) {
            console.log("✅ Super admin login successful after creation")
            window.location.href = "/super-admin"
            return
          }
        } catch (createError) {
          console.error("Failed to create super admin:", createError)
          throw new Error("Failed to create super admin account")
        }
      }

      if (data.user) {
        console.log("✅ Authentication successful, checking role...")

        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", data.user.id)
          .single()

        if (profileError) {
          console.error("Profile fetch error:", profileError)
          console.log("🔧 Creating super admin profile...")

          const { error: insertError } = await supabase.from("user_profiles").insert({
            user_id: data.user.id,
            email: superAdminEmail,
            first_name: "Super",
            last_name: "Admin",
            role: "super_admin",
          })

          if (insertError) {
            console.error("Failed to create profile:", insertError)
            throw new Error("Failed to create super admin profile")
          }

          console.log("✅ Super admin profile created, redirecting...")
          window.location.href = "/super-admin"
          return
        }

        if (profileData) {
          console.log("Profile data:", profileData)

          if (profileData.role === "super_admin") {
            console.log("✅ Super admin access granted")
            window.location.href = "/super-admin"
          } else {
            throw new Error("Invalid user role for super admin access")
          }
        } else {
          throw new Error("No profile data found")
        }
      }
    } catch (err) {
      console.error("❌ Super admin login error:", err)
      setSuperAdminError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setSuperAdminLoading(false)
    }
  }

  const handleSignIn = async (role: string) => {
    setError(null)
    setIsLoading(true)

    try {
      if (!email || !password) {
        setError("Email and password are required")
        return
      }

      console.log("🔐 Attempting sign in:", email)

      // Configure session persistence based on "Keep me logged in" checkbox
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          // Use 'local' for persistent login, 'session' for session-only
          persistSession: keepLoggedIn ? "local" : "session",
        },
      })

      if (signInError) {
        setError(signInError.message || "Failed to sign in")
        return
      }

      if (data.user) {
        console.log("✅ Sign in successful")

        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", data.user.id)
          .single()

        if (profileData) {
          const dashboardPath =
            profileData.role === "admin" ? "/admin/dashboard" : profileData.role === "driver" ? "/driver/orders" : "/"

          window.location.href = dashboardPath
        } else {
          const dashboardPath = role === "admin" ? "/admin/dashboard" : role === "driver" ? "/driver/orders" : "/"
          window.location.href = dashboardPath
        }
      }
    } catch (err) {
      console.error("❌ Sign in error:", err)
      setError("An unexpected error occurred during sign in")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (role: string) => {
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!email || !password || !firstName) {
      setError("Email, password, and first name are required")
      return
    }

    setIsLoading(true)

    try {
      console.log("📝 Attempting sign up:", email, role)

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            first_name: firstName,
            last_name: lastName,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message || "Failed to sign up")
        return
      }

      if (data.user) {
        const { error: profileError } = await supabase.from("user_profiles").insert({
          user_id: data.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          role: role,
        })

        if (profileError) {
          console.error("Profile creation error:", profileError)
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message || "Account created but failed to sign in")
          return
        }

        if (signInData.user) {
          console.log("✅ Sign up and sign in successful")
          const dashboardPath = role === "admin" ? "/admin/dashboard" : role === "driver" ? "/driver/orders" : "/"
          window.location.href = dashboardPath
        }
      }
    } catch (err) {
      console.error("❌ Sign up error:", err)
      setError("An unexpected error occurred during sign up")
    } finally {
      setIsLoading(false)
    }
  }

  const clearForm = () => {
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setFirstName("")
    setLastName("")
    setKeepLoggedIn(false)
    setError(null)
  }

  const clearSuperAdminForm = () => {
    setSuperAdminUsername("")
    setSuperAdminPassword("")
    setSuperAdminError(null)
    setShowSuperAdminPassword(false)
  }

  const switchToSignup = () => {
    setShowSignup(true)
    clearForm()
  }

  const switchToLogin = () => {
    setShowSignup(false)
    clearForm()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 dark:from-slate-950 dark:via-purple-950 dark:to-slate-950 relative overflow-hidden">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 left-4 z-20">
        <ThemeToggle />
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 dark:bg-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 dark:bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-400/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      {/* Prominent Super Admin Access Button */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          onClick={() => {
            setSuperAdminOpen(true)
            clearSuperAdminForm()
          }}
          variant="outline"
          size="sm"
          className="bg-red-600/10 border-red-500/30 text-red-400 hover:bg-red-600/20 hover:border-red-400/50 hover:text-red-300 dark:bg-red-600/5 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-600/10 transition-all duration-300"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div
          className={`w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <Truck className="w-12 h-12 text-cyan-400 dark:text-cyan-300" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 dark:bg-purple-400 rounded-full animate-ping"></div>
              </div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 dark:from-cyan-300 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent mb-2">
              DeliveryOS
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-light tracking-wide">
              Next-generation delivery management
            </p>
          </div>

          {/* Main Card */}
          <Card className="bg-slate-800/50 dark:bg-slate-900/50 backdrop-blur-xl border-slate-700/50 dark:border-slate-600/50 shadow-2xl">
            <CardContent className="p-8">
              {/* Role Selector */}
              <div className="flex mb-8 bg-slate-900/50 dark:bg-slate-950/50 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                    activeTab === "admin"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 text-white shadow-lg"
                      : "text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-300"
                  }`}
                >
                  <Shield className="w-4 h-4 inline mr-2" />
                  Admin
                </button>
                <button
                  onClick={() => setActiveTab("driver")}
                  className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                    activeTab === "driver"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500 dark:to-blue-500 text-white shadow-lg"
                      : "text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-300"
                  }`}
                >
                  <Zap className="w-4 h-4 inline mr-2" />
                  Driver
                </button>
              </div>

              {!showSignup ? (
                // Login Form
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-white dark:text-slate-100 mb-2">Welcome Back</h2>
                    <p className="text-slate-400 dark:text-slate-500 text-sm">Sign in to your account</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="bg-slate-900/50 dark:bg-slate-950/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-cyan-400/20 dark:focus:ring-cyan-500/20 h-12"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="bg-slate-900/50 dark:bg-slate-950/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-cyan-400/20 dark:focus:ring-cyan-500/20 h-12 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      id="keep-logged-in"
                      type="checkbox"
                      checked={keepLoggedIn}
                      onChange={(e) => setKeepLoggedIn(e.target.checked)}
                      className="w-4 h-4 text-cyan-600 bg-slate-900/50 border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <Label
                      htmlFor="keep-logged-in"
                      className="text-slate-300 dark:text-slate-400 text-sm font-medium cursor-pointer"
                    >
                      Keep me logged in
                    </Label>
                  </div>

                  <Button
                    onClick={() => handleSignIn(activeTab)}
                    disabled={isLoading}
                    className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500 dark:to-blue-500 hover:from-cyan-700 hover:to-blue-700 dark:hover:from-cyan-600 dark:hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="w-5 h-5 mr-2" />
                    )}
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>

                  <div className="text-center">
                    <button
                      onClick={switchToSignup}
                      className="text-slate-400 dark:text-slate-500 hover:text-cyan-400 dark:hover:text-cyan-300 text-sm transition-colors duration-300"
                    >
                      Don't have an account? <span className="font-medium">Create one</span>
                    </button>
                  </div>
                </div>
              ) : (
                // Signup Form
                <div className="space-y-6">
                  <div className="flex items-center mb-4">
                    <button
                      onClick={switchToLogin}
                      className="text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-300 transition-colors mr-3"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-2xl font-bold text-white dark:text-slate-100">Create Account</h2>
                      <p className="text-slate-400 dark:text-slate-500 text-sm">Join the delivery network</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                        First Name *
                      </Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="bg-slate-900/50 dark:bg-slate-950/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-cyan-400/20 dark:focus:ring-cyan-500/20 h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="bg-slate-900/50 dark:bg-slate-950/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-cyan-400/20 dark:focus:ring-cyan-500/20 h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signupEmail" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                      Email Address *
                    </Label>
                    <Input
                      id="signupEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="bg-slate-900/50 dark:bg-slate-950/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-cyan-400/20 dark:focus:ring-cyan-500/20 h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signupPassword" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                      Password *
                    </Label>
                    <Input
                      id="signupPassword"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="bg-slate-900/50 dark:bg-slate-950/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-cyan-400/20 dark:focus:ring-cyan-500/20 h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                      Confirm Password *
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="bg-slate-900/50 dark:bg-slate-950/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-cyan-400 dark:focus:border-cyan-500 focus:ring-cyan-400/20 dark:focus:ring-cyan-500/20 h-12"
                    />
                  </div>

                  <Button
                    onClick={() => handleSignUp(activeTab)}
                    disabled={isLoading}
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 hover:from-purple-700 hover:to-pink-700 dark:hover:from-purple-600 dark:hover:to-pink-600 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="w-5 h-5 mr-2" />
                    )}
                    {isLoading ? "Creating Account..." : `Create ${activeTab === "admin" ? "Admin" : "Driver"} Account`}
                  </Button>

                  <div className="text-center">
                    <button
                      onClick={switchToLogin}
                      className="text-slate-400 dark:text-slate-500 hover:text-cyan-400 dark:hover:text-cyan-300 text-sm transition-colors duration-300"
                    >
                      Already have an account? <span className="font-medium">Sign in</span>
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 dark:bg-red-500/5 border border-red-500/20 dark:border-red-500/10 rounded-lg">
                  <p className="text-red-400 dark:text-red-300 text-sm text-center">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Features */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div className="text-slate-400 dark:text-slate-500">
              <Shield className="w-6 h-6 mx-auto mb-2 text-cyan-400 dark:text-cyan-300" />
              <p className="text-xs">Secure</p>
            </div>
            <div className="text-slate-400 dark:text-slate-500">
              <Zap className="w-6 h-6 mx-auto mb-2 text-purple-400 dark:text-purple-300" />
              <p className="text-xs">Fast</p>
            </div>
            <div className="text-slate-400 dark:text-slate-500">
              <Truck className="w-6 h-6 mx-auto mb-2 text-pink-400 dark:text-pink-300" />
              <p className="text-xs">Reliable</p>
            </div>
          </div>

          {/* API Documentation Link */}
          <div className="mt-6 text-center">
            <a
              href="/api-docs"
              className="inline-flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-cyan-400 dark:hover:text-cyan-300 text-sm transition-colors duration-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              API Integration Documentation
            </a>
          </div>
        </div>
      </div>

      {/* Super Admin Login Dialog */}
      <Dialog open={superAdminOpen} onOpenChange={setSuperAdminOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border-red-700/50 dark:border-red-600/30 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white dark:text-slate-100">
              <div className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full animate-pulse"></div>
              System Administration
            </DialogTitle>
            <DialogDescription className="text-slate-400 dark:text-slate-500">
              Restricted access. Authorized personnel only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="super-admin-username" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                Username
              </Label>
              <Input
                id="super-admin-username"
                type="text"
                value={superAdminUsername}
                onChange={(e) => setSuperAdminUsername(e.target.value)}
                placeholder="Enter username"
                disabled={superAdminLoading}
                className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-red-400 dark:focus:border-red-500 focus:ring-red-400/20 dark:focus:ring-red-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="super-admin-password" className="text-slate-300 dark:text-slate-400 text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="super-admin-password"
                  type={showSuperAdminPassword ? "text" : "password"}
                  value={superAdminPassword}
                  onChange={(e) => setSuperAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={superAdminLoading}
                  className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-600 dark:border-slate-700 text-white dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-red-400 dark:focus:border-red-500 focus:ring-red-400/20 dark:focus:ring-red-500/20 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowSuperAdminPassword(!showSuperAdminPassword)}
                  disabled={superAdminLoading}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-300 transition-colors"
                >
                  {showSuperAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {superAdminError && (
              <div className="p-3 bg-red-500/10 dark:bg-red-500/5 border border-red-500/20 dark:border-red-500/10 rounded-lg">
                <p className="text-sm text-red-400 dark:text-red-300">{superAdminError}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSuperAdminLogin}
                disabled={superAdminLoading || !superAdminUsername || !superAdminPassword}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-700 dark:from-red-500 dark:to-red-600 hover:from-red-700 hover:to-red-800 dark:hover:from-red-600 dark:hover:to-red-700 text-white font-medium"
              >
                {superAdminLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Access System"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuperAdminOpen(false)
                  clearSuperAdminForm()
                }}
                disabled={superAdminLoading}
                className="border-slate-600 dark:border-slate-700 text-slate-300 dark:text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white dark:hover:text-slate-200"
              >
                Cancel
              </Button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-600 text-center pt-2 border-t border-slate-700 dark:border-slate-800">
              All access attempts are monitored and logged.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
