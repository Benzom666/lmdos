"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { supabase, type UserProfile } from "@/lib/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { MoreVertical } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function SuperAdminDriversPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState<UserProfile[]>([])
  const [admins, setAdmins] = useState<UserProfile[]>([])
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<UserProfile | null>(null)
  const [suspendingUser, setSuspendingUser] = useState(false)

  useEffect(() => {
    fetchDrivers()
    fetchAdmins()
  }, [])

  const fetchDrivers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "driver")
        .order("created_at", { ascending: false })

      if (error) throw error

      setDrivers(data as UserProfile[])
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

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase.from("user_profiles").select("*").eq("role", "admin")

      if (error) throw error

      setAdmins(data as UserProfile[])
    } catch (error) {
      console.error("Error fetching admins:", error)
    }
  }

  const handleSuspendUser = async () => {
    if (!selectedDriver) return

    setSuspendingUser(true)
    try {
      const response = await fetch("/api/suspend-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedDriver.user_id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to suspend user")
      }

      toast({
        title: "User Suspended",
        description: `${selectedDriver.email} has been suspended.`,
      })

      // Close dialog and refresh list
      setSuspendDialogOpen(false)
      setSelectedDriver(null)
      fetchDrivers()
    } catch (error) {
      console.error("Error suspending user:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to suspend user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSuspendingUser(false)
    }
  }

  const getAdminName = (adminId: string | null) => {
    if (!adminId) return "—"
    const admin = admins.find((a) => a.id === adminId)
    return admin ? `${admin.first_name} ${admin.last_name}` : "Unknown"
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">All Drivers</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Driver Users</CardTitle>
            <CardDescription>View and manage all drivers in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Loading drivers...</div>
            ) : drivers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No driver users found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">
                        {driver.first_name} {driver.last_name}
                      </TableCell>
                      <TableCell>{driver.email}</TableCell>
                      <TableCell>{driver.phone || "—"}</TableCell>
                      <TableCell>{getAdminName(driver.admin_id)}</TableCell>
                      <TableCell>
                        {driver.admin_id ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Pending
                          </Badge>
                        )}
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
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedDriver(driver)
                                setSuspendDialogOpen(true)
                              }}
                            >
                              Suspend User
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

        {/* Suspend User Dialog */}
        <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to suspend {selectedDriver?.email}? They will no longer be able to access the
                system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSuspendUser} disabled={suspendingUser}>
                {suspendingUser ? "Suspending..." : "Suspend User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
