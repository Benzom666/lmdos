"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to orders page as the main driver dashboard
    router.push("/driver/orders")
  }, [router])

  return <div>{/* This page intentionally left blank. Redirecting to /driver/orders */}</div>
}
