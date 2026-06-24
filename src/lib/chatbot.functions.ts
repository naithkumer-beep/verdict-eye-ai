// Chatbot server function — answers questions about CivicLens AI.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ChatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
  language: z.enum(["en", "my"]).default("en"),
});

const SYSTEM = `You are the CivicLens AI Assistant for Yangon, Myanmar.

ABOUT THE PLATFORM:
CivicLens AI is a civic issue reporting platform specifically for Yangon. Users submit reports about Road Damage, Garbage, Street Lights, Water/Drainage, Public Safety, Vandalism, and Building/Construction hazards. Every submitted image must pass a 6-stage AI validation pipeline before being saved:
1) Technical (format, size, dimensions)
2) Perceptual fingerprint
3) Duplicate detection
4) Image quality (blur/exposure)
5) Category relevance
6) AI cross-validation (5 passes) + confidence threshold (≥85%)

KEY FEATURES:
- Live map of all reports across Yangon (Leaflet + OpenStreetMap)
- Like/Dislike + comments on every report
- Real-time notifications when admin marks a report as resolved
- Bilingual (English / မြန်မာ)
- Emergency call directory for Yangon: Police 199, Fire 191, Ambulance 192, YCDC 1888, Electricity (YESC) 1910
- Admin-only status changes; report owner OR admin can delete

YANGON CONTEXT: Major townships include Yankin, Bahan, Kamayut, Sanchaung, Botataung, Latha, Lanmadaw, North Okkalapa, Hlaing, Mayangone. YCDC = Yangon City Development Committee.

RULES:
- Keep answers short, friendly, practical (2-4 sentences).
- If asked about a city outside Yangon, gently say CivicLens AI is currently Yangon-focused.
- Never make up phone numbers or features.
- If a user reports an active emergency, tell them to call the relevant Yangon hotline immediately (Police 199, Fire 191, Ambulance 192).
`;

export const chatWithBot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing AI key");

    const langHint =
      data.language === "my"
        ? "\n\nIMPORTANT: Reply in Myanmar (Burmese) language. မြန်မာဘာသာဖြင့်သာ ဖြေပါ။"
        : "\n\nReply in English.";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM + langHint },
          ...data.messages,
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Too many requests — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { content };
  });
