import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  try {
    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.log("Driver middleware: No session, redirecting to login")
      return NextResponse.redirect(new URL("/", req.url))
    }

    // Get user profile
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("role", "driver")
      .single()

    if (error || !profile) {
      console.log("Driver middleware: No driver profile found, redirecting to login")
      return NextResponse.redirect(new URL("/", req.url))
    }

    // Check if driver is approved (has admin_id)
    const isApproved = !!profile.admin_id
    const isPendingPage = req.nextUrl.pathname === "/driver/pending"

    if (!isApproved && !isPendingPage) {
      console.log("Driver middleware: Driver not approved, redirecting to pending page")
      return NextResponse.redirect(new URL("/driver/pending", req.url))
    }

    if (isApproved && isPendingPage) {
      console.log("Driver middleware: Driver already approved, redirecting to home")
      return NextResponse.redirect(new URL("/driver/home", req.url))
    }

    return res
  } catch (error) {
    console.error("Error in driver middleware:", error)
    return res
  }
}

export const config = {
  matcher: ["/driver/:path*"],
}
