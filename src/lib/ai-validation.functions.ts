// AI image validation server functions.
// The 6-stage pipeline lives here and is called from the New Report page.
//
// Stage 1 — technical (size, mime, dims) — client-side before upload
// Stage 2 — quality — AI vision pass for blur/dark/exposure
// Stage 3 — relevance — AI vision pass for category match
// Stage 4 — duplicate — perceptual-hash lookup
// Stage 5 — cross-validation — multiple AI evaluations
// Stage 6 — confidence thresholds — enforced server-side
//
// Stages 2/3/5 are folded into a single multi-pass model call for latency,
// but the model is required to emit per-stage scores so each gate is
// enforced independently.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REPORT_CATEGORIES, type CategoryValue } from "@/lib/categories";

const ValidateInput = z.object({
  imageUrl: z.string().url(),
  category: z.enum(
    REPORT_CATEGORIES.map((c) => c.value) as [CategoryValue, ...CategoryValue[]],
  ),
  perceptualHash: z.string().min(8).max(64).optional(),
});

type ValidationStage = {
  name: string;
  passed: boolean;
  detail: string;
};

export type ValidationResult = {
  accepted: boolean;
  rejectionStage?: string;
  rejectionReason?: string;
  stages: ValidationStage[];
  scores: {
    confidence: number;
    relevance: number;
    quality: number;
  };
  analysis: {
    category: string;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
    priority: "low" | "medium" | "high" | "urgent";
    riskLevel: string;
    impactScore: number;
    affectedPopulation: number;
    recommendedActions: string[];
    summary: string;
  } | null;
};

const THRESHOLDS = { confidence: 85, relevance: 85, quality: 80 };

function buildSystemPrompt(category: CategoryValue): string {
  const cat = REPORT_CATEGORIES.find((c) => c.value === category)!;
  return `You are a strict civic-report image validator and analyst.

You will be given a single image submitted to the "${cat.label}" category.

GOLD RULE — never hallucinate. Describe ONLY what is visible.
If you cannot determine something with confidence, set the relevant score
LOW and say "Unable to determine with sufficient confidence" in the summary.

You MUST run five evaluations and report on each independently:

PASS 1 — OBJECT DETECTION: list distinct objects you actually see.
PASS 2 — SCENE UNDERSTANDING: describe the scene (outdoor/indoor, lighting,
context). One sentence.
PASS 3 — CATEGORY CLASSIFICATION: does the image match "${cat.label}"?
   ACCEPTS: ${cat.accepts}
   REJECTS: ${cat.rejects}
PASS 4 — IMPACT ASSESSMENT: severity (low/medium/high/critical), affected
population estimate (integer), and 1-3 line risk description.
PASS 5 — CONSISTENCY CHECK: are passes 1-4 internally consistent? If they
disagree significantly, lower confidence to <60.

QUALITY checks: blur, darkness, overexposure, obstruction, extreme crop,
visible AI-generation/manipulation artifacts. Each issue detected drops
quality score by 20. Do NOT consider image resolution, pixel count, or
file dimensions at all — ignore them completely when scoring quality.


Return STRICT JSON with this exact shape and nothing else:
{
  "passes": {
    "objects": ["..."],
    "scene": "...",
    "categoryMatch": true|false,
    "categoryReason": "...",
    "consistency": "consistent"|"inconsistent"
  },
  "quality": {
    "score": 0-100,
    "issues": ["blur"|"dark"|"overexposed"|"obstruction"|"extreme_crop"|"manipulated"]
  },

  "relevance": {
    "score": 0-100,
    "reason": "..."
  },
  "confidence": 0-100,
  "analysis": {
    "category": "${cat.label}",
    "severity": "low"|"medium"|"high"|"critical",
    "priority": "low"|"medium"|"high"|"urgent",
    "riskLevel": "...",
    "impactScore": 0-100,
    "affectedPopulation": 0,
    "recommendedActions": ["...", "..."],
    "summary": "2-3 sentences. Only what is visible."
  }
}

Reject scoring rules:
- If image is a selfie, food, pet, screenshot, meme, or anything unrelated
  to "${cat.label}", relevance MUST be <30.
- If you cannot identify subject matter with confidence, confidence MUST be <60.
- If quality issues are visible (blur/darkness), quality MUST be <70.

Output JSON only. No prose, no markdown fences.`;
}

async function callVisionModel(
  imageUrl: string,
  category: CategoryValue,
  apiKey: string,
): Promise<unknown> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: buildSystemPrompt(category) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Validate and analyze this image for the "${category}" category. Return strict JSON only.`,
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached — try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits in workspace settings.");
    throw new Error(`AI gateway error (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI returned an empty response.");

  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON if model wrapped in fences
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("AI returned non-JSON content.");
  }
}

