"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
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
  async generatePassword() {
    return readResponse(await fetch("/api/admin/early-access", { method: "POST" }));
  },
};

export function EarlyAccessModule() {
  const [config, setConfig] = useState({ enabled: false, chapter: "CHAPTER 01", hasPassword: false, revision: "" });
  const [chapterDraft, setChapterDraft] = useState("CHAPTER 01");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await earlyAccessApi.get();
      setConfig(response);
      setChapterDraft(response.chapter || "CHAPTER 01");
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
      const response = await earlyAccessApi.update({ enabled: nextEnabled, chapter: chapterDraft });
      setConfig(response);
      setChapterDraft(response.chapter || "CHAPTER 01");
      setGeneratedPassword("");
      toast.success("Early Access settings updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Early Access settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const generatePassword = async () => {
    setGenerating(true);
    try {
      const response = await earlyAccessApi.generatePassword();
      setConfig(response);
      setChapterDraft(response.chapter || "CHAPTER 01");
      setGeneratedPassword(response.password || "");
      toast.success("New Early Access password generated. Copy it now — it will not be shown again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Early Access password could not be generated.");
    } finally {
      setGenerating(false);
    }
  };

  const copyPassword = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      toast.success("Password copied.");
    } catch {
      toast.error("Password could not be copied automatically.");
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
                  <p className="font-medium text-foreground">Early Access Gate</p>
                  <p className="text-sm text-muted-foreground">When enabled, Ecommerce requires the current chapter password.</p>
                </div>
                <Button
                  variant={config.enabled ? "outline" : "default"}
                  onClick={() => void saveConfig(!config.enabled)}
                  disabled={saving}
                >
                  {config.enabled ? "Disabled" : "Enabled"}
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="early-access-chapter">Chapter</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="early-access-chapter" value={chapterDraft} onChange={(event) => setChapterDraft(event.target.value)} placeholder="CHAPTER 01" />
                  <Button onClick={() => void saveConfig(config.enabled)} disabled={saving || !chapterDraft.trim()}>
                    Save Chapter
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Changing chapter invalidates existing Early Access sessions.</p>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">Password</p>
                    <p className="text-sm text-muted-foreground">Stored as bcrypt hash. Plaintext is shown only immediately after generation.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Current password configured: {config.hasPassword ? "Yes" : "No"}</p>
                  </div>
                  <Button className="gap-2" onClick={() => void generatePassword()} disabled={generating}>
                    <KeyRound className="h-4 w-4" />
                    {generating ? "Generating..." : "Generate New Password"}
                  </Button>
                </div>

                {generatedPassword ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Copy now — this password will not be shown again</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input readOnly value={generatedPassword} className="font-mono" />
                      <Button variant="outline" className="gap-2" onClick={() => void copyPassword()}>
                        <Copy className="h-4 w-4" /> Copy
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
