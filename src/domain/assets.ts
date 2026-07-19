import {
  AssetDefinitionSchema,
  type AssetCategory,
  type AssetDefinition,
  type Dimensions,
} from "./schema";

type AssetOptions = Partial<
  Pick<
    AssetDefinition,
    | "shortName"
    | "connection"
    | "indexingBehavior"
    | "anchor"
    | "profile"
    | "material"
    | "accent"
    | "description"
    | "objectType"
    | "storageTemplate"
    | "model3d"
  >
>;

type AssetStorageTemplate = NonNullable<AssetDefinition["storageTemplate"]>;

const materialAccent: Record<AssetDefinition["material"], string> = {
  white: "#aab4b2",
  steel: "#7c8a89",
  dark: "#334044",
  glass: "#79aeb4",
  yellow: "#d4a51f",
  red: "#c65b57",
  blue: "#3d7590",
};

function drawerBank(
  keyPrefix: string,
  label: string,
  count: number,
  x: number,
  z: number,
  width = 0.2,
): AssetStorageTemplate {
  const slot = 0.6 / count;
  return Array.from({ length: count }, (_, index) => ({
    key: `${keyPrefix}-${index + 1}`,
    type: "drawer" as const,
    name: `${label} drawer ${index + 1}`,
    normalizedBounds: {
      x,
      y: 0.16 + (count - index - 1) * slot,
      z,
      width,
      depth: 0.08,
      height: slot * 0.82,
    },
  }));
}

function cabinetBay(
  key: string,
  name: string,
  x: number,
  z: number,
  width: number,
  y = 0.12,
  height = 0.5,
): AssetStorageTemplate[number] {
  return {
    key,
    type: "compartment",
    name,
    normalizedBounds: { x, y, z, width, depth: 0.08, height },
  };
}

function topDrawer(
  key: string,
  name: string,
  x: number,
  z: number,
  width: number,
): AssetStorageTemplate[number] {
  return {
    key,
    type: "drawer",
    name,
    normalizedBounds: { x, y: 0.72, z, width, depth: 0.08, height: 0.14 },
  };
}

function standardBenchStorage(): AssetStorageTemplate {
  return [
    ...drawerBank("left-bank", "Left bank", 3, -0.38, -0.46, 0.2),
    ...drawerBank("right-bank", "Right bank", 3, 0.38, -0.46, 0.2),
    topDrawer("center-top-left", "Central upper drawer left", -0.11, -0.46, 0.18),
    topDrawer("center-top-right", "Central upper drawer right", 0.11, -0.46, 0.18),
    cabinetBay("center-cabinet", "Central paired-door cabinet", 0, -0.46, 0.4),
  ];
}

function overheadBenchStorage(): AssetStorageTemplate {
  const hutch: AssetStorageTemplate = Array.from({ length: 3 }, (_, index) => {
    const key = `upper-bay-${index + 1}`;
    return {
      key,
      type: "compartment" as const,
      name: `Upper glazed cabinet ${index + 1}`,
      normalizedBounds: {
        x: (index - 1) * 0.3,
        y: 0.62,
        z: -0.46,
        width: 0.27,
        depth: 0.08,
        height: 0.3,
      },
    };
  });
  const shelves = hutch.flatMap((bay, bayIndex) =>
    [1, 2].map((shelf) => ({
      key: `${bay.key}-shelf-${shelf}`,
      parentKey: bay.key,
      type: "shelf" as const,
      name: `Upper cabinet ${bayIndex + 1} shelf ${shelf}`,
      normalizedBounds: {
        x: 0,
        y: shelf === 1 ? 0.27 : 0.62,
        z: 0,
        width: 0.9,
        depth: 0.86,
        height: 0.08,
      },
    })),
  );
  return [
    ...drawerBank("overhead-left-bank", "Left bank", 3, -0.39, -0.46, 0.18),
    ...drawerBank("overhead-right-bank", "Right bank", 3, 0.39, -0.46, 0.18),
    cabinetBay("overhead-lower-left", "Lower cabinet left", -0.14, -0.46, 0.22),
    cabinetBay("overhead-lower-right", "Lower cabinet right", 0.14, -0.46, 0.22),
    ...hutch,
    ...shelves,
  ];
}

function islandServiceBridgeStorage(): AssetStorageTemplate {
  const locations: AssetStorageTemplate = [];
  for (const face of [
    { key: "front", label: "Front", z: -0.46 },
    { key: "rear", label: "Rear", z: 0.46 },
  ] as const) {
    locations.push(
      ...drawerBank(`${face.key}-left-bank`, `${face.label} left bank`, 3, -0.42, face.z, 0.14),
      ...drawerBank(`${face.key}-right-bank`, `${face.label} right bank`, 3, 0.42, face.z, 0.14),
      topDrawer(`${face.key}-center-1`, `${face.label} central upper drawer 1`, -0.2, face.z, 0.1),
      topDrawer(`${face.key}-center-2`, `${face.label} central upper drawer 2`, -0.07, face.z, 0.1),
      topDrawer(`${face.key}-center-3`, `${face.label} central upper drawer 3`, 0.07, face.z, 0.1),
      topDrawer(`${face.key}-center-4`, `${face.label} central upper drawer 4`, 0.2, face.z, 0.1),
      cabinetBay(
        `${face.key}-cabinet-left`,
        `${face.label} paired-door cabinet left`,
        -0.14,
        face.z,
        0.22,
      ),
      cabinetBay(
        `${face.key}-cabinet-right`,
        `${face.label} paired-door cabinet right`,
        0.14,
        face.z,
        0.22,
      ),
    );
  }
  const hutch = Array.from({ length: 3 }, (_, index) => ({
    key: `bridge-bay-${index + 1}`,
    type: "compartment" as const,
    name: `Service bridge glazed cabinet ${index + 1}`,
    normalizedBounds: {
      x: (index - 1) * 0.3,
      y: 0.62,
      z: 0,
      width: 0.27,
      depth: 0.8,
      height: 0.3,
    },
  }));
  const shelves = hutch.flatMap((bay, bayIndex) =>
    [1, 2].map((shelf) => ({
      key: `${bay.key}-shelf-${shelf}`,
      parentKey: bay.key,
      type: "shelf" as const,
      name: `Service bridge bay ${bayIndex + 1} shelf ${shelf}`,
      normalizedBounds: {
        x: 0,
        y: shelf === 1 ? 0.27 : 0.62,
        z: 0,
        width: 0.9,
        depth: 0.86,
        height: 0.08,
      },
    })),
  );
  return [...locations, ...hutch, ...shelves];
}

function centerIslandStorage(): AssetStorageTemplate {
  return [
    ...drawerBank("front-left", "Front left bank", 3, -0.36, -0.46, 0.18),
    ...drawerBank("front-right", "Front right bank", 3, 0.36, -0.46, 0.18),
    cabinetBay("front-cabinet-left", "Front cabinet left", -0.12, -0.46, 0.2),
    cabinetBay("front-cabinet-right", "Front cabinet right", 0.12, -0.46, 0.2),
    ...drawerBank("rear-left", "Rear left bank", 3, -0.36, 0.46, 0.18),
    ...drawerBank("rear-right", "Rear right bank", 3, 0.36, 0.46, 0.18),
    cabinetBay("rear-cabinet-left", "Rear cabinet left", -0.12, 0.46, 0.2),
    cabinetBay("rear-cabinet-right", "Rear cabinet right", 0.12, 0.46, 0.2),
  ];
}

