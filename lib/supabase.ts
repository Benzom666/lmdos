import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables:", {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey,
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from("user_profiles").select("count").limit(1)
    if (error) {
      console.error("Supabase connection test failed:", error)
      return false
    }
    console.log("Supabase connection successful")
    return true
  } catch (err) {
    console.error("Supabase connection error:", err)
    return false
  }
}

// Server-side Supabase client for API routes and server components
export const createServerSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export default supabase
