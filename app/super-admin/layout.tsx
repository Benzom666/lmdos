import type React from "react"

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Remove RouteGuard completely for now to fix the loading issue
  return <>{children}</>
}
