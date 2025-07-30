"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { FileText, Printer, Download, Package, MapPin, User, Barcode } from "lucide-react"

interface WaybillData {
  orderId?: string
  waybillNumber: string
  senderName: string
  senderAddress: string
  senderPhone: string
  receiverName: string
  receiverAddress: string
  receiverPhone: string
  packageDescription: string
  weight: string
  dimensions: string
  serviceType: string
  specialInstructions: string
  declaredValue: string
}

interface WaybillGeneratorProps {
  orderId?: string
  orderData?: any
  onWaybillGenerated?: (waybillId: string) => void
}

export function WaybillGenerator({ orderId, orderData, onWaybillGenerated }: WaybillGeneratorProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [waybillData, setWaybillData] = useState<WaybillData>({
    orderId: orderId || "",
    waybillNumber: generateWaybillNumber(),
    senderName: orderData?.pickup_contact_name || "",
    senderAddress: orderData?.pickup_address || "",
    senderPhone: orderData?.pickup_contact_phone || "",
    receiverName: orderData?.customer_name || "",
    receiverAddress: orderData?.delivery_address || "",
    receiverPhone: orderData?.customer_phone || "",
    packageDescription: orderData?.package_description || "",
    weight: orderData?.package_weight || "",
    dimensions: orderData?.package_dimensions || "",
    serviceType: "standard",
    specialInstructions: orderData?.delivery_notes || "",
    declaredValue: orderData?.declared_value || "",
  })

  function generateWaybillNumber() {
    const timestamp = Date.now().toString().slice(-8)
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")
    return `WB${timestamp}${random}`
  }

  const handleInputChange = (field: keyof WaybillData, value: string) => {
    setWaybillData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const saveWaybill = async () => {
    if (!profile) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("waybills")
        .insert({
          waybill_number: waybillData.waybillNumber,
          order_id: waybillData.orderId || null,
          sender_name: waybillData.senderName,
          sender_address: waybillData.senderAddress,
          sender_phone: waybillData.senderPhone,
          receiver_name: waybillData.receiverName,
          receiver_address: waybillData.receiverAddress,
          receiver_phone: waybillData.receiverPhone,
          package_description: waybillData.packageDescription,
          weight: waybillData.weight,
          dimensions: waybillData.dimensions,
          service_type: waybillData.serviceType,
          special_instructions: waybillData.specialInstructions,
          declared_value: waybillData.declaredValue,
          created_by: profile.user_id,
          status: "generated",
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Success",
        description: "Waybill generated successfully!",
      })

      onWaybillGenerated?.(data.id)
      setShowPreview(true)
    } catch (error) {
      console.error("Error saving waybill:", error)
      toast({
        title: "Error",
        description: "Failed to generate waybill. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const printWaybill = () => {
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(generatePrintableWaybill())
      printWindow.document.close()
      printWindow.print()
    }
  }

  const downloadWaybill = () => {
    const element = document.createElement("a")
    const file = new Blob([generatePrintableWaybill()], { type: "text/html" })
    element.href = URL.createObjectURL(file)
    element.download = `waybill-${waybillData.waybillNumber}.html`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const generatePrintableWaybill = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Waybill - ${waybillData.waybillNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .waybill { border: 2px solid #000; padding: 20px; max-width: 800px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
            .field { margin-bottom: 8px; }
            .field-label { font-weight: bold; display: inline-block; width: 120px; }
            .barcode { text-align: center; font-family: 'Courier New', monospace; font-size: 24px; margin: 20px 0; }
            .footer { border-top: 2px solid #000; padding-top: 10px; margin-top: 20px; text-align: center; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="waybill">
            <div class="header">
              <h1>DELIVERY WAYBILL</h1>
              <h2>${waybillData.waybillNumber}</h2>
              <div class="barcode">||||| ${waybillData.waybillNumber} |||||</div>
            </div>
            
            <div class="section">
              <div class="section-title">SENDER INFORMATION</div>
              <div class="field"><span class="field-label">Name:</span> ${waybillData.senderName}</div>
              <div class="field"><span class="field-label">Address:</span> ${waybillData.senderAddress}</div>
              <div class="field"><span class="field-label">Phone:</span> ${waybillData.senderPhone}</div>
            </div>
            
            <div class="section">
              <div class="section-title">RECEIVER INFORMATION</div>
              <div class="field"><span class="field-label">Name:</span> ${waybillData.receiverName}</div>
              <div class="field"><span class="field-label">Address:</span> ${waybillData.receiverAddress}</div>
              <div class="field"><span class="field-label">Phone:</span> ${waybillData.receiverPhone}</div>
            </div>
            
            <div class="section">
              <div class="section-title">PACKAGE INFORMATION</div>
              <div class="field"><span class="field-label">Description:</span> ${waybillData.packageDescription}</div>
              <div class="field"><span class="field-label">Weight:</span> ${waybillData.weight}</div>
              <div class="field"><span class="field-label">Dimensions:</span> ${waybillData.dimensions}</div>
              <div class="field"><span class="field-label">Service Type:</span> ${waybillData.serviceType}</div>
              <div class="field"><span class="field-label">Declared Value:</span> ${waybillData.declaredValue}</div>
            </div>
            
            ${
              waybillData.specialInstructions
                ? `
            <div class="section">
              <div class="section-title">SPECIAL INSTRUCTIONS</div>
              <div>${waybillData.specialInstructions}</div>
            </div>
            `
                : ""
            }
            
            <div class="footer">
              <p>Generated on: ${new Date().toLocaleString()}</p>
              <p>This is a computer-generated waybill</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  if (showPreview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Waybill Generated Successfully
          </CardTitle>
          <CardDescription>Waybill #{waybillData.waybillNumber} has been created</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <Button onClick={printWaybill} className="flex-1">
              <Printer className="mr-2 h-4 w-4" />
              Print Waybill
            </Button>
            <Button onClick={downloadWaybill} variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>

          <div className="border rounded-lg p-6 bg-gray-50">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold">DELIVERY WAYBILL</h3>
              <h4 className="text-xl font-semibold">{waybillData.waybillNumber}</h4>
              <div className="text-2xl font-mono mt-2">||||| {waybillData.waybillNumber} |||||</div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-semibold mb-2 border-b">SENDER INFORMATION</h5>
                <p>
                  <strong>Name:</strong> {waybillData.senderName}
                </p>
                <p>
                  <strong>Address:</strong> {waybillData.senderAddress}
                </p>
                <p>
                  <strong>Phone:</strong> {waybillData.senderPhone}
                </p>
              </div>

              <div>
                <h5 className="font-semibold mb-2 border-b">RECEIVER INFORMATION</h5>
                <p>
                  <strong>Name:</strong> {waybillData.receiverName}
                </p>
                <p>
                  <strong>Address:</strong> {waybillData.receiverAddress}
                </p>
                <p>
                  <strong>Phone:</strong> {waybillData.receiverPhone}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h5 className="font-semibold mb-2 border-b">PACKAGE INFORMATION</h5>
              <div className="grid md:grid-cols-2 gap-4">
                <p>
                  <strong>Description:</strong> {waybillData.packageDescription}
                </p>
                <p>
                  <strong>Weight:</strong> {waybillData.weight}
                </p>
                <p>
                  <strong>Dimensions:</strong> {waybillData.dimensions}
                </p>
                <p>
                  <strong>Service Type:</strong> {waybillData.serviceType}
                </p>
                <p>
                  <strong>Declared Value:</strong> {waybillData.declaredValue}
                </p>
              </div>
            </div>

            {waybillData.specialInstructions && (
              <div className="mt-6">
                <h5 className="font-semibold mb-2 border-b">SPECIAL INSTRUCTIONS</h5>
                <p>{waybillData.specialInstructions}</p>
              </div>
            )}
          </div>

          <Button onClick={() => setShowPreview(false)} variant="outline" className="w-full">
            Generate Another Waybill
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Generate Waybill/Label
        </CardTitle>
        <CardDescription>Create a shipping waybill for package tracking and delivery</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Sender Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Sender Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="senderName">Sender Name *</Label>
                <Input
                  id="senderName"
                  value={waybillData.senderName}
                  onChange={(e) => handleInputChange("senderName", e.target.value)}
                  placeholder="Enter sender name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderAddress">Pickup Address *</Label>
                <Textarea
                  id="senderAddress"
                  value={waybillData.senderAddress}
                  onChange={(e) => handleInputChange("senderAddress", e.target.value)}
                  placeholder="Enter pickup address"
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderPhone">Sender Phone *</Label>
                <Input
                  id="senderPhone"
                  type="tel"
                  value={waybillData.senderPhone}
                  onChange={(e) => handleInputChange("senderPhone", e.target.value)}
                  placeholder="Enter sender phone"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Receiver Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Receiver Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receiverName">Receiver Name *</Label>
                <Input
                  id="receiverName"
                  value={waybillData.receiverName}
                  onChange={(e) => handleInputChange("receiverName", e.target.value)}
                  placeholder="Enter receiver name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiverAddress">Delivery Address *</Label>
                <Textarea
                  id="receiverAddress"
                  value={waybillData.receiverAddress}
                  onChange={(e) => handleInputChange("receiverAddress", e.target.value)}
                  placeholder="Enter delivery address"
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiverPhone">Receiver Phone *</Label>
                <Input
                  id="receiverPhone"
                  type="tel"
                  value={waybillData.receiverPhone}
                  onChange={(e) => handleInputChange("receiverPhone", e.target.value)}
                  placeholder="Enter receiver phone"
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Package Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Package Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="waybillNumber">Waybill Number</Label>
                <div className="flex gap-2">
                  <Input
                    id="waybillNumber"
                    value={waybillData.waybillNumber}
                    onChange={(e) => handleInputChange("waybillNumber", e.target.value)}
                    placeholder="Auto-generated"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleInputChange("waybillNumber", generateWaybillNumber())}
                  >
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type</Label>
                <Select
                  value={waybillData.serviceType}
                  onValueChange={(value) => handleInputChange("serviceType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Delivery</SelectItem>
                    <SelectItem value="express">Express Delivery</SelectItem>
                    <SelectItem value="overnight">Overnight Delivery</SelectItem>
                    <SelectItem value="same-day">Same Day Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="packageDescription">Package Description *</Label>
              <Input
                id="packageDescription"
                value={waybillData.packageDescription}
                onChange={(e) => handleInputChange("packageDescription", e.target.value)}
                placeholder="Describe the package contents"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  value={waybillData.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  placeholder="0.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dimensions">Dimensions (L×W×H cm)</Label>
                <Input
                  id="dimensions"
                  value={waybillData.dimensions}
                  onChange={(e) => handleInputChange("dimensions", e.target.value)}
                  placeholder="20×15×10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="declaredValue">Declared Value ($)</Label>
                <Input
                  id="declaredValue"
                  value={waybillData.declaredValue}
                  onChange={(e) => handleInputChange("declaredValue", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={waybillData.specialInstructions}
                onChange={(e) => handleInputChange("specialInstructions", e.target.value)}
                placeholder="Any special handling or delivery instructions..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 justify-end">
          <Button
            onClick={saveWaybill}
            disabled={
              loading || !waybillData.senderName || !waybillData.receiverName || !waybillData.packageDescription
            }
            className="px-8"
          >
            {loading ? "Generating..." : "Generate Waybill"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
