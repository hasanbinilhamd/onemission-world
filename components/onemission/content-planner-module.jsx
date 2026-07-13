"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTENT_SCRIPT_ALLOWED_MIME_TYPES,
  CONTENT_SCRIPT_CATEGORY_OPTIONS,
  CONTENT_SCRIPT_MAX_FILE_SIZE_BYTES,
} from "@/lib/content-script/constants";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_OPTIONS = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];
const SUMMARY_FALLBACK = {
  totalFiles: 0,
  scheduledThisWeek: 0,
  storyCount: 0,
  educationCount: 0,
  productCount: 0,
  communityCount: 0,
  proofenCount: 0,
};

function apiPath(path) {
  return `/api/${path}`;
}

async function apiRequest(path, init = {}) {
  const response = await fetch(apiPath(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed.");
  }

  return payload;
}

function toDateString(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthTitle(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDateLabel(dateString) {
  if (!dateString) return "—";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildCalendarDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstWeekday);
  const today = toDateString(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + index);
    const dateString = toDateString(currentDate);

    return {
      date: currentDate,
      dateString,
      dayNumber: currentDate.getDate(),
      isCurrentMonth: currentDate.getMonth() === monthDate.getMonth(),
      isToday: dateString === today,
    };
  });
}

function shiftMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function buildYearOptions(baseYear) {
  return Array.from({ length: 9 }, (_, index) => baseYear - 4 + index);
}

function buildSummaryFromItems(items = []) {
  return items.reduce((summary, item) => {
    const category = String(item?.category || "").trim();
    summary.totalFiles += 1;

    if (category === "Story") summary.storyCount += 1;
    if (category === "Education") summary.educationCount += 1;
    if (category === "Product") summary.productCount += 1;
    if (category === "Community") summary.communityCount += 1;
    if (category === "Proofen") summary.proofenCount += 1;

    return summary;
  }, {
    totalFiles: 0,
    storyCount: 0,
    educationCount: 0,
    productCount: 0,
    communityCount: 0,
    proofenCount: 0,
  });
}

function createEmptyCreateForm(calendarDate = "") {
  return {
    title: "",
    category: CONTENT_SCRIPT_CATEGORY_OPTIONS[0],
    calendarDate,
    pdfFile: null,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read PDF file."));
    reader.readAsDataURL(file);
  });
}

async function normalizeSelectedPdfFile(file) {
  if (!file) {
    throw new Error("PDF file is required.");
  }

  if (!CONTENT_SCRIPT_ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Only PDF files are allowed.");
  }

  if (file.size > CONTENT_SCRIPT_MAX_FILE_SIZE_BYTES) {
    throw new Error("PDF file size must be 20 MB or less.");
  }

  return {
    originalFilename: file.name,
    mimeType: file.type,
    size: file.size,
    dataUrl: await readFileAsDataUrl(file),
  };
}

function getCurrentUserLabel() {
  if (typeof window === "undefined") return "";

  try {
    const rawUser = window.localStorage.getItem("om_user");
    if (!rawUser) return "";
    const parsedUser = JSON.parse(rawUser);
    return parsedUser?.name || parsedUser?.email || parsedUser?.id || "";
  } catch {
    return "";
  }
}

