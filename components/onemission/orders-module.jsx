"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Printer,
  RotateCcw,
  RefreshCw,
  Search,
  Truck,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  FULFILLMENT_STATUS,
  FULFILLMENT_STATUS_OPTIONS,
  FULFILLMENT_STATUS_TRANSITIONS,
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

const ORDER_STATUS_TABS = [
  { value: "ALL", label: "All", summaryKey: "all" },
  { value: "PENDING_PAYMENT", label: "Pending Payment", summaryKey: "pendingPayment" },
  { value: "PAID", label: "Paid", summaryKey: "paid" },
  { value: "NEED_FULFILLMENT", label: "Need Fulfillment", summaryKey: "needFulfillment" },
  { value: "PROCESSING", label: "Processing", summaryKey: "processing" },
  { value: "PACKED", label: "Packed", summaryKey: "packed" },
  { value: "SHIPPED", label: "Shipped", summaryKey: "shipped" },
  { value: "DELIVERED", label: "Delivered", summaryKey: "delivered" },
  { value: "COMPLETED", label: "Completed", summaryKey: "completed" },
  { value: "CANCELLED", label: "Cancelled", summaryKey: "cancelled" },
  { value: "REFUND_REQUESTED", label: "Refund Requested", summaryKey: "refundRequested" },
  { value: "REFUND_APPROVED", label: "Refund Approved", summaryKey: "refundApproved" },
  { value: "REFUND_PROCESSING", label: "Refund Processing", summaryKey: "refundProcessing" },
  { value: "REFUND_COMPLETED", label: "Refund Completed", summaryKey: "refundCompleted" },
  { value: "REFUND_REJECTED", label: "Refund Rejected", summaryKey: "refundRejected" },
  { value: "REFUND_FAILED", label: "Refund Failed", summaryKey: "refundFailed" },
];

const DEFAULT_SORT = SORT_OPTIONS[0].value;
const DEFAULT_LIMIT = 10;

