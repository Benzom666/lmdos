"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { MessageSquare, Send, Phone, Mail, AlertTriangle, Clock, CheckCircle, User, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Message {
  id: string
  sender_id: string
  recipient_id: string
  subject: string
  message: string
  type: string
  status: string
  created_at: string
  sender_name?: string
}

export default function CommunicationPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState({
    recipient: "admin",
    subject: "",
    message: "",
    type: "general",
  })

  useEffect(() => {
    if (profile) {
      fetchMessages()
    }
  }, [profile])

  const fetchMessages = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // In a real app, you'd have a messages table
      // For now, we'll simulate with notifications
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      // Transform notifications to message format
      const transformedMessages = data.map((notification) => ({
        id: notification.id,
        sender_id: "admin",
        recipient_id: profile.user_id,
        subject: notification.title,
        message: notification.message,
        type: notification.type,
        status: notification.read ? "read" : "unread",
        created_at: notification.created_at,
        sender_name: "Admin",
      }))

      setMessages(transformedMessages)
    } catch (error) {
      console.error("Error fetching messages:", error)
      toast({
        title: "Error",
        description: "Failed to load messages. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!profile || !newMessage.subject || !newMessage.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in both subject and message.",
        variant: "destructive",
      })
      return
    }

    setSending(true)
    try {
      // In a real app, you'd send to a messages table
      // For now, we'll create a notification for the admin
      const { error } = await supabase.from("notifications").insert({
        user_id: profile.admin_id, // Send to admin
        title: `Driver Message: ${newMessage.subject}`,
        message: `From ${profile.first_name} ${profile.last_name}: ${newMessage.message}`,
        type: newMessage.type,
        read: false,
      })

      if (error) throw error

      toast({
        title: "Message Sent",
        description: "Your message has been sent to the admin.",
      })

      setNewMessage({
        recipient: "admin",
        subject: "",
        message: "",
        type: "general",
      })

      fetchMessages()
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "info":
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    return status === "read" ? (
      <Badge variant="outline" className="text-xs">
        <CheckCircle className="mr-1 h-3 w-3" />
        Read
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">
        <Clock className="mr-1 h-3 w-3" />
        New
      </Badge>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Communication Hub</h1>
          <p className="text-muted-foreground">Stay connected with your admin and customers</p>
        </div>

        <Tabs defaultValue="messages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="emergency">Emergency Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>Messages and notifications from your admin</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No messages yet</p>
                    <p className="text-sm text-muted-foreground mt-2">Messages from your admin will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getMessageTypeIcon(message.type)}
                            <h4 className="font-medium">{message.subject}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(message.status)}
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">From: {message.sender_name || "Admin"}</p>
                        <p className="text-sm">{message.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compose">
            <Card>
              <CardHeader>
                <CardTitle>Send Message</CardTitle>
                <CardDescription>Contact your admin or report an issue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recipient</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={newMessage.recipient}
                      onChange={(e) => setNewMessage({ ...newMessage, recipient: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="support">Support Team</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message Type</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={newMessage.type}
                      onChange={(e) => setNewMessage({ ...newMessage, type: e.target.value })}
                    >
                      <option value="general">General</option>
                      <option value="urgent">Urgent</option>
                      <option value="issue">Report Issue</option>
                      <option value="feedback">Feedback</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    value={newMessage.subject}
                    onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                    placeholder="Enter message subject"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={newMessage.message}
                    onChange={(e) => setNewMessage({ ...newMessage, message: e.target.value })}
                    placeholder="Type your message here..."
                    rows={5}
                  />
                </div>

                <Button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.subject || !newMessage.message}
                  className="w-full"
                >
                  {sending ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emergency">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Emergency Contacts
                  </CardTitle>
                  <CardDescription>Use these contacts for urgent situations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                    <h4 className="font-medium text-red-800 mb-2">Emergency Services</h4>
                    <Button variant="destructive" className="w-full" onClick={() => window.open("tel:911")}>
                      <Phone className="mr-2 h-4 w-4" />
                      Call 911
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Admin Contact</h4>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => window.open("tel:+1234567890")}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Call Admin: (123) 456-7890
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => window.open("mailto:admin@company.com")}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Email Admin
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Support Resources
                  </CardTitle>
                  <CardDescription>Additional help and resources</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Live Chat Support
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    Driver Handbook
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Report Safety Issue
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Phone className="mr-2 h-4 w-4" />
                    24/7 Support: (555) 123-4567
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
