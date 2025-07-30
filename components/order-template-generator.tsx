"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Download, Info } from "lucide-react"

export function OrderTemplateGenerator() {
  const generateCSVTemplate = () => {
    const headers = [
      "order_number",
      "customer_name",
      "customer_phone",
      "customer_email",
      "pickup_address",
      "delivery_address",
      "delivery_notes",
      "priority",
    ]

    const sampleData = [
      [
        "ORD-001",
        "John Doe",
        "+1234567890",
        "john@example.com",
        "123 Main St, City, State",
        "456 Oak Ave, City, State",
        "Ring doorbell twice",
        "normal",
      ],
      [
        "ORD-002",
        "Jane Smith",
        "", // Empty phone to show it's optional
        "jane@example.com",
        "789 Pine St, City, State",
        "321 Elm St, City, State",
        "Leave at front door",
        "urgent",
      ],
      [
        "ORD-003",
        "Bob Johnson",
        "+1122334455",
        "", // Empty email to show it's optional
        "555 Cedar Rd, City, State",
        "777 Maple Dr, City, State",
        "Call upon arrival",
        "high",
      ],
    ]

    const csvContent = [headers, ...sampleData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "order-import-template.csv"
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const generateInstructionsPDF = () => {
    const instructionsHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulk Order Upload Instructions</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .section { margin-bottom: 25px; }
          .field-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .field-table th, .field-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          .field-table th { background-color: #f2f2f2; font-weight: bold; }
          .required { color: #dc3545; font-weight: bold; }
          .optional { color: #6c757d; }
          .example { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 10px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 Bulk Order Upload Instructions</h1>
          <p>Follow this guide to properly format your CSV/Excel file for bulk order uploads.</p>
        </div>

        <div class="section">
          <h2>📋 Required File Format</h2>
          <p>Your file must be in CSV format (.csv) or Excel format (.xlsx, .xls)</p>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> The first row must contain the column headers exactly as specified below.
          </div>
        </div>

        <div class="section">
          <h2>📊 Column Specifications</h2>
          <table class="field-table">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Required</th>
                <th>Description</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>order_number</strong></td>
                <td class="required">Required</td>
                <td>Unique identifier for the order</td>
                <td>ORD-001, ORDER-2024-001</td>
              </tr>
              <tr>
                <td><strong>customer_name</strong></td>
                <td class="required">Required</td>
                <td>Full name of the customer</td>
                <td>John Doe, Jane Smith</td>
              </tr>
              <tr>
                <td><strong>customer_phone</strong></td>
                <td class="optional">Optional</td>
                <td>Customer's phone number (can be empty)</td>
                <td>+1234567890, (555) 123-4567, or leave empty</td>
              </tr>
              <tr>
                <td><strong>customer_email</strong></td>
                <td class="optional">Optional</td>
                <td>Customer's email address (can be empty)</td>
                <td>john@example.com or leave empty</td>
              </tr>
              <tr>
                <td><strong>pickup_address</strong></td>
                <td class="required">Required</td>
                <td>Complete pickup address</td>
                <td>123 Main St, City, State 12345</td>
              </tr>
              <tr>
                <td><strong>delivery_address</strong></td>
                <td class="required">Required</td>
                <td>Complete delivery address</td>
                <td>456 Oak Ave, City, State 67890</td>
              </tr>
              <tr>
                <td><strong>delivery_notes</strong></td>
                <td class="optional">Optional</td>
                <td>Special delivery instructions</td>
                <td>Ring doorbell, Leave at door, or leave empty</td>
              </tr>
              <tr>
                <td><strong>priority</strong></td>
                <td class="optional">Optional</td>
                <td>Order priority level (defaults to normal)</td>
                <td>low, normal, high, urgent</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>✅ Best Practices</h2>
          <ul>
            <li>Use double quotes around fields that contain commas</li>
            <li>Ensure all required fields are filled</li>
            <li>Optional fields can be left empty (but include the column)</li>
            <li>Test with a small batch first</li>
            <li>Keep order numbers unique</li>
            <li>Priority defaults to 'normal' if not specified</li>
          </ul>
        </div>

        <div class="section">
          <h2>🔍 Example CSV Content</h2>
          <div class="example">
            <pre>order_number,customer_name,customer_phone,customer_email,pickup_address,delivery_address,delivery_notes,priority
"ORD-001","John Doe","+1234567890","john@example.com","123 Main St, City","456 Oak Ave, City","Ring doorbell","normal"
"ORD-002","Jane Smith","","jane@example.com","789 Pine St, City","321 Elm St, City","Leave at door","urgent"
"ORD-003","Bob Johnson","+1122334455","","555 Cedar Rd, City","777 Maple Dr, City","","high"</pre>
          </div>
        </div>

        <div class="section">
          <h2>🚨 Common Errors to Avoid</h2>
          <ul>
            <li>Missing required column headers</li>
            <li>Empty required fields (order_number, customer_name, pickup_address, delivery_address)</li>
            <li>Duplicate order numbers</li>
            <li>Incorrect file format</li>
            <li>Invalid priority values (must be: low, normal, high, urgent)</li>
            <li>Special characters in addresses without proper quoting</li>
          </ul>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(instructionsHTML)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Download Templates & Instructions
        </CardTitle>
        <CardDescription>Get the CSV template and detailed instructions for bulk order uploads</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={generateCSVTemplate}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <Download className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">Download CSV Template</div>
              <div className="text-sm text-muted-foreground">Pre-formatted with sample data</div>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={generateInstructionsPDF}
            className="h-auto p-4 flex flex-col items-center gap-2"
          >
            <Info className="h-6 w-6" />
            <div className="text-center">
              <div className="font-medium">View Instructions</div>
              <div className="text-sm text-muted-foreground">Detailed formatting guide</div>
            </div>
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">📋 Quick Reference</h4>
          <p className="text-sm text-blue-700">
            <strong>Required fields:</strong> order_number, customer_name, pickup_address, delivery_address
            <br />
            <strong>Optional fields:</strong> customer_phone, customer_email, delivery_notes, priority
            <br />
            <strong>Priority values:</strong> low, normal, high, urgent (defaults to normal)
            <br />
            <strong>Supported formats:</strong> .csv, .xlsx, .xls
            <br />
            <strong>Note:</strong> Optional fields can be left empty but must include the column headers
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
