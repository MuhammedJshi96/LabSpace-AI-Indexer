import { mkdir, writeFile } from "node:fs/promises";
import { ProjectSchema } from "../src/domain/schema";

const response = await fetch("http://localhost:3004/api/project");
if (!response.ok) throw new Error(`Local project export failed: ${response.status}`);
const project = ProjectSchema.parse(await response.json());
const serialized = JSON.stringify(project, null, 2);
const suspect =
  /(?:[A-Z]:\\|file:\/\/|(?:password|api[_ -]?key|secret|token)\s*[=:]|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
console.log(
  JSON.stringify(
    {
      name: project.name,
      laboratories: project.laboratories.map(({ name, code }) => ({ name, code })),
      rooms: project.rooms.map((room) => ({
        name: room.name,
        code: room.code,
        kind: room.roomKind,
        objects: room.scene.objects.length,
        inventory: room.scene.inventoryItems.length,
      })),
      potentialPrivateData: suspect.test(serialized),
      bytes: serialized.length,
    },
    null,
    2,
  ),
);
if (process.argv.includes("--write")) {
  if (suspect.test(serialized))
    throw new Error("Review possible private data before publishing the local snapshot.");
  await mkdir(".tmp/backups", { recursive: true });
  await writeFile(`.tmp/backups/local-project-${Date.now()}.json`, serialized);
  await writeFile("server/public-showcase-project.json", `${serialized}\n`);
  console.log("Backed up and exported the exact local project. SQLite remains untouched.");
}
