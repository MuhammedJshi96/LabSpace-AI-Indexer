import { mkdir, writeFile } from "node:fs/promises";
import { ProjectSchema } from "../src/domain/schema";

const response = await fetch("http://localhost:3004/api/project");
if (!response.ok) throw new Error(`Local project export failed: ${response.status}`);
let project = ProjectSchema.parse(await response.json());
const laboratoryCodeFlag = process.argv.indexOf("--laboratory-code");
const laboratoryCode =
  laboratoryCodeFlag >= 0 ? process.argv[laboratoryCodeFlag + 1]?.trim() : undefined;
if (laboratoryCodeFlag >= 0 && !laboratoryCode) {
  throw new Error("--laboratory-code requires an exact laboratory code.");
}
if (laboratoryCode) {
  const laboratory = project.laboratories.find(
    (candidate) => candidate.code.toLocaleLowerCase() === laboratoryCode.toLocaleLowerCase(),
  );
  if (!laboratory) throw new Error(`Laboratory ${laboratoryCode} was not found.`);
  const rooms = project.rooms.filter((room) => room.laboratoryId === laboratory.id);
  if (rooms.length === 0) throw new Error(`Laboratory ${laboratory.code} has no rooms to export.`);
  const roomIds = new Set(rooms.map((room) => room.id));
  const activeRoomId = roomIds.has(project.activeRoomId) ? project.activeRoomId : rooms[0].id;
  const featuredDemoRoomId =
    project.featuredDemoRoomId && roomIds.has(project.featuredDemoRoomId)
      ? project.featuredDemoRoomId
      : undefined;
  project = ProjectSchema.parse({
    ...project,
    laboratories: [{ ...laboratory, roomIds: rooms.map((room) => room.id) }],
    rooms,
    activeRoomId,
    featuredDemoRoomId,
  });
}
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
      laboratoryFilter: laboratoryCode ?? null,
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
  console.log(
    laboratoryCode
      ? `Backed up and exported laboratory ${laboratoryCode}. SQLite remains untouched.`
      : "Backed up and exported the exact local project. SQLite remains untouched.",
  );
}
