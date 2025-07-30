"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { ShoppingBag, CheckCircle, Copy, ExternalLink, AlertTriangle, Code, Zap, Settings, Webhook } from "lucide-react"

export function ShopifyIntegrationGuide() {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    })
  }

  const steps = [
    {
      id: 1,
      title: "Create Shopify Private App",
      description: "Set up API access in your Shopify admin",
      icon: <ShoppingBag className="h-6 w-6" />,
      completed: false,
    },
    {
      id: 2,
      title: "Configure Permissions",
      description: "Grant necessary API permissions",
      icon: <Settings className="h-6 w-6" />,
      completed: false,
    },
    {
      id: 3,
      title: "Get Access Token",
      description: "Copy your API access token",
      icon: <Code className="h-6 w-6" />,
      completed: false,
    },
    {
      id: 4,
      title: "Connect to DeliveryOS",
      description: "Add your store to the delivery system",
      icon: <Zap className="h-6 w-6" />,
      completed: false,
    },
    {
      id: 5,
      title: "Setup Webhooks",
      description: "Enable real-time order sync",
      icon: <Webhook className="h-6 w-6" />,
      completed: false,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Shopify Integration Setup</CardTitle>
          <CardDescription>Follow these steps to connect your Shopify store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-4">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    step.completed
                      ? "bg-green-500 text-white"
                      : currentStep === step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.completed ? <CheckCircle className="h-5 w-5" /> : step.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {step.completed && <Badge variant="default">Completed</Badge>}
                {currentStep === step.id && <Badge variant="secondary">Current</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Instructions */}
      <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(Number.parseInt(value))}>
        <TabsList className="grid w-full grid-cols-5">
          {steps.map((step) => (
            <TabsTrigger key={step.id} value={step.id.toString()} className="text-xs">
              Step {step.id}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Create Shopify Private App</CardTitle>
              <CardDescription>Set up API access in your Shopify admin panel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Navigate to Apps section</p>
                    <p className="text-sm text-muted-foreground">
                      Go to your Shopify admin → Apps → App and sales channel settings
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Create a new app</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Develop apps" → "Create an app" → Enter app name (e.g., "DeliveryOS Integration")
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Configure the app</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Configure Admin API scopes" to set up permissions
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Important Note</p>
                    <p className="text-sm text-blue-700">
                      You need to be the store owner or have developer permissions to create private apps.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open("https://help.shopify.com/en/manual/apps/private-apps", "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Shopify Documentation
                </Button>
                <Button onClick={() => setCurrentStep(2)}>Next Step</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="2" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Configure API Permissions</CardTitle>
              <CardDescription>Grant the necessary permissions for order management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Required Admin API Scopes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { scope: "read_orders", description: "View order information" },
                      { scope: "write_orders", description: "Update order status" },
                      { scope: "read_products", description: "Access product details" },
                      { scope: "read_customers", description: "View customer information" },
                      { scope: "write_fulfillments", description: "Create fulfillments" },
                      { scope: "read_fulfillments", description: "View fulfillment status" },
                    ].map((permission) => (
                      <div key={permission.scope} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <code className="text-sm font-mono">{permission.scope}</code>
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                          </div>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Permission Requirements</p>
                      <p className="text-sm text-yellow-700">
                        Make sure to enable all the permissions listed above. Missing permissions will cause integration
                        failures.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Previous
                </Button>
                <Button onClick={() => setCurrentStep(3)}>Next Step</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="3" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Get Access Token</CardTitle>
              <CardDescription>Copy your API access token for the integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Install the app</p>
                    <p className="text-sm text-muted-foreground">
                      After configuring permissions, click "Install app" to activate it
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Copy the Admin API access token</p>
                    <p className="text-sm text-muted-foreground">
                      The token will start with "shpat_" and should be kept secure
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Note your shop domain</p>
                    <p className="text-sm text-muted-foreground">
                      Your shop domain format: your-store-name.myshopify.com
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Security Warning</p>
                    <p className="text-sm text-red-700">
                      Keep your access token secure and never share it publicly. It provides full access to your store's
                      data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  Previous
                </Button>
                <Button onClick={() => setCurrentStep(4)}>Next Step</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="4" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Connect to DeliveryOS</CardTitle>
              <CardDescription>Add your Shopify store to the delivery system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Go to Integrations page</p>
                    <p className="text-sm text-muted-foreground">
                      Navigate to Admin → Integrations → Shopify Integration
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Click "Connect Store"</p>
                    <p className="text-sm text-muted-foreground">Enter your shop domain and access token</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Test the connection</p>
                    <p className="text-sm text-muted-foreground">
                      Use the "Test Connection" button to verify everything is working
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Connection Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Shop Domain:</span>
                    <code>your-store.myshopify.com</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Access Token:</span>
                    <code>shpat_xxxxxxxxxxxxxxxx</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Webhook Secret:</span>
                    <code>Optional (recommended)</code>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  Previous
                </Button>
                <Button onClick={() => setCurrentStep(5)}>Next Step</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="5" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 5: Setup Webhooks (Optional)</CardTitle>
              <CardDescription>Enable real-time order synchronization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Webhook Configuration</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Webhook URL</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 p-2 bg-muted rounded text-sm">
                          {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/shopify` : ""}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/shopify` : "",
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Events to Subscribe</label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {[
                          "orders/create",
                          "orders/updated",
                          "orders/paid",
                          "orders/cancelled",
                          "orders/fulfilled",
                          "orders/partially_fulfilled",
                        ].map((event) => (
                          <div key={event} className="flex items-center gap-2 p-2 border rounded">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <code className="text-sm">{event}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Setup Complete!</p>
                      <p className="text-sm text-green-700">
                        Your Shopify store is now connected to DeliveryOS. Orders will be automatically synchronized.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>
                  Previous
                </Button>
                <Button
                  onClick={() =>
                    toast({ title: "Setup Complete!", description: "Your Shopify integration is ready to use." })
                  }
                >
                  Finish Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
