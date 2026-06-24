// Server function: generate Yangon-specific AI predictions from recent reports.
// Cached into public.ai_predictions for the admin command center.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const refreshAdminPredictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await context.supabase
      .from("reports")
      .select("category,status,priority,created_at,department_id,location")
      .gte("created_at", since)
      .limit(500);

    const counts: Record<string, number> = {};
    for (const r of rows ?? []) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
    }
    const summary = Object.entries(counts)
      .map(([c, n]) => `${c}: ${n}`)
      .join(", ");

    const key = process.env.LOVABLE_API_KEY;
    let payload: Record<string, unknown> = {
      insights: [
        { title: "Top category", body: `Highest volume in the last 30 days: ${summary || "no data"}` },
      ],
      generated_at: new Date().toISOString(),
    };

    if (key) {
      try {
        const res = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You are an urban-operations analyst for Yangon, Myanmar. Output STRICT JSON only: {insights:[{title,body}]}. 3 short, actionable predictions based on the data. Mention rainy season risk if road_damage or water_drainage is high.",
              },
              {
                role: "user",
                content: `Report counts last 30 days: ${summary || "no reports"}. Total: ${rows?.length ?? 0}.`,
              },
            ],
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const text: string = j?.choices?.[0]?.message?.content ?? "";
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            payload = { ...parsed, generated_at: new Date().toISOString() };
          }
        }
      } catch (e) {
        console.error("AI predictions failed", e);
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ai_predictions")
      .upsert({ kind: "command_center", payload: payload as never, generated_at: new Date().toISOString() });

    return { ok: true, payload: JSON.stringify(payload) };
  });

export const runEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("escalate_overdue_reports" as never);
    if (error) throw error;
    return { escalated: (data as unknown as number) ?? 0 };
  });

// AI auto role suggestion — analyses a user's report history and recommends a role.
export const suggestUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: reports }, { count: commentCount }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("display_name,email,created_at")
        .eq("id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("reports")
        .select("id,status,priority,category,created_at,ai_analysis")
        .eq("user_id", data.userId)
        .limit(200),
      supabaseAdmin
        .from("report_comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.userId),
    ]);

    const reportList = reports ?? [];
    const total = reportList.length;
    const verified = reportList.filter((r) => r.status === "verified" || r.status === "resolved").length;
    const rejected = reportList.filter((r) => r.status === "rejected").length;
    const accuracy = total > 0 ? Math.round((verified / total) * 100) : 0;
    const ageDays = profile?.created_at
      ? Math.max(1, Math.round((Date.now() - new Date(profile.created_at).getTime()) / 86400000))
      : 1;

    // Deterministic baseline heuristic
    let suggested: "user" | "moderator" | "admin" = "user";
    const reasons: string[] = [];
    if (total >= 25 && accuracy >= 80 && rejected <= 2 && ageDays >= 30) {
      suggested = "moderator";
      reasons.push(`Strong track record: ${verified}/${total} verified (${accuracy}%)`);
      reasons.push(`Active for ${ageDays} days`);
    } else if (total >= 5 && accuracy >= 60) {
      suggested = "user";
      reasons.push(`Healthy reporter — ${accuracy}% accuracy across ${total} reports`);
    } else if (rejected >= 5 && accuracy < 30) {
      suggested = "user";
      reasons.push(`Low quality signal: ${rejected} rejected reports`);
    } else {
      reasons.push(`Limited history — ${total} reports, ${commentCount ?? 0} comments`);
    }

    let confidence = Math.min(95, 40 + total * 2 + (accuracy >= 70 ? 15 : 0));

    // Refine with AI if available
    const key = process.env.LOVABLE_API_KEY;
    let aiReason: string | null = null;
    if (key && total > 0) {
      try {
        const res = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You analyse civic-reporting users and recommend a platform role. Output STRICT JSON only: {role:'user'|'moderator'|'admin', confidence:0-100, reason:string}. Choose 'moderator' only for high-volume, high-accuracy, long-tenured contributors. 'admin' is reserved for trusted staff — almost never suggest it from activity alone.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  name: profile?.display_name,
                  account_age_days: ageDays,
                  total_reports: total,
                  verified_reports: verified,
                  rejected_reports: rejected,
                  accuracy_pct: accuracy,
                  comments: commentCount ?? 0,
                  baseline_suggestion: suggested,
                }),
              },
            ],
          }),
        });
        if (res.ok) {
          const j = await res.json();
          const text: string = j?.choices?.[0]?.message?.content ?? "";
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]) as { role?: string; confidence?: number; reason?: string };
            if (parsed.role === "user" || parsed.role === "moderator" || parsed.role === "admin") {
              suggested = parsed.role;
            }
            if (typeof parsed.confidence === "number") confidence = Math.round(parsed.confidence);
            if (parsed.reason) aiReason = parsed.reason;
          }
        }
      } catch (e) {
        console.error("AI role suggestion failed", e);
      }
    }

    return {
      suggested,
      confidence,
      stats: { total, verified, rejected, accuracy, comments: commentCount ?? 0, ageDays },
      reasons,
      aiReason,
    };
  });
