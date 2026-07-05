"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const FULFILLMENT_STATUSES = [
  { value: "READY_FOR_FULFILLMENT", label: "Ready For Fulfillment" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PACKED", label: "Packed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "COMPLETED", label: "Completed" },
];

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "orderNumber:asc", label: "Order Number A-Z" },
  { value: "orderNumber:desc", label: "Order Number Z-A" },
  { value: "customerName:asc", label: "Customer Name A-Z" },
  { value: "customerName:desc", label: "Customer Name Z-A" },
  { value: "grandTotal:desc", label: "Highest Total" },
  { value: "grandTotal:asc", label: "Lowest Total" },
  { value: "fulfillmentStatus:asc", label: "Fulfillment Status" },
];

const DEFAULT_SORT = SORT_OPTIONS[0].value;
const DEFAULT_LIMIT = 10;

const ordersApi = {
  async list({ page, limit, search, sortBy, sortOrder, paymentStatus, fulfillmentStatus, startDate, endDate, courier }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    });

    if (search) params.set("search", search);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (fulfillmentStatus) params.set("fulfillmentStatus", fulfillmentStatus);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (courier) params.set("courier", courier);

    const response = await fetch(`/api/orders?${params.toString()}`);
    return response.json();
  },
  async getById(id) {
    const response = await fetch(`/api/orders/${id}`);
    return response.json();
  },
  async updateFulfillment(id, payload) {
    const response = await fetch(`/api/orders/${id}/fulfillment`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
};

const fmtCurrency = (value) => "Rp " + Number(value || 0).toLocaleString("id-ID");

function fmtDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentStatusBadge(status) {
  const styles = {
    PAID: "bg-emerald-500/10 text-emerald-600",
    PENDING: "bg-amber-500/10 text-amber-600",
    FAILED: "bg-rose-500/10 text-rose-600",
    EXPIRED: "bg-slate-500/10 text-slate-600",
    CREATED: "bg-blue-500/10 text-blue-600",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

function fulfillmentStatusBadge(status) {
  const styles = {
    READY_FOR_FULFILLMENT: "bg-slate-500/10 text-slate-600",
    PROCESSING: "bg-blue-500/10 text-blue-600",
    PACKED: "bg-violet-500/10 text-violet-600",
    SHIPPED: "bg-amber-500/10 text-amber-600",
    COMPLETED: "bg-emerald-600/10 text-emerald-700",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "READY_FOR_FULFILLMENT"}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium w-40 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-foreground font-medium flex-1 break-words">
        {value || "—"}
      </span>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5 mb-1">
        {title}
      </p>
      {children}
    </div>
  );
}

function OrderDetailDialog({ open, onOpenChange, order, userName, onUpdated }) {
  const [fulfillmentStatus, setFulfillmentStatus] = useState("PENDING");
  const [updatedBy, setUpdatedBy] = useState(userName || "HQ Admin");
  const [notes, setNotes] = useState("");
  const [shipmentCourier, setShipmentCourier] = useState("");
  const [shipmentService, setShipmentService] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order || !open) return;
    setFulfillmentStatus(order.fulfillmentStatus || "PENDING");
    setUpdatedBy(userName || "HQ Admin");
    setNotes("");
    setShipmentCourier(order.shipment?.courier || "");
    setShipmentService(order.shipment?.service || "");
    setTrackingNumber(order.shipment?.trackingNumber || "");
    setShippingDate(order.shipment?.shippingDate ? new Date(order.shipment.shippingDate).toISOString().slice(0, 16) : "");
  }, [order, open, userName]);

  const showShipmentForm = fulfillmentStatus === "SHIPPED" || order?.fulfillmentStatus === "SHIPPED";

  const saveFulfillment = async () => {
    if (!order?.id) return;
    if (!updatedBy.trim()) {
      toast.error("Updated By is required.");
      return;
    }

    setSaving(true);
    try {
      const result = await ordersApi.updateFulfillment(order.id, {
        fulfillmentStatus,
        updatedBy,
        notes,
        shipmentCourier,
        shipmentService,
        trackingNumber,
        shippingDate: shippingDate ? new Date(shippingDate).toISOString() : null,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Order fulfillment updated successfully.");
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">{order.orderNumber}</DialogTitle>
              <DialogDescription>
                {fmtDateTime(order.createdAt)}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {paymentStatusBadge(order.payment?.status)}
              {fulfillmentStatusBadge(order.fulfillmentStatus)}
            </div>
          </div>
        </DialogHeader>

        <div className="py-1 space-y-4">
          <DetailSection title="Customer">
            <DetailRow label="Name" value={order.customerName} />
            <DetailRow label="Email" value={order.customerEmail} />
            <DetailRow label="Phone" value={order.customerPhone} />
          </DetailSection>

          <DetailSection title="Shipping">
            <DetailRow label="Recipient" value={order.shipping?.recipientName} />
            <DetailRow label="Phone" value={order.shipping?.recipientPhone} />
            <DetailRow label="Address" value={`${order.shipping?.streetAddress || ""}, ${order.shipping?.districtName || ""}, ${order.shipping?.cityName || ""}, ${order.shipping?.provinceName || ""} ${order.shipping?.postalCode || ""}`.replace(/^,\s*/, "")} />
            <DetailRow label="Courier" value={order.shipping?.courier} />
            <DetailRow label="Service" value={order.shipping?.courierService} />
            <DetailRow label="Shipping Cost" value={fmtCurrency(order.shippingCost)} />
            <DetailRow label="Tracking Number" value={order.shipment?.trackingNumber} />
            <DetailRow label="Shipping Date" value={fmtDateTime(order.shipment?.shippingDate)} />
          </DetailSection>

          <DetailSection title="Purchased Items">
            <div className="overflow-x-auto rounded-lg border border-border/30">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Image</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Variant</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">SKU</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Quantity</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Unit Price</th>
                    <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-border/20 last:border-0">
                      <td className="px-4 py-3">
                        {item.productImage ? (
                          <img src={item.productImage} alt={item.productName} className="w-12 h-12 rounded object-cover border border-border/30" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                            N/A
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{item.productName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.variantName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(item.price)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          <DetailSection title="Payment">
            <DetailRow label="Payment Attempt Number" value={order.payment?.attemptNumber} />
            <DetailRow label="Payment Provider" value={order.payment?.provider} />
            <DetailRow label="Provider Reference" value={order.payment?.providerReference} />
            <DetailRow label="Payment Method" value={order.payment?.paymentMethod} />
            <DetailRow label="Issuer" value={order.payment?.issuer} />
            <DetailRow label="Acquirer" value={order.payment?.acquirer} />
            <DetailRow label="Settlement Time" value={fmtDateTime(order.payment?.settlementTime)} />
            <DetailRow label="Grand Total" value={fmtCurrency(order.grandTotal)} />
          </DetailSection>

          <DetailSection title="Summary">
            <DetailRow label="Subtotal" value={fmtCurrency(order.subtotal)} />
            <DetailRow label="Shipping" value={fmtCurrency(order.shippingCost)} />
            <DetailRow label="Discount" value={fmtCurrency(order.discount)} />
            <DetailRow label="Tax" value={fmtCurrency(order.tax)} />
            <DetailRow label="Grand Total" value={fmtCurrency(order.grandTotal)} />
          </DetailSection>

          <DetailSection title="Fulfillment Management">
            <div className="grid grid-cols-2 gap-4 py-3">
              <div className="space-y-1.5">
                <Label>Fulfillment Status</Label>
                <Select value={fulfillmentStatus} onValueChange={setFulfillmentStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FULFILLMENT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Updated By</Label>
                <Input value={updatedBy} onChange={(event) => setUpdatedBy(event.target.value)} placeholder="HQ Admin" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for the timeline entry..." rows={3} />
              </div>
              {showShipmentForm ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Shipment Courier</Label>
                    <Input value={shipmentCourier} onChange={(event) => setShipmentCourier(event.target.value)} placeholder="JNE" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Shipment Service</Label>
                    <Input value={shipmentService} onChange={(event) => setShipmentService(event.target.value)} placeholder="REG" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tracking Number</Label>
                    <Input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Tracking number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Shipping Date</Label>
                    <Input type="datetime-local" value={shippingDate} onChange={(event) => setShippingDate(event.target.value)} />
                  </div>
                </>
              ) : null}
            </div>
          </DetailSection>

          <DetailSection title="Order Timeline">
            {order.timeline?.length ? (
              <div className="space-y-3 py-3">
                {order.timeline.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{entry.eventName}</p>
                      <span className="text-xs text-muted-foreground">{fmtDateTime(entry.timestamp)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Updated by {entry.updatedBy || "HQ Admin"}</p>
                    {entry.notes ? (
                      <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-sm text-muted-foreground">No timeline entries recorded yet.</div>
            )}
          </DetailSection>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={saveFulfillment} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Fulfillment Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrdersModule({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [sortValue, setSortValue] = useState(DEFAULT_SORT);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [courierFilter, setCourierFilter] = useState("");
  const [detailOrder, setDetailOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [summary, setSummary] = useState({ readyForFulfillment: 0, processing: 0, packed: 0, shipped: 0, completed: 0 });

  const [sortBy, sortOrder] = useMemo(() => sortValue.split(":"), [sortValue]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await ordersApi.list({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      paymentStatus: paymentStatusFilter === "all" ? "" : paymentStatusFilter,
      fulfillmentStatus: fulfillmentStatusFilter === "all" ? "" : fulfillmentStatusFilter,
      startDate: dateFrom,
      endDate: dateTo,
      courier: courierFilter,
    });
    if (result?.error) {
      toast.error(result.error);
      setItems([]);
      setPagination({ page: 1, limit: DEFAULT_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
      setSummary({ readyForFulfillment: 0, processing: 0, packed: 0, shipped: 0, completed: 0 });
      setLoading(false);
      return;
    }

    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setSummary(result?.summary || { readyForFulfillment: 0, processing: 0, packed: 0, shipped: 0, completed: 0 });
    setLoading(false);
  }, [courierFilter, dateFrom, dateTo, fulfillmentStatusFilter, limit, page, paymentStatusFilter, search, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sortValue, limit, paymentStatusFilter, fulfillmentStatusFilter, dateFrom, dateTo, courierFilter]);

  const openDetail = async (orderId) => {
    const result = await ordersApi.getById(orderId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }

    setDetailOrder(result);
    setShowDetail(true);
  };

  const handleOrderUpdated = (updatedOrder) => {
    setDetailOrder(updatedOrder);
    setItems((previous) => previous.map((item) => (
      item.id === updatedOrder.id
        ? {
            ...item,
            paymentStatus: updatedOrder.payment?.status || item.paymentStatus,
            fulfillmentStatus: updatedOrder.fulfillmentStatus,
            fulfillmentStatusLabel: updatedOrder.fulfillmentStatusLabel,
            totalItems: updatedOrder.items?.length || item.totalItems,
          }
        : item
    )));
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Orders
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Review incoming paid orders and manage internal fulfillment workflow
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Refresh Orders">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: "Ready For Fulfillment", value: summary.readyForFulfillment, icon: PackageCheck },
          { label: "Processing", value: summary.processing, icon: Loader2 },
          { label: "Packed", value: summary.packed, icon: PackageCheck },
          { label: "Shipped", value: summary.shipped, icon: Truck },
          { label: "Completed", value: summary.completed, icon: CheckCircle2 },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="pt-5 pb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
                  <p className="text-3xl font-semibold mt-1">{loading ? '—' : card.value}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <Icon className={`h-5 w-5 ${card.label === 'Processing' && loading ? 'animate-spin' : ''}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Search order / customer / email / tracking</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Payment Status</p>
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment Statuses</SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="FAILED">FAILED</SelectItem>
                  <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                  <SelectItem value="CREATED">CREATED</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fulfillment Status</p>
              <Select value={fulfillmentStatusFilter} onValueChange={setFulfillmentStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fulfillment Statuses</SelectItem>
                  {FULFILLMENT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Courier</p>
              <Input value={courierFilter} onChange={(event) => setCourierFilter(event.target.value)} placeholder="e.g. JNE" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mt-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date From</p>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date To</p>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sort</p>
              <Select value={sortValue} onValueChange={setSortValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Page Size</p>
                <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" onClick={load} title="Refresh Orders">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading orders…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <PackageCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No orders found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Paid checkout orders will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Customer Name</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Payment Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Fulfillment Status</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total Items</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((order, index) => (
                    <tr
                      key={order.id}
                      className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors cursor-pointer ${index % 2 === 0 ? "" : "bg-muted/10"}`}
                      onClick={() => openDetail(order.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(order.orderDate)}</td>
                      <td className="px-4 py-3 font-medium">{order.customerName}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3">{paymentStatusBadge(order.paymentStatus)}</td>
                      <td className="px-4 py-3">{fulfillmentStatusBadge(order.fulfillmentStatusLabel || order.fulfillmentStatus)}</td>
                      <td className="px-4 py-3 text-right">{order.totalItems}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} total orders
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <OrderDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        order={detailOrder}
        userName={user?.name || "HQ Admin"}
        onUpdated={handleOrderUpdated}
      />
    </div>
  );
}
