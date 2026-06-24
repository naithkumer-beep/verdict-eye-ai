// Admin panel — moderators/admins. Admins can change status, assign
// priority/department, and delete reports. Trigger autosets deadline +
// work-order number based on priority/status changes.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ShieldCheck,
  Trash2,
  Users,
  Building2,
  ScrollText,
  Flag,
  Clock,
  AlertCircle,
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
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin, useIsModerator } from "@/lib/auth-store";
import { getCategoryLabel, PRIORITIES, type PriorityValue } from "@/lib/categories";
import { formatDistanceToNow, isPast } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — CivicLens AI" }] }),
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
  const isModerator = useIsModerator();
  const isAdmin = useIsAdmin();
  const initialized = useAuthStore((s) => s.initialized);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (initialized && role !== null && !isModerator) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [initialized, role, isModerator, navigate]);

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
      .select("status,title")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase
      .from("reports")
      .update({ status: status as never })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await audit("report.status_change", id, { title: prev?.title, from: prev?.status, to: status });
    toast.success(`Status → ${status}`);
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const changePriority = async (id: string, priority: PriorityValue) => {
    const { error } = await (supabase as any)
      .from("reports")
      .update({ priority })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await audit("report.priority_change", id, { to: priority });
    toast.success(`Priority → ${priority}`);
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
    toast.success(`Assigned to ${dept?.name_en}`);
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const delReport = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await audit("report.delete", id, { title });
    toast.success("Report deleted");
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Admin
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Operations queue
            </h1>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/users">
                <Users className="mr-1.5 h-3.5 w-3.5" /> User management
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/audit">
                <ScrollText className="mr-1.5 h-3.5 w-3.5" /> Audit log
              </Link>
            </Button>
          </div>
        )}
      </div>

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
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => delReport(r.id, r.title)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
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
    </div>
  );
}
