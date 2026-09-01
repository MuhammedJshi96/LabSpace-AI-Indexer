import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveMaterials,
  startCollection,
  controlCollection,
  useCollectionStore,
  confirmCollectionStop,
  processHistory,
} from "../../src/agent/labspace-collection-actions";
import { createSeedProject } from "../../src/domain/seed";
import { buildDigitalTwinIndex } from "../../src/domain/digital-twin-index";
import { useEditorStore } from "../../src/store/editor-store";

beforeEach(() => {
  useEditorStore.setState({
    project: createSeedProject(),
    history: [],
    future: [],
    pendingAgentChange: null,
    selectedIds: [],
  });
  useCollectionStore.setState({ route: null, history: [] });
});

describe("grounded material collection", () => {
  it("records human-only checkpoints separately from agent navigation and preserves start-time evidence", () => {
    const project = useEditorStore.getState().project;
    const records = buildDigitalTwinIndex(project)
      .filter((record) => record.kind === "inventory" && record.objectId)
      .slice(0, 2);
    const inventoryBefore = JSON.stringify(project.rooms.map((room) => room.scene.inventoryItems));
    startCollection({
      title: "Auditable locations",
      recordIds: records.map((record) => record.id),
    });
    controlCollection({ action: "next" });
    expect(useCollectionStore.getState().route?.checked).toHaveLength(0);
    confirmCollectionStop();
    confirmCollectionStop();
    expect(useCollectionStore.getState().route?.checked).toHaveLength(1);
    expect(useCollectionStore.getState().route?.trail.at(-1)?.actor).toBe("Human");
    expect(() => controlCollection({ action: "confirm" })).toThrow("Invalid collection");
    controlCollection({ action: "finish" });
    expect(useCollectionStore.getState().route).toBeNull();
    expect(processHistory().runs[0]?.records[0]).toMatchObject({
      id: records[0].id,
      name: records[0].name,
      recordedAmount: records[0].primaryValue,
    });
    expect(controlCollection({ action: "history" })).toEqual(processHistory());
    expect(
      JSON.stringify(
        useEditorStore.getState().project.rooms.map((room) => room.scene.inventoryItems),
      ),
    ).toBe(inventoryBefore);
    useEditorStore.setState({ project: { ...project, id: "different-project" } });
    expect(processHistory().runs).toHaveLength(0);
  });
  it("archives replaced guides with bounded history and validates before replacing", () => {
    const record = buildDigitalTwinIndex(useEditorStore.getState().project).find(
      (record) => record.kind === "inventory" && record.objectId,
    )!;
    for (let i = 0; i < 11; i++) startCollection({ title: `Guide ${i}`, recordIds: [record.id] });
    expect(useCollectionStore.getState().history).toHaveLength(8);
    const before = useCollectionStore.getState().route;
    expect(() => startCollection({ title: "Invalid", recordIds: ["missing-record"] })).toThrow();
    expect(useCollectionStore.getState().route).toBe(before);
  });
  it("finds the eligible showcase record, reports missing stock and does not mutate", () => {
    const project = useEditorStore.getState().project;
    const before = JSON.stringify(project);
    const result = resolveMaterials({
      brief: "Prepare a researcher-reviewed checklist",
      materials: ["Reference standards", "Unrecorded test material xyz"],
    });
    expect(result.requirements[0].status).toBe("exact-match");
    expect(result.requirements[0].candidates[0].roomCode).toBe("DEMO-01");
    expect(result.missing).toEqual(["Unrecorded test material xyz"]);
    expect(result.requiresResearcherReview).toBe(true);
    expect(JSON.stringify(project)).toBe(before);
  });
  it("does not silently choose among duplicate names", () => {
    const project = createSeedProject();
    const room = project.rooms.find((entry) => entry.code === "DEMO-01")!;
    const item = room.scene.inventoryItems.find((entry) => entry.name === "Reference standards")!;
    room.scene.inventoryItems.push({ ...item, id: "another-stock-record" });
    expect(
      resolveMaterials({ brief: "Review", materials: [item.name] }, project).requirements[0].status,
    ).toBe("review-candidates");
  });
  it("keeps a chosen 2D fallback while focusing and advancing exact records", () => {
    const project = useEditorStore.getState().project;
    const records = buildDigitalTwinIndex(project)
      .filter((record) => record.kind === "inventory" && record.objectId)
      .slice(0, 2);
    useEditorStore.setState({ digitalTwinSpatialMode: "2d", presentation: "2d" });
    startCollection({ title: "2D collection", recordIds: records.map((record) => record.id) });
    expect(useEditorStore.getState()).toMatchObject({
      digitalTwinSpatialMode: "2d",
      presentation: "2d",
      selectedLocationId: records[0].locationId,
    });
    controlCollection({ action: "next" });
    expect(useEditorStore.getState()).toMatchObject({
      digitalTwinSpatialMode: "2d",
      presentation: "2d",
      selectedLocationId: records[1].locationId,
    });
  });
  it("focuses next and previous exact locations without consuming stock or creating history", () => {
    const project = useEditorStore.getState().project;
    const records = buildDigitalTwinIndex(project)
      .filter((record) => record.kind === "inventory" && record.objectId)
      .slice(0, 2);
    const before = JSON.stringify(project.rooms);
    startCollection({
      title: "Collect preparation supplies",
      recordIds: records.map((record) => record.id),
    });
    expect(useEditorStore.getState().selectedLocationId).toBe(records[0].locationId);
    expect(controlCollection({ action: "next" })).toMatchObject({ step: 2, totalSteps: 2 });
    expect(useEditorStore.getState().selectedLocationId).toBe(records[1].locationId);
    expect(controlCollection({ action: "previous" })).toMatchObject({ step: 1 });
    expect(JSON.stringify(useEditorStore.getState().project.rooms)).toBe(before);
    expect(useEditorStore.getState().history).toHaveLength(0);
    expect(controlCollection({ action: "finish" })).toEqual({
      finished: true,
      inventoryChanged: false,
    });
  });
  it("rejects invalid, duplicate, unlocated and unexpected inputs before focusing", () => {
    expect(() => resolveMaterials({ brief: "x", materials: [] })).toThrow("Invalid collection");
    expect(() => resolveMaterials({ brief: "x", materials: ["tips"], surprise: true })).toThrow(
      "Invalid collection",
    );
    expect(() => startCollection({ title: "x", recordIds: ["fake"] })).toThrow("physical location");
    expect(() => startCollection({ title: "x", recordIds: ["fake", "fake"] })).toThrow("unique");
    expect(() => controlCollection({ action: "next" })).toThrow("No collection guide");
  });
  it("fails a missing next stop without advancing", () => {
    const project = useEditorStore.getState().project;
    const records = buildDigitalTwinIndex(project)
      .filter((record) => record.kind === "inventory" && record.objectId)
      .slice(0, 2);
    startCollection({ title: "Review", recordIds: records.map((record) => record.id) });
    useEditorStore.setState({
      project: {
        ...project,
        rooms: project.rooms.map((room) => ({
          ...room,
          scene: { ...room.scene, inventoryItems: [] },
        })),
      },
    });
    expect(() => controlCollection({ action: "next" })).toThrow("Record not found");
    expect(useCollectionStore.getState().route?.step).toBe(0);
  });
});
