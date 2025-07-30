"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { generateOptimizedBarcode } from "@/lib/barcode-generator"
import { AlertTriangle, CheckCircle, Download, Eye, Smartphone, Scan } from "lucide-react"

interface BarcodeTestResult {
  dataURL: string
  config: any
  quality: any
  scannerType: string
  text: string
}

export function BarcodeTester() {
  const [text, setText] = useState("ORD123456789")
  const [scannerType, setScannerType] = useState<"handheld" | "fixed" | "mobile" | "industrial">("handheld")
  const [results, setResults] = useState<BarcodeTestResult[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const generateTestBarcodes = async () => {
    if (!text.trim()) return

    setIsGenerating(true)
    const scannerTypes: Array<"handheld" | "fixed" | "mobile" | "industrial"> = [
      "handheld",
      "fixed",
      "mobile",
      "industrial",
    ]
    const newResults: BarcodeTestResult[] = []

    for (const type of scannerTypes) {
      try {
        const result = generateOptimizedBarcode(text.trim(), type)
        newResults.push({
          ...result,
          scannerType: type,
          text: text.trim(),
        })
      } catch (error) {
        console.error(`Failed to generate barcode for ${type}:`, error)
      }
    }

    setResults(newResults)
    setIsGenerating(false)
  }

  const downloadBarcode = (result: BarcodeTestResult) => {
    const link = document.createElement("a")
    link.href = result.dataURL
    link.download = `barcode-${result.text}-${result.scannerType}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getScannerIcon = (type: string) => {
    switch (type) {
      case "handheld":
        return <Scan className="h-4 w-4" />
      case "mobile":
        return <Smartphone className="h-4 w-4" />
      case "fixed":
        return <Eye className="h-4 w-4" />
      case "industrial":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Scan className="h-4 w-4" />
    }
  }

  useEffect(() => {
    if (text.trim()) {
      generateTestBarcodes()
    }
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            Barcode Generator & Tester
          </CardTitle>
          <CardDescription>
            Generate and test industry-standard barcodes optimized for different scanner types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode-text">Barcode Text</Label>
              <Input
                id="barcode-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to encode"
                maxLength={48}
              />
              <p className="text-sm text-muted-foreground">{text.length}/48 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scanner-type">Primary Scanner Type</Label>
              <Select value={scannerType} onValueChange={(value: any) => setScannerType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="handheld">Handheld Scanner</SelectItem>
                  <SelectItem value="mobile">Mobile Device</SelectItem>
                  <SelectItem value="fixed">Fixed Scanner</SelectItem>
                  <SelectItem value="industrial">Industrial Scanner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={generateTestBarcodes} disabled={!text.trim() || isGenerating} className="w-full">
            {isGenerating ? "Generating..." : "Generate Test Barcodes"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {results.map((result, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    {getScannerIcon(result.scannerType)}
                    {result.scannerType.charAt(0).toUpperCase() + result.scannerType.slice(1)} Scanner
                  </div>
                  <div className="flex items-center gap-2">
                    {result.quality.isValid ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Issues
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Barcode Display */}
                <div className="flex justify-center p-4 bg-white border rounded-lg">
                  <img
                    src={result.dataURL || "/placeholder.svg"}
                    alt={`Barcode for ${result.text}`}
                    className="max-w-full h-auto"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>

                {/* Configuration Details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Width:</span> {result.config.width}px
                  </div>
                  <div>
                    <span className="font-medium">Height:</span> {result.config.height}px
                  </div>
                  <div>
                    <span className="font-medium">Quiet Zone:</span> {result.config.quiet}px
                  </div>
                  <div>
                    <span className="font-medium">Format:</span> {result.config.format}
                  </div>
                </div>

                {/* Quality Warnings */}
                {result.quality.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        {result.quality.warnings.map((warning: string, idx: number) => (
                          <div key={idx} className="text-sm">
                            • {warning}
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Recommendations */}
                {result.quality.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Recommendations:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {result.quality.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-500">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadBarcode(result)} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Scanner Compatibility Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Handheld Scanners</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Minimum bar width: 2-3px</li>
                <li>• Height: 80-100px</li>
                <li>• Quiet zone: 10-15px</li>
                <li>• High contrast (black on white)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Mobile Devices</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Larger bars: 3-4px width</li>
                <li>• Height: 100-120px</li>
                <li>• Extended quiet zone: 15-20px</li>
                <li>• Clear text labels</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Fixed Scanners</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Consistent sizing: 2px width</li>
                <li>• Standard height: 80px</li>
                <li>• Minimal quiet zone: 8-12px</li>
                <li>• Optimized for speed</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Industrial Scanners</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Robust sizing: 4px+ width</li>
                <li>• Tall height: 120-150px</li>
                <li>• Large quiet zone: 20-25px</li>
                <li>• Damage resistant</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
