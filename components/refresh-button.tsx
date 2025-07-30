"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function RefreshButton() {
  return (
    <Button variant="outline" onClick={() => window.location.reload()} className="ml-2">
      <RefreshCw className="mr-2 h-4 w-4" />
      Refresh Connection Data
    </Button>
  )
}
