/** Tiny, original, tileable material data; not photographic color overlays.
 * G stores roughness variation, B=1 preserves the material's metalness factor.
 * Six shared 128px pairs keep the entire catalog's GPU texture budget bounded.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Buffer } from "node:buffer";
import process from "node:process";
import { URL } from "node:url";
export const SURFACE_REVISION = "surface-r4";
export const SURFACES = ["brushed", "enamel", "phenolic", "polymer", "micrograin", "woodgrain"];
export const surfaceRevision = (surface) =>
  surface === "micrograin" ? "surface-r5" : surface === "woodgrain" ? "surface-r6" : SURFACE_REVISION;
const size = 128;
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const head = Buffer.alloc(4),
    tail = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}
function png(rgb) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8;
  head[9] = 2;
  const scan = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++)
    rgb.copy(scan, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(scan)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export function buildSurfaceMaps(directory) {
  mkdirSync(directory, { recursive: true });
  for (const [index, surface] of SURFACES.entries()) {
    let seed = 7419 + index;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const grain = Array.from({ length: size * size }, rand);
    const rows = Array.from({ length: size }, rand);
    const height = (x, y) => {
      x = (x + size) % size;
      y = (y + size) % size;
      if (surface === "micrograin") {
        // A very shallow cross-grain in the coating, not transparent wire mesh.
        // Integer periods tile seamlessly; irregular grain softens the weave.
        const cross = ((1 + Math.cos((x * Math.PI) / 2)) * (1 + Math.cos((y * Math.PI) / 2))) / 4;
        const softened =
          (grain[y * size + x] +
            grain[y * size + ((x + 1) % size)] +
            grain[((y + 1) % size) * size + x]) /
          3;
        return cross * 0.7 + softened * 0.3;
      }
      if (surface === "woodgrain") {
        // Directional sealed-laminate pore variation.  This changes reflection
        // and roughness only; the authored walnut/maple colour remains intact.
        const band = (1 + Math.sin((y * Math.PI) / 8 + rows[y] * 1.4)) * .5;
        const pore = grain[y * size + x] * .35 + grain[y * size + ((x + 3) % size)] * .15;
        return band * .5 + pore;
      }
      return surface === "brushed"
        ? rows[y] * 0.85 + grain[y * size + x] * 0.15
        : grain[y * size + x];
    };
    const normal = Buffer.alloc(size * size * 3),
      rough = Buffer.alloc(size * size * 3);
    // Subtle micro-normal, not visible dents or coarse procedural noise.
    const amplitude =
      surface === "micrograin"
        ? 0.1
        : surface === "woodgrain"
          ? 0.032
        : surface === "brushed"
          ? 0.022
          : surface === "enamel"
            ? 0.008
            : 0.012;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 3;
        const nx = (height(x - 1, y) - height(x + 1, y)) * amplitude;
        const ny = (height(x, y - 1) - height(x, y + 1)) * amplitude;
        const length = Math.hypot(nx, ny, 1);
        normal[i] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
        normal[i + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
        normal[i + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
        rough[i] = 255;
        rough[i + 1] =
          surface === "micrograin"
            ? Math.round(226 + height(x, y) * 29)
            : surface === "woodgrain"
              ? Math.round(224 + height(x, y) * 24)
            : Math.round(248 + height(x, y) * 7);
        rough[i + 2] = 255;
      }
    const revision = surfaceRevision(surface);
    writeFileSync(resolve(directory, `${surface}-${revision}-normal.png`), png(normal));
    writeFileSync(resolve(directory, `${surface}-${revision}-roughness.png`), png(rough));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  buildSurfaceMaps(fileURLToPath(new URL("../public/materials/pbr/", import.meta.url)));
