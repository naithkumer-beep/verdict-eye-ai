// Single source of truth for report categories and their AI acceptance criteria.
// Used both by the UI (form selects, badges) and the AI relevance prompt.

export const REPORT_CATEGORIES = [
  {
    value: "road_damage",
    label: "Road Damage",
    description: "Potholes, cracked roads, damaged pavement, broken sidewalks",
    accepts: "potholes, cracked roads, damaged pavement, broken sidewalks, road surface failures",
    rejects: "selfies, food, pets, screenshots, memes, undamaged cars, random objects",
  },
  {
    value: "garbage",
    label: "Garbage / Waste",
    description: "Trash piles, waste accumulation, illegal dumping sites",
    accepts: "trash piles, waste accumulation, illegal dumping, overflowing bins",
    rejects: "selfies, food, pets, screenshots, memes, indoor scenes unrelated to waste",
  },
  {
    value: "street_light",
    label: "Street Light",
    description: "Broken streetlights, damaged poles, non-functioning lights",
    accepts: "broken streetlights, damaged light poles, non-functioning street lighting",
    rejects: "indoor lamps, vehicle headlights, decorative lights, random unrelated objects",
  },
  {
    value: "water_drainage",
    label: "Water & Drainage",
    description: "Flooding, blocked drains, water leaks, sewer issues",
    accepts: "flooded streets, blocked storm drains, water leaks, broken sewer covers",
    rejects: "swimming pools, beaches, indoor plumbing, drinking water",
  },
  {
    value: "public_safety",
    label: "Public Safety",
    description: "Hazards in public spaces — damaged signs, exposed wires, unsafe structures",
    accepts: "exposed electrical wires, damaged traffic signs, unsafe public structures",
    rejects: "private property issues, indoor hazards, personal items",
  },
  {
    value: "vandalism",
    label: "Vandalism",
    description: "Graffiti, property defacement, broken public property",
    accepts: "graffiti on public property, broken public benches, defaced public signs",
    rejects: "legal street art, indoor art, private property, posters",
  },
  {
    value: "building_hazard",
    label: "Building / Construction Hazard",
    description: "Unsafe construction, structural damage, falling debris risks",
    accepts: "structural damage, unsafe scaffolding, crumbling buildings, falling debris hazards",
    rejects: "completed buildings, interior decoration, real estate photos",
  },
] as const;

export type CategoryValue = (typeof REPORT_CATEGORIES)[number]["value"];

export const CATEGORY_MAP = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.value, c]),
) as Record<CategoryValue, (typeof REPORT_CATEGORIES)[number]>;

export function getCategoryLabel(value: string): string {
  return CATEGORY_MAP[value as CategoryValue]?.label ?? value;
}
