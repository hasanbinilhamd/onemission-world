"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import {
  FULFILLMENT_STATUS,
  FULFILLMENT_STATUS_OPTIONS,
} from "@/lib/order/lifecycle";
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

const FULFILLMENT_STATUSES = FULFILLMENT_STATUS_OPTIONS;

// TEMPORARILY DISABLED
// Picking is bypassed because current warehouse operation
// is handled by a single operator.
// Re-enable this helper mapping once warehouse workflow requires
// separate Picking and Packing phases again.
function getVisibleFulfillmentStatus(status) {
  return status === FULFILLMENT_STATUS.PICKING ? FULFILLMENT_STATUS.PACKING : status;
}

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
  async approveReturn(id) {
    const response = await fetch(`/api/admin/returns/${id}/approve`, {
      method: "POST",
    });
    return response.json();
  },
  async rejectReturn(id, payload) {
    const response = await fetch(`/api/admin/returns/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
  async updateRefundStatus(id, payload) {
    const response = await fetch(`/api/admin/returns/${id}/refund-status`, {
      method: "PATCH",
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
    PENDING: "bg-slate-500/10 text-slate-600",
    PICKING: "bg-blue-500/10 text-blue-600",
    PACKING: "bg-violet-500/10 text-violet-600",
    READY_TO_SHIP: "bg-cyan-500/10 text-cyan-700",
    SHIPPED: "bg-amber-500/10 text-amber-600",
    DELIVERED: "bg-emerald-600/10 text-emerald-700",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "PENDING"}
    </span>
  );
}

function orderStatusBadge(status) {
  const styles = {
    READY_FOR_FULFILLMENT: "bg-slate-500/10 text-slate-600",
    PROCESSING: "bg-blue-500/10 text-blue-600",
    SHIPPED: "bg-amber-500/10 text-amber-600",
    COMPLETED: "bg-emerald-600/10 text-emerald-700",
    CANCELLED: "bg-rose-500/10 text-rose-600",
    REFUNDED: "bg-fuchsia-500/10 text-fuchsia-600",
    RETURN_REQUESTED: "bg-orange-500/10 text-orange-600",
    RETURN_APPROVED: "bg-cyan-500/10 text-cyan-700",
    RETURN_REJECTED: "bg-rose-500/10 text-rose-600",
    REFUND_PROCESSING: "bg-violet-500/10 text-violet-700",
    REFUND_COMPLETED: "bg-emerald-500/10 text-emerald-700",
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

function toDatetimeLocalInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function buildShipmentTrackingUrl(courier, trackingNumber) {
  const normalizedCourier = String(courier || "").trim().toUpperCase();
  const normalizedTrackingNumber = String(trackingNumber || "").trim();
  if (!normalizedCourier || !normalizedTrackingNumber) {
    return "";
  }

  const trackingProviders = {
    JNE: (resi) => `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`,
    JNT: (resi) => `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`,
    SICEPAT: (resi) => `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`,
    POS: (resi) => `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`,
    NINJA: (resi) => `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`,
    ANTERAJA: (resi) => `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`,
  };

  return trackingProviders[normalizedCourier]?.(normalizedTrackingNumber) || "";
}

function getTimelinePresentation(entry) {
  const eventName = String(entry?.eventName || "").trim();

  const timelineMap = {
    "Order Created": {
      title: "Order Created",
      description: "Order has been successfully created from checkout.",
    },
    "Payment Received": {
      title: "Payment Received",
      description: "Automatically confirmed after successful payment.",
    },
    WAITING_PAYMENT: {
      title: "Waiting Payment",
      description: "Order has been created and is waiting for payment confirmation.",
    },
    PACKING_STARTED: {
      title: "Packing Started",
      description: "Warehouse has started preparing this order.",
    },
    READY_TO_SHIP: {
      title: "Ready to Ship",
      description: "Package has been packed and is ready for courier pickup.",
    },
    ORDER_SHIPPED: {
      title: "Shipment Dispatched",
      description: "Package has been handed over to the courier.",
    },
    ORDER_DELIVERED: {
      title: "Delivered",
      description: "Courier marked this order as delivered.",
    },
    CANCELLED: {
      title: "Cancelled",
      description: "This order has been cancelled.",
    },
    REFUNDED: {
      title: "Refunded",
      description: "Refund has been successfully processed.",
    },
    RETURN_REQUESTED: {
      title: "Return Requested",
      description: "Customer submitted a return request.",
    },
    RETURN_PENDING_REVIEW: {
      title: "Pending Review",
      description: "Return request is waiting seller review.",
    },
    RETURN_APPROVED: {
      title: "Return Approved",
      description: "Return request has been approved.",
    },
    RETURN_REJECTED: {
      title: "Return Rejected",
      description: "Return request has been rejected.",
    },
    REFUND_PROCESSING: {
      title: "Refund Processing",
      description: "Refund is currently being processed.",
    },
    REFUND_COMPLETED: {
      title: "Refund Completed",
      description: "Refund has been completed.",
    },
    MANUAL_INVENTORY_ADJUSTMENT: {
      title: "Manual Inventory Adjustment",
      description: "Inventory was manually adjusted by warehouse staff.",
    },
    SALE_RECORDED: {
      title: "Sale Recorded",
      description: "Inventory has been deducted after successful order processing.",
    },
    // TEMPORARILY DISABLED
    // Picking remains in source code for future warehouse scaling, but it is
    // intentionally hidden from the current HQ workflow.
    PICKING_STARTED: {
      title: "Packing Started",
      description: "Warehouse has started preparing this order.",
      hidden: true,
    },
    ORDER_STATUS_READY_FOR_FULFILLMENT: { hidden: true },
    ORDER_STATUS_PROCESSING: { hidden: true },
    ORDER_STATUS_SHIPPED: { hidden: true },
    ORDER_STATUS_COMPLETED: { hidden: true },
  };

  return timelineMap[eventName] || {
    title: eventName || "Timeline Event",
    description: "Order activity has been recorded.",
  };
}

function splitTimelineNotes(notes) {
  const normalizedNotes = String(notes || "").trim();
  if (!normalizedNotes) {
    return [];
  }

  return normalizedNotes.split("\n").map((line) => line.trim()).filter(Boolean);
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
  const [fulfillmentStatus, setFulfillmentStatus] = useState(FULFILLMENT_STATUS.PENDING);
  const [updatedBy, setUpdatedBy] = useState(userName || "HQ Admin");
  const [notes, setNotes] = useState("");
  const [shipmentCourier, setShipmentCourier] = useState("");
  const [shipmentService, setShipmentService] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingDate, setShippingDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [refundStatus, setRefundStatus] = useState("NONE");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order || !open) return;
    setFulfillmentStatus(getVisibleFulfillmentStatus(order.fulfillmentStatus || FULFILLMENT_STATUS.PENDING));
    setUpdatedBy(userName || "HQ Admin");
    setNotes("");
    setShipmentCourier(order.shipment?.courier || "");
    setShipmentService(order.shipment?.service || "");
    setTrackingNumber(order.shipment?.trackingNumber || "");
    setShippingDate(toDatetimeLocalInputValue(order.shipment?.shippingDate));
    setRejectReason("");
    setRefundStatus(order.returnRequest?.refundStatus || "NONE");
  }, [order, open, userName]);

  useEffect(() => {
    if (fulfillmentStatus === FULFILLMENT_STATUS.SHIPPED && !shippingDate) {
      setShippingDate(toDatetimeLocalInputValue(new Date()));
    }
  }, [fulfillmentStatus, shippingDate]);

  if (!order) return null;

  const shipmentLocked = [FULFILLMENT_STATUS.SHIPPED, FULFILLMENT_STATUS.DELIVERED].includes(order.fulfillmentStatus);
  const requiresShipmentInformation = fulfillmentStatus === FULFILLMENT_STATUS.SHIPPED;
  const shouldShowShipmentInformation = shipmentLocked || [FULFILLMENT_STATUS.SHIPPED, FULFILLMENT_STATUS.DELIVERED].includes(fulfillmentStatus);
  const trackShipmentUrl = buildShipmentTrackingUrl(shipmentCourier || order.shipment?.courier, trackingNumber || order.shipment?.trackingNumber);
  const showTrackShipmentButton = Boolean(trackingNumber || order.shipment?.trackingNumber);

  const approveReturn = async () => {
    if (!order?.returnRequest?.id) return;
    setSaving(true);
    try {
      const result = await ordersApi.approveReturn(order.returnRequest.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Return approved successfully.");
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  const rejectReturn = async () => {
    if (!order?.returnRequest?.id) return;
    if (!rejectReason.trim()) {
      toast.error("Reject Reason is required.");
      return;
    }
    setSaving(true);
    try {
      const result = await ordersApi.rejectReturn(order.returnRequest.id, { rejectReason });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Return rejected successfully.");
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  const saveRefundStatus = async () => {
    if (!order?.returnRequest?.id) return;
    setSaving(true);
    try {
      const result = await ordersApi.updateRefundStatus(order.returnRequest.id, { refundStatus });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Refund status updated successfully.");
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  const saveFulfillment = async () => {
    if (!order?.id) return;
    if (!updatedBy.trim()) {
      toast.error("Updated By is required.");
      return;
    }

    if (requiresShipmentInformation) {
      if (!shipmentCourier.trim()) {
        toast.error("Shipment Courier is required before marking this order as shipped.");
        return;
      }
      if (!shipmentService.trim()) {
        toast.error("Shipment Service is required before marking this order as shipped.");
        return;
      }
      if (!trackingNumber.trim()) {
        toast.error("Tracking Number is required before marking this order as shipped.");
        return;
      }
      if (!shippingDate) {
        toast.error("Shipping Date is required before marking this order as shipped.");
        return;
      }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">{order.orderNumber}</DialogTitle>
              <DialogDescription>
                {order.publicOrderNumber} • {fmtDateTime(order.createdAt)}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {paymentStatusBadge(order.payment?.status)}
              {orderStatusBadge(order.status)}
              {fulfillmentStatusBadge(getVisibleFulfillmentStatus(order.fulfillmentStatus))}
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
            <DetailRow label="Internal Order Number" value={order.orderNumber} />
            <DetailRow label="Public Order Number" value={order.publicOrderNumber} />
            <DetailRow label="Order Status" value={orderStatusBadge(order.status)} />
            <DetailRow label="Fulfillment Status" value={fulfillmentStatusBadge(getVisibleFulfillmentStatus(order.fulfillmentStatus))} />
            <DetailRow label="Subtotal" value={fmtCurrency(order.subtotal)} />
            <DetailRow label="Shipping" value={fmtCurrency(order.shippingCost)} />
            <DetailRow label="Discount" value={fmtCurrency(order.discount)} />
            <DetailRow label="Tax" value={fmtCurrency(order.tax)} />
            <DetailRow label="Grand Total" value={fmtCurrency(order.grandTotal)} />
          </DetailSection>

          {order.returnRequest ? (
            <DetailSection title="Return Management">
              <DetailRow label="Reason" value={order.returnRequest.reason} />
              <DetailRow label="Description" value={order.returnRequest.description || "—"} />
              <DetailRow label="Request Date" value={fmtDateTime(order.returnRequest.requestedAt)} />
              <DetailRow label="Return Status" value={order.returnRequest.status} />
              <DetailRow label="Refund Status" value={order.returnRequest.refundStatus} />
              {order.returnRequest.rejectReason ? (
                <DetailRow label="Reject Reason" value={order.returnRequest.rejectReason} />
              ) : null}
              {Array.isArray(order.returnRequest.attachments) && order.returnRequest.attachments.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-3">
                  {order.returnRequest.attachments.map((attachment, index) => (
                    <a key={`${order.returnRequest.id}-attachment-${index}`} href={attachment} target="_blank" rel="noreferrer" className="rounded-lg border border-border/30 overflow-hidden bg-muted/20">
                      <img src={attachment} alt={`Return attachment ${index + 1}`} className="w-full h-32 object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
                <div className="space-y-1.5">
                  <Label>Reject Reason</Label>
                  <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Required only when rejecting a return request..." rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Refund Status</Label>
                  <Select value={refundStatus} onValueChange={setRefundStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="PROCESSING">Processing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 py-2">
                {order.returnRequest.status === "REQUESTED" ? (
                  <>
                    <Button type="button" variant="outline" onClick={approveReturn} disabled={saving}>
                      Approve Return
                    </Button>
                    <Button type="button" variant="destructive" onClick={rejectReturn} disabled={saving}>
                      Reject Return
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="outline" onClick={saveRefundStatus} disabled={saving}>
                  Update Refund Status
                </Button>
              </div>
            </DetailSection>
          ) : null}

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
            </div>

            {shouldShowShipmentInformation ? (
              <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Shipment Information</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Complete the courier details before dispatch. Shipment data becomes read-only after the order is shipped.
                    </p>
                  </div>
                  {showTrackShipmentButton ? (
                    trackShipmentUrl ? (
                      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => window.open(trackShipmentUrl, "_blank", "noopener,noreferrer")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Track Shipment
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(trackingNumber || order.shipment?.trackingNumber || "");
                          toast.success("Tracking number copied.");
                        } catch {
                          toast.error("Unable to copy tracking number.");
                        }
                      }}>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Tracking Number
                      </Button>
                    )
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Shipment Courier</Label>
                    <Input value={shipmentCourier} onChange={(event) => setShipmentCourier(event.target.value)} placeholder="JNE" disabled={shipmentLocked} className={shipmentLocked ? "opacity-70" : ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Shipment Service</Label>
                    <Input value={shipmentService} onChange={(event) => setShipmentService(event.target.value)} placeholder="REG" disabled={shipmentLocked} className={shipmentLocked ? "opacity-70" : ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tracking Number</Label>
                    <Input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Tracking number" disabled={shipmentLocked} className={shipmentLocked ? "opacity-70" : ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Shipping Date</Label>
                    <Input type="datetime-local" value={shippingDate} onChange={(event) => setShippingDate(event.target.value)} disabled={shipmentLocked} className={shipmentLocked ? "opacity-70" : ""} />
                  </div>
                </div>
              </div>
            ) : null}
          </DetailSection>

          <DetailSection title="Order Timeline">
            {order.timeline?.length ? (
              <div className="space-y-3 py-3">
                {order.timeline
                  .map((entry) => ({ entry, presentation: getTimelinePresentation(entry) }))
                  .filter(({ presentation }) => !presentation.hidden)
                  .map(({ entry, presentation }) => {
                    const noteLines = splitTimelineNotes(entry.notes);
                    return (
                      <div key={entry.id} className="rounded-lg border border-border/30 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">{presentation.title}</p>
                          <span className="text-xs text-muted-foreground">{fmtDateTime(entry.timestamp)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{presentation.description}</p>
                        {noteLines.length > 0 ? (
                          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                            {noteLines.map((line, index) => (
                              <p key={`${entry.id}-note-${index}`}>{line}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
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

export function OrdersModule({ user, initialReferenceSelection = null, onReferenceSelectionHandled = () => {} }) {
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
  const [summary, setSummary] = useState({ pending: 0, picking: 0, packing: 0, readyToShip: 0, shipped: 0, delivered: 0 });
  const visibleSummary = useMemo(() => ({
    pending: summary.pending,
    packing: summary.packing + summary.picking,
    readyToShip: summary.readyToShip,
    shipped: summary.shipped,
    delivered: summary.delivered,
  }), [summary]);
  const [pendingReference, setPendingReference] = useState("");

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
      setSummary({ pending: 0, picking: 0, packing: 0, readyToShip: 0, shipped: 0, delivered: 0 });
      setLoading(false);
      return;
    }

    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setSummary(result?.summary || { pending: 0, picking: 0, packing: 0, readyToShip: 0, shipped: 0, delivered: 0 });
    setLoading(false);
  }, [courierFilter, dateFrom, dateTo, fulfillmentStatusFilter, limit, page, paymentStatusFilter, search, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sortValue, limit, paymentStatusFilter, fulfillmentStatusFilter, dateFrom, dateTo, courierFilter]);

  useEffect(() => {
    const nextReference = String(initialReferenceSelection?.referenceNumber || "").trim();
    if (!nextReference) {
      return;
    }

    setSearch(nextReference);
    setPage(1);
    setPendingReference(nextReference.toUpperCase());
    onReferenceSelectionHandled();
  }, [initialReferenceSelection, onReferenceSelectionHandled]);

  useEffect(() => {
    if (!pendingReference || loading) {
      return;
    }

    const matchedOrder = items.find((order) => (
      String(order.publicOrderNumber || "").toUpperCase() === pendingReference
      || String(order.orderNumber || "").toUpperCase() === pendingReference
    ));

    if (!matchedOrder) {
      return;
    }

    setPendingReference("");
    void openDetail(matchedOrder.id);
  }, [items, loading, pendingReference]);

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
          { label: "Pending", value: visibleSummary.pending, icon: PackageCheck },
          // TEMPORARILY DISABLED
          // Picking is intentionally hidden in HQ while warehouse fulfillment
          // starts directly from Packing. Historical Picking data is merged into
          // the visible Packing summary for reporting continuity.
          { label: "Packing", value: visibleSummary.packing, icon: PackageCheck },
          { label: "Ready To Ship", value: visibleSummary.readyToShip, icon: Truck },
          { label: "Shipped", value: visibleSummary.shipped, icon: Truck },
          { label: "Delivered", value: visibleSummary.delivered, icon: CheckCircle2 },
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
                  <Icon className={`h-5 w-5 ${card.label === 'Picking' && loading ? 'animate-spin' : ''}`} />
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
              <p className="text-xs text-muted-foreground mb-1">Search internal order / public order / customer / email / tracking</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search internal order, public order, customer, email, or tracking…"
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Internal Order Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Public Order Number</th>
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
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{order.publicOrderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(order.orderDate)}</td>
                      <td className="px-4 py-3 font-medium">{order.customerName}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3">{paymentStatusBadge(order.paymentStatus)}</td>
                      <td className="px-4 py-3">{fulfillmentStatusBadge(getVisibleFulfillmentStatus(order.fulfillmentStatusLabel || order.fulfillmentStatus))}</td>
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
