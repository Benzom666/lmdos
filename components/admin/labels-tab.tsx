"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { ShippingLabel } from "@/components/shipping-label"
import { BulkLabelGenerator } from "@/components/bulk-label-generator"
import { BulkLabelPrinter } from "@/components/bulk-label-printer"
import {
  FileText,
  Download,
  Printer,
  Plus,
  Search,
  RefreshCw,
  QrCode,
  Settings,
  Trash2,
  Eye,
  Grid,
  List,
  Loader2,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface LabelsTabProps {
  orders: any[]
  onRefresh: () => void
}

export function LabelsTab({ orders, onRefresh }: LabelsTabProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const printRef = useRef<HTMLDivElement>(null)

  const [labels, setLabels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showBulkGenerator, setShowBulkGenerator] = useState(false)
  const [showBulkPrinter, setShowBulkPrinter] = useState(false)
  const [previewLabel, setPreviewLabel] = useState<any>(null)

  const [labelConfig, setLabelConfig] = useState({
    size: "medium" as "small" | "medium" | "large",
    theme: "standard" as "minimal" | "standard" | "branded",
    includeQR: true,
    includeBarcode: true,
    fontSize: "medium" as "small" | "medium" | "large",
  })

  useEffect(() => {
    fetchLabels()
  }, [profile])

  const fetchLabels = async () => {
    if (!profile) return

    try {
      setLoading(true)
      const { data: labelsData, error: labelsError } = await supabase
        .from("shipping_labels")
        .select(`
          *,
          orders (
            id,
            order_number,
            customer_name,
            customer_phone,
            delivery_address,
            pickup_address,
            status,
            priority,
            delivery_notes,
            created_at
          )
        `)
        .eq("created_by", profile.user_id)
        .order("created_at", { ascending: false })

      if (labelsError) throw labelsError

      setLabels(labelsData || [])
    } catch (error) {
      console.error("Error fetching labels:", error)
      toast({
        title: "Error",
        description: "Failed to load shipping labels.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generateSingleLabel = async (order: any) => {
    if (!profile) return

    try {
      const qrData = JSON.stringify({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        deliveryAddress: order.delivery_address,
        trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/track/${order.order_number}`,
      })

      const { data, error } = await supabase
        .from("shipping_labels")
        .insert({
          order_id: order.id,
          label_config: labelConfig,
          qr_data: qrData,
          label_size: labelConfig.size,
          theme: labelConfig.theme,
          status: "generated",
          created_by: profile.user_id,
        })
        .select(`
          *,
          orders (
            id,
            order_number,
            customer_name,
            customer_phone,
            delivery_address,
            pickup_address,
            status,
            priority,
            delivery_notes,
            created_at
          )
        `)
        .single()

      if (error) throw error

      setLabels((prev) => [data, ...prev])
      toast({
        title: "Success",
        description: `Label generated for order #${order.order_number}`,
      })

      return data
    } catch (error) {
      console.error("Error generating label:", error)
      toast({
        title: "Error",
        description: "Failed to generate label. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleBulkGenerate = () => {
    setShowBulkGenerator(true)
  }

  const handleBulkPrint = () => {
    const selectedLabelsList = labels.filter((label) => selectedLabels.has(label.id))
    if (selectedLabelsList.length === 0) {
      toast({
        title: "No labels selected",
        description: "Please select labels to print.",
        variant: "destructive",
      })
      return
    }
    setShowBulkPrinter(true)
  }

  const handlePrintLabels = () => {
    if (printRef.current) {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Shipping Labels</title>
              <style>
                @media print {
                  body { margin: 0; padding: 0; }
                  .label { page-break-after: always; }
                  .label:last-child { page-break-after: avoid; }
                }
                body { font-family: Arial, sans-serif; }
              </style>
            </head>
            <body>
              ${printRef.current.innerHTML}
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  const handleDownloadLabels = () => {
    // In a real implementation, this would generate a PDF
    toast({
      title: "Download Started",
      description: "Labels are being prepared for download.",
    })
  }

  const handleDeleteLabel = async (labelId: string) => {
    try {
      const { error } = await supabase.from("shipping_labels").delete().eq("id", labelId)

      if (error) throw error

      setLabels((prev) => prev.filter((label) => label.id !== labelId))
      setSelectedLabels((prev) => {
        const newSet = new Set(prev)
        newSet.delete(labelId)
        return newSet
      })

      toast({
        title: "Success",
        description: "Label deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting label:", error)
      toast({
        title: "Error",
        description: "Failed to delete label.",
        variant: "destructive",
      })
    }
  }

  const filteredLabels = labels.filter((label) => {
    const matchesSearch =
      label.orders?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      label.orders?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || label.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleSelectAll = () => {
    if (selectedLabels.size === filteredLabels.length) {
      setSelectedLabels(new Set())
    } else {
      setSelectedLabels(new Set(filteredLabels.map((label) => label.id)))
    }
  }

  const handleSelectLabel = (labelId: string) => {
    const newSelected = new Set(selectedLabels)
    if (newSelected.has(labelId)) {
      newSelected.delete(labelId)
    } else {
      newSelected.add(labelId)
    }
    setSelectedLabels(newSelected)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Shipping Labels</h2>
          <p className="text-sm text-muted-foreground">Generate, manage, and print shipping labels for your orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBulkGenerate}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Labels
          </Button>
          <Button variant="outline" onClick={() => fetchLabels()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search labels by order number or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="generated">Generated</SelectItem>
                  <SelectItem value="printed">Printed</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedLabels.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-900">{selectedLabels.size} labels selected</span>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={handleBulkPrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Selected
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadLabels}>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    selectedLabels.forEach((labelId) => handleDeleteLabel(labelId))
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Labels Content */}
      <Tabs defaultValue="labels">
        <TabsList>
          <TabsTrigger value="labels">
            <FileText className="mr-2 h-4 w-4" />
            Labels ({filteredLabels.length})
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Label Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="labels" className="mt-6">
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading labels...</p>
                </div>
              </CardContent>
            </Card>
          ) : filteredLabels.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <QrCode className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No shipping labels found</h3>
                  <p className="text-muted-foreground mb-4">Generate labels for your orders to get started</p>
                  <Button onClick={handleBulkGenerate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Generate Labels
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <Checkbox
                      checked={selectedLabels.size === filteredLabels.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium">Select All</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLabels.map((label) => (
                      <div key={label.id} className="relative">
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={selectedLabels.has(label.id)}
                            onCheckedChange={() => handleSelectLabel(label.id)}
                          />
                        </div>
                        <div className="border rounded-lg p-2 hover:shadow-md transition-shadow">
                          <ShippingLabel
                            order={label.orders}
                            labelConfig={label.label_config}
                            className="transform scale-50 origin-top-left"
                          />
                          <div className="mt-2 pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">#{label.orders?.order_number}</p>
                                <p className="text-sm text-muted-foreground">{label.orders?.customer_name}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => setPreviewLabel(label)}>
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleDeleteLabel(label.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedLabels.size === filteredLabels.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLabels.map((label) => (
                      <TableRow key={label.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLabels.has(label.id)}
                            onCheckedChange={() => handleSelectLabel(label.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">#{label.orders?.order_number}</TableCell>
                        <TableCell>{label.orders?.customer_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{label.status}</Badge>
                        </TableCell>
                        <TableCell>{new Date(label.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPreviewLabel(label)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteLabel(label.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Label Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Label Size</label>
                    <Select
                      value={labelConfig.size}
                      onValueChange={(value: "small" | "medium" | "large") =>
                        setLabelConfig({ ...labelConfig, size: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (2.25" × 1.25")</SelectItem>
                        <SelectItem value="medium">Medium (4" × 3")</SelectItem>
                        <SelectItem value="large">Large (4" × 6")</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Theme</label>
                    <Select
                      value={labelConfig.theme}
                      onValueChange={(value: "minimal" | "standard" | "branded") =>
                        setLabelConfig({ ...labelConfig, theme: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="branded">Branded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Font Size</label>
                    <Select
                      value={labelConfig.fontSize}
                      onValueChange={(value: "small" | "medium" | "large") =>
                        setLabelConfig({ ...labelConfig, fontSize: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeQR"
                        checked={labelConfig.includeQR}
                        onCheckedChange={(checked) => setLabelConfig({ ...labelConfig, includeQR: checked === true })}
                      />
                      <label htmlFor="includeQR" className="text-sm font-medium">
                        Include QR Code
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeBarcode"
                        checked={labelConfig.includeBarcode}
                        onCheckedChange={(checked) =>
                          setLabelConfig({ ...labelConfig, includeBarcode: checked === true })
                        }
                      />
                      <label htmlFor="includeBarcode" className="text-sm font-medium">
                        Include Barcode
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Preview</label>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    {orders.length > 0 && (
                      <ShippingLabel
                        order={orders[0]}
                        labelConfig={labelConfig}
                        className="transform scale-75 origin-top-left"
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden print area */}
      <div ref={printRef} className="hidden print:block">
        {selectedLabels.size > 0 &&
          filteredLabels
            .filter((label) => selectedLabels.has(label.id))
            .map((label, index) => (
              <div key={label.id} className={`label ${index > 0 ? "page-break-before" : ""}`}>
                <ShippingLabel order={label.orders} labelConfig={label.label_config} />
              </div>
            ))}
      </div>

      {/* Modals */}
      {showBulkGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
            <BulkLabelGenerator
              onComplete={(labelIds) => {
                setShowBulkGenerator(false)
                fetchLabels()
                toast({
                  title: "Success",
                  description: `Generated ${labelIds.length} labels`,
                })
              }}
              onCancel={() => setShowBulkGenerator(false)}
            />
          </div>
        </div>
      )}

      {showBulkPrinter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4">
            <BulkLabelPrinter
              labels={filteredLabels.filter((label) => selectedLabels.has(label.id))}
              onPrint={() => {
                setShowBulkPrinter(false)
                handlePrintLabels()
              }}
              onDownload={() => {
                setShowBulkPrinter(false)
                handleDownloadLabels()
              }}
              onClose={() => setShowBulkPrinter(false)}
            />
          </div>
        </div>
      )}

      {previewLabel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Label Preview</h3>
              <Button variant="outline" onClick={() => setPreviewLabel(null)}>
                Close
              </Button>
            </div>
            <div className="flex justify-center">
              <ShippingLabel order={previewLabel.orders} labelConfig={previewLabel.label_config} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
