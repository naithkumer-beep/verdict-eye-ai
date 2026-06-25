// Emergency call directory for Yangon, Myanmar.
import { createFileRoute } from "@tanstack/react-router";
import { Phone, Flame, Heart, Building2, Zap, Shield, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/emergency")({
  head: () => ({ meta: [{ title: "Emergency — CivicLens AI" }] }),
  component: EmergencyPage,
});

interface Hotline {
  key: string;
  icon: typeof Phone;
  color: string;
  number: string;
}

const HOTLINES: Hotline[] = [
  { key: "police", icon: Shield, color: "text-blue-500", number: "199" },
  { key: "fire", icon: Flame, color: "text-orange-500", number: "191" },
  { key: "ambulance", icon: Stethoscope, color: "text-red-500", number: "192" },
  { key: "ycdc", icon: Building2, color: "text-emerald-500", number: "1888" },
  { key: "electricity", icon: Zap, color: "text-yellow-500", number: "1910" },
  { key: "redCross", icon: Heart, color: "text-pink-500", number: "+95-1-383683" },
];

function EmergencyPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 lg:px-8">
      <div>
        <div className="font-mono text-xs uppercase tracking-wider text-destructive">
          {t("emergency.badge")}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("emergency.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("emergency.subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {HOTLINES.map((h) => {
          const Icon = h.icon;
          return (
            <Card key={h.key} className="p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted">
                  <Icon className={`h-6 w-6 ${h.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{t(`emergency.${h.key}`)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{h.description}</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="font-mono text-2xl font-semibold tabular-nums">{h.number}</div>
                    <Button asChild size="sm" variant="destructive">
                      <a href={`tel:${h.number.replace(/[^+0-9]/g, "")}`}>
                        <Phone className="mr-1.5 h-3.5 w-3.5" />
                        {t("emergency.callNow")}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="font-medium text-destructive">⚠ For life-threatening emergencies</div>
        <p className="mt-1 text-muted-foreground">
          Always call directly — do not rely on submitting a CivicLens AI report. Use this platform
          for non-urgent civic issues such as potholes, garbage, broken street lights, drainage, and
          vandalism.
        </p>
      </Card>
    </div>
  );
}
