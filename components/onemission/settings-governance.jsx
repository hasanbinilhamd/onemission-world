"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Edit3,
  History,
  KeyRound,
  Laptop,
  Plus,
  Power,
  Search,
  Settings as SettingsIcon,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const settingsApi = {
  async get(path) {
    const response = await fetch(`/api/${path}`);
    return response.json();
  },
  async post(path, body) {
    const response = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function permissionAllowed(user, moduleKey, actionKey) {
  const permissions = Array.isArray(user?.permissionKeys) ? user.permissionKeys : [];
  if (permissions.includes("*")) return true;
  return permissions.includes(`${moduleKey}:${actionKey}`);
}

function statusBadge(status) {
  return (
    <Badge
      variant="outline"
      className={status === "Active" ? "border-emerald-500/40 text-emerald-500" : "border-gray-400/40 text-gray-500"}
    >
      {status}
    </Badge>
  );
}

function UserFormDialog({ open, onOpenChange, initial, roles, onSave, loading = false }) {
  const empty = {
    name: "",
    email: "",
    role: roles[0]?.name || "Super Admin",
    avatar: "",
    status: "Active",
    password: "",
  };
  const [form, setForm] = useState(empty);
  const isEdit = !!initial?.id;

  useEffect(() => {
    setForm(initial ? { ...empty, ...initial, password: "" } : { ...empty, role: roles[0]?.name || "Super Admin" });
  }, [initial, open, roles]);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.role) {
      toast.error("Name, email, and role are required.");
      return;
    }
    if (!isEdit && !form.password.trim()) {
      toast.error("Password is required for a new user.");
      return;
    }
    await onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "New User"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this HQ user account." : "Create a new HQ user account."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name || ""} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email || ""} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role || ""} onValueChange={(value) => setForm((current) => ({ ...current, role: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || "Active"} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Avatar</Label>
            <Input value={form.avatar || ""} onChange={(e) => setForm((current) => ({ ...current, avatar: e.target.value }))} placeholder="e.g. SA" maxLength={4} />
          </div>
          {!isEdit ? (
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={form.password || ""} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Saving…" : isEdit ? "Save Changes" : "Create User"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ open, onOpenChange, user, onReset, loading = false }) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Reset the password for {user?.email || "this user"}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={() => onReset(password)} disabled={loading}>{loading ? "Resetting…" : "Reset Password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserViewDialog({ open, onOpenChange, user, sessions, onForceLogoutSession, onForceLogoutAll }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user?.name || "User Detail"}</DialogTitle>
          <DialogDescription>Review profile and active sessions.</DialogDescription>
        </DialogHeader>
        {user ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="font-medium mt-1">{user.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Role</p>
                <p className="font-medium mt-1">{user.role}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                <div className="mt-1">{statusBadge(user.status)}</div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Login</p>
                <p className="font-medium mt-1">{formatDateTime(user.lastLoginAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Created At</p>
                <p className="font-medium mt-1">{formatDateTime(user.createdAt)}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Current Active Sessions</h3>
                  <p className="text-xs text-muted-foreground mt-1">Device, browser, IP, and last activity.</p>
                </div>
                <Button variant="outline" size="sm" onClick={onForceLogoutAll}>
                  Force Logout All
                </Button>
              </div>
              <div className="space-y-2">
                {sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active sessions.</p>
                ) : sessions.map((session) => (
                  <div key={session.id} className="rounded-xl border border-border/60 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Laptop className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{session.device || "Unknown Device"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{session.browser || "Unknown Browser"} · {session.ipAddress || "Unknown IP"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Last activity: {formatDateTime(session.lastActivityAt)}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onForceLogoutSession(session.id)}>
                        Force Logout
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function UsersSettingsModule({ user }) {
  const [items, setItems] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showReset, setShowReset] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const canManageUsers = permissionAllowed(user, "settings", "manage_users");

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const [usersResponse, rolesResponse] = await Promise.all([
      settingsApi.get(`users?${params.toString()}`),
      settingsApi.get("roles"),
    ]);
    setItems(Array.isArray(usersResponse) ? usersResponse : []);
    setRoles(Array.isArray(rolesResponse?.roles) ? rolesResponse.roles : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [search, roleFilter, statusFilter]);

  const openView = async (selectedUser) => {
    const result = await settingsApi.get(`users/${selectedUser.id}/sessions`);
    setViewing(selectedUser);
    setSessions(Array.isArray(result) ? result : []);
  };

  const saveUser = async (form) => {
    setSubmitting(true);
    const result = editing?.id
      ? await settingsApi.put(`users/${editing.id}`, form)
      : await settingsApi.post("users", form);
    setSubmitting(false);
    if (result?.error) {
      toast.error(result.error || "Failed to save user.");
      return;
    }
    toast.success(editing?.id ? "User updated." : "User created.");
    setShowForm(false);
    setEditing(null);
    load();
  };

  const resetPassword = async (password) => {
    setResettingPassword(true);
    const result = await settingsApi.post(`users/${viewing.id}/reset-password`, { password });
    setResettingPassword(false);
    if (result?.error) {
      toast.error(result.error || "Failed to reset password.");
      return;
    }
    toast.success("Password reset successfully.");
    setShowReset(false);
  };

  const updateUserStatus = async (selectedUser, status) => {
    const result = await settingsApi.put(`users/${selectedUser.id}`, { status });
    if (result?.error) {
      toast.error(result.error || "Failed to update user status.");
      return;
    }
    toast.success(status === "Active" ? "User activated." : "User deactivated.");
    load();
    if (viewing?.id === selectedUser.id) {
      setViewing((current) => current ? { ...current, status } : current);
    }
  };

  const forceLogoutAll = async (selectedUser) => {
    const result = await settingsApi.post(`users/${selectedUser.id}/force-logout`, {});
    if (result?.error) {
      toast.error(result.error || "Failed to force logout sessions.");
      return;
    }
    toast.success("Active sessions invalidated.");
    openView(selectedUser);
    load();
  };

  const forceLogoutSession = async (sessionId) => {
    const result = await settingsApi.post(`users/${viewing.id}/sessions/${sessionId}/force-logout`, {});
    if (result?.error) {
      toast.error(result.error || "Failed to force logout this session.");
      return;
    }
    toast.success("Session logged out.");
    openView(viewing);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Users</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Manage user access, account status, and HQ sessions.</p>
        </div>
        {canManageUsers ? (
          <Button className="gap-2" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> New User
          </Button>
        ) : null}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <Label>Search</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, or role…" />
              </div>
            </div>
            <div className="min-w-[180px]">
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map((role) => <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead>
                <tr className="border-b border-border bg-[#F7F8FA]">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Active Sessions</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading users…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No users found.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.role}</td>
                    <td className="px-4 py-3">{statusBadge(item.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.activeSessionCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(item)} title="View">
                          <Users className="h-4 w-4" />
                        </Button>
                        {canManageUsers ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(item); setShowForm(true); }} title="Edit">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewing(item); setShowReset(true); }} title="Reset Password">
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => forceLogoutAll(item)} title="Force Logout">
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => updateUserStatus(item, item.status === "Active" ? "Inactive" : "Active")}>
                              {item.status === "Active" ? "Deactivate" : "Activate"}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <UserFormDialog open={showForm} onOpenChange={setShowForm} initial={editing} roles={roles} onSave={saveUser} loading={submitting} />
      <UserViewDialog
        open={!!viewing}
        onOpenChange={(value) => !value && setViewing(null)}
        user={viewing}
        sessions={sessions}
        onForceLogoutSession={forceLogoutSession}
        onForceLogoutAll={() => forceLogoutAll(viewing)}
      />
      <ResetPasswordDialog open={showReset} onOpenChange={setShowReset} user={viewing} onReset={resetPassword} loading={resettingPassword} />
    </div>
  );
}

export function RolesPermissionsSettingsModule({ user }) {
  const [roles, setRoles] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRoleMeta, setSavingRoleMeta] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [draftPermissions, setDraftPermissions] = useState({});
  const [roleForm, setRoleForm] = useState({ name: "", description: "", status: "Active" });
  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "", status: "Active" });
  const canManageRoles = permissionAllowed(user, "settings", "manage_roles");

  const load = async () => {
    setLoading(true);
    const result = await settingsApi.get("roles");
    setRoles(Array.isArray(result?.roles) ? result.roles : []);
    setMatrix(Array.isArray(result?.matrix) ? result.matrix : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

  useEffect(() => {
    if (!selectedRole) return;
    const nextDraft = {};
    for (const permission of selectedRole.permissions || []) {
      nextDraft[`${permission.moduleKey}:${permission.actionKey}`] = true;
    }
    setDraftPermissions(nextDraft);
    setRoleForm({
      name: selectedRole.name || "",
      description: selectedRole.description || "",
      status: selectedRole.status || "Active",
    });
  }, [selectedRole]);

  const togglePermission = (moduleKey, actionKey) => {
    const permissionKey = `${moduleKey}:${actionKey}`;
    setDraftPermissions((current) => ({
      ...current,
      [permissionKey]: !current[permissionKey],
    }));
  };

  const buildPermissionPayload = () => Object.entries(draftPermissions)
    .filter(([, allowed]) => allowed)
    .map(([key]) => {
      const [moduleKey, actionKey] = key.split(":");
      return { moduleKey, actionKey, isAllowed: true };
    });

  const saveRoleMeta = async () => {
    if (!selectedRole) return;
    if (!roleForm.name.trim()) {
      toast.error("Role name is required.");
      return;
    }

    setSavingRoleMeta(true);
    const result = await settingsApi.put(`roles/${selectedRole.id}`, {
      name: roleForm.name,
      description: roleForm.description,
      status: roleForm.status,
      permissions: buildPermissionPayload(),
    });
    setSavingRoleMeta(false);

    if (result?.error) {
      toast.error(result.error || "Failed to save role.");
      return;
    }
    toast.success("Role details updated.");
    load();
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSavingPermissions(true);
    const result = await settingsApi.put(`roles/${selectedRole.id}`, {
      name: roleForm.name,
      description: roleForm.description,
      status: roleForm.status,
      permissions: buildPermissionPayload(),
    });
    setSavingPermissions(false);
    if (result?.error) {
      toast.error(result.error || "Failed to save role permissions.");
      return;
    }
    toast.success("Role permissions updated.");
    load();
  };

  const createRole = async () => {
    if (!newRole.name.trim()) {
      toast.error("Role name is required.");
      return;
    }
    setCreatingRole(true);
    const result = await settingsApi.post("roles", newRole);
    setCreatingRole(false);
    if (result?.error) {
      toast.error(result.error || "Failed to create role.");
      return;
    }
    toast.success("Role created.");
    setShowCreate(false);
    setNewRole({ name: "", description: "", status: "Active" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Roles & Permissions</h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Maintain a permission matrix enforced by the backend.</p>
        </div>
        {canManageRoles ? <Button className="gap-2" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Role</Button> : null}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
            <CardDescription>Select a role to edit its matrix.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading roles…</p> : roles.map((role) => (
              <button key={role.id} type="button" onClick={() => setSelectedRoleId(role.id)} className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${selectedRoleId === role.id ? "border-blue-500 bg-blue-500/5" : "border-border hover:bg-[#F7F8FA]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{role.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{role.description || "No description"}</p>
                  </div>
                  {statusBadge(role.status)}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permission Matrix</CardTitle>
            <CardDescription>Module + action permissions checked on backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRole ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5 md:col-span-1">
                    <Label>Role Name</Label>
                    <Input
                      value={roleForm.name}
                      disabled={!canManageRoles || savingRoleMeta}
                      onChange={(e) => setRoleForm((current) => ({ ...current, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={roleForm.description || ""}
                      disabled={!canManageRoles || savingRoleMeta}
                      onChange={(e) => setRoleForm((current) => ({ ...current, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={roleForm.status} onValueChange={(value) => setRoleForm((current) => ({ ...current, status: value }))}>
                      <SelectTrigger disabled={!canManageRoles || savingRoleMeta}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                  {matrix.map((module) => (
                    <div key={module.moduleKey} className="rounded-xl border border-border/60 overflow-hidden">
                      <div className="bg-[#F7F8FA] px-4 py-3 border-b border-border/60">
                        <p className="font-semibold">{module.label}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                        {module.actions.map((action) => {
                          const permissionKey = `${module.moduleKey}:${action.key}`;
                          return (
                            <label key={permissionKey} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30 md:nth-[2n]:border-l md:last:border-b-0">
                              <span className="text-sm font-medium">{action.label}</span>
                              <Switch disabled={!canManageRoles} checked={Boolean(draftPermissions[permissionKey])} onCheckedChange={() => togglePermission(module.moduleKey, action.key)} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {canManageRoles ? (
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={saveRoleMeta} disabled={savingRoleMeta || savingPermissions}>
                      {savingRoleMeta ? "Saving…" : "Save Role Details"}
                    </Button>
                    <Button onClick={savePermissions} disabled={savingPermissions || savingRoleMeta}>
                      {savingPermissions ? "Saving…" : "Save Permission Matrix"}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No role selected.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Role</DialogTitle>
            <DialogDescription>Create a new role before assigning permissions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input value={newRole.name} onChange={(e) => setNewRole((current) => ({ ...current, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={newRole.description} onChange={(e) => setNewRole((current) => ({ ...current, description: e.target.value }))} rows={3} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={newRole.status} onValueChange={(value) => setNewRole((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creatingRole}>Cancel</Button>
            <Button onClick={createRole} disabled={creatingRole}>{creatingRole ? "Creating…" : "Create Role"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NotificationSettingsModule({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canManage = permissionAllowed(user, "settings", "manage_notifications");

  const load = async () => {
    setLoading(true);
    const result = await settingsApi.get("notification-settings");
    setItems(Array.isArray(result) ? result : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => ({
    email_customer: items.filter((item) => item.category === "email_customer"),
    internal: items.filter((item) => item.category === "internal"),
  }), [items]);

  const save = async () => {
    setSaving(true);
    const result = await settingsApi.put("notification-settings", { settings: items });
    setSaving(false);
    if (result?.error) {
      toast.error(result.error || "Failed to save notification settings.");
      return;
    }
    toast.success("Notification settings updated.");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">Notification Settings</h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Control customer and internal notifications used by the ERP.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading notification settings…</p> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Email Notification</CardTitle>
              <CardDescription>Customer-facing order notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {grouped.email_customer.map((setting) => (
                <div key={setting.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{setting.label}</p>
                    <p className="text-xs text-muted-foreground">Customer event</p>
                  </div>
                  <Switch disabled={!canManage} checked={Boolean(setting.isEnabled)} onCheckedChange={(value) => setItems((current) => current.map((item) => item.id === setting.id ? { ...item, isEnabled: value } : item))} />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Internal Notification</CardTitle>
              <CardDescription>Internal operational alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {grouped.internal.map((setting) => (
                <div key={setting.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{setting.label}</p>
                    <p className="text-xs text-muted-foreground">Internal event</p>
                  </div>
                  <Switch disabled={!canManage} checked={Boolean(setting.isEnabled)} onCheckedChange={(value) => setItems((current) => current.map((item) => item.id === setting.id ? { ...item, isEnabled: value } : item))} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      {canManage ? <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Notification Settings"}</Button></div> : null}
    </div>
  );
}

function normalizeSettingValue(setting) {
  if (setting.valueType === "boolean") {
    return String(setting.value).toLowerCase() === "true";
  }
  return setting.value;
}

function settingsBySection(settings) {
  return settings.reduce((map, setting) => {
    if (!map[setting.section]) map[setting.section] = [];
    map[setting.section].push(setting);
    return map;
  }, {});
}

export function SystemConfigurationModule({ user }) {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditModuleFilter, setAuditModuleFilter] = useState("all");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const canManage = permissionAllowed(user, "settings", "manage_configuration");
  const canViewAudit = permissionAllowed(user, "settings", "view_audit");

  const load = async () => {
    setLoading(true);
    const result = await settingsApi.get("system-settings");
    setItems(Array.isArray(result) ? result.map((item) => ({ ...item, draftValue: normalizeSettingValue(item) })) : []);
    setLoading(false);
  };

  const loadAuditLogs = async () => {
    if (!canViewAudit) return;
    setAuditLoading(true);
    const params = new URLSearchParams();
    if (auditSearch) params.set("search", auditSearch);
    if (auditModuleFilter !== "all") params.set("module", auditModuleFilter);
    if (auditActionFilter !== "all") params.set("action", auditActionFilter);
    const result = await settingsApi.get(`audit-logs?${params.toString()}`);
    setLogs(Array.isArray(result) ? result : []);
    setAuditLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadAuditLogs();
  }, [auditSearch, auditModuleFilter, auditActionFilter]);

  const sectionMap = useMemo(() => settingsBySection(items), [items]);

  const updateSetting = (id, value) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, draftValue: value } : item));
  };

  const save = async () => {
    const payload = {
      settings: items.map((item) => ({ id: item.id, value: item.valueType === "boolean" ? String(Boolean(item.draftValue)) : String(item.draftValue ?? "") })),
    };
    setSaving(true);
    const result = await settingsApi.put("system-settings", payload);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error || "Failed to save system configuration.");
      return;
    }
    toast.success("System configuration updated.");
    load();
  };

  const renderSettingField = (setting) => {
    if (setting.valueType === "boolean") {
      return <Switch disabled={!canManage} checked={Boolean(setting.draftValue)} onCheckedChange={(value) => updateSetting(setting.id, value)} />;
    }

    const multiline = setting.description.toLowerCase().includes("description");
    if (multiline) {
      return <Textarea disabled={!canManage} value={setting.draftValue || ""} onChange={(e) => updateSetting(setting.id, e.target.value)} rows={2} />;
    }

    return <Input disabled={!canManage} value={setting.draftValue || ""} onChange={(e) => updateSetting(setting.id, e.target.value)} />;
  };

  const sectionMeta = {
    general: { title: "General", icon: SettingsIcon },
    order: { title: "Order", icon: Shield },
    inventory: { title: "Inventory", icon: SettingsIcon },
    production: { title: "Production", icon: SettingsIcon },
    security: { title: "Security", icon: Shield },
  };

  const moduleOptions = ["all", ...Array.from(new Set(logs.map((log) => log.module))).filter(Boolean)];
  const actionOptions = ["all", ...Array.from(new Set(logs.map((log) => log.action))).filter(Boolean)];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">System Configuration</h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">Global ERP configuration, security defaults, and administrator audit trail.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Loading system configuration…</p> : (
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            {Object.entries(sectionMeta).map(([key, meta]) => (
              <TabsTrigger key={key} value={key}>{meta.title}</TabsTrigger>
            ))}
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>
          {Object.entries(sectionMeta).map(([key, meta]) => (
            <TabsContent key={key} value={key} className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><meta.icon className="h-4 w-4" /> {meta.title}</CardTitle>
                  <CardDescription>{meta.title} system settings stored in the database.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(sectionMap[key] || []).map((setting) => (
                    <div key={setting.id} className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-4 items-center border-b border-border/40 pb-4 last:border-0 last:pb-0">
                      <div>
                        <Label>{setting.label}</Label>
                        <p className="text-xs text-muted-foreground mt-1">{setting.description}</p>
                      </div>
                      <div>{renderSettingField(setting)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
          <TabsContent value="audit" className="space-y-4 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Audit Log</CardTitle>
                <CardDescription>Administrative and operational system audit trail.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canViewAudit ? (
                  <p className="text-sm text-muted-foreground">You do not have access to audit logs.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex-1 min-w-[220px]">
                        <Label>Search</Label>
                        <div className="relative mt-1.5">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-9" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} placeholder="Search action, module, description…" />
                        </div>
                      </div>
                      <div className="min-w-[180px]">
                        <Label>Module</Label>
                        <Select value={auditModuleFilter} onValueChange={setAuditModuleFilter}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>{moduleOptions.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "All Modules" : item}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="min-w-[200px]">
                        <Label>Action</Label>
                        <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>{actionOptions.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "All Actions" : item}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <ScrollArea className="h-[520px]">
                        <table className="w-full text-sm min-w-[860px]">
                          <thead>
                            <tr className="border-b border-border bg-[#F7F8FA] sticky top-0">
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Module</th>
                              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLoading ? (
                              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading audit log…</td></tr>
                            ) : logs.length === 0 ? (
                              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No audit records found.</td></tr>
                            ) : logs.map((log) => (
                              <tr key={log.id} className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors">
                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                                <td className="px-4 py-3 font-medium">{log.userName || log.user?.name || "System"}</td>
                                <td className="px-4 py-3"><Badge variant="outline">{log.action}</Badge></td>
                                <td className="px-4 py-3">{log.module}</td>
                                <td className="px-4 py-3 text-muted-foreground">{log.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      {canManage ? <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save System Configuration"}</Button></div> : null}
    </div>
  );
}
