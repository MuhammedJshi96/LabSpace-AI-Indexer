/** Reproducible scoped geometry repair; no scene, seed, or project data writes. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
const blender = resolve(".tools/blender-4.5.11-windows-x64/blender.exe");
const jobs = [
  ["hoods.py", ["fume-hood", "biosafety-cabinet"]],
  ["lab_remaining_equipment_batch11.py", ["laminar-flow", "glassware-washer"]],
  ["lab_storage_batch4.py", ["base-cabinet", "tall-cabinet"]],
  ["lab_furniture.py", ["lab-bench", "center-island-bench"]],
  ["lab_casework_batch3.py", ["island-bench-service-bridge"]],
  ["lab_reference_batch13.py", ["asymmetric-lab-bench"]],
  ["lab_reference_storage_batch5.py", ["glazed-sliding-cabinet"]],
  ["lab_fidelity_batch6.py", ["office-chair", "top-loading-balance"]],
  ["lab_instruments_batch10.py", ["incubator", "shaking-incubator", "lab-refrigerator"]],
  ["lab_catalog_completion_batch12.py", ["rectangular-table", "safety-shower"]],
  ["cold_autoclave.py", ["autoclave"]],
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
for (const [script, ids] of jobs)
  for (const id of ids) run(script, ["--asset", id, "--output-dir", "public/models/hero"]);
const ids = jobs.flatMap(([, ids]) => ids);
run("compress_hero_glbs.py", [
  "--model-dir",
  "public/models/hero",
  ...ids.flatMap((id) => ["--asset", id]),
]);
for (const script of ["scripts/polish-catalog-materials.mjs", "scripts/build-storage-rigs.mjs"]) {
  const r = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(script);
}
