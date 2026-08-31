import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { env, stdout, execPath, argv, exit } from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const blender =
  env.BLENDER_PATH ?? resolve(projectRoot, ".tools", "blender-4.5.11-windows-x64", "blender.exe");

if (!existsSync(blender)) {
  throw new Error(
    `Blender was not found at ${blender}. Set BLENDER_PATH to a Blender 4.5 LTS executable.`,
  );
}

const stagingIndex = argv.indexOf("--staging-only");
if (stagingIndex >= 0 && !argv[stagingIndex + 1])
  throw new Error("--staging-only requires an output directory");
const outputDir = stagingIndex >= 0 ? resolve(argv[stagingIndex + 1]) : "public/models/hero";
const jobs = [
  {
    script: "scripts/blender/lab_casework_batch3.py",
    args: ["--output-dir", outputDir],
  },
  {
    script: "scripts/blender/lab_storage_batch4.py",
    args: ["--output-dir", outputDir],
  },
  {
    script: "scripts/blender/lab_reference_storage_batch5.py",
    args: ["--output-dir", outputDir],
  },
  {
    script: "scripts/blender/lab_architecture_batch8.py",
    args: ["--output-dir", outputDir],
  },
  {
    script: "scripts/blender/lab_support_batch9.py",
    args: ["--output-dir", outputDir],
  },
  {
    script: "scripts/blender/build_rotary_evaporator.py",
    args: ["--output", `${outputDir}/rotary-evaporator.glb`],
  },
  { script: "scripts/blender/lab_furniture.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/cold_autoclave.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/hoods.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/instruments.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/storage_carts.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/equipment_batch2.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/lab_fidelity_batch6.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/lab_fidelity_batch7.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/lab_instruments_batch10.py", args: ["--output-dir", outputDir] },
  {
    script: "scripts/blender/lab_remaining_equipment_batch11.py",
    args: ["--output-dir", outputDir],
  },
  {
    script: "scripts/blender/lab_catalog_completion_batch12.py",
    args: ["--output-dir", outputDir],
  },
  { script: "scripts/blender/lab_reference_batch13.py", args: ["--output-dir", outputDir] },
  { script: "scripts/blender/compress_hero_glbs.py", args: ["--model-dir", outputDir] },
];

for (const job of jobs) {
  const scriptPath = resolve(projectRoot, job.script);
  if (!existsSync(scriptPath)) throw new Error(`Missing hero-asset source: ${job.script}`);
  stdout.write(`\nBuilding ${job.script}...\n`);
  const result = spawnSync(
    blender,
    [
      "--background",
      "--factory-startup",
      "--python-exit-code",
      "1",
      "--python",
      scriptPath,
      "--",
      ...job.args,
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`${job.script} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

// Material review must follow compression (which re-exports material extras).
if (stagingIndex >= 0) {
  stdout.write(`Staged authored models in ${outputDir}; live catalog not changed.\n`);
  exit(0);
}
// Storage rigs and same-model renders are always derived from that delivery.
for (const script of ["scripts/polish-catalog-materials.mjs", "scripts/build-storage-rigs.mjs"]) {
  const result = spawnSync(execPath, [resolve(projectRoot, script)], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${script} failed.`);
}
const renders = spawnSync(
  blender,
  [
    "--background",
    "--factory-startup",
    "--python-exit-code",
    "1",
    "--python",
    resolve(projectRoot, "scripts/blender/render_hero_catalog.py"),
  ],
  { cwd: projectRoot, stdio: "inherit" },
);
if (renders.status !== 0) throw new Error("Catalog rendering failed.");

stdout.write("\nAll LabSpace hero GLBs were rebuilt successfully.\n");
