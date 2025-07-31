import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables:", {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey,
  })
}

export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
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
}

// Export a default client instance
export const supabaseClient = createSupabaseClient()

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabaseClient.from("user_profiles").select("count").limit(1)
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
