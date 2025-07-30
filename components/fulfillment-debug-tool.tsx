"use client"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

const FulfillmentDebugTool = () => {
  return (
    <div>
      <Button variant="outline">Debug</Button>
      <Button variant="outline" onClick={() => window.location.reload()} className="ml-2">
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh Page
      </Button>
    </div>
  )
}

export default FulfillmentDebugTool
