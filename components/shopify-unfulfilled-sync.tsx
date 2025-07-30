"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { trpc } from "@/utils/trpc"

export function ShopifyUnfulfilledSync() {
  const { toast } = useToast()
  const syncUnfulfilledOrders = trpc.shopify.syncUnfulfilledOrders.useMutation({
    onSuccess: (result) => {
      if (result.data_source === "shopify_api") {
        toast({
          title: "✅ Unfulfilled Orders Synced",
          description: `Synced ${result.synced_count} unfulfilled orders and created ${result.delivery_orders_created} delivery orders`,
        })
      } else {
        toast({
          title: "❌ Sync Failed",
          description: "Unable to connect to Shopify API",
          variant: "destructive",
        })
      }
    },
    onError: (error) => {
      toast({
        title: "❌ Sync Failed",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopify Unfulfilled Orders Sync</CardTitle>
        <CardDescription>
          Sync only unfulfilled orders from your Shopify store and automatically create delivery orders ready for driver
          assignment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => syncUnfulfilledOrders.mutate()} disabled={syncUnfulfilledOrders.isLoading}>
          {syncUnfulfilledOrders.isLoading ? "Syncing..." : "Sync Now"}
        </Button>
      </CardContent>
      <CardFooter></CardFooter>
    </Card>
  )
}
