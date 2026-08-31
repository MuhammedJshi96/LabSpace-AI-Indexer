/** Publish reviewed, staged PNGs into the LOCAL public directory only.
 * No network, project database, room data or deployment operations.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import console from "node:console";
import { setTimeout as pause } from "node:timers/promises";

const source = resolve(process.argv[2] ?? "artifacts/realism-review/soft-light-renders");
const destination = resolve("public/models/hero/renders");
const ids = readdirSync("public/models/hero")
  .filter((file) => file.endsWith(".glb"))
  .map((file) => file.slice(0, -4));
const files = ids.flatMap((id) => ["isometric", "top"].map((view) => `${id}-${view}.png`));
// Validate the entire set before replacing even one served image.
for (const file of files) {
  const bytes = readFileSync(resolve(source, file));
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || bytes.length < 100)
    throw new Error(`Invalid staged catalog PNG: ${file}`);
}
for (const file of files) {
  const final = resolve(destination, file),
    next = `${final}.next`;
  // Browser/AV locks need not be disturbed for images already byte-identical.
  if (existsSync(final) && readFileSync(final).equals(readFileSync(resolve(source, file)))) continue;
  copyFileSync(resolve(source, file), next);
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(next, final);
      break;
    } catch (error) {
      if (attempt >= 80) throw error;
      await pause(250);
    }
  }
  if (!readFileSync(final).equals(readFileSync(resolve(source, file))))
    throw new Error(`Published PNG differs from reviewed render: ${file}`);
}
console.log(
  `Published and byte-verified ${files.length} LOCAL catalog renders; no room data touched.`,
);
