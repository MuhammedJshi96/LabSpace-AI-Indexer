/** Rebuild parts requiring separate visible finishes; never reads project data. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { mkdirSync, copyFileSync, renameSync } from "node:fs";
import { setTimeout as pause } from "node:timers/promises";
const blender = resolve(".tools/blender-4.5.11-windows-x64/blender.exe");
const staging = resolve("artifacts/realism-review/reference-staging");
const jobs = [
  ["lab_furniture.py", "lab-bench center-island-bench"],
  ["lab_fidelity_batch7.py", "microcentrifuge"],
  [
    "lab_casework_batch3.py",
    "lab-bench-sink lab-bench-overhead island-bench-service-bridge stainless-enclosed-basin",
  ],
  [
    "lab_storage_batch4.py",
    "base-cabinet base-drawer-cabinet sink-cabinet glass-wall-cabinet tall-cabinet",
  ],
  [
    "lab_reference_storage_batch5.py",
    "sliding-door-cabinet glazed-sliding-cabinet solvent-cabinet",
  ],
  [
    "lab_catalog_completion_batch12.py",
    "corner-lab-bench mobile-bench wall-cabinet chemical-cabinet flammable-cabinet mobile-drawer locker refrigerator-storage freezer-storage",
  ],
  [
    "lab_architecture_batch8.py",
    "single-door double-door sliding-door narrow-lite-door cleanroom-glazed-door double-sliding-door",
  ],
  [
    "lab_reference_batch13.py",
    "wide-lite-door single-transom-door double-transom-door double-egress-door asymmetric-lab-bench institutional-sink-cabinet computer-lab-bench",
  ],
];
function run(script, args) {
  const result = spawnSync(
    blender,
    [
      "--background",
      "--factory-startup",
      "--python-exit-code",
      "1",
      "--python",
      `scripts/blender/${script}`,
      "--",
      ...args,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`${script}: ${result.status}`);
}
const allIds = jobs.flatMap(([, ids]) => ids.split(" "));
const only = new Set(process.argv.slice(2));
for (const id of only) if (!allIds.includes(id)) throw new Error(`Unknown scoped asset: ${id}`);
const selectedIds = allIds.filter((id) => !only.size || only.has(id));
mkdirSync(staging, { recursive: true });
for (const [script, ids] of jobs)
  for (const id of ids.split(" "))
    if (!only.size || only.has(id)) run(script, ["--asset", id, "--output-dir", staging]);
run("compress_hero_glbs.py", [
  "--model-dir",
  staging,
  ...selectedIds.flatMap((id) => ["--asset", id]),
]);
for (const id of selectedIds) {
  const destination = resolve(`public/models/hero/${id}.glb`);
  copyFileSync(`${staging}/${id}.glb`, `${destination}.next`);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(`${destination}.next`, destination);
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
