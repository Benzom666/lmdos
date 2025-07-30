"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase, type UserProfile } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Check, MoreVertical, Send, UserPlus, X, Mail } from "lucide-react"
import { InvitationSystem } from "@/components/invitation-system"

export default function AdminDriversPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pendingDrivers, setPendingDrivers] = useState<UserProfile[]>([])
  const [activeDrivers, setActiveDrivers] = useState<UserProfile[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [invitePhone, setInvitePhone] = useState("")
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)

  useEffect(() => {
    if (profile) {
      fetchDrivers()
    }
  }, [profile])

  const fetchDrivers = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // Fetch pending drivers (those without an admin_id)
      const { data: pendingData, error: pendingError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .is("admin_id", null)

      if (pendingError) throw pendingError

      // Fetch active drivers assigned to this admin
      const { data: activeData, error: activeError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .eq("admin_id", profile.user_id)

      if (activeError) throw activeError

      setPendingDrivers(pendingData as UserProfile[])
      setActiveDrivers(activeData as UserProfile[])
    } catch (error) {
      console.error("Error fetching drivers:", error)
      toast({
        title: "Error",
        description: "Failed to load drivers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const approveDriver = async (driverId: string) => {
    if (!profile) return

    try {
      const { error } = await supabase.from("user_profiles").update({ admin_id: profile.user_id }).eq("id", driverId)

      if (error) throw error

      toast({
        title: "Driver Approved",
        description: "The driver has been approved and assigned to you.",
      })

      // Refresh the driver lists
      fetchDrivers()
    } catch (error) {
      console.error("Error approving driver:", error)
      toast({
        title: "Error",
        description: "Failed to approve driver. Please try again.",
        variant: "destructive",
      })
    }
  }

  const rejectDriver = async (driverId: string) => {
    try {
      // Get the user_id for this driver profile
      const { data: driverData, error: fetchError } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("id", driverId)
        .single()

      if (fetchError) throw fetchError

      // Delete the user profile
      const { error: deleteProfileError } = await supabase.from("user_profiles").delete().eq("id", driverId)

      if (deleteProfileError) throw deleteProfileError

      // Delete the auth user (requires admin privileges)
      const { error: deleteUserError } = await fetch(`/api/delete-user?userId=${driverData.user_id}`, {
        method: "DELETE",
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to delete user")
        return res.json()
      })

      if (deleteUserError) throw deleteUserError

      toast({
        title: "Driver Rejected",
        description: "The driver has been rejected and removed from the system.",
      })

      // Refresh the driver lists
      fetchDrivers()
    } catch (error) {
      console.error("Error rejecting driver:", error)
      toast({
        title: "Error",
        description: "Failed to reject driver. Please try again.",
        variant: "destructive",
      })
    }
  }

  const sendInvite = async () => {
    if (!profile) return
    if (!inviteEmail || !inviteFirstName) {
      toast({
        title: "Missing Information",
        description: "Email and first name are required.",
        variant: "destructive",
      })
      return
    }

    setSendingInvite(true)
    try {
      // Generate a random password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)

      // Create the user with the Supabase Auth API via our server endpoint
      const createUserResponse = await fetch("/api/create-driver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail,
          password: tempPassword,
          firstName: inviteFirstName,
          lastName: inviteLastName,
          phone: invitePhone,
          adminId: profile.user_id,
        }),
      })

      if (!createUserResponse.ok) {
        const errorData = await createUserResponse.json()
        throw new Error(errorData.error || "Failed to create driver")
      }

      const userData = await createUserResponse.json()

      toast({
        title: "Invitation Sent",
        description: `Driver account created for ${inviteEmail}. They will receive an email with login instructions.`,
      })

      // Reset form and close dialog
      setInviteEmail("")
      setInviteFirstName("")
      setInviteLastName("")
      setInvitePhone("")
      setInviteDialogOpen(false)

      // Refresh the driver lists
      fetchDrivers()
    } catch (error) {
      console.error("Error inviting driver:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to invite driver. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSendingInvite(false)
    }
  }

  const removeDriver = async (driverId: string) => {
    try {
      // Just remove the admin_id to unassign the driver
      const { error } = await supabase.from("user_profiles").update({ admin_id: null }).eq("id", driverId)

      if (error) throw error

      toast({
        title: "Driver Removed",
        description: "The driver has been removed from your team.",
      })

      // Refresh the driver lists
      fetchDrivers()
    } catch (error) {
      console.error("Error removing driver:", error)
      toast({
        title: "Error",
        description: "Failed to remove driver. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Manage Drivers</h1>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Driver
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Driver</DialogTitle>
                <DialogDescription>
                  Create an account for a new driver. They will receive an email with login instructions.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={sendInvite} disabled={sendingInvite}>
                  {sendingInvite ? (
                    <>Creating...</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Create Driver
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Your Drivers ({loading ? "..." : activeDrivers.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending Approval ({loading ? "..." : pendingDrivers.length})</TabsTrigger>
            <TabsTrigger value="invitations">Invitation System</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Drivers</CardTitle>
                <CardDescription>Drivers assigned to your team who can receive order assignments.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Loading drivers...</div>
                ) : activeDrivers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="mx-auto h-12 w-12 mb-4" />
                    <p className="text-lg font-medium mb-2">No drivers assigned to your team</p>
                    <p className="text-sm mb-4">
                      Use the Invitation System to invite existing drivers or create new driver accounts.
                    </p>
                    <Button onClick={() => document.querySelector('[value="invitations"]')?.click()}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Manage Invitations
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeDrivers.map((driver) => (
                        <TableRow key={driver.id}>
                          <TableCell className="font-medium">
                            {driver.first_name} {driver.last_name}
                          </TableCell>
                          <TableCell>{driver.email}</TableCell>
                          <TableCell>{driver.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Active
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push(`/admin/drivers/${driver.id}`)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => removeDriver(driver.id)}>
                                  Remove from Team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Drivers</CardTitle>
                <CardDescription>Drivers waiting for approval to join your team.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Loading pending drivers...</div>
                ) : pendingDrivers.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No pending driver requests.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingDrivers.map((driver) => (
                        <TableRow key={driver.id}>
                          <TableCell className="font-medium">
                            {driver.first_name} {driver.last_name}
                          </TableCell>
                          <TableCell>{driver.email}</TableCell>
                          <TableCell>{driver.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Pending
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => approveDriver(driver.id)}
                                title="Approve"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                                <span className="sr-only">Approve</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => rejectDriver(driver.id)}
                                title="Reject"
                              >
                                <X className="h-4 w-4 text-red-600" />
                                <span className="sr-only">Reject</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="mt-4">
            <InvitationSystem />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
