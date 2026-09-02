"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * PageAvailabilityControl — shared CMS control for section visibility.
 *
 * Used by the Mission, Impact, and Donate CMS modules. Persists to the
 * backend (single source of truth) through the shared admin endpoint:
 * GET/PUT /api/admin/movement/page-availability?page=...
 *
 * AVAILABLE     → public section renders normally
 * COMING_SOON   → public section shows the Coming Soon page
 */
export function PageAvailabilityControl({ page, user }) {
  const canManage = user?.permissionKeys?.includes("*")
    || user?.permissionKeys?.includes("settings:manage_configuration");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState("AVAILABLE");

  useEffect(() => {
    let isActive = true;
    fetch(`/api/admin/movement/page-availability?page=${encodeURIComponent(page)}`)
      .then((response) => response.json())
      .then((result) => {
        if (!isActive) return;
        if (result?.error) {
          toast.error(result.error || "Failed to load page availability.");
          return;
        }
        setAvailability(result.availability || "AVAILABLE");
      })
      .catch(() => {
        if (isActive) toast.error("Failed to load page availability.");
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [page]);

  const handleSave = async (nextAvailability) => {
    if (saving || nextAvailability === availability) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/movement/page-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, availability: nextAvailability }),
      });
      const result = await response.json();
      if (result?.error) {
        toast.error(result.error || "Failed to update page availability.");
        return;
      }
      setAvailability(result.availability);
      toast.success(`Page availability changed to ${result.availability}.`);
    } catch {
      toast.error("Failed to update page availability.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading page availability…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Page Availability</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={availability === "AVAILABLE" ? "default" : "outline"}
          disabled={!canManage || saving}
          onClick={() => handleSave("AVAILABLE")}
        >
          Available
        </Button>
        <Button
          variant={availability === "COMING_SOON" ? "default" : "outline"}
          disabled={!canManage || saving}
          onClick={() => handleSave("COMING_SOON")}
        >
          Coming Soon
        </Button>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Controls whether this entire section is publicly accessible. Content remains editable while Coming Soon.
      </p>
    </div>
  );
}
