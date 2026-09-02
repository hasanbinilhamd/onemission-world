"use client";

import { useEffect, useState } from "react";
import { Target, ImagePlus, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageAvailabilityControl } from "@/components/onemission/page-availability-control";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const missionApi = {
  async get() {
    const response = await fetch("/api/admin/movement/mission");
    return response.json();
  },
  async detail(missionId) {
    const response = await fetch(`/api/admin/movement/mission?missionId=${encodeURIComponent(missionId)}`);
    return response.json();
  },
  async put(body) {
    const response = await fetch("/api/admin/movement/mission", {
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
    const response = await fetch("/api/admin/movement/mission/upload", {
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

const EMPTY_CONTENT = { eyebrow: "", title: "", description: "" };
const MAX_ACTIVE_OPTIONS = 4;

function createEmptyOption(index) {
  return {
    id: `temp-option-${Date.now()}-${index}`,
    title: "",
    description: "",
    image: "",
    displayOrder: index + 1,
    isActive: true,
  };
}

function statusBadgeClass(status) {
  if (status === "OPEN") return "bg-emerald-100 text-emerald-800";
  if (status === "CLOSED") return "bg-neutral-200 text-neutral-700";
  return "bg-amber-100 text-amber-800";
}

export function MissionCmsModule({ user }) {
  const canManage = permissionAllowed(user, "settings", "manage_configuration");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [uploadingField, setUploadingField] = useState("");
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [options, setOptions] = useState([]);
  const [maxActiveOptions, setMaxActiveOptions] = useState(MAX_ACTIVE_OPTIONS);

  const openMission = missions.find((mission) => mission.status === "OPEN") || null;
  const activeOptionCount = options.filter((option) => option.isActive).length;

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const result = await missionApi.get();
        if (!isActive) return;
        if (result?.error) {
          toast.error(resolveApiErrorMessage(result, "Failed to load Mission CMS."));
          return;
        }
        const list = Array.isArray(result.missions) ? result.missions : [];
        setMissions(list);
        if (list.length > 0 && !selectedMissionId) {
          setSelectedMissionId(list[0].id);
        }
      } catch {
        if (isActive) toast.error("Failed to load Mission CMS.");
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
    if (!selectedMissionId) return;
    let isActive = true;
    (async () => {
      try {
        const detail = await missionApi.detail(selectedMissionId);
        if (!isActive) return;
        if (detail?.error) {
          toast.error(resolveApiErrorMessage(detail, "Failed to load mission options."));
          return;
        }
        setContent({
          eyebrow: detail.mission?.eyebrow || "",
          title: detail.mission?.title || "",
          description: detail.mission?.description || "",
        });
        setOptions(Array.isArray(detail.options) ? detail.options : []);
        setMaxActiveOptions(Number(detail.maxActiveOptions) || MAX_ACTIVE_OPTIONS);
      } catch {
        if (isActive) toast.error("Failed to load mission detail.");
      }
    })();
    return () => {
      isActive = false;
    };
  }, [selectedMissionId]);

  const refreshMissions = async () => {
    const result = await missionApi.get();
    if (result?.error) return;
    setMissions(Array.isArray(result.missions) ? result.missions : []);
  };

  const handleCreateMission = async () => {
    setSaving("create");
    try {
      const result = await missionApi.put({
        action: "createMission",
        eyebrow: "YOUR VOICE, OUR NEXT STEP",
        title: "",
        description: "",
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to create mission."));
        return;
      }
      toast.success("New mission draft created.");
      await refreshMissions();
      if (result.mission?.id) {
        setSelectedMissionId(result.mission.id);
      }
    } catch {
      toast.error("Failed to create mission.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveContent = async () => {
    setSaving("content");
    try {
      const result = await missionApi.put({
        action: "updateContent",
        missionId: selectedMissionId,
        content,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save mission content."));
        return;
      }
      toast.success("Mission content updated.");
      await refreshMissions();
    } catch {
      toast.error("Failed to save mission content.");
    } finally {
      setSaving("");
    }
  };

  const handleSaveOptions = async () => {
    const activeCount = options.filter((option) => option.isActive).length;
    if (activeCount > maxActiveOptions) {
      toast.error(`Maximum ${maxActiveOptions} active options. Deactivate ${activeCount - maxActiveOptions} option(s).`);
      return;
    }
    setSaving("options");
    try {
      const result = await missionApi.put({
        action: "replaceOptions",
        missionId: selectedMissionId,
        options,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to save mission options."));
        return;
      }
      toast.success("Mission options updated.");
      setOptions(Array.isArray(result.options) ? result.options : options);
    } catch {
      toast.error("Failed to save mission options.");
    } finally {
      setSaving("");
    }
  };

  const handleSetStatus = async (status) => {
    setSaving(`status-${status}`);
    try {
      const result = await missionApi.put({
        action: "setStatus",
        missionId: selectedMissionId,
        status,
      });
      if (result?.error) {
        toast.error(resolveApiErrorMessage(result, "Failed to change mission status."));
        return;
      }
      toast.success(`Mission status changed to ${status}.`);
      await refreshMissions();
    } catch {
      toast.error("Failed to change mission status.");
    } finally {
      setSaving("");
    }
  };

  const handleUpload = async (file, field, onUploaded) => {
    if (!file) return;
    setUploadingField(field);
    try {
      const result = await missionApi.upload(file, field);
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

  const updateOption = (index, key, value) => {
    setOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? { ...option, [key]: value } : option)),
    );
  };

  const addOption = () => {
    setOptions((current) => [...current, createEmptyOption(current.length)]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading Mission CMS…
      </div>
    );
  }

  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) || null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* ─── PAGE AVAILABILITY ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Page Availability</CardTitle>
          <CardDescription>
            Controls whether the public Mission section is live or shows the Coming Soon page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PageAvailabilityControl page="mission" user={user} />
        </CardContent>
      </Card>

      {/* ─── MISSIONS OVERVIEW ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Voting Missions
            </CardTitle>
            <CardDescription>
              Only ONE mission can be OPEN at a time. Closed missions and their votes are preserved as history.
            </CardDescription>
          </div>
          <Button onClick={handleCreateMission} disabled={!canManage || saving === "create"}>
            {saving === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            New Mission
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {missions.length === 0 && (
            <p className="text-sm text-muted-foreground">No missions yet. Create one to get started.</p>
          )}
          {missions.map((mission) => (
            <button
              key={mission.id}
              type="button"
              onClick={() => setSelectedMissionId(mission.id)}
              className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                mission.id === selectedMissionId ? "border-foreground bg-muted/60" : "hover:bg-muted/40"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{mission.title || "Untitled mission"}</p>
                <p className="text-xs text-muted-foreground">
                  {mission.activeOptionCount} active option(s) · {mission.totalVotes} vote(s)
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusBadgeClass(mission.status)}`}>
                {mission.status}
              </span>
            </button>
          ))}
          {openMission && (
            <p className="text-xs text-muted-foreground">
              Currently open: <span className="font-semibold">{openMission.title || "Untitled mission"}</span> — close it before opening another.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── GENERAL CONTENT ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Mission Content</CardTitle>
          <CardDescription>Eyebrow, title, and description shown on the public Mission page.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {selectedMission ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mission-eyebrow">Eyebrow</Label>
                <Input
                  id="mission-eyebrow"
                  value={content.eyebrow}
                  disabled={!canManage}
                  onChange={(event) => setContent((current) => ({ ...current, eyebrow: event.target.value }))}
                  placeholder="YOUR VOICE, OUR NEXT STEP"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mission-title">Title</Label>
                <Input
                  id="mission-title"
                  value={content.title}
                  disabled={!canManage}
                  onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))}
                  placeholder="THE NEXT MISSION IS YOURS."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mission-description">Description</Label>
                <Textarea
                  id="mission-description"
                  value={content.description}
                  disabled={!canManage}
                  onChange={(event) => setContent((current) => ({ ...current, description: event.target.value }))}
                  rows={2}
                  placeholder="Your vote will shape our next move as a movement."
                />
              </div>
              <div>
                <Button onClick={handleSaveContent} disabled={!canManage || saving === "content"}>
                  {saving === "content" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Content
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a mission to edit its content.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── STATUS ────────────────────────────────────────────────────── */}
      {selectedMission && (
        <Card>
          <CardHeader>
            <CardTitle>Voting Status</CardTitle>
            <CardDescription>
              Open makes this the active voting mission. Only one mission can be OPEN — the server enforces this rule.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {(["DRAFT", "OPEN", "CLOSED"]).map((status) => (
              <Button
                key={status}
                variant={selectedMission.status === status ? "default" : "outline"}
                onClick={() => handleSetStatus(status)}
                disabled={!canManage || selectedMission.status === status || saving === `status-${status}`}
              >
                {saving === `status-${status}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status}
              </Button>
            ))}
            <p className="text-xs text-muted-foreground">
              Status sekarang: <span className="font-semibold">{selectedMission.status}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── OPTIONS ───────────────────────────────────────────────────── */}
      {selectedMission && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Mission Options</CardTitle>
              <CardDescription>
                Maximum {maxActiveOptions} active options. Numbers (01–04) are derived from the order on the public page.
              </CardDescription>
            </div>
            <Button onClick={addOption} disabled={!canManage} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Option
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <p className="text-sm font-medium">
              Active options: <span className={activeOptionCount > maxActiveOptions ? "text-red-600" : ""}>{activeOptionCount} / {maxActiveOptions}</span>
              {activeOptionCount > maxActiveOptions && " — too many, deactivate some before saving."}
            </p>
            {options.map((option, index) => (
              <div key={option.id ?? index} className="flex flex-col gap-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-muted-foreground">
                    {String(option.displayOrder || index + 1).padStart(2, "0")} · {option.title || `Option ${index + 1}`}
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    Active
                    <Switch
                      checked={option.isActive}
                      disabled={!canManage}
                      onCheckedChange={(checked) => updateOption(index, "isActive", checked)}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`option-${index}-title`}>Title</Label>
                    <Input
                      id={`option-${index}-title`}
                      value={option.title}
                      disabled={!canManage}
                      onChange={(event) => updateOption(index, "title", event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`option-${index}-order`}>Order</Label>
                    <Input
                      id={`option-${index}-order`}
                      type="number"
                      min={1}
                      value={option.displayOrder}
                      disabled={!canManage}
                      onChange={(event) => updateOption(index, "displayOrder", Number(event.target.value))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`option-${index}-description`}>Description</Label>
                  <Input
                    id={`option-${index}-description`}
                    value={option.description}
                    disabled={!canManage}
                    onChange={(event) => updateOption(index, "description", event.target.value)}
                  />
                </div>
                <ImageUploadField
                  label="Image"
                  value={option.image}
                  fieldKey={`option-${index + 1}`}
                  uploading={uploadingField === `option-${index + 1}`}
                  disabled={!canManage}
                  onChange={(url) => updateOption(index, "image", url)}
                  onUpload={(file) =>
                    handleUpload(file, `option-${index + 1}`, (url) => updateOption(index, "image", url))
                  }
                />
              </div>
            ))}
            <div>
              <Button onClick={handleSaveOptions} disabled={!canManage || saving === "options"}>
                {saving === "options" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Options
              </Button>
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
