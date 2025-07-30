import { jsPDF } from "jspdf"
import { generateTrackingQRCode, generatePDFBarcodePattern } from "@/lib/qr-code-generator"

// Label configuration types
export interface LabelConfig {
  size: "small" | "medium" | "large"
  theme: "minimal" | "standard" | "branded"
  includeQR: boolean
  includeBarcode: boolean
  fontSize: "small" | "medium" | "large"
}

// Default label configuration
export const defaultLabelConfig: LabelConfig = {
  size: "medium",
  theme: "standard",
  includeQR: true,
  includeBarcode: true,
  fontSize: "medium",
}

// Generate and print/download a shipping label
export async function generateAndPrintLabel(order: any, download = false): Promise<void> {
  try {
    if (download) {
      await generateLabelPDF(order)
    } else {
      await printLabel(order)
    }
  } catch (error) {
    console.error("Error generating label:", error)
    throw new Error("Failed to generate shipping label")
  }
}

// Generate multiple labels for bulk printing/downloading
export async function generateBulkLabels(orders: any[], download = false): Promise<void> {
  if (orders.length === 0) return Promise.resolve()

  try {
    if (download) {
      await generateBulkLabelsPDF(orders)
    } else {
      await printBulkLabels(orders)
    }
  } catch (error) {
    console.error("Error generating bulk labels:", error)
    throw new Error("Failed to generate bulk shipping labels")
  }
}

// Generate a single label as PDF
async function generateLabelPDF(order: any): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150], // 100mm x 150mm
  })

  try {
    const qrCodeDataURL = await generateTrackingQRCode(order)

    // Add company logo/header
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    pdf.text("SHIPPING LABEL", 10, 15)

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Order: #${order.order_number}`, 10, 20)
    pdf.text(`Priority: ${(order.priority || "NORMAL").toUpperCase()}`, 10, 25)

    // Add QR code
    if (qrCodeDataURL) {
      pdf.addImage(qrCodeDataURL, "PNG", 70, 5, 25, 25)
      pdf.setFontSize(6)
      pdf.text("Scan to Track", 75, 32)
    }

    // Add border line
    pdf.line(10, 35, 90, 35)

    // FROM section
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    pdf.text("FROM:", 10, 45)

    pdf.setFont("helvetica", "normal")
    pdf.text("Your Company Name", 10, 50)
    pdf.text("123 Business Street", 10, 55)
    pdf.text("City, State 12345", 10, 60)
    pdf.text("Phone: (555) 123-4567", 10, 65)

    // TO section
    pdf.setFont("helvetica", "bold")
    pdf.text("TO:", 10, 80)

    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.text(order.customer_name, 10, 85)

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")

    // Split long addresses
    const addressLines = splitText(order.delivery_address, 35)
    let yPos = 90
    addressLines.forEach((line) => {
      pdf.text(line, 10, yPos)
      yPos += 5
    })

    if (order.customer_phone) {
      pdf.text(`Phone: ${order.customer_phone}`, 10, yPos + 5)
      yPos += 5
    }

    // Order details
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    pdf.text("STATUS:", 10, yPos + 15)
    pdf.text("DATE:", 55, yPos + 15)

    pdf.setFont("helvetica", "normal")
    pdf.text(order.status.toUpperCase(), 10, yPos + 20)
    pdf.text(new Date(order.created_at).toLocaleDateString(), 55, yPos + 20)

    // Delivery notes
    if (order.delivery_notes) {
      pdf.setFont("helvetica", "bold")
      pdf.text("DELIVERY NOTES:", 10, yPos + 30)

      pdf.setFont("helvetica", "normal")
      const notesLines = splitText(order.delivery_notes, 40)
      let notesYPos = yPos + 35
      notesLines.forEach((line) => {
        pdf.text(line, 10, notesYPos)
        notesYPos += 4
      })
    }

    // Enhanced Barcode - PDF Compatible
    try {
      const barcodeDataURL = await generatePDFBarcodePattern(order.order_number, "handheld")
      if (barcodeDataURL && barcodeDataURL.startsWith("data:image/png")) {
        // Add barcode image
        pdf.addImage(barcodeDataURL, "PNG", 10, 120, 80, 15)

        // Add order number text below barcode
        pdf.setFontSize(8)
        pdf.setFont("helvetica", "bold")
        pdf.text(order.order_number, 50, 138)
      } else {
        // Fallback to text only
        pdf.setFontSize(10)
        pdf.setFont("courier", "normal")
        pdf.text(order.order_number, 35, 135)
      }
    } catch (error) {
      console.warn("Barcode generation failed, using text fallback:", error)
      // Text fallback
      pdf.setFontSize(10)
      pdf.setFont("courier", "normal")
      pdf.text(order.order_number, 35, 135)
    }

    // Footer
    pdf.setFontSize(6)
    pdf.setFont("helvetica", "normal")
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 145)

    pdf.save(`shipping-label-${order.order_number}.pdf`)
  } catch (error) {
    console.error("Error generating PDF:", error)
    throw error
  }
}

