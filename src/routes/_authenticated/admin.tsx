// Admin panel — moderators/admins; admins can change status + delete reports.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ShieldCheck, Trash2, Users, Building2 } from "lucide-react";
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
import { getCategoryLabel } from "@/lib/categories";
import { formatDistanceToNow } from "date-fns";
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

function AdminPage() {
  const isModerator = useIsModerator();
  const isAdmin = useIsAdmin();
  const initialized = useAuthStore((s) => s.initialized);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (initialized && !isModerator) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [initialized, isModerator, navigate]);

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isModerator,
  });

  if (!isModerator) return null;

  const changeStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("reports").update({ status: status as never }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Status updated to ${status}`);
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const delReport = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
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
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Moderation queue</h1>
          </div>
        </div>
        {isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/users">
              <Users className="mr-1.5 h-3.5 w-3.5" /> User management
            </Link>
          </Button>
        )}
      </div>


      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-12 gap-3 border-b border-border bg-secondary/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
          <div className="col-span-4">Report</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2">Submitted</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="divide-y divide-border">
          {reports.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-1 items-center gap-3 px-4 py-3 text-sm sm:grid-cols-12"
            >
              <div className="min-w-0 sm:col-span-4">
                <Link
                  to="/reports/$id"
                  params={{ id: r.id }}
                  className="block truncate font-medium hover:underline"
                >
                  {r.title}
                </Link>
                <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                {r.department && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-accent">
                    <Building2 className="h-3 w-3" /> {r.department}
                  </div>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground sm:col-span-2">
                {getCategoryLabel(r.category)}
              </div>

              <div className="sm:col-span-3">
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
              <div className="text-xs text-muted-foreground sm:col-span-2">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </div>
              <div className="flex justify-end sm:col-span-1">
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
          ))}
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
