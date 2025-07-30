"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Copy,
  Check,
  Code,
  Key,
  Shield,
  Zap,
  Database,
  Truck,
  Package,
  Users,
  BarChart3,
} from "lucide-react"
import Link from "next/link"

export default function ApiDocsPage() {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null)

  const copyToClipboard = async (text: string, endpoint: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedEndpoint(endpoint)
      setTimeout(() => setCopiedEndpoint(null), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const endpoints = [
    {
      category: "Authentication",
      icon: <Shield className="w-5 h-5" />,
      items: [
        {
          method: "POST",
          path: "/api/create-admin",
          description: "Create a new admin user",
          example: `{
  "email": "admin@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}`,
        },
        {
          method: "POST",
          path: "/api/create-driver",
          description: "Create a new driver user",
          example: `{
  "email": "driver@example.com",
  "password": "securepassword",
  "firstName": "Jane",
  "lastName": "Smith"
}`,
        },
        {
          method: "POST",
          path: "/api/reset-password",
          description: "Reset user password",
          example: `{
  "email": "user@example.com"
}`,
        },
      ],
    },
    {
      category: "Orders Management",
      icon: <Package className="w-5 h-5" />,
      items: [
        {
          method: "POST",
          path: "/api/assign-order",
          description: "Assign an order to a driver",
          example: `{
  "orderId": "order_123",
  "driverId": "driver_456"
}`,
        },
        {
          method: "POST",
          path: "/api/change-order-status",
          description: "Update order status",
          example: `{
  "orderId": "order_123",
  "status": "delivered",
  "driverId": "driver_456"
}`,
        },
        {
          method: "POST",
          path: "/api/upload-orders",
          description: "Bulk upload orders via CSV",
          example: `FormData with CSV file`,
        },
      ],
    },
    {
      category: "Deliveries",
      icon: <Truck className="w-5 h-5" />,
      items: [
        {
          method: "GET",
          path: "/api/deliveries",
          description: "Get delivery information",
          example: `Query parameters:
?driverId=driver_456
&status=pending
&date=2024-01-01`,
        },
        {
          method: "POST",
          path: "/api/delivery-failure",
          description: "Report delivery failure",
          example: `{
  "orderId": "order_123",
  "reason": "Customer not available",
  "notes": "Will retry tomorrow"
}`,
        },
      ],
    },
    {
      category: "User Management",
      icon: <Users className="w-5 h-5" />,
      items: [
        {
          method: "POST",
          path: "/api/suspend-user",
          description: "Suspend or activate user",
          example: `{
  "userId": "user_123",
  "suspend": true,
  "reason": "Policy violation"
}`,
        },
        {
          method: "DELETE",
          path: "/api/delete-user",
          description: "Delete user account",
          example: `{
  "userId": "user_123"
}`,
        },
      ],
    },
    {
      category: "Invitations",
      icon: <Key className="w-5 h-5" />,
      items: [
        {
          method: "GET",
          path: "/api/invitations",
          description: "Get user invitations",
          example: `Query parameters:
?userId=user_123
&status=pending`,
        },
        {
          method: "PUT",
          path: "/api/invitations/[id]",
          description: "Update invitation status",
          example: `{
  "status": "accepted",
  "response": "Looking forward to joining"
}`,
        },
      ],
    },
    {
      category: "Validation",
      icon: <BarChart3 className="w-5 h-5" />,
      items: [
        {
          method: "POST",
          path: "/api/validate-scan",
          description: "Validate scanned QR code",
          example: `{
  "qrData": "ORDER_123_DRIVER_456",
  "driverId": "driver_456",
  "location": {
    "lat": 40.7128,
    "lng": -74.0060
  }
}`,
        },
      ],
    },
  ]

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-green-500/10 text-green-400 border-green-500/20"
      case "POST":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20"
      case "PUT":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      case "DELETE":
        return "bg-red-500/10 text-red-400 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 dark:from-slate-950 dark:via-purple-950 dark:to-slate-950">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 dark:bg-purple-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 dark:bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              API Documentation
            </h1>
            <p className="text-slate-400 mt-2">Complete guide to integrating with DeliveryOS API</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-800/50 border-slate-700/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
              <Code className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="authentication" className="data-[state=active]:bg-slate-700">
              <Shield className="w-4 h-4 mr-2" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="endpoints" className="data-[state=active]:bg-slate-700">
              <Database className="w-4 h-4 mr-2" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="examples" className="data-[state=active]:bg-slate-700">
              <Zap className="w-4 h-4 mr-2" />
              Examples
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Getting Started</CardTitle>
                <CardDescription className="text-slate-400">
                  Welcome to the DeliveryOS API. This RESTful API allows you to integrate delivery management
                  functionality into your applications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <Shield className="w-8 h-8 text-cyan-400 mb-2" />
                    <h3 className="text-white font-semibold mb-1">Secure</h3>
                    <p className="text-slate-400 text-sm">JWT-based authentication with role-based access control</p>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <Zap className="w-8 h-8 text-purple-400 mb-2" />
                    <h3 className="text-white font-semibold mb-1">Fast</h3>
                    <p className="text-slate-400 text-sm">Optimized endpoints with real-time data synchronization</p>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <Database className="w-8 h-8 text-pink-400 mb-2" />
                    <h3 className="text-white font-semibold mb-1">Reliable</h3>
                    <p className="text-slate-400 text-sm">Built on Supabase with automatic scaling and backups</p>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <h3 className="text-white font-semibold mb-2">Base URL</h3>
                  <div className="flex items-center gap-2">
                    <code className="bg-slate-800 px-3 py-1 rounded text-cyan-400 flex-1">
                      https://your-domain.com/api
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard("https://your-domain.com/api", "base-url")}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      {copiedEndpoint === "base-url" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authentication" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Authentication</CardTitle>
                <CardDescription className="text-slate-400">
                  All API requests require authentication using JWT tokens obtained through Supabase Auth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <h3 className="text-white font-semibold mb-2">Authorization Header</h3>
                  <code className="bg-slate-800 px-3 py-1 rounded text-cyan-400 block">
                    Authorization: Bearer YOUR_JWT_TOKEN
                  </code>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <h3 className="text-white font-semibold mb-2">User Roles</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">super_admin</Badge>
                      <span className="text-slate-400 text-sm">Full system access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">admin</Badge>
                      <span className="text-slate-400 text-sm">Order and driver management</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">driver</Badge>
                      <span className="text-slate-400 text-sm">Delivery operations</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6">
            {endpoints.map((category) => (
              <Card key={category.category} className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    {category.icon}
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {category.items.map((endpoint, index) => (
                    <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge className={getMethodColor(endpoint.method)}>{endpoint.method}</Badge>
                        <code className="text-cyan-400 font-mono">{endpoint.path}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(endpoint.path, `${category.category}-${index}`)}
                          className="ml-auto text-slate-400 hover:text-white"
                        >
                          {copiedEndpoint === `${category.category}-${index}` ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-slate-400 text-sm mb-3">{endpoint.description}</p>
                      <div className="bg-slate-800 p-3 rounded border border-slate-700">
                        <pre className="text-sm text-slate-300 overflow-x-auto">
                          <code>{endpoint.example}</code>
                        </pre>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Integration Examples</CardTitle>
                <CardDescription className="text-slate-400">
                  Common integration patterns and code examples
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <h3 className="text-white font-semibold mb-3">JavaScript/Node.js Example</h3>
                  <div className="bg-slate-800 p-4 rounded border border-slate-700">
                    <pre className="text-sm text-slate-300 overflow-x-auto">
                      <code>{`// Create a new order
const response = await fetch('/api/assign-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    orderId: 'ORDER_123',
    driverId: 'DRIVER_456'
  })
});

const result = await response.json();
console.log(result);`}</code>
                    </pre>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <h3 className="text-white font-semibold mb-3">Python Example</h3>
                  <div className="bg-slate-800 p-4 rounded border border-slate-700">
                    <pre className="text-sm text-slate-300 overflow-x-auto">
                      <code>{`import requests

# Update order status
url = "https://your-domain.com/api/change-order-status"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}"
}
data = {
    "orderId": "ORDER_123",
    "status": "delivered",
    "driverId": "DRIVER_456"
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`}</code>
                    </pre>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                  <h3 className="text-white font-semibold mb-3">cURL Example</h3>
                  <div className="bg-slate-800 p-4 rounded border border-slate-700">
                    <pre className="text-sm text-slate-300 overflow-x-auto">
                      <code>{`curl -X POST https://your-domain.com/api/validate-scan \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "qrData": "ORDER_123_DRIVER_456",
    "driverId": "DRIVER_456",
    "location": {
      "lat": 40.7128,
      "lng": -74.0060
    }
  }'`}</code>
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            Need help? Contact our support team or check out our{" "}
            <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              main application
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
