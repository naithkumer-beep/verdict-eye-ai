// Reports list — table view with filters.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import { REPORT_CATEGORIES, getCategoryLabel } from "@/lib/categories";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({ meta: [{ title: "Reports — CIAP" }] }),
  component: ReportsList,
});

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  analyzing: "bg-info/15 text-info border-info/30",
  verified: "bg-success/15 text-success border-success/30",
  resolved: "bg-green/15 text-green border-green/40",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function ReportsList() {
  const user = useAuthStore((s) => s.user);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports-list", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data ?? [];
      const ids = rows.map((r) => r.id);
      if (!ids.length) return rows.map((r) => ({ ...r, thumbUrl: null as string | null }));
      const { data: imgs } = await supabase
        .from("report_images")
        .select("report_id,storage_path")
        .in("report_id", ids);
      const firstByReport = new Map<string, string>();
      for (const img of imgs ?? []) {
        if (!firstByReport.has(img.report_id)) firstByReport.set(img.report_id, img.storage_path);
      }
      const signed = await Promise.all(
        Array.from(firstByReport.entries()).map(async ([rid, path]) => {
          const { data: s } = await supabase.storage
            .from("report-images")
            .createSignedUrl(path, 60 * 60);
          return [rid, s?.signedUrl ?? null] as const;
        }),
      );
      const urlByReport = new Map(signed);
      return rows.map((r) => ({ ...r, thumbUrl: urlByReport.get(r.id) ?? null }));
    },
    enabled: !!user,
  });

  const filtered = reports.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (category !== "all" && r.category !== category) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            All reports
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Reports
          </h1>
        </div>
        <Button asChild>
          <Link to="/reports/new">
            <Plus className="mr-1 h-4 w-4" /> New report
          </Link>
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="analyzing">Analyzing</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {REPORT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-secondary/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Conf.</div>
          <div className="col-span-2 text-right">Submitted</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading && (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="p-14 text-center">
              <div className="text-sm text-muted-foreground">
                No reports match your filters.
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/reports/new">Create your first report</Link>
              </Button>
            </div>
          )}
          {filtered.map((r) => (
            <Link
              key={r.id}
              to="/reports/$id"
              params={{ id: r.id }}
              className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <div className="col-span-5 flex min-w-0 items-start gap-4">
                {r.thumbUrl ? (
                  <img
                    src={r.thumbUrl}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
                    No img
                  </div>
                )}
                <div className="min-w-0 flex-1 py-1">
                  <div className="truncate font-medium">{r.title}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{r.description}</div>
                </div>
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
        </div>
      </Card>
    </div>
  );
}
