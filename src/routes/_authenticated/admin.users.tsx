// Admin user management — view all users, grant/revoke moderator and admin roles,
// AI-assisted role suggestions, and email notification on every role change.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, Search, Shield, ShieldCheck, User as UserIcon, Sparkles, Loader2, Mail, Ban, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin } from "@/lib/auth-store";
import { AvatarDisplay } from "@/components/avatar-display";
import { suggestUserRole, listAdminUsers, setUserBanned } from "@/lib/admin-ai.functions";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "User management — CivicLens AI" }] }),
  component: AdminUsersPage,
});

type Role = "user" | "moderator" | "admin";

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role: Role;
  points: number;
  reports_total: number;
  reports_resolved: number;
  banned: boolean;
  banned_until: string | null;
}

interface Suggestion {
  suggested: Role;
  confidence: number;
  stats: { total: number; verified: number; rejected: number; accuracy: number; comments: number; ageDays: number };
  reasons: string[];
  aiReason: string | null;
}

async function sendRoleChangeEmail(input: {
  email: string;
  name: string | null;
  newRole: Role;
  grantedBy: string | null;
}) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    const res = await fetch("/lovable/email/transactional/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        templateName: "role-changed",
        recipientEmail: input.email,
        idempotencyKey: `role-${input.email}-${input.newRole}-${Date.now()}`,
        templateData: {
          recipientName: input.name ?? undefined,
          newRole: input.newRole,
          grantedBy: input.grantedBy ?? undefined,
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn("Role email send failed", res.status, t);
    }
  } catch (e) {
    console.warn("Role email exception", e);
  }
}