function bounds(size: Dimensions) {
  return {
    minDimensions: {
      width: Math.max(80, Math.round(size.width * 0.5)),
      depth: Math.max(80, Math.round(size.depth * 0.5)),
      height: Math.max(80, Math.round(size.height * 0.5)),
    },
    maxDimensions: {
      width: Math.round(size.width * 2.5),
      depth: Math.round(size.depth * 2.5),
      height: Math.round(size.height * 1.6),
    },
  };
}

function asset(
  id: string,
  name: string,
  category: AssetCategory,
  dimensions: [number, number, number],
  options: AssetOptions = {},
): AssetDefinition {
  const defaultDimensions = {
    width: dimensions[0],
    depth: dimensions[1],
    height: dimensions[2],
  };
  const material = options.material ?? "white";
  const categoryType =
    category === "Furniture"
      ? "furniture"
      : category === "Storage"
        ? "storage"
        : category === "Laboratory equipment"
          ? "equipment"
          : category === "Safety"
            ? "safety"
            : category === "Utilities"
              ? "utility"
              : "architecture";
  return AssetDefinitionSchema.parse({
    id,
    name,
    shortName: options.shortName ?? name,
    category,
    objectType: options.objectType ?? categoryType,
    defaultDimensions,
    ...bounds(defaultDimensions),
    tags: Array.from(
      new Set([name.toLowerCase(), category.toLowerCase(), ...name.toLowerCase().split(/\s|\//)]),
    ),
    connection: options.connection ?? "floor",
    indexingBehavior:
      options.indexingBehavior ??
      (category === "Storage"
        ? "storage"
        : category === "Laboratory equipment"
          ? "equipment"
          : "object"),
    anchor: options.anchor ?? "center",
    profile: options.profile ?? "box",
    material,
    accent: options.accent ?? materialAccent[material],
    description:
      options.description ??
      `Parametric planning representation of ${name.toLowerCase()}; dimensions are editable and not manufacturer-certified.`,
    storageTemplate: options.storageTemplate,
    model3d: options.model3d,
  });
}

export const ASSET_CATALOG: AssetDefinition[] = [
  asset("straight-wall", "Straight wall", "Architecture", [2400, 150, 3000], {
    objectType: "wall",
    connection: "free",
    indexingBehavior: "none",
    profile: "wall",
    material: "dark",
  }),
  asset("half-height-wall", "Half-height wall", "Architecture", [2400, 150, 1200], {
    objectType: "wall",
    connection: "free",
    indexingBehavior: "none",
    profile: "wall",
    material: "dark",
  }),
  asset("structural-column", "Structural column", "Architecture", [450, 450, 3000], {
    profile: "column",
    indexingBehavior: "none",
  }),
  asset("single-door", "Solid laboratory door", "Architecture", [900, 120, 2100], {
    objectType: "door",
    connection: "wall",
    indexingBehavior: "none",
    profile: "door",
    material: "steel",
    description:
      "Wall-hosted professional laboratory door with a powder-coated steel frame, solid hygienic leaf, perimeter seal, closer rail, kick plate, lever hardware, and editable handing, swing, and elevation.",
    model3d: {
      previewSrc: "/models/hero/single-door.glb",
      authoredDimensions: { width: 900, depth: 120, height: 2100 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("double-door", "Double laboratory door", "Architecture", [1800, 120, 2100], {
    objectType: "door",
    connection: "wall",
    indexingBehavior: "none",
    profile: "door",
    material: "steel",
    description:
      "Wall-hosted double laboratory door with independent leaves, meeting stiles, steel frame, perimeter seals, vision lites, kick plates, lever hardware, and editable handing, swing, and elevation.",
    model3d: {
      previewSrc: "/models/hero/double-door.glb",
      authoredDimensions: { width: 1800, depth: 120, height: 2100 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("sliding-door", "Glazed sliding laboratory door", "Architecture", [1200, 100, 2100], {
    objectType: "door",
    connection: "wall",
    indexingBehavior: "none",
    profile: "door",
    material: "glass",
    description:
      "Wall-hosted single sliding laboratory door with aluminium head track, glazed leaf, lower guide, safety markings, recessed pull, seals, and editable opening width and elevation.",
    model3d: {
      previewSrc: "/models/hero/sliding-door.glb",
      authoredDimensions: { width: 1200, depth: 100, height: 2100 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("narrow-lite-door", "Narrow-lite service door", "Architecture", [900, 140, 2100], {
    objectType: "door",
    connection: "wall",
    indexingBehavior: "none",
    profile: "door",
    material: "steel",
    description:
      "Wall-hosted fire-rated service-door planning asset with a narrow wired-glass vision lite, steel leaf and frame, closer, kick plate, lever set, perimeter smoke seal, and editable handing, swing, and elevation.",
    model3d: {
      previewSrc: "/models/hero/narrow-lite-door.glb",
      authoredDimensions: { width: 900, depth: 140, height: 2100 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("cleanroom-glazed-door", "Glazed cleanroom door", "Architecture", [1000, 120, 2100], {
    objectType: "door",
    connection: "wall",
    indexingBehavior: "none",
    profile: "door",
    material: "glass",
    description:
      "Wall-hosted cleanroom-style door with a flush aluminium frame, large safety-glass panel, solid lower rail, continuous seals, closer and lever hardware, and editable handing, swing, and elevation.",
    model3d: {
      previewSrc: "/models/hero/cleanroom-glazed-door.glb",
      authoredDimensions: { width: 1000, depth: 120, height: 2100 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("double-sliding-door", "Double glazed sliding door", "Architecture", [1800, 100, 2100], {
    objectType: "door",
    connection: "wall",
    indexingBehavior: "none",
    profile: "door",
    material: "glass",
    description:
      "Wall-hosted bi-parting glazed laboratory door with two sliding leaves, aluminium head track and cover, meeting seals, lower guides, recessed pulls, safety markings, and editable opening width and elevation.",
    model3d: {
      previewSrc: "/models/hero/double-sliding-door.glb",
      authoredDimensions: { width: 1800, depth: 100, height: 2100 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("standard-window", "Fixed observation window", "Architecture", [1200, 120, 1200], {
    objectType: "window",
    connection: "wall",
    indexingBehavior: "none",
    profile: "window",
    material: "glass",
    description:
      "Wall-hosted fixed laboratory observation window with a thermally broken aluminium frame, true glass thickness, perimeter gasket, sill, drainage reveal, and editable sill height and dimensions.",
    model3d: {
      previewSrc: "/models/hero/standard-window.glb",
      authoredDimensions: { width: 1200, depth: 120, height: 1200 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("wide-window", "Wide three-pane observation window", "Architecture", [2400, 120, 1200], {
    objectType: "window",
    connection: "wall",
    indexingBehavior: "none",
    profile: "window",
    material: "glass",
    description:
      "Wall-hosted wide laboratory observation window with three glazed bays, structural mullions, aluminium perimeter frame, gaskets, sill and drainage details, and editable sill height and dimensions.",
    model3d: {
      previewSrc: "/models/hero/wide-window.glb",
      authoredDimensions: { width: 2400, depth: 120, height: 1200 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset("sliding-window", "Sliding laboratory window", "Architecture", [1600, 120, 1200], {
    objectType: "window",
    connection: "wall",
    indexingBehavior: "none",
    profile: "window",
    material: "glass",
    description:
      "Wall-hosted two-panel sliding laboratory window with overlapping glazed sashes, twin tracks, meeting stile, recessed latch, aluminium frame, sill and editable sill height and dimensions.",
    model3d: {
      previewSrc: "/models/hero/sliding-window.glb",
      authoredDimensions: { width: 1600, depth: 120, height: 1200 },
      revision: "cleanroom-openings-r1",
    },
  }),
  asset(
    "observation-window",
    "Wide control-room observation window",
    "Architecture",
    [2000, 140, 1000],
    {
      objectType: "window",
      connection: "wall",
      indexingBehavior: "none",
      profile: "window",
      material: "glass",
      description:
        "Wall-hosted low-profile control-room observation window with two large fixed panes, central structural mullion, deep powder-coated frame, laminated glass, gasket, sill and editable sill height and dimensions.",
      model3d: {
        previewSrc: "/models/hero/observation-window.glb",
        authoredDimensions: { width: 2000, depth: 140, height: 1000 },
        revision: "cleanroom-openings-r1",
      },
    },
  ),
  asset("pass-through-window", "Laboratory pass-through window", "Architecture", [900, 300, 900], {
    objectType: "window",
    connection: "wall",
    indexingBehavior: "none",
    profile: "window",
    material: "steel",
    description:
      "Wall-hosted laboratory pass-through opening with a deep stainless transfer liner, framed glazed sliding panels, twin track, recessed pulls, raised service sill and editable sill height and dimensions.",
    model3d: {
      previewSrc: "/models/hero/pass-through-window.glb",
      authoredDimensions: { width: 900, depth: 300, height: 900 },
      revision: "cleanroom-openings-r1",
    },
  }),

  asset("lab-bench", "Standard laboratory bench", "Furniture", [1800, 750, 900], {
    shortName: "Lab bench",
    indexingBehavior: "storage",
    profile: "bench",
    material: "dark",
    storageTemplate: standardBenchStorage(),
    description:
      "Clean Shimadzu-style laboratory base bench with symmetrical three-drawer end banks, a wide central paired-door cabinet, two adjacent upper drawers, consistent 8 mm face reveals, satin aluminum channel pulls, a recessed toe kick, realistic rear service panels, and a black phenolic worktop. This logo-free planning model is dimension-driven and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/lab-bench.glb",
      authoredDimensions: { width: 1800, depth: 750, height: 900 },
      revision: "casework-proportion-r7",
    },
  }),
  asset("lab-bench-sink", "Laboratory bench with sink", "Furniture", [1800, 750, 1200], {
    shortName: "Bench + sink",
    indexingBehavior: "storage",
    profile: "bench",
    material: "dark",
    accent: "#6c9ca3",
    storageTemplate: [
      ...drawerBank("sink-right-bank", "Right bank", 3, 0.38, -0.46, 0.2),
      cabinetBay("sink-left-cabinet", "Left under-bench cabinet", -0.28, -0.46, 0.3),
      cabinetBay("sink-service-cabinet", "Sink service cabinet", 0.02, -0.46, 0.24),
    ],
    description:
      "Professional laboratory sink bench with a chemical-resistant worktop, integrated stainless basin, rear service upstand, mixer fixture, and enclosed base storage. This logo-free, dimension-driven model is a representative planning asset and is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/lab-bench-sink.glb",
      authoredDimensions: { width: 1800, depth: 750, height: 1200 },
      revision: "casework-proportion-r7",
    },
  }),
  asset(
    "lab-bench-overhead",
    "Laboratory bench with overhead cabinets",
    "Furniture",
    [2400, 750, 2100],
    {
      shortName: "Bench + overhead",
      indexingBehavior: "storage",
      profile: "bench",
      material: "dark",
      accent: "#758e93",
      storageTemplate: overheadBenchStorage(),
      description:
        "Full-height laboratory casework assembly with a chemical-resistant worktop, enclosed base cabinets, service upstand, and glazed overhead storage. This logo-free, dimension-driven model is a representative planning asset and is not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/lab-bench-overhead.glb",
        authoredDimensions: { width: 2400, depth: 750, height: 2100 },
        revision: "casework-proportion-r7",
      },
    },
  ),
  asset(
    "stainless-wash-basin",
    "Open stainless laboratory wash basin",
    "Furniture",
    [1800, 700, 1300],
    {
      shortName: "Stainless wash basin",
      profile: "bench",
      material: "steel",
      accent: "#75969a",
      description:
        "Open-front stainless laboratory wash station with a deep integral basin, drainboard, rear splashback, mixer fixture, and exposed service clearance below. This logo-free, dimension-driven model is a representative planning asset and is not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/stainless-wash-basin.glb",
        authoredDimensions: { width: 1800, depth: 700, height: 1300 },
        revision: "casework-proportion-r7",
      },
    },
  ),
  asset(
    "stainless-enclosed-basin",
    "Enclosed stainless laboratory basin",
    "Furniture",
    [1200, 700, 1200],
    {
      shortName: "Enclosed basin",
      indexingBehavior: "storage",
      profile: "bench",
      material: "steel",
      accent: "#6f8e92",
      storageTemplate: [
        cabinetBay("wash-cabinet", "Enclosed wash-basin cabinet", 0, -0.46, 0.82, 0.1, 0.52),
      ],
      description:
        "Compact stainless laboratory basin with an integral sink, rear splashback, mixer fixture, and enclosed service cabinet with durable recessed pulls. This logo-free, dimension-driven model is a representative planning asset and is not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/stainless-enclosed-basin.glb",
        authoredDimensions: { width: 1200, depth: 700, height: 1200 },
        revision: "casework-proportion-r7",
      },
    },
  ),
  asset(
    "island-bench-service-bridge",
    "Island laboratory bench with service bridge",
    "Furniture",
    [3600, 1200, 2100],
    {
      shortName: "Island + service bridge",
      indexingBehavior: "storage",
      profile: "bench",
      material: "steel",
      accent: "#829294",
      storageTemplate: islandServiceBridgeStorage(),
      description:
        "Shimadzu Ref2-informed double-sided island laboratory bench with functional three-drawer stacks at the left and right ends of each working face, two separate central cabinets with paired doors and two adjacent drawers above each cabinet, dark chemical-resistant phenolic worktops, a light metallic service spine, and a raised three-bay glazed sliding-door hutch with two internal shelves. This original logo-free planning model is dimension-driven and not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/island-bench-service-bridge.glb",
        authoredDimensions: { width: 3600, depth: 1200, height: 2100 },
        revision: "shimadzu-ref2-r7",
      },
    },
  ),
  asset("corner-lab-bench", "Corner laboratory bench", "Furniture", [1500, 1500, 900], {
    shortName: "Corner bench",
    indexingBehavior: "storage",
    profile: "corner",
    material: "dark",
    storageTemplate: standardBenchStorage(),
  }),
  asset("center-island-bench", "Center island bench", "Furniture", [3000, 1200, 900], {
    shortName: "Island bench",
    indexingBehavior: "storage",
    profile: "bench",
    material: "dark",
    storageTemplate: centerIslandStorage(),
    model3d: {
      previewSrc: "/models/hero/center-island-bench.glb",
      authoredDimensions: { width: 3000, depth: 1200, height: 900 },
      revision: "casework-proportion-r7",
    },
  }),
  asset("mobile-bench", "Mobile bench", "Furniture", [1200, 700, 900], {
    indexingBehavior: "storage",
    profile: "bench",
    material: "steel",
    storageTemplate: [
      ...drawerBank("mobile-drawers", "Mobile bench", 3, -0.24, -0.46, 0.32),
      cabinetBay("mobile-cabinet", "Mobile bench cabinet", 0.24, -0.46, 0.34),
    ],
  }),
  asset("office-desk", "Office desk", "Furniture", [1400, 700, 740], {
    profile: "table",
    material: "white",
  }),
  asset("rectangular-table", "Rectangular table", "Furniture", [1600, 800, 740], {
    shortName: "Table",
    profile: "table",
    material: "white",
  }),
  asset("round-stool", "Round stool", "Furniture", [440, 440, 520], {
    shortName: "Stool",
    profile: "seat",
    material: "dark",
    description:
      "Room 809 photo-derived mobile laboratory stool with a formed vinyl cushion, chrome foot ring, gas-lift column, five-point powder-coated base, and twin-wheel casters. The orbitable planning model is original, editable, and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/round-stool.glb",
      authoredDimensions: { width: 440, depth: 440, height: 520 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("laboratory-chair", "Laboratory chair", "Furniture", [560, 560, 920], {
    shortName: "Lab chair",
    profile: "seat",
    material: "dark",
    description:
      "Room 809 photo-derived wipe-clean laboratory task chair with separate upholstered seat and back pads, a reinforced back stem, gas lift, five-point mobile base, and detailed casters. The orbitable planning model is original, editable, and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/laboratory-chair.glb",
      authoredDimensions: { width: 560, depth: 560, height: 920 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("office-chair", "Office chair", "Furniture", [620, 620, 980], {
    profile: "seat",
    material: "blue",
    description:
      "Professional laboratory-office task chair with upholstered seat and channel-detailed back, compact armrests, gas lift, five-point base, rear back-shell construction, and twin-wheel casters. The orbitable planning model is original, editable, and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/office-chair.glb",
      authoredDimensions: { width: 620, depth: 620, height: 980 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("wire-basket-trolley", "Wire-basket laboratory trolley", "Furniture", [1050, 650, 1050], {
    shortName: "Wire trolley",
    profile: "rack",
    material: "steel",
    accent: "#416b83",
    description:
      "Room 809 photo-derived wire-mesh transport trolley with a deep basket, tubular push rail, and mobile base; dimensions are editable and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/wire-basket-trolley.glb",
      authoredDimensions: { width: 1050, depth: 650, height: 1050 },
      revision: "room809-r1",
    },
  }),
  asset("rolling-bottle-cart", "Rolling bottle cart", "Furniture", [650, 450, 1000], {
    shortName: "Bottle cart",
    profile: "shelf",
    material: "steel",
    accent: "#5a9b58",
    description:
      "Room 809 photo-derived three-tier stainless bottle cart with rolled tray lips, full guard rails, an integrated push handle, reagent-bottle context, and four casters. The original all-sided planning model is editable and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/rolling-bottle-cart.glb",
      authoredDimensions: { width: 650, depth: 450, height: 1000 },
      revision: "support-batch9-r1",
    },
  }),

  asset("base-cabinet", "Base cabinet", "Storage", [900, 600, 850], {
    profile: "cabinet",
    accent: "#6f807d",
    description:
      "Shimadzu-reference laboratory base cabinet with two adjacent upper drawers over two lower doors, a black satin phenolic top, folded-steel carcass, adjustable interior shelf, slim metallic pulls, consistent face reveals, recessed toe kick, levelling hardware, and rear access construction. This logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/base-cabinet.glb",
      authoredDimensions: { width: 900, depth: 600, height: 850 },
      revision: "casework-proportion-r7",
    },
  }),
  asset("base-drawer-cabinet", "Base drawer cabinet", "Storage", [600, 600, 850], {
    profile: "cabinet",
    accent: "#778482",
    description:
      "Professional three-drawer laboratory base cabinet with reference-scaled drawer fronts, slim integrated pulls, internal runners, folded-steel side and rear construction, black phenolic top, toe kick, and levelling hardware. This logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/base-drawer-cabinet.glb",
      authoredDimensions: { width: 600, depth: 600, height: 850 },
      revision: "casework-proportion-r7",
    },
  }),
  asset("sink-cabinet", "Sink cabinet", "Storage", [1200, 650, 1150], {
    profile: "cabinet",
    accent: "#6c9ca3",
    description:
      "Wide enclosed laboratory sink base with a black chemical-resistant worktop, stainless basin cavity and rim, laboratory mixer, drain trap, rear hot/cold services, double service doors, slim pulls, toe kick, levellers, and access hardware. This logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/sink-cabinet.glb",
      authoredDimensions: { width: 1200, depth: 650, height: 1150 },
      revision: "casework-proportion-r7",
    },
  }),
  asset("wall-cabinet", "Wall cabinet", "Storage", [900, 350, 700], {
    connection: "wall",
    profile: "cabinet",
  }),
  asset("glass-wall-cabinet", "Glass-front wall cabinet", "Storage", [1200, 400, 720], {
    shortName: "Glass cabinet",
    connection: "wall",
    profile: "cabinet",
    material: "glass",
    accent: "#6e9397",
    description:
      "Wide wall-mounted laboratory upper cabinet with overlapping framed low-iron sliding-glass doors, real glass thickness, two adjustable frosted shelves, twin tracks, slim vertical pulls, folded-steel ends, rear cleats, and fasteners. This logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/glass-wall-cabinet.glb",
      authoredDimensions: { width: 1200, depth: 400, height: 720 },
      revision: "casework-proportion-r7",
    },
  }),
  asset("tall-cabinet", "Tall cabinet", "Storage", [1000, 600, 2100], {
    profile: "tall",
    accent: "#687d7a",
    description:
      "Full-height two-door laboratory storage cabinet with wide continuous faces, adjustable interior shelves, slim vertical metallic pulls, restrained hinges, rear access and ventilation, plinth, and levelling feet. This logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/tall-cabinet.glb",
      authoredDimensions: { width: 1000, depth: 600, height: 2100 },
      revision: "casework-proportion-r7",
    },
  }),
  asset("sliding-door-cabinet", "Steel sliding-door cabinet", "Storage", [1200, 500, 1200], {
    shortName: "Sliding cabinet",
    profile: "cabinet",
    material: "steel",
    accent: "#798482",
    description:
      "Reference-derived medium-height laboratory cabinet with two genuinely overlapping folded-steel sliding doors, twin aluminum tracks, recessed vertical pulls, a central lock, adjustable interior shelves, a full plinth, and rear access fasteners. This original logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/sliding-door-cabinet.glb",
      authoredDimensions: { width: 1200, depth: 500, height: 1200 },
      revision: "product-reference-r7",
    },
  }),
  asset("glazed-sliding-cabinet", "Glazed and steel sliding cabinet", "Storage", [900, 500, 2000], {
    shortName: "Glazed sliding cabinet",
    profile: "tall",
    material: "glass",
    accent: "#749397",
    description:
      "Full-height laboratory storage cabinet based on the supplied reference, with upper overlapping framed-glass sliders, lower overlapping steel sliders, visible adjustable shelves and removable bins, separate track sets, a rigid division rail, plinth, and rear service construction. This original logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/glazed-sliding-cabinet.glb",
      authoredDimensions: { width: 900, depth: 500, height: 2000 },
      revision: "product-reference-r7",
    },
  }),
  asset("solvent-cabinet", "Sliding-door solvent cabinet", "Storage", [1000, 500, 1200], {
    shortName: "Solvent cabinet",
    profile: "cabinet",
    material: "steel",
    accent: "#6c7777",
    description:
      "Compact solvent-storage cabinet with dark folded-steel sides, light overlapping sliding doors, a central lock, recessed pulls, stainless spill-containment shelves and lips, side ventilation, warning field, plinth, and rear access construction. This original logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/solvent-cabinet.glb",
      authoredDimensions: { width: 1000, depth: 500, height: 1200 },
      revision: "product-reference-r7",
    },
  }),
  asset("chemical-cabinet", "Chemical storage cabinet", "Storage", [900, 600, 1900], {
    shortName: "Chemical cabinet",
    profile: "tall",
    material: "blue",
  }),
  asset("flammable-cabinet", "Flammable-material cabinet", "Storage", [900, 600, 1200], {
    shortName: "Flammable cabinet",
    profile: "cabinet",
    material: "yellow",
  }),
  asset("mobile-drawer", "Mobile drawer unit", "Storage", [500, 550, 650], {
    profile: "cabinet",
    material: "steel",
  }),
  asset("open-shelving", "Open shelving unit", "Storage", [1400, 500, 2100], {
    shortName: "Shelf unit",
    profile: "shelf",
    material: "steel",
    accent: "#768987",
    description:
      "Large open laboratory storage unit with square-tube uprights, repeated adjustment slots, five evenly spaced rigid shelves, raised containment lips, rear anti-rack rails, fasteners, and adjustable feet. This logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/open-shelving.glb",
      authoredDimensions: { width: 1400, depth: 500, height: 2100 },
      revision: "labspace-storage-r6",
    },
  }),
  asset("heavy-duty-rack", "Heavy-duty rack", "Storage", [1800, 600, 2200], {
    profile: "rack",
    material: "steel",
  }),
  asset("locker", "Locker", "Storage", [900, 500, 1900], { profile: "locker", material: "steel" }),
  asset("pegboard", "Pegboard", "Storage", [1200, 80, 900], {
    connection: "wall",
    profile: "rack",
    material: "dark",
  }),
  asset("laboratory-drying-rack", "Laboratory glassware drying rack", "Storage", [750, 320, 1200], {
    shortName: "Drying rack",
    connection: "wall",
    profile: "rack",
    material: "steel",
    accent: "#7e8e8e",
    description:
      "Wall-mounted stainless glassware drying rack based on the supplied reference, with a rigid back plate, fifteen individually modeled inclined polymer pegs and mounting blocks, a full lower drain trough and outlet, wall fixings, folded edges, and rear identification hardware. This original logo-free planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/laboratory-drying-rack.glb",
      authoredDimensions: { width: 750, depth: 320, height: 1200 },
      revision: "product-reference-r5",
    },
  }),
  asset("refrigerator-storage", "Refrigerator-style storage unit", "Storage", [750, 780, 1950], {
    shortName: "Cold storage",
    profile: "tall",
    material: "white",
  }),
  asset("freezer-storage", "Freezer-style storage unit", "Storage", [750, 780, 1950], {
    shortName: "Frozen storage",
    profile: "tall",
    material: "white",
    accent: "#3d7590",
  }),
  asset("slotted-angle-storage-rack", "Slotted-angle storage rack", "Storage", [1200, 500, 2100], {
    shortName: "Angle rack",
    profile: "rack",
    material: "steel",
    accent: "#8f805f",
    description:
      "Room 809 photo-derived open storage rack with perforated steel angle uprights and adjustable utility shelves; dimensions are editable and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/slotted-angle-storage-rack.glb",
      authoredDimensions: { width: 1200, depth: 500, height: 2100 },
      revision: "room809-r1",
    },
  }),
  asset("plastic-basket-tower", "Plastic basket tower", "Storage", [450, 450, 1750], {
    shortName: "Basket tower",
    profile: "shelf",
    material: "yellow",
    accent: "#67a34c",
    description:
      "Room 809 photo-derived vertical organizer holding stacked ventilated plastic baskets in contrasting green and orange; dimensions are editable and not manufacturer-certified.",
  }),

  asset("fume-hood", "Fume hood", "Laboratory equipment", [1500, 850, 2400], {
    shortName: "Fume hood",
    connection: "wall",
    profile: "hood",
    material: "white",
    accent: "#3f6f79",
    model3d: {
      previewSrc: "/models/hero/fume-hood.glb",
      authoredDimensions: { width: 1500, depth: 850, height: 2400 },
      revision: "room809-r1",
    },
  }),
  asset("biosafety-cabinet", "Biosafety cabinet", "Laboratory equipment", [1500, 800, 2250], {
    shortName: "BSC",
    connection: "wall",
    profile: "hood",
    material: "white",
    accent: "#4e7f8d",
    model3d: {
      previewSrc: "/models/hero/biosafety-cabinet.glb",
      authoredDimensions: { width: 1500, depth: 800, height: 2250 },
      revision: "room809-r1",
    },
  }),
  asset("laminar-flow", "Laminar-flow cabinet", "Laboratory equipment", [1500, 800, 2100], {
    shortName: "Laminar flow",
    connection: "wall",
    profile: "hood",
    material: "white",
    accent: "#649ba1",
    description:
      "Thermo Scientific Heraguard ECO-class floor-standing clean bench with a light formed blower housing, top intake and side ventilation, eye-level controller, LED task light, side safety glazing, rear HEPA diffuser, stainless work surface, service outlets, two-door lower cabinet, rear service panel, and leveling feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/laminar-flow.glb",
      authoredDimensions: { width: 1500, depth: 800, height: 2100 },
      revision: "remaining-equipment-batch11-r1",
    },
  }),
  asset("hplc-system", "Modular HPLC system", "Laboratory equipment", [620, 640, 1180], {
    shortName: "HPLC system",
    connection: "bench",
    profile: "box",
    material: "white",
    accent: "#4a8f93",
    description:
      "Official Shimadzu module-dimension-informed HPLC stack with two serviceable instrument towers, individual module seams and controls, solvent tray and bottles, routed mobile-phase tubing, rear communications spine, vents, connectors, and an all-sided maintenance envelope. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/hplc-system.glb",
      authoredDimensions: { width: 620, depth: 640, height: 1180 },
      revision: "fidelity-batch7-r1",
    },
  }),
  asset("gas-chromatograph", "Gas chromatograph", "Laboratory equipment", [515, 540, 440], {
    shortName: "GC system",
    connection: "bench",
    profile: "box",
    material: "white",
    accent: "#4f8c91",
    description:
      "Official Shimadzu Nexis-class footprint-informed gas chromatograph with a formed light instrument-grey enclosure, front oven door, sloped process display, injection ports, top service towers, side ventilation, rear access seams, gas connections, data ports, and levelling feet. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/gas-chromatograph.glb",
      authoredDimensions: { width: 515, depth: 540, height: 440 },
      revision: "fidelity-batch7-r1",
    },
  }),
  asset("benchtop-centrifuge", "Benchtop centrifuge", "Laboratory equipment", [600, 650, 420], {
    shortName: "Centrifuge",
    connection: "bench",
    profile: "round",
    material: "white",
    accent: "#507b92",
    model3d: {
      previewSrc: "/models/hero/benchtop-centrifuge.glb",
      authoredDimensions: { width: 600, depth: 650, height: 420 },
      revision: "room809-r1",
    },
  }),
  asset("floor-centrifuge", "Floor centrifuge", "Laboratory equipment", [700, 805, 1048], {
    profile: "round",
    material: "white",
    accent: "#456b7f",
    description:
      "Official Thermo Scientific Sorvall LYNX-class envelope-informed floor centrifuge with a circular insulated rotor lid, lift handle, formed upper shoulder, sloped process console, refrigerated lower grille, emergency releases, side and rear service panels, connectors, ventilation, and isolation feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/floor-centrifuge.glb",
      authoredDimensions: { width: 700, depth: 805, height: 1048 },
      revision: "instruments-batch10-r1",
    },
  }),
  asset("microcentrifuge", "Microcentrifuge", "Laboratory equipment", [240, 390, 240], {
    connection: "bench",
    profile: "round",
    material: "white",
    accent: "#648f93",
    description:
      "Official Eppendorf 5425-class footprint-informed microcentrifuge with a formed light enclosure, raised rotor lid, hinge and latch construction, sloped control console, rear safety hardware, side ventilation, service connectors, rubber isolation feet, and fully modeled maintenance sides. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/microcentrifuge.glb",
      authoredDimensions: { width: 240, depth: 390, height: 240 },
      revision: "fidelity-batch7-r1",
    },
  }),
  asset("incubator", "Incubator", "Laboratory equipment", [710, 645, 913], {
    profile: "box",
    material: "white",
    accent: "#55768b",
    description:
      "Official Yamato IN604-class dimensions-informed forced-air incubator with an insulated light-grey door, perimeter gasket, full-height silver pull, control fascia, lower air intake, right-side 32 mm cable port, top exhaust plenum, rear circulation/service panels, connectors, and levelling feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/incubator.glb",
      authoredDimensions: { width: 710, depth: 645, height: 913 },
      revision: "instruments-batch10-r1",
    },
  }),
  asset("shaking-incubator", "Shaking incubator", "Laboratory equipment", [1182, 958, 938], {
    profile: "box",
    material: "white",
    accent: "#6e8291",
    description:
      "Official Eppendorf Innova S44i-class floor configuration with a broad vibration-isolated base, large upward-glide observation door, visible stainless shaker platform and clamps, full-width lift handle, dedicated right control pod, circulation vents, twin rear fan guards, and rear utility connectors. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/shaking-incubator.glb",
      authoredDimensions: { width: 1182, depth: 958, height: 938 },
      revision: "instruments-batch10-r1",
    },
  }),
  asset("autoclave", "Autoclave", "Laboratory equipment", [800, 900, 1500], {
    profile: "round",
    material: "steel",
    accent: "#4c6b73",
    model3d: {
      previewSrc: "/models/hero/autoclave.glb",
      authoredDimensions: { width: 800, depth: 900, height: 1500 },
      revision: "room809-r1",
    },
  }),
  asset("compound-microscope", "Compound microscope", "Laboratory equipment", [300, 420, 480], {
    shortName: "Microscope",
    connection: "bench",
    profile: "scope",
    material: "dark",
    accent: "#d7dedd",
    model3d: {
      previewSrc: "/models/hero/compound-microscope.glb",
      authoredDimensions: { width: 300, depth: 420, height: 480 },
      revision: "room809-r1",
    },
  }),
  asset("stereo-microscope", "Stereo microscope", "Laboratory equipment", [194, 253, 403], {
    connection: "bench",
    profile: "scope",
    material: "white",
    accent: "#91a7a6",
    description:
      "Official Evident SZX7-class envelope with a low LED-transmitted-light base, removable stage plate, rear focus column, machined carrier, cylindrical zoom body and collar, objective barrel, binocular prism head, angled eyepiece tubes, paired focus and zoom controls, rear power service, and rubber isolation feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/stereo-microscope.glb",
      authoredDimensions: { width: 194, depth: 253, height: 403 },
      revision: "remaining-equipment-batch11-r1",
    },
  }),
  asset("analytical-balance", "Analytical balance", "Laboratory equipment", [212, 411, 345], {
    connection: "bench",
    profile: "box",
    material: "glass",
    accent: "#416d80",
    description:
      "Official-dimension-informed analytical balance with a 91 mm weighing pan, four-sided glass draft shield, sliding access panels, readable process display, levelling controls, feet, and rear service details. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/analytical-balance.glb",
      authoredDimensions: { width: 212, depth: 411, height: 345 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("top-loading-balance", "Top-loading balance", "Laboratory equipment", [190, 317, 78], {
    connection: "bench",
    profile: "box",
    material: "steel",
    accent: "#3d7590",
    description:
      "Official-dimension-informed compact top-loading balance with a raised stainless weighing pan, sloped control deck, status display, tactile controls, levelling feet, side seams, and rear power/data service. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/top-loading-balance.glb",
      authoredDimensions: { width: 190, depth: 317, height: 78 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("hotplate-stirrer", "Hotplate stirrer", "Laboratory equipment", [220, 335, 105], {
    connection: "bench",
    profile: "box",
    material: "steel",
    accent: "#6e9698",
    description:
      "Official IKA C-MAG HS 7-class footprint-informed hotplate stirrer with a light instrument-grey formed housing, ceramic heating surface, raised rim, dual tactile controls, process display, power status, side and rear service details, casing seams, and stable feet. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/hotplate-stirrer.glb",
      authoredDimensions: { width: 220, depth: 335, height: 105 },
      revision: "fidelity-batch7-r1",
    },
  }),
  asset("water-bath", "Water bath", "Laboratory equipment", [310, 360, 230], {
    connection: "bench",
    profile: "box",
    material: "steel",
    accent: "#4c91a2",
    description:
      "Official-dimension-informed thermostatic laboratory water bath with a round stainless tank, visible water surface, formed rim, digital controller, temperature dial, drain, rear protection detail, seams, and levelling feet. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/water-bath.glb",
      authoredDimensions: { width: 310, depth: 360, height: 230 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("dry-block-heater", "Dry block heater", "Laboratory equipment", [318, 200, 100], {
    connection: "bench",
    profile: "box",
    material: "steel",
    accent: "#c47d3d",
    description:
      "Official-dimension-informed dual-block dry bath with two interchangeable aluminium heating blocks, individually recessed tube wells, sample tubes, PID-style display, tactile controls, ventilation, power inlet, casing seams, and non-slip feet. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/dry-block-heater.glb",
      authoredDimensions: { width: 318, depth: 200, height: 100 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("vortex-mixer", "Vortex mixer", "Laboratory equipment", [122, 165, 165], {
    connection: "bench",
    profile: "round",
    material: "blue",
    description:
      "Official-dimension-informed heavy-housing vortex mixer with a pop-off cup head, rubber isolation ring, three-position mode switch, speed dial, side ventilation, rear cable service, casing seams, and stable feet. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/vortex-mixer.glb",
      authoredDimensions: { width: 122, depth: 165, height: 165 },
      revision: "fidelity-batch6-r1",
    },
  }),
  asset("pcr-machine", "PCR machine", "Laboratory equipment", [260, 470, 230], {
    shortName: "PCR",
    connection: "bench",
    profile: "box",
    material: "white",
    accent: "#6a6fb0",
    description:
      "Official Bio-Rad T100-class dimensions-informed conventional thermal cycler with a softly formed light enclosure, raised heated lid, substantial lift handle, sloped touch interface, status control, side cooling banks, rear service cover, power/data connections, and rubber feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/pcr-machine.glb",
      authoredDimensions: { width: 260, depth: 470, height: 230 },
      revision: "instruments-batch10-r1",
    },
  }),
  asset("real-time-pcr", "Real-time PCR machine", "Laboratory equipment", [270, 500, 400], {
    shortName: "qPCR",
    connection: "bench",
    profile: "box",
    material: "white",
    accent: "#795f9a",
    description:
      "Official Thermo Scientific QuantStudio 5-class dimensions-informed real-time PCR system with a tall formed optical housing, angled touch interface, motorized sample-block drawer, plate slot, status fascia, dense side ventilation, rear fans, power/data connections, and stable feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/real-time-pcr.glb",
      authoredDimensions: { width: 270, depth: 500, height: 400 },
      revision: "instruments-batch10-r1",
    },
  }),
  asset("spectrophotometer", "Spectrophotometer", "Laboratory equipment", [450, 501, 244], {
    connection: "bench",
    profile: "box",
    material: "white",
    accent: "#3a8191",
    description:
      "Official Shimadzu UV-1900i-class dimensions-informed spectrophotometer with a softly formed light enclosure, dedicated sample-compartment lid, angled process interface, tactile controls, ventilation, rear service access, communications ports, and levelling feet. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/spectrophotometer.glb",
      authoredDimensions: { width: 450, depth: 501, height: 244 },
      revision: "fidelity-batch7-r1",
    },
  }),
  asset("plate-reader", "Plate reader", "Laboratory equipment", [290, 400, 220], {
    connection: "bench",
    profile: "box",
    material: "white",
    accent: "#376e83",
    description:
      "Official Thermo Multiskan FC-class dimensions-informed microplate reader with a light formed enclosure, top access construction, front tray aperture and handle, angled status interface, control key, side ventilation, rear service ports, and stable feet. Original logo-free planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/plate-reader.glb",
      authoredDimensions: { width: 290, depth: 400, height: 220 },
      revision: "fidelity-batch7-r1",
    },
  }),
  asset("electrophoresis-tank", "Electrophoresis tank", "Laboratory equipment", [405, 180, 94], {
    connection: "bench",
    profile: "box",
    material: "glass",
    accent: "#4a84ad",
    description:
      "Bio-Rad Sub-Cell GT-class horizontal electrophoresis system with a molded clear buffer tank and safety lid, visible buffer, UV-transparent gel tray, agarose gel, two comb rows and teeth, guarded electrodes, color-coded terminals and routed leads, plus a raised lid handle. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/electrophoresis-tank.glb",
      authoredDimensions: { width: 405, depth: 180, height: 94 },
      revision: "remaining-equipment-batch11-r1",
    },
  }),
  asset("gel-doc", "Gel documentation system", "Laboratory equipment", [360, 448, 353], {
    shortName: "Gel doc",
    profile: "box",
    material: "white",
    accent: "#6f63a2",
    description:
      "Official Bio-Rad GelDoc Go-class compact imaging envelope with a light optical chassis, recessed dark chamber and safety window, removable sample tray and handle, upper camera tower and coated optic, angled touch display, side cooling vents, rear service cover and connectors, and stable feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/gel-doc.glb",
      authoredDimensions: { width: 360, depth: 448, height: 353 },
      revision: "remaining-equipment-batch11-r1",
    },
  }),
  asset("lab-refrigerator", "Laboratory refrigerator", "Laboratory equipment", [770, 830, 1955], {
    profile: "tall",
    material: "white",
    accent: "#4a91a7",
    description:
      "Official PHCbi MPR-722R-class pharmaceutical refrigerator with a full-height low-iron glazed door, thick silver frame and gasket, vertical handle and lock, five visible drawer racks, top alarm/controller fascia, lower compressor grille, side access ports, rear condenser rails and service panel, and caster/levelling hardware. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/lab-refrigerator.glb",
      authoredDimensions: { width: 770, depth: 830, height: 1955 },
      revision: "instruments-batch10-r1",
    },
  }),
  asset("lab-freezer", "Laboratory freezer", "Laboratory equipment", [750, 800, 2000], {
    profile: "tall",
    material: "white",
    accent: "#507aaf",
    description:
      "PHCbi MDF-U731M-class single-door biomedical freezer planning model derived from the supplied product reference. It includes a thick insulated door and gasket, left latch and lock, top control fascia with status display and keys, caster-and-leveling hardware, compressor vents, a rear condenser grid and cross rails, service covers, and a routed mains lead. The geometry is original and logo-free, dimensions remain editable, and the model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/lab-freezer.glb",
      authoredDimensions: { width: 750, depth: 800, height: 2000 },
      revision: "product-reference-r5",
    },
  }),
  asset(
    "ultra-low-freezer",
    "Ultra-low-temperature freezer",
    "Laboratory equipment",
    [950, 900, 2000],
    {
      shortName: "ULT freezer",
      profile: "tall",
      material: "white",
      accent: "#375f91",
      model3d: {
        previewSrc: "/models/hero/ultra-low-freezer.glb",
        authoredDimensions: { width: 950, depth: 900, height: 2000 },
        revision: "room809-r1",
      },
    },
  ),
  asset("ice-maker", "Ice maker", "Laboratory equipment", [633, 506, 930], {
    profile: "box",
    material: "steel",
    accent: "#5d9cb0",
    description:
      "Hoshizaki IM-65NE-class self-contained ice maker with a brushed stainless cabinet, insulated storage door, recessed handle, restrained status strip, lower compressor grille, side ventilation, galvanized rear service and condenser panels, distinct water/drain/electrical connections, and adjustable legs. Original logo-free all-sided planning geometry; not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/ice-maker.glb",
      authoredDimensions: { width: 633, depth: 506, height: 930 },
      revision: "remaining-equipment-batch11-r1",
    },
  }),
  asset(
    "glassware-washer",
    "Dishwasher or glassware washer",
    "Laboratory equipment",
    [610, 686, 876],
    {
      shortName: "Glassware washer",
      profile: "washer",
      material: "steel",
      accent: "#4b8190",
      description:
        "Labconco FlaskScrubber-class undercounter laboratory washer with a stainless enclosure, framed observation door, illuminated electropolished chamber, two detailed rack levels with injection spindles, spray arm, full-width handle, touch controller, drying vents, rear service panel, separated water/drain/electrical connections, and leveling feet. Original logo-free all-sided planning geometry; not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/glassware-washer.glb",
        authoredDimensions: { width: 610, depth: 686, height: 876 },
        revision: "remaining-equipment-batch11-r1",
      },
    },
  ),
  asset("vacuum-pump", "Vacuum pump", "Laboratory equipment", [166, 419, 223], {
    connection: "bench",
    profile: "round",
    material: "dark",
    accent: "#a96f20",
    description:
      "Room 809 yellow oil-rotary vacuum-pump planning model with an oil-level gauge, upright KF inlet, two-stage cast pump block, finned motor, rear fan guard, isolation feet, switch, handle, and power lead. The envelope and hidden-side anatomy are informed by the ULVAC GCD-051X, but this original model is not a manufacturer-certified replica.",
    model3d: {
      previewSrc: "/models/hero/vacuum-pump.glb",
      authoredDimensions: { width: 166, depth: 419, height: 223 },
      revision: "room809-r2",
    },
  }),
  asset("rotary-evaporator", "Rotary evaporator", "Laboratory equipment", [607, 429, 947], {
    shortName: "Rotary evaporator",
    connection: "bench",
    profile: "scope",
    material: "white",
    accent: "#8d7653",
    description:
      "Logo-free Buchi R-300-class rotary evaporator planning model rebuilt from the supplied product references and official technical documentation. It includes the compact two-rail chassis, left process touchscreen, electric lift tower, angled rotary drive and Combi-Clip-class coupling, transparent vertical condenser with a blue helical coolant coil, receiving train and stopcock, blue-charged evaporation flask, and separate digitally controlled stainless heating bath. Rear service panels, hoses, cable routes, supports, seams, and fasteners make every orbit side credible. Dimensions remain editable and the original model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/rotary-evaporator.glb",
      authoredDimensions: { width: 607, depth: 429, height: 947 },
      revision: "buchi-reference-r4",
    },
  }),
  asset(
    "vacuum-cold-trap-system",
    "Vacuum cold-trap system",
    "Laboratory equipment",
    [500, 550, 1150],
    {
      shortName: "Cold-trap system",
      profile: "box",
      material: "white",
      accent: "#786c43",
      description:
        "Room 809 photo-derived stacked vacuum cold-trap station with a refrigerated base, upper trap vessel, gauges, hoses, and companion pumps; dimensions are editable and not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/vacuum-cold-trap-system.glb",
        authoredDimensions: { width: 500, depth: 550, height: 1150 },
        revision: "room809-r2",
      },
    },
  ),
  asset(
    "multi-position-heating-bath",
    "Multi-position heating bath",
    "Laboratory equipment",
    [1200, 500, 350],
    {
      connection: "bench",
      profile: "box",
      material: "blue",
      accent: "#b0783f",
      description:
        "Room 809 photo-derived long turquoise heating bath with multiple independently controlled vessel positions and front-mounted dials; dimensions are editable and not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/multi-position-heating-bath.glb",
        authoredDimensions: { width: 1200, depth: 500, height: 350 },
        revision: "room809-r2",
      },
    },
  ),
  asset(
    "stainless-process-vessel",
    "Stainless-steel process vessel",
    "Laboratory equipment",
    [450, 450, 650],
    {
      shortName: "Process vessel",
      connection: "bench",
      profile: "cylinder",
      material: "steel",
      accent: "#88999a",
      description:
        "Room 809 photo-derived jacketed stainless process vessel with dished lower head, removable rolled-rim lid, top and side lifting handles, weld seams, front drain valve, and rear construction. The original all-sided planning model is editable and not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/stainless-process-vessel.glb",
        authoredDimensions: { width: 450, depth: 450, height: 650 },
        revision: "support-batch9-r1",
      },
    },
  ),
  asset(
    "retort-stand-assembly",
    "Retort stand assembly",
    "Laboratory equipment",
    [600, 600, 1800],
    {
      shortName: "Retort stand",
      connection: "bench",
      profile: "rack",
      material: "steel",
      accent: "#343f40",
      description:
        "Room 809 photo-derived multi-rod retort assembly with a weighted wear-plate base, three cross rails, adjustable bossheads and clamps, a visible helical condenser, receiving and process flasks, and routed coolant and vacuum hoses. The original all-sided planning model is editable and not manufacturer-certified.",
      model3d: {
        previewSrc: "/models/hero/retort-stand-assembly.glb",
        authoredDimensions: { width: 600, depth: 600, height: 1800 },
        revision: "support-batch9-r1",
      },
    },
  ),
  asset(
    "forced-air-lab-oven",
    "Forced-air laboratory oven",
    "Laboratory equipment",
    [710, 651, 870],
    {
      shortName: "Lab oven",
      connection: "bench",
      profile: "box",
      material: "white",
      accent: "#323d40",
      description:
        "Room 809 photo-derived forced-air laboratory oven with an insulated dark windowed door, stainless chamber cues, PID control panel, twin top exhausts, right-side cable port, rear forced-air service grille, and vented enclosure. The envelope and hidden-side anatomy are informed by the Yamato DKN602, but this original model is not a manufacturer-certified replica.",
      model3d: {
        previewSrc: "/models/hero/forced-air-lab-oven.glb",
        authoredDimensions: { width: 710, depth: 651, height: 870 },
        revision: "room809-r2",
      },
    },
  ),
  asset("gas-cylinder", "Gas cylinder", "Laboratory equipment", [300, 300, 1450], {
    profile: "cylinder",
    material: "steel",
    accent: "#6c8c87",
    description:
      "Bright satin-silver laboratory gas cylinder with a dished shoulder, identification band, brass valve, handwheel, restraint chain, technical label, and protective base ring. The original all-sided planning model is editable and not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/gas-cylinder.glb",
      authoredDimensions: { width: 300, depth: 300, height: 1450 },
      revision: "support-batch9-r1",
    },
  }),
  asset("computer-workstation", "Computer workstation", "Laboratory equipment", [1400, 700, 1350], {
    profile: "workstation",
    material: "dark",
    accent: "#3f7b99",
  }),
  asset("printer", "Printer", "Laboratory equipment", [500, 500, 350], {
    profile: "box",
    material: "white",
    accent: "#53666d",
  }),

  asset("eyewash", "Emergency eyewash", "Safety", [450, 400, 1050], {
    shortName: "Eyewash",
    profile: "safety",
    material: "steel",
    accent: "#35a375",
    description:
      "Deck-style emergency eyewash on a stainless pedestal with a rolled-rim bowl, twin aerated spray heads, green dust caps and stay-open paddle, drain and supply construction, and a high-visibility symbol plate. The original planning model is not manufacturer-certified.",
    model3d: {
      previewSrc: "/models/hero/eyewash.glb",
      authoredDimensions: { width: 450, depth: 400, height: 1050 },
      revision: "support-batch9-r1",
    },
  }),
  asset("safety-shower", "Safety shower", "Safety", [900, 900, 2400], {
    profile: "safety",
    material: "yellow",
    accent: "#35a375",
  }),
  asset("fire-extinguisher", "Fire extinguisher", "Safety", [220, 220, 650], {
    profile: "cylinder",
    material: "red",
    description:
      "Portable safety-red laboratory fire extinguisher with a domed pressure cylinder, brass valve, pressure gauge, carry and squeeze handles, routed discharge hose and nozzle, instruction panel, and wall bracket. The original planning model is not compliance-certified.",
    model3d: {
      previewSrc: "/models/hero/fire-extinguisher.glb",
      authoredDimensions: { width: 220, depth: 220, height: 650 },
      revision: "support-batch9-r1",
    },
  }),
  asset("waste-bin", "Waste bin", "Safety", [450, 450, 700], { profile: "box", material: "dark" }),
  asset("biological-waste-bin", "Biological waste bin", "Safety", [450, 450, 700], {
    shortName: "Bio waste",
    profile: "box",
    material: "yellow",
    accent: "#d8b22f",
  }),
];

export const ASSET_BY_ID = new Map(ASSET_CATALOG.map((definition) => [definition.id, definition]));

export const ASSET_CATEGORIES = Array.from(
  new Set(ASSET_CATALOG.map((assetItem) => assetItem.category)),
);

export function getAssetDefinition(id: string): AssetDefinition {
  return ASSET_BY_ID.get(id) ?? ASSET_CATALOG.find((entry) => entry.id === "lab-bench")!;
}

export function searchAssets(query: string, categories: AssetCategory[] = []): AssetDefinition[] {
  const normalized = query.trim().toLowerCase();
  return ASSET_CATALOG.filter((entry) => {
    const categoryMatch = categories.length === 0 || categories.includes(entry.category);
    const queryMatch =
      !normalized ||
      entry.name.toLowerCase().includes(normalized) ||
      entry.tags.some((tag) => tag.includes(normalized));
    return categoryMatch && queryMatch;
  });
}
