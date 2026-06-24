// Executive Command Center — admin KPIs, department leaderboard, cost roll-up,
// hotspot heatmap, AI predictions, manual escalation trigger.
import { createFileRoute, ClientOnly, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, Clock, DollarSign, Sparkles, Zap, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin } from "@/lib/auth-store";
import { useServerFn } from "@tanstack/react-start";
import { refreshAdminPredictions, runEscalation } from "@/lib/admin-ai.functions";
import { toast } from "sonner";
import { YangonMap } from "@/components/yangon-map";
import { isPast } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin/command")({
  head: () => ({ meta: [{ title: "Command Center — CivicLens" }] }),
  component: CommandCenter,
});

function CommandCenter() {
  const isAdmin = useIsAdmin();
  const initialized = useAuthStore((s) => s.initialized);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const refreshFn = useServerFn(refreshAdminPredictions);
  const escalateFn = useServerFn(runEscalation);

  useEffect(() => {
    if (initialized && role !== null && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [initialized, role, isAdmin, navigate]);

  // Realtime: live KPI / map / insights updates
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("cc-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        qc.invalidateQueries({ queryKey: ["cc-reports"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_predictions" }, () => {
        qc.invalidateQueries({ queryKey: ["cc-prediction"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "report_feedback" }, () => {
        qc.invalidateQueries({ queryKey: ["cc-reports"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [isAdmin, qc]);

  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const { data: reports = [] } = useQuery({
    queryKey: ["cc-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id,status,priority,category,department_id,deadline_at,resolved_at,created_at,latitude,longitude,title")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["cc-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: costs = [] } = useQuery({
    queryKey: ["cc-costs"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_estimates").select("*");
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: prediction } = useQuery({
    queryKey: ["cc-prediction"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_predictions")
        .select("*")
        .eq("kind", "command_center")
        .maybeSingle();
      return data;
    },
    enabled: isAdmin,
  });

  if (!isAdmin) return null;

  const open = reports.filter((r) => r.status !== "resolved" && r.status !== "rejected");
  const critical = open.filter((r) => r.priority === "critical").length;
  const overdue = open.filter((r) => r.deadline_at && isPast(new Date(r.deadline_at))).length;

  const costByCat = Object.fromEntries(costs.map((c: any) => [c.category, Number(c.estimated_cost_mmk)]));
  const totalCost = open.reduce((sum, r) => sum + (costByCat[r.category] ?? 0), 0);

  // Department leaderboard
  const deptStats = departments.map((d: any) => {
    const ds = reports.filter((r) => r.department_id === d.id);
    const resolved = ds.filter((r) => r.status === "resolved").length;
    const total = ds.length;
    const pct = total ? Math.round((resolved / total) * 100) : 0;
    return { id: d.id, name: d.name_en, total, resolved, pct };
  }).sort((a, b) => b.pct - a.pct);

  const markers = reports
    .filter((r) => r.latitude != null && r.longitude != null)
    .slice(0, 200)
    .map((r) => ({
      id: r.id,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      title: r.title,
      status: r.status,
    }));

  const insights: Array<{ title: string; body: string }> =
    (prediction?.payload as any)?.insights ?? [];

  const refresh = async () => {
    toast.promise(refreshFn({ data: undefined } as never).then(() => qc.invalidateQueries({ queryKey: ["cc-prediction"] })), {
      loading: "Refreshing AI insights…",
      success: "Insights updated",
      error: "Failed to refresh",
    });
  };

  const escalate = async () => {
    toast.promise(escalateFn({ data: undefined } as never).then((r: any) => {
      qc.invalidateQueries({ queryKey: ["cc-reports"] });
      return r;
    }), {
      loading: "Running escalation…",
      success: (r: any) => `Escalated ${r?.escalated ?? 0} report(s)`,
      error: "Escalation failed",
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2">
            <Link to="/admin"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Admin</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Command Center</h1>
          <p className="text-sm text-muted-foreground">Executive view of all CivicLens operations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={escalate}>
            <Zap className="mr-1 h-3.5 w-3.5" /> Run escalation
          </Button>
          <Button size="sm" onClick={refresh}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh AI
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Activity} label="Open issues" value={open.length} tone="info" />
        <Kpi icon={AlertTriangle} label="Critical" value={critical} tone="destructive" />
        <Kpi icon={Clock} label="Overdue" value={overdue} tone="warning" />
        <Kpi icon={DollarSign} label="Est. cost (MMK)" value={totalCost.toLocaleString()} tone="success" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Department performance</h2>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">{deptStats.length}</Badge>
          </div>
          <div className="space-y-2.5">
            {deptStats.map((d) => (
              <div key={d.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{d.name}</span>
                  <span className="tabular-nums text-muted-foreground">{d.resolved}/{d.total} · {d.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-gradient-to-r from-accent to-success" style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
            {deptStats.length === 0 && (
              <div className="text-sm text-muted-foreground">No department data yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-medium">AI predictions</h2>
          </div>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No insights yet. Click <strong>Refresh AI</strong> to generate.
            </p>
          ) : (
            <ul className="space-y-3">
              {insights.map((ins, i) => (
                <li key={i} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="text-sm font-medium">{ins.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{ins.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-medium">Hotspot map</h2>
          <p className="text-xs text-muted-foreground">Geo-located open and recent reports.</p>
        </div>
        <ClientOnly fallback={<div className="grid h-[400px] place-items-center text-sm text-muted-foreground">Loading map…</div>}>
          <YangonMap markers={markers} height="400px" />
        </ClientOnly>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  tone: "info" | "destructive" | "warning" | "success";
}) {
  const colors = {
    info: "text-info bg-info/10",
    destructive: "text-destructive bg-destructive/10",
    warning: "text-warning bg-warning/10",
    success: "text-success bg-success/10",
  } as const;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-md ${colors[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}
