"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Printer, Download, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

interface BulkLabelPrinterProps {
  labels: any[]
  onPrint: () => void
  onDownload: () => void
  onClose: () => void
}

export function BulkLabelPrinter({ labels, onPrint, onDownload, onClose }: BulkLabelPrinterProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [paperSize, setPaperSize] = useState("a4")
  const [layout, setLayout] = useState("2x2")
  const [includeGuides, setIncludeGuides] = useState(true)
  const [printMode, setPrintMode] = useState("all")

  const handlePrint = () => {
    setLoading(true)

    // Simulate printing process
    setTimeout(() => {
      setLoading(false)
      onPrint()
      toast({
        title: "Print job sent",
        description: `${labels.length} labels have been sent to the printer.`,
      })
    }, 1500)
  }

  const handleDownload = () => {
    setLoading(true)

    // Simulate download process
    setTimeout(() => {
      setLoading(false)
      onDownload()
      toast({
        title: "Download ready",
        description: `${labels.length} labels have been prepared for download.`,
      })
    }, 1500)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Bulk Label Printing</CardTitle>
        <CardDescription>Configure and print {labels.length} shipping labels</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="print">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="print">Print Options</TabsTrigger>
            <TabsTrigger value="layout">Layout Options</TabsTrigger>
          </TabsList>

          <TabsContent value="print" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Paper Size</Label>
              <Select value={paperSize} onValueChange={setPaperSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select paper size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter (8.5" × 11")</SelectItem>
                  <SelectItem value="a4">A4 (210mm × 297mm)</SelectItem>
                  <SelectItem value="legal">Legal (8.5" × 14")</SelectItem>
                  <SelectItem value="label">Label Sheet (8.5" × 11")</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Print Mode</Label>
              <Select value={printMode} onValueChange={setPrintMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select print mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Labels</SelectItem>
                  <SelectItem value="unprinted">Unprinted Only</SelectItem>
                  <SelectItem value="new">New Orders Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Cut Guides</Label>
                <p className="text-sm text-muted-foreground">Add dotted lines between labels</p>
              </div>
              <Switch checked={includeGuides} onCheckedChange={setIncludeGuides} />
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Label Layout</Label>
              <Select value={layout} onValueChange={setLayout}>
                <SelectTrigger>
                  <SelectValue placeholder="Select layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1x1">1 × 1 (Single label per page)</SelectItem>
                  <SelectItem value="2x2">2 × 2 (4 labels per page)</SelectItem>
                  <SelectItem value="2x3">2 × 3 (6 labels per page)</SelectItem>
                  <SelectItem value="2x4">2 × 4 (8 labels per page)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Label Preview</Label>
              <div className="border rounded-md p-4 bg-muted/20">
                <div
                  className={`grid gap-2 ${
                    layout === "1x1"
                      ? "grid-cols-1"
                      : layout === "2x2"
                        ? "grid-cols-2"
                        : layout === "2x3"
                          ? "grid-cols-2"
                          : "grid-cols-2"
                  }`}
                >
                  {Array.from({ length: layout === "1x1" ? 1 : layout === "2x2" ? 4 : layout === "2x3" ? 6 : 8 }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className={`border ${includeGuides ? "border-dashed" : "border-solid"} border-gray-400 bg-white p-2 text-center text-xs`}
                        style={{
                          height: layout === "1x1" ? "120px" : "80px",
                        }}
                      >
                        Label {i + 1}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="optimize" />
              <label
                htmlFor="optimize"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Optimize layout to use fewer pages
              </label>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button onClick={handlePrint} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Print {labels.length} Labels
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
