"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const websiteApi = {
  async get(path) {
    const response = await fetch(`/api/${path}`);
    return response.json();
  },
  async put(path, body) {
    const response = await fetch(`/api/${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json();
  },
};

function permissionAllowed(user, moduleKey, actionKey) {
  const permissions = Array.isArray(user?.permissionKeys) ? user.permissionKeys : [];
  if (permissions.includes("*")) return true;
  return permissions.includes(`${moduleKey}:${actionKey}`);
}

function createTemporaryId(prefix) {
  return `temp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createHeroItem(displayOrder = 1) {
  return {
    id: createTemporaryId("hero"),
    mediaType: "image",
    desktopUrl: "",
    mobileUrl: "",
    displayOrder,
    active: true,
    scale: 1,
    verticalOffset: 0,
  };
}

function createCollectionHeroItem(displayOrder = 1, heroType = "image") {
  return {
    id: createTemporaryId("collection-hero"),
    mediaType: heroType === "video" ? "video" : "image",
    desktopUrl: "",
    mobileUrl: "",
    displayOrder,
    active: true,
  };
}

function createProductStoryItem(displayOrder = 1) {
  return {
    id: createTemporaryId("product-story"),
    mediaType: "image",
    mediaUrl: "",
    description: "",
    displayOrder,
    active: true,
  };
}

function resolveApiErrorMessage(result, fallback) {
  return result?.error || result?.message || fallback;
}

export function WebsiteSettingsModule({ user }) {
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [savingTab, setSavingTab] = useState("");
  const [heroItems, setHeroItems] = useState([]);
  const [brandVideo, setBrandVideo] = useState({
    id: "",
    videoUrl: "",
    posterUrl: "",
    active: true,
  });
  const [productStoryItems, setProductStoryItems] = useState([]);
  const [collectionHero, setCollectionHero] = useState({
    heroType: "image",
    title: "MEN'S COLLECTION",
    description: "",
    overlayOpacity: 35,
    active: true,
    mediaItems: [createCollectionHeroItem(1)],
  });
  const canManage = permissionAllowed(user, "settings", "manage_configuration");

  const heroActiveCount = useMemo(() => {
    return heroItems.filter((item) => item.active).length;
  }, [heroItems]);

  const load = async ({ silent = false } = {}) => {
    if (silent) {
      setReloading(true);
    } else {
      setLoading(true);
    }

    const result = await websiteApi.get("admin/website");
    if (result?.error) {
      toast.error(resolveApiErrorMessage(result, "Failed to load website CMS."));
      if (silent) {
        setReloading(false);
      } else {
        setLoading(false);
      }
      return;
    }

    setHeroItems(Array.isArray(result?.heroItems) ? result.heroItems : []);
    setBrandVideo(result?.brandVideo || {
      id: "",
      videoUrl: "",
      posterUrl: "",
      active: true,
    });
    setProductStoryItems(Array.isArray(result?.productStoryItems) ? result.productStoryItems : []);
    setCollectionHero(result?.collectionHero || {
      heroType: "image",
      title: "MEN'S COLLECTION",
      description: "",
      overlayOpacity: 35,
      active: true,
      mediaItems: [createCollectionHeroItem(1)],
    });

    if (silent) {
      setReloading(false);
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleReload = async () => {
    await load({ silent: true });
  };

  const updateHeroItem = (itemId, key, value) => {
    setHeroItems((current) => current.map((item) => (
      item.id === itemId
        ? { ...item, [key]: value }
        : item
    )));
  };

  const updateProductStoryItem = (itemId, key, value) => {
    setProductStoryItems((current) => current.map((item) => (
      item.id === itemId
        ? { ...item, [key]: value }
        : item
    )));
  };

  const updateCollectionHero = (key, value) => {
    setCollectionHero((current) => {
      const next = { ...current, [key]: value };
      if (key === "heroType") {
        const mediaItems = Array.isArray(current.mediaItems) && current.mediaItems.length > 0
          ? current.mediaItems
          : [createCollectionHeroItem(1, value)];
        next.mediaItems = (value === "slideshow" ? mediaItems : mediaItems.slice(0, 1)).map((item, index) => ({
          ...item,
          mediaType: value === "video" ? "video" : "image",
          displayOrder: Number(item.displayOrder || index + 1),
        }));
      }
      return next;
    });
  };

  const updateCollectionHeroItem = (itemId, key, value) => {
    setCollectionHero((current) => ({
      ...current,
      mediaItems: (current.mediaItems || []).map((item) => (
        item.id === itemId
          ? { ...item, [key]: value }
          : item
      )),
    }));
  };

  const addHeroItem = () => {
    const nextDisplayOrder = heroItems.reduce((max, item) => Math.max(max, Number(item.displayOrder || 0)), 0) + 1;
    setHeroItems((current) => [...current, createHeroItem(nextDisplayOrder)]);
  };

  const removeHeroItem = (itemId) => {
    setHeroItems((current) => current.filter((item) => item.id !== itemId));
  };

  const addCollectionHeroItem = () => {
    setCollectionHero((current) => {
      const nextDisplayOrder = (current.mediaItems || []).reduce((max, item) => Math.max(max, Number(item.displayOrder || 0)), 0) + 1;
      return {
        ...current,
        mediaItems: [...(current.mediaItems || []), createCollectionHeroItem(nextDisplayOrder, current.heroType)],
      };
    });
  };

  const removeCollectionHeroItem = (itemId) => {
    setCollectionHero((current) => ({
      ...current,
      mediaItems: (current.mediaItems || []).filter((item) => item.id !== itemId),
    }));
  };

  const addProductStoryItem = () => {
    const nextDisplayOrder = productStoryItems.reduce((max, item) => Math.max(max, Number(item.displayOrder || 0)), 0) + 1;
    setProductStoryItems((current) => [...current, createProductStoryItem(nextDisplayOrder)]);
  };

  const removeProductStoryItem = (itemId) => {
    setProductStoryItems((current) => current.filter((item) => item.id !== itemId));
  };

  const saveHero = async () => {
    setSavingTab("hero");
    const result = await websiteApi.put("admin/website/hero", { items: heroItems });
    setSavingTab("");

    if (result?.error) {
      toast.error(resolveApiErrorMessage(result, "Failed to save hero settings."));
      return;
    }

    setHeroItems(Array.isArray(result) ? result : heroItems);
    toast.success("Website hero updated.");
  };

  const saveBrandVideo = async () => {
    setSavingTab("brand-video");
    const result = await websiteApi.put("admin/website/brand-video", brandVideo);
    setSavingTab("");

    if (result?.error) {
      toast.error(resolveApiErrorMessage(result, "Failed to save brand video settings."));
      return;
    }

    setBrandVideo(result || brandVideo);
    toast.success("Website brand video updated.");
  };

  const saveProductStory = async () => {
    setSavingTab("product-story");
    const result = await websiteApi.put("admin/website/product-story", { items: productStoryItems });
    setSavingTab("");

    if (result?.error) {
      toast.error(resolveApiErrorMessage(result, "Failed to save product story settings."));
      return;
    }

    setProductStoryItems(Array.isArray(result) ? result : productStoryItems);
    toast.success("Website product story updated.");
  };

  const saveCollectionHero = async () => {
    setSavingTab("collection");
    const result = await websiteApi.put("admin/website/collection", collectionHero);
    setSavingTab("");

    if (result?.error) {
      toast.error(resolveApiErrorMessage(result, "Failed to save collection hero settings."));
      return;
    }

    setCollectionHero(result || collectionHero);
    toast.success("Collection hero updated.");
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading website CMS…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Website</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manage homepage CMS content for Hero, Brand Video, and Product Story without changing Commerce layout.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleReload} disabled={reloading}>
          <RefreshCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
          {reloading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Tabs defaultValue="hero" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="brand-video">Brand Video</TabsTrigger>
          <TabsTrigger value="product-story">Product Story</TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> Hero Showcase Media
              </CardTitle>
              <CardDescription>
                Manage only the centered showcase assets used in the homepage hero. Background, logo, animation, typography, and layout remain controlled in Commerce.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border/60 bg-[#F7F8FA] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Hero CMS Rules</p>
                  <p className="text-xs text-muted-foreground mt-1">Maximum 4 active items. URLs must point to ImageKit assets. Upload is not included in Phase 1.</p>
                </div>
                <div className="text-sm font-semibold text-[#111827]">Active: {heroActiveCount} / 4</div>
              </div>

              {heroItems.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold">Hero Item {index + 1}</p>
                      <p className="text-xs text-muted-foreground mt-1">Update the media asset only. Commerce keeps the existing hero styling and interactions.</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHeroItem(item.id)}
                      disabled={!canManage}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label>Media Type</Label>
                      <Select
                        value={item.mediaType}
                        onValueChange={(value) => updateHeroItem(item.id, "mediaType", value)}
                        disabled={!canManage}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Display Order</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.displayOrder}
                        disabled={!canManage}
                        onChange={(event) => updateHeroItem(item.id, "displayOrder", event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Scale</Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.01"
                        value={item.scale ?? 1}
                        disabled={!canManage}
                        onChange={(event) => updateHeroItem(item.id, "scale", event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Vertical Offset</Label>
                      <Input
                        type="number"
                        step="1"
                        value={item.verticalOffset ?? 0}
                        disabled={!canManage}
                        onChange={(event) => updateHeroItem(item.id, "verticalOffset", event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px] gap-4">
                    <div className="space-y-1.5">
                      <Label>Desktop URL</Label>
                      <Input
                        value={item.desktopUrl || ""}
                        disabled={!canManage}
                        onChange={(event) => updateHeroItem(item.id, "desktopUrl", event.target.value)}
                        placeholder="https://ik.imagekit.io/..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mobile URL (optional)</Label>
                      <Input
                        value={item.mobileUrl || ""}
                        disabled={!canManage}
                        onChange={(event) => updateHeroItem(item.id, "mobileUrl", event.target.value)}
                        placeholder="https://ik.imagekit.io/..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Active</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                        <Switch
                          checked={Boolean(item.active)}
                          disabled={!canManage}
                          onCheckedChange={(value) => updateHeroItem(item.id, "active", value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={addHeroItem} disabled={!canManage}>
                  <Plus className="h-4 w-4" /> Add Hero Item
                </Button>
                {canManage ? (
                  <Button onClick={saveHero} disabled={savingTab === "hero"}>
                    {savingTab === "hero" ? "Saving…" : "Save Website Hero"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collection" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> Collection Page Hero
              </CardTitle>
              <CardDescription>
                Manage the single Collection page hero shown above the existing Commerce product grid. Filters, sorting, pagination, and product cards remain unchanged.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-[#F7F8FA] px-4 py-3">
                <p className="text-sm font-medium">Collection CMS Rules</p>
                <p className="text-xs text-muted-foreground mt-1">Use one hero for the Collection page. Slideshow supports multiple ordered media items; Image and Video use one media item.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label>Collection Hero Type</Label>
                  <Select value={collectionHero.heroType} onValueChange={(value) => updateCollectionHero("heroType", value)} disabled={!canManage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="slideshow">Slideshow</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Active</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                    <Switch checked={Boolean(collectionHero.active)} disabled={!canManage} onCheckedChange={(value) => updateCollectionHero("active", value)} />
                  </div>
                </div>
                <div className="space-y-1.5 xl:col-span-2">
                  <Label>Overlay Opacity ({Number(collectionHero.overlayOpacity || 0)}%)</Label>
                  <Input type="range" min="0" max="100" value={collectionHero.overlayOpacity} disabled={!canManage} onChange={(event) => updateCollectionHero("overlayOpacity", Number(event.target.value))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Collection Title</Label>
                <Input value={collectionHero.title || ""} disabled={!canManage} onChange={(event) => updateCollectionHero("title", event.target.value)} placeholder="MEN'S COLLECTION" />
              </div>

              <div className="space-y-1.5">
                <Label>Collection Description</Label>
                <Textarea value={collectionHero.description || ""} disabled={!canManage} onChange={(event) => updateCollectionHero("description", event.target.value)} rows={3} />
              </div>

              {(collectionHero.mediaItems || []).map((item, index) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold">Media Item {index + 1}</p>
                      <p className="text-xs text-muted-foreground mt-1">Desktop URL is required. Mobile URL is optional.</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeCollectionHeroItem(item.id)} disabled={!canManage || collectionHero.heroType !== "slideshow"} className="text-rose-500 hover:text-rose-600">
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="space-y-1.5 xl:col-span-2">
                      <Label>Desktop URL</Label>
                      <Input value={item.desktopUrl || ""} disabled={!canManage} onChange={(event) => updateCollectionHeroItem(item.id, "desktopUrl", event.target.value)} placeholder="https://ik.imagekit.io/..." />
                    </div>
                    <div className="space-y-1.5 xl:col-span-2">
                      <Label>Mobile URL (optional)</Label>
                      <Input value={item.mobileUrl || ""} disabled={!canManage} onChange={(event) => updateCollectionHeroItem(item.id, "mobileUrl", event.target.value)} placeholder="https://ik.imagekit.io/..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Display Order</Label>
                      <Input type="number" min="0" value={item.displayOrder} disabled={!canManage || collectionHero.heroType !== "slideshow"} onChange={(event) => updateCollectionHeroItem(item.id, "displayOrder", event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Active</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                        <Switch checked={Boolean(item.active)} disabled={!canManage} onCheckedChange={(value) => updateCollectionHeroItem(item.id, "active", value)} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={addCollectionHeroItem} disabled={!canManage || collectionHero.heroType !== "slideshow"}>
                  <Plus className="h-4 w-4" /> Add Media Item
                </Button>
                {canManage ? (
                  <Button onClick={saveCollectionHero} disabled={savingTab === "collection"}>
                    {savingTab === "collection" ? "Saving…" : "Save Collection Hero"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brand-video" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> Brand Video
              </CardTitle>
              <CardDescription>
                Manage the single homepage brand video record. The existing layout, playback behavior, and styling remain unchanged in Commerce.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-[#F7F8FA] px-4 py-3">
                <p className="text-sm font-medium">Brand Video CMS Rules</p>
                <p className="text-xs text-muted-foreground mt-1">Use ImageKit URLs only. Upload is not included in Phase 1.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px] gap-4 items-end">
                <div className="space-y-1.5">
                  <Label>Video URL</Label>
                  <Input
                    value={brandVideo.videoUrl || ""}
                    disabled={!canManage}
                    onChange={(event) => setBrandVideo((current) => ({ ...current, videoUrl: event.target.value }))}
                    placeholder="https://ik.imagekit.io/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Poster URL</Label>
                  <Input
                    value={brandVideo.posterUrl || ""}
                    disabled={!canManage}
                    onChange={(event) => setBrandVideo((current) => ({ ...current, posterUrl: event.target.value }))}
                    placeholder="https://ik.imagekit.io/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Active</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                    <Switch
                      checked={Boolean(brandVideo.active)}
                      disabled={!canManage}
                      onCheckedChange={(value) => setBrandVideo((current) => ({ ...current, active: value }))}
                    />
                  </div>
                </div>
              </div>

              {canManage ? (
                <div className="flex justify-end">
                  <Button onClick={saveBrandVideo} disabled={savingTab === "brand-video"}>
                    {savingTab === "brand-video" ? "Saving…" : "Save Brand Video"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product-story" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> Product Story
              </CardTitle>
              <CardDescription>
                Manage the Product Story slider content only. Commerce keeps the current slider layout, spacing, animation, and responsiveness.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-[#F7F8FA] px-4 py-3">
                <p className="text-sm font-medium">Product Story CMS Rules</p>
                <p className="text-xs text-muted-foreground mt-1">Unlimited items are supported. Homepage reads active items ordered by Display Order ascending.</p>
              </div>

              {productStoryItems.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold">Product Story Item {index + 1}</p>
                      <p className="text-xs text-muted-foreground mt-1">Keep the description concise so it fits the existing Commerce slider presentation.</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProductStoryItem(item.id)}
                      disabled={!canManage}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label>Media Type</Label>
                      <Select
                        value={item.mediaType}
                        onValueChange={(value) => updateProductStoryItem(item.id, "mediaType", value)}
                        disabled={!canManage}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Display Order</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.displayOrder}
                        disabled={!canManage}
                        onChange={(event) => updateProductStoryItem(item.id, "displayOrder", event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Active</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                        <Switch
                          checked={Boolean(item.active)}
                          disabled={!canManage}
                          onCheckedChange={(value) => updateProductStoryItem(item.id, "active", value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Media URL</Label>
                    <Input
                      value={item.mediaUrl || ""}
                      disabled={!canManage}
                      onChange={(event) => updateProductStoryItem(item.id, "mediaUrl", event.target.value)}
                      placeholder="https://ik.imagekit.io/..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      value={item.description || ""}
                      disabled={!canManage}
                      onChange={(event) => updateProductStoryItem(item.id, "description", event.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" className="gap-2" onClick={addProductStoryItem} disabled={!canManage}>
                  <Plus className="h-4 w-4" /> Add Product Story Item
                </Button>
                {canManage ? (
                  <Button onClick={saveProductStory} disabled={savingTab === "product-story"}>
                    {savingTab === "product-story" ? "Saving…" : "Save Product Story"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
