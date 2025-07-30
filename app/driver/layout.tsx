import type React from "react"

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Simple layout without duplicate sidebar
  return <>{children}</>
}
