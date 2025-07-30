import { supabase, type Notification } from "@/lib/supabase"

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
): Promise<Notification | null> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        message,
        type,
        read: false,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating notification:", error)
      return null
    }

    return data as Notification
  } catch (error) {
    console.error("Unexpected error creating notification:", error)
    return null
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notificationId)

    if (error) {
      console.error("Error marking notification as read:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Unexpected error marking notification as read:", error)
    return false
  }
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Error fetching notifications:", error)
      return []
    }

    return data as Notification[]
  } catch (error) {
    console.error("Unexpected error fetching notifications:", error)
    return []
  }
}
