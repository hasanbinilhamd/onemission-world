"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Search,
  TicketPercent,
  Truck,
  Wallet,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const PROMOTION_TYPES = [
  { value: "VOUCHER", label: "Voucher" },
  { value: "DISCOUNT_CAMPAIGN", label: "Discount Campaign" },
  { value: "FREE_SHIPPING_CAMPAIGN", label: "Free Shipping Campaign" },
];

const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed Amount" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
];

const promotionApi = {
  async list({ page, limit, search, status, promotionType, sortBy, sortOrder }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
      status,
      promotionType,
      sortBy,
      sortOrder,
    });
    const response = await fetch(`/api/admin/promotions?${params.toString()}`);
    return response.json();
  },
  async getById(id) {
    const response = await fetch(`/api/admin/promotions/${id}`);
    return response.json();
  },
  async create(payload) {
    const response = await fetch(`/api/admin/promotions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
  async update(id, payload) {
    const response = await fetch(`/api/admin/promotions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  },
  async duplicate(id) {
    const response = await fetch(`/api/admin/promotions/${id}/duplicate`, { method: "POST" });
    return response.json();
  },
  async deactivate(id) {
    const response = await fetch(`/api/admin/promotions/${id}/deactivate`, { method: "PATCH" });
    return response.json();
  },
  async remove(id) {
    const response = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
    return response.json();
  },
};

function fmtCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

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
  return status === "ACTIVE"
    ? <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">ACTIVE</Badge>
    : <Badge variant="outline" className="border-amber-500/40 text-amber-700">INACTIVE</Badge>;
}

function promotionTypeBadge(type) {
  const styles = {
    VOUCHER: "bg-blue-500/10 text-blue-600",
    DISCOUNT_CAMPAIGN: "bg-purple-500/10 text-purple-600",
    FREE_SHIPPING_CAMPAIGN: "bg-cyan-500/10 text-cyan-700",
  };

  return <Badge className={`${styles[type] || "bg-muted text-foreground"} hover:${styles[type] || "bg-muted text-foreground"}`}>{type}</Badge>;
}

