import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYER_ROLES,
  createDefaultLayers,
  ensureDefaultLayers,
  resolveLayerIdForObjectType,
} from "../../src/domain/layers";
import type { Layer } from "../../src/domain/schema";

describe("semantic project layers", () => {
  it("creates a complete role-addressable layer set without fixed seed IDs", () => {
    const layers = createDefaultLayers();

    expect(layers.map((layer) => layer.role)).toEqual(DEFAULT_LAYER_ROLES);
    expect(new Set(layers.map((layer) => layer.id)).size).toBe(DEFAULT_LAYER_ROLES.length);
    expect(resolveLayerIdForObjectType(layers, "wall")).toBe(
      layers.find((layer) => layer.role === "walls")?.id,
    );
    expect(resolveLayerIdForObjectType(layers, "equipment")).toBe(
      layers.find((layer) => layer.role === "equipment")?.id,
    );
  });

  it("preserves imported custom layers, infers known roles, and fills missing defaults", () => {
    const imported: Layer[] = [
      {
        id: "custom-instruments-layer",
        name: "Instruments",
        visible: true,
        locked: false,
        order: 40,
        color: "#246789",
        system: false,
      },
      {
        id: "custom-research-notes",
        name: "Research notes",
        visible: true,
        locked: false,
        order: 41,
        color: "#765432",
        system: false,
      },
    ];

    const normalized = ensureDefaultLayers(imported);

    expect(normalized.slice(0, 2).map((layer) => layer.id)).toEqual([
      "custom-instruments-layer",
      "custom-research-notes",
    ]);
    expect(normalized[0].role).toBe("equipment");
    expect(normalized[1].role).toBeUndefined();
    expect(resolveLayerIdForObjectType(normalized, "equipment")).toBe("custom-instruments-layer");
    expect(new Set(normalized.flatMap((layer) => (layer.role ? [layer.role] : [])))).toEqual(
      new Set(DEFAULT_LAYER_ROLES),
    );
  });
});
