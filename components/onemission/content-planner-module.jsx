"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Edit3,
  ExternalLink,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  MessageSquare,
  Paperclip,
  Plus,
  Quote,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_OPTIONS = [
  "Draft",
  "Idea",
  "Writing Script",
  "Ready To Shoot",
  "Editing",
  "Ready",
  "Published",
  "Cancelled",
];

const PLATFORM_OPTIONS = [
  "Instagram",
  "TikTok",
  "Youtube",
  "Facebook",
  "Threads",
  "Website",
];

const CATEGORY_OPTIONS = [
  "Product",
  "Education",
  "Promotion",
  "Branding",
  "Event",
  "Announcement",
  "Campaign",
];

const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

const DEFAULT_CHECKLIST_ITEMS = [
  "Research",
  "Idea Approved",
  "Script",
  "Voice Over",
  "Shooting",
  "Editing",
  "Subtitle",
  "Thumbnail",
  "Upload",
  "Publish",
];

const STATUS_BADGE_CLASS = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Idea: "bg-violet-100 text-violet-700 border-violet-200",
  "Writing Script": "bg-blue-100 text-blue-700 border-blue-200",
  "Ready To Shoot": "bg-cyan-100 text-cyan-700 border-cyan-200",
  Editing: "bg-amber-100 text-amber-700 border-amber-200",
  Ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Published: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const PLATFORM_SHORT_LABEL = {
  Instagram: "IG",
  TikTok: "TT",
  Youtube: "YT",
  Facebook: "FB",
  Threads: "TH",
  Website: "WEB",
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

function formatMonthTitle(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDateLabel(dateString) {
  if (!dateString) return "Unscheduled";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateString(date) {
  return new Date(date).toISOString().split("T")[0];
}

function buildMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function shiftMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function buildCalendarDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(firstDay);
  startDate.setDate(firstDay.getDate() - firstWeekday);

  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + index);
    days.push({
      date: currentDate,
      dateString: toDateString(currentDate),
      isCurrentMonth: currentDate.getMonth() === monthDate.getMonth(),
      isToday: toDateString(currentDate) === toDateString(new Date()),
      isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6,
      dayNumber: currentDate.getDate(),
      isPastVisibleMonth: currentDate < firstDay,
      isAfterVisibleMonth: currentDate > lastDay,
    });
  }

  return days;
}

function createChecklistItems() {
  return DEFAULT_CHECKLIST_ITEMS.map((label, index) => ({
    id: `temp-check-${index}-${label}`,
    label,
    isCompleted: false,
    sortOrder: index,
  }));
}

function createEmptyPlannerForm(dateString = "") {
  return {
    id: "",
    title: "",
    platforms: [],
    category: "Product",
    priority: "Medium",
    status: "Draft",
    assignedUserId: "",
    assignedUserName: "",
    publishDate: dateString,
    publishTime: "09:00",
    reminderDate: "",
    contentBriefRichText: "",
    scriptRichText: "",
    captionRichText: "",
    ctaText: "",
    hashtags: [],
    notesRichText: "",
    checklists: createChecklistItems(),
    assets: [],
    comments: [],
  };
}

function RichTextEditor({ label, value, onChange, placeholder = "Start writing..." }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const runCommand = (command, commandValue = undefined) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  };

  const promptLink = () => {
    const url = window.prompt("Enter URL");
    if (url) {
      runCommand("createLink", url);
    }
  };

  const promptImage = () => {
    const url = window.prompt("Enter image URL");
    if (url) {
      runCommand("insertImage", url);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 border-b border-border/60 bg-[#F7F8FA] px-2 py-2">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => runCommand("formatBlock", "h2")}>
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => runCommand("bold")}>
            <Bold className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => runCommand("italic")}>
            <Italic className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => runCommand("insertUnorderedList")}>
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => runCommand("insertOrderedList")}>
            <ClipboardList className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => runCommand("formatBlock", "blockquote")}>
            <Quote className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={promptLink}>
            <Link2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={promptImage}>
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[160px] px-4 py-3 text-sm outline-none [&_h2]:text-lg [&_h2]:font-semibold [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5"
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          data-placeholder={placeholder}
          style={{ whiteSpace: "pre-wrap" }}
        />
      </div>
    </div>
  );
}

