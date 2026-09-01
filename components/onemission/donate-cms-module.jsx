"use client";

import { useEffect, useState } from "react";
import {
  HandHeart,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const donateApi = {
  async get() {
    const response = await fetch("/api/admin/movement/donate");
    return response.json();
  },
  async detail(campaignId) {
    const response = await fetch(`/api/admin/movement/donate?campaignId=${encodeURIComponent(campaignId)}`);
    return response.json();
  },
  async put(body) {
    const response = await fetch("/api/admin/movement/donate", {
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
    const response = await fetch("/api/admin/movement/donate/upload", {
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

function statusBadgeClass(status) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800";
  if (status === "CLOSED") return "bg-neutral-200 text-neutral-700";
  return "bg-neutral-100 text-neutral-500";
}

function formatRupiah(value) {
  return `Rp${Math.max(0, Number(value) || 0).toLocaleString("id-ID")}`;
}

const EMPTY_CAMPAIGN = {
  title: "",
  slug: "",
  shortDescription: "",
  coverImage: "",
  storyTitle: "",
  storyContent: "",
  targetAmount: 0,
  status: "DRAFT",
};

export function DonateCmsModule({ user }) {
  const canManage = permissionAllowed(user, "settings", "manage_configuration");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaign, setCampaign] = useState(EMPTY_CAMPAIGN);
  const [updates, setUpdates] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [partners, setPartners] = useState([]);
  const [donations, setDonations] = useState([]);

  const loadList = async () => {
    const result = await donateApi.get();
    if (result?.error) {
      toast.error(resolveApiErrorMessage(result, "Failed to load Donate CMS."));
      return null;
    }
    setCampaigns(Array.isArray(result.campaigns) ? result.campaigns : []);
    return result;
  };

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const result = await loadList();
        if (!isActive) return;
        if (result && Array.isArray(result.campaigns) && result.campaigns.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(result.campaigns[0].id);
        }
      } catch {
        if (isActive) toast.error("Failed to load Donate CMS.");
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
    if (!selectedCampaignId) return;
    let isActive = true;
    (async () => {
      try {
        const result = await donateApi.detail(selectedCampaignId);
        if (!isActive) return;
        if (result?.error) {
          toast.error(resolveApiErrorMessage(result, "Failed to load campaign."));
          return;
        }
        setCampaign({
          title: result.campaign?.title || "",
          slug: result.campaign?.slug || "",
          shortDescription: result.campaign?.shortDescription || "",
          coverImage: result.campaign?.coverImage || "",
          storyTitle: result.campaign?.storyTitle || "",
          storyContent: result.campaign?.storyContent || "",
          targetAmount: Number(result.campaign?.targetAmount) || 0,
          status: result.campaign?.status || "DRAFT",
        });
        setUpdates(Array.isArray(result.updates) ? result.updates : []);
        setDisbursements(Array.isArray(result.disbursements) ? result.disbursements : []);
        setPartners(Array.isArray(result.partners) ? result.partners : []);
        setDonations(Array.isArray(result.donations) ? result.donations : []);
      } catch {
        if (isActive) toast.error("Failed to load campaign.");
      }
    })();
    return () => {
      isActive = false;
    };
  }, [selectedCampaignId]);

  const refreshList = () => loadList();

  const handleCreateCampaign = async () => {
    setSaving("create");
    try {
      const result = await donateApi.put({ action: "createCampaign", campaign: EMPTY_CAMPAIGN });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to create campaign."));
        return;
      }
      toast.success("Campaign draft created.");
      await refreshList();
      if (result.campaign?.id) setSelectedCampaignId(result.campaign.id);
    } catch {
      toast.error("Failed to create campaign.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveCampaign = async () => {
    setSaving("campaign");
    try {
      const result = await donateApi.put({
        action: "updateCampaign",
        campaignId: selectedCampaignId,
        campaign,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save campaign."));
        return;
      }
      toast.success("Campaign saved.");
      await refreshList();
    } catch {
      toast.error("Failed to save campaign.");
    } finally {
      setSaving("");
    }
  };

  const handleSetStatus = async (status) => {
    setSaving("status");
    try {
      const result = await donateApi.put({ action: "setStatus", campaignId: selectedCampaignId, status });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to change status."));
        return;
      }
      toast.success(`Status changed to ${status}.`);
      setCampaign((current) => ({ ...current, status }));
      await refreshList();
    } catch {
      toast.error("Failed to change status.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveUpdates = async () => {
    setSaving("updates");
    try {
      const result = await donateApi.put({
        action: "replaceUpdates",
        campaignId: selectedCampaignId,
        updates,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save updates."));
        return;
      }
      toast.success("Campaign updates saved.");
      setUpdates(Array.isArray(result.updates) ? result.updates : updates);
    } catch {
      toast.error("Failed to save updates.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveDisbursements = async () => {
    setSaving("disbursements");
    try {
      const result = await donateApi.put({
        action: "replaceDisbursements",
        campaignId: selectedCampaignId,
        disbursements,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save disbursements."));
        return;
      }
      toast.success("Disbursements saved.");
      setDisbursements(Array.isArray(result.disbursements) ? result.disbursements : disbursements);
    } catch {
      toast.error("Failed to save disbursements.");
    } finally {
      setSaving("");
    }
  };

  const handleSavePartners = async () => {
    setSaving("partners");
    try {
      const result = await donateApi.put({
        action: "replacePartners",
        campaignId: selectedCampaignId,
        partners,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save partners."));
        return;
      }
      toast.success("Partners saved.");
      setPartners(Array.isArray(result.partners) ? result.partners : partners);
    } catch {
      toast.error("Failed to save partners.");
    } finally {
      setSaving("");
    }
  };

  const handleUpload = async (file, field, onUploaded) => {
    if (!file) return;
    setUploadingField(field);
    try {
      const result = await donateApi.upload(file, field);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading Donate CMS…
      </div>
    );
  }

  const activeCampaign = campaigns.find((item) => item.status === "ACTIVE") || null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {/* ─── CAMPAIGNS ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HandHeart className="h-4 w-4" />
              Donation Campaigns
            </CardTitle>
            <CardDescription>
              Only ONE campaign can be ACTIVE at a time. CLOSED campaigns stay as public history.
            </CardDescription>
          </div>
          <Button onClick={handleCreateCampaign} disabled={!canManage || saving === "create"}>
            {saving === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            New Campaign
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {campaigns.length === 0 && (
            <p className="text-sm text-muted-foreground">No campaigns yet. Create one to get started.</p>
          )}
          {campaigns.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedCampaignId(item.id)}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                item.id === selectedCampaignId ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.title || "Untitled campaign"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRupiah(item.raised)} / {formatRupiah(item.targetAmount)} · {item.donorCount} donor(s)
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusBadgeClass(item.status)}`}>
                {item.status}
              </span>
            </button>
          ))}
          {activeCampaign && (
            <p className="text-xs text-muted-foreground">
              Currently active: <span className="font-semibold">{activeCampaign.title || "Untitled"}</span> — close it before activating another.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── CAMPAIGN EDITOR ───────────────────────────────────────────── */}
      {selectedCampaignId && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Editor</CardTitle>
            <CardDescription>Content, cover image, target, and status.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="campaign-title">Title</Label>
                <Input
                  id="campaign-title"
                  value={campaign.title}
                  disabled={!canManage}
                  onChange={(event) => setCampaign((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="campaign-slug">Slug</Label>
                <Input
                  id="campaign-slug"
                  value={campaign.slug}
                  disabled={!canManage}
                  onChange={(event) =>
                    setCampaign((current) => ({
                      ...current,
                      slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="campaign-target">Target Amount (IDR)</Label>
                <Input
                  id="campaign-target"
                  type="number"
                  min={0}
                  value={campaign.targetAmount}
                  disabled={!canManage}
                  onChange={(event) => setCampaign((current) => ({ ...current, targetAmount: Number(event.target.value) }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="w-full">Status</Label>
                {["DRAFT", "ACTIVE", "CLOSED"].map((status) => (
                  <Button
                    key={status}
                    variant={campaign.status === status ? "default" : "outline"}
                    onClick={() => handleSetStatus(status)}
                    disabled={!canManage || campaign.status === status || saving === "status"}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="campaign-short">Short Description</Label>
              <Textarea
                id="campaign-short"
                value={campaign.shortDescription}
                disabled={!canManage}
                onChange={(event) => setCampaign((current) => ({ ...current, shortDescription: event.target.value }))}
                rows={2}
              />
            </div>

            <ImageUploadField
              label="Cover Image"
              value={campaign.coverImage}
              fieldKey="cover"
              uploading={uploadingField === "cover"}
              disabled={!canManage}
              onChange={(url) => setCampaign((current) => ({ ...current, coverImage: url }))}
              onUpload={(file) =>
                handleUpload(file, "cover", (url) => setCampaign((current) => ({ ...current, coverImage: url })))
              }
            />

            <div className="border-t pt-5">
              <p className="mb-3 text-sm font-semibold">Story</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="story-title">Story Title</Label>
                  <Input
                    id="story-title"
                    value={campaign.storyTitle}
                    disabled={!canManage}
                    onChange={(event) => setCampaign((current) => ({ ...current, storyTitle: event.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="story-content">Story Content (paragraphs separated by blank lines)</Label>
                  <Textarea
                    id="story-content"
                    value={campaign.storyContent}
                    disabled={!canManage}
                    onChange={(event) => setCampaign((current) => ({ ...current, storyContent: event.target.value }))}
                    rows={8}
                  />
                </div>
              </div>
            </div>

            <div>
              <Button onClick={handleSaveCampaign} disabled={!canManage || saving === "campaign"}>
                {saving === "campaign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── UPDATES ───────────────────────────────────────────────────── */}
      {selectedCampaignId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Latest Updates</CardTitle>
              <CardDescription>Ordered updates shown on the public campaign page.</CardDescription>
            </div>
            <Button
              variant="outline"
              disabled={!canManage}
              onClick={() => setUpdates((current) => [...current, { title: "", date: new Date().toISOString(), image: "", imageAlt: "" }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Update
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {updates.map((update, index) => (
              <div key={update.id ?? index} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Update {index + 1}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => setUpdates((current) => current.filter((_, i) => i !== index))}
                    aria-label="Delete update"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={update.title}
                  disabled={!canManage}
                  placeholder="Update title"
                  onChange={(event) =>
                    setUpdates((current) => current.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))
                  }
                />
                <Input
                  type="date"
                  value={String(update.date || "").slice(0, 10)}
                  disabled={!canManage}
                  onChange={(event) =>
                    setUpdates((current) => current.map((item, i) => (i === index ? { ...item, date: event.target.value } : item)))
                  }
                />
                <ImageUploadField
                  label="Update Image (optional)"
                  value={update.image || ""}
                  fieldKey={`update-${index}`}
                  uploading={uploadingField === `update-${index}`}
                  disabled={!canManage}
                  onChange={(url) => setUpdates((current) => current.map((item, i) => (i === index ? { ...item, image: url } : item)))}
                  onUpload={(file) =>
                    handleUpload(file, `update-${index}`, (url) =>
                      setUpdates((current) => current.map((item, i) => (i === index ? { ...item, image: url } : item))),
                    )
                  }
                />
              </div>
            ))}
            <div>
              <Button onClick={handleSaveUpdates} disabled={!canManage || saving === "updates"}>
                {saving === "updates" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Updates
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── DISBURSEMENTS ─────────────────────────────────────────────── */}
      {selectedCampaignId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Fund Disbursement</CardTitle>
              <CardDescription>Where the funds are distributed.</CardDescription>
            </div>
            <Button
              variant="outline"
              disabled={!canManage}
              onClick={() =>
                setDisbursements((current) => [...current, { title: "", date: new Date().toISOString(), amount: 0, partnerName: "", image: "", imageAlt: "" }])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Disbursement
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {disbursements.map((item, index) => (
              <div key={item.id ?? index} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Disbursement {index + 1}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => setDisbursements((current) => current.filter((_, i) => i !== index))}
                    aria-label="Delete disbursement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    value={item.title}
                    disabled={!canManage}
                    placeholder="Title"
                    onChange={(event) =>
                      setDisbursements((current) => current.map((row, i) => (i === index ? { ...row, title: event.target.value } : row)))
                    }
                  />
                  <Input
                    type="number"
                    value={item.amount}
                    disabled={!canManage}
                    placeholder="Amount (IDR)"
                    onChange={(event) =>
                      setDisbursements((current) => current.map((row, i) => (i === index ? { ...row, amount: Number(event.target.value) } : row)))
                    }
                  />
                  <Input
                    value={item.partnerName}
                    disabled={!canManage}
                    placeholder="Partner name"
                    onChange={(event) =>
                      setDisbursements((current) => current.map((row, i) => (i === index ? { ...row, partnerName: event.target.value } : row)))
                    }
                  />
                </div>
              </div>
            ))}
            <div>
              <Button onClick={handleSaveDisbursements} disabled={!canManage || saving === "disbursements"}>
                {saving === "disbursements" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Disbursements
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── PARTNERS ──────────────────────────────────────────────────── */}
      {selectedCampaignId && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Our Partners</CardTitle>
              <CardDescription>Trusted partners distributing the support.</CardDescription>
            </div>
            <Button
              variant="outline"
              disabled={!canManage}
              onClick={() => setPartners((current) => [...current, { name: "", tagline: "", statement: "" }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Partner
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {partners.map((partner, index) => (
              <div key={partner.id ?? index} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner {index + 1}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => setPartners((current) => current.filter((_, i) => i !== index))}
                    aria-label="Delete partner"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    value={partner.name}
                    disabled={!canManage}
                    placeholder="Name"
                    onChange={(event) =>
                      setPartners((current) => current.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))
                    }
                  />
                  <Input
                    value={partner.tagline}
                    disabled={!canManage}
                    placeholder="Tagline"
                    onChange={(event) =>
                      setPartners((current) => current.map((row, i) => (i === index ? { ...row, tagline: event.target.value } : row)))
                    }
                  />
                  <Input
                    value={partner.statement}
                    disabled={!canManage}
                    placeholder="Statement"
                    onChange={(event) =>
                      setPartners((current) => current.map((row, i) => (i === index ? { ...row, statement: event.target.value } : row)))
                    }
                  />
                </div>
              </div>
            ))}
            <div>
              <Button onClick={handleSavePartners} disabled={!canManage || saving === "partners"}>
                {saving === "partners" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Partners
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── DONATIONS (read-only ledger) ──────────────────────────────── */}
      {selectedCampaignId && donations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Donations</CardTitle>
            <CardDescription>Transaction ledger (private donor info visible only here in HQ).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {donations.slice(0, 25).map((donation) => (
              <div key={donation.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {donation.anonymous ? "Anonymous" : donation.donorName || "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {donation.transactionNumber} · {donation.donorEmail || "no email"} · {donation.donorPhone || "no phone"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatRupiah(donation.amount)}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{donation.status}</p>
                </div>
              </div>
            ))}
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
