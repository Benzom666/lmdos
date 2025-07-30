"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface DiagnosticResult {
  category: string
  test: string
  status: "pass" | "fail" | "warning" | "pending"
  message: string
  details?: any
}

export function ComprehensiveDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  const addResult = (result: DiagnosticResult) => {
    setResults((prev) => [...prev, result])
  }

  const runComprehensiveDiagnostics = async () => {
    setIsRunning(true)
    setResults([])

    // 1. Environment Variables Check
    addResult({
      category: "Environment",
      test: "Supabase URL",
      status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "pass" : "fail",
      message: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Supabase URL is configured" : "Supabase URL is missing",
      details: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Present" : "Missing",
    })

    addResult({
      category: "Environment",
      test: "Supabase Anon Key",
      status: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "pass" : "fail",
      message: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Anon key is configured" : "Anon key is missing",
      details: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Present" : "Missing",
    })

    // 2. Network Connectivity
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      })

      addResult({
        category: "Network",
        test: "Supabase API Connectivity",
        status: response.ok ? "pass" : "fail",
        message: response.ok ? "Can connect to Supabase API" : `Failed to connect: ${response.status}`,
        details: { status: response.status, statusText: response.statusText },
      })
    } catch (error) {
      addResult({
        category: "Network",
        test: "Supabase API Connectivity",
        status: "fail",
        message: "Network error connecting to Supabase",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // 3. Authentication Service Check
    try {
      const { data, error } = await supabase.auth.getSession()
      addResult({
        category: "Authentication",
        test: "Auth Service",
        status: error ? "fail" : "pass",
        message: error ? `Auth service error: ${error.message}` : "Auth service is working",
        details: { session: data.session ? "Session exists" : "No session", error: error?.message },
      })
    } catch (error) {
      addResult({
        category: "Authentication",
        test: "Auth Service",
        status: "fail",
        message: "Failed to check auth service",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // 4. Database Connectivity
    try {
      const { data, error } = await supabase.from("user_profiles").select("count").limit(1)
      addResult({
        category: "Database",
        test: "Database Connectivity",
        status: error ? "fail" : "pass",
        message: error ? `Database error: ${error.message}` : "Database is accessible",
        details: { error: error?.message, data: data ? "Query successful" : "No data" },
      })
    } catch (error) {
      addResult({
        category: "Database",
        test: "Database Connectivity",
        status: "fail",
        message: "Failed to query database",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // 5. Super Admin Creation Test
    try {
      const response = await fetch("/api/create-super-admin")
      const data = await response.json()

      addResult({
        category: "API",
        test: "Super Admin API",
        status: response.ok ? "pass" : "fail",
        message: response.ok ? "Super admin API is working" : `API error: ${response.status}`,
        details: data,
      })
    } catch (error) {
      addResult({
        category: "API",
        test: "Super Admin API",
        status: "fail",
        message: "Failed to call super admin API",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // 6. Client-Side Configuration
    addResult({
      category: "Client",
      test: "Current URL",
      status: "pass",
      message: "Current application URL",
      details: window.location.href,
    })

    addResult({
      category: "Client",
      test: "Local Storage",
      status: "pass",
      message: "Auth token status",
      details: {
        hasAuthToken: !!localStorage.getItem("supabase.auth.token"),
        cookies: document.cookie.includes("supabase") ? "Supabase cookies present" : "No Supabase cookies",
      },
    })

    // 7. CORS Test
    try {
      const corsTest = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        method: "GET",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      })

      addResult({
        category: "CORS",
        test: "CORS Configuration",
        status: corsTest.ok ? "pass" : "warning",
        message: corsTest.ok ? "CORS is properly configured" : "Potential CORS issues",
        details: { status: corsTest.status },
      })
    } catch (error) {
      addResult({
        category: "CORS",
        test: "CORS Configuration",
        status: "fail",
        message: "CORS test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    setIsRunning(false)
  }

  const testLogin = async () => {
    setIsRunning(true)

    try {
      // Test the actual login flow
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "super.admin@delivery-system.com",
        password: "superadmin123",
      })

      addResult({
        category: "Login Test",
        test: "Super Admin Login",
        status: error ? "fail" : "pass",
        message: error ? `Login failed: ${error.message}` : "Login successful",
        details: {
          user: data.user ? "User created" : "No user",
          session: data.session ? "Session created" : "No session",
          error: error?.message,
        },
      })

      if (data.user) {
        // Test profile fetch
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", data.user.id)
          .single()

        addResult({
          category: "Login Test",
          test: "Profile Fetch",
          status: profileError ? "fail" : "pass",
          message: profileError ? `Profile fetch failed: ${profileError.message}` : "Profile fetched successfully",
          details: { profile: profile ? "Profile exists" : "No profile", error: profileError?.message },
        })
      }
    } catch (error) {
      addResult({
        category: "Login Test",
        test: "Super Admin Login",
        status: "fail",
        message: "Login test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    setIsRunning(false)
  }

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "fail":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />
    }
  }

  const getStatusBadge = (status: DiagnosticResult["status"]) => {
    const variants = {
      pass: "default",
      fail: "destructive",
      warning: "secondary",
      pending: "outline",
    } as const

    return (
      <Badge variant={variants[status]} className="ml-2">
        {status.toUpperCase()}
      </Badge>
    )
  }

  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = []
      }
      acc[result.category].push(result)
      return acc
    },
    {} as Record<string, DiagnosticResult[]>,
  )

  if (!showDiagnostics) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button variant="outline" onClick={() => setShowDiagnostics(true)}>
          🔍 Run Diagnostics
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-4 z-50 bg-white border rounded-lg shadow-lg overflow-auto">
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>🔍 Comprehensive Login Diagnostics</CardTitle>
          <Button variant="ghost" onClick={() => setShowDiagnostics(false)}>
            Close
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runComprehensiveDiagnostics} disabled={isRunning} className="flex items-center gap-2">
                {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
                Run Full Diagnostics
              </Button>
              <Button onClick={testLogin} disabled={isRunning} variant="outline" className="flex items-center gap-2">
                {isRunning && <Loader2 className="h-4 w-4 animate-spin" />}
                Test Login Flow
              </Button>
            </div>

            {results.length > 0 && (
              <Tabs defaultValue={Object.keys(groupedResults)[0]} className="w-full">
                <TabsList className="grid w-full grid-cols-auto">
                  {Object.keys(groupedResults).map((category) => (
                    <TabsTrigger key={category} value={category}>
                      {category}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(groupedResults).map(([category, categoryResults]) => (
                  <TabsContent key={category} value={category} className="space-y-2">
                    {categoryResults.map((result, index) => (
                      <div key={index} className="border rounded p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="font-medium">{result.test}</span>
                            {getStatusBadge(result.status)}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                        {result.details && (
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