function MultiSelectToggle({ label, options, selectedValues, onToggle, renderValue = (value) => value }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selectedValues.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-blue-500 bg-blue-500/10 text-blue-600" : "border-border bg-white text-muted-foreground hover:bg-[#F7F8FA]"}`}
            >
              {renderValue(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HashtagInput({ values, onChange }) {
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const normalized = draft
      .split(",")
      .map((value) => value.trim().replace(/^#/, ""))
      .filter(Boolean);
    if (normalized.length === 0) return;
    const next = [...new Set([...values, ...normalized])];
    onChange(next);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <Label>Hashtags</Label>
      <div className="rounded-xl border border-border bg-white p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {values.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-600 px-3 py-1 text-xs font-medium">
              #{tag}
              <button type="button" onClick={() => onChange(values.filter((value) => value !== tag))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add hashtags separated by comma"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDraft();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addDraft}>Add</Button>
        </div>
      </div>
    </div>
  );
}

function ChecklistEditor({ items, onChange }) {
  const [draft, setDraft] = useState("");

  const addChecklistItem = () => {
    const label = draft.trim();
    if (!label) return;
    onChange([
      ...items,
      {
        id: `temp-check-${Date.now()}`,
        label,
        isCompleted: false,
        sortOrder: items.length,
      },
    ]);
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <Label>Production Checklist</Label>
      <div className="rounded-xl border border-border bg-white p-3 space-y-2">
        {items.map((item, index) => (
          <div key={item.id || `${item.label}-${index}`} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
            <button
              type="button"
              onClick={() => onChange(items.map((entry, entryIndex) => entryIndex === index ? { ...entry, isCompleted: !entry.isCompleted } : entry))}
            >
              {item.isCompleted ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </button>
            <Input
              value={item.label}
              onChange={(event) => onChange(items.map((entry, entryIndex) => entryIndex === index ? { ...entry, label: event.target.value } : entry))}
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))}>
              <Trash2 className="h-4 w-4 text-rose-400" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add checklist item" />
          <Button type="button" variant="outline" onClick={addChecklistItem}>Add</Button>
        </div>
      </div>
    </div>
  );
}

function inferAssetType(mimeType = "", name = "") {
  const normalizedMime = String(mimeType || "").toLowerCase();
  const normalizedName = String(name || "").toLowerCase();
  if (normalizedMime.startsWith("image/")) return "Image";
  if (normalizedMime === "application/pdf" || normalizedName.endsWith(".pdf")) return "PDF";
  if (normalizedMime.startsWith("video/")) return "Video";
  return "Asset";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function AssetsEditor({ items, onChange }) {
  const [linkType, setLinkType] = useState("Canva Link");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const addLinkAsset = () => {
    if (!linkUrl.trim()) {
      toast.error("Asset URL is required.");
      return;
    }
    onChange([
      ...items,
      {
        id: `temp-asset-${Date.now()}`,
        assetType: linkType,
        name: linkName.trim() || linkType,
        url: linkUrl.trim(),
        mimeType: "",
        sortOrder: items.length,
      },
    ]);
    setLinkName("");
    setLinkUrl("");
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const uploaded = await Promise.all(files.map(async (file, index) => ({
        id: `temp-file-${Date.now()}-${index}`,
        assetType: inferAssetType(file.type, file.name),
        name: file.name,
        url: await readFileAsDataUrl(file),
        mimeType: file.type,
        sortOrder: items.length + index,
      })));
      onChange([...items, ...uploaded]);
      event.target.value = "";
    } catch (error) {
      toast.error(error.message || "Failed to upload asset.");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>Assets</Label>
      <div className="rounded-xl border border-border bg-white p-3 space-y-3">
        <div className="flex flex-col gap-2">
          {items.map((asset, index) => (
            <div key={asset.id || `${asset.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {asset.assetType === "Image" ? <ImageIcon className="h-4 w-4 text-blue-500" /> : asset.assetType === "Video" ? <Video className="h-4 w-4 text-rose-500" /> : asset.assetType === "PDF" ? <FileText className="h-4 w-4 text-amber-500" /> : <Link2 className="h-4 w-4 text-emerald-500" />}
                  <p className="text-sm font-medium truncate">{asset.name || asset.assetType}</p>
                  <Badge variant="outline" className="text-[10px]">{asset.assetType}</Badge>
                </div>
                <a href={asset.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate inline-flex items-center gap-1 mt-1">
                  Open Asset <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(items.filter((_, assetIndex) => assetIndex !== index))}>
                <Trash2 className="h-4 w-4 text-rose-400" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Label className="text-xs text-muted-foreground">Upload Files</Label>
          <Input type="file" multiple accept="image/*,application/pdf,video/*" onChange={handleFileChange} className="max-w-sm" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-end pt-2 border-t border-border/50">
          <div className="space-y-1.5">
            <Label>Link Type</Label>
            <Select value={linkType} onValueChange={setLinkType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Canva Link">Canva Link</SelectItem>
                <SelectItem value="Google Drive URL">Google Drive URL</SelectItem>
                <SelectItem value="External URL">External URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={linkName} onChange={(event) => setLinkName(event.target.value)} placeholder="Asset name" />
          </div>
          <div className="space-y-1.5">
            <Label>URL</Label>
            <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://..." />
          </div>
          <Button type="button" variant="outline" onClick={addLinkAsset}>Add Link</Button>
        </div>
      </div>
    </div>
  );
}

export function ContentPlannerModule({ activeModule }) {
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({ totalPlanned: 0, published: 0, ready: 0, editing: 0, draft: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [assignedUserFilter, setAssignedUserFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createEmptyPlannerForm());
  const [selectedDate, setSelectedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  const monthKey = buildMonthKey(monthDate);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: monthKey });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (assignedUserFilter !== "all") params.set("assignedUserId", assignedUserFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      const result = await apiRequest(`content?${params.toString()}`);
      setItems(Array.isArray(result?.data) ? result.data : []);
      setUsers(Array.isArray(result?.users) ? result.users : []);
      setSummary(result?.summary || { totalPlanned: 0, published: 0, ready: 0, editing: 0, draft: 0 });
    } catch (error) {
      toast.error(error.message || "Failed to load content planner.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      const assigned = users.find((entry) => entry.id === form.assignedUserId);
      if (assigned && assigned.name !== form.assignedUserName) {
        setForm((current) => ({ ...current, assignedUserName: assigned.name }));
      }
    }
  }, [form.assignedUserId, form.assignedUserName, open, users]);

  useEffect(() => {
    if (!open) {
      setCommentDraft("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const planner = items.find((item) => item.id === form.id);
    if (!planner && form.id) {
      setForm((current) => ({ ...current, comments: [], assets: [], checklists: createChecklistItems() }));
    }
  }, [form.id, items, open]);

  useEffect(() => {
    if (!open && !saving) {
      setForm(createEmptyPlannerForm(selectedDate));
    }
  }, [open, saving, selectedDate]);

  useEffect(() => {
    if (open && !form.id && selectedDate && !form.publishDate) {
      setForm((current) => ({ ...current, publishDate: selectedDate }));
    }
  }, [form.id, form.publishDate, open, selectedDate]);

  useEffect(() => {
    if (open && !selectedDate && form.publishDate) {
      setSelectedDate(form.publishDate);
    }
  }, [form.publishDate, open, selectedDate]);

  useEffect(() => {
    if (activeModule !== "content") return;
    void load();
  }, [activeModule, monthKey, search, statusFilter, platformFilter, assignedUserFilter, categoryFilter, priorityFilter]);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);
  const itemsByDate = useMemo(() => items.reduce((map, item) => {
    const key = String(item.publishDate || "").trim();
    if (!key) return map;
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {}), [items]);

  const togglePlatform = (platform) => {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((entry) => entry !== platform)
        : [...current.platforms, platform],
    }));
  };

  const openCreateModal = (dateString = toDateString(new Date())) => {
    setSelectedDate(dateString);
    setForm(createEmptyPlannerForm(dateString));
    setOpen(true);
  };

  const openEditModal = async (plannerId) => {
    try {
      const result = await apiRequest(`content/${plannerId}`);
      setSelectedDate(result.publishDate || "");
      setForm({
        ...createEmptyPlannerForm(result.publishDate || ""),
        ...result,
        platforms: Array.isArray(result.platforms) ? result.platforms : [],
        hashtags: Array.isArray(result.hashtags) ? result.hashtags : [],
        checklists: Array.isArray(result.checklists) && result.checklists.length > 0 ? result.checklists : createChecklistItems(),
        assets: Array.isArray(result.assets) ? result.assets : [],
        comments: Array.isArray(result.comments) ? result.comments : [],
      });
      setOpen(true);
    } catch (error) {
      toast.error(error.message || "Failed to load content detail.");
    }
  };

  const savePlanner = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (form.platforms.length === 0) {
      toast.error("Select at least one platform.");
      return;
    }
    if (!form.publishDate) {
      toast.error("Publish date is required.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      platforms: form.platforms,
      category: form.category,
      priority: form.priority,
      status: form.status,
      assignedUserId: form.assignedUserId || "",
      assignedUserName: form.assignedUserName || "",
      publishDate: form.publishDate,
      publishTime: form.publishTime || "",
      reminderDate: form.reminderDate || "",
      contentBriefRichText: form.contentBriefRichText || "",
      scriptRichText: form.scriptRichText || "",
      captionRichText: form.captionRichText || "",
      ctaText: form.ctaText || "",
      hashtags: form.hashtags,
      notesRichText: form.notesRichText || "",
      checklists: form.checklists.map((item, index) => ({
        id: item.id,
        label: item.label,
        isCompleted: Boolean(item.isCompleted),
        sortOrder: index,
      })),
      assets: form.assets.map((asset, index) => ({
        id: asset.id,
        assetType: asset.assetType,
        name: asset.name || asset.assetType,
        url: asset.url,
        mimeType: asset.mimeType || "",
        sortOrder: index,
      })),
    };

    setSaving(true);
    try {
      if (form.id) {
        await apiRequest(`content/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("content", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      toast.success("Content saved.");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message || "Failed to save content.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlanner = async () => {
    if (!form.id) {
      setOpen(false);
      return;
    }
    if (!window.confirm("Delete this content item?")) return;
    setSaving(true);
    try {
      await apiRequest(`content/${form.id}`, { method: "DELETE" });
      toast.success("Content deleted.");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error.message || "Failed to delete content.");
    } finally {
      setSaving(false);
    }
  };

  const movePlannerDate = async (plannerId, nextDate) => {
    try {
      await apiRequest(`content/${plannerId}`, {
        method: "PUT",
        body: JSON.stringify({ publishDate: nextDate }),
      });
      toast.success("Content date updated.");
      await load();
    } catch (error) {
      toast.error(error.message || "Failed to move content.");
    }
  };

  const addComment = async () => {
    if (!form.id) {
      toast.error("Save the content first before adding comments.");
      return;
    }
    const comment = commentDraft.trim();
    if (!comment) return;
    setCommentSaving(true);
    try {
      const currentUser = typeof window !== "undefined" ? JSON.parse(window.localStorage.getItem("om_user") || "null") : null;
      const result = await apiRequest(`content/${form.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          comment,
          userId: currentUser?.id || "",
          userName: currentUser?.name || currentUser?.email || "HQ User",
        }),
      });
      setForm((current) => ({
        ...current,
        comments: [...(current.comments || []), result],
      }));
      setCommentDraft("");
      toast.success("Comment added.");
    } catch (error) {
      toast.error(error.message || "Failed to add comment.");
    } finally {
      setCommentSaving(false);
    }
  };

  const renderPlatformSummary = (platforms = []) => platforms.map((platform) => PLATFORM_SHORT_LABEL[platform] || platform).join(" | ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Content Planner</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Plan social media and campaign content month by month with a shared production workflow.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-[240px]" placeholder="Search title, script, caption..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Button className="gap-2" onClick={() => openCreateModal(toDateString(monthDate))}>
            <Plus className="h-4 w-4" /> New Content
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">This Month</p><p className="text-2xl font-semibold mt-1">{summary.totalPlanned}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Published</p><p className="text-2xl font-semibold mt-1 text-emerald-500">{summary.published}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Ready</p><p className="text-2xl font-semibold mt-1 text-cyan-600">{summary.ready}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Editing</p><p className="text-2xl font-semibold mt-1 text-amber-500">{summary.editing}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wider">Draft</p><p className="text-2xl font-semibold mt-1 text-slate-600">{summary.draft}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setMonthDate((current) => shiftMonth(current, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[220px] text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Month View</p>
                <p className="text-xl font-semibold mt-1">{formatMonthTitle(monthDate)}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => setMonthDate((current) => shiftMonth(current, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMonthDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Current Month</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5 min-w-[150px]">
                <Label>Platform</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    {PLATFORM_OPTIONS.map((platform) => <SelectItem key={platform} value={platform}>{platform}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-[150px]">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-[150px]">
                <Label>PIC</Label>
                <Select value={assignedUserFilter} onValueChange={setAssignedUserFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All PIC</SelectItem>
                    {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-[150px]">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORY_OPTIONS.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-[130px]">
                <Label>Priority</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    {PRIORITY_OPTIONS.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <CardContent className="grid grid-cols-1 md:grid-cols-7 gap-3 p-0">
            {Array.from({ length: 14 }).map((_, index) => (
              <Card key={index} className="min-h-[160px] animate-pulse bg-muted/30 border-border/40" />
            ))}
          </CardContent>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayLabel) => (
            <div key={dayLabel} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">
              {dayLabel}
            </div>
          ))}
          {calendarDays.map((day) => {
            const dayItems = itemsByDate[day.dateString] || [];
            return (
              <div
                key={day.dateString}
                className={`rounded-2xl border min-h-[150px] bg-white p-3 space-y-2 transition-colors ${day.isCurrentMonth ? "border-border/60" : "border-border/30 bg-[#F7F8FA]/60 text-muted-foreground"} ${day.isToday ? "ring-2 ring-blue-500/20" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const plannerId = event.dataTransfer.getData("text/plain");
                  if (plannerId) {
                    void movePlannerDate(plannerId, day.dateString);
                  }
                }}
              >
                <button type="button" className="w-full text-left" onClick={() => openCreateModal(day.dateString)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold ${day.isToday ? "text-blue-600" : "text-foreground"}`}>{day.dayNumber}</span>
                    {day.isToday ? <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600">Today</Badge> : null}
                  </div>
                </button>
                <div className="space-y-2">
                  {dayItems.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                      onClick={() => openEditModal(item.id)}
                      className="w-full text-left rounded-xl border border-border/50 bg-[#F7F8FA] px-3 py-2 hover:bg-white transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${STATUS_BADGE_CLASS[item.status] || STATUS_BADGE_CLASS.Draft}`}>{item.status}</span>
                        <span className="text-[11px] text-muted-foreground truncate">{renderPlatformSummary(item.platforms)}</span>
                      </div>
                    </button>
                  ))}
                  {dayItems.length > 3 ? (
                    <button type="button" className="text-xs font-medium text-blue-600 hover:underline" onClick={() => openCreateModal(day.dateString)}>
                      +{dayItems.length - 3} more
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[80vw] max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl">Content Planner</DialogTitle>
                <DialogDescription>{formatDateLabel(selectedDate || form.publishDate)}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Launch Pro Sport Legging" />
              </div>
              <MultiSelectToggle label="Platform" options={PLATFORM_OPTIONS} selectedValues={form.platforms} onToggle={togglePlatform} renderValue={(platform) => PLATFORM_SHORT_LABEL[platform] || platform} />
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>PIC</Label>
                <Select value={form.assignedUserId || "__none__"} onValueChange={(value) => setForm((current) => {
                  if (value === "__none__") {
                    return { ...current, assignedUserId: "", assignedUserName: "" };
                  }
                  const selectedUser = users.find((entry) => entry.id === value);
                  return { ...current, assignedUserId: value, assignedUserName: selectedUser?.name || "" };
                })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Publish Date</Label>
                <Input type="date" value={form.publishDate} onChange={(event) => { setSelectedDate(event.target.value); setForm((current) => ({ ...current, publishDate: event.target.value })); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Publish Time</Label>
                <Input type="time" value={form.publishTime} onChange={(event) => setForm((current) => ({ ...current, publishTime: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Reminder Date</Label>
                <Input type="date" value={form.reminderDate} onChange={(event) => setForm((current) => ({ ...current, reminderDate: event.target.value }))} />
              </div>
            </div>

            <RichTextEditor label="Content Brief" value={form.contentBriefRichText} onChange={(value) => setForm((current) => ({ ...current, contentBriefRichText: value }))} placeholder="Content brief and objectives..." />
            <RichTextEditor label="Script" value={form.scriptRichText} onChange={(value) => setForm((current) => ({ ...current, scriptRichText: value }))} placeholder="Write the full script here..." />
            <RichTextEditor label="Caption" value={form.captionRichText} onChange={(value) => setForm((current) => ({ ...current, captionRichText: value }))} placeholder="Write the social media caption..." />

            <div className="space-y-1.5">
              <Label>CTA</Label>
              <Textarea value={form.ctaText} onChange={(event) => setForm((current) => ({ ...current, ctaText: event.target.value }))} rows={3} placeholder="Call to action..." />
            </div>

            <HashtagInput values={form.hashtags} onChange={(next) => setForm((current) => ({ ...current, hashtags: next }))} />
            <ChecklistEditor items={form.checklists} onChange={(next) => setForm((current) => ({ ...current, checklists: next }))} />
            <AssetsEditor items={form.assets} onChange={(next) => setForm((current) => ({ ...current, assets: next }))} />
            <RichTextEditor label="Notes" value={form.notesRichText} onChange={(value) => setForm((current) => ({ ...current, notesRichText: value }))} placeholder="Internal notes..." />

            <div className="space-y-1.5">
              <Label>Comments</Label>
              <div className="rounded-xl border border-border bg-white p-3 space-y-3">
                {form.id ? (
                  <>
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {(form.comments || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No comments yet.</p>
                      ) : form.comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-border/50 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-sm font-medium">{comment.userName || "HQ User"}</span>
                            <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString("id-ID")}</span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={2} placeholder="Write a comment..." />
                      <Button type="button" onClick={addComment} disabled={commentSaving}>{commentSaving ? "Saving…" : "Comment"}</Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Save the content first to start a discussion.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 mr-auto">
              {form.id ? (
                <Button type="button" variant="destructive" onClick={deletePlanner} disabled={saving}>
                  Delete Content
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="button" onClick={savePlanner} disabled={saving}>{saving ? "Saving…" : "Save Content"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
