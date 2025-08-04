"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Info, CheckCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function OrderTemplateGenerator() {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)

  const generateCSVTemplate = () => {
    setIsGenerating(true)

    try {
      // CSV headers with proper formatting
      const headers = [
        "order_number",
        "customer_name",
        "customer_phone",
        "customer_email",
        "pickup_address",
        "delivery_address",
        "priority",
        "delivery_notes",
      ]

      // Sample data rows
      const sampleData = [
        [
          "ORD-001",
          "John Smith",
          "+1-555-0123",
          "john.smith@email.com",
          "123 Warehouse St, Toronto, ON M5V 1A1",
          "456 Customer Ave, Toronto, ON M4W 2B2",
          "normal",
          "Ring doorbell twice, leave at front door",
        ],
        [
          "ORD-002",
          "Sarah Johnson",
          "+1-555-0124",
          "sarah.j@email.com",
          "789 Distribution Blvd, Toronto, ON M6K 3C3",
          "321 Residential Rd, Toronto, ON M5T 1D4",
          "high",
          "Apartment 4B, call on arrival",
        ],
        [
          "ORD-003",
          "Mike Wilson",
          "+1-555-0125",
          "mike.wilson@email.com",
          "555 Supply Chain Dr, Toronto, ON M8X 2E5",
          "888 Delivery Lane, Toronto, ON M9Y 3F6",
          "urgent",
          "Business delivery, ask for reception",
        ],
      ]

      // Create CSV content with proper escaping
      const csvContent = [
        headers.join(","),
        ...sampleData.map((row) =>
          row
            .map((field) => {
              // Escape fields that contain commas, quotes, or newlines
              if (field.includes(",") || field.includes('"') || field.includes("\n")) {
                return `"${field.replace(/"/g, '""')}"`
              }
              return field
            })
            .join(","),
        ),
      ].join("\n")

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)

      link.setAttribute("href", url)
      link.setAttribute("download", `order-template-${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)

      toast({
        title: "Template Downloaded",
        description: "CSV template with sample data has been downloaded successfully.",
      })
    } catch (error) {
      console.error("Error generating template:", error)
      toast({
        title: "Download Failed",
        description: "Failed to generate CSV template. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const generateInstructions = () => {
    const instructions = `
# Order Upload Instructions

## CSV Format Requirements

### Required Fields:
- **order_number**: Unique identifier for each order
- **customer_name**: Full name of the customer
- **pickup_address**: Complete pickup address with postal code
- **delivery_address**: Complete delivery address with postal code

### Optional Fields:
- **customer_phone**: Customer contact number (format: +1-555-0123)
- **customer_email**: Customer email address
- **priority**: Order priority (low, normal, high, urgent) - defaults to 'normal'
- **delivery_notes**: Special delivery instructions

### File Format:
- Save as CSV (Comma Separated Values)
- Use UTF-8 encoding
- Include header row with field names
- Enclose fields containing commas in quotes

### Example:
\`\`\`
order_number,customer_name,customer_phone,pickup_address,delivery_address,priority,delivery_notes
ORD-001,John Smith,+1-555-0123,"123 Main St, Toronto, ON","456 Oak Ave, Toronto, ON",normal,Ring doorbell twice
\`\`\`

### Tips:
- Test with a small batch first
- Verify addresses are complete and accurate
- Use consistent phone number formatting
- Keep delivery notes concise but informative
`

    const blob = new Blob([instructions], { type: "text/markdown;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", "order-upload-instructions.md")
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)

    toast({
      title: "Instructions Downloaded",
      description: "Detailed upload instructions have been downloaded.",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Download Templates & Instructions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Get the CSV template and detailed instructions for bulk order uploads
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-600" />
              <h4 className="font-medium">Download CSV Template</h4>
            </div>
            <p className="text-sm text-muted-foreground">Pre-formatted with sample data</p>
            <Button onClick={generateCSVTemplate} disabled={isGenerating} className="w-full">
              {isGenerating ? "Generating..." : "Download Template"}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-green-600" />
              <h4 className="font-medium">View Instructions</h4>
            </div>
            <p className="text-sm text-muted-foreground">Detailed formatting guide</p>
            <Button variant="outline" onClick={generateInstructions} className="w-full bg-transparent">
              Download Instructions
            </Button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">Quick Reference</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-white">
                    Required
                  </Badge>
                  <span>order_number, customer_name, pickup_address, delivery_address</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-white">
                    Optional
                  </Badge>
                  <span>customer_phone, customer_email, delivery_notes, priority</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-white">
                    Priority values
                  </Badge>
                  <span>low, normal, high, urgent (defaults to normal)</span>
                </div>
              </div>
              <div className="mt-3 p-2 bg-white rounded border-l-4 border-blue-400">
                <p className="text-xs text-blue-700">
                  <CheckCircle className="h-3 w-3 inline mr-1" />
                  <strong>Note:</strong> Optional fields can be left empty but must include the column headers
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