export const validateReportImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ValidateInput.parse(input))
  .handler(async ({ data, context }): Promise<ValidationResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured.");

    const stages: ValidationStage[] = [];

    // Stage 4: duplicate detection (perceptual hash)
    if (data.perceptualHash) {
      const { data: dupes } = await context.supabase
        .from("report_images")
        .select("id, report_id")
        .eq("perceptual_hash", data.perceptualHash)
        .limit(1);
      if (dupes && dupes.length > 0) {
        stages.push({
          name: "Duplicate detection",
          passed: false,
          detail: "Matching perceptual hash found in submitted reports.",
        });
        return {
          accepted: false,
          rejectionStage: "duplicate",
          rejectionReason: "This image appears to have been submitted previously.",
          stages,
          scores: { confidence: 0, relevance: 0, quality: 0 },
          analysis: null,
        };
      }
      stages.push({
        name: "Duplicate detection",
        passed: true,
        detail: "No matching hash found.",
      });
    }

    // Stages 2, 3, 5: AI multi-pass evaluation
    let raw: any;
    try {
      raw = await callVisionModel(data.imageUrl, data.category, apiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI evaluation failed";
      stages.push({ name: "AI evaluation", passed: false, detail: msg });
      return {
        accepted: false,
        rejectionStage: "ai_error",
        rejectionReason: msg,
        stages,
        scores: { confidence: 0, relevance: 0, quality: 0 },
        analysis: null,
      };
    }

    const quality = Math.max(0, Math.min(100, Number(raw?.quality?.score ?? 0)));
    const relevance = Math.max(0, Math.min(100, Number(raw?.relevance?.score ?? 0)));
    const confidence = Math.max(0, Math.min(100, Number(raw?.confidence ?? 0)));
    const consistency = raw?.passes?.consistency ?? "inconsistent";

    // Stage 2: quality gate
    stages.push({
      name: "Image quality",
      passed: quality >= THRESHOLDS.quality,
      detail:
        quality >= THRESHOLDS.quality
          ? `Quality score ${quality}/100`
          : `Quality score ${quality}/100 — issues: ${(raw?.quality?.issues ?? []).join(", ") || "low"}`,
    });
    if (quality < THRESHOLDS.quality) {
      return {
        accepted: false,
        rejectionStage: "quality",
        rejectionReason:
          "Image quality is too low for accurate analysis. Please upload a clearer image.",
        stages,
        scores: { confidence, relevance, quality },
        analysis: null,
      };
    }

    // Stage 3: relevance gate
    stages.push({
      name: "Category relevance",
      passed: relevance >= THRESHOLDS.relevance,
      detail:
        relevance >= THRESHOLDS.relevance
          ? `Relevance ${relevance}/100 — ${raw?.relevance?.reason ?? "matches category"}`
          : `Relevance ${relevance}/100 — ${raw?.relevance?.reason ?? "off-category content"}`,
    });
    if (relevance < THRESHOLDS.relevance) {
      return {
        accepted: false,
        rejectionStage: "relevance",
        rejectionReason:
          "This image does not appear to match the selected report category. Please upload a relevant image.",
        stages,
        scores: { confidence, relevance, quality },
        analysis: null,
      };
    }

    // Stage 5: cross-validation consistency
    stages.push({
      name: "AI cross-validation",
      passed: consistency === "consistent",
      detail:
        consistency === "consistent"
          ? "All 5 passes agree."
          : "Multiple AI passes disagree on subject matter.",
    });
    if (consistency !== "consistent") {
      return {
        accepted: false,
        rejectionStage: "cross_validation",
        rejectionReason:
          "Unable to confidently determine the contents of this image.",
        stages,
        scores: { confidence, relevance, quality },
        analysis: null,
      };
    }

    // Stage 6: confidence gate
    stages.push({
      name: "Confidence threshold",
      passed: confidence >= THRESHOLDS.confidence,
      detail: `Confidence ${confidence}/100 (min ${THRESHOLDS.confidence})`,
    });
    if (confidence < THRESHOLDS.confidence) {
      return {
        accepted: false,
        rejectionStage: "confidence",
        rejectionReason:
          "AI confidence too low. Please upload a clearer, more representative image.",
        stages,
        scores: { confidence, relevance, quality },
        analysis: null,
      };
    }

    return {
      accepted: true,
      stages,
      scores: { confidence, relevance, quality },
      analysis: raw?.analysis ?? null,
    };
  });
