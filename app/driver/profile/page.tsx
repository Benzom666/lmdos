"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DriverDashboardLayout } from "@/components/driver-dashboard-layout"
import { supabase, type Driver } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { User, Truck, MapPin } from "lucide-react"
import DriverAvailabilityToggle from "@/components/driver-availability-toggle"

export default function DriverProfile() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [driverDetails, setDriverDetails] = useState<Driver | null>(null)
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  })
  const [vehicleForm, setVehicleForm] = useState({
    licenseNumber: "",
    vehiclePlate: "",
    vehicleModel: "",
  })

  useEffect(() => {
    if (profile) {
      fetchDriverDetails()
      setProfileForm({
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        phone: profile.phone || "",
        email: profile.email || "",
      })
    }
  }, [profile])

  const fetchDriverDetails = async () => {
    if (!profile?.user_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase.from("drivers").select("*").eq("id", profile.user_id).single()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      if (data) {
        setDriverDetails(data as Driver)
        setVehicleForm({
          licenseNumber: data.license_number || "",
          vehiclePlate: data.vehicle_plate || "",
          vehicleModel: data.vehicle_model || "",
        })
      }
    } catch (error) {
      console.error("Error fetching driver details:", error)
      toast({
        title: "Error",
        description: "Failed to load driver details. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async () => {
    if (!profile) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          first_name: profileForm.firstName,
          last_name: profileForm.lastName,
          phone: profileForm.phone,
        })
        .eq("id", profile.id)

      if (error) throw error

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleVehicleUpdate = async () => {
    if (!profile?.user_id) return

    setSaving(true)
    try {
      if (driverDetails) {
        const { error } = await supabase
          .from("drivers")
          .update({
            license_number: vehicleForm.licenseNumber,
            vehicle_plate: vehicleForm.vehiclePlate,
            vehicle_model: vehicleForm.vehicleModel,
          })
          .eq("id", profile.user_id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("drivers").insert({
          id: profile.user_id,
          license_number: vehicleForm.licenseNumber || "",
          vehicle_plate: vehicleForm.vehiclePlate || "",
          vehicle_model: vehicleForm.vehicleModel || "",
          is_active: false,
          availability_status: "offline",
        })

        if (error) {
          console.error("Error creating driver record:", error)
          throw error
        }
      }

      toast({
        title: "Vehicle Information Updated",
        description: "Your vehicle information has been updated successfully.",
      })

      fetchDriverDetails()
    } catch (error) {
      console.error("Error updating vehicle information:", error)
      toast({
        title: "Error",
        description: "Failed to update vehicle information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateLocation = async () => {
    if (!profile?.user_id || !navigator.geolocation) {
      toast({
        title: "Location Not Available",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive",
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords

          if (driverDetails) {
            const { error } = await supabase
              .from("drivers")
              .update({
                current_latitude: latitude,
                current_longitude: longitude,
                last_location_update: new Date().toISOString(),
              })
              .eq("id", profile.user_id)

            if (error) throw error
          } else {
            const { error: createError } = await supabase.from("drivers").insert({
              id: profile.user_id,
              license_number: vehicleForm.licenseNumber || "",
              vehicle_plate: vehicleForm.vehiclePlate || "",
              vehicle_model: vehicleForm.vehicleModel || "",
              is_active: false,
              availability_status: "offline",
              current_latitude: latitude,
              current_longitude: longitude,
              last_location_update: new Date().toISOString(),
            })

            if (createError) throw createError
          }

          toast({
            title: "Location Updated",
            description: "Your current location has been updated.",
          })

          fetchDriverDetails()
        } catch (error) {
          console.error("Error updating location:", error)
          toast({
            title: "Error",
            description: "Failed to update location. Please try again.",
            variant: "destructive",
          })
        }
      },
      (error) => {
        console.error("Geolocation error:", error)
        toast({
          title: "Location Error",
          description: "Failed to get your current location.",
          variant: "destructive",
        })
      },
    )
  }

  if (loading) {
    return (
      <DriverDashboardLayout title="Profile">
        <div className="text-center py-8">Loading profile...</div>
      </DriverDashboardLayout>
    )
  }

  return (
    <DriverDashboardLayout title="Profile">
      <div className="space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {profile?.admin_id ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Pending
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Account status</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vehicle</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {driverDetails?.is_active ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Vehicle status</p>
            </CardContent>
          </Card>
        </div>

        {/* Availability Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Availability</CardTitle>
            <CardDescription>Toggle your availability to receive new deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            <DriverAvailabilityToggle initialStatus={driverDetails?.availability_status || "offline"} />
          </CardContent>
        </Card>

        {/* Profile Tabs */}
        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Personal</TabsTrigger>
            <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profileForm.email} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </div>
                <Button onClick={handleProfileUpdate} disabled={saving} className="w-full">
                  {saving ? "Saving..." : "Update Profile"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicle" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Information</CardTitle>
                <CardDescription>Provide your vehicle details for delivery assignments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">Driver's License Number</Label>
                  <Input
                    id="licenseNumber"
                    value={vehicleForm.licenseNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, licenseNumber: e.target.value })}
                    placeholder="Enter your license number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehiclePlate">Vehicle Plate Number</Label>
                  <Input
                    id="vehiclePlate"
                    value={vehicleForm.vehiclePlate}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehiclePlate: e.target.value })}
                    placeholder="Enter your vehicle plate number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleModel">Vehicle Model</Label>
                  <Input
                    id="vehicleModel"
                    value={vehicleForm.vehicleModel}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleModel: e.target.value })}
                    placeholder="e.g., Toyota Camry 2020"
                  />
                </div>
                <Button onClick={handleVehicleUpdate} disabled={saving} className="w-full">
                  {saving ? "Saving..." : "Update Vehicle Information"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="location" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Location Services</CardTitle>
                <CardDescription>Update your current location for better order assignments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {driverDetails?.current_latitude && driverDetails?.current_longitude ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>Current Location:</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">Latitude: {driverDetails.current_latitude}</p>
                    <p className="text-sm text-muted-foreground">Longitude: {driverDetails.current_longitude}</p>
                    <p className="text-sm text-muted-foreground">
                      Last updated: {new Date(driverDetails.last_location_update || "").toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No location data available</p>
                )}
                <Button onClick={updateLocation} className="w-full">
                  <MapPin className="mr-2 h-4 w-4" />
                  Update Current Location
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DriverDashboardLayout>
  )
}
