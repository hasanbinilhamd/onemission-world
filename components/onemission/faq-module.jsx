"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit3, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
];

const EMPTY_FORM = {
  question: "",
  answer: "",
  category: "",
  sortOrder: 0,
  isPublished: false,
};

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

function publishedBadge(isPublished) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${isPublished ? "bg-emerald-500/10 text-emerald-700" : "bg-slate-500/10 text-slate-600"}`}>
      {isPublished ? "Published" : "Unpublished"}
    </span>
  );
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "FAQ request failed.");
  }
  return payload;
}

const faqApi = {
  async list({ page, limit, search, category, status }) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
      category,
      status,
    });
    const response = await fetch(`/api/admin/faqs?${params.toString()}`);
    return readResponse(response);
  },
  async create(payload) {
    const response = await fetch("/api/admin/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readResponse(response);
  },
  async update(id, payload) {
    const response = await fetch(`/api/admin/faqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readResponse(response);
  },
  async delete(id) {
    const response = await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
    return readResponse(response);
  },
};

function FaqFormDialog({ open, onOpenChange, item, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(item?.id);

  useEffect(() => {
    if (!open) return;
    setForm(item ? {
      question: item.question || "",
      answer: item.answer || "",
      category: item.category || "",
      sortOrder: Number(item.sortOrder || 0),
      isPublished: Boolean(item.isPublished),
    } : EMPTY_FORM);
  }, [item, open]);

  const submit = async () => {
    if (!form.question.trim()) {
      toast.error("Question is required.");
      return;
    }
    if (!form.answer.trim()) {
      toast.error("Answer is required.");
      return;
    }
    const sortOrder = Number(form.sortOrder || 0);
    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      toast.error("Sort Order must be valid.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: form.category.trim(),
        sortOrder,
        isPublished: Boolean(form.isPublished),
      };
      const response = editing ? await faqApi.update(item.id, payload) : await faqApi.create(payload);
      toast.success(editing ? "FAQ updated." : "FAQ created.");
      onSaved?.(response);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "FAQ could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit FAQ" : "Create FAQ"}</DialogTitle>
          <DialogDescription>Manage frequently asked questions shown on Ecommerce when published.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="faq-question">Question</Label>
            <Input id="faq-question" value={form.question} onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))} placeholder="How do I place an order?" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq-answer">Answer</Label>
            <Textarea id="faq-answer" value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} rows={6} placeholder="Write a clear plain-text answer..." />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="faq-category">Category</Label>
              <Input id="faq-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Shipping" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-sort-order">Sort Order</Label>
              <Input id="faq-sort-order" type="number" min="0" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm md:self-end">
              <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))} />
              Published
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save FAQ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteFaqDialog({ open, onOpenChange, item, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  if (!item) return null;

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await faqApi.delete(item.id);
      toast.success("FAQ deleted.");
      onDeleted?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "FAQ could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete FAQ?</DialogTitle>
          <DialogDescription>Are you sure you want to delete this FAQ? This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm font-medium">{item.question}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete FAQ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FaqModule() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await faqApi.list({ page, limit, search, category, status });
      setItems(Array.isArray(response.data) ? response.data : []);
      setCategories(Array.isArray(response.categories) ? response.categories : []);
      setPagination(response.pagination || { page: 1, limit, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "FAQ list could not be loaded.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, limit, page, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [category, search, status]);

  const categoryOptions = useMemo(() => ["all", ...categories], [categories]);

  const openCreate = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const openDelete = (item) => {
    setDeletingItem(item);
    setShowDelete(true);
  };

  const togglePublished = async (item) => {
    try {
      await faqApi.update(item.id, { isPublished: !item.isPublished });
      toast.success(item.isPublished ? "FAQ unpublished." : "FAQ published.");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish status could not be updated.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">FAQ Management</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Create, publish, and organize frequently asked questions for Ecommerce.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => void load()} title="Refresh FAQ"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Create FAQ</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 gap-4 items-end lg:grid-cols-5">
            <div className="lg:col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Search question / answer</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search FAQ…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Category</p>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => <SelectItem key={option} value={option}>{option === "all" ? "All Categories" : option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading FAQ…</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No FAQ found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Question</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Published</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sort Order</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Updated At</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${index % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 min-w-[280px]">
                        <p className="font-medium text-foreground">{item.question}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground whitespace-pre-line">{item.answer}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.category || "—"}</td>
                      <td className="px-4 py-3">{publishedBadge(item.isPublished)}</td>
                      <td className="px-4 py-3 text-right font-medium">{item.sortOrder}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(item.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => togglePublished(item)}>{item.isPublished ? "Unpublish" : "Publish"}</Button>
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(item)}><Edit3 className="h-3.5 w-3.5" /> Edit</Button>
                          <Button variant="outline" size="sm" className="gap-1 text-red-700" onClick={() => openDelete(item)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
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

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Showing page {pagination.page} of {pagination.totalPages} — {pagination.totalItems} total FAQ</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <FaqFormDialog open={showForm} onOpenChange={setShowForm} item={editingItem} onSaved={() => void load()} />
      <DeleteFaqDialog open={showDelete} onOpenChange={setShowDelete} item={deletingItem} onDeleted={() => void load()} />
    </div>
  );
}
