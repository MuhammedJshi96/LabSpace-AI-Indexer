import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// Read delivered RGBA8 pixels, not renderer source strings: a specular or
// exposure regression must fail even when the GLB's base color is still black.
function opaqueLuminance(id: string) {
  const png = readFileSync(`public/models/hero/renders/${id}-top.png`);
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  expect(png[24]).toBe(8);
  expect(png[25]).toBe(6);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT")
      chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const encoded = inflateSync(Buffer.concat(chunks));
  const stride = width * 4,
    pixels = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = encoded[source++];
    expect(filter).toBeLessThanOrEqual(4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= 4 ? pixels[i - 4] : 0;
      const b = y ? pixels[i - stride] : 0;
      const c = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth][filter];
      pixels[i] = (encoded[source++] + predictor) & 255;
    }
  }
  const values: number[] = [];
  for (let i = 0; i < pixels.length; i += 4)
    if (pixels[i + 3] > 240)
      values.push(0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]);
  expect(values.length).toBeGreaterThan(1000);
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

describe("material-faithful 2D catalog lighting", () => {
  it.each([
    "lab-bench",
    "asymmetric-lab-bench",
    "base-cabinet",
    "mobile-bench",
    "center-island-bench",
  ])("%s retains a dark phenolic top rather than grey studio glare", (id) => {
    expect(opaqueLuminance(id)).toBeLessThan(85);
  });
  it("does not darken the light laminate desk into charcoal", () => {
    expect(opaqueLuminance("office-desk")).toBeGreaterThan(185);
  });
});
