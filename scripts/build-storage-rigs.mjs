import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import console from "node:console";

// Physical access is an authored semantic, not something that can be inferred
// safely from a highlight region. Keep the small set of non-front facades
// explicit when the geometry-derived manifest is regenerated.
const ACCESS_POLICIES = {
  "center-island-bench": {
    defaultAccessFace: "front",
    accessFaceOverrides: [
      { keyPrefix: "drawer:Island north", face: "rear" },
      { keyPrefix: "bay:Island north", face: "rear" },
    ],
  },
  "island-bench-service-bridge": {
    defaultAccessFace: "front",
    accessFaceOverrides: [
      { keyPrefix: "drawer:Island north", face: "rear" },
      { keyPrefix: "bay:Island north", face: "rear" },
    ],
  },
  "corner-lab-bench": {
    defaultAccessFace: "front",
    accessFaceOverrides: [
      { keyPrefix: "drawer:return utility drawer", face: "rear" },
      { keyPrefix: "bay:Return cabinet", face: "rear" },
      { keyPrefix: "drawer:corner run drawer", face: "left" },
    ],
  },
  "lab-bench-overhead": { defaultAccessFace: "front" },
  "tall-cabinet": { defaultAccessFace: "front" },
};

// Derive the runtime manifest from the delivered models, never from guessed
// cabinet dimensions. Run after generation/compression of a verified model.
const ids = readdirSync("public/models/hero")
  .filter((name) => name.endsWith(".glb"))
  .map((name) => name.slice(0, -4));
const rigs = {};
for (const id of ids) {
  const buffer = readFileSync(`public/models/hero/${id}.glb`);
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  const root = gltf.nodes.find((node) => node.extras?.storage_rig_version);
  if (!root) continue;
  const parts = gltf.nodes.flatMap((node) =>
    node.extras?.storageMechanism ? [node.extras.storageMechanism] : [],
  );
  if (parts.length !== root.extras.storage_mechanism_count)
    throw new Error(`Lost moving parts: ${id}`);
  const shelves = root.extras.storage_shelves ?? [];
  const locations = [];
  const add = (key, name, type, region, partIds, parentKey) =>
    locations.push({ key, name, type, region, partIds, ...(parentKey ? { parentKey } : {}) });
  for (const part of [...parts]
    .filter((p) => p.kind === "drawer")
    .sort(
      (a, b) => b.region.y - a.region.y || a.region.z - b.region.z || a.region.x - b.region.x,
    )) {
    add(
      `drawer:${part.id}`,
      part.id.replace(/drawer (\d+)$/i, "drawer $1"),
      "drawer",
      part.region,
      [part.id],
    );
  }
  const bays = new Map();
  for (const part of parts.filter((p) => p.kind !== "drawer")) {
    // A double-sided hutch is one physical compartment, not four inventories
    // merely because it has four access leaves.
    const key = part.bay.replace(/^Service bridge [+-]1 bay /, "Service bridge bay ");
    bays.set(key, [...(bays.get(key) ?? []), part]);
  }
  for (const [bay, leaves] of bays) {
    const x0 = Math.min(...leaves.map((p) => p.region.x - p.region.width / 2)),
      x1 = Math.max(...leaves.map((p) => p.region.x + p.region.width / 2));
    const y0 = Math.min(...leaves.map((p) => p.region.y)),
      y1 = Math.max(...leaves.map((p) => p.region.y + p.region.height));
    const z0 = Math.min(...leaves.map((p) => p.region.z - (p.region.depth ?? 0.03) / 2)),
      z1 = Math.max(...leaves.map((p) => p.region.z + (p.region.depth ?? 0.03) / 2));
    const region = {
      x: (x0 + x1) / 2,
      y: y0,
      z: Math.max(...leaves.map((p) => p.region.z)),
      width: x1 - x0,
      height: y1 - y0,
      depth: Math.max(0.02, z1 - z0),
    };
    const key = `bay:${bay}`,
      partIds = leaves.map((p) => p.id);
    add(key, bay, "compartment", region, partIds);
    const physical = shelves
      .filter(
        (s) =>
          s.y > y0 + 0.005 &&
          s.y < y1 - 0.005 &&
          s.x + s.width / 2 > x0 + 0.01 &&
          s.x - s.width / 2 < x1 - 0.01 &&
          // Opposing lower island cabinets contain separate physical shelves.
          // The central service hutch is deliberately shared across both faces.
          (!bay.startsWith("Island ") || s.z * region.z > 0),
      )
      .sort((a, b) => b.y - a.y);
    for (const [i, shelf] of physical.entries()) {
      const left = Math.max(x0, shelf.x - shelf.width / 2),
        right = Math.min(x1, shelf.x + shelf.width / 2);
      add(
        `${key}:shelf:${shelf.id}`,
        `Shelf ${String(i + 1).padStart(2, "0")}`,
        "shelf",
        {
          ...region,
          x: (left + right) / 2,
          y: shelf.y,
          width: right - left,
          height: Math.max(0.012, Math.min(0.1, (physical[i - 1]?.y ?? y1) - shelf.y - 0.01)),
        },
        partIds,
        key,
      );
    }
  }
  if (!bays.size)
    for (const [i, shelf] of [...shelves].sort((a, b) => b.y - a.y).entries()) {
      add(
        `shelf:${shelf.id}`,
        `Shelf ${String(i + 1).padStart(2, "0")}`,
        "shelf",
        { ...shelf, height: 0.025 },
        [],
      );
    }
  rigs[id] = {
    ...(ACCESS_POLICIES[id] ?? {}),
    parts,
    shelfLevels: root.extras.storage_shelf_levels ?? [],
    locations,
  };
}
writeFileSync("src/domain/storage-rigs.json", JSON.stringify(rigs, null, 2) + "\n");
console.log(`Verified ${Object.keys(rigs).length} storage rigs from delivered GLBs.`);
