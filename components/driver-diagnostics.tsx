"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react"

interface DiagnosticResult {
  test: string
  status: "success" | "error" | "warning"
  message: string
  details?: any
}

export function DriverDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    const diagnostics: DiagnosticResult[] = []

    try {
      // Test 1: Environment Variables
      diagnostics.push({
        test: "Environment Variables",
        status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "success" : "error",
        message: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Supabase URL found" : "Missing Supabase URL",
        details: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Present" : "✗ Missing",
          key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ Present" : "✗ Missing",
        },
      })

      // Test 2: Supabase Connection
      try {
        const { data, error } = await supabase.auth.getSession()
        diagnostics.push({
          test: "Supabase Connection",
          status: error ? "error" : "success",
          message: error ? `Connection failed: ${error.message}` : "Connection successful",
          details: { session: data.session ? "✓ Active" : "✗ No session" },
        })
      } catch (error) {
        diagnostics.push({
          test: "Supabase Connection",
          status: "error",
          message: `Connection error: ${error}`,
        })
      }

      // Test 3: User Authentication
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        diagnostics.push({
          test: "User Authentication",
          status: user ? "success" : "warning",
          message: user ? `Authenticated as ${user.email}` : "No authenticated user",
          details: { userId: user?.id || "None", email: user?.email || "None" },
        })

        // Test 4: User Profile Access
        if (user) {
          try {
            const { data: profile, error: profileError } = await supabase
              .from("user_profiles")
              .select("*")
              .eq("user_id", user.id)
              .single()

            diagnostics.push({
              test: "User Profile Access",
              status: profileError ? "error" : "success",
              message: profileError ? `Profile error: ${profileError.message}` : `Profile found: ${profile.role}`,
              details: profile || profileError,
            })

            // Test 5: Driver-specific Data Access
            if (profile?.role === "driver") {
              try {
                const { data: orders, error: ordersError } = await supabase
                  .from("orders")
                  .select("*")
                  .eq("driver_id", user.id)
                  .limit(1)

                diagnostics.push({
                  test: "Driver Orders Access",
                  status: ordersError ? "error" : "success",
                  message: ordersError
                    ? `Orders access failed: ${ordersError.message}`
                    : `Orders accessible (${orders?.length || 0} found)`,
                  details: ordersError || { orderCount: orders?.length || 0 },
                })
              } catch (error) {
                diagnostics.push({
                  test: "Driver Orders Access",
                  status: "error",
                  message: `Orders query failed: ${error}`,
                })
              }

              // Test 6: Driver Record Access
              try {
                const { data: driverRecord, error: driverError } = await supabase
                  .from("drivers")
                  .select("*")
                  .eq("id", user.id)
                  .single()

                diagnostics.push({
                  test: "Driver Record Access",
                  status: driverError ? "warning" : "success",
                  message: driverError ? `Driver record not found: ${driverError.message}` : "Driver record accessible",
                  details: driverRecord || driverError,
                })
              } catch (error) {
                diagnostics.push({
                  test: "Driver Record Access",
                  status: "error",
                  message: `Driver record query failed: ${error}`,
                })
              }
            }
          } catch (error) {
            diagnostics.push({
              test: "User Profile Access",
              status: "error",
              message: `Profile query failed: ${error}`,
            })
          }
        }
      } catch (error) {
        diagnostics.push({
          test: "User Authentication",
          status: "error",
          message: `Auth check failed: ${error}`,
        })
      }

      // Test 7: RLS Policies
      try {
        const { data: testQuery, error: rlsError } = await supabase.from("user_profiles").select("count").limit(1)

        diagnostics.push({
          test: "RLS Policies",
          status: rlsError ? "error" : "success",
          message: rlsError ? `RLS blocking access: ${rlsError.message}` : "RLS policies working",
          details: rlsError || "Access granted",
        })
      } catch (error) {
        diagnostics.push({
          test: "RLS Policies",
          status: "error",
          message: `RLS test failed: ${error}`,
        })
      }

      // Test 8: Network/CORS
      diagnostics.push({
        test: "Environment",
        status: "success",
        message: `Running in ${process.env.NODE_ENV || "unknown"} mode`,
        details: {
          userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "Server",
          origin: typeof window !== "undefined" ? window.location.origin : "Server",
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      diagnostics.push({
        test: "General Error",
        status: "error",
        message: `Unexpected error: ${error}`,
      })
    }

    setResults(diagnostics)
    setLoading(false)
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Driver Dashboard Diagnostics
          <Button variant="outline" size="sm" onClick={runDiagnostics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Running..." : "Refresh"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results.map((result, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                {getStatusIcon(result.status)}
                <h3 className="font-semibold">{result.test}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
              {result.details && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
