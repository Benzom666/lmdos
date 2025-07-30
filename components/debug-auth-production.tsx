"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DebugAuthProduction() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const checkAuth = async () => {
    setIsLoading(true)
    try {
      // Check session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      // Check URL
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

      // Get debug info
      const info = {
        session: sessionData,
        sessionError: sessionError ? sessionError.message : null,
        supabaseUrl: supabaseUrl ? "Set" : "Not set",
        currentUrl: window.location.href,
        localStorage: localStorage.getItem("supabase.auth.token") ? "Auth token exists" : "No auth token",
        cookies: document.cookie,
      }

      setDebugInfo(info)
    } catch (error) {
      setDebugInfo({ error: error instanceof Error ? error.message : "Unknown error" })
    } finally {
      setIsLoading(false)
    }
  }

  if (!showDebug) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button variant="outline" size="sm" onClick={() => setShowDebug(true)}>
          Debug Auth
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex justify-between">
            <span>Auth Debugger</span>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowDebug(false)}>
              Close
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          <Button variant="outline" size="sm" onClick={checkAuth} disabled={isLoading} className="mb-2 w-full">
            {isLoading ? "Checking..." : "Check Auth Status"}
          </Button>

          {debugInfo && (
            <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
