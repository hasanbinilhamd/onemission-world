"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Search,
  TicketPercent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const PROMOTION_TYPES = [
  { value: "VOUCHER", label: "Voucher" },
  { value: "AUTOMATIC_DISCOUNT", label: "Discount" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
];

const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED", label: "Fixed Amount" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
];

const DISCOUNT_ONLY_TYPES = DISCOUNT_TYPES.filter((option) => option.value !== "FREE_SHIPPING");

const TARGET_SCOPES = [
  { value: "ENTIRE_STORE", label: "Entire Store" },
  { value: "SPECIFIC_PRODUCT", label: "Specific Product" },
  { value: "SPECIFIC_CATEGORY", label: "Specific Category" },
  { value: "SELECTED_PRODUCTS", label: "Selected Products" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
];

const TYPE_BY_TAB = {
  voucher: "VOUCHER",
  discount: "AUTOMATIC_DISCOUNT",
  freeshipping: "FREE_SHIPPING",
};

const TAB_BY_TYPE = Object.fromEntries(Object.entries(TYPE_BY_TAB).map(([key, value]) => [value, key]));

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

function promotionTypeLabel(type) {
  return PROMOTION_TYPES.find((option) => option.value === type)?.label || type;
}

function discountValue(item) {
  if (item.discountType === "PERCENTAGE") return `${Number(item.percentageValue || 0)}%`;
  if (item.discountType === "FIXED") return fmtCurrency(item.fixedAmount);
  return "Free Shipping";
}

function periodText(item) {
  return (
    <div className="text-xs text-muted-foreground">
      <div>{item.startDate ? formatDateTime(item.startDate) : "No start"}</div>
      <div className="mt-1">{item.endDate ? formatDateTime(item.endDate) : "No end"}</div>
    </div>
  );
}

function normalizeDateForInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function normalizeArrayText(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function buildEmptyPromotion(promotionType = "VOUCHER") {
  return {
    code: "",
    title: "",
    description: "",
    promotionType,
    discountType: promotionType === "FREE_SHIPPING" ? "FREE_SHIPPING" : "PERCENTAGE",
    percentageValue: 10,
    fixedAmount: 0,
    minimumPurchase: 0,
    maximumDiscount: 0,
    maximumShippingSubsidy: 0,
    quota: 0,
    usageLimitPerCustomer: promotionType === "VOUCHER" ? 1 : 0,
    targetScope: "ENTIRE_STORE",
    targetProductIds: "",
    targetCategories: "",
    courierRestrictions: "",
    status: "ACTIVE",
    startDate: "",
    endDate: "",
  };
}

function PromotionFormDialog({ open, onOpenChange, initial, promotionType, onSave, loading = false }) {
  const [form, setForm] = useState(buildEmptyPromotion(promotionType));
  const isVoucher = form.promotionType === "VOUCHER";
  const isDiscount = form.promotionType === "AUTOMATIC_DISCOUNT";
  const isFreeShipping = form.promotionType === "FREE_SHIPPING";

  useEffect(() => {
    const nextType = initial?.promotionType || promotionType;
    setForm(initial ? {
      ...buildEmptyPromotion(nextType),
      ...initial,
      targetProductIds: normalizeArrayText(initial.targetProductIds),
      targetCategories: normalizeArrayText(initial.targetCategories),
      courierRestrictions: normalizeArrayText(initial.courierRestrictions),
      startDate: normalizeDateForInput(initial.startDate),
      endDate: normalizeDateForInput(initial.endDate),
    } : buildEmptyPromotion(nextType));
  }, [initial, open, promotionType]);

  const update = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (key === "promotionType" && value === "FREE_SHIPPING") next.discountType = "FREE_SHIPPING";
    if (key === "promotionType" && value === "AUTOMATIC_DISCOUNT" && next.discountType === "FREE_SHIPPING") next.discountType = "PERCENTAGE";
    return next;
  });

  const handleSubmit = async () => {
    if (isVoucher && !form.code.trim()) {
      toast.error("Voucher Code is required.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Internal Name is required.");
      return;
    }
    if (form.discountType === "PERCENTAGE") {
      const percentage = Number(form.percentageValue || 0);
      if (percentage < 1 || percentage > 100) {
        toast.error("Percentage must be between 1 and 100.");
        return;
      }
    }

    await onSave({
      ...form,
      code: isVoucher ? form.code.trim().toUpperCase() : form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim(),
      promotionType: form.promotionType,
      discountType: isFreeShipping ? "FREE_SHIPPING" : form.discountType,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      percentageValue: Number(form.percentageValue || 0),
      fixedAmount: Number(form.fixedAmount || 0),
      minimumPurchase: Number(form.minimumPurchase || 0),
      maximumDiscount: Number(form.maximumDiscount || 0),
      maximumShippingSubsidy: Number(form.maximumShippingSubsidy || 0),
      quota: Number(form.quota || 0),
      usageLimitPerCustomer: Number(form.usageLimitPerCustomer || 0),
      targetProductIds: String(form.targetProductIds || "").split(",").map((entry) => entry.trim()).filter(Boolean),
      targetCategories: String(form.targetCategories || "").split(",").map((entry) => entry.trim()).filter(Boolean),
      courierRestrictions: String(form.courierRestrictions || "").split(",").map((entry) => entry.trim()).filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Promotion" : `New ${promotionTypeLabel(form.promotionType)}`}</DialogTitle>
          <DialogDescription>Manage vouchers, automatic discounts, and free shipping in one Promotions module.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Promotion Type</Label>
            <Select value={form.promotionType} onValueChange={(value) => update("promotionType", value)} disabled={Boolean(initial?.id)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROMOTION_TYPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {isVoucher ? (
            <div className="space-y-1.5">
              <Label>Voucher Code</Label>
              <Input value={form.code} onChange={(event) => update("code", event.target.value)} placeholder="WELCOME10" />
            </div>
          ) : null}

          <div className={isVoucher ? "space-y-1.5" : "md:col-span-2 space-y-1.5"}>
            <Label>{isFreeShipping ? "Name" : "Internal Name"}</Label>
            <Input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder={isFreeShipping ? "Free Shipping Rp200k" : "Ramadhan 25"} />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} />
          </div>

          {!isFreeShipping ? (
            <div className="space-y-1.5">
              <Label>Discount Type</Label>
              <Select value={form.discountType} onValueChange={(value) => update("discountType", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(isDiscount ? DISCOUNT_ONLY_TYPES : DISCOUNT_TYPES).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : null}

          {form.discountType === "PERCENTAGE" && !isFreeShipping ? (
            <div className="space-y-1.5">
              <Label>Percentage</Label>
              <Input type="number" min="1" max="100" value={form.percentageValue} onChange={(event) => update("percentageValue", event.target.value)} />
            </div>
          ) : null}

          {form.discountType === "FIXED" && !isFreeShipping ? (
            <div className="space-y-1.5">
              <Label>Fixed Amount</Label>
              <Input type="number" min="0" value={form.fixedAmount} onChange={(event) => update("fixedAmount", event.target.value)} />
            </div>
          ) : null}

          {isDiscount ? (
            <>
              <div className="space-y-1.5">
                <Label>Apply To</Label>
                <Select value={form.targetScope} onValueChange={(value) => update("targetScope", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TARGET_SCOPES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.targetScope === "SPECIFIC_PRODUCT" || form.targetScope === "SELECTED_PRODUCTS" ? (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>{form.targetScope === "SPECIFIC_PRODUCT" ? "Specific Product ID" : "Selected Product IDs"}</Label>
                  <Input value={form.targetProductIds} onChange={(event) => update("targetProductIds", event.target.value)} placeholder="product-id-1, product-id-2" />
                </div>
              ) : null}
              {form.targetScope === "SPECIFIC_CATEGORY" ? (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Specific Category</Label>
                  <Input value={form.targetCategories} onChange={(event) => update("targetCategories", event.target.value)} placeholder="Leggings" />
                </div>
              ) : null}
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label>Minimum Purchase</Label>
            <Input type="number" min="0" value={form.minimumPurchase} onChange={(event) => update("minimumPurchase", event.target.value)} />
          </div>

          {form.discountType === "PERCENTAGE" && !isFreeShipping ? (
            <div className="space-y-1.5">
              <Label>Maximum Discount</Label>
              <Input type="number" min="0" value={form.maximumDiscount} onChange={(event) => update("maximumDiscount", event.target.value)} />
            </div>
          ) : null}

          {isFreeShipping || form.discountType === "FREE_SHIPPING" ? (
            <>
              <div className="space-y-1.5">
                <Label>Maximum Shipping Covered</Label>
                <Input type="number" min="0" value={form.maximumShippingSubsidy} onChange={(event) => update("maximumShippingSubsidy", event.target.value)} placeholder="0 = full shipping" />
              </div>
              <div className="space-y-1.5">
                <Label>Courier Restriction (optional)</Label>
                <Input value={form.courierRestrictions} onChange={(event) => update("courierRestrictions", event.target.value)} placeholder="jne, sicepat" />
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label>Quota</Label>
            <Input type="number" min="0" value={form.quota} onChange={(event) => update("quota", event.target.value)} placeholder="0 = unlimited" />
          </div>

          {isVoucher ? (
            <div className="space-y-1.5">
              <Label>Usage Limit Per Customer</Label>
              <Input type="number" min="0" value={form.usageLimitPerCustomer} onChange={(event) => update("usageLimitPerCustomer", event.target.value)} placeholder="1" />
            </div>
          ) : null}

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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? "Saving…" : initial?.id ? "Save Changes" : "Create Promotion"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionButtons({ item, onEdit, onDuplicate, onDeactivate, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1 flex-wrap">
      <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>Edit</Button>
      <Button variant="ghost" size="sm" onClick={() => onDuplicate(item.id)}><Copy className="h-3.5 w-3.5 mr-1" />Duplicate</Button>
      {item.status === "ACTIVE" ? <Button variant="ghost" size="sm" onClick={() => onDeactivate(item.id)}>Deactivate</Button> : null}
      <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-600" onClick={() => onDelete(item.id)}>Delete</Button>
    </div>
  );
}

function PromotionTable({ type, items, loading, onEdit, onDuplicate, onDeactivate, onDelete }) {
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Loading promotions…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="p-12 text-center">
        <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No promotions found</p>
      </div>
    );
  }

  if (type === "VOUCHER") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[rgba(17,24,39,0.04)]">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Code</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Name</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Discount Type</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Value</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Minimum Purchase</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Quota</th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Used</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Period</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>{items.map((item, index) => (
            <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code}</td>
              <td className="px-4 py-3"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground mt-1">{item.description || "—"}</p></td>
              <td className="px-4 py-3">{item.discountType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 font-medium">{discountValue(item)}</td>
              <td className="px-4 py-3 text-right">{fmtCurrency(item.minimumPurchase)}</td>
              <td className="px-4 py-3 text-right">{Number(item.quota || 0) > 0 ? Number(item.quota).toLocaleString() : "∞"}</td>
              <td className="px-4 py-3 text-right font-medium">{Number(item.usedCount || 0).toLocaleString()}</td>
              <td className="px-4 py-3">{statusBadge(item.status)}</td>
              <td className="px-4 py-3">{periodText(item)}</td>
              <td className="px-4 py-3 text-right"><ActionButtons item={item} onEdit={onEdit} onDuplicate={onDuplicate} onDeactivate={onDeactivate} onDelete={onDelete} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  if (type === "AUTOMATIC_DISCOUNT") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[rgba(17,24,39,0.04)]">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Name</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Scope</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Value</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Period</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>{items.map((item, index) => (
            <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
              <td className="px-4 py-3"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground mt-1">{item.description || "—"}</p></td>
              <td className="px-4 py-3">{String(item.targetScope || "ENTIRE_STORE").replace(/_/g, " ")}</td>
              <td className="px-4 py-3 font-medium">{discountValue(item)}</td>
              <td className="px-4 py-3">{statusBadge(item.status)}</td>
              <td className="px-4 py-3">{periodText(item)}</td>
              <td className="px-4 py-3 text-right"><ActionButtons item={item} onEdit={onEdit} onDuplicate={onDuplicate} onDeactivate={onDeactivate} onDelete={onDelete} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[rgba(17,24,39,0.04)]">
          <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Name</th>
          <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Minimum Purchase</th>
          <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Maximum Shipping Subsidy</th>
          <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
          <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Period</th>
          <th className="px-4 py-3"></th>
        </tr></thead>
        <tbody>{items.map((item, index) => (
          <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
            <td className="px-4 py-3"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground mt-1">{item.description || "—"}</p></td>
            <td className="px-4 py-3 text-right">{fmtCurrency(item.minimumPurchase)}</td>
            <td className="px-4 py-3 text-right">{Number(item.maximumShippingSubsidy || 0) > 0 ? fmtCurrency(item.maximumShippingSubsidy) : "Full shipping"}</td>
            <td className="px-4 py-3">{statusBadge(item.status)}</td>
            <td className="px-4 py-3">{periodText(item)}</td>
            <td className="px-4 py-3 text-right"><ActionButtons item={item} onEdit={onEdit} onDuplicate={onDuplicate} onDeactivate={onDeactivate} onDelete={onDelete} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function PromotionsModule() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("voucher");
  const [sortValue, setSortValue] = useState("updatedAt:desc");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const promotionType = TYPE_BY_TAB[activeTab] || "VOUCHER";
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
  }, [search, status, activeTab, sortValue]);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = async (id) => {
    const result = await promotionApi.getById(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setEditing(result);
    setActiveTab(TAB_BY_TYPE[result.promotionType] || activeTab);
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
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Manage vouchers, automatic discounts, and free shipping promotions.</p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <TicketPercent className="h-4 w-4" /> New Promotion
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Current Tab</p><p className="text-3xl font-semibold mt-1">{Number(pagination.totalItems || 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider text-emerald-500">Active Page</p><p className="text-3xl font-semibold mt-1 text-emerald-500">{items.filter((item) => item.status === "ACTIVE").length}</p></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><p className="text-xs text-muted-foreground uppercase tracking-wider text-cyan-700">Type</p><p className="text-3xl font-semibold mt-1 text-cyan-700">{promotionTypeLabel(promotionType)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            <div className="lg:col-span-2">
              <Label>Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or name…" />
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
              <Label>Sort</Label>
              <Select value={sortValue} onValueChange={setSortValue}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt:desc">Newest Updated</SelectItem>
                  <SelectItem value="updatedAt:asc">Oldest Updated</SelectItem>
                  <SelectItem value="title:asc">Name A-Z</SelectItem>
                  <SelectItem value="code:asc">Code A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="voucher">Voucher</TabsTrigger>
          <TabsTrigger value="discount">Discount</TabsTrigger>
          <TabsTrigger value="freeshipping">Free Shipping</TabsTrigger>
        </TabsList>
        {Object.entries(TYPE_BY_TAB).map(([tab, type]) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">
                <PromotionTable
                  type={type}
                  items={items}
                  loading={loading}
                  onEdit={openEdit}
                  onDuplicate={duplicatePromotion}
                  onDeactivate={deactivatePromotion}
                  onDelete={deletePromotion}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

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
        promotionType={promotionType}
        onSave={savePromotion}
        loading={saving}
      />
    </div>
  );
}
