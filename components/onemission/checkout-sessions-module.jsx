"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, Eye, RefreshCw, Search, ShoppingBag, TimerReset, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "PENDING", label: "PENDING" },
  { value: "PAID", label: "PAID" },
  { value: "CANCELLED", label: "CANCELLED" },
  { value: "EXPIRED", label: "EXPIRED" },
  { value: "COMPLETED", label: "COMPLETED" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

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

function statusBadge(status) {
  const styles = {
    DRAFT: "bg-blue-500/10 text-blue-600",
    PENDING: "bg-amber-500/10 text-amber-600",
    PAID: "bg-emerald-500/10 text-emerald-600",
    CANCELLED: "bg-rose-500/10 text-rose-600",
    EXPIRED: "bg-slate-500/10 text-slate-600",
    COMPLETED: "bg-indigo-500/10 text-indigo-600",
  };

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

function classificationBadge(value) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${value === "Guest" ? "bg-orange-500/10 text-orange-600" : "bg-cyan-500/10 text-cyan-700"}`}>
      {value || "Registered"}
    </span>
  );
}

function CheckoutSessionDetailDialog({ open, onOpenChange, item }) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.checkoutNumber}</DialogTitle>
          <DialogDescription>
            Checkout session detail and payment waiting lifecycle visibility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Name</span><span className="font-medium text-right">{item.customer.customerName || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Email</span><span className="font-medium text-right">{item.customer.email || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Phone</span><span className="font-medium text-right">{item.customer.phone || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Customer Type</span><span>{classificationBadge(item.customerClassification)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><span>{statusBadge(item.status)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Grand Total</span><span className="font-medium">{fmtCurrency(item.totals.grandTotal)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Created At</span><span className="font-medium text-right">{fmtDateTime(item.createdAt)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Expired At</span><span className="font-medium text-right">{fmtDateTime(item.paymentAttempt?.expiresAt || item.expiresAt)}</span></div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Attempt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Attempt Number</span><span className="font-mono text-xs text-right">{item.paymentAttempt?.attemptNumber || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><span>{statusBadge(item.paymentAttempt?.status || "")}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Payment Method</span><span className="font-medium text-right">{item.paymentAttempt?.paymentMethod || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Provider Reference</span><span className="font-mono text-xs text-right">{item.paymentAttempt?.providerReference || "—"}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {item.order ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Order Number</span><span className="font-mono text-xs text-right">{item.order.orderNumber}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Public Order Number</span><span className="font-mono text-xs text-right">{item.order.publicOrderNumber}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Order Status</span><span className="font-medium text-right">{item.order.status}</span></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No order has been created from this checkout session yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checkout Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/20">
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Variant</th>
                      <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">SKU</th>
                      <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Qty</th>
                      <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(item.items || []).map((product) => (
                      <tr key={product.id} className="border-b border-border/20 last:border-0">
                        <td className="px-4 py-3 font-medium">{product.productName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{product.variantName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{product.sku}</td>
                        <td className="px-4 py-3 text-right">{product.quantity}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmtCurrency(product.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CheckoutSessionsModule() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [detailItem, setDetailItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
        status: statusFilter,
      });
      const response = await fetch(`/api/admin/checkout-sessions?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Checkout sessions could not be loaded.");
      }

      setItems(Array.isArray(payload.data) ? payload.data : []);
      setPagination(payload.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout sessions could not be loaded.");
      setItems([]);
      setPagination({ page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    } finally {
      setLoading(false);
    }
  }, [limit, page, search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, limit]);

  const summary = useMemo(() => {
    const counts = {
      pending: 0,
      paid: 0,
      cancelled: 0,
      expired: 0,
    };

    for (const item of items) {
      const status = String(item.status || "").toUpperCase();
      if (status === "DRAFT" || status === "PENDING") counts.pending += 1;
      if (status === "PAID") counts.paid += 1;
      if (status === "CANCELLED") counts.cancelled += 1;
      if (status === "EXPIRED") counts.expired += 1;
    }

    return counts;
  }, [items]);

  const openDetail = async (checkoutSessionId) => {
    try {
      const response = await fetch(`/api/admin/checkout-sessions/${checkoutSessionId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Checkout session detail could not be loaded.");
      }
      setDetailItem(payload);
      setShowDetail(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout session detail could not be loaded.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Checkout Sessions
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Monitor pending, paid, cancelled, and expired checkout sessions before and after order creation.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()} title="Refresh Checkout Sessions">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Pending", value: summary.pending, icon: TimerReset },
          { label: "Paid", value: summary.paid, icon: CreditCard },
          { label: "Cancelled", value: summary.cancelled, icon: ShoppingBag },
          { label: "Expired", value: summary.expired, icon: UserRound },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="pt-5 pb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{card.label}</p>
                  <p className="text-3xl font-semibold mt-1">{loading ? "—" : card.value}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
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
              <p className="text-xs text-muted-foreground mb-1">Search checkout number / customer / email</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search checkout session…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Checkout Status</p>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Page Size</p>
              <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>{option}</SelectItem>
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
            <div className="p-8 text-center text-sm text-muted-foreground">Loading checkout sessions…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No checkout sessions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Checkout Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Customer Type</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Items</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Payment Attempt</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Expired At</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Order</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{item.checkoutNumber}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.customerName}</p>
                          <p className="text-xs text-muted-foreground">{item.customerEmail || "—"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{classificationBadge(item.customerType)}</td>
                      <td className="px-4 py-3 text-right">{item.itemCount}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmtCurrency(item.grandTotal)}</td>
                      <td className="px-4 py-3">
                        {item.paymentAttempt ? (
                          <div>
                            <p className="font-mono text-xs text-foreground">{item.paymentAttempt.attemptNumber}</p>
                            <p className="text-xs text-muted-foreground">{item.paymentAttempt.paymentMethod || "—"}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(item.status)}
                          {item.paymentAttempt ? statusBadge(item.paymentAttempt.status) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(item.expiredAt)}</td>
                      <td className="px-4 py-3">
                        {item.order ? (
                          <div>
                            <p className="font-mono text-xs text-foreground">{item.order.publicOrderNumber}</p>
                            <p className="text-xs text-muted-foreground">{item.order.orderNumber}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not created</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => openDetail(item.id)}>
                          <Eye className="h-3.5 w-3.5" />
                          Detail
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
        <p className="text-sm text-muted-foreground">
          Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} total checkout sessions
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

      <CheckoutSessionDetailDialog open={showDetail} onOpenChange={setShowDetail} item={detailItem} />
    </div>
  );
}
