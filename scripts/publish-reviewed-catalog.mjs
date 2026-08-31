/** Publish verified staged catalog files atomically. Never touches room data. */
import { readFileSync, readdirSync, copyFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import process from "node:process";
const source = resolve(process.argv[2] ?? "artifacts/realism-review/black-handles-staging");
const destination = resolve("public/models/hero");
const ids = readdirSync(destination)
  .filter((name) => name.endsWith(".glb"))
  .sort();
if (ids.length !== 104) throw new Error("Unexpected live catalog size");
for (const name of ids) {
  const data = readFileSync(resolve(source, name));
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
  if (!doc.nodes.some((node) => node.extras?.handle_finish_revision === "black-handles-r1"))
    throw new Error(`Missing part-level handle review: ${name}`);
  for (const material of doc.materials) {
    if (material.extras?.labspace_visible_finish !== "black-handle") continue;
    const pbr = material.pbrMetallicRoughness;
    if (pbr.metallicFactor !== 0 || Math.max(...pbr.baseColorFactor.slice(0, 3)) > 0.015)
      throw new Error(`Invalid handle finish: ${name}/${material.name}`);
  }
}
for (const name of ids) {
  const target = resolve(destination, name);
  copyFileSync(resolve(source, name), `${target}.next`);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(`${target}.next`, target);
      break;
    } catch (error) {
      if (attempt >= 10) throw error;
      await pause(200);
    }
  }
}
for (const script of ["scripts/polish-catalog-materials.mjs", "scripts/build-storage-rigs.mjs"]) {
  const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(script);
}
process.stdout.write(
  `Published ${ids.length} staged models locally. No room or inventory data changed.\n`,
);
