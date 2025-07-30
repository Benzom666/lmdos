"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
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
  Mail,
  Send,
  Check,
  X,
  Clock,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Plus,
  Users,
  MessageSquare,
  Calendar,
  User,
} from "lucide-react"

interface Invitation {
  id: string
  type: string
  inviter_email: string
  target_email: string
  message: string | null
  status: string
  created_at: string
  responded_at: string | null
}

export default function DriverInvitationsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [sendInviteOpen, setSendInviteOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    adminEmail: "",
    message: "",
  })

  const fetchInvitations = async (retryCount = 0) => {
    if (!profile?.user_id) return

    try {
      setLoading(true)

      // Add delay for rate limiting
      if (retryCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
      }

      const response = await fetch(`/api/invitations?userId=${profile.user_id}`, {
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error:", errorText)

        // Handle rate limiting
        if (response.status === 429 && retryCount < 3) {
          console.log(`Rate limited, retrying... (attempt ${retryCount + 1})`)
          return fetchInvitations(retryCount + 1)
        }

        throw new Error(`Failed to fetch invitations: ${response.status}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format")
      }

      const data = await response.json()
      setInvitations(data.invitations || [])
    } catch (error) {
      console.error("Error fetching invitations:", error)

      if (retryCount < 2) {
        console.log(`Retrying fetch... (attempt ${retryCount + 1})`)
        setTimeout(() => fetchInvitations(retryCount + 1), 2000)
        return
      }

      toast({
        title: "Connection Error",
        description: "Unable to load invitations. Please check your connection and try again.",
        variant: "destructive",
      })
      setInvitations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    if (profile?.user_id && mounted) {
      fetchInvitations()
    }

    return () => {
      mounted = false
    }
  }, [profile?.user_id])

  const sendInvitation = async () => {
    if (!profile?.user_id || !inviteForm.adminEmail) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "driver_to_admin",
          email: inviteForm.adminEmail,
          inviterUserId: profile.user_id,
          message: inviteForm.message || null,
        }),
      })

      if (!response.ok) {
        const contentType = response.headers.get("content-type")
        let errorMessage = "Failed to send invitation"

        if (contentType && contentType.includes("application/json")) {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } else {
          const errorText = await response.text()
          console.error("Non-JSON error response:", errorText)
        }

        throw new Error(errorMessage)
      }

      toast({
        title: "Request Sent Successfully",
        description: `Your request has been sent to ${inviteForm.adminEmail}. You'll be notified when they respond.`,
      })

      setInviteForm({ adminEmail: "", message: "" })
      setSendInviteOpen(false)
      fetchInvitations()
    } catch (error) {
      console.error("Error sending invitation:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const respondToInvitation = async (invitationId: string, action: "accept" | "reject") => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${action} invitation`)
      }

      toast({
        title: `Invitation ${action === "accept" ? "Accepted" : "Rejected"}`,
        description: `You have ${action === "accept" ? "accepted" : "rejected"} the invitation.`,
      })

      fetchInvitations()
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} invitation`,
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        variant: "outline" as const,
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock,
        label: "Pending",
      },
      accepted: {
        variant: "outline" as const,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle,
        label: "Accepted",
      },
      rejected: {
        variant: "outline" as const,
        className: "bg-red-50 text-red-700 border-red-200",
        icon: X,
        label: "Rejected",
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "outline" as const,
      className: "bg-gray-50 text-gray-700 border-gray-200",
      icon: AlertCircle,
      label: status,
    }

    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const sentInvitations = invitations.filter((inv) => inv.type === "driver_to_admin")
  const receivedInvitations = invitations.filter((inv) => inv.type === "admin_to_driver")

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Invitations</h1>
            <p className="text-muted-foreground mt-1">Connect with admins and manage your team assignments</p>
          </div>
          <Dialog open={sendInviteOpen} onOpenChange={setSendInviteOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                Request Team Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Request Team Assignment
                </DialogTitle>
                <DialogDescription>Send a request to an admin to join their delivery team</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Email Address *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={inviteForm.adminEmail}
                    onChange={(e) => setInviteForm({ ...inviteForm, adminEmail: e.target.value })}
                    placeholder="admin@company.com"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (Optional)</Label>
                  <Textarea
                    id="message"
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    placeholder="Hi, I'm interested in joining your delivery team. I have experience with..."
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add a personal message to increase your chances of acceptance
                  </p>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSendInviteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={sendInvitation}
                  disabled={!inviteForm.adminEmail || submitting}
                  className="min-w-[100px]"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Request
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Status Alert */}
        {!profile?.admin_id && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900">Ready to Start Delivering?</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    You're not currently assigned to any admin team. Send a request to an admin to get started with
                    deliveries and unlock your earning potential.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 border-blue-200 text-blue-700 hover:bg-blue-100"
                    onClick={() => setSendInviteOpen(true)}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Send Request Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sent Requests */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-orange-100 p-2">
                    <Send className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Sent Requests</CardTitle>
                    <CardDescription>Requests you've sent to admins</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {sentInvitations.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                </div>
              ) : sentInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="rounded-full bg-gray-100 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Mail className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">No requests sent yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start by sending a request to an admin to join their team
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSendInviteOpen(true)}>
                    <Plus className="mr-2 h-3 w-3" />
                    Send First Request
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {sentInvitations.map((invitation) => (
                    <div key={invitation.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{invitation.target_email}</span>
                        </div>
                        {getStatusBadge(invitation.status)}
                      </div>

                      {invitation.message && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1 mb-1">
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Message</span>
                          </div>
                          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border-l-2 border-gray-200">
                            {invitation.message}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Sent: {new Date(invitation.created_at).toLocaleDateString()}
                        </div>
                        {invitation.responded_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Responded: {new Date(invitation.responded_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Received Invitations */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-green-100 p-2">
                    <UserPlus className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Received Invitations</CardTitle>
                    <CardDescription>Invitations from admins to join their teams</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {receivedInvitations.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                </div>
              ) : receivedInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="rounded-full bg-gray-100 p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <UserPlus className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">No invitations received</h3>
                  <p className="text-sm text-muted-foreground">Admins will send you invitations to join their teams</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receivedInvitations.map((invitation) => (
                    <div key={invitation.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{invitation.inviter_email}</span>
                        </div>
                        {getStatusBadge(invitation.status)}
                      </div>

                      {invitation.message && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1 mb-1">
                            <MessageSquare className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Message</span>
                          </div>
                          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                            {invitation.message}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Received: {new Date(invitation.created_at).toLocaleDateString()}
                        </div>

                        {invitation.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => respondToInvitation(invitation.id, "accept")}
                              className="h-8 px-3"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => respondToInvitation(invitation.id, "reject")}
                              className="h-8 px-3"
                            >
                              <X className="mr-1 h-3 w-3" />
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