// Generate bulk labels as PDF
async function generateBulkLabelsPDF(orders: any[]): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150],
  })

  for (let i = 0; i < orders.length; i++) {
    if (i > 0) {
      pdf.addPage()
    }

    const order = orders[i]

    try {
      const qrCodeDataURL = await generateTrackingQRCode(order)

      // Add content for each label (same as single label)
      pdf.setFontSize(12)
      pdf.setFont("helvetica", "bold")
      pdf.text("SHIPPING LABEL", 10, 15)

      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Order: #${order.order_number}`, 10, 20)
      pdf.text(`Priority: ${(order.priority || "NORMAL").toUpperCase()}`, 10, 25)

      if (qrCodeDataURL) {
        pdf.addImage(qrCodeDataURL, "PNG", 70, 5, 25, 25)
        pdf.setFontSize(6)
        pdf.text("Scan to Track", 75, 32)
      }

      pdf.line(10, 35, 90, 35)

      // FROM section
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      pdf.text("FROM:", 10, 45)

      pdf.setFont("helvetica", "normal")
      pdf.text("Your Company Name", 10, 50)
      pdf.text("123 Business Street", 10, 55)
      pdf.text("City, State 12345", 10, 60)
      pdf.text("Phone: (555) 123-4567", 10, 65)

      // TO section
      pdf.setFont("helvetica", "bold")
      pdf.text("TO:", 10, 80)

      pdf.setFontSize(10)
      pdf.setFont("helvetica", "bold")
      pdf.text(order.customer_name, 10, 85)

      pdf.setFontSize(9)
      pdf.setFont("helvetica", "normal")

      const addressLines = splitText(order.delivery_address, 35)
      let yPos = 90
      addressLines.forEach((line) => {
        pdf.text(line, 10, yPos)
        yPos += 5
      })

      if (order.customer_phone) {
        pdf.text(`Phone: ${order.customer_phone}`, 10, yPos + 5)
        yPos += 5
      }

      // Order details
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "bold")
      pdf.text("STATUS:", 10, yPos + 15)
      pdf.text("DATE:", 55, yPos + 15)

      pdf.setFont("helvetica", "normal")
      pdf.text(order.status.toUpperCase(), 10, yPos + 20)
      pdf.text(new Date(order.created_at).toLocaleDateString(), 55, yPos + 20)

      // Delivery notes
      if (order.delivery_notes) {
        pdf.setFont("helvetica", "bold")
        pdf.text("DELIVERY NOTES:", 10, yPos + 30)

        pdf.setFont("helvetica", "normal")
        const notesLines = splitText(order.delivery_notes, 40)
        let notesYPos = yPos + 35
        notesLines.forEach((line) => {
          pdf.text(line, 10, notesYPos)
          notesYPos += 4
        })
      }

      // Enhanced Barcode - PDF Compatible
      try {
        const barcodeDataURL = await generatePDFBarcodePattern(order.order_number, "handheld")
        if (barcodeDataURL && barcodeDataURL.startsWith("data:image/png")) {
          // Add barcode image
          pdf.addImage(barcodeDataURL, "PNG", 10, 120, 80, 15)

          // Add order number text below barcode
          pdf.setFontSize(8)
          pdf.setFont("helvetica", "bold")
          pdf.text(order.order_number, 50, 138)
        } else {
          // Fallback to text only
          pdf.setFontSize(10)
          pdf.setFont("courier", "normal")
          pdf.text(order.order_number, 35, 135)
        }
      } catch (error) {
        console.warn("Barcode generation failed, using text fallback:", error)
        // Text fallback
        pdf.setFontSize(10)
        pdf.setFont("courier", "normal")
        pdf.text(order.order_number, 35, 135)
      }

      // Footer
      pdf.setFontSize(6)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 145)
    } catch (error) {
      console.error(`Error generating label for order ${order.order_number}:`, error)
      // Continue with next order
    }
  }

  pdf.save(`shipping-labels-batch-${new Date().toISOString().slice(0, 10)}.pdf`)
}

