"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const impactApi = {
  async get() {
    const response = await fetch("/api/admin/movement/impact");
    return response.json();
  },
  async detail(storyId) {
    const response = await fetch(`/api/admin/movement/impact?storyId=${encodeURIComponent(storyId)}`);
    return response.json();
  },
  async put(body) {
    const response = await fetch("/api/admin/movement/impact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json();
  },
  async upload(file, field) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("field", field);
    const response = await fetch("/api/admin/movement/impact/upload", {
      method: "POST",
      body: formData,
    });
    return response.json();
  },
};

function permissionAllowed(user, moduleKey, actionKey) {
  const permissions = Array.isArray(user?.permissionKeys) ? user.permissionKeys : [];
  if (permissions.includes("*")) return true;
  return permissions.includes(`${moduleKey}:${actionKey}`);
}

function resolveApiErrorMessage(result, fallback) {
  return result?.error || result?.message || fallback;
}

const EMPTY_SETTINGS = { eyebrow: "", title: "", description: "" };

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "COMING_SOON", label: "Coming Soon" },
  { value: "NOW_LIVE", label: "Now Live" },
  { value: "CLOSED", label: "Closed" },
];

const CATEGORY_OPTIONS = ["PEOPLE", "COMMUNITY", "PHILOSOPHY", "JOURNEY"];

