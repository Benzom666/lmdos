import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
  global: {
    headers: {
      "Content-Type": "application/json",
    },
  },
  db: {
    schema: "public",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Database types for better type safety
export interface UserProfile {
  id: string
  user_id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  role: "super_admin" | "admin" | "driver"
  status: "active" | "suspended" | "pending"
  admin_id?: string
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  pickup_address: string
  delivery_address: string
  delivery_notes?: string
  status: "pending" | "assigned" | "in_transit" | "delivered" | "failed" | "cancelled"
  priority: "low" | "normal" | "high" | "urgent"
  driver_id?: string
  created_by: string
  assigned_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  photo_url?: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  read: boolean
  created_at: string
}

export interface ApiKey {
  id: string
  admin_id: string
  name: string
  key_hash: string
  permissions: string[]
  is_active: boolean
  last_used_at?: string
  created_at: string
  expires_at?: string
}

export interface DeliveryFailure {
  id: string
  order_id: string
  driver_id: string
  failure_reason: string
  notes?: string
  attempted_delivery: boolean
  contacted_customer: boolean
  left_at_location: boolean
  reschedule_requested: boolean
  reschedule_date?: string
  location: string
  photos: string
  created_at: string
}

export interface OrderUpdate {
  id: string
  order_id: string
  driver_id: string
  status: string
  notes?: string
  latitude?: number
  longitude?: number
  created_at: string
}

export interface Route {
  id: string
  driver_id: string
  name: string
  status: "active" | "completed" | "cancelled"
  total_distance: number
  estimated_duration: number
  actual_duration?: number
  created_at: string
  updated_at: string
}

export interface RouteStop {
  id: string
  route_id: string
  order_id: string
  sequence: number
  estimated_arrival: string
  actual_arrival?: string
  completed_at?: string
  created_at: string
}

export interface Invitation {
  id: string
  type: "admin_to_driver" | "driver_to_admin"
  inviter_user_id: string
  target_user_id: string
  inviter_email: string
  target_email: string
  message?: string
  status: "pending" | "accepted" | "rejected" | "expired"
  created_at: string
  updated_at: string
}

// Server-side client for API routes
export const createServerSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  })
}
