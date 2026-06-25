// Public landing page — explains what CivicLens AI does for Yangon residents.
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Map as MapIcon,
  MessageSquare,
  Phone,
  Languages,
  Bell,
  Building2,
  Camera,
  Users,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/lib/auth-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicLens AI — Report & Fix Civic Issues in Yangon" },
      {
        name: "description",
        content:
          "CivicLens AI is Yangon's community reporting platform. Snap a photo of road damage, garbage, broken street lights, flooding, or unsafe buildings — your report is auto-routed to the right YCDC / YESC department, tracked on a live city map, and resolved by city authorities.",
      },
      { property: "og:title", content: "CivicLens AI — Yangon Civic Reporting" },
      {
        property: "og:description",
        content:
          "Snap, report, resolve. Built for Yangon residents — bilingual, with live map, community comments, emergency hotlines, and direct routing to the right city department.",
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
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              Built for Yangon · ရန်ကုန်မြို့အတွက်
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Your city, fixed{" "}
              <span className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                faster.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
              CivicLens AI is a community-powered reporting platform for Yangon residents.
              Spot a pothole on Pyay Road? An overflowing bin in Kamayut? A broken street
              light in Hlaing? Take a photo, drop a pin, and your report is automatically
              routed to the right department — YCDC, YESC, or Myanmar Police — and tracked
              publicly until it&apos;s resolved.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Button asChild size="lg">
                <Link to={user ? "/dashboard" : "/auth"}>
                  {user ? "Open dashboard" : "Report an issue"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how">How it works</a>
              </Button>
            </div>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Free · Bilingual EN / မြန်မာ · No app install required
            </p>
          </motion.div>
        </div>
      </section>

      {/* What it is */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-accent">
                What is CivicLens AI?
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                One place for every civic problem in Yangon.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Yangon residents face daily frustrations — broken roads, uncollected garbage,
                dark streets, drainage floods, vandalism, unsafe buildings. Reporting them
                today means calling hotlines, sending Facebook messages, or hoping someone
                from the right ward office sees the issue. Most reports get lost.
              </p>
              <p className="mt-3 text-muted-foreground">
                CivicLens AI replaces all of that with one simple workflow. Anyone in Yangon
                can submit a verified photo report in under a minute. The platform automatically
                identifies the responsible department, places the issue on a live city map, and
                gives residents a public, transparent record of whether — and when — it gets fixed.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-4 font-medium">What you can report</div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {[
                  ["🛣️", "Road damage", "Potholes, cracked pavement, broken sidewalks"],
                  ["🗑️", "Garbage & waste", "Overflowing bins, illegal dumping sites"],
                  ["💡", "Street lights", "Broken poles, dark streets at night"],
                  ["💧", "Water & drainage", "Flooded streets, blocked storm drains"],
                  ["🚧", "Public safety", "Exposed wires, damaged traffic signs"],
                  ["🎨", "Vandalism", "Graffiti, defaced public property"],
                  ["🏗️", "Building hazards", "Unsafe scaffolding, falling debris risk"],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex items-start gap-2.5 rounded-md border border-border/50 bg-background p-2.5">
                    <span className="text-base">{icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{title}</div>
                      <div className="text-[11px] text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-b border-border bg-secondary/20">
        <div className="mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="mb-12 text-center">
            <div className="font-mono text-xs uppercase tracking-widest text-accent">
              How it works
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Four steps. From photo to fix.
            </h2>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["1", Camera, "Snap a photo", "Open CivicLens AI, choose the category, attach a clear photo of the issue."],
              ["2", MapIcon, "Pin the location", "We auto-capture your GPS, or you drop a pin anywhere on the Yangon map."],
              ["3", Building2, "Auto-routed", "Your report is automatically assigned to the right authority — YCDC, YESC, or Police."],
              ["4", CheckCircle2, "Tracked & resolved", "Follow the status live. When an admin marks it resolved, you get notified."],
            ] as const).map(([n, Icon, title, body], idx) => {
            ] as const).map(([n, Icon, title, body]) => (
              <li
                key={n}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="grid h-8 w-8 place-items-center rounded-md border border-border bg-background font-mono text-sm font-semibold tabular-nums">
                    {n}
                  </div>
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div className="font-medium">{title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{body}</div>
              </li>
            ))}
          </ol>

        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="mb-10 max-w-2xl">
            <div className="font-mono text-xs uppercase tracking-widest text-accent">
              Why it matters
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Better than a hotline. Better than a Facebook post.
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {[
              {
                icon: Building2,
                title: "Routed to the right office",
                body: "Every category maps to a real Yangon department — YCDC Roads & Bridges, YESC, Pollution Control, Police, City Planning. No more guessing who to call.",
              },
              {
                icon: MapIcon,
                title: "Live Yangon map",
                body: "See every reported issue in your township, filter by category, and watch your neighbourhood improve in real time.",
              },
              {
                icon: Users,
                title: "Community-verified",
                body: "Comment, like, and confirm reports submitted by your neighbours. More voices → faster fixes.",
              },
              {
                icon: ShieldCheck,
                title: "AI-validated photos",
                body: "Every image passes a 6-stage validation pipeline so spam, duplicates, and irrelevant photos never reach city moderators.",
              },
              {
                icon: Bell,
                title: "You get notified",
                body: "When an admin updates or resolves your report, you receive an instant in-app notification.",
              },
              {
                icon: Phone,
                title: "Emergency one-tap",
                body: "Police 199, Fire 191, Ambulance 192, YCDC 1888, Electricity 1910 — all dial-ready from the header.",
              },
              {
                icon: Languages,
                title: "Bilingual EN / မြန်မာ",
                body: "Switch languages in one tap. Designed for every Yangon resident, not just English speakers.",
              },
              {
                icon: MessageSquare,
                title: "AI assistant",
                body: "A built-in chatbot answers your questions about CivicLens AI, departments, and how to report effectively.",
              },
              {
                icon: Activity,
                title: "Public transparency",
                body: "Reports, statuses, and resolution times are visible to everyone — accountability built in.",
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

      {/* Who it's for */}
      <section className="border-b border-border bg-secondary/20">
        <div className="mx-auto max-w-5xl px-4 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-6">
              <Users className="h-5 w-5 text-accent" />
              <div className="mt-3 font-medium">For residents</div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Report any civic issue in your township in under 60 seconds. Track every report
                you&apos;ve submitted, see what neighbours are reporting, and get notified when
                things get fixed.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <Building2 className="h-5 w-5 text-accent" />
              <div className="mt-3 font-medium">For city departments</div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                A single moderation queue with AI-verified evidence, auto-assigned by category.
                Skip the spam — focus on real issues with location, severity, and impact already scored.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <div className="mt-3 font-medium">For Yangon as a whole</div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                A transparent public record of every reported issue, accelerating
                accountability between residents and city authorities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:px-8 lg:py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Make Yangon better, one report at a time.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Join your neighbours in keeping the city accountable. It takes less than a minute.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button asChild size="lg">
              <Link to={user ? "/reports/new" : "/auth"}>
                {user ? "Submit a report" : "Create free account"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 lg:flex-row lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span>Built for Yangon · ရန်ကုန်</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
