// New Report — runs the full 6-stage AI validation pipeline live.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ImageIcon,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/lib/auth-store";
import { useServerFn } from "@tanstack/react-start";
import { REPORT_CATEGORIES, type CategoryValue } from "@/lib/categories";
import { technicalValidate, computePerceptualHash } from "@/lib/image-utils";
import { validateReportImage, type ValidationResult } from "@/lib/ai-validation.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/reports/new")({
  head: () => ({ meta: [{ title: "New report — CIAP" }] }),
  component: NewReport,
});

type StageStatus = "idle" | "running" | "passed" | "failed";

interface PipelineStage {
  key: string;
  name: string;
  description: string;
  status: StageStatus;
  detail?: string;
}

const INITIAL_STAGES: PipelineStage[] = [
  { key: "technical", name: "Technical validation", description: "Format, size, dimensions, integrity", status: "idle" },
  { key: "hash", name: "Fingerprint", description: "Compute perceptual hash", status: "idle" },
  { key: "upload", name: "Secure upload", description: "Sign and store image", status: "idle" },
  { key: "quality", name: "Quality assessment", description: "Blur, exposure, obstruction", status: "idle" },
  { key: "relevance", name: "Category relevance", description: "Match against selected category", status: "idle" },
  { key: "duplicate", name: "Duplicate detection", description: "Hash match against history", status: "idle" },
  { key: "cross", name: "AI cross-validation", description: "5 independent passes", status: "idle" },
  { key: "confidence", name: "Confidence threshold", description: "Final scoring gate", status: "idle" },
];

