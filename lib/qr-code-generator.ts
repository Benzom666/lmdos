import { generateOptimizedBarcode } from "./barcode-generator"

export interface QRCodeOptions {
  size: number
  margin: number
  color: {
    dark: string
    light: string
  }
  errorCorrectionLevel: "L" | "M" | "Q" | "H"
}

export const defaultQROptions: QRCodeOptions = {
  size: 100,
  margin: 1,
  color: {
    dark: "#000000",
    light: "#FFFFFF",
  },
  errorCorrectionLevel: "M",
}

// Generate QR code data for an order
export function generateQRCodeData(order: any): string {
  const qrData = {
    orderNumber: order.order_number,
    customerName: order.customer_name,
    deliveryAddress: order.delivery_address,
    status: order.status,
    priority: order.priority,
    createdAt: order.created_at,
    trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com"}/track/${order.order_number}`,
  }

  return JSON.stringify(qrData)
}

// Generate QR code using external service as fallback
export async function generateTrackingQRCode(order: any): Promise<string> {
  try {
    const trackingData = generateQRCodeData(order)
    const encodedData = encodeURIComponent(trackingData)

    // Use QR Server API as a reliable fallback
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodedData}&ecc=H&format=png`

    // Test if the URL is accessible
    const response = await fetch(qrCodeUrl, { method: "HEAD" })
    if (response.ok) {
      return qrCodeUrl
    } else {
      throw new Error("QR service unavailable")
    }
  } catch (error) {
    console.warn("QR code generation failed, using fallback:", error)
    // Return a simple data URL with order number as fallback
    return generateFallbackQRCode(order.order_number)
  }
}

// Generate a simple fallback QR code using canvas
function generateFallbackQRCode(orderNumber: string): string {
  try {
    // Create a simple canvas-based QR code placeholder
    const canvas = document.createElement("canvas")
    canvas.width = 120
    canvas.height = 120
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return generateTextQRCode(orderNumber)
    }

    // Fill background
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, 120, 120)

    // Draw border
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 2
    ctx.strokeRect(5, 5, 110, 110)

    // Draw simple pattern
    ctx.fillStyle = "#000000"
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(10 + i * 10, 10 + j * 10, 8, 8)
        }
      }
    }

    // Add order number text
    ctx.fillStyle = "#000000"
    ctx.font = "8px Arial"
    ctx.textAlign = "center"
    ctx.fillText(orderNumber, 60, 65)

    return canvas.toDataURL("image/png")
  } catch (error) {
    console.warn("Canvas QR code generation failed:", error)
    return generateTextQRCode(orderNumber)
  }
}

// Generate a text-based QR code as final fallback
function generateTextQRCode(orderNumber: string): string {
  // Create a simple SVG QR code placeholder
  const svg = `
    <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" fill="white" stroke="black" stroke-width="2"/>
      <text x="60" y="60" text-anchor="middle" font-family="Arial" font-size="10" fill="black">${orderNumber}</text>
      <text x="60" y="75" text-anchor="middle" font-family="Arial" font-size="8" fill="black">QR Code</text>
    </svg>
  `

  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// Enhanced barcode generation using the new system
export function generateBarcodePattern(
  text: string,
  scannerType: "handheld" | "fixed" | "mobile" | "industrial" = "handheld",
): string {
  try {
    const result = generateOptimizedBarcode(text, scannerType)

    // Log quality warnings for debugging
    if (result.quality.warnings.length > 0) {
      console.warn(`Barcode quality warnings for ${text}:`, result.quality.warnings)
    }

    return result.dataURL
  } catch (error) {
    console.error("Enhanced barcode generation failed, using fallback:", error)
    return generateFallbackBarcode(text)
  }
}

// Generate barcode specifically for PDF documents
export async function generatePDFBarcodePattern(
  text: string,
  scannerType: "handheld" | "fixed" | "mobile" | "industrial" = "handheld",
): Promise<string> {
  try {
    const { generatePDFBarcode } = await import("./barcode-generator")
    const result = await generatePDFBarcode(text, scannerType)

    // Log quality warnings for debugging
    if (result.quality.warnings.length > 0) {
      console.warn(`Barcode quality warnings for ${text}:`, result.quality.warnings)
    }

    return result.dataURL
  } catch (error) {
    console.error("PDF barcode generation failed, using fallback:", error)
    return generateFallbackBarcodeAsPNG(text)
  }
}

// Generate fallback barcode as PNG for PDF compatibility
function generateFallbackBarcodeAsPNG(text: string): string {
  try {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return generateTextBarcode(text)
    }

    // Set canvas size
    canvas.width = 300
    canvas.height = 80

    // Fill background
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw simple barcode pattern
    ctx.fillStyle = "#000000"
    const barWidth = 2
    const barHeight = 50
    const startX = 20
    const startY = 10

    // Generate simple pattern based on text
    for (let i = 0; i < text.length && i < 40; i++) {
      const charCode = text.charCodeAt(i)
      const pattern = charCode % 4 // 0-3 pattern

      for (let j = 0; j < 4; j++) {
        if ((pattern >> j) & 1) {
          ctx.fillRect(startX + (i * 4 + j) * barWidth, startY, barWidth, barHeight)
        }
      }
    }

    // Add text
    ctx.fillStyle = "#000000"
    ctx.font = "12px monospace"
    ctx.textAlign = "center"
    ctx.fillText(text, canvas.width / 2, startY + barHeight + 20)

    return canvas.toDataURL("image/png")
  } catch (error) {
    console.warn("Canvas fallback barcode generation failed:", error)
    return generateTextBarcode(text)
  }
}

// Generate text-based barcode as final fallback
function generateTextBarcode(text: string): string {
  const svg = `
    <svg width="300" height="80" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="80" fill="white" stroke="black" stroke-width="1"/>
      <text x="150" y="40" text-anchor="middle" font-family="monospace" font-size="14" fill="black">${text}</text>
      <text x="150" y="60" text-anchor="middle" font-family="Arial" font-size="10" fill="black">Barcode</text>
    </svg>
  `
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// Fallback barcode generation for compatibility
function generateFallbackBarcode(text: string): string {
  // Simple barcode representation using ASCII characters as fallback
  const patterns = {
    "0": "|||  | ||",
    "1": "||  ||| |",
    "2": "|| |||  |",
    "3": "|||||   |",
    "4": "|   |||||",
    "5": "||   ||||",
    "6": "|||   |||",
    "7": "||||   ||",
    "8": "|||||   |",
    "9": "|   |||||",
    A: "|| ||| ||",
    B: "||| || ||",
    C: "|||| | ||",
    D: "|| |||| |",
    E: "||| ||| |",
    F: "|||| ||| ",
    G: "| |||| ||",
    H: "|| | ||||",
    I: "||| | |||",
    J: "|| || |||",
    K: "| ||| |||",
    L: "|| ||| ||",
    M: "||| ||| |",
    N: "| |||| ||",
    O: "|| |||| |",
    P: "||| |||| ",
    Q: "| | ||||||",
    R: "|| | |||||",
    S: "||| | ||||",
    T: "| || |||||",
    U: "||||| | ||",
    V: "|||||| | |",
    W: "||||| || |",
    X: "| ||||| ||",
    Y: "|| ||||| |",
    Z: "||| ||||| ",
    "-": "| || || ||",
    " ": "   ||   ||",
  }

  let barcode = "|| " // Start pattern

  for (const char of text.toUpperCase()) {
    barcode += (patterns[char as keyof typeof patterns] || patterns[" "]) + " "
  }

  barcode += " ||" // End pattern

  return barcode
}

// Generate industry-standard barcode for shipping labels
export function generateShippingBarcode(orderNumber: string): string {
  return generateBarcodePattern(orderNumber, "handheld")
}

// Generate mobile-optimized barcode for driver apps
export function generateMobileBarcode(orderNumber: string): string {
  return generateBarcodePattern(orderNumber, "mobile")
}

// Validate QR code data
export function validateQRCodeData(data: string): boolean {
  try {
    const parsed = JSON.parse(data)
    return !!(parsed.orderNumber && parsed.customerName && parsed.deliveryAddress)
  } catch {
    return false
  }
}

// Extract order information from QR code data
export function parseQRCodeData(data: string): any | null {
  try {
    const parsed = JSON.parse(data)
    if (validateQRCodeData(data)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}
