import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { rateLimit } from "./lib/rate-limiter"
import { config as appConfig } from "./lib/config"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Skip middleware for static files
  if (
    req.nextUrl.pathname.startsWith("/_next") ||
    req.nextUrl.pathname.startsWith("/static") ||
    req.nextUrl.pathname.includes(".")
  ) {
    return res
  }

  // Apply rate limiting in production
  if (appConfig.security.enableRateLimit && req.nextUrl.pathname.startsWith("/api")) {
    const rateLimitResult = rateLimit(req, appConfig.security.maxRequestsPerMinute)

    if (!rateLimitResult.success) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": appConfig.security.maxRequestsPerMinute.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.resetTime.toString(),
        },
      })
    }

    res.headers.set("X-RateLimit-Limit", appConfig.security.maxRequestsPerMinute.toString())
    res.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString())
    res.headers.set("X-RateLimit-Reset", rateLimitResult.resetTime.toString())
  }

  // Security headers for production
  if (appConfig.security.enableCSP) {
    res.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;",
    )
    res.headers.set("X-Frame-Options", "DENY")
    res.headers.set("X-Content-Type-Options", "nosniff")
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
