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
      .upsert({ kind: "command_center", payload, generated_at: new Date().toISOString() });

    return { ok: true, payload };
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
