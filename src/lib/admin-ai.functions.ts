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

// List all users with email + role (admin-only). Uses service-role client
// because the public profiles SELECT policy hides the email column from
// regular authenticated reads.
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }, { data: reports, error: repErr }, authList] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,email,display_name,avatar_url,created_at,points")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("reports").select("user_id,status"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (pErr) throw pErr;
    if (rErr) throw rErr;
    if (repErr) throw repErr;

    type Role = "user" | "moderator" | "admin";
    const rank = (x: Role) => (x === "admin" ? 3 : x === "moderator" ? 2 : 1);
    const roleByUser = new Map<string, Role>();
    for (const r of roles ?? []) {
      const cur = roleByUser.get(r.user_id);
      const next = r.role as Role;
      if (!cur || rank(next) > rank(cur)) roleByUser.set(r.user_id, next);
    }

    const stats = new Map<string, { total: number; resolved: number }>();
    for (const r of reports ?? []) {
      if (!r.user_id) continue;
      const s = stats.get(r.user_id) ?? { total: 0, resolved: 0 };
      s.total += 1;
      if (r.status === "resolved") s.resolved += 1;
      stats.set(r.user_id, s);
    }

    const bannedUntil = new Map<string, string | null>();
    for (const u of authList?.data?.users ?? []) {
      const b = (u as { banned_until?: string | null }).banned_until ?? null;
      bannedUntil.set(u.id, b);
    }

    return (profiles ?? []).map((p) => {
      const s = stats.get(p.id as string) ?? { total: 0, resolved: 0 };
      const bu = bannedUntil.get(p.id as string) ?? null;
      const isBanned = !!bu && new Date(bu).getTime() > Date.now();
      return {
        id: p.id as string,
        email: (p.email as string | null) ?? null,
        display_name: (p.display_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        created_at: p.created_at as string,
        role: roleByUser.get(p.id as string) ?? ("user" as Role),
        points: (p.points as number | null) ?? 0,
        reports_total: s.total,
        reports_resolved: s.resolved,
        banned: isBanned,
        banned_until: bu,
      };
    });
  });

// Ban or unban a user via Supabase Auth Admin API. Admins only.
export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; banned: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    if (data.userId === context.userId) throw new Error("You cannot ban yourself");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Block banning other admins
    const { data: targetIsAdmin } = await context.supabase.rpc("has_role", {
      _user_id: data.userId,
      _role: "admin",
    });
    if (targetIsAdmin && data.banned) throw new Error("Cannot ban another admin");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.banned ? "876000h" : "none",
    });
    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: data.banned ? "user.ban" : "user.unban",
      entity_type: "user",
      entity_id: data.userId,
      details: { banned: data.banned },
    });

    return { ok: true, banned: data.banned };
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
