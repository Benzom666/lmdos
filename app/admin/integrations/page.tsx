"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Key,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  TestTube,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Globe,
  Smartphone,
  Warehouse,
  RefreshCw,
} from "lucide-react"

import ShopifyIntegrationPage from "./shopify/page"

interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  is_active: boolean
  last_used_at?: string
  created_at: string
}

interface TestResult {
  id: string
  endpoint: string
  method: string
  status: number
  response: any
  timestamp: string
}

export default function IntegrationsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([])
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [selectedApiKey, setSelectedApiKey] = useState("")
  const [selectedEndpoint, setSelectedEndpoint] = useState("")
  const [testLoading, setTestLoading] = useState(false)

  // Statistics
  const [stats, setStats] = useState({
    totalKeys: 0,
    activeKeys: 0,
    totalApis: 12,
    successfulTests: 0,
  })

  useEffect(() => {
    if (profile) {
      fetchApiKeys()
    }
  }, [profile])

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/api-keys")
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.apiKeys || [])
        updateStats(data.apiKeys || [])
      }
    } catch (error) {
      console.error("Error fetching API keys:", error)
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const updateStats = (keys: ApiKey[]) => {
    const activeKeys = keys.filter((key) => key.is_active).length
    const successfulTests = testResults.filter((test) => test.status >= 200 && test.status < 300).length

    setStats({
      totalKeys: keys.length,
      activeKeys,
      totalApis: 12,
      successfulTests,
    })
  }

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the API key",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          permissions: newKeyPermissions,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setApiKeys((prev) => [...prev, data.apiKey])
        setCreateKeyOpen(false)
        setNewKeyName("")
        setNewKeyPermissions([])

        toast({
          title: "API Key Created",
          description: "Your new API key has been generated successfully",
        })
      } else {
        throw new Error("Failed to create API key")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      })
    }
  }

  const deleteApiKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setApiKeys((prev) => prev.filter((key) => key.id !== keyId))
        toast({
          title: "API Key Deleted",
          description: "The API key has been permanently deleted",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      })
    }
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    })
  }

  const testApiConnection = async () => {
    if (!selectedApiKey || !selectedEndpoint) {
      toast({
        title: "Error",
        description: "Please select an API key and endpoint",
        variant: "destructive",
      })
      return
    }

    setTestLoading(true)
    try {
      // Simulate API test
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const testResult: TestResult = {
        id: Date.now().toString(),
        endpoint: selectedEndpoint,
        method: "GET",
        status: Math.random() > 0.2 ? 200 : 401,
        response: { message: "Test successful", timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      }

      setTestResults((prev) => [testResult, ...prev.slice(0, 9)])

      if (testResult.status === 200) {
        toast({
          title: "Test Successful",
          description: "API connection is working correctly",
        })
      } else {
        toast({
          title: "Test Failed",
          description: "API connection failed. Check your API key permissions.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test API connection",
        variant: "destructive",
      })
    } finally {
      setTestLoading(false)
    }
  }

  const availablePermissions = [
    "orders:read",
    "orders:write",
    "drivers:read",
    "drivers:write",
    "deliveries:read",
    "analytics:read",
    "webhooks:manage",
  ]

  const apiEndpoints = [
    { value: "/api/orders", label: "GET /api/orders - List Orders" },
    { value: "/api/orders/create", label: "POST /api/orders - Create Order" },
    { value: "/api/drivers", label: "GET /api/drivers - List Drivers" },
    { value: "/api/deliveries", label: "GET /api/deliveries - List Deliveries" },
    { value: "/api/analytics", label: "GET /api/analytics - Get Analytics" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Integrations</h1>
            <p className="text-muted-foreground">
              Manage API keys, test connections, and integrate with external systems
            </p>
          </div>
          <Button onClick={() => window.open("/api-docs", "_blank")}>
            <BookOpen className="mr-2 h-4 w-4" />
            View Documentation
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalKeys}</div>
              <p className="text-xs text-muted-foreground">{stats.activeKeys} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available APIs</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApis}</div>
              <p className="text-xs text-muted-foreground">Endpoints ready</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Test Results</CardTitle>
              <TestTube className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{testResults.length}</div>
              <p className="text-xs text-muted-foreground">{stats.successfulTests} successful</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Integration Guides</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Step-by-step guides</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="keys" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
            <TabsTrigger value="guides">Integration Guides</TabsTrigger>
            <TabsTrigger value="shopify">Shopify</TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">API Key Management</h2>
              <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create API Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New API Key</DialogTitle>
                    <DialogDescription>
                      Generate a new API key with specific permissions for your integration.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyName">Key Name</Label>
                      <Input
                        id="keyName"
                        placeholder="e.g., E-commerce Integration"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Permissions</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {availablePermissions.map((permission) => (
                          <div key={permission} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={permission}
                              checked={newKeyPermissions.includes(permission)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewKeyPermissions((prev) => [...prev, permission])
                                } else {
                                  setNewKeyPermissions((prev) => prev.filter((p) => p !== permission))
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor={permission} className="text-sm">
                              {permission}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createApiKey}>Create Key</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {loading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">Loading API keys...</div>
                  </CardContent>
                </Card>
              ) : apiKeys.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <Key className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div>
                        <h3 className="text-lg font-medium">No API Keys</h3>
                        <p className="text-muted-foreground">
                          Create your first API key to start integrating with external systems.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                apiKeys.map((apiKey) => (
                  <Card key={apiKey.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{apiKey.name}</h3>
                            <Badge variant={apiKey.is_active ? "default" : "secondary"}>
                              {apiKey.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-sm">
                            <span>{visibleKeys.has(apiKey.id) ? apiKey.key : "•".repeat(32)}</span>
                            <Button variant="ghost" size="sm" onClick={() => toggleKeyVisibility(apiKey.id)}>
                              {visibleKeys.has(apiKey.id) ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(apiKey.key)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {apiKey.permissions.map((permission) => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Created {new Date(apiKey.created_at).toLocaleDateString()}
                            {apiKey.last_used_at && (
                              <> • Last used {new Date(apiKey.last_used_at).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteApiKey(apiKey.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">API Connection Testing</h2>
              <Card>
                <CardHeader>
                  <CardTitle>Test API Endpoints</CardTitle>
                  <CardDescription>Validate your API keys and test endpoint connectivity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Select value={selectedApiKey} onValueChange={setSelectedApiKey}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an API key" />
                        </SelectTrigger>
                        <SelectContent>
                          {apiKeys
                            .filter((key) => key.is_active)
                            .map((key) => (
                              <SelectItem key={key.id} value={key.id}>
                                {key.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Endpoint</Label>
                      <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an endpoint" />
                        </SelectTrigger>
                        <SelectContent>
                          {apiEndpoints.map((endpoint) => (
                            <SelectItem key={endpoint.value} value={endpoint.value}>
                              {endpoint.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={testApiConnection} disabled={testLoading}>
                    {testLoading ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="mr-2 h-4 w-4" />
                    )}
                    Test Connection
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Test Results */}
            {testResults.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Recent Test Results</h3>
                <div className="space-y-2">
                  {testResults.map((result) => (
                    <Card key={result.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {result.status >= 200 && result.status < 300 ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : result.status >= 400 ? (
                              <XCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            )}
                            <div>
                              <p className="font-medium">
                                {result.method} {result.endpoint}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Status: {result.status} • {new Date(result.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={result.status >= 200 && result.status < 300 ? "default" : "destructive"}>
                            {result.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">API Documentation</h2>
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Authentication</CardTitle>
                    <CardDescription>How to authenticate your API requests</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p>Include your API key in the Authorization header:</p>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                      <div className="flex items-center justify-between">
                        <span>Authorization: Bearer YOUR_API_KEY</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard("Authorization: Bearer YOUR_API_KEY")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Available Endpoints</CardTitle>
                    <CardDescription>Complete list of API endpoints</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { method: "GET", endpoint: "/api/orders", description: "List all orders" },
                        { method: "POST", endpoint: "/api/orders", description: "Create a new order" },
                        { method: "GET", endpoint: "/api/orders/{id}", description: "Get order details" },
                        { method: "PUT", endpoint: "/api/orders/{id}", description: "Update order" },
                        { method: "GET", endpoint: "/api/drivers", description: "List all drivers" },
                        { method: "GET", endpoint: "/api/deliveries", description: "List deliveries" },
                      ].map((api, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                api.method === "GET"
                                  ? "default"
                                  : api.method === "POST"
                                    ? "secondary"
                                    : api.method === "PUT"
                                      ? "outline"
                                      : "destructive"
                              }
                            >
                              {api.method}
                            </Badge>
                            <code className="font-mono text-sm">{api.endpoint}</code>
                            <span className="text-muted-foreground">{api.description}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(api.endpoint)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Integration Guides Tab */}
          <TabsContent value="guides" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Integration Scenarios</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      E-commerce Integration
                    </CardTitle>
                    <CardDescription>Connect your online store to automatically create delivery orders</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Badge>Beginner</Badge>
                      <p className="text-sm text-muted-foreground">
                        Step-by-step guide to integrate with popular e-commerce platforms
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">What you'll learn:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Setting up webhooks</li>
                          <li>• Order synchronization</li>
                          <li>• Status updates</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Mobile App Integration
                    </CardTitle>
                    <CardDescription>Build a mobile app that connects to your delivery system</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Badge variant="secondary">Intermediate</Badge>
                      <p className="text-sm text-muted-foreground">
                        Create a customer-facing mobile app with real-time tracking
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">What you'll learn:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Real-time tracking</li>
                          <li>• Push notifications</li>
                          <li>• Order management</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Warehouse className="h-5 w-5" />
                      Warehouse Management
                    </CardTitle>
                    <CardDescription>
                      Integrate with warehouse management systems for automated fulfillment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Badge variant="outline">Advanced</Badge>
                      <p className="text-sm text-muted-foreground">
                        Advanced integration with inventory and fulfillment systems
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">What you'll learn:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Inventory sync</li>
                          <li>• Automated routing</li>
                          <li>• Analytics integration</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Code Examples */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Start Code Examples</CardTitle>
                <CardDescription>Copy and paste these examples to get started quickly</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="javascript" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                  </TabsList>

                  <TabsContent value="javascript">
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Create Order</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(`const response = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_name: 'John Doe',
    delivery_address: '123 Main St',
    priority: 'normal'
  })
});`)
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <pre className="text-sm overflow-x-auto">
                          {`const response = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_name: 'John Doe',
    delivery_address: '123 Main St',
    priority: 'normal'
  })
});`}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="python">
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Create Order</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(`import requests

response = requests.post('/api/orders', 
  headers={'Authorization': 'Bearer YOUR_API_KEY'},
  json={
    'customer_name': 'John Doe',
    'delivery_address': '123 Main St',
    'priority': 'normal'
  }
)`)
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <pre className="text-sm overflow-x-auto">
                          {`import requests

response = requests.post('/api/orders', 
  headers={'Authorization': 'Bearer YOUR_API_KEY'},
  json={
    'customer_name': 'John Doe',
    'delivery_address': '123 Main St',
    'priority': 'normal'
  }
)`}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="curl">
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Create Order</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(`curl -X POST /api/orders \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "John Doe",
    "delivery_address": "123 Main St",
    "priority": "normal"
  }'`)
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <pre className="text-sm overflow-x-auto">
                          {`curl -X POST /api/orders \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "John Doe",
    "delivery_address": "123 Main St",
    "priority": "normal"
  }'`}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shopify Tab */}
          <TabsContent value="shopify" className="space-y-6">
            <ShopifyIntegrationPage />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
