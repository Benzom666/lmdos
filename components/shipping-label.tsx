"use client"

import { QRCodeSVG } from "qrcode.react"
import { cn } from "@/lib/utils"
import { generateShippingBarcode } from "@/lib/qr-code-generator"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle } from "lucide-react"

interface ShippingLabelProps {
  order: any
  labelConfig: {
    size: "small" | "medium" | "large"
    theme: "minimal" | "standard" | "branded"
    includeQR: boolean
    includeBarcode: boolean
    fontSize: "small" | "medium" | "large"
    scannerOptimized?: boolean
    includeValidation?: boolean
  }
  className?: string
  validationStatus?: "valid" | "warning" | "error" | null
}

export function ShippingLabel({ order, labelConfig, className, validationStatus }: ShippingLabelProps) {
  const [barcodeDataURL, setBarcodeDataURL] = useState<string>("")
  const [qrData, setQrData] = useState<string>("")

  useEffect(() => {
    if (order?.order_number && labelConfig.includeBarcode) {
      try {
        const barcode = generateShippingBarcode(order.order_number)
        setBarcodeDataURL(barcode)
      } catch (error) {
        console.error("Failed to generate barcode:", error)
        setBarcodeDataURL("")
      }
    }
  }, [order?.order_number, labelConfig.includeBarcode])

  useEffect(() => {
    if (order && labelConfig.includeQR) {
      const qrPayload = {
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        deliveryAddress: order.delivery_address,
        customerPhone: order.customer_phone,
        priority: order.priority || "normal",
        status: order.status,
        createdAt: order.created_at,
        trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/track/${order.order_number}`,
        // Add validation data for scanner
        labelVersion: "2.0",
        generatedAt: new Date().toISOString(),
        driverId: order.driver_id,
        scannerOptimized: labelConfig.scannerOptimized,
      }
      setQrData(JSON.stringify(qrPayload))
    }
  }, [order, labelConfig])

  if (!order) {
    return (
      <div className={cn("border rounded-lg p-4 bg-gray-50", className)}>
        <p className="text-center text-muted-foreground">No order data available</p>
      </div>
    )
  }

  const sizeClasses = {
    small: "w-[225px] h-[125px] text-xs",
    medium: "w-[400px] h-[300px] text-sm",
    large: "w-[400px] h-[600px] text-base",
  }

  const fontSizeClasses = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  }

  const getValidationIcon = () => {
    switch (validationStatus) {
      case "valid":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getValidationBadge = () => {
    switch (validationStatus) {
      case "valid":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Verified</Badge>
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Warning</Badge>
      case "error":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>
      default:
        return null
    }
  }

  return (
    <div
      className={cn(
        "border-2 border-black bg-white p-4 font-mono print:border-black print:bg-white relative",
        sizeClasses[labelConfig.size],
        fontSizeClasses[labelConfig.fontSize],
        validationStatus === "error" && "border-red-500",
        validationStatus === "warning" && "border-yellow-500",
        validationStatus === "valid" && "border-green-500",
        className,
      )}
    >
      {/* Validation Status Indicator */}
      {labelConfig.includeValidation && validationStatus && (
        <div className="absolute top-2 right-2 flex items-center space-x-1">
          {getValidationIcon()}
          {getValidationBadge()}
        </div>
      )}

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-black pb-2 mb-2">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-bold text-lg">SHIPPING LABEL</h1>
              <p className="text-xs">Order: #{order.order_number}</p>
              {labelConfig.scannerOptimized && (
                <div className="flex items-center space-x-1 mt-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">Scanner Optimized</span>
                </div>
              )}
            </div>
            {labelConfig.includeQR && qrData && (
              <div className="flex-shrink-0">
                <QRCodeSVG
                  value={qrData}
                  size={labelConfig.size === "small" ? 40 : labelConfig.size === "medium" ? 60 : 80}
                  level="H"
                  includeMargin={true}
                  className={cn(
                    "border",
                    validationStatus === "valid" && "border-green-500",
                    validationStatus === "warning" && "border-yellow-500",
                    validationStatus === "error" && "border-red-500",
                  )}
                />
                {labelConfig.scannerOptimized && <p className="text-center text-xs mt-1 text-green-600">Enhanced QR</p>}
              </div>
            )}
          </div>
        </div>

        {/* From Address */}
        <div className="mb-3">
          <p className="font-bold text-xs mb-1">FROM:</p>
          <div className="text-xs">
            <p>Your Company Name</p>
            <p>123 Business Street</p>
            <p>City, State 12345</p>
          </div>
        </div>

        {/* To Address */}
        <div className="mb-3 flex-grow">
          <p className="font-bold text-xs mb-1">TO:</p>
          <div className="text-xs">
            <p className="font-bold">{order.customer_name}</p>
            <p>{order.delivery_address}</p>
            {order.customer_phone && <p>Phone: {order.customer_phone}</p>}
          </div>
        </div>

        {/* Order Details */}
        <div className="mb-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="font-bold">Priority:</p>
              <p className="uppercase">{order.priority || "NORMAL"}</p>
            </div>
            <div>
              <p className="font-bold">Status:</p>
              <p className="uppercase">{order.status}</p>
            </div>
          </div>
        </div>

        {/* Driver Assignment */}
        {order.driver_id && (
          <div className="mb-3">
            <p className="font-bold text-xs">ASSIGNED DRIVER:</p>
            <p className="text-xs">ID: {order.driver_id.substring(0, 8)}...</p>
          </div>
        )}

        {/* Delivery Notes */}
        {order.delivery_notes && (
          <div className="mb-3">
            <p className="font-bold text-xs">NOTES:</p>
            <p className="text-xs">{order.delivery_notes}</p>
          </div>
        )}

        {/* Enhanced Barcode */}
        {labelConfig.includeBarcode && (
          <div className="mt-auto">
            <div className="border-t border-black pt-2">
              {barcodeDataURL ? (
                <div className="flex flex-col items-center">
                  <img
                    src={barcodeDataURL || "/placeholder.svg"}
                    alt={`Barcode: ${order.order_number}`}
                    className="max-w-full h-auto"
                    style={{
                      imageRendering: "pixelated",
                      filter: "contrast(1.2)",
                    }}
                  />
                  <p className="text-center text-xs mt-1 font-bold tracking-wider">{order.order_number}</p>
                  {labelConfig.scannerOptimized && (
                    <p className="text-center text-xs text-green-600 mt-1">CODE128 - Scanner Ready</p>
                  )}
                </div>
              ) : (
                <div className="text-center text-xs text-red-600">Barcode generation failed</div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-center mt-2 pt-2 border-t border-black">
          <p>Generated: {new Date().toLocaleDateString()}</p>
          {labelConfig.scannerOptimized && <p className="text-green-600">Industry Standard Compatible</p>}
          {labelConfig.includeValidation && (
            <p className="text-blue-600">Validation: {validationStatus || "Pending"}</p>
          )}
        </div>
      </div>
    </div>
  )
}
