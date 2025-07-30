"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Key, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

interface TokenUpdateResult {
  success: boolean
  message: string
  test_error?: string
  connection?: any
}

export function ShopifyTokenUpdater({ connectionId, shopDomain }: { connectionId: string; shopDomain: string }) {
  const [accessToken, setAccessToken] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [result, setResult] = useState<TokenUpdateResult | null>(null)

  const updateToken = async () => {
    if (!accessToken.trim()) {
      alert("Please enter an access token")
      return
    }

    if (!accessToken.startsWith("shpat_")) {
      alert("Access token must start with 'shpat_'")
      return
    }

    setIsUpdating(true)
    setResult(null)

    try {
      const response = await fetch(`/api/integrations/shopify/${connectionId}/update-token`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        setAccessToken("") // Clear the token input for security
      }
    } catch (error) {
      console.error("Token update error:", error)
      setResult({
        success: false,
        message: "Failed to update access token",
        test_error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Update Shopify Access Token
          </CardTitle>
          <CardDescription>
            Add or update the access token for your Shopify connection: <strong>{shopDomain}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessToken">Shopify Access Token *</Label>
            <Input
              id="accessToken"
              type="password"
              placeholder="shpat_..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Your access token should start with "shpat_" and be obtained from your Shopify private app
            </p>
          </div>

          <Button onClick={updateToken} disabled={isUpdating || !accessToken.trim()}>
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Update Access Token
              </>
            )}
          </Button>

          {result && (
            <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription>
                  <strong>{result.message}</strong>
                  {result.test_error && (
                    <div className="mt-1 text-sm">
                      <strong>Test Error:</strong> {result.test_error}
                    </div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How to Get Your Shopify Access Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">1</Badge>
              <span>Go to your Shopify admin → Apps → App and sales channel settings</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">2</Badge>
              <span>Click "Develop apps" → "Create an app"</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">3</Badge>
              <span>
                Configure API scopes: Orders (read/write), Products (read), Customers (read), Fulfillments (read/write)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">4</Badge>
              <span>Install the app and copy the "Admin API access token"</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">5</Badge>
              <span>Paste the token (starts with "shpat_") in the field above</span>
            </div>
          </div>

          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-800">
              <strong>Important:</strong> Make sure your Shopify app has the required permissions: Orders (read/write),
              Products (read), Customers (read), and Fulfillments (read/write)
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
