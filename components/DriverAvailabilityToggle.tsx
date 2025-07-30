"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/components/ui/use-toast"

interface DriverAvailabilityToggleProps {
  initialStatus: string
}

export default function DriverAvailabilityToggle({ initialStatus }: DriverAvailabilityToggleProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [isOnline, setIsOnline] = useState(initialStatus === "online")
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggle = async (checked: boolean) => {
    if (!profile) return

    setIsUpdating(true)
    try {
      const newStatus = checked ? "online" : "offline"

      // First check if driver record exists
      const { data: existingDriver, error: fetchError } = await supabase
        .from("drivers")
        .select("id")
        .eq("id", profile.id)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError
      }

      if (existingDriver) {
        // Update existing driver record
        const { error } = await supabase.from("drivers").update({ availability_status: newStatus }).eq("id", profile.id)

        if (error) throw error
      } else {
        // Create new driver record
        const { error } = await supabase.from("drivers").insert({
          id: profile.id,
          license_number: "",
          vehicle_plate: "",
          vehicle_model: "",
          is_active: false,
          availability_status: newStatus,
        })

        if (error) throw error
      }

      setIsOnline(checked)
      toast({
        title: "Availability Updated",
        description: `You are now ${checked ? "online" : "offline"}`,
      })
    } catch (error) {
      console.error("Error updating availability:", error)
      toast({
        title: "Error",
        description: "Failed to update availability. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch id="availability" checked={isOnline} onCheckedChange={handleToggle} disabled={isUpdating} />
      <Label htmlFor="availability" className="text-sm">
        {isOnline ? "Online" : "Offline"}
      </Label>
    </div>
  )
}
