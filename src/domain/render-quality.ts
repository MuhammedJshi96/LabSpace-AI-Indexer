/** Browser-only presentation preferences, deliberately outside the project schema. */
export type RenderQuality = "low" | "balanced" | "high";
export type RenderSurface = "room" | "studio" | "facility";

export const RENDER_QUALITY_OPTIONS: Array<{
  value: RenderQuality;
  label: string;
  description: string;
}> = [
  {
    value: "low",
    label: "Low",
    description: "Lighter shadows and resolution. Every object stays visible.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Base lighting and finish detail. Recommended for everyday editing.",
  },
  {
    value: "high",
    label: "High",
    description: "Soft shadows, fine coating grain and brushed-metal detail. Uses more GPU memory.",
  },
];

export function normalizeRenderQuality(value: unknown): RenderQuality {
  if (value === "low" || value === "performance") return "low";
  if (value === "high" || value === "detail") return "high";
  return "balanced";
}

export function renderQualityPreset(quality: RenderQuality, surface: RenderSurface = "room") {
  const balancedShadowSize = surface === "room" ? 2048 : surface === "studio" ? 1024 : 1536;
  return {
    dpr: (quality === "low"
      ? [0.75, 1]
      : quality === "high"
        ? [1, 2]
        : [1, surface === "facility" ? 1.45 : 1.5]) as [number, number],
    shadowSize: quality === "low" ? 512 : quality === "high" ? 2048 : balancedShadowSize,
    softShadows: quality === "high",
    contactShadows: quality !== "low",
    environmentMultiplier: 1,
    keyMultiplier: 1,
    fillMultiplier: quality === "high" ? 0.78 : 1,
  };
}
