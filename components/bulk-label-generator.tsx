"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { Loader2, QrCode, FileText, Settings, Filter } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface BulkLabelGeneratorProps {
  onComplete?: (labelIds: string[]) => void
  onCancel?: () => void
}

export function BulkLabelGenerator({ onComplete, onCancel }: BulkLabelGeneratorProps) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [orders, setOrders] = useState<any[]>([])
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [labelConfig, setLabelConfig] = useState({
    size: "medium",
    theme: "standard",
    includeQR: true,
    includeBarcode: true,
    fontSize: "medium",
  })

  // Fetch orders on component mount
  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    if (!profile) return

    try {
      setLoadingOrders(true)
      let query = supabase.from("orders").select("*")

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query.order("created_at", { ascending: false })

      if (error) throw error

      setOrders(data || [])
    } catch (error) {
      console.error("Error fetching orders:", error)
      toast({
        title: "Error",
        description: "Failed to load orders.",
        variant: "destructive",
      })
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredOrders.map((order) => order.id))
    }
  }

  const handleSelectOrder = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId))
    } else {
      setSelectedOrders([...selectedOrders, orderId])
    }
  }

  const handleGenerateLabels = async () => {
    if (selectedOrders.length === 0) {
      toast({
        title: "No orders selected",
        description: "Please select at least one order to generate labels.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const labelIds: string[] = []

      // Generate labels for each selected order
      for (const orderId of selectedOrders) {
        const order = orders.find((o) => o.id === orderId)
        if (!order) continue

        const { data, error } = await supabase
          .from("shipping_labels")
          .insert({
            order_id: order.id,
            label_config: labelConfig,
            label_size: labelConfig.size,
            theme: labelConfig.theme,
            status: "generated",
            print_count: 0,
            created_by: profile?.user_id,
          })
          .select("id")
          .single()

        if (error) throw error
        labelIds.push(data.id)
      }

      toast({
        title: "Success",
        description: `Generated ${labelIds.length} shipping labels.`,
      })

      if (onComplete) {
        onComplete(labelIds)
      }
    } catch (error) {
      console.error("Error generating labels:", error)
      toast({
        title: "Error",
        description: "Failed to generate labels. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(
    (order) =>
      (order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === "all" || order.status === statusFilter),
  )

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <QrCode className="mr-2 h-5 w-5" />
          Bulk Label Generator
        </CardTitle>
        <CardDescription>Generate shipping labels for multiple orders at once</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="orders">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders">
              <FileText className="mr-2 h-4 w-4" />
              Select Orders
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Label Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
                <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all orders"
                      />
                    </TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingOrders ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        <p className="mt-2 text-sm text-muted-foreground">Loading orders...</p>
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">No orders found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id} className={selectedOrders.includes(order.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => handleSelectOrder(order.id)}
                            aria-label={`Select order ${order.order_number}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell className="truncate max-w-[200px]">{order.delivery_address}</TableCell>
                        <TableCell>{order.status}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {selectedOrders.length} of {filteredOrders.length} orders selected
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrders(filteredOrders.map((order) => order.id))}
              >
                Select All Visible
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label>Label Size</Label>
              <Select
                value={labelConfig.size}
                onValueChange={(value) => setLabelConfig({ ...labelConfig, size: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small - 2.25" × 1.25"</SelectItem>
                  <SelectItem value="medium">Medium - 4" × 3"</SelectItem>
                  <SelectItem value="large">Large - 4" × 6"</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Label Theme</Label>
              <Select
                value={labelConfig.theme}
                onValueChange={(value) => setLabelConfig({ ...labelConfig, theme: value })}
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

            <div className="space-y-2">
              <Label>Font Size</Label>
              <Select
                value={labelConfig.fontSize}
                onValueChange={(value) => setLabelConfig({ ...labelConfig, fontSize: value })}
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

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeQR"
                  checked={labelConfig.includeQR}
                  onCheckedChange={(checked) => setLabelConfig({ ...labelConfig, includeQR: checked === true })}
                />
                <label
                  htmlFor="includeQR"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include QR Code
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeBarcode"
                  checked={labelConfig.includeBarcode}
                  onCheckedChange={(checked) => setLabelConfig({ ...labelConfig, includeBarcode: checked === true })}
                />
                <label
                  htmlFor="includeBarcode"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include Barcode
                </label>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleGenerateLabels} disabled={loading || selectedOrders.length === 0}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>Generate {selectedOrders.length} Labels</>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
