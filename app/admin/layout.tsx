import type React from "react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Remove RouteGuard completely for now to fix the loading issue
  return <>{children}</>
}