const ordersApi = {
  async list({ page, limit, search, sortBy, sortOrder, paymentStatus, fulfillmentStatus, status, startDate, endDate, courier }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sortBy,
      sortOrder,
    });

    if (search) params.set("search", search);
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (fulfillmentStatus) params.set("fulfillmentStatus", fulfillmentStatus);
    if (status) params.set("status", status);
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
  async cancelOrder(id, payload) {
    const response = await fetch(`/api/admin/orders/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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
  async createBiteshipShipment(id, payload) {
    const response = await fetch(`/api/orders/${id}/biteship-shipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
  async bulkFulfillment(payload) {
    const response = await fetch('/api/orders/bulk-fulfillment', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
  async printSelected(orderIds) {
    const response = await fetch('/api/orders/print-selected', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Packing slip PDF could not be generated.');
    }
    return {
      blob: await response.blob(),
      rejectedCount: Number(response.headers.get('X-Rejected-Count') || 0),
      printableCount: Number(response.headers.get('X-Printable-Count') || 0),
    };
  },
  async printShippingLabel(orderId) {
    const response = await fetch(`/api/orders/${orderId}/shipping-label`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Shipping label PDF could not be generated.');
    }
    return {
      blob: await response.blob(),
      rejectedCount: Number(response.headers.get('X-Rejected-Count') || 0),
      printableCount: Number(response.headers.get('X-Printable-Count') || 0),
    };
  },
  async printShippingLabels(orderIds) {
    const response = await fetch('/api/orders/shipping-labels', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Shipping label PDF could not be generated.');
    }
    return {
      blob: await response.blob(),
      rejectedCount: Number(response.headers.get('X-Rejected-Count') || 0),
      printableCount: Number(response.headers.get('X-Printable-Count') || 0),
    };
  },
  async exportTrackingTemplate(orderIds) {
    const params = new URLSearchParams({ orderIds: orderIds.join(',') });
    const response = await fetch(`/api/orders/tracking-template?${params.toString()}`);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Tracking template could not be exported.');
    }
    return response.blob();
  },
  async previewTrackingImport(file) {
    const formData = new FormData();
    formData.set('file', file);
    const response = await fetch('/api/orders/tracking-import/preview', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Tracking import preview could not be generated.');
    }
    return result;
  },
  async confirmTrackingImport(rows) {
    const response = await fetch('/api/orders/tracking-import/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    return response.json();
  },
  async listScanModeReadyOrders() {
    const response = await fetch('/api/orders/scan-mode?limit=100');
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Scan Mode ready orders could not be loaded.');
    }
    return result;
  },
  async confirmScanModeShipment(payload) {
    const response = await fetch('/api/orders/scan-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Scanned shipment could not be confirmed.');
    }
    return result;
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
    FAILED: "bg-red-900/10 text-red-800",
    EXPIRED: "bg-slate-500/10 text-slate-600",
    CREATED: "bg-blue-500/10 text-blue-600",
    REFUNDED: "bg-emerald-500/10 text-emerald-700",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

function fulfillmentStatusBadge(status) {
  const styles = {
    WAITING_PAYMENT: "bg-slate-500/10 text-slate-600",
    PENDING: "bg-emerald-500/10 text-emerald-600",
    PICKING: "bg-blue-500/10 text-blue-600",
    PACKING: "bg-violet-500/10 text-violet-600",
    READY_TO_SHIP: "bg-cyan-500/10 text-cyan-700",
    SHIPPED: "bg-amber-500/10 text-amber-600",
    DELIVERED: "bg-emerald-600/10 text-emerald-700",
    CANCELLED: "bg-rose-500/10 text-rose-600",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "PENDING"}
    </span>
  );
}

function orderStatusBadge(status) {
  const styles = {
    PENDING_PAYMENT: "bg-slate-500/10 text-slate-600",
    PAID: "bg-emerald-500/10 text-emerald-600",
    READY_FOR_FULFILLMENT: "bg-slate-500/10 text-slate-600",
    NEED_FULFILLMENT: "bg-slate-500/10 text-slate-600",
    PROCESSING: "bg-blue-500/10 text-blue-600",
    PACKED: "bg-cyan-500/10 text-cyan-700",
    SHIPPED: "bg-amber-500/10 text-amber-600",
    DELIVERED: "bg-emerald-600/10 text-emerald-700",
    COMPLETED: "bg-emerald-600/10 text-emerald-700",
    CANCELLED: "bg-rose-500/10 text-rose-600",
    REFUNDED: "bg-fuchsia-500/10 text-fuchsia-600",
    REFUND_REQUESTED: "bg-orange-500/10 text-orange-600",
    REFUND_APPROVED: "bg-blue-500/10 text-blue-600",
    REFUND_PROCESSING: "bg-indigo-500/10 text-indigo-700",
    REFUND_COMPLETED: "bg-emerald-500/10 text-emerald-700",
    REFUND_REJECTED: "bg-rose-500/10 text-rose-600",
    REFUND_FAILED: "bg-red-900/10 text-red-800",
    RETURN_REQUESTED: "bg-orange-500/10 text-orange-600",
    RETURN_APPROVED: "bg-blue-500/10 text-blue-600",
    RETURN_REJECTED: "bg-rose-500/10 text-rose-600",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "READY_FOR_FULFILLMENT"}
    </span>
  );
}

function normalizeReturnResolution(returnRequest) {
  return String(returnRequest?.resolution || "REFUND").trim().toUpperCase() === "REPLACEMENT" ? "REPLACEMENT" : "REFUND";
}

function getReplacementStatus(returnRequest) {
  const explicitStatus = String(returnRequest?.replacementStatus || "").trim().toUpperCase();
  if (explicitStatus) return explicitStatus;
  const returnStatus = String(returnRequest?.status || "").trim().toUpperCase();
  if (returnStatus.startsWith("REPLACEMENT_")) return returnStatus.replace("REPLACEMENT_", "");
  if (returnStatus === "COMPLETED") return "COMPLETED";
  if (returnStatus === "REQUESTED") return "REQUESTED";
  return returnStatus || "PENDING";
}

function returnWorkflowBadge(returnRequest) {
  if (!returnRequest) return null;
  const resolution = normalizeReturnResolution(returnRequest);
  const status = resolution === "REPLACEMENT"
    ? getReplacementStatus(returnRequest)
    : String(returnRequest.refundStatus || returnRequest.status || "REQUESTED").trim().toUpperCase();
  const styles = {
    REQUESTED: "bg-orange-500/10 text-orange-700",
    APPROVED: "bg-blue-500/10 text-blue-700",
    PENDING: "bg-amber-500/10 text-amber-700",
    PAID: "bg-emerald-500/10 text-emerald-700",
    SENT: "bg-blue-500/10 text-blue-700",
    PROCESSING: "bg-indigo-500/10 text-indigo-700",
    COMPLETED: "bg-emerald-500/10 text-emerald-700",
    REJECTED: "bg-rose-500/10 text-rose-600",
    FAILED: "bg-red-900/10 text-red-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {resolution === "REPLACEMENT" ? `REPLACEMENT ${status}` : `REFUND ${status}`}
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
    FULFILLMENT_CANCELLED: {
      title: "Fulfillment Cancelled",
      description: "Fulfillment was synchronized with the cancelled order.",
    },
    ORDER_RESTORED: {
      title: "Order Restored",
      description: "Order was restored after refund rejection.",
    },
    REFUNDED: {
      title: "Refunded",
      description: "Refund has been successfully processed.",
    },
    RETURN_REQUESTED: {
      title: "Return Requested",
      description: "Customer submitted a return request.",
    },
    REPLACEMENT_REQUESTED: {
      title: "Replacement Requested",
      description: "Customer requested a replacement resolution.",
    },
    REPLACEMENT_PENDING: {
      title: "Replacement Pending",
      description: "Replacement is pending after return inspection passed.",
    },
    REPLACEMENT_SENT: {
      title: "Replacement Sent",
      description: "Replacement item has been sent to the customer.",
    },
    RETURN_COMPLETED: {
      title: "Return Completed",
      description: "Return or replacement workflow has been completed.",
    },
    RETURN_PENDING_REVIEW: {
      title: "Pending Review",
      description: "Refund request is waiting HQ review.",
    },
    RETURN_APPROVED: {
      title: "Return Approved",
      description: "Return request has been approved.",
    },
    RETURN_REJECTED: {
      title: "Return Rejected",
      description: "Return request has been rejected.",
    },
    REFUND_APPROVED: {
      title: "Refund Approved",
      description: "Refund was approved by HQ and is ready to be sent to Midtrans.",
    },
    REFUND_SENT_TO_MIDTRANS: {
      title: "Refund Sent to Midtrans",
      description: "Refund request has been submitted to Midtrans and is waiting gateway confirmation.",
    },
    REFUND_RETRIED: {
      title: "Refund Retried",
      description: "Refund request was retried and sent again to Midtrans.",
    },
    REFUND_PROCESSING: {
      title: "Refund Processing",
      description: "Refund request has been sent to Midtrans and is waiting webhook confirmation.",
    },
    REFUND_COMPLETED: {
      title: "Refund Completed",
      description: "Refund has been completed.",
    },
    REFUND_FAILED: {
      title: "Refund Failed",
      description: "Refund request could not be processed and may require retry.",
    },
    REFUND_REJECTED: {
      title: "Refund Rejected",
      description: "Refund request has been rejected.",
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
  const [actualShippingCost, setActualShippingCost] = useState("");
  const [biteshipCourierCompany, setBiteshipCourierCompany] = useState("");
  const [biteshipCourierType, setBiteshipCourierType] = useState("");
  const [biteshipLoading, setBiteshipLoading] = useState(false);
  const [shippingLabelLoading, setShippingLabelLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [adminCancelReason, setAdminCancelReason] = useState("");
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
    setActualShippingCost(order.shipment?.actualShippingCost ?? "");
    setBiteshipCourierCompany((order.shipment?.courier || order.shipping?.courier || "").toLowerCase());
    setBiteshipCourierType((order.shipment?.service || order.shipping?.courierService || "").toLowerCase());
    setRejectReason("");
    setAdminCancelReason("");
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
  const adminCancellableStatuses = new Set([FULFILLMENT_STATUS.WAITING_PAYMENT, FULFILLMENT_STATUS.PENDING, FULFILLMENT_STATUS.PICKING, FULFILLMENT_STATUS.PACKING, FULFILLMENT_STATUS.READY_TO_SHIP]);
  const currentFulfillmentStatus = String(order.fulfillmentStatus || '').trim().toUpperCase();
  const hasBiteshipShipment = String(order.shipment?.provider || '').trim().toLowerCase() === 'biteship' && Boolean(order.shipment?.providerOrderId);
  const canPrintShippingLabel = hasBiteshipShipment && Boolean(order.shipment?.trackingNumber) && order.status !== 'CANCELLED';
  const canCreateBiteshipShipment = currentFulfillmentStatus === FULFILLMENT_STATUS.PACKING && order.status !== 'CANCELLED' && !hasBiteshipShipment;
  const canAdminCancelOrder = !order.returnRequest && order.status !== 'CANCELLED' && adminCancellableStatuses.has(currentFulfillmentStatus);

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

  const cancelOrder = async () => {
    if (!order?.id) return;
    if (!adminCancelReason.trim()) {
      toast.error("Cancellation reason is required.");
      return;
    }
    const confirmed = window.confirm(`Cancel order ${order.publicOrderNumber || order.orderNumber}?\n\nThis will cancel the order, release inventory if it was reserved, and create the existing refund workflow when required.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const result = await ordersApi.cancelOrder(order.id, { reason: adminCancelReason });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Order cancelled successfully.");
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  const printShippingLabel = async () => {
    if (!order?.id) return;
    setShippingLabelLoading(true);
    try {
      const result = await ordersApi.printShippingLabel(order.id);
      downloadPdf(result.blob, 'onemission-shipping-label');
      toast.success('Shipping label PDF downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shipping label could not be printed.');
    } finally {
      setShippingLabelLoading(false);
    }
  };

  const createBiteshipShipment = async () => {
    if (!order?.id) return;
    if (!biteshipCourierCompany.trim() || !biteshipCourierType.trim()) {
      toast.error("Biteship courier company and service type are required.");
      return;
    }
    const confirmed = window.confirm(`Create Biteship shipment for ${order.publicOrderNumber || order.orderNumber}?\n\nThis will request AWB/label from Biteship and move the order to Ready To Ship when successful.`);
    if (!confirmed) return;

    setBiteshipLoading(true);
    try {
      const result = await ordersApi.createBiteshipShipment(order.id, {
        courierCompany: biteshipCourierCompany,
        courierType: biteshipCourierType,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Biteship shipment created. Order is Ready To Ship.");
      onUpdated?.(result.order || result);
    } finally {
      setBiteshipLoading(false);
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

    if (actualShippingCost !== "" && (!Number.isFinite(Number(actualShippingCost)) || Number(actualShippingCost) < 0)) {
      toast.error("Actual Shipping Cost must be a numeric amount greater than or equal to 0.");
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
        actualShippingCost: actualShippingCost === "" ? null : Number(actualShippingCost),
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
            <DetailRow label="Customer Shipping Fee" value={fmtCurrency(order.shippingCost)} />
            <DetailRow label="Actual Shipping Cost" value={order.shipment?.actualShippingCost !== null && order.shipment?.actualShippingCost !== undefined ? fmtCurrency(order.shipment.actualShippingCost) : "—"} />
            <DetailRow label="Tracking Number" value={order.shipment?.trackingNumber} />
            <DetailRow label="Shipping Date" value={fmtDateTime(order.shipment?.shippingDate)} />
            <DetailRow label="Shipping Provider" value={order.shipment?.provider} />
            <DetailRow label="Provider Status" value={order.shipment?.providerStatus} />
            <DetailRow label="Provider Order ID" value={order.shipment?.providerOrderId} />
            <DetailRow label="Provider Tracking ID" value={order.shipment?.providerTrackingId} />
            {order.shipment?.labelUrl ? (
              <div className="pt-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => window.open(order.shipment.labelUrl, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  View / Print Biteship Label
                </Button>
              </div>
            ) : null}
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
            <DetailSection title="Return Overview">
              <DetailRow label="Resolution" value={order.returnRequest.resolution || "REFUND"} />
              <DetailRow label="Return Status" value={order.returnRequest.status || "—"} />
              {normalizeReturnResolution(order.returnRequest) === "REFUND" ? (
                <>
                  <DetailRow label="Refund Status" value={order.returnRequest.refundStatus || "—"} />
                  <DetailRow label="Refund Amount" value={fmtCurrency(order.returnRequest.refundAmount || order.grandTotal || 0)} />
                  <DetailRow label="Refund Reference" value={order.returnRequest.refundReference || "—"} />
                  <DetailRow label="Refund Provider ID" value={order.returnRequest.refundProviderId || "—"} />
                </>
              ) : (
                <>
                  <DetailRow label="Replacement Status" value={getReplacementStatus(order.returnRequest)} />
                  <DetailRow label="Replacement Sent At" value={fmtDateTime(order.returnRequest.replacementSentAt)} />
                  <DetailRow label="Replacement Note" value={order.returnRequest.replacementNote || "—"} />
                </>
              )}
              <DetailRow label="Request Type" value={order.returnRequest.requestType || "PRODUCT_RETURN"} />
              <DetailRow label="Request Date" value={fmtDateTime(order.returnRequest.requestedAt)} />
              <DetailRow label="Reason" value={order.returnRequest.reason} />
              <DetailRow label="Description" value={order.returnRequest.description || "—"} />
              {order.returnRequest.rejectReason ? (
                <DetailRow label="Reject Reason" value={order.returnRequest.rejectReason} />
              ) : null}
              {normalizeReturnResolution(order.returnRequest) === "REPLACEMENT" && Array.isArray(order.returnRequest.replacementItems) && order.returnRequest.replacementItems.length > 0 ? (
                <div className="space-y-3 py-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Replacement Items</p>
                  {order.returnRequest.replacementItems.map((replacement, index) => (
                    <div key={`${replacement.originalOrderItemId || index}-${replacement.replacementVariantId || index}`} className="rounded-lg border border-border/30 p-3 text-sm">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Original</p>
                          <p className="font-medium">{replacement.originalProductName || "—"}</p>
                          <p className="text-muted-foreground">{replacement.originalVariantName || "—"} · Qty {replacement.replacementQuantity || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Replacement</p>
                          <p className="font-medium">{replacement.replacementProductName || "—"}</p>
                          <p className="text-muted-foreground">{replacement.replacementVariantName || "—"} · Qty {replacement.replacementQuantity || "—"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {Array.isArray(order.returnRequest.timeline) && order.returnRequest.timeline.length > 0 ? (
                <div className="space-y-3 py-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Return Timeline</p>
                  {order.returnRequest.timeline.map((entry) => (
                    <div key={`${entry.status}-${entry.timestamp}`} className="rounded-lg border border-border/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                        <span className="text-xs text-muted-foreground">{fmtDateTime(entry.timestamp)}</span>
                      </div>
                      {entry.notes ? (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {String(entry.notes).split("\n").filter(Boolean).map((line, index) => (
                            <p key={`${entry.status}-note-${index}`}>{line}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
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
              <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                Use the Return Requests module to approve, inspect, refund, or complete replacement workflows.
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
                    <Label>Shipping Date & Time</Label>
                    <Input type="datetime-local" value={shippingDate} onChange={(event) => setShippingDate(event.target.value)} disabled={shipmentLocked} className={shipmentLocked ? "opacity-70" : ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Actual Shipping Cost</Label>
                    <Input type="number" min="0" value={actualShippingCost} onChange={(event) => setActualShippingCost(event.target.value)} placeholder="15000" disabled={shipmentLocked} className={shipmentLocked ? "opacity-70" : ""} />
                  </div>
                </div>
              </div>
            ) : null}

            {(canCreateBiteshipShipment || hasBiteshipShipment) ? (
              <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 space-y-4 mt-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Biteship Shipment</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create an official courier shipment after packing. RajaOngkir checkout rates remain unchanged.
                    </p>
                  </div>
                  {canPrintShippingLabel ? (
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={printShippingLabel} disabled={shippingLabelLoading}>
                      {shippingLabelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                      Print Shipping Label
                    </Button>
                  ) : null}
                </div>

                {hasBiteshipShipment ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border bg-white p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Provider Order ID</p><p className="font-mono text-xs mt-1 break-all">{order.shipment?.providerOrderId || '—'}</p></div>
                    <div className="rounded-xl border bg-white p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Provider Status</p><p className="font-semibold mt-1">{order.shipment?.providerStatus || '—'}</p></div>
                    <div className="rounded-xl border bg-white p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">AWB</p><p className="font-mono text-xs mt-1">{order.shipment?.trackingNumber || 'Pending'}</p></div>
                    <div className="rounded-xl border bg-white p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Actual Shipping Cost</p><p className="font-semibold mt-1">{order.shipment?.actualShippingCost !== null && order.shipment?.actualShippingCost !== undefined ? fmtCurrency(order.shipment.actualShippingCost) : 'Pending'}</p></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Biteship Courier Company</Label>
                        <Input value={biteshipCourierCompany} onChange={(event) => setBiteshipCourierCompany(event.target.value)} placeholder="jne / jnt / lion" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Biteship Courier Type</Label>
                        <Input value={biteshipCourierType} onChange={(event) => setBiteshipCourierType(event.target.value)} placeholder="reg / ez / etc" />
                      </div>
                    </div>
                    <Button type="button" className="gap-2" onClick={createBiteshipShipment} disabled={biteshipLoading || saving}>
                      {biteshipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                      Create Biteship Shipment
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </DetailSection>

          {canAdminCancelOrder ? (
            <DetailSection title="Admin Cancellation">
              <div className="space-y-2 py-2">
                <Label>Cancellation Reason</Label>
                <Textarea value={adminCancelReason} onChange={(event) => setAdminCancelReason(event.target.value)} placeholder="Required before cancelling this order from HQ..." rows={3} />
                <p className="text-xs text-muted-foreground">Admin cancellation is available before SHIPPED. Inventory release and refund request use the existing cancellation workflow.</p>
              </div>
            </DetailSection>
          ) : null}

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
          {canAdminCancelOrder ? (
            <Button variant="destructive" onClick={cancelOrder} disabled={saving || !adminCancelReason.trim()}>
              Cancel Order
            </Button>
          ) : null}
          <Button onClick={saveFulfillment} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Fulfillment Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function downloadPdf(blob, prefix) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function downloadPackingSlipPdf(blob) {
  downloadPdf(blob, 'onemission-packing-slips');
}

function buildBulkResultTitle(result) {
  if (!result?.summary) return 'Bulk Update Completed';
  const { successful = 0, failed = 0, skipped = 0 } = result.summary;
  return `Bulk Update Completed — ${successful} success, ${skipped} skipped, ${failed} failed`;
}

function BulkResultDialog({ open, onOpenChange, result }) {
  const results = Array.isArray(result?.results) ? result.results : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{buildBulkResultTitle(result)}</DialogTitle>
          <DialogDescription>
            Review which orders were updated, skipped, or failed.
          </DialogDescription>
        </DialogHeader>
        {result?.summary ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Successful</p><p className="text-2xl font-semibold text-emerald-600">{result.summary.successful}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Skipped</p><p className="text-2xl font-semibold text-amber-600">{result.summary.skipped}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Failed</p><p className="text-2xl font-semibold text-rose-600">{result.summary.failed}</p></div>
          </div>
        ) : null}
        <div className="space-y-2 mt-4">
          {results.map((item) => (
            <div key={`${item.orderId}-${item.status}`} className="rounded-xl border border-border/70 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-xs text-muted-foreground">{item.orderNumber || item.orderId}</p>
                <Badge className={item.status === 'success' ? 'bg-emerald-500/10 text-emerald-600' : item.status === 'skipped' ? 'bg-amber-500/10 text-amber-700' : 'bg-rose-500/10 text-rose-600'}>{item.status}</Badge>
              </div>
              {item.reason ? <p className="text-muted-foreground mt-2">{item.reason}</p> : null}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getAllowedBulkFulfillmentOptions(selectedOrders) {
  if (!Array.isArray(selectedOrders) || selectedOrders.length === 0) return [];
  const allowedSets = selectedOrders.map((order) => {
    const current = getVisibleFulfillmentStatus(order.fulfillmentStatus || FULFILLMENT_STATUS.PENDING);
    return new Set((FULFILLMENT_STATUS_TRANSITIONS[current] || [current]).filter((status) => status !== FULFILLMENT_STATUS.PICKING));
  });
  return FULFILLMENT_STATUSES.filter((option) => allowedSets.every((set) => set.has(option.value)));
}

function BulkStatusDialog({ open, onOpenChange, selectedOrders, onSubmit, loading }) {
  const allowedOptions = useMemo(() => getAllowedBulkFulfillmentOptions(selectedOrders), [selectedOrders]);
  const [fulfillmentStatus, setFulfillmentStatus] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setFulfillmentStatus(allowedOptions[0]?.value || '');
    setNotes('');
  }, [allowedOptions, open]);

  const submit = () => {
    if (!fulfillmentStatus) {
      toast.error('No valid fulfillment status is available for the selected orders.');
      return;
    }
    onSubmit({ fulfillmentStatus, notes });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Fulfillment Status</DialogTitle>
          <DialogDescription>Selected orders: {selectedOrders.length}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Status</Label>
            <Select value={fulfillmentStatus} onValueChange={setFulfillmentStatus} disabled={allowedOptions.length === 0}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {allowedOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional fulfillment note" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={submit} disabled={loading || allowedOptions.length === 0}>{loading ? 'Updating…' : `Update ${selectedOrders.length} Orders`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkTrackingDialog({ open, onOpenChange, selectedOrders, onSubmit, loading }) {
  const [entries, setEntries] = useState([]);
  const [shipmentCourier, setShipmentCourier] = useState('');
  const [shipmentService, setShipmentService] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [actualShippingCost, setActualShippingCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setEntries(selectedOrders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber || order.publicOrderNumber,
      fulfillmentStatus: getVisibleFulfillmentStatus(order.fulfillmentStatus),
      trackingNumber: order.shipment?.trackingNumber || '',
      shipmentCourier: '',
      shipmentService: '',
      shippingDate: '',
      actualShippingCost: '',
    })));
    setShipmentCourier('');
    setShipmentService('');
    setShippingDate('');
    setActualShippingCost('');
    setNotes('');
  }, [open, selectedOrders]);

  const updateEntry = (orderId, key, value) => {
    setEntries((current) => current.map((entry) => entry.orderId === orderId ? { ...entry, [key]: value } : entry));
  };

  const submit = () => {
    const missing = entries.filter((entry) => entry.fulfillmentStatus === FULFILLMENT_STATUS.READY_TO_SHIP && !String(entry.trackingNumber || '').trim());
    if (missing.length > 0) {
      toast.error(`Tracking number is required for ${missing.length} selected order${missing.length === 1 ? '' : 's'}.`);
      return;
    }
    if (actualShippingCost !== '' && (!Number.isFinite(Number(actualShippingCost)) || Number(actualShippingCost) < 0)) {
      toast.error('Actual Shipping Cost default must be a numeric amount greater than or equal to 0.');
      return;
    }
    const invalidCostEntries = entries.filter((entry) => entry.actualShippingCost !== '' && (!Number.isFinite(Number(entry.actualShippingCost)) || Number(entry.actualShippingCost) < 0));
    if (invalidCostEntries.length > 0) {
      toast.error(`Actual Shipping Cost must be valid for ${invalidCostEntries.length} selected order${invalidCostEntries.length === 1 ? '' : 's'}.`);
      return;
    }
    onSubmit({
      entries: entries.map((entry) => ({
        orderId: entry.orderId,
        trackingNumber: entry.trackingNumber,
        actualShippingCost: entry.actualShippingCost === '' ? undefined : Number(entry.actualShippingCost),
      })),
      shipmentCourier,
      shipmentService,
      shippingDate: shippingDate ? new Date(shippingDate).toISOString() : null,
      actualShippingCost: actualShippingCost === '' ? undefined : Number(actualShippingCost),
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Tracking Information</DialogTitle>
          <DialogDescription>Enter one tracking number for each selected order.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Courier Override</Label><Input value={shipmentCourier} onChange={(event) => setShipmentCourier(event.target.value)} placeholder="Use existing if empty" /></div>
          <div className="space-y-1.5"><Label>Service Override</Label><Input value={shipmentService} onChange={(event) => setShipmentService(event.target.value)} placeholder="Use existing if empty" /></div>
          <div className="space-y-1.5"><Label>Shipping Date & Time</Label><Input type="datetime-local" value={shippingDate} onChange={(event) => setShippingDate(event.target.value)} /></div>
          <div className="space-y-1.5"><Label>Actual Shipping Cost Default</Label><Input type="number" min="0" value={actualShippingCost} onChange={(event) => setActualShippingCost(event.target.value)} placeholder="Use per-order if empty" /></div>
        </div>
        <div className="space-y-2 mt-4">
          {entries.map((entry) => {
            const locked = [FULFILLMENT_STATUS.SHIPPED, FULFILLMENT_STATUS.DELIVERED].includes(entry.fulfillmentStatus);
            const notReadyToShip = !locked && entry.fulfillmentStatus !== FULFILLMENT_STATUS.READY_TO_SHIP;
            const disabled = locked || notReadyToShip;
            return (
              <div key={entry.orderId} className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2 items-center rounded-xl border p-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{entry.orderNumber}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {locked ? 'Shipment locked after dispatch' : notReadyToShip ? 'Must be Ready To Ship' : 'Will update tracking and mark as Shipped'}
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={entry.trackingNumber} onChange={(event) => updateEntry(entry.orderId, 'trackingNumber', event.target.value)} placeholder="Tracking number" disabled={disabled} className={disabled ? 'opacity-70' : ''} />
                  <Input type="number" min="0" value={entry.actualShippingCost} onChange={(event) => updateEntry(entry.orderId, 'actualShippingCost', event.target.value)} placeholder="Actual shipping cost" disabled={disabled} className={disabled ? 'opacity-70' : ''} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5 mt-4">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional tracking note" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Saving…' : 'Save Tracking Information'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function TrackingImportDialog({ open, onOpenChange, onCompleted }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
  }, [open]);

  const handlePreview = async () => {
    if (!file) {
      toast.error('Please choose a tracking template file.');
      return;
    }
    setLoadingPreview(true);
    try {
      const result = await ordersApi.previewTrackingImport(file);
      setPreview(result);
    } catch (error) {
      toast.error(error.message || 'Tracking import preview could not be generated.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirm = async () => {
    const validRows = (preview?.rows || []).filter((row) => row.status === 'valid');
    if (validRows.length === 0) {
      toast.error('There are no valid rows to import.');
      return;
    }
    setConfirming(true);
    try {
      const result = await ordersApi.confirmTrackingImport(validRows);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      await onCompleted(result);
    } finally {
      setConfirming(false);
    }
  };

  const rows = Array.isArray(preview?.rows) ? preview.rows : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tracking Numbers</DialogTitle>
          <DialogDescription>Upload the exported tracking template, review the preview, then confirm the import.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tracking Template File (.xlsx or .csv)</Label>
            <Input type="file" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            {/* <p className="text-xs text-muted-foreground">Shipping Date format: DD-MM-YYYY (example: 10-08-2026). Keep Tracking Number as text so values like 00088127637 stay intact.</p> */}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handlePreview} disabled={loadingPreview || !file}>{loadingPreview ? 'Previewing…' : 'Preview Import'}</Button>
          </div>

          {preview?.summary ? (
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Rows</p><p className="text-2xl font-semibold">{preview.summary.total}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Valid</p><p className="text-2xl font-semibold text-emerald-600">{preview.summary.valid}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Invalid</p><p className="text-2xl font-semibold text-rose-600">{preview.summary.invalid}</p></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground uppercase tracking-wider">Skipped</p><p className="text-2xl font-semibold text-amber-600">{preview.summary.skipped}</p></div>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={`${row.rowNumber}-${row.orderNumber}`} className="rounded-xl border border-border/70 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-muted-foreground">Row {row.rowNumber} · {row.orderNumber || 'No Order Number'}</p>
                    <Badge className={row.status === 'valid' ? 'bg-emerald-500/10 text-emerald-600' : row.status === 'skipped' ? 'bg-amber-500/10 text-amber-700' : 'bg-rose-500/10 text-rose-600'}>{row.status}</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">Tracking: {row.trackingNumber || '—'}</p>
                  {row.shippingDate ? <p className="mt-1 text-muted-foreground">Shipping Date & Time: {fmtDateTime(row.shippingDate)}</p> : null}
                  {row.actualShippingCost !== null && row.actualShippingCost !== undefined ? <p className="mt-1 text-muted-foreground">Actual Shipping Cost: {fmtCurrency(row.actualShippingCost)}</p> : null}
                  {row.currentTrackingNumber && row.currentTrackingNumber !== row.trackingNumber ? <p className="mt-1 text-amber-700">Current: {row.currentTrackingNumber} · New: {row.trackingNumber}</p> : null}
                  {Array.isArray(row.warnings) && row.warnings.length > 0 ? <p className="mt-1 text-amber-700">{row.warnings.join(' · ')}</p> : null}
                  {row.reason ? <p className="mt-1 text-rose-600">{row.reason}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={confirming || !preview || Number(preview.summary?.valid || 0) === 0}>{confirming ? 'Importing…' : 'Confirm Import'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function normalizeScannedTrackingNumber(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function getDisplayOrderNumber(order) {
  return order?.publicOrderNumber || order?.orderNumber || '—';
}

const SCAN_MODE_IMAGE_REGIONS = [
  { name: 'full', x: 0, y: 0, width: 1, height: 1 },
  { name: 'center', x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
  { name: 'left', x: 0, y: 0, width: 0.6, height: 1 },
  { name: 'right', x: 0.4, y: 0, width: 0.6, height: 1 },
  { name: 'top', x: 0, y: 0, width: 1, height: 0.6 },
  { name: 'bottom', x: 0, y: 0.4, width: 1, height: 0.6 },
];

function loadScanModeImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Selected image could not be loaded.'));
    image.src = imageUrl;
  });
}

function buildScanModeRegionImageUrl(image, region) {
  if (region.name === 'full') return '';
  const canvas = document.createElement('canvas');
  const sourceWidth = Math.max(1, Math.floor(image.naturalWidth || image.width || 1));
  const sourceHeight = Math.max(1, Math.floor(image.naturalHeight || image.height || 1));
  const sx = Math.floor(sourceWidth * region.x);
  const sy = Math.floor(sourceHeight * region.y);
  const sw = Math.max(1, Math.floor(sourceWidth * region.width));
  const sh = Math.max(1, Math.floor(sourceHeight * region.height));
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext('2d');
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/png');
}

async function decodeScanModeImageElement(reader, image) {
  try {
    const result = typeof reader.decodeFromImageElement === 'function'
      ? await reader.decodeFromImageElement(image)
      : await reader.decodeFromImage(image);
    return normalizeScannedTrackingNumber(result?.getText?.() || result?.text || '');
  } catch (_error) {
    return '';
  }
}

async function decodeBarcodeFromScanModeImage(imageUrl) {
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader();
  const sourceImage = await loadScanModeImage(imageUrl);
  const decodedValues = new Set();

  for (const region of SCAN_MODE_IMAGE_REGIONS) {
    let regionUrl = '';
    try {
      regionUrl = buildScanModeRegionImageUrl(sourceImage, region);
      const image = regionUrl ? await loadScanModeImage(regionUrl) : sourceImage;
      const decoded = await decodeScanModeImageElement(reader, image);
      if (decoded) decodedValues.add(decoded);
    } finally {
      if (regionUrl) URL.revokeObjectURL?.(regionUrl);
    }
  }

  const trackingNumbers = [...decodedValues];
  if (trackingNumbers.length > 1) {
    return { status: 'multiple', trackingNumbers };
  }
  if (trackingNumbers.length === 1) {
    return { status: 'success', trackingNumber: trackingNumbers[0] };
  }
  return { status: 'not_found', trackingNumbers: [] };
}

function ScanModeDialog({ open, onOpenChange, onCompleted }) {
  const videoRef = useRef(null);
  const imageInputRef = useRef(null);
  const imagePreviewUrlRef = useRef('');
  const scannerControlsRef = useRef(null);
  const scanLockedRef = useRef(false);
  const [readyOrders, setReadyOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanInputMode, setScanInputMode] = useState('camera');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageDecoding, setImageDecoding] = useState(false);
  const [imageError, setImageError] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [manualEntry, setManualEntry] = useState(false);
  const [shippingDate, setShippingDate] = useState('');
  const [actualShippingCost, setActualShippingCost] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [initialReadyCount, setInitialReadyCount] = useState(0);

  const selectedOrder = useMemo(
    () => readyOrders.find((order) => order.id === selectedOrderId) || readyOrders[0] || null,
    [readyOrders, selectedOrderId],
  );

  const remainingCount = readyOrders.length;
  const scannedCount = successCount + failedCount;
  const totalProgressCount = Math.max(initialReadyCount, successCount + remainingCount);

  const stopCamera = useCallback(() => {
    scanLockedRef.current = false;
    if (scannerControlsRef.current?.stop) {
      scannerControlsRef.current.stop();
    }
    scannerControlsRef.current = null;
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks?.().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  }, []);

  const clearImageState = useCallback(() => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = '';
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setImagePreviewUrl('');
    setImageDecoding(false);
    setImageError('');
  }, []);

  const resetScanResult = useCallback(() => {
    scanLockedRef.current = false;
    setScanResult('');
    setManualEntry(false);
    setScanInputMode('camera');
    setCameraError('');
    clearImageState();
    setShippingDate(toDatetimeLocalInputValue(new Date()));
  }, [clearImageState]);

  const loadReadyOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const result = await ordersApi.listScanModeReadyOrders();
      const orders = Array.isArray(result?.data) ? result.data : [];
      setReadyOrders(orders);
      setSelectedOrderId((current) => (orders.some((order) => order.id === current) ? current : (orders[0]?.id || '')));
      setInitialReadyCount((current) => current || Number(result?.summary?.readyToShip || orders.length || 0));
    } catch (error) {
      toast.error(error.message || 'Scan Mode ready orders could not be loaded.');
      setReadyOrders([]);
      setSelectedOrderId('');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      clearImageState();
      return;
    }
    setSuccessCount(0);
    setFailedCount(0);
    setLastResult(null);
    setInitialReadyCount(0);
    resetScanResult();
    loadReadyOrders();
  }, [clearImageState, loadReadyOrders, open, resetScanResult, stopCamera]);

  useEffect(() => () => {
    stopCamera();
    clearImageState();
  }, [clearImageState, stopCamera]);

  useEffect(() => {
    if (!open || !selectedOrder) return;
    setActualShippingCost(selectedOrder.actualShippingCost ?? '');
    setShippingDate(toDatetimeLocalInputValue(new Date()));
    setScanResult('');
    setManualEntry(false);
    setScanInputMode('camera');
    setCameraError('');
    clearImageState();
  }, [clearImageState, open, selectedOrder?.id]);

  const startCamera = async () => {
    if (!selectedOrder) {
      toast.error('No Ready To Ship order is available for Scan Mode.');
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Camera is not available in this browser. Use manual tracking entry instead.');
      return;
    }

    stopCamera();
    clearImageState();
    setScanInputMode('camera');
    setManualEntry(false);
    setCameraError('');
    setCameraLoading(true);
    scanLockedRef.current = false;

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          const decodedText = normalizeScannedTrackingNumber(result?.getText?.() || result?.text || '');
          if (!decodedText || scanLockedRef.current) return;
          scanLockedRef.current = true;
          setScanResult(decodedText);
          setManualEntry(false);
          setCameraError('');
          toast.success('Barcode detected. Review and confirm shipment.');
          stopCamera();
        },
      );
      scannerControlsRef.current = controls;
      setCameraActive(true);
    } catch (error) {
      const message = error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access or enter the tracking number manually.'
        : (error?.message || 'Camera could not be started. Enter the tracking number manually if needed.');
      setCameraError(message);
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  };

  const selectOrder = (orderId) => {
    stopCamera();
    setSelectedOrderId(orderId);
    resetScanResult();
    setLastResult(null);
  };

  const handleManualEntry = () => {
    stopCamera();
    clearImageState();
    setScanInputMode('manual');
    setManualEntry(true);
    setScanResult('');
    setCameraError('');
  };

  const openImagePicker = () => {
    if (!selectedOrder) {
      toast.error('No Ready To Ship order is available for Scan Mode.');
      return;
    }
    stopCamera();
    clearImageState();
    setScanInputMode('image');
    setManualEntry(false);
    setScanResult('');
    setCameraError('');
    imageInputRef.current?.click();
  };

  const handleImageFileSelected = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setImageError('Please choose an image file containing the courier label barcode.');
      return;
    }

    stopCamera();
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = '';
    }
    const previewUrl = URL.createObjectURL(file);
    imagePreviewUrlRef.current = previewUrl;
    setImagePreviewUrl(previewUrl);
    setImageDecoding(true);
    setImageError('');
    setScanInputMode('image');
    setManualEntry(false);
    setScanResult('');

    try {
      const imageDecodeResult = await decodeBarcodeFromScanModeImage(previewUrl);
      if (imageDecodeResult.status === 'success') {
        const decodedTrackingNumber = normalizeScannedTrackingNumber(imageDecodeResult.trackingNumber);
        setScanResult(decodedTrackingNumber);
        setImageError('');
        toast.success('Barcode detected from image. Review and confirm shipment.');
        return;
      }
      if (imageDecodeResult.status === 'multiple') {
        setImageError('Multiple barcodes detected. Please upload a photo containing only the courier label barcode.');
        return;
      }
      setImageError('Barcode not detected. Make sure the entire barcode is visible, the image is not blurry, lighting is sufficient, and the barcode is not cut off.');
    } catch (error) {
      setImageError(error?.message || 'Barcode could not be decoded from the selected image.');
    } finally {
      setImageDecoding(false);
    }
  };

  const confirmShipment = async () => {
    const normalizedTrackingNumber = normalizeScannedTrackingNumber(scanResult);
    if (!selectedOrder) {
      toast.error('Select a Ready To Ship order first.');
      return;
    }
    if (!normalizedTrackingNumber) {
      toast.error('Tracking number is required before confirming shipment.');
      return;
    }
    if (actualShippingCost !== '' && (!Number.isFinite(Number(actualShippingCost)) || Number(actualShippingCost) < 0)) {
      toast.error('Actual Shipping Cost must be a numeric amount greater than or equal to 0.');
      return;
    }

    setConfirming(true);
    try {
      const result = await ordersApi.confirmScanModeShipment({
        orderId: selectedOrder.id,
        trackingNumber: normalizedTrackingNumber,
        shippingDate: shippingDate ? new Date(shippingDate).toISOString() : new Date().toISOString(),
        actualShippingCost: actualShippingCost === '' ? undefined : Number(actualShippingCost),
      });
      const shippedOrder = result.order;
      const nextReadyOrders = readyOrders.filter((order) => order.id !== selectedOrder.id);
      const nextOrder = nextReadyOrders[0] || null;
      setReadyOrders(nextReadyOrders);
      setSelectedOrderId(nextOrder?.id || '');
      setSuccessCount((count) => count + 1);
      setLastResult({ status: 'success', order: shippedOrder, trackingNumber: normalizedTrackingNumber });
      resetScanResult();
      toast.success(`Shipment confirmed for ${getDisplayOrderNumber(selectedOrder)}.`);
      await onCompleted?.(result);
    } catch (error) {
      setFailedCount((count) => count + 1);
      setLastResult({ status: 'error', message: error.message || 'Shipment was not updated.', trackingNumber: normalizedTrackingNumber, order: selectedOrder });
      toast.error(error.message || 'Shipment was not updated.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Camera className="h-5 w-5" />
            Scan Mode
          </DialogTitle>
          <DialogDescription>
            Select a Ready To Ship order, scan the courier barcode or QR code, review details, then confirm shipment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border p-3 bg-cyan-500/5"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ready To Ship</p><p className="text-2xl font-semibold text-cyan-700">{remainingCount}</p></div>
          <div className="rounded-2xl border p-3 bg-emerald-500/5"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Successful</p><p className="text-2xl font-semibold text-emerald-700">{successCount}</p></div>
          <div className="rounded-2xl border p-3 bg-rose-500/5"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Failed</p><p className="text-2xl font-semibold text-rose-700">{failedCount}</p></div>
          <div className="rounded-2xl border p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Progress</p><p className="text-2xl font-semibold">{successCount} / {totalProgressCount}</p><p className="text-[11px] text-muted-foreground mt-1">Scanned: {scannedCount}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Select Order</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadReadyOrders} disabled={loadingOrders}>
                <RefreshCw className={`h-3.5 w-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
              {loadingOrders ? (
                <div className="rounded-2xl border p-5 text-sm text-muted-foreground text-center">Loading Ready To Ship orders…</div>
              ) : readyOrders.length === 0 ? (
                <div className="rounded-2xl border p-5 text-sm text-muted-foreground text-center">No Ready To Ship orders waiting.</div>
              ) : readyOrders.map((order) => {
                const active = selectedOrder?.id === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => selectOrder(order.id)}
                    className={`w-full text-left rounded-2xl border p-3 transition-colors ${active ? 'border-[#111827] bg-[#111827] text-white' : 'border-border hover:bg-muted/50'}`}
                  >
                    <p className="font-mono text-sm font-semibold">{getDisplayOrderNumber(order)}</p>
                    <p className={`text-sm mt-1 ${active ? 'text-white/80' : 'text-muted-foreground'}`}>{order.customerName || order.recipientName || 'Customer'}</p>
                    <p className={`text-xs mt-2 ${active ? 'text-white/75' : 'text-muted-foreground'}`}>Courier: {order.shipmentCourier || '—'} · Service: {order.shipmentService || '—'}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {selectedOrder ? (
              <div className="rounded-3xl border border-border/80 p-4 sm:p-5 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current Order</p>
                    <p className="font-mono text-lg font-semibold mt-1">{getDisplayOrderNumber(selectedOrder)}</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedOrder.customerName || selectedOrder.recipientName || 'Customer'}</p>
                  </div>
                  {fulfillmentStatusBadge(FULFILLMENT_STATUS.READY_TO_SHIP)}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <div className="rounded-2xl bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Courier</p><p className="font-semibold mt-1">{selectedOrder.shipmentCourier || '—'}</p></div>
                  <div className="rounded-2xl bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Service</p><p className="font-semibold mt-1">{selectedOrder.shipmentService || '—'}</p></div>
                  <div className="rounded-2xl bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer Shipping Fee</p><p className="font-semibold mt-1">{fmtCurrency(selectedOrder.customerShippingCost)}</p></div>
                  <div className="rounded-2xl bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Items</p><p className="font-semibold mt-1">{selectedOrder.totalItems || 0}</p></div>
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-border/80 p-4 sm:p-5 bg-[#0B1120] text-white overflow-hidden">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelected} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={!selectedOrder || cameraLoading || confirming}
                  className={`rounded-2xl border p-4 text-left transition-colors ${scanInputMode === 'camera' ? 'border-white bg-white text-[#111827]' : 'border-white/20 bg-white/5 text-white hover:bg-white/10'} disabled:opacity-60`}
                >
                  <Camera className="h-5 w-5 mb-3" />
                  <p className="font-semibold">Scan with Camera</p>
                  <p className={`text-xs mt-1 ${scanInputMode === 'camera' ? 'text-[#5F6B7A]' : 'text-white/60'}`}>Use live camera scanner</p>
                </button>
                <button
                  type="button"
                  onClick={openImagePicker}
                  disabled={!selectedOrder || imageDecoding || confirming}
                  className={`rounded-2xl border p-4 text-left transition-colors ${scanInputMode === 'image' ? 'border-white bg-white text-[#111827]' : 'border-white/20 bg-white/5 text-white hover:bg-white/10'} disabled:opacity-60`}
                >
                  <ImageIcon className="h-5 w-5 mb-3" />
                  <p className="font-semibold">Upload / Take Photo</p>
                  <p className={`text-xs mt-1 ${scanInputMode === 'image' ? 'text-[#5F6B7A]' : 'text-white/60'}`}>Scan barcode from an image</p>
                </button>
                <button
                  type="button"
                  onClick={handleManualEntry}
                  disabled={!selectedOrder || confirming}
                  className={`rounded-2xl border p-4 text-left transition-colors ${scanInputMode === 'manual' ? 'border-white bg-white text-[#111827]' : 'border-white/20 bg-white/5 text-white hover:bg-white/10'} disabled:opacity-60`}
                >
                  <Upload className="h-5 w-5 mb-3" />
                  <p className="font-semibold">Enter Tracking Manually</p>
                  <p className={`text-xs mt-1 ${scanInputMode === 'manual' ? 'text-[#5F6B7A]' : 'text-white/60'}`}>Fallback when scanning fails</p>
                </button>
              </div>

              {scanInputMode === 'camera' ? (
                <div className="mt-4">
                  <div className="relative aspect-[4/3] sm:aspect-video rounded-2xl bg-black overflow-hidden flex items-center justify-center">
                    <video ref={videoRef} className={`h-full w-full object-cover ${cameraActive ? 'block' : 'hidden'}`} muted playsInline />
                    {!cameraActive ? (
                      <div className="text-center px-6">
                        <Camera className="h-12 w-12 mx-auto text-white/40 mb-3" />
                        <p className="font-semibold">Camera Preview</p>
                        <p className="text-sm text-white/60 mt-1">Rear camera will be requested when scanning starts.</p>
                      </div>
                    ) : null}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-[72%] max-w-sm aspect-[1.7/1] rounded-2xl border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
                    </div>
                    {cameraLoading ? <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-sm"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Initializing camera…</div> : null}
                  </div>
                  <p className="text-sm text-white/70 text-center mt-3">Align courier barcode or QR code inside the frame.</p>
                  {cameraError ? <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{cameraError}</div> : null}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <Button className="gap-2 bg-white text-[#111827] hover:bg-white/90 h-12" onClick={startCamera} disabled={!selectedOrder || cameraLoading || confirming}>
                      <Camera className="h-4 w-4" />
                      {cameraActive ? 'Scanning…' : 'Start Camera'}
                    </Button>
                    <Button variant="outline" className="gap-2 h-12 border-white/30 bg-transparent text-white hover:bg-white/10" onClick={stopCamera} disabled={!cameraActive && !cameraLoading}>
                      Stop Camera
                    </Button>
                  </div>
                </div>
              ) : null}

              {scanInputMode === 'image' ? (
                <div className="mt-4 space-y-3">
                  {imagePreviewUrl ? (
                    <div className="rounded-2xl border border-white/20 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-semibold">Selected Label</p>
                        {imageDecoding ? <span className="inline-flex items-center gap-2 text-xs text-white/70"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Decoding barcode…</span> : null}
                      </div>
                      <img src={imagePreviewUrl} alt="Selected courier label preview" className="max-h-72 w-full rounded-xl object-contain bg-black/30" />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-6 text-center">
                      <ImageIcon className="h-10 w-10 mx-auto text-white/40 mb-3" />
                      <p className="font-semibold">No label image selected</p>
                      <p className="text-sm text-white/60 mt-1">Take a clear photo or choose an existing courier label image.</p>
                    </div>
                  )}

                  {imageError ? (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold">{imageError.startsWith('Multiple') ? 'Multiple barcodes detected' : 'Barcode not detected'}</p>
                          <p className="mt-1 text-amber-50/80">{imageError}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                        <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={openImagePicker} disabled={imageDecoding}>Try Another Image</Button>
                        <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={startCamera}>Scan with Camera</Button>
                        <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={handleManualEntry}>Enter Tracking Manually</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {manualEntry ? (
              <div className="rounded-2xl border p-4 space-y-2">
                <Label>Manual Tracking Number</Label>
                <Input value={scanResult} onChange={(event) => setScanResult(normalizeScannedTrackingNumber(event.target.value))} placeholder="Enter tracking number if camera is unavailable" className="font-mono text-base" />
              </div>
            ) : null}

            {scanResult ? (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="h-5 w-5" /> Barcode detected</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2"><Label>Tracking Number</Label><Input value={scanResult} onChange={(event) => setScanResult(normalizeScannedTrackingNumber(event.target.value))} className="font-mono text-base" /></div>
                  <div className="space-y-1.5"><Label>Courier</Label><Input value={selectedOrder?.shipmentCourier || ''} disabled /></div>
                  <div className="space-y-1.5"><Label>Service</Label><Input value={selectedOrder?.shipmentService || ''} disabled /></div>
                  <div className="space-y-1.5"><Label>Shipping Date & Time</Label><Input type="datetime-local" value={shippingDate} onChange={(event) => setShippingDate(event.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Actual Shipping Cost</Label><Input type="number" min="0" value={actualShippingCost} onChange={(event) => setActualShippingCost(event.target.value)} placeholder="Real courier cost" /></div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button className="h-12 gap-2" onClick={confirmShipment} disabled={confirming}>{confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm Shipment</Button>
                  <Button variant="outline" className="h-12 gap-2" onClick={resetScanResult} disabled={confirming}><RotateCcw className="h-4 w-4" /> Scan Again</Button>
                </div>
              </div>
            ) : null}

            {lastResult ? (
              <div className={`rounded-3xl border p-4 ${lastResult.status === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                {lastResult.status === 'success' ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-800">Shipment confirmed</p>
                      <p className="font-mono text-sm mt-1">{lastResult.order?.publicOrderNumber || lastResult.order?.orderNumber}</p>
                      <p className="text-sm text-muted-foreground mt-1">Tracking: {lastResult.trackingNumber}</p>
                      <p className="text-sm text-muted-foreground">{lastResult.order?.shipment?.courier} · {lastResult.order?.shipment?.service}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-rose-700 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-800">Shipment was not updated</p>
                      <p className="text-sm text-muted-foreground mt-1">{lastResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close Scan Mode</Button>
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
  const [statusTab, setStatusTab] = useState("ALL");
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [courierFilter, setCourierFilter] = useState("");
  const [detailOrder, setDetailOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [summary, setSummary] = useState({
    all: 0,
    pendingPayment: 0,
    paid: 0,
    needFulfillment: 0,
    processing: 0,
    packed: 0,
    shipped: 0,
    delivered: 0,
    completed: 0,
    cancelled: 0,
    refundRequested: 0,
    refundApproved: 0,
    refundProcessing: 0,
    refundCompleted: 0,
    refundRejected: 0,
    refundFailed: 0,
  });
  const [pendingReference, setPendingReference] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [showBulkTracking, setShowBulkTracking] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [shippingLabelPrintLoading, setShippingLabelPrintLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [showBulkResult, setShowBulkResult] = useState(false);
  const [showImportTracking, setShowImportTracking] = useState(false);
  const [showScanMode, setShowScanMode] = useState(false);
  const [exportingTemplate, setExportingTemplate] = useState(false);

  const [sortBy, sortOrder] = useMemo(() => sortValue.split(":"), [sortValue]);
  const currentPageOrderIds = useMemo(() => items.map((order) => order.id), [items]);
  const selectedOrders = useMemo(() => items.filter((order) => selectedOrderIds.has(order.id)), [items, selectedOrderIds]);
  const selectedCount = selectedOrderIds.size;
  const selectedPackingCount = useMemo(() => selectedOrders.filter((order) => String(order.fulfillmentStatus || order.fulfillmentStatusLabel || '').trim().toUpperCase() === FULFILLMENT_STATUS.PACKING).length, [selectedOrders]);
  const selectedNonPackingCount = Math.max(0, selectedCount - selectedPackingCount);
  const selectedShippingLabelReadyCount = useMemo(() => selectedOrders.filter((order) => String(order.shippingProvider || '').trim().toLowerCase() === 'biteship' && Boolean(order.shippingProviderOrderId) && Boolean(order.trackingNumber)).length, [selectedOrders]);
  const selectedShippingLabelNotReadyCount = Math.max(0, selectedCount - selectedShippingLabelReadyCount);
  const allCurrentPageSelected = currentPageOrderIds.length > 0 && currentPageOrderIds.every((orderId) => selectedOrderIds.has(orderId));

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
      status: statusTab,
      startDate: dateFrom,
      endDate: dateTo,
      courier: courierFilter,
    });
    if (result?.error) {
      toast.error(result.error);
      setItems([]);
      setPagination({ page: 1, limit: DEFAULT_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
      setSummary({
        all: 0,
        pendingPayment: 0,
        paid: 0,
        needFulfillment: 0,
        processing: 0,
        packed: 0,
        shipped: 0,
        delivered: 0,
        completed: 0,
        cancelled: 0,
        refundRequested: 0,
        refundApproved: 0,
        refundProcessing: 0,
        refundCompleted: 0,
        refundRejected: 0,
        refundFailed: 0,
      });
      setLoading(false);
      return;
    }

    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setSummary(result?.summary || {
      all: 0,
      pendingPayment: 0,
      paid: 0,
      needFulfillment: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      refundRequested: 0,
      refundApproved: 0,
      refundProcessing: 0,
      refundCompleted: 0,
      refundRejected: 0,
      refundFailed: 0,
    });
    setLoading(false);
  }, [courierFilter, dateFrom, dateTo, fulfillmentStatusFilter, limit, page, paymentStatusFilter, search, sortBy, sortOrder, statusTab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sortValue, limit, paymentStatusFilter, fulfillmentStatusFilter, statusTab, dateFrom, dateTo, courierFilter]);

  useEffect(() => {
    setSelectedOrderIds(new Set());
    setBulkAction("");
  }, [page, search, sortValue, limit, paymentStatusFilter, fulfillmentStatusFilter, statusTab, dateFrom, dateTo, courierFilter]);

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

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleSelectCurrentPage = () => {
    setSelectedOrderIds((current) => {
      if (allCurrentPageSelected) {
        return new Set();
      }
      return new Set(currentPageOrderIds);
    });
  };

  const handleBulkActionChange = (value) => {
    setBulkAction(value);
    if (value === "status") {
      setShowBulkStatus(true);
    }
    if (value === "tracking") {
      setShowBulkTracking(true);
    }
    if (value === "import-tracking") {
      setShowImportTracking(true);
    }
    window.setTimeout(() => setBulkAction(""), 0);
  };

  const handleBulkCompleted = async (result) => {
    setBulkResult(result);
    setShowBulkResult(true);
    setSelectedOrderIds(new Set());
    await load();
  };

  const handlePrintSelected = async () => {
    const orderIds = Array.from(selectedOrderIds);
    if (orderIds.length === 0) {
      toast.error('Select at least one order to print.');
      return;
    }

    setPrintLoading(true);
    try {
      const result = await ordersApi.printSelected(orderIds);
      if (result.rejectedCount > 0) {
        toast.warning(`${result.rejectedCount} selected order(s) are not in PACKING status and were excluded from PDF.`);
      }

      downloadPackingSlipPdf(result.blob);
      toast.success(`Packing slip PDF downloaded for ${result.printableCount} order(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Packing slips could not be printed.');
    } finally {
      setPrintLoading(false);
    }
  };

  const handlePrintShippingLabels = async () => {
    const orderIds = Array.from(selectedOrderIds);
    if (orderIds.length === 0) {
      toast.error('Select at least one order to print shipping labels.');
      return;
    }

    setShippingLabelPrintLoading(true);
    try {
      const result = await ordersApi.printShippingLabels(orderIds);
      if (result.rejectedCount > 0) {
        toast.warning(`${result.rejectedCount} selected order(s) are not ready for shipping labels and were excluded from PDF.`);
      }
      downloadPdf(result.blob, 'onemission-shipping-labels');
      toast.success(`Shipping label PDF downloaded for ${result.printableCount} order(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Shipping labels could not be printed.');
    } finally {
      setShippingLabelPrintLoading(false);
    }
  };

  const exportTrackingTemplate = async () => {
    const orderIds = Array.from(selectedOrderIds);
    if (orderIds.length === 0) {
      toast.error('Please select at least one order before exporting the tracking template.');
      return;
    }
    setExportingTemplate(true);
    try {
      const blob = await ordersApi.exportTrackingTemplate(orderIds);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `onemission-tracking-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || 'Tracking template could not be exported.');
    } finally {
      setExportingTemplate(false);
    }
  };

  const submitBulkStatus = async ({ fulfillmentStatus, notes }) => {
    if (selectedOrders.length === 0) {
      toast.error("Select at least one order first.");
      return;
    }
    setBulkLoading(true);
    try {
      const result = await ordersApi.bulkFulfillment({
        operation: "FULFILLMENT_STATUS",
        orderIds: selectedOrders.map((order) => order.id),
        fulfillmentStatus,
        notes,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setShowBulkStatus(false);
      await handleBulkCompleted(result);
    } finally {
      setBulkLoading(false);
    }
  };

  const submitBulkTracking = async ({ entries, shipmentCourier, shipmentService, shippingDate, notes }) => {
    if (selectedOrders.length === 0) {
      toast.error("Select at least one order first.");
      return;
    }
    setBulkLoading(true);
    try {
      const result = await ordersApi.bulkFulfillment({
        operation: "TRACKING",
        entries,
        shipmentCourier,
        shipmentService,
        shippingDate,
        notes,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setShowBulkTracking(false);
      await handleBulkCompleted(result);
    } finally {
      setBulkLoading(false);
    }
  };

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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button className="gap-2 bg-[#111827] hover:bg-[#111827]/90" onClick={() => setShowScanMode(true)}>
            <Camera className="h-4 w-4" />
            Scan Mode
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{summary.packed || 0}</span>
          </Button>
          <Button variant="outline" size="icon" onClick={load} title="Refresh Orders">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        {[
          { label: "Pending Payment", value: summary.pendingPayment, icon: PackageCheck },
          { label: "Need Fulfillment", value: summary.needFulfillment, icon: PackageCheck },
          { label: "Processing", value: summary.processing, icon: PackageCheck },
          { label: "Packed", value: summary.packed, icon: PackageCheck },
          { label: "Shipped", value: summary.shipped, icon: Truck },
          { label: "Refund Requested", value: summary.refundRequested, icon: CheckCircle2 },
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

      <div className="rounded-2xl border border-border/60 bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUS_TABS.map((tab) => {
            const isActive = statusTab === tab.value;
            const count = Number(summary[tab.summaryKey] || 0).toLocaleString();
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusTab(tab.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${isActive ? 'border-[#111827] bg-[#111827] text-white' : 'border-border bg-white text-muted-foreground hover:bg-muted/40 hover:text-foreground'}`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${isActive ? 'bg-white/15 text-white' : 'bg-muted text-foreground'}`}>{count}</span>
              </button>
            );
          })}
        </div>
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

      {selectedCount > 0 ? (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium text-[#111827]">{selectedCount} order{selectedCount === 1 ? "" : "s"} selected</p>
                <p className="text-xs text-muted-foreground">Packing slips: {selectedPackingCount} printable, {selectedNonPackingCount} not PACKING. Shipping labels: {selectedShippingLabelReadyCount} ready, {selectedShippingLabelNotReadyCount} not ready.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={handlePrintSelected} disabled={selectedCount === 0 || printLoading}>
                  <Printer className="h-4 w-4" />
                  {printLoading ? 'Preparing…' : `Print Selected (${selectedCount})`}
                </Button>
                <Button variant="outline" className="gap-2" onClick={handlePrintShippingLabels} disabled={selectedCount === 0 || shippingLabelPrintLoading}>
                  <Printer className="h-4 w-4" />
                  {shippingLabelPrintLoading ? 'Preparing…' : `Print Shipping Labels (${selectedCount})`}
                </Button>
                <Button variant="outline" className="gap-2" onClick={exportTrackingTemplate} disabled={exportingTemplate}>
                  {exportingTemplate ? 'Exporting…' : `Export Tracking Template (${selectedCount})`}
                </Button>
                <Select value={bulkAction} onValueChange={handleBulkActionChange}>
                  <SelectTrigger className="w-[240px]"><SelectValue placeholder="Bulk Actions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Update Fulfillment Status</SelectItem>
                    <SelectItem value="tracking">Update Tracking Information</SelectItem>
                    <SelectItem value="import-tracking">Import Tracking Numbers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      <input type="checkbox" aria-label="Select all orders on current page" checked={allCurrentPageSelected} onChange={toggleSelectCurrentPage} />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Internal Order Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Public Order Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Customer Name</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Payment Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Status</th>
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
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${order.orderNumber}`} checked={selectedOrderIds.has(order.id)} onChange={() => toggleOrderSelection(order.id)} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{order.orderNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{order.publicOrderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(order.orderDate)}</td>
                      <td className="px-4 py-3 font-medium">{order.customerName}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3">{paymentStatusBadge(order.paymentStatus)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {orderStatusBadge(order.status)}
                          {order.returnRequest ? returnWorkflowBadge(order.returnRequest) : null}
                        </div>
                      </td>
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
      <BulkStatusDialog
        open={showBulkStatus}
        onOpenChange={setShowBulkStatus}
        selectedOrders={selectedOrders}
        onSubmit={submitBulkStatus}
        loading={bulkLoading}
      />
      <BulkTrackingDialog
        open={showBulkTracking}
        onOpenChange={setShowBulkTracking}
        selectedOrders={selectedOrders}
        onSubmit={submitBulkTracking}
        loading={bulkLoading}
      />
      <TrackingImportDialog
        open={showImportTracking}
        onOpenChange={setShowImportTracking}
        onCompleted={handleBulkCompleted}
      />
      <ScanModeDialog
        open={showScanMode}
        onOpenChange={setShowScanMode}
        onCompleted={async () => { await load(); }}
      />
      <BulkResultDialog
        open={showBulkResult}
        onOpenChange={setShowBulkResult}
        result={bulkResult}
      />
    </div>
  );
}
