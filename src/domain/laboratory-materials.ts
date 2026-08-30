export type LaboratoryFloorPattern = "speckled" | "slab-joints" | "sheet-seams";

export type LaboratoryFloorFinish = {
  id: string;
  label: string;
  aliases: readonly string[];
  description: string;
  textureKind?: "epoxy" | "vinyl" | "limestone" | "oak" | "terrazzo";
  textureRepeat: readonly [number, number];
  color: string;
  planColor: string;
  pattern: LaboratoryFloorPattern;
  patternColor: string;
  patternSpacingMm: number;
  patternOpacity: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  bumpScale: number;
};

export const DEFAULT_LABORATORY_FLOOR_FINISH_ID = "light-gray-epoxy";

export const LABORATORY_FLOOR_FINISHES: readonly LaboratoryFloorFinish[] = [
  {
    id: DEFAULT_LABORATORY_FLOOR_FINISH_ID,
    label: "Light-gray epoxy",
    aliases: ["epoxy", "light grey epoxy", "light-gray epoxy", "light gray epoxy"],
    description: "Seamless, chemical-resistant laboratory epoxy with a subtle aggregate texture.",
    textureKind: "epoxy",
    textureRepeat: [4, 4],
    color: "#cfd6d3",
    planColor: "#eef2f0",
    pattern: "speckled",
    patternColor: "#aeb9b5",
    patternSpacingMm: 420,
    patternOpacity: 0.28,
    roughness: 0.62,
    metalness: 0.04,
    clearcoat: 0.12,
    clearcoatRoughness: 0.38,
    bumpScale: 0.0012,
  },
  {
    id: "sealed-concrete",
    label: "Sealed concrete",
    aliases: ["concrete", "sealed concrete", "polished concrete"],
    description: "Neutral sealed concrete for utility, pilot-plant, and equipment-support areas.",
    textureRepeat: [1, 1],
    color: "#aeb2ae",
    planColor: "#d8dbd7",
    pattern: "slab-joints",
    patternColor: "#8e9691",
    patternSpacingMm: 2400,
    patternOpacity: 0.34,
    roughness: 0.78,
    metalness: 0.01,
    clearcoat: 0.04,
    clearcoatRoughness: 0.72,
    bumpScale: 0,
  },
  {
    id: "vinyl-sheet",
    label: "Welded vinyl sheet",
    aliases: ["vinyl", "vinyl sheet", "welded vinyl", "sheet vinyl"],
    description: "Resilient welded sheet flooring with cleanable, coved-flooring visual cues.",
    textureKind: "vinyl",
    textureRepeat: [1, 1],
    color: "#b9c9c4",
    planColor: "#dce8e4",
    pattern: "sheet-seams",
    patternColor: "#8fa8a1",
    patternSpacingMm: 2000,
    patternOpacity: 0.3,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.09,
    clearcoatRoughness: 0.48,
    bumpScale: 0,
  },
  {
    id: "warm-welded-vinyl",
    label: "Warm welded laboratory vinyl",
    aliases: ["warm vinyl", "warm welded vinyl", "beige laboratory vinyl", "warm laboratory floor"],
    description:
      "Warm neutral welded sheet flooring for instrument laboratories and bright clinical interiors.",
    textureKind: "vinyl",
    textureRepeat: [1, 1],
    color: "#b8ae9c",
    planColor: "#e4ddd1",
    pattern: "sheet-seams",
    patternColor: "#978b78",
    patternSpacingMm: 2000,
    patternOpacity: 0.2,
    roughness: 0.66,
    metalness: 0,
    clearcoat: 0.11,
    clearcoatRoughness: 0.5,
    bumpScale: 0,
  },
  {
    id: "blue-gray-static-dissipative",
    label: "Blue-gray static-dissipative vinyl",
    aliases: ["esd vinyl", "static dissipative", "blue gray vinyl"],
    description:
      "Cool blue-gray static-dissipative sheet flooring for electronics and analytical instrument rooms.",
    textureKind: "vinyl",
    textureRepeat: [1, 1],
    color: "#9eafb2",
    planColor: "#d3e0e2",
    pattern: "sheet-seams",
    patternColor: "#81979b",
    patternSpacingMm: 2000,
    patternOpacity: 0.24,
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
    bumpScale: 0,
  },
  {
    id: "light-terrazzo-resin",
    label: "Light terrazzo resin",
    aliases: ["terrazzo", "resin terrazzo", "light terrazzo"],
    description:
      "Bright seamless resin terrazzo with restrained aggregate for public-facing laboratories.",
    textureRepeat: [2, 2],
    color: "#c9c7bf",
    planColor: "#ebe9e2",
    pattern: "speckled",
    patternColor: "#a9a69d",
    patternSpacingMm: 330,
    patternOpacity: 0.32,
    roughness: 0.58,
    metalness: 0.01,
    clearcoat: 0.14,
    clearcoatRoughness: 0.4,
    bumpScale: 0,
  },
  ...(
    [
      [
        "ivory-porcelain",
        "Ivory large-format porcelain",
        "limestone",
        "#eee8dd",
        "#f1ece3",
        "slab-joints",
        1200,
        0.28,
      ],
      [
        "pearl-terrazzo",
        "Pearl architectural terrazzo",
        "terrazzo",
        "#e4dfd2",
        "#ede9df",
        "speckled",
        600,
        0.35,
      ],
      [
        "pale-oak-office",
        "Pale oak · office finish",
        "oak",
        "#ddc7a6",
        "#e8d5b6",
        "sheet-seams",
        180,
        0.42,
      ],
      [
        "graphite-porcelain",
        "Graphite honed porcelain",
        "limestone",
        "#727a79",
        "#bcc3c1",
        "slab-joints",
        900,
        0.42,
      ],
    ] as const
  ).map(
    ([
      id,
      label,
      textureKind,
      color,
      planColor,
      pattern,
      patternSpacingMm,
      roughness,
    ]): LaboratoryFloorFinish => ({
      id,
      label,
      aliases: [],
      textureKind,
      color,
      planColor,
      pattern,
      patternSpacingMm,
      roughness,
      description:
        textureKind === "oak"
          ? "Warm office and meeting-room finish; not a wet-laboratory specification."
          : "Architectural presentation finish. Confirm cleanability, chemical resistance and slip ratings for the intended room.",
      textureRepeat: textureKind === "oak" ? [0.7, 0.7] : [1, 1],
      patternColor: "#a4a49b",
      patternOpacity: 0.22,
      metalness: 0.01,
      clearcoat: 0.22,
      clearcoatRoughness: 0.3,
      bumpScale: 0.0005,
    }),
  ),
] as const;

const finishesById = new Map(LABORATORY_FLOOR_FINISHES.map((finish) => [finish.id, finish]));
const finishesByAlias = new Map(
  LABORATORY_FLOOR_FINISHES.flatMap((finish) =>
    [finish.label, ...finish.aliases].map((alias) => [alias.trim().toLowerCase(), finish] as const),
  ),
);

export function findLaboratoryFloorFinish(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return finishesById.get(normalized) ?? finishesByAlias.get(normalized.toLowerCase());
}

export function resolveLaboratoryFloorFinish(value: string | null | undefined) {
  return findLaboratoryFloorFinish(value) ?? finishesById.get(DEFAULT_LABORATORY_FLOOR_FINISH_ID)!;
}

export function laboratoryFloorFinishLabel(value: string | null | undefined) {
  return findLaboratoryFloorFinish(value)?.label ?? (value?.trim() || "Unspecified");
}