function PromotionFormDialog({ open, onOpenChange, initial, onSave, loading = false }) {
  const empty = {
    code: "",
    title: "",
    description: "",
    promotionType: "VOUCHER",
    discountType: "PERCENTAGE",
    percentageValue: 0,
    fixedAmount: 0,
    minimumPurchase: 0,
    maximumDiscount: 0,
    quota: 0,
    isPublic: true,
    status: "ACTIVE",
    startDate: "",
    endDate: "",
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setForm(initial ? {
      ...empty,
      ...initial,
      startDate: initial.startDate ? new Date(initial.startDate).toISOString().slice(0, 16) : "",
      endDate: initial.endDate ? new Date(initial.endDate).toISOString().slice(0, 16) : "",
    } : empty);
  }, [initial, open]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const showPercentageFields = form.discountType === "PERCENTAGE";
  const showFixedFields = form.discountType === "FIXED";
  const showShippingFields = form.discountType === "FREE_SHIPPING";

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.title.trim()) {
      toast.error("Voucher Code and Title are required.");
      return;
    }
    await onSave({
      ...form,
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      percentageValue: Number(form.percentageValue || 0),
      fixedAmount: Number(form.fixedAmount || 0),
      minimumPurchase: Number(form.minimumPurchase || 0),
      maximumDiscount: Number(form.maximumDiscount || 0),
      quota: Number(form.quota || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Promotion" : "New Promotion"}</DialogTitle>
          <DialogDescription>Create a voucher, discount campaign, or free shipping campaign.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Voucher Code</Label>
            <Input value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="SAVE20" />
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Save 20%" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Promotion Type</Label>
            <Select value={form.promotionType} onValueChange={(value) => update("promotionType", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROMOTION_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Discount Type</Label>
            <Select value={form.discountType} onValueChange={(value) => update("discountType", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DISCOUNT_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {showPercentageFields ? (
            <div className="space-y-1.5">
              <Label>Percentage</Label>
              <Input type="number" min="0" value={form.percentageValue} onChange={(event) => update("percentageValue", event.target.value)} />
            </div>
          ) : null}
          {showFixedFields ? (
            <div className="space-y-1.5">
              <Label>Fixed Amount</Label>
              <Input type="number" min="0" value={form.fixedAmount} onChange={(event) => update("fixedAmount", event.target.value)} />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Minimum Purchase</Label>
            <Input type="number" min="0" value={form.minimumPurchase} onChange={(event) => update("minimumPurchase", event.target.value)} />
          </div>
          {(showPercentageFields || showFixedFields) ? (
            <div className="space-y-1.5">
              <Label>Maximum Discount</Label>
              <Input type="number" min="0" value={form.maximumDiscount} onChange={(event) => update("maximumDiscount", event.target.value)} />
            </div>
          ) : null}
          {showShippingFields ? (
            <div className="rounded-xl border border-border/60 bg-[#F7F8FA] px-3 py-3 text-sm text-muted-foreground md:col-span-2">
              Shipping cost will be discounted to zero when checkout subtotal reaches the minimum purchase value.
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Quota</Label>
            <Input type="number" min="0" value={form.quota} onChange={(event) => update("quota", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(value) => update("status", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input type="datetime-local" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End Date</Label>
            <Input type="datetime-local" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Public Promotion</p>
              <p className="text-xs text-muted-foreground mt-1">Private promotions still work when the code is entered manually.</p>
            </div>
            <Switch checked={Boolean(form.isPublic)} onCheckedChange={(value) => update("isPublic", value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Saving…" : initial?.id ? "Save Changes" : "Create Promotion"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromotionsModule() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [promotionType, setPromotionType] = useState("all");
  const [sortValue, setSortValue] = useState("updatedAt:desc");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [sortBy, sortOrder] = useMemo(() => sortValue.split(":"), [sortValue]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await promotionApi.list({
      page,
      limit: 20,
      search,
      status,
      promotionType,
      sortBy,
      sortOrder,
    });
    if (result?.error) {
      toast.error(result.error);
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(Array.isArray(result?.data) ? result.data : []);
    setPagination(result?.pagination || { page: 1, limit: 20, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    setLoading(false);
  }, [page, promotionType, search, sortBy, sortOrder, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status, promotionType, sortValue]);

  const openEdit = async (id) => {
    const result = await promotionApi.getById(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setEditing(result);
    setShowForm(true);
  };

  const savePromotion = async (payload) => {
    setSaving(true);
    try {
      const result = editing?.id
        ? await promotionApi.update(editing.id, payload)
        : await promotionApi.create(payload);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(editing?.id ? "Promotion updated." : "Promotion created.");
      setShowForm(false);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const duplicatePromotion = async (id) => {
    const result = await promotionApi.duplicate(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Promotion duplicated.");
    await load();
  };

  const deactivatePromotion = async (id) => {
    const result = await promotionApi.deactivate(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Promotion deactivated.");
    await load();
  };

  const deletePromotion = async (id) => {
    const result = await promotionApi.remove(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Promotion deleted.");
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Promotions</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Manage vouchers, discount campaigns, and free shipping promotions.</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
          <TicketPercent className="h-4 w-4" /> New Promotion
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Promotions</p><p className="text-3xl font-semibold mt-1">{Number(pagination.totalItems || 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider text-emerald-500">Active Page</p><p className="text-3xl font-semibold mt-1 text-emerald-500">{items.filter((item) => item.status === "ACTIVE").length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider text-cyan-700">Free Shipping</p><p className="text-3xl font-semibold mt-1 text-cyan-700">{items.filter((item) => item.discountType === "FREE_SHIPPING").length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-2">
              <Label>Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search voucher code or title…" />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Promotion Type</Label>
              <Select value={promotionType} onValueChange={setPromotionType}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PROMOTION_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort</Label>
              <Select value={sortValue} onValueChange={setSortValue}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt:desc">Newest Updated</SelectItem>
                  <SelectItem value="updatedAt:asc">Oldest Updated</SelectItem>
                  <SelectItem value="title:asc">Title A-Z</SelectItem>
                  <SelectItem value="code:asc">Voucher Code A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading promotions…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No promotions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Voucher Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Discount</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Used / Quota</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Period</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.description || "—"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{promotionTypeBadge(item.promotionType)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm">
                          {item.discountType === "PERCENTAGE" ? <TicketPercent className="h-4 w-4 text-blue-500" /> : item.discountType === "FREE_SHIPPING" ? <Truck className="h-4 w-4 text-cyan-700" /> : <Wallet className="h-4 w-4 text-emerald-600" />}
                          <span>
                            {item.discountType === "PERCENTAGE"
                              ? `${Number(item.percentageValue || 0)}%`
                              : item.discountType === "FIXED"
                                ? fmtCurrency(item.fixedAmount)
                                : "Free Shipping"}
                          </span>
                        </div>
                        {item.minimumPurchase > 0 ? <p className="text-xs text-muted-foreground mt-1">Min. {fmtCurrency(item.minimumPurchase)}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{Number(item.usedCount || 0).toLocaleString()} / {Number(item.quota || 0) > 0 ? Number(item.quota || 0).toLocaleString() : '∞'}</td>
                      <td className="px-4 py-3">{statusBadge(item.status)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{item.startDate ? formatDateTime(item.startDate) : 'No start'}</div>
                        <div className="mt-1">{item.endDate ? formatDateTime(item.endDate) : 'No end'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(item.id)}>Edit</Button>
                          <Button variant="ghost" size="sm" onClick={() => duplicatePromotion(item.id)}><Copy className="h-3.5 w-3.5 mr-1" />Duplicate</Button>
                          {item.status === "ACTIVE" ? <Button variant="ghost" size="sm" onClick={() => deactivatePromotion(item.id)}>Deactivate</Button> : null}
                          <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-600" onClick={() => deletePromotion(item.id)}>Delete</Button>
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
        <p className="text-sm text-muted-foreground">Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} promotions</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <PromotionFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        initial={editing}
        onSave={savePromotion}
        loading={saving}
      />
    </div>
  );
}
