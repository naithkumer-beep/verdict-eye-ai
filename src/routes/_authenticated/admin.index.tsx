// Admin Panel — operational hub + executive command center for admins.
// Combines KPI dashboard, department leaderboard, AI insights, and
// hotspot map with the operational report queue, per-report AI
// inspector, escalation trigger, and links to user management & audit.
import { createFileRoute, Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Trash2,
  Users,
  Building2,
  ScrollText,
  Flag,
  Clock,
  AlertCircle,
  Zap,
  Sparkles,
  Activity,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  Radio,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { runEscalation, refreshAdminPredictions } from "@/lib/admin-ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin, useIsModerator } from "@/lib/auth-store";
import { getCategoryLabel, PRIORITIES, type PriorityValue } from "@/lib/categories";
import { formatDistanceToNow, isPast } from "date-fns";
import { toast } from "sonner";
import { sendTransactionalEmail } from "@/lib/email/send";
import { YangonMap } from "@/components/yangon-map";
import { useTranslation } from "react-i18next";
import { localNum, localRelative, localCategory } from "@/lib/i18n";


export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Panel — CivicLens AI" }] }),
  component: AdminPage,
});

const STATUSES = ["pending", "analyzing", "verified", "resolved", "rejected"] as const;

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  analyzing: "bg-info/15 text-info border-info/30",
  verified: "bg-success/15 text-success border-success/30",
  resolved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-info/15 text-info border-info/30",
  low: "bg-muted text-muted-foreground border-border",
};

