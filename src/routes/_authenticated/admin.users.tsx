// Admin user management — view all users, grant/revoke moderator and admin roles.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Users, Search, Shield, ShieldCheck, User as UserIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin } from "@/lib/auth-store";
import { AvatarDisplay } from "@/components/avatar-display";
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
}

function AdminUsersPage() {
  const isAdmin = useIsAdmin();
  const initialized = useAuthStore((s) => s.initialized);
  const me = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (initialized && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [initialized, isAdmin, navigate]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,email,display_name,avatar_url,created_at"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const roleByUser = new Map<string, Role>();
      for (const r of roles ?? []) {
        const current = roleByUser.get(r.user_id);
        const rank = (x: Role) => (x === "admin" ? 3 : x === "moderator" ? 2 : 1);
        if (!current || rank(r.role as Role) > rank(current)) {
          roleByUser.set(r.user_id, r.role as Role);
        }
      }
      return (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        role: roleByUser.get(p.id) ?? "user",
      }));
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return null;

  const setRole = async (userId: string, newRole: Role) => {
    if (userId === me?.id && newRole !== "admin") {
      toast.error("You cannot remove your own admin role.");
      return;
    }
    // wipe existing role rows for this user, then insert new
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    const { error: insErr } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });
    if (insErr) {
      toast.error(insErr.message);
      return;
    }
    if (me?.id) {
      await supabase.from("audit_logs").insert({
        user_id: me.id,
        action: "user.role_change",
        entity_type: "user",
        entity_id: userId,
        details: { to: newRole },
      });
    }
    toast.success(`Role updated to ${newRole}`);
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
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
        <Users className="h-5 w-5 text-accent" />
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            User management
          </h1>
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
          <div className="col-span-5">User</div>
          <div className="col-span-2">Joined</div>
          <div className="col-span-2">Current role</div>
          <div className="col-span-3 text-right">Change role</div>
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
              <div className="flex min-w-0 items-center gap-2.5 sm:col-span-5">
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
              <div className="sm:col-span-2">
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
                {u.id === me?.id && (
                  <span className="ml-1.5 font-mono text-[10px] uppercase text-muted-foreground">(you)</span>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-1 sm:col-span-3">
                <Button
                  size="sm"
                  variant={u.role === "user" ? "default" : "outline"}
                  className="h-7 gap-1 text-xs"
                  disabled={u.role === "user" || u.id === me?.id}
                  onClick={() => setRole(u.id, "user")}
                >
                  <UserIcon className="h-3 w-3" /> User
                </Button>
                <Button
                  size="sm"
                  variant={u.role === "moderator" ? "default" : "outline"}
                  className="h-7 gap-1 text-xs"
                  disabled={u.role === "moderator" || u.id === me?.id}
                  onClick={() => setRole(u.id, "moderator")}
                >
                  <Shield className="h-3 w-3" /> Moderator
                </Button>
                <Button
                  size="sm"
                  variant={u.role === "admin" ? "default" : "outline"}
                  className="h-7 gap-1 text-xs"
                  disabled={u.role === "admin"}
                  onClick={() => setRole(u.id, "admin")}
                >
                  <ShieldCheck className="h-3 w-3" /> Admin
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
