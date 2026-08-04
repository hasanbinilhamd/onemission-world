"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "SUBSCRIBED", label: "SUBSCRIBED" },
  { value: "NOTIFIED", label: "NOTIFIED" },
  { value: "UNSUBSCRIBED", label: "UNSUBSCRIBED" },
];

const STATUS_OPTIONS = STATUS_FILTER_OPTIONS.filter((option) => option.value !== "all");

const launchSubscribersApi = {
  async list({ page, limit, search, status, source, sortBy, sortOrder }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
      status,
      source,
      sortBy,
      sortOrder,
    });
    const response = await fetch(`/api/admin/launch-subscribers?${params.toString()}`);
    return response.json();
  },
  async getById(id) {
    const response = await fetch(`/api/admin/launch-subscribers/${id}`);
    return response.json();
  },
  async update(id, payload) {
    const response = await fetch(`/api/admin/launch-subscribers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
  async remove(id) {
    const response = await fetch(`/api/admin/launch-subscribers/${id}`, { method: "DELETE" });
    return response.json();
  },
  exportUrl({ search, status, source, sortBy, sortOrder }) {
    const params = new URLSearchParams({ search, status, source, sortBy, sortOrder });
    return `/api/admin/launch-subscribers/export?${params.toString()}`;
  },
};

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

function statusBadge(status) {
  const styles = {
    SUBSCRIBED: "bg-emerald-500/10 text-emerald-600",
    NOTIFIED: "bg-blue-500/10 text-blue-600",
    UNSUBSCRIBED: "bg-amber-500/10 text-amber-700",
  };
  return <Badge className={`${styles[status] || "bg-muted text-foreground"} hover:${styles[status] || "bg-muted text-foreground"}`}>{status || "—"}</Badge>;
}

function SubscriberDetailDialog({ open, onOpenChange, item, onUpdated }) {
  const [status, setStatus] = useState("SUBSCRIBED");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!item) return;
    setStatus(item.status || "SUBSCRIBED");
    setNotes(item.notes || "");
  }, [item]);

  const save = async () => {
    if (!item?.id) return;
    setSaving(true);
    try {
      const result = await launchSubscribersApi.update(item.id, { status, notes });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Launch subscriber updated.");
      await onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item?.id) return;
    setDeleting(true);
    try {
      const result = await launchSubscribersApi.remove(item.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Launch subscriber deleted.");
      await onUpdated();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Launch Subscriber Detail</DialogTitle>
          <DialogDescription>Review WhatsApp launch subscriber details and update follow-up status.</DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs uppercase tracking-wider">Code</p><p className="font-medium mt-1">{item.code}</p></div>
              <div><p className="text-muted-foreground text-xs uppercase tracking-wider">Phone</p><p className="font-medium mt-1">{item.phone}</p></div>
              <div><p className="text-muted-foreground text-xs uppercase tracking-wider">Country</p><p className="font-medium mt-1">{item.countryCode}</p></div>
              <div><p className="text-muted-foreground text-xs uppercase tracking-wider">Source</p><p className="font-medium mt-1">{item.source}</p></div>
              <div><p className="text-muted-foreground text-xs uppercase tracking-wider">Subscribed At</p><p className="font-medium mt-1">{formatDateTime(item.createdAt)}</p></div>
              <div><p className="text-muted-foreground text-xs uppercase tracking-wider">Launch Notified At</p><p className="font-medium mt-1">{formatDateTime(item.launchNotifiedAt)}</p></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Internal launch notes…" />
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="destructive" onClick={remove} disabled={deleting || saving}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting || saving}>Cancel</Button>
          <Button onClick={save} disabled={deleting || saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LaunchSubscribersModule() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [summary, setSummary] = useState({ totalSubscribers: 0, subscribed: 0, notified: 0, unsubscribed: 0, filteredCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sortValue, setSortValue] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [detailItem, setDetailItem] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const [sortBy, sortOrder] = useMemo(() => sortValue.split(":"), [sortValue]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await launchSubscribersApi.list({ page, limit, search, status, source, sortBy, sortOrder });
    if (result?.error) {
      toast.error(result.error);
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setSummary(result?.summary || { totalSubscribers: 0, subscribed: 0, notified: 0, unsubscribed: 0, filteredCount: 0 });
    setLoading(false);
  }, [limit, page, search, sortBy, sortOrder, source, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, status, source, sortValue]);

  const openDetail = async (subscriberId) => {
    const result = await launchSubscribersApi.getById(subscriberId);
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
    window.open(launchSubscribersApi.exportUrl({ search, status, source, sortBy, sortOrder }), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Launch Subscribers</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Manage WhatsApp launch subscribers collected before ecommerce opens.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          <Button variant="outline" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" /> Export Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Subscribers</p><p className="text-3xl font-semibold mt-1">{Number(summary.totalSubscribers || 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider text-emerald-500">Subscribed</p><p className="text-3xl font-semibold mt-1 text-emerald-500">{Number(summary.subscribed || 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider text-blue-600">Notified</p><p className="text-3xl font-semibold mt-1 text-blue-600">{Number(summary.notified || 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider text-amber-600">Unsubscribed</p><p className="text-3xl font-semibold mt-1 text-amber-600">{Number(summary.unsubscribed || 0).toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-end">
            <div className="lg:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Search phone or code</p>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search subscriber…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_FILTER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Source</p>
              <Input value={source} onChange={(event) => setSource(event.target.value || "all")} placeholder="all" />
            </div>
            <div className="lg:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Sort</p>
              <Select value={sortValue} onValueChange={setSortValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt:desc">Newest Subscriber</SelectItem>
                  <SelectItem value="createdAt:asc">Oldest Subscriber</SelectItem>
                  <SelectItem value="code:asc">Code A-Z</SelectItem>
                  <SelectItem value="phone:asc">Phone A-Z</SelectItem>
                  <SelectItem value="status:asc">Status A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading launch subscribers…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center"><Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-muted-foreground text-sm">No launch subscribers found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[rgba(17,24,39,0.04)]"><th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Code</th><th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Phone</th><th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Country</th><th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Source</th><th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th><th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Subscribed At</th><th className="px-4 py-3"></th></tr></thead>
                <tbody>{items.map((item, index) => (<tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}><td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code}</td><td className="px-4 py-3 font-medium">{item.phone}</td><td className="px-4 py-3 text-muted-foreground">{item.countryCode}</td><td className="px-4 py-3 text-muted-foreground">{item.source}</td><td className="px-4 py-3">{statusBadge(item.status)}</td><td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td><td className="px-4 py-3 text-right"><Button variant="outline" size="sm" className="gap-1" onClick={() => openDetail(item.id)}><Eye className="h-3.5 w-3.5" /> Detail</Button></td></tr>))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} total subscribers</p>
        <div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
      </div>

      <SubscriberDetailDialog open={showDetail} onOpenChange={setShowDetail} item={detailItem} onUpdated={handleUpdated} />
    </div>
  );
}
