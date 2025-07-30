"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { useState } from "react"

type DataSourceResult = {
  data_source: "shopify_api" | "demo_data" | null
  synced_count: number
  error_count: number
}

export function ShopifyOrderSync() {
  const [loading, setLoading] = useState(false)

  const syncShopifyOrders = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/sync-shopify-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: DataSourceResult = await response.json()

      if (result.data_source === "shopify_api") {
        toast({
          title: "✅ Orders Synced Successfully",
          description: `Synced ${result.synced_count} real orders from Shopify${result.error_count > 0 ? ` (${result.error_count} errors)` : ""}`,
        })
      } else {
        toast({
          title: "❌ Sync Failed",
          description: "Unable to connect to Shopify API",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to sync orders:", error)
      toast({
        title: "❌ Sync Failed",
        description: "Failed to sync orders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopify Order Sync</CardTitle>
        <CardDescription>
          Sync orders from your Shopify store. Only real orders from your connected Shopify store will be imported.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled={loading} onClick={syncShopifyOrders}>
          {loading ? "Syncing..." : "Sync Orders"}
        </Button>
      </CardContent>
    </Card>
  )
}
