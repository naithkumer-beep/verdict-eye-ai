// Admin audit log — read-only stream of admin actions.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin } from "@/lib/auth-store";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — CivicLens AI" }] }),
  component: AuditPage,
});

const ACTION_COLOR: Record<string, string> = {
  "report.status_change": "bg-info/15 text-info border-info/30",
  "report.delete": "bg-destructive/15 text-destructive border-destructive/30",
  "user.role_change": "bg-accent/15 text-accent border-accent/30",
};

function AuditPage() {
  const isAdmin = useIsAdmin();
  const initialized = useAuthStore((s) => s.initialized);
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (initialized && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [initialized, isAdmin, navigate]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id,action,entity_type,entity_id,details,user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id).filter(Boolean) as string[]));
      const profilesById = new Map<string, { email: string | null; display_name: string | null }>();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,email,display_name")
          .in("id", userIds);
        for (const p of profs ?? []) profilesById.set(p.id, { email: p.email, display_name: p.display_name });
      }
      return (data ?? []).map((r) => ({
        ...r,
        actor: r.user_id ? profilesById.get(r.user_id) ?? null : null,
      }));
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return null;

  const filtered = logs.filter((l) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      l.action.toLowerCase().includes(s) ||
      (l.entity_id ?? "").toLowerCase().includes(s) ||
      (l.actor?.email ?? "").toLowerCase().includes(s) ||
      JSON.stringify(l.details ?? {}).toLowerCase().includes(s)
    );
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-accent" />
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Admin</div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Audit log</h1>
        </div>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by action, actor email, entity id"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading audit log…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No audit events recorded yet.
            </div>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-12 sm:items-center">
              <div className="sm:col-span-3">
                <Badge variant="outline" className={`font-mono text-[10px] uppercase ${ACTION_COLOR[l.action] ?? ""}`}>
                  {l.action}
                </Badge>
              </div>
              <div className="min-w-0 sm:col-span-4">
                <div className="truncate text-xs">
                  {l.entity_type ?? "—"}{l.entity_id ? ` · ${l.entity_id.slice(0, 8)}…` : ""}
                </div>
                {l.details && (
                  <pre className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(l.details)}
                  </pre>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground sm:col-span-3">
                {l.actor?.email ?? l.actor?.display_name ?? "system"}
              </div>
              <div className="text-xs text-muted-foreground sm:col-span-2 sm:text-right">
                {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