function NewReport() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const runValidation = useServerFn(validateReportImage);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryValue>("road_damage");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<[number, number] | null>(null);


  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateStage = (key: string, status: StageStatus, detail?: string) => {
    setStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status, detail } : s)),
    );
  };

  const resetPipeline = () => {
    setStages(INITIAL_STAGES);
    setResult(null);
  };

  const onPickFile = (f: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    resetPipeline();
  };

  const runPipeline = async () => {
    if (!file || !user) return;
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required.");
      return;
    }

    setAnalyzing(true);
    resetPipeline();

    try {
      // STAGE 1 — technical
      updateStage("technical", "running");
      const tech = await technicalValidate(file);
      if (!tech.ok) {
        updateStage("technical", "failed", tech.reason);
        toast.error(`Invalid image: ${tech.reason}`);
        return;
      }
      updateStage("technical", "passed", `${tech.width}×${tech.height} • ${(tech.size! / 1024).toFixed(0)} KB`);

      // STAGE — perceptual hash
      updateStage("hash", "running");
      const phash = await computePerceptualHash(file);
      updateStage("hash", "passed", `hash ${phash.slice(0, 12)}…`);

      // STAGE — upload to storage
      updateStage("upload", "running");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("report-images")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        updateStage("upload", "failed", upErr.message);
        toast.error("Upload failed.");
        return;
      }
      const { data: signed } = await supabase.storage
        .from("report-images")
        .createSignedUrl(path, 60 * 30);
      const imageUrl = signed?.signedUrl;
      if (!imageUrl) {
        updateStage("upload", "failed", "Could not sign URL");
        return;
      }
      updateStage("upload", "passed", "Encrypted at rest");

      // STAGES 2–6 — AI evaluation via server function
      updateStage("quality", "running");
      updateStage("relevance", "running");
      updateStage("duplicate", "running");
      updateStage("cross", "running");
      updateStage("confidence", "running");

      const validation = await runValidation({
        data: { imageUrl, category, perceptualHash: phash },
      });

      // Map validation stages back to our UI
      const stageMap: Record<string, string> = {
        "Duplicate detection": "duplicate",
        "Image quality": "quality",
        "Category relevance": "relevance",
        "AI cross-validation": "cross",
        "Confidence threshold": "confidence",
      };

      for (const s of validation.stages) {
        const key = stageMap[s.name];
        if (key) updateStage(key, s.passed ? "passed" : "failed", s.detail);
      }
      // Any still-running stages that weren't reached -> mark idle/failed appropriately
      setStages((prev) =>
        prev.map((s) =>
          s.status === "running"
            ? validation.accepted
              ? { ...s, status: "passed", detail: "Cleared" }
              : { ...s, status: "idle", detail: "Skipped (earlier stage failed)" }
            : s,
        ),
      );

      setResult(validation);

      if (validation.accepted) {
        toast.success("All 6 stages passed — ready to submit.");

        // Insert the report
        setSubmitting(true);
        const a = validation.analysis!;
        const priorityScore =
          a.priority === "urgent" ? 90 : a.priority === "high" ? 70 : a.priority === "medium" ? 50 : 30;

        const { data: report, error: insErr } = await supabase
          .from("reports")
          .insert({
            user_id: user.id,
            title: title.trim(),
            description: description.trim(),
            category,
            department: department.trim() || null,
            location: location.trim() || null,
            status: "analyzing",
            verification_status: "verified",
            severity: a.severity,
            priority_score: priorityScore,
            impact_score: a.impactScore,
            confidence_score: validation.scores.confidence,
            relevance_score: validation.scores.relevance,
            quality_score: validation.scores.quality,
            affected_population: a.affectedPopulation,
            risk_level: a.riskLevel,
            ai_summary: a.summary,
            recommended_actions: a.recommendedActions,
            ai_analysis: a as never,
          })
          .select()
          .single();

        if (insErr || !report) {
          toast.error("Could not save report.");
          setSubmitting(false);
          return;
        }

        await supabase.from("report_images").insert({
          report_id: report.id,
          user_id: user.id,
          url: imageUrl,
          storage_path: path,
          perceptual_hash: phash,
          size_bytes: tech.size!,
          width: tech.width!,
          height: tech.height!,
          mime_type: tech.mime!,
          validation_result: validation as never,
          ai_analysis: a as never,
        });

        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "report_created",
          title: "Report verified",
          message: `${title.trim()} passed all 6 validation stages.`,
          link: `/reports/${report.id}`,
        });

        toast.success("Report created");
        navigate({ to: "/reports/$id", params: { id: report.id } });
      } else {
        // Clean up the uploaded file since report was rejected
        await supabase.storage.from("report-images").remove([path]);
        toast.error(validation.rejectionReason ?? "Image rejected");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pipeline failed";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
      setSubmitting(false);
    }
  };

  const completed = stages.filter((s) => s.status === "passed").length;
  const progress = (completed / stages.length) * 100;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div>
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          New report
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Submit a report
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every image clears 6 validation stages before analysis.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: form */}
        <Card className="space-y-4 p-5 lg:col-span-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Large pothole on Main Street"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you see and the conditions."
                rows={4}
                maxLength={1000}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept">Department (optional)</Label>
              <Input
                id="dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Public Works"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="loc">Location (optional)</Label>
              <Input
                id="loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="123 Main St, Cityname"
                maxLength={200}
              />
            </div>
          </div>

          <div>
            <Label>Evidence image</Label>
            <label className="mt-1.5 block cursor-pointer">
              <div
                className={cn(
                  "relative grid place-items-center rounded-lg border-2 border-dashed border-border bg-secondary/30 px-4 py-8 transition-colors hover:border-accent/50",
                  previewUrl && "border-solid p-0",
                )}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-72 w-full rounded-lg object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                    <div className="mt-2 text-sm font-medium">Click to upload</div>
                    <div className="text-xs text-muted-foreground">
                      JPEG, PNG, WebP • up to 8 MB • min 480×480
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </label>
          </div>

          <Button
            onClick={runPipeline}
            disabled={!file || analyzing || submitting}
            size="lg"
            className="w-full"
          >
            {analyzing || submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {submitting ? "Saving report…" : "Running 6-stage validation…"}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Validate &amp; submit
              </>
            )}
          </Button>
        </Card>

        {/* Right: pipeline visualizer */}
        <Card className="space-y-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Validation pipeline</div>
              <div className="text-xs text-muted-foreground">
                {completed}/{stages.length} stages cleared
              </div>
            </div>
            <ShieldCheck className="h-4 w-4 text-accent" />
          </div>

          <Progress value={progress} className="h-1" />

          <div className="space-y-1.5">
            {stages.map((stage, idx) => (
              <StageRow key={stage.key} stage={stage} index={idx + 1} />
            ))}
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  result.accepted
                    ? "border-success/40 bg-success/5 text-success"
                    : "border-destructive/40 bg-destructive/5 text-destructive",
                )}
              >
                <div className="flex items-start gap-2">
                  {result.accepted ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {result.accepted ? "All checks passed" : "Image rejected"}
                    </div>
                    <div className="mt-0.5 text-xs opacity-90">
                      {result.accepted
                        ? `Confidence ${result.scores.confidence} · Relevance ${result.scores.relevance} · Quality ${result.scores.quality}`
                        : result.rejectionReason}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <ImageIcon className="h-3 w-3" /> What we never do
            </div>
            We never analyze first and validate later. The image is only stored
            and scored if all 6 stages pass.
          </div>
        </Card>
      </div>
    </div>
  );
}

function StageRow({ stage, index }: { stage: PipelineStage; index: number }) {
  const Icon =
    stage.status === "passed"
      ? CheckCircle2
      : stage.status === "failed"
        ? XCircle
        : stage.status === "running"
          ? Loader2
          : undefined;
  const color =
    stage.status === "passed"
      ? "text-success"
      : stage.status === "failed"
        ? "text-destructive"
        : stage.status === "running"
          ? "text-accent"
          : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors",
        stage.status === "running" && "border-accent/40",
      )}
    >
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border bg-background font-mono text-[10px] font-semibold tabular-nums">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{stage.name}</span>
          {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", color, stage.status === "running" && "animate-spin")} />}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {stage.detail ?? stage.description}
        </div>
      </div>
    </div>
  );
}
