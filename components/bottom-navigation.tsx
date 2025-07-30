"use client"

import { usePathname, useRouter } from "next/navigation"
import { Package, Mail, User, QrCode } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNavigation() {
  const pathname = usePathname()
  const router = useRouter()

  const navigationItems = [
    {
      name: "Orders",
      href: "/driver/orders",
      icon: Package,
      isActive: pathname === "/driver/orders" || pathname.startsWith("/driver/orders/") || pathname === "/driver/home",
    },
    {
      name: "Scanner",
      href: "/driver/scanner",
      icon: QrCode,
      isActive: pathname === "/driver/scanner",
    },
    {
      name: "Invitations",
      href: "/driver/invitations",
      icon: Mail,
      isActive: pathname === "/driver/invitations",
    },
    {
      name: "Profile",
      href: "/driver/profile",
      icon: User,
      isActive: pathname === "/driver/profile",
    },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-700">
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
        {navigationItems.map((item) => (
          <button
            key={item.name}
            onClick={() => router.push(item.href)}
            className={cn(
              "flex flex-col items-center justify-center px-2 py-2 text-xs font-medium transition-colors",
              "hover:bg-gray-50 dark:hover:bg-gray-800",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              item.isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400",
            )}
          >
            <item.icon
              className={cn(
                "h-6 w-6 mb-1",
                item.isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400",
              )}
            />
            <span
              className={cn(
                "text-xs leading-none",
                item.isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400",
              )}
            >
              {item.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
