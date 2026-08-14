"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Early Access request failed.");
  return payload;
}

const earlyAccessApi = {
  async get() {
    return readResponse(await fetch("/api/admin/early-access"));
  },
  async update(payload) {
    return readResponse(await fetch("/api/admin/early-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
  },
};

export function EarlyAccessModule() {
  const [config, setConfig] = useState({ enabled: false, chapter: "CHAPTER 01", hasPassword: false, revision: "" });
  const [chapterDraft, setChapterDraft] = useState("CHAPTER 01");
  const [accessPassword, setAccessPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await earlyAccessApi.get();
      setConfig(response);
      setChapterDraft(response.chapter || "CHAPTER 01");
      setAccessPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Early Access settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async (nextEnabled = config.enabled) => {
    setSaving(true);
    try {
      const response = await earlyAccessApi.update({
        enabled: nextEnabled,
        chapter: chapterDraft,
        password: accessPassword,
      });
      setConfig(response);
      setChapterDraft(response.chapter || "CHAPTER 01");
      setAccessPassword("");
      toast.success("Early Access settings updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Early Access settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Early Access</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Control global chapter access for the Ecommerce storefront.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()} title="Refresh Early Access">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Settings are stored in SystemSetting and used by Ecommerce before storefront data is exposed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading Early Access settings…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium text-foreground">Enabled</p>
                  <p className="text-sm text-muted-foreground">When enabled, Ecommerce requires the current chapter password.</p>
                </div>
                <Button
                  variant={config.enabled ? "default" : "outline"}
                  onClick={() => setConfig((current) => ({ ...current, enabled: !current.enabled }))}
                  disabled={saving}
                >
                  {config.enabled ? "ON" : "OFF"}
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="early-access-chapter">Chapter</Label>
                <Input id="early-access-chapter" value={chapterDraft} onChange={(event) => setChapterDraft(event.target.value)} placeholder="CHAPTER 01" />
                <p className="text-xs text-muted-foreground">Changing chapter invalidates existing Early Access sessions.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="early-access-password">Access Password</Label>
                <Input
                  id="early-access-password"
                  type="password"
                  value={accessPassword}
                  onChange={(event) => setAccessPassword(event.target.value)}
                  placeholder={config.hasPassword ? "Leave blank to keep current password" : "Enter access password"}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">Password is stored as bcrypt hash and is never returned by the API. Minimum 4 characters.</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void saveConfig(config.enabled)} disabled={saving || !chapterDraft.trim()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
