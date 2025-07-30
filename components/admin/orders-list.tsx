"use client"

import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  Store,
  ExternalLink,
} from "lucide-react"

interface OrderWithActions {
  id: string
  order_number: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  pickup_address: string
  delivery_address: string
  status: string
  priority: string
  driver_id?: string
  driver_name?: string
  shop_domain?: string
  shopify_order_number?: string
  is_shopify_order?: boolean
  created_at: string
  updated_at: string
}

interface OrdersListProps {
  orders: OrderWithActions[]
  loading: boolean
  selectedOrders: Set<string>
  onSelectAll: (checked: boolean) => void
  onSelectOrder: (orderId: string, checked: boolean) => void
  allSelected: boolean
  someSelected: boolean
  getStatusBadge: (status: string) => React.ReactNode
  getPriorityBadge: (priority: string) => React.ReactNode
  getStoreBadge?: (order: OrderWithActions) => React.ReactNode
  onBulkAssignDriver: (driverId: string) => void
  onBulkDelete: () => void
  router: any
}

export function OrdersList({
  orders,
  loading,
  selectedOrders,
  onSelectAll,
  onSelectOrder,
  allSelected,
  someSelected,
  getStatusBadge,
  getPriorityBadge,
  getStoreBadge,
  onBulkAssignDriver,
  onBulkDelete,
  router,
}: OrdersListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </CardContent>
      </Card>
    )
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500 mb-4">
              No orders match your current filters. Try adjusting your search criteria.
            </p>
            <Button onClick={() => router.push("/admin/orders/create")}>Create New Order</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={allSelected} onCheckedChange={onSelectAll} aria-label="Select all orders" />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Checkbox
                      checked={selectedOrders.has(order.id)}
                      onCheckedChange={(checked) => onSelectOrder(order.id, checked as boolean)}
                      aria-label={`Select order ${order.order_number}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{order.order_number}</div>
                      {order.is_shopify_order && order.shopify_order_number && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Store className="h-3 w-3" />
                          Shopify {order.shopify_order_number}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {order.delivery_address.length > 50
                          ? `${order.delivery_address.substring(0, 50)}...`
                          : order.delivery_address}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{order.customer_name}</div>
                      {order.customer_phone && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {order.customer_phone}
                        </div>
                      )}
                      {order.customer_email && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {order.customer_email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStoreBadge ? (
                      getStoreBadge(order)
                    ) : (
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        Manual
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{order.driver_name || "Unassigned"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push(`/admin/orders/${order.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/admin/orders/${order.id}/edit`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Order
                        </DropdownMenuItem>
                        {order.is_shopify_order && order.shop_domain && (
                          <DropdownMenuItem onClick={() => window.open(`https://${order.shop_domain}/admin`, "_blank")}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View in Shopify
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete order ${order.order_number}?`)) {
                              onBulkDelete()
                            }
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Order
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
