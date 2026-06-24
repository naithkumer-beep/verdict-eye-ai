// Reward History — points balance + full reward_events ledger with real-time updates.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Trophy, Sparkles, CheckCircle2, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({ meta: [{ title: "Rewards — CivicLens AI" }] }),
  component: RewardsPage,
});

const KIND_META: Record<string, { label: string; icon: typeof Sparkles; tone: string; reason: string }> = {
  report_created: {
    label: "Report submitted",
    icon: Sparkles,
    tone: "text-info",
    reason: "You submitted a verified report.",
  },
  report_resolved: {
    label: "Report resolved",
    icon: CheckCircle2,
    tone: "text-success",
    reason: "An admin marked your report as resolved.",
  },
};

function RewardsPage() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["rewards-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("points,display_name").eq("id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["reward-events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("reward_events")
        .select("id,kind,points,report_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Real-time updates whenever new points are awarded
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`rewards-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reward_events", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["reward-events", user.id] });
          qc.invalidateQueries({ queryKey: ["rewards-profile", user.id] });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, qc]);

  const total = profile?.points ?? 0;
  const submitted = events.filter((e) => e.kind === "report_created").length;
  const resolved = events.filter((e) => e.kind === "report_resolved").length;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div>
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Rewards</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your reward history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn +10 points for every report you submit and +50 when it's resolved.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-accent/30 bg-gradient-to-br from-accent/10 via-card to-card p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Total points
              </div>
              <div className="text-3xl font-semibold tracking-tight">{total}</div>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Reports submitted
          </div>
          <div className="mt-1 text-2xl font-semibold">{submitted}</div>
          <div className="text-xs text-muted-foreground">+{submitted * 10} pts earned</div>
        </Card>
        <Card className="p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Reports resolved
          </div>
          <div className="mt-1 text-2xl font-semibold">{resolved}</div>
          <div className="text-xs text-muted-foreground">+{resolved * 50} pts earned</div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-medium">Activity ledger</div>
          <Badge variant="outline" className="font-mono text-[10px]">{events.length} events</Badge>
        </div>
        {events.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Trophy className="mx-auto mb-3 h-6 w-6" />
            No rewards yet. Submit your first report to earn 10 points.
            <div className="mt-4">
              <Button asChild size="sm">
                <Link to="/reports/new">Submit a report <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((e) => {
              const meta = KIND_META[e.kind] ?? {
                label: e.kind,
                icon: Sparkles,
                tone: "text-foreground",
                reason: "Reward earned.",
              };
              const Icon = meta.icon;
              const content = (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-lg bg-muted ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{meta.reason}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {format(new Date(e.created_at), "MMM d, yyyy · HH:mm")} ·{" "}
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold text-success">+{e.points}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">points</div>
                  </div>
                </div>
              );
              return e.report_id ? (
                <Link
                  key={e.id}
                  to="/reports/$id"
                  params={{ id: e.report_id }}
                  className="block transition-colors hover:bg-muted/50"
                >
                  {content}
                </Link>
              ) : (
                <div key={e.id}>{content}</div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
