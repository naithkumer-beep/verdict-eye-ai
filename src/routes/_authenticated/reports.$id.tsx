// Single report detail page.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trash2, MapPin, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import { getCategoryLabel } from "@/lib/categories";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({ meta: [{ title: "Report — CIAP" }] }),
  component: ReportDetail,
});

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  analyzing: "bg-info/15 text-info border-info/30",
  verified: "bg-success/15 text-success border-success/30",
  resolved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function ReportDetail() {
  const { id } = Route.useParams();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: images = [] } = useQuery({
    queryKey: ["report-images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_images")
        .select("*")
        .eq("report_id", id);
      if (error) throw error;
      // Re-sign URLs (originals expire)
      return Promise.all(
        (data ?? []).map(async (img) => {
          const { data: signed } = await supabase.storage
            .from("report-images")
            .createSignedUrl(img.storage_path, 60 * 60);
          return { ...img, signedUrl: signed?.signedUrl ?? img.url };
        }),
      );
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
        <div className="text-sm text-muted-foreground">Report not found.</div>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/reports">Back to reports</Link>
        </Button>
      </div>
    );
  }

  const isOwner = user?.id === report.user_id;

  const onDelete = async () => {
    if (!isOwner) return;
    if (!confirm("Soft-delete this report?")) return;
    const { error } = await supabase
      .from("reports")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", report.id);
    if (error) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Report deleted");
    navigate({ to: "/reports" });
  };

  const actions: string[] = Array.isArray(report.recommended_actions)
    ? (report.recommended_actions as string[])
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/reports">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> All reports
          </Link>
        </Button>
        {isOwner && (
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        )}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`font-mono text-[10px] uppercase ${STATUS_COLOR[report.status] ?? ""}`}
              >
                {report.status}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {getCategoryLabel(report.category)}
              </Badge>
              {report.severity && (
                <Badge variant="outline" className="font-mono text-[10px] uppercase">
                  {report.severity}
                </Badge>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {report.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Submitted
            </div>
            <div className="mt-1 text-sm tabular-nums">
              {format(new Date(report.created_at), "MMM d, yyyy")}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
          {report.department && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" /> {report.department}
            </span>
          )}
          {report.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {report.location}
            </span>
          )}
        </div>
      </Card>

      {/* AI scores */}
      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreCard label="Confidence" value={report.confidence_score ?? 0} />
        <ScoreCard label="Relevance" value={report.relevance_score ?? 0} />
        <ScoreCard label="Quality" value={report.quality_score ?? 0} />
      </div>

      {/* Images */}
      {images.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 text-sm font-medium">Evidence</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((img) => (
              <img
                key={img.id}
                src={img.signedUrl}
                alt="Report evidence"
                className="w-full rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        </Card>
      )}

      {/* AI summary + actions */}
      {report.ai_summary && (
        <Card className="p-5">
          <div className="mb-3 text-sm font-medium">AI analysis</div>
          <p className="text-sm text-muted-foreground">{report.ai_summary}</p>
          {report.risk_level && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Risk: {report.risk_level}</span>
            </div>
          )}
          {actions.length > 0 && (
            <div className="mt-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Recommended actions
              </div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Impact metrics */}
      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border p-0 sm:grid-cols-4">
        <Metric label="Impact" value={report.impact_score ?? 0} suffix="" />
        <Metric label="Priority" value={report.priority_score ?? 0} suffix="" />
        <Metric label="Population" value={(report.affected_population ?? 0).toLocaleString()} suffix="" />
        <Metric label="Severity" value={report.severity ?? "—"} suffix="" />
      </Card>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: number }) {
  const color =
    value >= 85 ? "text-success" : value >= 70 ? "text-accent" : "text-warning";
  return (
    <Card className="p-5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${color}`}>
        {value}
        <span className="text-base text-muted-foreground">%</span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-accent to-foreground"
          style={{ width: `${value}%` }}
        />
      </div>
    </Card>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string | number; suffix: string }) {
  return (
    <div className="bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {value}
        {suffix}
      </div>
    </div>
  );
}