function AdminPage() {
  const { t } = useTranslation();
  const isModerator = useIsModerator();
  const isAdmin = useIsAdmin();
  const initialized = useAuthStore((s) => s.initialized);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const escalateFn = useServerFn(runEscalation);
  const refreshFn = useServerFn(refreshAdminPredictions);
  const [inspectId, setInspectId] = useState<string | null>(null);



  useEffect(() => {
    if (initialized && role !== null && !isModerator) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [initialized, role, isModerator, navigate]);

  // Realtime updates for the operations queue + command-center widgets
  useEffect(() => {
    if (!isModerator) return;
    const ch = supabase
      .channel("admin-ops-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-reports"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_predictions" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-prediction"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [isModerator, qc]);


  const { data: reports = [] } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: isModerator,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("departments")
        .select("id,code,name_en")
        .order("name_en");
      return (data ?? []) as Array<{ id: string; code: string; name_en: string }>;
    },
    staleTime: 5 * 60_000,
    enabled: isModerator,
  });

  const { data: costs = [] } = useQuery({
    queryKey: ["admin-costs"],
    queryFn: async () => {
      const { data } = await supabase.from("cost_estimates").select("*");
      return (data ?? []) as Array<{ category: string; estimated_cost_mmk: number }>;
    },
    enabled: isModerator,
    staleTime: 5 * 60_000,
  });

  const { data: prediction } = useQuery({
    queryKey: ["admin-prediction"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_predictions")
        .select("*")
        .eq("kind", "command_center")
        .maybeSingle();
      return data;
    },
    enabled: isModerator,
  });

  if (!isModerator) return null;


  const audit = async (
    action: string,
    entity_id: string,
    details: Record<string, unknown>,
  ) => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    await supabase.from("audit_logs").insert({
      user_id: uid,
      action,
      entity_type: "report",
      entity_id,
      details: details as never,
    });
  };


  const changeStatus = async (id: string, status: string) => {
    const { data: prev } = await supabase
      .from("reports")
      .select("status,title,user_id")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase
      .from("reports")
      .update({ status: status as never })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await audit("report.status_change", id, { title: prev?.title, from: prev?.status, to: status });
    toast.success(t("admin.statusUpdated", { status }));
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });

    // Email the reporter when their report is resolved — idempotent via report_resolved_emails
    if (status === "resolved" && prev?.status !== "resolved" && prev?.user_id) {
      try {
        const uid = (await supabase.auth.getUser()).data.user?.id;
        // Try to claim the send slot. Returns the inserted row only on first call.
        const { data: claim } = await (supabase as any)
          .from("report_resolved_emails")
          .upsert(
            { report_id: id, sent_by: uid },
            { onConflict: "report_id", ignoreDuplicates: true },
          )
          .select("report_id");
        const isFirstSend = Array.isArray(claim) && claim.length > 0;
        if (!isFirstSend) {
          console.info("Resolved email already sent for", id, "— skipping");
          return;
        }

        const [{ data: emailRow }, { data: profile }] = await Promise.all([
          (supabase as any).rpc("get_profile_email", { _user_id: prev.user_id }),
          supabase.from("profiles").select("display_name,points").eq("id", prev.user_id).maybeSingle(),
        ]);
        const recipient = typeof emailRow === "string" ? emailRow : null;
        if (recipient) {
          await sendTransactionalEmail({
            templateName: "report-resolved",
            recipientEmail: recipient,
            idempotencyKey: `report-resolved-${id}`,
            templateData: {
              recipientName: profile?.display_name ?? undefined,
              reportTitle: prev?.title ?? "Your report",
              reportId: id,
              pointsEarned: 50,
              totalPoints: (profile?.points as number | undefined) ?? undefined,
            },
          });
          toast.success(t("admin.resolutionEmailSent"));
        }
      } catch (e) {
        console.error("Failed to send resolution email", e);
        toast.error(t("admin.resolutionEmailFailed"));
      }
    }
  };

  const changePriority = async (id: string, priority: PriorityValue) => {
    const { error } = await (supabase as any)
      .from("reports")
      .update({ priority })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await audit("report.priority_change", id, { to: priority });
    toast.success(t("admin.priorityUpdated", { priority }));
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const changeDepartment = async (id: string, deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    const { error } = await (supabase as any)
      .from("reports")
      .update({ department_id: deptId, department: dept?.name_en ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await audit("report.department_assign", id, { to: dept?.name_en });
    toast.success(t("admin.assignedTo", { name: dept?.name_en ?? "" }));
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const delReport = async (id: string, title: string) => {
    if (!confirm(t("admin.confirmDelete", { title }))) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await audit("report.delete", id, { title });
    toast.success(t("admin.reportDeleted"));
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const escalate = () => {
    toast.promise(
      escalateFn({ data: undefined } as never).then((r: any) => {
        qc.invalidateQueries({ queryKey: ["admin-reports"] });
        return r;
      }),
      {
        loading: t("admin.escalating"),
        success: (r: any) => t("admin.escalated", { n: localNum(r?.escalated ?? 0) }),
        error: t("admin.escalateFailed"),
      },
    );
  };

  const refreshInsights = () => {
    toast.promise(
      refreshFn({ data: undefined } as never).then(() =>
        qc.invalidateQueries({ queryKey: ["admin-prediction"] }),
      ),
      {
        loading: t("admin.refreshingAi"),
        success: t("admin.insightsUpdated"),
        error: t("admin.refreshFailed"),
      },
    );
  };

  // ---- Command-center derived metrics ----
  const openReports = reports.filter((r) => r.status !== "resolved" && r.status !== "rejected");
  const criticalCount = openReports.filter((r) => r.priority === "critical").length;
  const overdueCount = openReports.filter(
    (r) => r.deadline_at && isPast(new Date(r.deadline_at)),
  ).length;
  const costByCat = Object.fromEntries(
    costs.map((c) => [c.category, Number(c.estimated_cost_mmk)]),
  );
  const totalCost = openReports.reduce(
    (sum, r) => sum + (costByCat[r.category] ?? 0),
    0,
  );
  const deptStats = departments
    .map((d) => {
      const ds = reports.filter((r) => r.department_id === d.id);
      const resolvedCount = ds.filter((r) => r.status === "resolved").length;
      const total = ds.length;
      const pct = total ? Math.round((resolvedCount / total) * 100) : 0;
      return { id: d.id, name: d.name_en, total, resolved: resolvedCount, pct };
    })
    .sort((a, b) => b.pct - a.pct);
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

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Admin Panel
              {isAdmin && (
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  <Radio className="mr-1 h-3 w-3 animate-pulse text-success" /> Live
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Operations, KPIs &amp; AI insights
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage reports and review executive metrics in one place.
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={refreshInsights}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh AI
            </Button>
            <Button variant="outline" size="sm" onClick={escalate}>
              <Zap className="mr-1.5 h-3.5 w-3.5" /> Run escalation
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/users">
                <Users className="mr-1.5 h-3.5 w-3.5" /> Users
              </Link>
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Activity} label="Open issues" value={openReports.length} tone="info" />
            <Kpi icon={AlertTriangle} label="Critical" value={criticalCount} tone="destructive" />
            <Kpi icon={Clock} label="Overdue" value={overdueCount} tone="warning" />
            <Kpi icon={DollarSign} label="Est. cost (MMK)" value={totalCost.toLocaleString()} tone="success" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium">Department performance</h2>
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {deptStats.length}
                </Badge>
              </div>
              <div className="space-y-2.5">
                {deptStats.map((d) => (
                  <div key={d.id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{d.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {d.resolved}/{d.total} · {d.pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-success"
                        style={{ width: `${d.pct}%` }}
                      />
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
              <p className="text-xs text-muted-foreground">
                Geo-located open and recent reports.
              </p>
            </div>
            <ClientOnly
              fallback={
                <div className="grid h-[400px] place-items-center text-sm text-muted-foreground">
                  Loading map…
                </div>
              }
            >
              <YangonMap markers={markers} height="400px" />
            </ClientOnly>
          </Card>
        </>
      )}



      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-border">
          {reports.map((r) => {
            const overdue =
              r.deadline_at &&
              !["resolved", "rejected"].includes(r.status) &&
              isPast(new Date(r.deadline_at));
            return (
              <div key={r.id} className="space-y-3 px-4 py-4 text-sm">
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/reports/$id"
                        params={{ id: r.id }}
                        className="truncate font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                      {r.work_order_no && (
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {r.work_order_no}
                        </Badge>
                      )}
                      {overdue && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-destructive/30 bg-destructive/15 font-mono text-[10px] uppercase text-destructive"
                        >
                          <AlertCircle className="h-3 w-3" /> Overdue
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {r.description}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{getCategoryLabel(r.category)}</span>
                      <span>· {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      {r.department && (
                        <span className="flex items-center gap-1 text-accent">
                          <Building2 className="h-3 w-3" /> {r.department}
                        </span>
                      )}
                      {r.deadline_at && (
                        <span
                          className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}
                        >
                          <Clock className="h-3 w-3" /> Due{" "}
                          {formatDistanceToNow(new Date(r.deadline_at), { addSuffix: true })}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-success">
                        <DollarSign className="h-3 w-3" />
                        Est. repair{" "}
                        <span className="font-mono tabular-nums">
                          {(costByCat[r.category] ?? 0).toLocaleString()} MMK
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setInspectId(r.id)}
                      aria-label="Inspect AI"
                      title="AI prediction inspector"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => delReport(r.id, r.title)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>


                {/* Ops controls */}
                <div className="grid gap-2 sm:grid-cols-3">
                  {/* Status */}
                  <div>
                    <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
                      Status
                    </div>
                    {isAdmin ? (
                      <Select value={r.status} onValueChange={(v) => changeStatus(r.id, v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] uppercase ${STATUS_COLOR[r.status] ?? ""}`}
                      >
                        {r.status}
                      </Badge>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <div className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground">
                      <Flag className="h-3 w-3" /> Priority
                    </div>
                    {isAdmin ? (
                      <Select
                        value={r.priority ?? ""}
                        onValueChange={(v) => changePriority(r.id, v as PriorityValue)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Set priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value} className="text-xs">
                              {p.label} · {p.sla}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : r.priority ? (
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] uppercase ${PRIORITY_COLOR[r.priority]}`}
                      >
                        {r.priority}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Department */}
                  <div>
                    <div className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground">
                      <Building2 className="h-3 w-3" /> Department
                    </div>
                    {isAdmin ? (
                      <Select
                        value={r.department_id ?? ""}
                        onValueChange={(v) => changeDepartment(r.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Assign department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id} className="text-xs">
                              {d.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.department ?? "—"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {reports.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No reports in the queue.
            </div>
          )}
        </div>
      </Card>

      <PredictionInspector reportId={inspectId} onClose={() => setInspectId(null)} />
    </div>
  );
}

function PredictionInspector({ reportId, onClose }: { reportId: string | null; onClose: () => void }) {
  const { data: report } = useQuery({
    queryKey: ["admin-report-detail", reportId],
    queryFn: async () => {
      if (!reportId) return null;
      const { data } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
      return data;
    },
    enabled: !!reportId,
  });

  if (!reportId) return null;
  const r: any = report ?? {};
  const actions: string[] = Array.isArray(r.recommended_actions) ? r.recommended_actions : [];

  return (
    <Dialog open={!!reportId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="truncate">{r.title ?? "Report"}</DialogTitle>
          <DialogDescription>AI prediction inputs, confidence scores, and generated payload.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreBox label="Confidence" value={r.confidence_score ?? 0} />
            <ScoreBox label="Relevance" value={r.relevance_score ?? 0} />
            <ScoreBox label="Quality" value={r.quality_score ?? 0} />
            <ScoreBox label="Impact" value={r.impact_score ?? 0} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="Category" value={r.category} />
            <Field label="Status" value={r.status} />
            <Field label="Priority" value={r.priority ?? "—"} />
            <Field label="Severity" value={r.severity ?? "—"} />
            <Field label="Affected population" value={(r.affected_population ?? 0).toLocaleString()} />
            <Field label="Risk level" value={r.risk_level ?? "—"} />
          </div>

          {r.ai_summary && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">AI summary</div>
              <p className="mt-1 text-sm">{r.ai_summary}</p>
            </div>
          )}

          {actions.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Recommended actions</div>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Raw AI payload</div>
            <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed">
{JSON.stringify(r.ai_analysis ?? { note: "No AI analysis stored" }, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>

  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  const color = value >= 85 ? "text-success" : value >= 70 ? "text-accent" : "text-warning";
  return (
    <div className="rounded-md border border-border p-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}<span className="text-xs text-muted-foreground">%</span></div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium">{String(value)}</div>
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