// Print a single label using browser print
async function printLabel(order: any): Promise<void> {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    throw new Error("Could not open print window. Please check your popup settings.")
  }

  try {
    const qrCodeDataURL = await generateTrackingQRCode(order)
    const barcodePattern = await generatePDFBarcodePattern(order.order_number, "handheld")

    const labelHTML = createPrintableLabelHTML(order, qrCodeDataURL, barcodePattern)

    printWindow.document.write(`
      <html>
        <head>
          <title>Shipping Label - ${order.order_number}</title>
          <style>
            @page {
              size: 100mm 150mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background: white;
              color: black;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${labelHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 1000);
              }, 500);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  } catch (error) {
    printWindow.close()
    throw error
  }
}

// Print bulk labels
async function printBulkLabels(orders: any[]): Promise<void> {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    throw new Error("Could not open print window. Please check your popup settings.")
  }

  try {
    let labelsHTML = ""

    for (const order of orders) {
      try {
        const qrCodeDataURL = await generateTrackingQRCode(order)
        const barcodePattern = await generatePDFBarcodePattern(order.order_number, "handheld")
        const labelHTML = createPrintableLabelHTML(order, qrCodeDataURL, barcodePattern)
        labelsHTML += `<div class="page-break">${labelHTML}</div>`
      } catch (error) {
        console.error(`Error generating label for order ${order.order_number}:`, error)
      }
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Shipping Labels - Batch Print</title>
          <style>
            @page {
              size: 100mm 150mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background: white;
              color: black;
            }
            .page-break {
              page-break-after: always;
            }
            .page-break:last-child {
              page-break-after: avoid;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${labelsHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 1000);
              }, 500);
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  } catch (error) {
    printWindow.close()
    throw error
  }
}

// Create printable label HTML with inline styles only
function createPrintableLabelHTML(order: any, qrCodeDataURL: string, barcodePattern: string): string {
  return `
    <div style="
      width: 100mm;
      height: 150mm;
      border: 2px solid black;
      padding: 5mm;
      font-family: Arial, sans-serif;
      font-size: 10px;
      line-height: 1.2;
      background: white;
      color: black;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    ">
      <!-- Header -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid black;
        padding-bottom: 3mm;
        margin-bottom: 3mm;
      ">
        <div>
          <div style="font-weight: bold; font-size: 12px;">SHIPPING LABEL</div>
          <div style="font-size: 9px; margin-top: 1mm;">Order: #${order.order_number}</div>
          <div style="font-size: 8px; color: #666;">Priority: ${(order.priority || "NORMAL").toUpperCase()}</div>
        </div>
        <div style="text-align: center;">
          <img src="${qrCodeDataURL}" alt="QR Code" style="width: 20mm; height: 20mm; border: 1px solid #ccc;" />
          <div style="font-size: 6px; margin-top: 1mm;">Scan to Track</div>
        </div>
      </div>
      
      <!-- From Address -->
      <div style="margin-bottom: 5mm;">
        <div style="font-weight: bold; font-size: 8px; margin-bottom: 1mm;">FROM:</div>
        <div style="font-size: 9px;">
          <div style="font-weight: bold;">Your Company Name</div>
          <div>123 Business Street</div>
          <div>City, State 12345</div>
          <div>Phone: (555) 123-4567</div>
        </div>
      </div>
      
      <!-- To Address -->
      <div style="margin-bottom: 5mm; flex-grow: 1;">
        <div style="font-weight: bold; font-size: 8px; margin-bottom: 1mm;">TO:</div>
        <div style="font-size: 11px;">
          <div style="font-weight: bold; margin-bottom: 1mm;">${order.customer_name}</div>
          <div style="margin-bottom: 1mm;">${order.delivery_address}</div>
          ${order.customer_phone ? `<div style="font-size: 9px;">Phone: ${order.customer_phone}</div>` : ""}
          ${order.customer_email ? `<div style="font-size: 9px;">Email: ${order.customer_email}</div>` : ""}
        </div>
      </div>
      
      <!-- Order Details -->
      <div style="margin-bottom: 5mm; display: flex; justify-content: space-between;">
        <div style="width: 45%;">
          <div style="font-weight: bold; font-size: 8px;">STATUS:</div>
          <div style="font-size: 9px; text-transform: uppercase; padding: 1mm; background: #f0f0f0; border: 1px solid #ccc;">${order.status}</div>
        </div>
        <div style="width: 45%;">
          <div style="font-weight: bold; font-size: 8px;">DATE:</div>
          <div style="font-size: 9px; padding: 1mm; background: #f0f0f0; border: 1px solid #ccc;">${new Date(order.created_at).toLocaleDateString()}</div>
        </div>
      </div>
      
      <!-- Delivery Notes -->
      ${
        order.delivery_notes
          ? `
        <div style="margin-bottom: 5mm;">
          <div style="font-weight: bold; font-size: 8px; margin-bottom: 1mm;">DELIVERY NOTES:</div>
          <div style="font-size: 8px; padding: 2mm; background: #fffacd; border: 1px solid #ddd;">${order.delivery_notes}</div>
        </div>
      `
          : ""
      }
      
      <!-- Enhanced Barcode -->
      <div style="margin-top: auto; border-top: 1px solid black; padding-top: 2mm; text-align: center;">
        ${
          barcodePattern && barcodePattern.startsWith("data:")
            ? `<img src="${barcodePattern}" alt="Barcode" style="max-width: 80mm; height: auto; image-rendering: pixelated;" />`
            : `<div style="font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 1px; padding: 2mm; border: 1px solid #ccc; background: #f9f9f9;">${order.order_number}</div>`
        }
        <div style="font-size: 9px; font-weight: bold; margin-top: 1mm;">${order.order_number}</div>
        <div style="font-size: 6px; color: #666; margin-top: 1mm;">CODE128 - Scanner Ready</div>
      </div>
      
      <!-- Footer -->
      <div style="font-size: 6px; text-align: center; margin-top: 2mm; color: #666;">
        Generated: ${new Date().toLocaleString()}
      </div>
    </div>
  `
}

// Utility function to split long text into multiple lines
function splitText(text: string, maxLength: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    if ((currentLine + word).length <= maxLength) {
      currentLine += (currentLine ? " " : "") + word
    } else {
      if (currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        // Word is longer than maxLength, split it
        lines.push(word.substring(0, maxLength))
        currentLine = word.substring(maxLength)
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}
