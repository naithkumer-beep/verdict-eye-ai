// Dashboard — analytics overview (admins & moderators only).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useIsAdmin, useIsModerator } from "@/lib/auth-store";
import { formatDistanceToNow, subDays, startOfDay, format } from "date-fns";
import { useTranslation } from "react-i18next";
import { localNum, localRelative, localCategory } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CIAP" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const initialized = useAuthStore((s) => s.initialized);
  const isAdmin = useIsAdmin();
  const isModerator = useIsModerator();
  const navigate = useNavigate();

  // Dashboard is an admin/moderator surface only.
  useEffect(() => {
    if (initialized && role !== null && !isModerator) {
      navigate({ to: "/reports", replace: true });
    }
  }, [initialized, role, isModerator, navigate]);
  if (initialized && role !== null && !isModerator) return null;

  const { data: reports } = useQuery({
    queryKey: ["dashboard-reports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: rewardProfile } = useQuery({
    queryKey: ["reward-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("points")
        .eq("id", user.id)
        .maybeSingle();
      return data as { points: number | null } | null;
    },
    enabled: !!user,
  });
  const points = rewardProfile?.points ?? 0;

  const stats = {
    total: reports?.length ?? 0,
    pending: reports?.filter((r) => r.status === "pending" || r.status === "analyzing").length ?? 0,
    verified: reports?.filter((r) => r.status === "verified" || r.status === "resolved").length ?? 0,
    rejected: reports?.filter((r) => r.status === "rejected").length ?? 0,
  };

  // 14-day trend
  const trend = Array.from({ length: 14 }).map((_, i) => {
    const day = startOfDay(subDays(new Date(), 13 - i));
    const count =
      reports?.filter((r) => {
        const d = new Date(r.created_at);
        return startOfDay(d).getTime() === day.getTime();
      }).length ?? 0;
    return { date: format(day, "MMM d"), reports: count, _count: count };
  });

  // Category breakdown
  const categoryData = Object.entries(
    (reports ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([k, v]) => ({ category: localCategory(k), count: v }));

  const avgConfidence =
    reports && reports.length
      ? Math.round(
          reports.reduce((s, r) => s + (r.confidence_score ?? 0), 0) / reports.length,
        )
      : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Overview
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
        </div>
        <Button asChild>
          <Link to="/reports/new">
            New report <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {!isAdmin && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-gradient-to-br from-accent/10 via-card to-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Reward points
              </div>
              <div className="text-2xl font-semibold tracking-tight">{points}</div>
              <div className="text-xs text-muted-foreground">
                Earn +10 per report submitted, +50 when it's resolved.
              </div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/reports/new">Earn more <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </Card>
      )}

      {/* Stat tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total reports"
          value={stats.total}
          icon={FileText}
          accent="text-foreground"
        />
        <StatCard
          label="Pending review"
          value={stats.pending}
          icon={Clock}
          accent="text-warning"
        />
        <StatCard
          label="Verified"
          value={stats.verified}
          icon={CheckCircle2}
          accent="text-success"
          tint="bg-success/5 border-success/20"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          icon={XCircle}
          accent="text-destructive"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="col-span-1 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">14-day trend</div>
              <div className="text-xs text-muted-foreground">Daily report volume</div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              <TrendingUp className="mr-1 h-3 w-3" /> Live
            </Badge>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -16, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="reports"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <div className="text-sm font-medium">AI analysis stats</div>
            <div className="text-xs text-muted-foreground">Aggregate confidence</div>
          </div>
          <div className="space-y-4">
            <Metric label="Avg confidence" value={`${avgConfidence}%`} icon={Activity} />
            <Metric
              label="Acceptance rate"
              value={
                stats.total
                  ? `${Math.round(((stats.total - stats.rejected) / stats.total) * 100)}%`
                  : "—"
              }
              icon={CheckCircle2}
            />
            <Metric
              label="Critical reports"
              value={reports?.filter((r) => r.severity === "critical").length ?? 0}
              icon={AlertTriangle}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4">
            <div className="text-sm font-medium">By category</div>
            <div className="text-xs text-muted-foreground">Volume per report type</div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ left: -16, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-sm font-medium">Recent activity</div>
          <div className="space-y-3">
            {(reports ?? []).slice(0, 6).map((r) => (
              <Link
                key={r.id}
                to="/reports/$id"
                params={{ id: r.id }}
                className="-mx-2 flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
              >
                <div className="mt-0.5 h-2 w-2 rounded-full bg-accent" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                </div>
              </Link>
            ))}
            {!reports?.length && (
              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No reports yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  tint,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  accent: string;
  tint?: string;
}) {
  return (
    <Card className={cn("p-5", tint)}>
      <div className="flex items-start justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString()}
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof FileText;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
