"use client"

import { DialogFooter } from "@/components/ui/dialog"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Mail, Send, Check, X, Clock, UserPlus } from "lucide-react"

interface Invitation {
  id: string
  type: "admin_to_driver" | "driver_to_admin"
  inviter_user_id: string
  target_user_id: string
  inviter_email: string
  target_email: string
  message: string | null
  status: "pending" | "accepted" | "rejected"
  created_at: string
  responded_at: string | null
  inviter: {
    first_name: string
    last_name: string
    email: string
    role: string
  }
  target: {
    first_name: string
    last_name: string
    email: string
    role: string
  }
}

export function InvitationSystem() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingInvitation, setSendingInvitation] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  // Form state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteMessage, setInviteMessage] = useState("")

  useEffect(() => {
    if (profile) {
      fetchInvitations()
    }
  }, [profile])

  const fetchInvitations = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const response = await fetch(`/api/invitations?userId=${profile.user_id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch invitations")
      }

      setInvitations(data.invitations || [])
    } catch (error) {
      console.error("Error fetching invitations:", error)
      toast({
        title: "Error",
        description: "Failed to load invitations. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const sendInvitation = async () => {
    if (!profile || !inviteEmail) return

    setSendingInvitation(true)
    try {
      const invitationType = profile.role === "admin" ? "admin_to_driver" : "driver_to_admin"

      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: invitationType,
          email: inviteEmail,
          inviterUserId: profile.user_id,
          message: inviteMessage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation")
      }

      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail} successfully`,
      })

      setInviteEmail("")
      setInviteMessage("")
      setInviteDialogOpen(false)
      fetchInvitations()
    } catch (error) {
      console.error("Error sending invitation:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      })
    } finally {
      setSendingInvitation(false)
    }
  }

  const respondToInvitation = async (invitationId: string, action: "accept" | "reject") => {
    if (!profile) return

    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userId: profile.user_id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} invitation`)
      }

      toast({
        title: `Invitation ${action === "accept" ? "Accepted" : "Rejected"}`,
        description: data.message,
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
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="mr-1 h-3 w-3" />
            Accepted
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <X className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const sentInvitations = invitations.filter((inv) => inv.inviter_user_id === profile?.user_id)
  const receivedInvitations = invitations.filter((inv) => inv.target_user_id === profile?.user_id)

  if (!profile) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invitation Management</h2>
          <p className="text-muted-foreground">
            {profile.role === "admin"
              ? "Invite existing drivers to join your team or manage received requests from drivers"
              : profile?.admin_id
                ? "You are currently assigned to an admin. Manage any pending invitations here."
                : "You are not assigned to any admin team. Send requests to admins to join their teams and start receiving orders."}
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={profile.role === "driver" && !!profile.admin_id}>
              <UserPlus className="mr-2 h-4 w-4" />
              {profile.role === "admin" ? "Invite Driver" : profile.admin_id ? "Already Assigned" : "Request Admin"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {profile.role === "admin" ? "Invite Driver to Team" : "Request Admin Assignment"}
              </DialogTitle>
              <DialogDescription>
                {profile.role === "admin"
                  ? "Enter the email address of an existing driver to invite them to your team."
                  : profile?.admin_id
                    ? "You are already assigned to an admin team."
                    : "Enter the email address of an admin to request assignment to their team. This will allow you to receive order assignments."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{profile.role === "admin" ? "Driver Email" : "Admin Email"} *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={profile.role === "admin" ? "driver@example.com" : "admin@example.com"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-message">Message (Optional)</Label>
                <Textarea
                  id="invite-message"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendInvitation} disabled={!inviteEmail || sendingInvitation}>
                {sendingInvitation ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send {profile.role === "admin" ? "Invitation" : "Request"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">
            Received ({receivedInvitations.filter((inv) => inv.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="sent">Sent ({sentInvitations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle>Received Invitations</CardTitle>
              <CardDescription>
                {profile.role === "admin"
                  ? "Drivers requesting to join your team"
                  : "Invitations from admins to join their teams"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading invitations...</div>
              ) : receivedInvitations.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invitations received</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receivedInvitations.map((invitation) => (
                    <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">
                            {invitation.inviter.first_name} {invitation.inviter.last_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">{invitation.inviter.email}</p>
                        </div>
                        {getStatusBadge(invitation.status)}
                      </div>
                      {invitation.message && (
                        <div className="bg-muted p-3 rounded">
                          <p className="text-sm">{invitation.message}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {invitation.type === "admin_to_driver" ? "Team Invitation" : "Join Request"} •{" "}
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </p>
                        {invitation.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => respondToInvitation(invitation.id, "reject")}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Reject
                            </Button>
                            <Button size="sm" onClick={() => respondToInvitation(invitation.id, "accept")}>
                              <Check className="mr-1 h-3 w-3" />
                              Accept
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
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle>Sent Invitations</CardTitle>
              <CardDescription>
                {profile.role === "admin"
                  ? "Invitations sent to drivers"
                  : "Requests sent to admins for team assignment"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading invitations...</div>
              ) : sentInvitations.length === 0 ? (
                <div className="text-center py-8">
                  <Send className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No invitations sent</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sentInvitations.map((invitation) => (
                    <div key={invitation.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">
                            {invitation.target.first_name} {invitation.target.last_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">{invitation.target.email}</p>
                        </div>
                        {getStatusBadge(invitation.status)}
                      </div>
                      {invitation.message && (
                        <div className="bg-muted p-3 rounded">
                          <p className="text-sm">{invitation.message}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {invitation.type === "admin_to_driver" ? "Team Invitation" : "Join Request"} •{" "}
                          {new Date(invitation.created_at).toLocaleDateString()}
                          {invitation.responded_at && (
                            <> • Responded {new Date(invitation.responded_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
