// Map view of all reports across Yangon, filterable by status and category.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { YangonMap, type MapMarker } from "@/components/yangon-map";
import { useTranslation } from "react-i18next";
import { REPORT_CATEGORIES, getCategoryLabel } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({ meta: [{ title: "Map — CivicLens AI" }] }),
  component: MapPage,
});


const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  analyzing: "bg-info/15 text-info border-info/30",
  verified: "bg-success/15 text-success border-success/30",
  resolved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

function MapPage() {
  const { t } = useTranslation();
  const { data: reports = [] } = useQuery({
    queryKey: ["map-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id,title,status,category,latitude,longitude")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markers: MapMarker[] = reports
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id,
      lat: r.latitude as number,
      lng: r.longitude as number,
      title: r.title,
      status: r.status ?? undefined,
      href: `/reports/${r.id}`,
    }));

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Live map
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("nav.map")} — Yangon
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {Object.entries({
            pending: "Pending",
            analyzing: "Analyzing",
            verified: "Verified",
            resolved: "Resolved",
            rejected: "Rejected",
          }).map(([k, label]) => (
            <Badge key={k} variant="outline" className={`font-mono text-[10px] uppercase ${STATUS_COLORS[k]}`}>
              {label}
            </Badge>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <ClientOnly fallback={<div className="grid h-[560px] place-items-center text-sm text-muted-foreground">Loading map…</div>}>
          <YangonMap markers={markers} height="560px" zoom={12} />
        </ClientOnly>

      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" /> Reports on map ({markers.length})
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reports.slice(0, 24).map((r) => (
            <Link
              key={r.id}
              to="/reports/$id"
              params={{ id: r.id }}
              className="block rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{r.title}</span>
                <Badge
                  variant="outline"
                  className={`shrink-0 font-mono text-[9px] uppercase ${STATUS_COLORS[r.status ?? ""]}`}
                >
                  {r.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
