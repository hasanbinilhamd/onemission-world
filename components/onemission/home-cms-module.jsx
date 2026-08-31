"use client";

import { useEffect, useState } from "react";
import { Home, ImagePlus, Loader2, Save } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

const homeCmsApi = {
  async get() {
    const response = await fetch("/api/admin/movement/home");
    return response.json();
  },
  async put(body) {
    const response = await fetch("/api/admin/movement/home", {
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
    const response = await fetch("/api/admin/movement/home/upload", {
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

const EMPTY_HOME = {
  headline: "",
  description: "",
  ctaLabel: "",
  ctaDestination: "mission",
  socialProofNumber: "",
  socialProofText: "",
  desktopImage: "",
  mobileImage: "",
};

const DESTINATION_OPTIONS = [
  { value: "mission", label: "Mission" },
  { value: "impact", label: "Impact" },
  { value: "shop", label: "Shop" },
  { value: "donate", label: "Donate" },
];

const DEFAULT_CARDS = [
  { title: "Vote Now", description: "", image: "", destination: "mission", displayOrder: 1 },
  { title: "Real Impact", description: "", image: "", destination: "impact", displayOrder: 2 },
  { title: "Performance", description: "", image: "", destination: "shop", displayOrder: 3 },
  { title: "Donate Now", description: "", image: "", destination: "donate", displayOrder: 4 },
];

function createEmptyCard(index) {
  return { id: `temp-card-${Date.now()}-${index}`, ...DEFAULT_CARDS[index % DEFAULT_CARDS.length] };
}

export function HomeCmsModule({ user }) {
  const canManage = permissionAllowed(user, "settings", "manage_configuration");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const [home, setHome] = useState(EMPTY_HOME);
  const [cards, setCards] = useState(() => DEFAULT_CARDS.map((card, index) => createEmptyCard(index)));

  useEffect(() => {
    let isActive = true;
    const loadContent = async () => {
      try {
        const result = await homeCmsApi.get();
        if (!isActive) return;
        if (result?.error) {
          toast.error(resolveApiErrorMessage(result, "Failed to load Home CMS."));
          return;
        }
        setHome({ ...EMPTY_HOME, ...(result.home || {}) });
        setCards(
          Array.isArray(result.cards) && result.cards.length > 0
            ? result.cards
            : DEFAULT_CARDS.map((card, index) => createEmptyCard(index)),
        );
      } catch {
        if (isActive) toast.error("Failed to load Home CMS.");
      } finally {
        if (isActive) setLoading(false);
      }
    };
    void loadContent();
    return () => {
      isActive = false;
    };
  }, []);

  const updateHomeField = (key, value) => {
    setHome((current) => ({ ...current, [key]: value }));
  };

  const updateCardField = (index, key, value) => {
    setCards((current) =>
      current.map((card, cardIndex) => (cardIndex === index ? { ...card, [key]: value } : card)),
    );
  };

  const handleUpload = async (file, field, onUploaded) => {
    if (!file) return;
    setUploadingField(field);
    try {
      const result = await homeCmsApi.upload(file, field);
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

  const handleSaveHome = async () => {
    setSaving("home");
    try {
      const result = await homeCmsApi.put({ home });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save Home hero settings."));
        return;
      }
      setHome({ ...EMPTY_HOME, ...(result.home || {}) });
      toast.success("Home hero updated.");
    } catch {
      toast.error("Failed to save Home hero settings.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveCards = async () => {
    setSaving("cards");
    try {
      const result = await homeCmsApi.put({ cards });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save Join The Mission cards."));
        return;
      }
      setCards(
        Array.isArray(result.cards) && result.cards.length > 0 ? result.cards : cards,
      );
      toast.success("Join The Mission cards updated.");
    } catch {
      toast.error("Failed to save Join The Mission cards.");
    } finally {
      setSaving("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading Home CMS…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Hero
          </CardTitle>
          <CardDescription>
            Movement homepage hero content. Design, layout, and animation stay in the frontend.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ImageUploadField
              label="Desktop Image"
              value={home.desktopImage}
              fieldKey="hero-desktop"
              uploading={uploadingField === "hero-desktop"}
              disabled={!canManage}
              onChange={(url) => updateHomeField("desktopImage", url)}
              onUpload={(file) =>
                handleUpload(file, "hero-desktop", (url) => updateHomeField("desktopImage", url))
              }
            />
            <ImageUploadField
              label="Mobile Image"
              value={home.mobileImage}
              fieldKey="hero-mobile"
              uploading={uploadingField === "hero-mobile"}
              disabled={!canManage}
              onChange={(url) => updateHomeField("mobileImage", url)}
              onUpload={(file) =>
                handleUpload(file, "hero-mobile", (url) => updateHomeField("mobileImage", url))
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="home-headline">Headline</Label>
              <Input
                id="home-headline"
                value={home.headline}
                disabled={!canManage}
                onChange={(event) => updateHomeField("headline", event.target.value)}
                placeholder="We Build. We Move. We Serve."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="home-description">Description</Label>
              <Textarea
                id="home-description"
                value={home.description}
                disabled={!canManage}
                onChange={(event) => updateHomeField("description", event.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="home-cta-label">CTA Label</Label>
                <Input
                  id="home-cta-label"
                  value={home.ctaLabel}
                  disabled={!canManage}
                  onChange={(event) => updateHomeField("ctaLabel", event.target.value)}
                  placeholder="Join The Mission"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>CTA Destination</Label>
                <Select
                  value={home.ctaDestination}
                  disabled={!canManage}
                  onValueChange={(value) => updateHomeField("ctaDestination", value)}
                >
                  <SelectTrigger id="home-cta-destination">
                    <SelectValue placeholder="Choose destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="home-social-number">Social Proof Number</Label>
                <Input
                  id="home-social-number"
                  value={home.socialProofNumber}
                  disabled={!canManage}
                  onChange={(event) => updateHomeField("socialProofNumber", event.target.value)}
                  placeholder="12K+"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="home-social-text">Social Proof Text</Label>
                <Input
                  id="home-social-text"
                  value={home.socialProofText}
                  disabled={!canManage}
                  onChange={(event) => updateHomeField("socialProofText", event.target.value)}
                  placeholder="Muslims are moving together"
                />
              </div>
            </div>
          </div>

          <div>
            <Button
              onClick={handleSaveHome}
              disabled={!canManage || saving === "home"}
            >
              {saving === "home" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── JOIN THE MISSION CARDS ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Join The Mission</CardTitle>
          <CardDescription>
            The four movement cards. Numbers (01–04) are derived from the order — never edited manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {cards.map((card, index) => (
            <div key={card.id ?? index} className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">
                  {String(card.displayOrder || index + 1).padStart(2, "0")} · {card.title || `Card ${index + 1}`}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`card-${index}-title`}>Title</Label>
                  <Input
                    id={`card-${index}-title`}
                    value={card.title}
                    disabled={!canManage}
                    onChange={(event) => updateCardField(index, "title", event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`card-${index}-order`}>Order</Label>
                  <Input
                    id={`card-${index}-order`}
                    type="number"
                    min={1}
                    value={card.displayOrder}
                    disabled={!canManage}
                    onChange={(event) => updateCardField(index, "displayOrder", Number(event.target.value))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`card-${index}-description`}>Description</Label>
                <Input
                  id={`card-${index}-description`}
                  value={card.description}
                  disabled={!canManage}
                  onChange={(event) => updateCardField(index, "description", event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Destination</Label>
                <Select
                  value={card.destination}
                  disabled={!canManage}
                  onValueChange={(value) => updateCardField(index, "destination", value)}
                >
                  <SelectTrigger id={`card-${index}-destination`}>
                    <SelectValue placeholder="Choose destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ImageUploadField
                label="Image"
                value={card.image}
                fieldKey={`card-${index + 1}`}
                uploading={uploadingField === `card-${index + 1}`}
                disabled={!canManage}
                onChange={(url) => updateCardField(index, "image", url)}
                onUpload={(file) =>
                  handleUpload(file, `card-${index + 1}`, (url) => updateCardField(index, "image", url))
                }
              />
            </div>
          ))}

          <div>
            <Button
              onClick={handleSaveCards}
              disabled={!canManage || saving === "cards"}
            >
              {saving === "cards" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
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
