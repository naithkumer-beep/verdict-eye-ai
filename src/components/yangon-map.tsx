// Leaflet-based map centered on Yangon. SSR-safe via dynamic ClientOnly wrap.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for bundlers
const DefaultIcon = L.icon({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export const YANGON_CENTER: [number, number] = [16.8409, 96.1735];

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  status?: string;
  href?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  analyzing: "#3b82f6",
  verified: "#10b981",
  resolved: "#22c55e",
  rejected: "#ef4444",
};

function coloredIcon(color: string) {
  return L.divIcon({
    className: "civiclens-marker",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3),0 2px 6px rgba(0,0,0,.4);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export interface YangonMapProps {
  markers?: MapMarker[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  pickable?: boolean;
  picked?: [number, number] | null;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}

export function YangonMap({
  markers = [],
  center = YANGON_CENTER,
  zoom = 12,
  height = "400px",
  pickable = false,
  picked = null,
  onPick,
  className,
}: YangonMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (pickable && onPick) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onPick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update report markers
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.clearLayers();
    for (const m of markers) {
      const color = STATUS_COLORS[m.status ?? "pending"] ?? "#6b7280";
      const marker = L.marker([m.lat, m.lng], { icon: coloredIcon(color) });
      marker.bindPopup(
        `<div style="font-family:system-ui;font-size:13px;font-weight:500">${escapeHtml(m.title)}</div>${
          m.status
            ? `<div style="font-size:11px;text-transform:uppercase;color:${color};font-weight:600;margin-top:2px">${m.status}</div>`
            : ""
        }${
          m.href
            ? `<a href="${m.href}" style="font-size:11px;color:#3b82f6;margin-top:4px;display:inline-block">Open report →</a>`
            : ""
        }`,
      );
      marker.addTo(layerRef.current);
    }
  }, [markers]);

  // Update pick marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (pickMarkerRef.current) {
      pickMarkerRef.current.remove();
      pickMarkerRef.current = null;
    }
    if (picked) {
      pickMarkerRef.current = L.marker(picked, {
        icon: coloredIcon("#10b981"),
      }).addTo(mapRef.current);
    }
  }, [picked]);

  return (
    <div
      ref={ref}
      className={className ?? "w-full overflow-hidden rounded-lg border border-border"}
      style={{ height }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