const EMPTY_STORY = {
  title: "",
  slug: "",
  category: "JOURNEY",
  shortDescription: "",
  coverImage: "",
  status: "DRAFT",
  featured: false,
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function statusBadgeClass(status) {
  if (status === "NOW_LIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "COMING_SOON") return "bg-amber-100 text-amber-800";
  if (status === "CLOSED") return "bg-neutral-200 text-neutral-700";
  return "bg-neutral-100 text-neutral-500";
}

function createTextBlock() {
  return { id: `temp-block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: "TEXT", text: "" };
}

function createImageBlock() {
  return {
    id: `temp-block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "IMAGE",
    imageUrl: "",
    altText: "",
    caption: "",
  };
}

export function ImpactCmsModule({ user }) {
  const canManage = permissionAllowed(user, "settings", "manage_configuration");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [stories, setStories] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [story, setStory] = useState(EMPTY_STORY);
  const [blocks, setBlocks] = useState([]);

  const loadList = async () => {
    const result = await impactApi.get();
    if (result?.error) {
      toast.error(resolveApiErrorMessage(result, "Failed to load Impact CMS."));
      return null;
    }
    setSettings({ ...EMPTY_SETTINGS, ...(result.settings || {}) });
    setStories(Array.isArray(result.stories) ? result.stories : []);
    return result;
  };

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const result = await loadList();
        if (!isActive) return;
        if (result && Array.isArray(result.stories) && result.stories.length > 0 && !selectedStoryId) {
          setSelectedStoryId(result.stories[0].id);
        }
      } catch {
        if (isActive) toast.error("Failed to load Impact CMS.");
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedStoryId) return;
    let isActive = true;
    (async () => {
      try {
        const result = await impactApi.detail(selectedStoryId);
        if (!isActive) return;
        if (result?.error) {
          toast.error(resolveApiErrorMessage(result, "Failed to load Impact story."));
          return;
        }
        setStory({
          ...EMPTY_STORY,
          title: result.story?.title || "",
          slug: result.story?.slug || "",
          category: result.story?.category || "JOURNEY",
          shortDescription: result.story?.shortDescription || "",
          coverImage: result.story?.coverImage || "",
          status: result.story?.status || "DRAFT",
          featured: Boolean(result.story?.featured),
        });
        setBlocks(Array.isArray(result.blocks) ? result.blocks : []);
      } catch {
        if (isActive) toast.error("Failed to load Impact story.");
      }
    })();
    return () => {
      isActive = false;
    };
  }, [selectedStoryId]);

  const refreshList = async () => {
    const result = await loadList();
    return result;
  };

  const handleSaveSettings = async () => {
    setSaving("settings");
    try {
      const result = await impactApi.put({ action: "updateSettings", settings });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save page settings."));
        return;
      }
      toast.success("Impact page settings updated.");
    } catch {
      toast.error("Failed to save page settings.");
    } finally {
      setSaving("");
    }
  };

  const handleCreateStory = async () => {
    setSaving("create");
    try {
      const result = await impactApi.put({
        action: "createStory",
        story: { ...EMPTY_STORY, title: "", slug: "" },
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to create Impact story."));
        return;
      }
      toast.success("Impact draft created.");
      await refreshList();
      if (result.story?.id) setSelectedStoryId(result.story.id);
    } catch {
      toast.error("Failed to create Impact story.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveStory = async () => {
    setSaving("story");
    try {
      const result = await impactApi.put({
        action: "updateStory",
        storyId: selectedStoryId,
        story,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save Impact story."));
        return;
      }
      toast.success("Impact story saved.");
      setStory({
        ...EMPTY_STORY,
        title: result.story?.title || "",
        slug: result.story?.slug || "",
        category: result.story?.category || "JOURNEY",
        shortDescription: result.story?.shortDescription || "",
        coverImage: result.story?.coverImage || "",
        status: result.story?.status || "DRAFT",
        featured: Boolean(result.story?.featured),
      });
      await refreshList();
    } catch {
      toast.error("Failed to save Impact story.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveBlocks = async () => {
    setSaving("blocks");
    try {
      const result = await impactApi.put({
        action: "replaceBlocks",
        storyId: selectedStoryId,
        blocks,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save content blocks."));
        return;
      }
      toast.success("Content blocks saved.");
      setBlocks(Array.isArray(result.blocks) ? result.blocks : blocks);
    } catch {
      toast.error("Failed to save content blocks.");
    } finally {
      setSaving("");
    }
  };

  const handleSetStatus = async (status) => {
    setSaving("status");
    try {
      const result = await impactApi.put({ action: "setStatus", storyId: selectedStoryId, status });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to change status."));
        return;
      }
      toast.success(`Status changed to ${status}.`);
      setStory((current) => ({ ...current, status }));
      await refreshList();
    } catch {
      toast.error("Failed to change status.");
    } finally {
      setSaving("");
    }
  };

  const handleSetFeatured = async (featured) => {
    setSaving("featured");
    try {
      const result = await impactApi.put({ action: "setFeatured", storyId: selectedStoryId, featured });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to update featured."));
        return;
      }
      toast.success(featured ? "Marked as featured." : "Removed featured.");
      setStory((current) => ({ ...current, featured }));
      await refreshList();
    } catch {
      toast.error("Failed to update featured.");
    } finally {
      setSaving("");
    }
  };

  const handleUpload = async (file, field, onUploaded) => {
    if (!file) return;
    setUploadingField(field);
    try {
      const result = await impactApi.upload(file, field);
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Image upload failed."));
        return;
      }
      if (!result?.url) {
        toast.error("Image upload returned no URL.");
        return;
      }
      onUploaded(result.url);
      toast.success("Image uploaded to ImageKit.");
    } catch {
      toast.error("Image upload failed.");
    } finally {
      setUploadingField("");
    }
  };

  const updateBlock = (index, key, value) => {
    setBlocks((current) =>
      current.map((block, blockIndex) => (blockIndex === index ? { ...block, [key]: value } : block)),
    );
  };

  const moveBlock = (index, direction) => {
    setBlocks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const removeBlock = (index) => {
    setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading Impact CMS…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* ─── PAGE SETTINGS ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Page Settings
          </CardTitle>
          <CardDescription>The Impact page header shown on the public listing.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="impact-eyebrow">Eyebrow</Label>
            <Input
              id="impact-eyebrow"
              value={settings.eyebrow}
              disabled={!canManage}
              onChange={(event) => setSettings((current) => ({ ...current, eyebrow: event.target.value }))}
              placeholder="IMPACT"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="impact-title">Title</Label>
            <Input
              id="impact-title"
              value={settings.title}
              disabled={!canManage}
              onChange={(event) => setSettings((current) => ({ ...current, title: event.target.value }))}
              placeholder="THE WORK BEHIND THE MOVEMENT."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="impact-description">Description</Label>
            <Textarea
              id="impact-description"
              value={settings.description}
              disabled={!canManage}
              onChange={(event) => setSettings((current) => ({ ...current, description: event.target.value }))}
              rows={2}
            />
          </div>
          <div>
            <Button onClick={handleSaveSettings} disabled={!canManage || saving === "settings"}>
              {saving === "settings" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── IMPACT STORIES ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Impact Stories</CardTitle>
            <CardDescription>
              Documentation and storytelling. Only ONE story can be featured; NOW LIVE always ranks first publicly.
            </CardDescription>
          </div>
          <Button onClick={handleCreateStory} disabled={!canManage || saving === "create"}>
            {saving === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            New Story
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {stories.length === 0 && (
            <p className="text-sm text-muted-foreground">No stories yet. Create one to get started.</p>
          )}
          {stories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedStoryId(item.id)}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                item.id === selectedStoryId ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-semibold">
                  {item.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                  <span className="truncate">{item.title || "Untitled story"}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.category} · {item.blockCount} block(s)
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusBadgeClass(item.status)}`}>
                {item.status.replace("_", " ")}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* ─── STORY EDITOR ──────────────────────────────────────────────── */}
      {selectedStoryId && (
        <Card>
          <CardHeader>
            <CardTitle>Story Editor</CardTitle>
            <CardDescription>
              Status, cover image, and ordered content blocks (TEXT + IMAGE). Alt text is required for image blocks.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Basic info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="story-title">Title</Label>
                <Input
                  id="story-title"
                  value={story.title}
                  disabled={!canManage}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStory((current) => ({
                      ...current,
                      title: value,
                      slug: !current.slug || current.slug === slugify(current.title) ? slugify(value) : current.slug,
                    }));
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="story-slug">Slug</Label>
                <Input
                  id="story-slug"
                  value={story.slug}
                  disabled={!canManage}
                  onChange={(event) => setStory((current) => ({ ...current, slug: slugify(event.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select
                  value={story.category}
                  disabled={!canManage}
                  onValueChange={(value) => setStory((current) => ({ ...current, category: value }))}
                >
                  <SelectTrigger id="story-category">
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0) + category.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={story.status}
                  disabled={!canManage}
                  onValueChange={(value) => handleSetStatus(value)}
                >
                  <SelectTrigger id="story-status">
                    <SelectValue placeholder="Choose status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="story-short">Short Description</Label>
              <Textarea
                id="story-short"
                value={story.shortDescription}
                disabled={!canManage}
                onChange={(event) => setStory((current) => ({ ...current, shortDescription: event.target.value }))}
                rows={2}
              />
            </div>

            <ImageUploadField
              label="Cover Image"
              value={story.coverImage}
              fieldKey="cover"
              uploading={uploadingField === "cover"}
              disabled={!canManage}
              onChange={(url) => setStory((current) => ({ ...current, coverImage: url }))}
              onUpload={(file) =>
                handleUpload(file, "cover", (url) => setStory((current) => ({ ...current, coverImage: url })))
              }
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={story.featured}
                disabled={!canManage}
                onCheckedChange={(checked) => handleSetFeatured(checked)}
              />
              Featured (only one story can be featured — marking this will unfeature the previous one)
            </label>

            <div>
              <Button onClick={handleSaveStory} disabled={!canManage || saving === "story"}>
                {saving === "story" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Story
              </Button>
            </div>

            {/* Content blocks */}
            <div className="mt-2 border-t pt-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <p className="mr-auto text-sm font-semibold">Content Blocks ({blocks.length})</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage}
                  onClick={() => setBlocks((current) => [...current, createTextBlock()])}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Text
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage}
                  onClick={() => setBlocks((current) => [...current, createImageBlock()])}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Image
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                {blocks.map((block, index) => (
                  <div key={block.id ?? index} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {index + 1} · {block.type}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage || index === 0}
                          onClick={() => moveBlock(index, -1)}
                          aria-label="Move block up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage || index === blocks.length - 1}
                          onClick={() => moveBlock(index, 1)}
                          aria-label="Move block down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canManage}
                          onClick={() => removeBlock(index)}
                          aria-label="Delete block"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {block.type === "TEXT" ? (
                      <Textarea
                        value={block.text || ""}
                        disabled={!canManage}
                        onChange={(event) => updateBlock(index, "text", event.target.value)}
                        rows={4}
                        placeholder="Write the story text…"
                      />
                    ) : (
                      <div className="flex flex-col gap-3">
                        <ImageUploadField
                          label="Body Image"
                          value={block.imageUrl || ""}
                          fieldKey={`block-${index}`}
                          uploading={uploadingField === `block-${index}`}
                          disabled={!canManage}
                          onChange={(url) => updateBlock(index, "imageUrl", url)}
                          onUpload={(file) =>
                            handleUpload(file, `block-${index}`, (url) => updateBlock(index, "imageUrl", url))
                          }
                        />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`block-${index}-alt`}>
                              Alt text <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id={`block-${index}-alt`}
                              value={block.altText || ""}
                              disabled={!canManage}
                              onChange={(event) => updateBlock(index, "altText", event.target.value)}
                              placeholder="Describe the image"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`block-${index}-caption`}>Caption (optional)</Label>
                            <Input
                              id={`block-${index}-caption`}
                              value={block.caption || ""}
                              disabled={!canManage}
                              onChange={(event) => updateBlock(index, "caption", event.target.value)}
                              placeholder="Short caption"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No blocks yet — add Text or Image blocks above.</p>
                )}
              </div>

              <div className="mt-4">
                <Button onClick={handleSaveBlocks} disabled={!canManage || saving === "blocks"}>
                  {saving === "blocks" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Blocks
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImageUploadField({ label, value, fieldKey, uploading, disabled, onChange, onUpload }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={`${label} preview`}
            className="h-16 w-16 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="ImageKit URL"
          />
          <label
            className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              disabled ? "pointer-events-none opacity-50" : "hover:bg-muted"
            }`}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = "";
              }}
            />
          </label>
          <span className="text-xs text-muted-foreground">Uploaded via ImageKit · {fieldKey}</span>
        </div>
      </div>
    </div>
  );
}
