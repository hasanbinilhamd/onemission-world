"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search } from "lucide-react";
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
import { toast } from "sonner";

const REFUND_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "REQUESTED", label: "REQUESTED" },
  { value: "APPROVED", label: "APPROVED" },
  { value: "PROCESSING", label: "PROCESSING" },
  { value: "COMPLETED", label: "COMPLETED" },
  { value: "REJECTED", label: "REJECTED" },
];

function fmtCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function fmtDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refundStatusBadge(status) {
  const styles = {
    REQUESTED: "bg-amber-500/10 text-amber-600",
    APPROVED: "bg-cyan-500/10 text-cyan-700",
    PROCESSING: "bg-violet-500/10 text-violet-700",
    COMPLETED: "bg-emerald-500/10 text-emerald-700",
    REJECTED: "bg-rose-500/10 text-rose-600",
    NONE: "bg-slate-500/10 text-slate-600",
  };

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

const refundRequestsApi = {
  async list({ page, limit, search, refundStatus }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
      refundStatus,
    });
    const response = await fetch(`/api/admin/refund-requests?${params.toString()}`);
    return response.json();
  },
  async getById(id) {
    const response = await fetch(`/api/admin/refund-requests/${id}`);
    return response.json();
  },
  async approve(id) {
    const response = await fetch(`/api/admin/returns/${id}/approve`, {
      method: "POST",
    });
    return response.json();
  },
  async reject(id, payload) {
    const response = await fetch(`/api/admin/returns/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
};

function RefundRequestDetailDialog({ open, onOpenChange, item, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    setRejectReason("");
  }, [item?.id, open]);

  if (!item) return null;

  const handleApprove = async () => {
    setSaving(true);
    try {
      const result = await refundRequestsApi.approve(item.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Refund approved and sent to Midtrans.");
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Reject reason is required.");
      return;
    }

    setSaving(true);
    try {
      const result = await refundRequestsApi.reject(item.id, { rejectReason });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Refund rejected successfully.");
      onUpdated?.(result);
    } finally {
      setSaving(false);
    }
  };

  const canApprove = item.refundStatus === "REQUESTED" || item.refundStatus === "APPROVED";
  const canReject = item.refundStatus === "REQUESTED" || item.refundStatus === "APPROVED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.order?.publicOrderNumber || item.order?.orderNumber || "Refund Request"}</DialogTitle>
          <DialogDescription>
            Refund workflow detail, payment information, and approval actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-5 pb-4 space-y-2 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Refund Request</p>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Refund Status</span><span>{refundStatusBadge(item.refundStatus)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Request Type</span><span className="font-medium">{item.requestType || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Refund Amount</span><span className="font-medium">{fmtCurrency(item.refundAmount)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Reason</span><span className="font-medium text-right">{item.reason || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Description</span><span className="font-medium text-right">{item.description || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Reject Reason</span><span className="font-medium text-right">{item.rejectReason || "—"}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 space-y-2 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Information</p>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Payment Method</span><span className="font-medium text-right">{item.order?.payment?.paymentMethod || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Payment Status</span><span className="font-medium text-right">{item.order?.payment?.status || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Refund Reference</span><span className="font-mono text-xs text-right">{item.refundReference || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Refund Provider</span><span className="font-medium text-right">{item.refundProvider || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Midtrans Refund ID</span><span className="font-mono text-xs text-right">{item.refundProviderId || "—"}</span></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-5 pb-4 space-y-2 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Order Summary</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Order Number</span><span className="font-mono text-xs text-right">{item.order?.orderNumber || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Public Order Number</span><span className="font-mono text-xs text-right">{item.order?.publicOrderNumber || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Customer</span><span className="font-medium text-right">{item.order?.customerName || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Customer Email</span><span className="font-medium text-right">{item.order?.customerEmail || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Order Status</span><span className="font-medium text-right">{item.order?.status || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Fulfillment</span><span className="font-medium text-right">{item.order?.fulfillmentStatusLabel || item.order?.fulfillmentStatus || "—"}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Refund Status Timeline</p>
              {Array.isArray(item.timeline) && item.timeline.length > 0 ? (
                <div className="space-y-3">
                  {item.timeline.map((entry) => (
                    <div key={`${entry.status}-${entry.timestamp}`} className="rounded-lg border border-border/40 p-3">
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
              ) : (
                <p className="text-sm text-muted-foreground">No refund timeline is available yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Items</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Variant</th>
                      <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(item.order?.items || []).map((product) => (
                      <tr key={product.id} className="border-b border-border/20 last:border-0">
                        <td className="px-4 py-3 font-medium">{product.productName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{product.variantName}</td>
                        <td className="px-4 py-3 text-right">{product.quantity}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmtCurrency(product.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Reject Reason</Label>
              <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Required only when rejecting a refund request..." rows={3} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {canReject ? (
            <Button variant="destructive" onClick={handleReject} disabled={saving}>
              Reject Refund
            </Button>
          ) : null}
          {canApprove ? (
            <Button onClick={handleApprove} disabled={saving}>
              Approve Refund
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RefundRequestsModule() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refundStatus, setRefundStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [detailItem, setDetailItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await refundRequestsApi.list({ page, limit, search, refundStatus });
    if (result?.error) {
      toast.error(result.error);
      setItems([]);
      setPagination({ page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
      setLoading(false);
      return;
    }

    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setLoading(false);
  }, [limit, page, refundStatus, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [refundStatus, search]);

  const openDetail = async (returnRequestId) => {
    const result = await refundRequestsApi.getById(returnRequestId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setDetailItem(result);
    setShowDetail(true);
  };

  const handleUpdated = (updatedOrder) => {
    if (updatedOrder?.returnRequest?.id) {
      void openDetail(updatedOrder.returnRequest.id);
    }
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Refund Requests</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Review, approve, or reject refund requests initiated from cancelled paid orders and return workflows.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()} title="Refresh Refund Requests">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Search order number / customer</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search refund request…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Refund Status</p>
              <Select value={refundStatus} onValueChange={setRefundStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REFUND_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading refund requests…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">No refund requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Customer</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order Total</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Payment Method</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Cancelled Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Refund Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Reason</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-mono text-xs text-foreground">{item.publicOrderNumber || item.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{item.orderNumber}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.customerName}</p>
                          <p className="text-xs text-muted-foreground">{item.customerEmail || "—"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{fmtCurrency(item.orderTotal)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.paymentMethod || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(item.cancelledDate)}</td>
                      <td className="px-4 py-3">{refundStatusBadge(item.refundStatus)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.reason || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => openDetail(item.id)}>
                          <Eye className="h-3.5 w-3.5" /> Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} total refund requests</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <RefundRequestDetailDialog open={showDetail} onOpenChange={setShowDetail} item={detailItem} onUpdated={handleUpdated} />
    </div>
  );
}
