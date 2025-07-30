"use client"

import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DebugAuth() {
  const { user, profile, session, loading } = useAuth()

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 max-h-96 overflow-auto z-50">
      <CardHeader>
        <CardTitle className="text-sm">Debug Auth State</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <strong>Loading:</strong> {loading ? "true" : "false"}
        </div>
        <div>
          <strong>User ID:</strong> {user?.id || "null"}
        </div>
        <div>
          <strong>User Email:</strong> {user?.email || "null"}
        </div>
        <div>
          <strong>Session:</strong> {session ? "exists" : "null"}
        </div>
        <div>
          <strong>Profile ID:</strong> {profile?.id || "null"}
        </div>
        <div>
          <strong>Profile Role:</strong> {profile?.role || "null"}
        </div>
        <div>
          <strong>Profile Name:</strong> {profile ? `${profile.first_name} ${profile.last_name}` : "null"}
        </div>
      </CardContent>
    </Card>
  )
}
