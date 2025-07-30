"use client"

import { useState } from "react"
import { DriverDashboardLayout } from "@/components/driver-dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QRCodeScanner } from "@/components/qr-code-scanner"
import { QrCode, History, Info, Camera, Smartphone, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function ScannerPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("scanner")
  const [scanHistory, setScanHistory] = useState<any[]>([])

  const handleScan = (data: any) => {
    // Add to scan history
    setScanHistory((prev) => [
      {
        ...data,
        scannedAt: new Date().toISOString(),
      },
      ...prev.slice(0, 9), // Keep only the last 10 scans
    ])
  }

  return (
    <DriverDashboardLayout title="QR Scanner">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scanner">
              <QrCode className="mr-2 h-4 w-4" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="help">
              <Info className="mr-2 h-4 w-4" />
              Help
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner" className="space-y-4">
            <QRCodeScanner onScan={handleScan} />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Scan History</CardTitle>
                <CardDescription>Recent QR codes you've scanned</CardDescription>
              </CardHeader>
              <CardContent>
                {scanHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <QrCode className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No scan history yet</p>
                    <p className="text-sm">Scanned QR codes will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scanHistory.map((scan, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/driver/orders/${scan.orderId}`)}
                      >
                        <div>
                          <p className="font-medium">Order #{scan.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">{scan.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{new Date(scan.scannedAt).toLocaleTimeString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(scan.scannedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="help">
            <Card>
              <CardHeader>
                <CardTitle>Scanner Help</CardTitle>
                <CardDescription>Tips for using the QR code scanner effectively</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <h3 className="font-medium text-lg flex items-center">
                    <Camera className="mr-2 h-5 w-5" />
                    Scanning Tips
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>Make sure the QR code is well-lit and clearly visible</li>
                    <li>Hold your device steady about 6-8 inches from the code</li>
                    <li>Ensure the entire QR code is visible within the scanning frame</li>
                    <li>If scanning fails, try the manual entry option</li>
                    <li>For best results, use the back camera on mobile devices</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-lg flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5" />
                    Troubleshooting
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>If the camera doesn't start, check your browser permissions</li>
                    <li>Make sure you're using a modern browser (Chrome, Firefox, Safari)</li>
                    <li>Try refreshing the page if the scanner doesn't initialize</li>
                    <li>If using a mobile device, ensure the app has camera permissions</li>
                    <li>For persistent issues, use the manual entry option</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-lg flex items-center">
                    <Smartphone className="mr-2 h-5 w-5" />
                    Manual Entry
                  </h3>
                  <p className="text-sm">
                    If scanning doesn't work, you can manually enter the order number or tracking code. Switch to the
                    "Manual Entry" tab in the scanner and enter the code printed on the shipping label.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-lg flex items-center">
                    <CheckCircle className="mr-2 h-5 w-5" />
                    After Scanning
                  </h3>
                  <p className="text-sm">
                    After a successful scan, you'll be redirected to the order details page where you can:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>View complete order information</li>
                    <li>Update the delivery status</li>
                    <li>Add delivery notes or proof of delivery</li>
                    <li>Contact the customer if needed</li>
                  </ul>
                </div>

                <div className="mt-6 flex justify-center">
                  <Button onClick={() => setActiveTab("scanner")}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Go to Scanner
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Feature Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto p-3 bg-blue-100 rounded-full w-fit">
                <QrCode className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Quick Scanning</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Instantly scan QR codes on shipping labels to retrieve order details
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto p-3 bg-green-100 rounded-full w-fit">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-lg">Status Updates</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Update order status in real-time with notes and delivery confirmation
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DriverDashboardLayout>
  )
}
