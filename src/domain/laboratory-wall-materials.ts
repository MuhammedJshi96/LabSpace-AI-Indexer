export type LaboratoryWallFinish = {
  id: string;
  label: string;
  aliases: readonly string[];
  description: string;
  color: string;
  planColor: string;
  planEdgeColor: string;
  baseboardColor: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
};

export const DEFAULT_LABORATORY_WALL_FINISH_ID = "clean-white-panel";

export const LABORATORY_WALL_FINISHES: readonly LaboratoryWallFinish[] = [
  {
    id: DEFAULT_LABORATORY_WALL_FINISH_ID,
    label: "Clean white hygienic panel",
    aliases: ["white wall", "hygienic panel", "cleanroom white"],
    description: "Low-sheen, cleanable white panel system for general wet and analytical laboratories.",
    color: "#edf1ef",
    planColor: "#424b4d",
    planEdgeColor: "#252d2f",
    baseboardColor: "#8d9996",
    roughness: 0.62,
    metalness: 0.02,
    clearcoat: 0.08,
    clearcoatRoughness: 0.52,
  },
  {
    id: "cool-gray-resin-panel",
    label: "Cool-gray resin panel",
    aliases: ["gray wall", "grey wall", "resin panel"],
    description: "Cool neutral resin-faced laboratory panel with a durable satin surface.",
    color: "#cbd2d0",
    planColor: "#596463",
    planEdgeColor: "#303a3a",
    baseboardColor: "#7d8a87",
    roughness: 0.56,
    metalness: 0.04,
    clearcoat: 0.12,
    clearcoatRoughness: 0.42,
  },
  {
    id: "satin-stainless-steel",
    label: "Satin stainless steel",
    aliases: ["stainless wall", "steel wall", "satin steel"],
    description: "Brushed stainless wall lining for wash-up, process, and high-cleanability zones.",
    color: "#aeb9b7",
    planColor: "#64706f",
    planEdgeColor: "#35403f",
    baseboardColor: "#778381",
    roughness: 0.28,
    metalness: 0.78,
    clearcoat: 0.18,
    clearcoatRoughness: 0.24,
  },
  {
    id: "white-painted-masonry",
    label: "White painted masonry",
    aliases: ["painted concrete", "painted block", "masonry"],
    description: "Sealed white masonry finish for utility laboratories and equipment-support rooms.",
    color: "#e3e5df",
    planColor: "#4d5555",
    planEdgeColor: "#293131",
    baseboardColor: "#747e7c",
    roughness: 0.82,
    metalness: 0,
    clearcoat: 0.02,
    clearcoatRoughness: 0.8,
  },
  {
    id: "light-ceramic-tile",
    label: "Light ceramic tile",
    aliases: ["tile", "ceramic", "white tile"],
    description: "Light glazed ceramic wall tile for sinks, wash rooms, and splash-prone work zones.",
    color: "#e6e8e4",
    planColor: "#56605f",
    planEdgeColor: "#303838",
    baseboardColor: "#88928f",
    roughness: 0.34,
    metalness: 0.01,
    clearcoat: 0.32,
    clearcoatRoughness: 0.22,
  },
  {
    id: "soft-warm-gray-panel",
    label: "Warm-gray laboratory panel",
    aliases: ["warm gray", "warm grey", "warm panel"],
    description: "Soft warm-gray cleanable panel for bright instrument laboratories and offices.",
    color: "#d4d0c7",
    planColor: "#5b5b57",
    planEdgeColor: "#333431",
    baseboardColor: "#85837c",
    roughness: 0.66,
    metalness: 0.01,
    clearcoat: 0.07,
    clearcoatRoughness: 0.52,
  },
] as const;

const finishesById = new Map(LABORATORY_WALL_FINISHES.map((finish) => [finish.id, finish]));
const finishesByAlias = new Map(
  LABORATORY_WALL_FINISHES.flatMap((finish) =>
    [finish.label, ...finish.aliases].map((alias) => [alias.trim().toLowerCase(), finish] as const),
  ),
);

export function findLaboratoryWallFinish(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return finishesById.get(normalized) ?? finishesByAlias.get(normalized.toLowerCase());
}

export function resolveLaboratoryWallFinish(value: string | null | undefined) {
  return findLaboratoryWallFinish(value) ?? finishesById.get(DEFAULT_LABORATORY_WALL_FINISH_ID)!;
}

export function wallFinishForObject(
  metadata: Record<string, unknown>,
  roomWallFinish: string | null | undefined,
) {
  const override = typeof metadata.wallFinishId === "string" ? metadata.wallFinishId : undefined;
  return resolveLaboratoryWallFinish(override ?? roomWallFinish);
}
