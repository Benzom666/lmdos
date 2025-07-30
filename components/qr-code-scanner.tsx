"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Camera,
  QrCode,
  Smartphone,
  RefreshCw,
  X,
  Search,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Package,
  MapPin,
  User,
  Phone,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"

interface QRCodeScannerProps {
  onScan?: (data: any) => void
  redirectToOrder?: boolean
}

interface ScanResult {
  orderId: string
  orderNumber: string
  customerName: string
  deliveryAddress: string
  customerPhone?: string
  priority: string
  status: string
  createdAt: string
  trackingUrl?: string
  labelData?: any
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  orderData?: any
}

export function QRCodeScanner({ onScan, redirectToOrder = true }: QRCodeScannerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState("camera")
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastScannedData, setLastScannedData] = useState<ScanResult | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStep, setScanStep] = useState<"scanning" | "validating" | "complete" | "error">("scanning")

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Start camera when tab changes to camera
  useEffect(() => {
    if (activeTab === "camera") {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [activeTab])

  const startCamera = async () => {
    try {
      setCameraError(null)
      setScanning(true)
      setScanStep("scanning")
      setScanProgress(0)

      // Try to get the back camera on mobile devices
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        // Start scanning for QR codes
        startQRCodeDetection()
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      setCameraError("Could not access camera. Please check permissions and try again.")
      setScanning(false)
      setScanStep("error")
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks()
      tracks.forEach((track) => track.stop())
      streamRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setScanning(false)
    setScanProgress(0)
  }

  const startQRCodeDetection = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
    }

    scanIntervalRef.current = window.setInterval(() => {
      if (scanning && videoRef.current && canvasRef.current) {
        detectQRCode()
        setScanProgress((prev) => Math.min(prev + 2, 95))
      }
    }, 100)
  }

  const detectQRCode = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data for QR code detection
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

    try {
      // In a real implementation, you would use jsQR here
      // const code = jsQR(imageData.data, imageData.width, imageData.height)

      // For demo purposes, simulate QR code detection
      if (Math.random() < 0.01) {
        // 1% chance per scan
        const mockQRData = {
          orderId: "ord_" + Math.random().toString(36).substring(2, 10),
          orderNumber: "ORD-" + Math.floor(1000 + Math.random() * 9000),
          customerName: "John Doe",
          deliveryAddress: "123 Main St, Anytown, USA",
          customerPhone: "+1 (555) 123-4567",
          priority: Math.random() > 0.7 ? "high" : "normal",
          status: "assigned",
          createdAt: new Date().toISOString(),
          trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/track/ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        }

        await handleSuccessfulScan(JSON.stringify(mockQRData))
      }
    } catch (error) {
      console.error("QR detection error:", error)
    }
  }

  const validateScannedData = async (data: string): Promise<ValidationResult> => {
    try {
      const parsedData = JSON.parse(data)
      const errors: string[] = []
      const warnings: string[] = []

      // Basic validation
      if (!parsedData.orderId) errors.push("Missing order ID")
      if (!parsedData.orderNumber) errors.push("Missing order number")
      if (!parsedData.customerName) errors.push("Missing customer name")
      if (!parsedData.deliveryAddress) errors.push("Missing delivery address")

      // Check if order exists in database
      if (isOnline && parsedData.orderId) {
        const { data: orderData, error } = await supabase
          .from("orders")
          .select("*")
          .eq("id", parsedData.orderId)
          .single()

        if (error || !orderData) {
          errors.push("Order not found in database")
        } else {
          // Validate order assignment
          if (orderData.driver_id && orderData.driver_id !== profile?.user_id) {
            warnings.push("Order is assigned to a different driver")
          }

          // Check order status
          if (orderData.status === "delivered") {
            warnings.push("Order is already marked as delivered")
          } else if (orderData.status === "cancelled") {
            errors.push("Order has been cancelled")
          }

          return {
            isValid: errors.length === 0,
            errors,
            warnings,
            orderData,
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        orderData: parsedData,
      }
    } catch (error) {
      return {
        isValid: false,
        errors: ["Invalid QR code format"],
        warnings: [],
      }
    }
  }

  const handleSuccessfulScan = async (qrData: string) => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    setScanning(false)
    setScanStep("validating")
    setIsValidating(true)
    setScanProgress(100)

    try {
      const validation = await validateScannedData(qrData)
      setValidationResult(validation)

      if (validation.isValid) {
        const scanResult: ScanResult = {
          ...JSON.parse(qrData),
          ...validation.orderData,
        }

        setLastScannedData(scanResult)
        setScanStep("complete")

        // Play success sound
        try {
          const audio = new Audio("/sounds/beep-success.mp3")
          await audio.play()
        } catch (e) {
          console.log("Audio play failed:", e)
        }

        // Show success notification
        toast({
          title: "✅ Scan Successful",
          description: `Order #${scanResult.orderNumber} verified successfully`,
        })

        // Call onScan callback
        if (onScan) {
          onScan(scanResult)
        }

        // Auto-redirect after delay
        if (redirectToOrder) {
          setTimeout(() => {
            router.push(`/driver/orders/${scanResult.orderId}`)
          }, 2000)
        }
      } else {
        setScanStep("error")

        // Show error notification
        toast({
          title: "❌ Scan Failed",
          description: validation.errors[0] || "Invalid QR code",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Validation error:", error)
      setScanStep("error")
      setValidationResult({
        isValid: false,
        errors: ["Failed to validate scan data"],
        warnings: [],
      })
    } finally {
      setIsValidating(false)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!manualCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter an order number or tracking code",
        variant: "destructive",
      })
      return
    }

    setIsValidating(true)
    setScanStep("validating")

    try {
      // Search for order by order number
      const { data: orderData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_number", manualCode.toUpperCase())
        .single()

      if (error || !orderData) {
        throw new Error("Order not found")
      }

      const mockQRData = {
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        customerName: orderData.customer_name,
        deliveryAddress: orderData.delivery_address,
        customerPhone: orderData.customer_phone,
        priority: orderData.priority || "normal",
        status: orderData.status,
        createdAt: orderData.created_at,
      }

      await handleSuccessfulScan(JSON.stringify(mockQRData))
    } catch (error) {
      setScanStep("error")
      toast({
        title: "Order Not Found",
        description: "Please check the order number and try again",
        variant: "destructive",
      })
    } finally {
      setIsValidating(false)
    }
  }

  const resetScanner = () => {
    setLastScannedData(null)
    setValidationResult(null)
    setManualCode("")
    setScanProgress(0)
    setScanStep("scanning")
    if (activeTab === "camera") {
      startCamera()
    }
  }

  const renderScanStatus = () => {
    switch (scanStep) {
      case "scanning":
        return (
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <QrCode className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Scanning for QR codes...</span>
            </div>
            <Progress value={scanProgress} className="w-full" />
          </div>
        )

      case "validating":
        return (
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              <span className="text-sm font-medium">Validating scan data...</span>
            </div>
            <Progress value={100} className="w-full" />
          </div>
        )

      case "complete":
        return (
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-green-700">Scan completed successfully!</span>
            </div>
            <Progress value={100} className="w-full" />
          </div>
        )

      case "error":
        return (
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-red-700">Scan failed</span>
            </div>
            <Progress value={0} className="w-full" />
          </div>
        )

      default:
        return null
    }
  }

  if (lastScannedData && validationResult?.isValid) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
            Scan Verified
          </CardTitle>
          <CardDescription>Order information has been validated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Success Alert */}
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Order #{lastScannedData.orderNumber} successfully verified and ready for processing.
              </AlertDescription>
            </Alert>

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <div className="space-y-1">
                    {validationResult.warnings.map((warning, index) => (
                      <div key={index}>⚠️ {warning}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Order Details */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4 text-gray-500" />
                <div>
                  <Label className="text-xs text-muted-foreground">Order Number</Label>
                  <p className="font-semibold">{lastScannedData.orderNumber}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="text-sm">{lastScannedData.customerName}</p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                <div>
                  <Label className="text-xs text-muted-foreground">Delivery Address</Label>
                  <p className="text-sm">{lastScannedData.deliveryAddress}</p>
                </div>
              </div>

              {lastScannedData.customerPhone && (
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="text-sm">{lastScannedData.customerPhone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Badge variant={lastScannedData.priority === "high" ? "destructive" : "secondary"}>
                      {lastScannedData.priority}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant="outline">{lastScannedData.status}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={resetScanner}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Scan Another
          </Button>
          <Button onClick={() => router.push(`/driver/orders/${lastScannedData.orderId}`)}>View Order Details</Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <QrCode className="mr-2 h-5 w-5" />
            Smart Label Scanner
          </div>
          <div className="flex items-center space-x-1">
            {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
          </div>
        </CardTitle>
        <CardDescription>Scan shipping labels for instant order verification and processing</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Connection Status */}
        {!isOnline && (
          <Alert className="mb-4 border-yellow-200 bg-yellow-50">
            <WifiOff className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              You're offline. Some features may be limited.
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {validationResult && !validationResult.isValid && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <div className="space-y-1">
                {validationResult.errors.map((error, index) => (
                  <div key={index}>❌ {error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera">
              <Camera className="mr-2 h-4 w-4" />
              Camera
            </TabsTrigger>
            <TabsTrigger value="manual">
              <Smartphone className="mr-2 h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="space-y-4">
            <div className="relative aspect-video bg-black rounded-md overflow-hidden">
              {cameraError ? (
                <div className="absolute inset-0 flex items-center justify-center text-white bg-black bg-opacity-80 p-4 text-center">
                  <div>
                    <X className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <p className="mb-4">{cameraError}</p>
                    <Button variant="outline" className="bg-white text-black hover:bg-gray-100" onClick={startCamera}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Camera
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white border-opacity-50 rounded-lg w-3/4 h-3/4 flex items-center justify-center">
                      <QrCode className="h-12 w-12 text-white opacity-50" />
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Scan Status Overlay */}
                  <div className="absolute bottom-4 left-4 right-4">{renderScanStatus()}</div>
                </>
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Position the QR code within the frame for automatic scanning
              </p>
              <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
                <span>✓ Auto-detection</span>
                <span>✓ Real-time validation</span>
                <span>✓ Error handling</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderNumber">Order Number or Tracking Code</Label>
                <Input
                  id="orderNumber"
                  placeholder="e.g. ORD-1234 or TRACK-5678"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  disabled={isValidating}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isValidating || !isOnline}>
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Order
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground w-full text-center">
          Scan QR codes from shipping labels for instant order verification
        </p>
      </CardFooter>
    </Card>
  )
}
