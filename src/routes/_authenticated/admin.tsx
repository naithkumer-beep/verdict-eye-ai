// Admin panel — visible to moderators and admins (server-side enforced by RLS).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsModerator } from "@/lib/auth-store";
import { getCategoryLabel } from "@/lib/categories";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — CIAP" }] }),
  component: AdminPage,
});

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  analyzing: "bg-info/15 text-info border-info/30",
  verified: "bg-success/15 text-success border-success/30",
  resolved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function AdminPage() {
  const isModerator = useIsModerator();
  const initialized = useAuthStore((s) => s.initialized);
  const navigate = useNavigate();

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
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: isModerator,
  });

  if (!isModerator) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Moderation queue
          </h1>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-secondary/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="col-span-5">Report</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Conf.</div>
          <div className="col-span-2 text-right">Submitted</div>
        </div>
        <div className="divide-y divide-border">
          {reports.map((r) => (
            <Link
              key={r.id}
              to="/reports/$id"
              params={{ id: r.id }}
              className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <div className="col-span-5 min-w-0">
                <div className="truncate font-medium">{r.title}</div>
                <div className="truncate text-xs text-muted-foreground">{r.description}</div>
              </div>
              <div className="col-span-2 truncate text-xs text-muted-foreground">
                {getCategoryLabel(r.category)}
              </div>
              <div className="col-span-2">
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] uppercase ${STATUS_COLOR[r.status] ?? ""}`}
                >
                  {r.status}
                </Badge>
              </div>
              <div className="col-span-1 font-mono text-xs tabular-nums">
                {r.confidence_score ?? 0}%
              </div>
              <div className="col-span-2 text-right text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
              </div>
            </Link>
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
