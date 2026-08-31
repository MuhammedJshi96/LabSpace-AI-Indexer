import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CONTACT_MAX_EDGE,
  CONTACT_MAX_PIXELS,
  contactShadingSize,
  suppressNonOccluders,
} from "../../src/lib/contact-shading";

describe("bounded reference contact shading", () => {
  it("caps buffers on small, 4K, retina and ultrawide displays", () => {
    for (const [w, h, dpr] of [
      [760, 530, 1],
      [3840, 2160, 2],
      [7680, 2160, 3],
      [900, 3000, 2],
      [0, 0, 1],
    ]) {
      const size = contactShadingSize(w, h, dpr);
      expect(size.width * size.height).toBeLessThanOrEqual(CONTACT_MAX_PIXELS);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(CONTACT_MAX_EDGE);
      expect(Math.min(size.width, size.height)).toBeGreaterThan(0);
    }
    expect(contactShadingSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("never treats clear glass or editor guides as solid occluders and restores visibility", () => {
    const scene = new THREE.Scene();
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.14 }),
    );
    const panel = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const hidden = panel.clone();
    hidden.visible = false;
    const line = new THREE.Line();
    scene.add(glass, panel, hidden, line);
    const restore = suppressNonOccluders(scene);
    expect(glass.visible).toBe(false);
    expect(line.visible).toBe(false);
    expect(panel.visible).toBe(true);
    restore();
    expect(glass.visible).toBe(true);
    expect(line.visible).toBe(true);
    expect(hidden.visible).toBe(false);
    glass.geometry.dispose();
    panel.geometry.dispose();
  });
});
