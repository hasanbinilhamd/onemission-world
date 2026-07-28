"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Mail,
  Search,
  UserRound,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "UNSUBSCRIBED", label: "UNSUBSCRIBED" },
  { value: "BLOCKED", label: "BLOCKED" },
];

function formatDateTime(value) {
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

function subscriberStatusBadge(status) {
  const styles = {
    ACTIVE: "bg-emerald-500/10 text-emerald-600",
    UNSUBSCRIBED: "bg-amber-500/10 text-amber-700",
    BLOCKED: "bg-rose-500/10 text-rose-600",
  };

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${styles[status] || "bg-muted text-foreground"}`}>
      {status || "UNKNOWN"}
    </span>
  );
}

const newsletterApi = {
  async list({ page, limit, search, status }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
      status,
    });
    const response = await fetch(`/api/admin/newsletter/subscribers?${params.toString()}`);
    return response.json();
  },
  async getById(id) {
    const response = await fetch(`/api/admin/newsletter/subscribers/${id}`);
    return response.json();
  },
  async unsubscribe(id) {
    const response = await fetch(`/api/admin/newsletter/subscribers/${id}/unsubscribe`, {
      method: "POST",
    });
    return response.json();
  },
  exportUrl({ search, status }) {
    const params = new URLSearchParams({ search, status });
    return `/api/admin/newsletter/subscribers/export?${params.toString()}`;
  },
};

function NewsletterSubscriberDetailDialog({ open, onOpenChange, item, onUpdated }) {
  const [saving, setSaving] = useState(false);

  if (!item) return null;

  const handleUnsubscribe = async () => {
    setSaving(true);
    try {
      const result = await newsletterApi.unsubscribe(item.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message || "Subscriber marked as unsubscribed.");
      onUpdated?.(result.subscriber || null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.email}</DialogTitle>
          <DialogDescription>
            Subscriber detail, source data, and lifecycle history.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-5 pb-4 space-y-2 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Subscriber</p>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Email</span><span className="font-medium text-right">{item.email}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><span>{subscriberStatusBadge(item.status)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Source</span><span className="font-medium text-right">{item.source || "—"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Subscribed At</span><span className="font-medium text-right">{formatDateTime(item.subscribedAt)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Unsubscribed At</span><span className="font-medium text-right">{formatDateTime(item.unsubscribedAt)}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 space-y-2 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Technical Detail</p>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">IP Address</span><span className="font-medium text-right">{item.ipAddress || "—"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Browser</span><span className="font-medium text-right">{item.browser || "—"}</span></div>
              <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">User Agent</span><span className="font-medium text-right break-all max-w-[16rem]">{item.userAgent || "—"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Created At</span><span className="font-medium text-right">{formatDateTime(item.createdAt)}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Updated At</span><span className="font-medium text-right">{formatDateTime(item.updatedAt)}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">History</p>
            {Array.isArray(item.history) && item.history.length > 0 ? (
              <div className="space-y-3">
                {item.history.map((entry) => (
                  <div key={`${entry.key}-${entry.timestamp}`} className="rounded-lg border border-border/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{entry.notes}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No subscriber history is available yet.</p>
            )}
          </CardContent>
        </Card>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {item.status === "ACTIVE" ? (
            <Button variant="destructive" onClick={handleUnsubscribe} disabled={saving}>
              {saving ? "Updating…" : "Unsubscribe"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewsletterModule() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [summary, setSummary] = useState({
    totalSubscribers: 0,
    activeSubscribers: 0,
    unsubscribedSubscribers: 0,
    blockedSubscribers: 0,
    todaysSubscribers: 0,
    monthlySubscribers: 0,
    growthThisMonth: 0,
    sourceBreakdown: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [detailItem, setDetailItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await newsletterApi.list({ page, limit, search, status });
    if (result?.error) {
      toast.error(result.error);
      setItems([]);
      setPagination({ page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
      setLoading(false);
      return;
    }

    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setSummary(result?.summary || {
      totalSubscribers: 0,
      activeSubscribers: 0,
      unsubscribedSubscribers: 0,
      blockedSubscribers: 0,
      todaysSubscribers: 0,
      monthlySubscribers: 0,
      growthThisMonth: 0,
      sourceBreakdown: [],
    });
    setLoading(false);
  }, [limit, page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const openDetail = async (subscriberId) => {
    const result = await newsletterApi.getById(subscriberId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setDetailItem(result);
    setShowDetail(true);
  };

  const handleUpdated = async () => {
    setShowDetail(false);
    setDetailItem(null);
    await load();
  };

  const handleExport = () => {
    const exportUrl = newsletterApi.exportUrl({ search, status });
    window.open(exportUrl, "_blank", "noopener,noreferrer");
  };

  const sourceSummaryLabel = useMemo(() => {
    if (!Array.isArray(summary.sourceBreakdown) || summary.sourceBreakdown.length === 0) {
      return "No sources recorded yet.";
    }

    return summary.sourceBreakdown.map((entry) => `${entry.source}: ${entry.count}`).join(" · ");
  }, [summary.sourceBreakdown]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Newsletter</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manage ONEMISSION newsletter subscribers, monitor growth, and export marketing-ready data.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Subscribers</p>
            <p className="text-3xl font-semibold mt-1">{Number(summary.totalSubscribers || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-emerald-500">Active Subscribers</p>
            <p className="text-3xl font-semibold mt-1 text-emerald-500">{Number(summary.activeSubscribers || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-amber-600">Unsubscribed</p>
            <p className="text-3xl font-semibold mt-1 text-amber-600">{Number(summary.unsubscribedSubscribers || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-blue-600">Growth This Month</p>
            <p className="text-3xl font-semibold mt-1 text-blue-600">{Number(summary.growthThisMonth || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Today: {Number(summary.todaysSubscribers || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Search email address</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search subscriber…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Subscription Source</p>
              <div className="rounded-lg border border-border/60 bg-[#F7F8FA] px-3 py-2.5 text-sm text-muted-foreground">
                {sourceSummaryLabel}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading subscribers…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No subscribers found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Subscribers collected from the footer will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Subscribed Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Browser</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-medium">{item.email}</td>
                      <td className="px-4 py-3">{subscriberStatusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.source || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.subscribedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.browser || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => openDetail(item.id)}>
                            <Eye className="h-3.5 w-3.5" /> Detail
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} total subscribers
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

      <NewsletterSubscriberDetailDialog open={showDetail} onOpenChange={setShowDetail} item={detailItem} onUpdated={handleUpdated} />
    </div>
  );
}
