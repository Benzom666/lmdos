"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Home, Package, Users, Settings, LogOut, BarChart3, UserCheck, Mail, User, Scan } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const getNavigationItems = () => {
    if (!profile) return []

    const baseItems = [
      {
        name: "Dashboard",
        href:
          profile.role === "super_admin"
            ? "/super-admin"
            : profile.role === "admin"
              ? "/admin/dashboard"
              : "/driver/home",
        icon: Home,
      },
    ]

    if (profile.role === "super_admin") {
      return [
        ...baseItems,
        { name: "Admins", href: "/super-admin/admins", icon: UserCheck },
        { name: "All Drivers", href: "/super-admin/drivers", icon: Users },
        { name: "System Stats", href: "/super-admin/stats", icon: BarChart3 },
      ]
    }

    if (profile.role === "admin") {
      return [
        ...baseItems,
        { name: "Orders", href: "/admin/orders", icon: Package },
        { name: "Drivers", href: "/admin/drivers", icon: Users },
        { name: "Integrations", href: "/admin/integrations", icon: Settings },
      ]
    }

    if (profile.role === "driver") {
      return [
        ...baseItems,
        { name: "Orders", href: "/driver/orders", icon: Package },
        { name: "QR Scanner", href: "/driver/scanner", icon: Scan },
        { name: "Invitations", href: "/driver/invitations", icon: Mail },
        { name: "Profile", href: "/driver/profile", icon: User },
      ]
    }

    return baseItems
  }

  const navigationItems = getNavigationItems()

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar - Show for admin and super_admin only */}
      {profile.role !== "driver" && (
        <div className="hidden border-r bg-card lg:block">
          <div className="flex h-full flex-col w-72">
            <div className="flex h-20 items-center border-b px-6">
              <div className="flex items-center gap-3 font-bold text-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <span>DeliveryOS</span>
              </div>
            </div>
            <nav className="flex-1 space-y-2 p-6">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className={`flex items-center gap-4 rounded-xl px-4 py-3 text-base font-medium transition-all hover:bg-accent w-full text-left ${
                      isActive
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </button>
                )
              })}
            </nav>

            {/* User Profile in Sidebar */}
            {profile && (
              <div className="border-t p-6">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {profile.first_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {profile.first_name} {profile.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">{profile.role.replace("_", " ")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-20 items-center gap-4 border-b bg-card px-6 lg:px-8">
          <div className="flex items-center gap-3 font-bold text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <span>DeliveryOS</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <NotificationsDropdown />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {profile.first_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-2">
                    <p className="text-base font-semibold leading-none">
                      {profile.first_name} {profile.last_name}
                    </p>
                    <p className="text-sm leading-none text-muted-foreground">{profile.email}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize bg-muted px-2 py-1 rounded-md w-fit">
                      {profile.role.replace("_", " ")}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push(profile.role === "driver" ? "/driver/profile" : "/profile")}
                  className="py-3"
                >
                  <Settings className="mr-3 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="py-3 text-destructive focus:text-destructive">
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 overflow-y-auto bg-background ${profile.role === "driver" ? "pb-20" : ""}`}>
          <div className="container mx-auto px-6 py-8 lg:px-8 max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Bottom Navigation - Show for drivers only */}
      {profile.role === "driver" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <div className="grid grid-cols-4 h-16 max-w-lg mx-auto">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex flex-col items-center justify-center px-2 py-2 text-xs font-medium transition-colors",
                    "hover:bg-gray-50 dark:hover:bg-gray-800",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-6 w-6 mb-1",
                      isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs leading-none",
                      isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {item.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
