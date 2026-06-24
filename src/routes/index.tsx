// Public landing page — overview of the platform.
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  Activity,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/lib/auth-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicLens AI — Yangon Civic Reporting" },
      {
        name: "description",
        content:
          "Report civic issues across Yangon — road damage, garbage, broken street lights, drainage. Bilingual (English / မြန်မာ) with a 6-stage AI validation pipeline.",
      },
      { property: "og:title", content: "CivicLens AI — built for Yangon" },
      {
        property: "og:description",
        content:
          "Live city map, comments, reactions, real-time admin updates, emergency hotlines, and bilingual UI for Yangon residents.",
      },

    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  Open dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth" search={{ mode: "signup" } as never}>
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="bg-noise absolute inset-0" />
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              Six-stage AI validation pipeline
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              AI image analysis you can{" "}
              <span className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                actually trust.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              CIAP rejects irrelevant, duplicate, low-quality, and low-confidence
              images <em>before</em> any analysis runs. Every report ships with an
              auditable confidence score.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="lg">
                <Link to={user ? "/dashboard" : "/auth"}>
                  {user ? "Open dashboard" : "Start analyzing"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#pipeline">See the pipeline</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Cross-validated",
                body: "Five-pass AI evaluation — object detection, scene understanding, classification, impact, consistency.",
              },
              {
                icon: Layers,
                title: "Anti-spam by default",
                body: "Perceptual hashing + embedding similarity blocks duplicates and previously submitted images.",
              },
              {
                icon: Sparkles,
                title: "Never hallucinates",
                body: "Confidence ≥85%, relevance ≥85%, quality ≥80% — or the image is rejected before analysis.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-card p-6">
                  <Icon className="h-5 w-5 text-accent" />
                  <div className="mt-3 font-medium">{f.title}</div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="mb-12 text-center">
            <div className="font-mono text-xs uppercase tracking-widest text-accent">
              The pipeline
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Every image clears six checks
            </h2>
            <p className="mt-3 text-muted-foreground">
              Any failure stops analysis and surfaces a clear reason.
            </p>
          </div>

          <ol className="space-y-2">
            {[
              ["1", "Technical validation", "Format, size, resolution, corruption, mime sniffing."],
              ["2", "Quality assessment", "Blur, darkness, exposure, resolution, obstructions."],
              ["3", "Relevance detection", "Does the image actually match the selected category?"],
              ["4", "Duplicate detection", "Perceptual hash against historical submissions."],
              ["5", "AI cross-validation", "Five evaluations across object, scene, class, impact, consistency."],
              ["6", "Confidence thresholds", "Confidence ≥85, Relevance ≥85, Quality ≥80 — or rejected."],
            ].map(([n, title, body]) => (
              <li
                key={n}
                className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/50"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background font-mono text-sm font-semibold tabular-nums">
                  {n}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{title}</div>
                  <div className="text-sm text-muted-foreground">{body}</div>
                </div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Accept / Reject demo */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-success/30 bg-success/5 p-6">
              <div className="mb-3 flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-mono text-xs uppercase tracking-wider">Accepted</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div>Pothole on damaged pavement</div>
                <div>Overflowing waste bin</div>
                <div>Broken streetlight pole</div>
                <div>Blocked storm drain</div>
              </div>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
              <div className="mb-3 flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="font-mono text-xs uppercase tracking-wider">Rejected</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div>Selfies, food, pets</div>
                <div>Screenshots, memes</div>
                <div>Off-category content</div>
                <div>Blurry / dark / duplicate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 lg:flex-row lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span>System operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
