import { readFileSync, writeFileSync } from "node:fs";
import console from "node:console";

// Derive the runtime manifest from the delivered models, never from guessed
// cabinet dimensions. Run after generation/compression of a verified model.
const ids = ["wall-cabinet", "base-cabinet", "base-drawer-cabinet", "lab-bench", "mobile-bench"];
const rigs = {};
for (const id of ids) {
  const buffer = readFileSync(`public/models/hero/${id}.glb`);
  const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString());
  const root = gltf.nodes.find((node) => node.extras?.storage_rig_version === 1);
  if (!root) throw new Error(`Missing verified storage rig: ${id}`);
  const parts = gltf.nodes.flatMap((node) =>
    node.extras?.storageMechanism ? [node.extras.storageMechanism] : [],
  );
  if (parts.length !== root.extras.storage_mechanism_count)
    throw new Error(`Lost moving parts: ${id}`);
  rigs[id] = { parts, shelfLevels: root.extras.storage_shelf_levels ?? [] };
}
writeFileSync("src/domain/storage-rigs.json", JSON.stringify(rigs, null, 2) + "\n");
console.log(`Verified ${Object.keys(rigs).length} storage rigs from delivered GLBs.`);