function DayListModal({
  open,
  onOpenChange,
  dateString,
  items,
  onOpenDetail,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Content Files</DialogTitle>
          <DialogDescription>{formatDateLabel(dateString)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No PDF files scheduled on this date.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenDetail(item.id)}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-left hover:bg-[#F7F8FA] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-semibold">PDF</Badge>
                      <p className="truncate text-sm font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.pdfFilename}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{item.category}</Badge>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateContentModal({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSelectPdf,
  onSave,
  saving,
}) {
  const canSave = Boolean(form.title.trim() && form.category && form.calendarDate && form.pdfFile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Content Script</DialogTitle>
          <DialogDescription>{formatDateLabel(form.calendarDate)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input value={form.calendarDate} readOnly className="h-10 bg-[#F7F8FA]" />
          </div>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              className="h-10"
              value={form.title}
              onChange={(event) => onFormChange({ ...form, title: event.target.value })}
              placeholder="Running campaign script"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(value) => onFormChange({ ...form, category: value })}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_SCRIPT_CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Upload PDF *</Label>
            <Input
              className="h-10"
              type="file"
              accept="application/pdf"
              onChange={(event) => onSelectPdf(event.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">
              Only PDF files are allowed. Maximum size: 20 MB.
            </p>
            {form.pdfFile ? (
              <div className="rounded-xl border border-border bg-[#F7F8FA] px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-rose-500" />
                  <span className="truncate font-medium">{form.pdfFile.originalFilename}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(Number(form.pdfFile.size || 0) / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save Content"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContentDetailModal({
  open,
  onOpenChange,
  item,
  loading,
  replacing,
  deleting,
  onReplacePdf,
  onDelete,
}) {
  const isBusy = replacing || deleting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Content File Detail</DialogTitle>
          <DialogDescription>
            Review the uploaded PDF script or content brief.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading content file…
          </div>
        ) : item ? (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-[#F7F8FA] px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Title</p>
                <p className="mt-1 text-sm font-medium">{item.title}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#F7F8FA] px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Date</p>
                <p className="mt-1 text-sm font-medium">{formatDateLabel(item.calendarDate)}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#F7F8FA] px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Category</p>
                <p className="mt-1 text-sm font-medium">{item.category}</p>
              </div>
              <div className="rounded-xl border border-border bg-[#F7F8FA] px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">PDF File Name</p>
                <p className="mt-1 text-sm font-medium break-all">{item.pdfFilename}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 bg-[#F7F8FA]">
                <div>
                  <p className="text-sm font-semibold">Preview</p>
                  <p className="text-xs text-muted-foreground">Inline PDF preview</p>
                </div>
                <a
                  href={item.pdfUrl}
                  download={item.pdfFilename}
                  className="inline-flex items-center gap-2 rounded-md bg-[#111827] px-3 py-2 text-xs font-medium text-white hover:bg-[#1F2937]"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>
              <div className="p-3">
                <object data={item.pdfUrl} type="application/pdf" className="h-[60vh] w-full rounded-xl border border-border">
                  <div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground px-6">
                    <FileText className="h-8 w-8 text-rose-500" />
                    <p>Preview is not available in this browser.</p>
                    <a href={item.pdfUrl} download={item.pdfFilename} className="text-blue-600 hover:underline">
                      Download PDF
                    </a>
                  </div>
                </object>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end rounded-2xl border border-border bg-white px-4 py-4">
              <div className="space-y-1.5">
                <Label>Replace PDF</Label>
                <Input
                  className="h-10"
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => onReplacePdf(event.target.files?.[0] || null, () => {
                    event.target.value = "";
                  })}
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground">Only PDF files are allowed. Maximum size: 20 MB.</p>
              </div>
              <Button variant="destructive" onClick={onDelete} disabled={isBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
            Content file detail is not available.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ContentPlannerModule({ activeModule }) {
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [scheduledThisMonthCount, setScheduledThisMonthCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(createEmptyCreateForm());
  const [saving, setSaving] = useState(false);

  const [dayListOpen, setDayListOpen] = useState(false);
  const [dayListDate, setDayListDate] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const month = String(monthDate.getMonth() + 1).padStart(2, "0");
  const year = String(monthDate.getFullYear());
  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const yearOptions = useMemo(() => buildYearOptions(monthDate.getFullYear()), [monthDate]);
  const itemsByDate = useMemo(() => {
    return items.reduce((map, item) => {
      const dateKey = String(item.calendarDate || "").trim();
      if (!dateKey) return map;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(item);
      return map;
    }, {});
  }, [items]);
  const selectedDayItems = useMemo(() => itemsByDate[dayListDate] || [], [dayListDate, itemsByDate]);
  const contentSummary = useMemo(() => ({
    ...SUMMARY_FALLBACK,
    ...buildSummaryFromItems(items),
  }), [items]);
  const calendarViewKey = `${year}-${month}-${categoryFilter}-${search.trim()}-${items.length}-${loading ? "loading" : "ready"}`;

  const load = async () => {
    setLoading(true);
    try {
      const filteredParams = new URLSearchParams({ month, year });
      if (categoryFilter !== "all") filteredParams.set("category", categoryFilter);
      if (search.trim()) filteredParams.set("search", search.trim());

      const monthParams = new URLSearchParams({ month, year });

      const [filteredResult, monthResult] = await Promise.all([
        apiRequest(`content?${filteredParams.toString()}`),
        apiRequest(`content?${monthParams.toString()}`),
      ]);

      const nextItems = Array.isArray(filteredResult?.data) ? filteredResult.data : [];
      setItems(nextItems);
      setScheduledThisMonthCount(Array.isArray(monthResult?.data) ? monthResult.data.length : 0);
    } catch (error) {
      toast.error(error.message || "Failed to load content script calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeModule !== "content") return;
    void load();
  }, [activeModule, month, year, categoryFilter, search]);

  const openCreateModal = (calendarDate) => {
    setCreateForm(createEmptyCreateForm(calendarDate));
    setCreateOpen(true);
  };

  const handleSelectCreatePdf = async (file) => {
    if (!file) {
      setCreateForm((currentForm) => ({ ...currentForm, pdfFile: null }));
      return;
    }

    try {
      const normalizedPdfFile = await normalizeSelectedPdfFile(file);
      setCreateForm((currentForm) => ({
        ...currentForm,
        pdfFile: normalizedPdfFile,
      }));
      toast.success("PDF file selected.");
    } catch (error) {
      toast.error(error.message || "Failed to load PDF file.");
    }
  };

  const saveContent = async () => {
    if (!createForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }

    if (!createForm.category) {
      toast.error("Category is required.");
      return;
    }

    if (!createForm.pdfFile) {
      toast.error("PDF file is required.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("content", {
        method: "POST",
        body: JSON.stringify({
          title: createForm.title.trim(),
          category: createForm.category,
          calendarDate: createForm.calendarDate,
          createdBy: getCurrentUserLabel(),
          pdfFile: createForm.pdfFile,
        }),
      });
      toast.success("Content file saved.");
      setCreateOpen(false);
      setCreateForm(createEmptyCreateForm());
      await load();
    } catch (error) {
      toast.error(error.message || "Failed to save content file.");
    } finally {
      setSaving(false);
    }
  };

  const openDayListModal = (calendarDate) => {
    setDayListDate(calendarDate);
    setDayListOpen(true);
  };

  const openDetailModal = async (itemId) => {
    setDayListOpen(false);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailItem(null);
    try {
      const result = await apiRequest(`content/${itemId}`);
      setDetailItem(result);
    } catch (error) {
      toast.error(error.message || "Failed to load content detail.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const replacePdf = async (file, clearInput) => {
    if (!file || !detailItem?.id) {
      clearInput?.();
      return;
    }

    try {
      setReplacing(true);
      const normalizedPdfFile = await normalizeSelectedPdfFile(file);
      const result = await apiRequest(`content/${detailItem.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: detailItem.title,
          category: detailItem.category,
          calendarDate: detailItem.calendarDate,
          createdBy: detailItem.createdBy || getCurrentUserLabel(),
          pdfFile: normalizedPdfFile,
        }),
      });
      setDetailItem((currentItem) => currentItem ? {
        ...currentItem,
        ...result,
        pdfUrl: normalizedPdfFile.dataUrl,
      } : currentItem);
      toast.success("PDF file replaced.");
      await load();
    } catch (error) {
      toast.error(error.message || "Failed to replace PDF file.");
    } finally {
      clearInput?.();
      setReplacing(false);
    }
  };

  const deleteItem = async () => {
    if (!detailItem?.id) return;
    if (!window.confirm("Delete this content file?")) return;

    try {
      setDeleting(true);
      await apiRequest(`content/${detailItem.id}`, { method: "DELETE" });
      toast.success("Content file deleted.");
      setDetailOpen(false);
      setDetailItem(null);
      await load();
    } catch (error) {
      toast.error(error.message || "Failed to delete content file.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Content Script Calendar
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Google Calendar style month view for scheduling PDF scripts and content briefs.
          </p>
        </div>
      </div>

      <motion.div
        key={`${calendarViewKey}-summary`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Scripts</p>
            <p className="mt-1 text-2xl font-semibold">{Number(contentSummary.totalFiles || 0).toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">Matching current filters</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Scheduled This Month</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{Number(scheduledThisMonthCount || 0).toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatMonthTitle(monthDate)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Story</p>
            <p className="mt-1 text-2xl font-semibold text-fuchsia-600">{Number(contentSummary.storyCount || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Education</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{Number(contentSummary.educationCount || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Product</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{Number(contentSummary.productCount || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Community + Proofen</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Community</span>
                <span className="font-semibold text-amber-600">{Number(contentSummary.communityCount || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Proofen</span>
                <span className="font-semibold text-violet-600">{Number(contentSummary.proofenCount || 0).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="icon" onClick={() => setMonthDate((currentDate) => shiftMonth(currentDate, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-[220px] text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Month View</p>
                  <p className="text-xl font-semibold mt-1">{formatMonthTitle(monthDate)}</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => setMonthDate((currentDate) => shiftMonth(currentDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
                  Current Month
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                7-column calendar layout with PDF script files by date.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,8fr)_minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] lg:items-end">
              <div className="space-y-1.5">
                <Label>Search Title</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-10 pl-9"
                    placeholder="Search content title..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CONTENT_SCRIPT_CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select
                  value={String(monthDate.getMonth())}
                  onValueChange={(value) => setMonthDate(new Date(monthDate.getFullYear(), Number(value), 1))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((entry) => (
                      <SelectItem key={entry.value} value={String(entry.value)}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select
                  value={String(monthDate.getFullYear())}
                  onValueChange={(value) => setMonthDate(new Date(Number(value), monthDate.getMonth(), 1))}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((entry) => (
                      <SelectItem key={entry} value={String(entry)}>
                        {entry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        <motion.div
          key={calendarViewKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-4"
        >
          {loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              {Array.from({ length: 14 }).map((_, index) => (
                <Card key={index} className="h-[156px] animate-pulse border-border/50 bg-muted/30 md:h-[170px] xl:h-[190px]" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[760px] overflow-hidden rounded-2xl border border-border/80 bg-border shadow-sm">
                <div className="grid grid-cols-7 gap-px bg-border">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="bg-[#F7F8FA] px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:px-4">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-border">
                  {calendarDays.map((day) => {
                    const dayItems = itemsByDate[day.dateString] || [];
                    return (
                      <motion.div
                        layout
                        key={day.dateString}
                        className={[
                          "group flex h-[156px] flex-col bg-white px-3 py-3 transition-colors hover:bg-[#FAFBFD] md:h-[170px] xl:h-[190px]",
                          !day.isCurrentMonth ? "bg-[#F7F8FA]/70 text-muted-foreground" : "",
                          day.isToday ? "bg-blue-50/70" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`text-sm font-semibold ${day.isToday ? "text-blue-700" : "text-foreground"}`}>
                              {day.dayNumber}
                            </span>
                            {day.isToday ? (
                              <div className="mt-1">
                                <Badge variant="outline" className="border-blue-300 bg-white/80 text-[10px] text-blue-700">
                                  Today
                                </Badge>
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => openCreateModal(day.dateString)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-white text-muted-foreground shadow-sm transition-opacity hover:bg-[#F7F8FA] hover:text-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            title="Add content file"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 flex-1 space-y-1.5 overflow-hidden">
                          <AnimatePresence initial={false}>
                            {dayItems.slice(0, 3).map((item) => (
                              <motion.button
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.14, ease: "easeOut" }}
                                key={item.id}
                                type="button"
                                onClick={() => openDetailModal(item.id)}
                                className="w-full rounded-lg border border-blue-100 bg-[#EEF3FA] px-2.5 py-2 text-left hover:bg-[#E6EEF9] transition-colors"
                                title={`${item.category} — ${item.title}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="shrink-0 border-blue-200 bg-white text-[10px] font-semibold text-blue-700">
                                    📄 {item.category}
                                  </Badge>
                                </div>
                                <p className="mt-1 truncate text-[11px] font-medium text-[#111827]">{item.title}</p>
                              </motion.button>
                            ))}
                          </AnimatePresence>
                          {dayItems.length > 3 ? (
                            <button
                              type="button"
                              onClick={() => openDayListModal(day.dateString)}
                              className="pl-1 text-left text-xs font-medium text-blue-600 hover:underline"
                            >
                              +{dayItems.length - 3} more
                            </button>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <CreateContentModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={createForm}
        onFormChange={setCreateForm}
        onSelectPdf={handleSelectCreatePdf}
        onSave={saveContent}
        saving={saving}
      />

      <DayListModal
        open={dayListOpen}
        onOpenChange={setDayListOpen}
        dateString={dayListDate}
        items={selectedDayItems}
        onOpenDetail={openDetailModal}
      />

      <ContentDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={detailItem}
        loading={detailLoading}
        replacing={replacing}
        deleting={deleting}
        onReplacePdf={replacePdf}
        onDelete={deleteItem}
      />
    </div>
  );
}
