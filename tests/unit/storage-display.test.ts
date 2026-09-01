import { describe, expect, it } from "vitest";
import type { StorageLocation } from "../../src/domain/schema";
import {
  compactStorageLabel,
  storageFullPath,
  storageMapMarker,
  storageOptionLabel,
} from "../../src/domain/storage-display";

const locations: StorageLocation[] = [
  {
    id: "root",
    roomId: "room",
    objectId: "bench",
    parentId: null,
    name: "Laboratory bench with overhead cabinets",
    type: "cabinet",
    indexCode: "ROOT",
    order: 0,
    capacityNotes: "",
    childIds: ["bay"],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "bay",
    roomId: "room",
    objectId: "bench",
    parentId: "root",
    name: "Bench center paired-door cabinet",
    type: "compartment",
    indexCode: "BAY",
    order: 0,
    capacityNotes: "",
    childIds: ["drawer"],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "drawer",
    roomId: "room",
    objectId: "bench",
    parentId: "bay",
    name: "Bench center paired-door cabinet top drawer 1",
    type: "drawer",
    indexCode: "DRAWER",
    order: 0,
    capacityNotes: "",
    childIds: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
];

describe("compact storage display labels", () => {
  it("shortens repeated manufactured-part language without touching the source value", () => {
    const name = "Bench center paired-door cabinet top drawer 1";
    expect(compactStorageLabel(name, "drawer")).toBe("Center cabinet · drawer 1");
    expect(name).toBe("Bench center paired-door cabinet top drawer 1");
  });

  it("keeps the exact canonical breadcrumb separate from the compact selector label", () => {
    expect(storageFullPath(locations, "drawer")).toBe(
      "Laboratory bench with overhead cabinets / Bench center paired-door cabinet / Bench center paired-door cabinet top drawer 1",
    );
    expect(storageOptionLabel(locations, "drawer")).toBe("Center cabinet › Drawer 1");
    expect(storageOptionLabel(locations, "root")).toBe(
      "Whole unit · Lab bench · overhead cabinets",
    );
  });

  it("uses meaningful manufactured-part markers instead of anonymous map numbers", () => {
    expect(storageMapMarker("Drawer bank 4 drawer 2", "drawer", 8)).toBe("4.2");
    expect(storageMapMarker("Island north module 2 top drawer 1", "drawer", 8)).toBe("N2.1");
    expect(storageMapMarker("Shelf 02", "shelf", 8)).toBe("S2");
    expect(storageMapMarker("Custom freezer pocket", "bin", 8)).toBe("B9");
  });
});
