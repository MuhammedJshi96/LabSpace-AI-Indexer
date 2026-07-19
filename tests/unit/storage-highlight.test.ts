import { describe, expect, it } from "vitest";
import type { InventoryItem, StorageLocation } from "../../src/domain/schema";
import {
  storageAccessContentStyle,
  storageLocationHighlight,
  storageLocationSupportsAccessPreview,
} from "../../src/domain/storage-highlight";

const createdAt = "2026-07-17T00:00:00.000Z";

function location(
  id: string,
  parentId: string | null,
  type: StorageLocation["type"],
  order: number,
): StorageLocation {
  return {
    id,
    roomId: "room-0001",
    objectId: "cabinet-0001",
    parentId,
    type,
    name: id,
    indexCode: id.toLocaleUpperCase(),
    order,
    capacityNotes: "",
    childIds: [],
    createdAt,
    updatedAt: createdAt,
  };
}

const locations = [
  location("root-cabinet", null, "cabinet", 0),
  location("drawer-top", "root-cabinet", "drawer", 0),
  location("drawer-bottom", "root-cabinet", "drawer", 1),
  location("sample-bin", "drawer-bottom", "bin", 0),
];

const authoredLocations = [
  location("authored-cabinet", null, "cabinet", 0),
  {
    ...location("authored-drawer", "authored-cabinet", "drawer", 0),
    normalizedBounds: {
      x: 0.15,
      y: 0.62,
      z: -0.08,
      width: 0.72,
      depth: 0.84,
      height: 0.16,
    },
  },
  {
    ...location("authored-bin", "authored-drawer", "bin", 0),
    normalizedBounds: {
      x: -0.12,
      y: 0.18,
      z: 0.04,
      width: 0.58,
      depth: 0.64,
      height: 0.52,
    },
  },
];

const dimensions = { width: 1200, depth: 600, height: 900 };

function inventory(
  id: string,
  name: string,
  storageLocationId: string | null,
  notes = "",
): InventoryItem {
  return {
    id,
    name,
    quantity: 1,
    unit: "set",
    notes,
    owner: "Shared",
    expiryDate: null,
    storageLocationId,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("storage location spatial highlights", () => {
  it("limits physical access previews to openable storage locations", () => {
    expect(storageLocationSupportsAccessPreview("drawer")).toBe(true);
    expect(storageLocationSupportsAccessPreview("bin")).toBe(true);
    expect(storageLocationSupportsAccessPreview("shelf")).toBe(true);
    expect(storageLocationSupportsAccessPreview("compartment")).toBe(true);
    expect(storageLocationSupportsAccessPreview("cabinet")).toBe(false);
  });

  it("uses the full asset envelope for a root location", () => {
    expect(storageLocationHighlight("root-cabinet", "cabinet-0001", locations, dimensions)).toEqual(
      {
        position: [0, 0, 0],
        width: 1.2,
        depth: 0.6,
        height: 0.9,
      },
    );
  });

  it("maps ordered drawers into distinct vertical regions", () => {
    const top = storageLocationHighlight("drawer-top", "cabinet-0001", locations, dimensions)!;
    const bottom = storageLocationHighlight(
      "drawer-bottom",
      "cabinet-0001",
      locations,
      dimensions,
    )!;

    expect(top.position[1]).toBeGreaterThan(bottom.position[1]);
    expect(top.height).toBeCloseTo(bottom.height);
    expect(top.width).toBeLessThan(1.2);
    expect(top.depth).toBeLessThan(0.6);
  });

  it("maps a nested bin to a smaller region inside its parent drawer", () => {
    const drawer = storageLocationHighlight(
      "drawer-bottom",
      "cabinet-0001",
      locations,
      dimensions,
    )!;
    const bin = storageLocationHighlight("sample-bin", "cabinet-0001", locations, dimensions)!;

    expect(bin.width).toBeLessThan(drawer.width);
    expect(bin.depth).toBeLessThan(drawer.depth);
    expect(bin.height).toBeLessThan(drawer.height);
    expect(bin.position[1]).toBeGreaterThan(drawer.position[1]);
  });

  it("honors authored normalized bounds for exact scalable drawer and bin traces", () => {
    const drawer = storageLocationHighlight(
      "authored-drawer",
      "cabinet-0001",
      authoredLocations,
      dimensions,
    )!;
    const bin = storageLocationHighlight(
      "authored-bin",
      "cabinet-0001",
      authoredLocations,
      dimensions,
    )!;

    expect(drawer.position[0]).toBeCloseTo(0.18);
    expect(drawer.position[1]).toBeCloseTo(0.558);
    expect(drawer.position[2]).toBeCloseTo(-0.048);
    expect(drawer.width).toBeCloseTo(0.864);
    expect(drawer.depth).toBeCloseTo(0.504);
    expect(drawer.height).toBeCloseTo(0.144);
    expect(bin.position[0]).toBeCloseTo(0.07632);
    expect(bin.position[1]).toBeCloseTo(0.58392);
    expect(bin.position[2]).toBeCloseTo(-0.02784);
    expect(bin.width).toBeCloseTo(0.50112);
    expect(bin.depth).toBeCloseTo(0.32256);
    expect(bin.height).toBeCloseTo(0.08);
  });

  it("does not trace a location that belongs to another object", () => {
    expect(
      storageLocationHighlight("sample-bin", "different-object", locations, dimensions),
    ).toBeNull();
  });

  it("derives a vial presentation from inventory stored in a nested bin", () => {
    expect(
      storageAccessContentStyle("drawer-bottom", locations, [
        inventory("inventory-vials", "HPLC autosampler vials", "sample-bin"),
      ]),
    ).toBe("vials");
  });

  it("derives glassware and bottle presentations from grounded inventory evidence", () => {
    expect(
      storageAccessContentStyle("drawer-bottom", locations, [
        inventory("inventory-flasks", "Rotary evaporator flask set", "sample-bin"),
      ]),
    ).toBe("glassware");
    expect(
      storageAccessContentStyle("drawer-bottom", locations, [
        inventory("inventory-reagents", "Mobile phase reagent bottles", "sample-bin"),
      ]),
    ).toBe("bottles");
  });

  it("uses organized consumable boxes when there is no more specific evidence", () => {
    expect(storageAccessContentStyle("drawer-bottom", locations, [])).toBe("boxes");
    expect(
      storageAccessContentStyle("drawer-bottom", locations, [
        inventory("inventory-gloves", "Nitrile gloves", "sample-bin"),
      ]),
    ).toBe("boxes");
  });
});