function AdminUsersPage() {
  const isAdmin = useIsAdmin();
  const initialized = useAuthStore((s) => s.initialized);
  const role = useAuthStore((s) => s.role);
  const me = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [suggestionFor, setSuggestionFor] = useState<UserRow | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const suggestFn = useServerFn(suggestUserRole);
  const listUsersFn = useServerFn(listAdminUsers);
  const banFn = useServerFn(setUserBanned);
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [banPending, setBanPending] = useState(false);

  useEffect(() => {
    if (initialized && role !== null && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [initialized, role, isAdmin, navigate]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserRow[]> => {
      const rows = await listUsersFn();
      return rows as UserRow[];
    },
    enabled: isAdmin,
  });

  const suggestMutation = useMutation({
    mutationFn: async (userId: string) => suggestFn({ data: { userId } }),
    onSuccess: (data) => setSuggestion(data as Suggestion),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return null;

  const openSuggest = (u: UserRow) => {
    setSuggestionFor(u);
    setSuggestion(null);
    suggestMutation.mutate(u.id);
  };

  const setRole = async (user: UserRow, newRole: Role) => {
    if (user.id === me?.id && newRole !== "admin") {
      toast.error("You cannot remove your own admin role.");
      return;
    }
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", user.id);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    const { error: insErr } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: newRole });
    if (insErr) {
      toast.error(insErr.message);
      return;
    }
    if (me?.id) {
      await supabase.from("audit_logs").insert({
        user_id: me.id,
        action: "user.role_change",
        entity_type: "user",
        entity_id: user.id,
        details: { to: newRole },
      });
    }
    toast.success(`Role updated to ${newRole}`);
    void qc.invalidateQueries({ queryKey: ["admin-users"] });

    // Fire-and-forget email notification
    if (user.email) {
      void sendRoleChangeEmail({
        email: user.email,
        name: user.display_name,
        newRole,
        grantedBy: me?.email ?? null,
      }).then(() => {
        toast.message("Notification email queued", {
          description: `${user.email} will receive a role update email.`,
        });
      });
    }
  };

  const filtered = users.filter((u) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.display_name ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground" onClick={() => navigate({ to: "/admin" })}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Users className="h-5 w-5 text-accent" />
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            User management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Grant roles, run AI role suggestions, and send automatic email notifications.
          </p>
        </div>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by email or name"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-12 gap-3 border-b border-border bg-secondary/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
          <div className="col-span-3">User</div>
          <div className="col-span-2">Joined</div>
          <div className="col-span-2">Activity</div>
          <div className="col-span-1">Role</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading users…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">No users found.</div>
          )}
          {filtered.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-1 items-center gap-3 px-4 py-3 text-sm sm:grid-cols-12"
            >
              <div className="flex min-w-0 items-center gap-2.5 sm:col-span-3">
                <AvatarDisplay
                  userId={u.id}
                  name={u.display_name}
                  email={u.email}
                  avatarUrl={u.avatar_url}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">{u.display_name ?? u.email ?? "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground sm:col-span-2">
                {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {u.reports_total} rpt
                </Badge>
                <Badge
                  variant="outline"
                  className="border-success/30 bg-success/10 font-mono text-[10px] uppercase text-success"
                >
                  {u.reports_resolved} ✓
                </Badge>
                <Badge
                  variant="outline"
                  className="border-accent/30 bg-accent/10 font-mono text-[10px] uppercase text-accent"
                >
                  {u.points} pts
                </Badge>
              </div>
              <div className="sm:col-span-1">
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] uppercase ${
                    u.role === "admin"
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : u.role === "moderator"
                        ? "border-info/40 bg-info/10 text-info"
                        : ""
                  }`}
                >
                  {u.role}
                </Badge>
                {u.banned && (
                  <Badge variant="outline" className="ml-1 border-destructive/40 bg-destructive/10 font-mono text-[10px] uppercase text-destructive">
                    banned
                  </Badge>
                )}
                {u.id === me?.id && (
                  <div className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">(you)</div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-1 sm:col-span-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => openSuggest(u)}
                >
                  <Sparkles className="h-3 w-3" /> AI suggest
                </Button>
                <Button
                  size="sm"
                  variant={u.role === "user" ? "default" : "outline"}
                  className="h-7 gap-1 text-xs"
                  disabled={u.role === "user" || u.id === me?.id}
                  onClick={() => setRole(u, "user")}
                >
                  <UserIcon className="h-3 w-3" /> User
                </Button>
                <Button
                  size="sm"
                  variant={u.role === "moderator" ? "default" : "outline"}
                  className="h-7 gap-1 text-xs"
                  disabled={u.role === "moderator" || u.id === me?.id}
                  onClick={() => setRole(u, "moderator")}
                >
                  <Shield className="h-3 w-3" /> Mod
                </Button>
                <Button
                  size="sm"
                  variant={u.role === "admin" ? "default" : "outline"}
                  className="h-7 gap-1 text-xs"
                  disabled={u.role === "admin"}
                  onClick={() => setRole(u, "admin")}
                >
                  <ShieldCheck className="h-3 w-3" /> Admin
                </Button>
                {u.banned ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-success/40 text-xs text-success hover:bg-success/10"
                    disabled={u.id === me?.id}
                    onClick={() => setBanTarget(u)}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Unban
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                    disabled={u.id === me?.id || u.role === "admin"}
                    onClick={() => setBanTarget(u)}
                  >
                    <Ban className="h-3 w-3" /> Ban
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog
        open={!!suggestionFor}
        onOpenChange={(o) => {
          if (!o) {
            setSuggestionFor(null);
            setSuggestion(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              AI role suggestion
            </DialogTitle>
            <DialogDescription>
              {suggestionFor?.display_name ?? suggestionFor?.email}
            </DialogDescription>
          </DialogHeader>

          {suggestMutation.isPending || !suggestion ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing user activity…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-secondary/40 p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Recommended role
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <Badge
                    className={`font-mono text-xs uppercase ${
                      suggestion.suggested === "admin"
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : suggestion.suggested === "moderator"
                          ? "border-info/40 bg-info/10 text-info"
                          : ""
                    }`}
                    variant="outline"
                  >
                    {suggestion.suggested}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    Confidence: <span className="font-medium text-foreground">{suggestion.confidence}%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="Reports" value={suggestion.stats.total} />
                <Stat label="Verified" value={suggestion.stats.verified} />
                <Stat label="Accuracy" value={`${suggestion.stats.accuracy}%`} />
                <Stat label="Rejected" value={suggestion.stats.rejected} />
                <Stat label="Comments" value={suggestion.stats.comments} />
                <Stat label="Days" value={suggestion.stats.ageDays} />
              </div>

              {suggestion.aiReason && (
                <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-xs">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-accent">
                    AI reasoning
                  </div>
                  <p className="mt-1 text-foreground">{suggestion.aiReason}</p>
                </div>
              )}

              {suggestion.reasons.length > 0 && (
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {suggestion.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-1 rounded-md border border-dashed border-border p-2 text-[11px] text-muted-foreground">
                <Mail className="h-3 w-3" />
                The user will receive an email when you apply this role.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSuggestionFor(null);
                setSuggestion(null);
              }}
            >
              Close
            </Button>
            <Button
              disabled={!suggestion || !suggestionFor || suggestion.suggested === suggestionFor.role}
              onClick={async () => {
                if (!suggestion || !suggestionFor) return;
                const u = suggestionFor;
                setSuggestionFor(null);
                setSuggestion(null);
                await setRole(u, suggestion.suggested);
              }}
            >
              Apply {suggestion?.suggested ?? "role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!banTarget} onOpenChange={(o) => !o && !banPending && setBanTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {banTarget?.banned ? (
                <><CheckCircle2 className="h-4 w-4 text-success" /> Unban user</>
              ) : (
                <><Ban className="h-4 w-4 text-destructive" /> Ban user</>
              )}
            </DialogTitle>
            <DialogDescription>
              {banTarget?.banned
                ? `Restore access for ${banTarget?.display_name ?? banTarget?.email}? They will be able to sign in and submit reports again.`
                : `Block ${banTarget?.display_name ?? banTarget?.email} from signing in or using the platform. Their existing reports stay visible.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={banPending} onClick={() => setBanTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={banTarget?.banned ? "default" : "destructive"}
              disabled={banPending}
              onClick={async () => {
                if (!banTarget) return;
                setBanPending(true);
                try {
                  await banFn({ data: { userId: banTarget.id, banned: !banTarget.banned } });
                  toast.success(banTarget.banned ? "User unbanned" : "User banned");
                  setBanTarget(null);
                  void qc.invalidateQueries({ queryKey: ["admin-users"] });
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBanPending(false);
                }
              }}
            >
              {banPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {banTarget?.banned ? "Unban" : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-base font-semibold">{value}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
