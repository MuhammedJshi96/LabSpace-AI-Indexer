import { beforeEach, describe, expect, it } from "vitest";
import {
  collectionStatus,
  confirmCollectionStop,
  controlCollection,
  startCollection,
  approveCollection,
  useCollectionStore,
} from "../../src/agent/labspace-collection-actions";
import { assessLabWorkflow } from "../../src/agent/labspace-workflow-actions";
import { buildDigitalTwinIndex } from "../../src/domain/digital-twin-index";
import { createSeedProject } from "../../src/domain/seed";
import { useEditorStore } from "../../src/store/editor-store";

beforeEach(() => {
  const project = createSeedProject();
  const demo = project.rooms.find((room) => room.code === "DEMO-01")!;
  project.activeRoomId = demo.id;
  useEditorStore.setState({
    project,
    hydrated: true,
    selectedIds: [],
    selectedLocationId: null,
    spatialFocus: null,
    digitalTwinSelectedRecordId: null,
    history: [],
    future: [],
    pendingAgentChange: null,
  });
  useCollectionStore.setState({ route: null, pending: null, history: [] });
});

describe("grounded workflow assessment", () => {
  it("grounds requirements, ranks a real work surface, and leaves project data unchanged", () => {
    const before = JSON.stringify(useEditorStore.getState().project);
    const result = assessLabWorkflow({
      brief: "Researcher-reviewed DPPH assay preparation",
      materials: ["Reference standards"],
      equipment: ["Analytical balance"],
      roomCode: "DEMO-01",
      workspacePreference: "laboratory-bench",
      minimumClearAreaM2: 0.25,
    });

    expect(result.materialEvidence[0]).toMatchObject({ status: "exact-match" });
    expect(result.equipmentEvidence[0].candidates[0]).toMatchObject({
      kind: "equipment",
      roomCode: "DEMO-01",
    });
    expect(result.workspaceCandidates.length).toBeGreaterThan(0);
    expect(result.recommendedWorkspace).toMatchObject({
      objectId: expect.any(String),
      roomCode: "DEMO-01",
      status: "clear",
    });
    expect(result.notice).toContain("not an approved assay protocol");
    expect(JSON.stringify(useEditorStore.getState().project)).toBe(before);
  });

  it("ends a reviewed collection itinerary at the assessed workspace without consuming stock", () => {
    const project = useEditorStore.getState().project;
    const inventory = buildDigitalTwinIndex(project).find(
      (record) => record.kind === "inventory" && record.name === "Reference standards",
    )!;
    const assessment = assessLabWorkflow({
      brief: "DPPH evidence handoff",
      materials: [inventory.name],
      roomCode: "DEMO-01",
      minimumClearAreaM2: 0.25,
    });
    const workspace = assessment.recommendedWorkspace!;
    const inventoryBefore = JSON.stringify(project.rooms.map((room) => room.scene.inventoryItems));

    expect(
      startCollection({
        title: "DPPH collection to workspace",
        recordIds: [inventory.id],
        workspaceObjectId: workspace.objectId,
      }),
    ).toMatchObject({ started: false, totalSteps: 2, requiresHumanApproval: true });
    approveCollection(useCollectionStore.getState().pending!.route.id);
    expect(controlCollection({ action: "next" })).toMatchObject({
      step: 2,
      totalSteps: 2,
      currentKind: "workspace",
      workspace: { objectId: workspace.objectId, available: true },
    });
    expect(useEditorStore.getState()).toMatchObject({
      selectedIds: [workspace.objectId],
      spatialFocus: {
        recordId: `workflow-workspace:${workspace.objectId}`,
        objectId: workspace.objectId,
      },
    });
    confirmCollectionStop();
    expect(collectionStatus().checkedStops).toBe(1);
    expect(useCollectionStore.getState().route?.trail.at(-1)?.action).toBe("Workspace reviewed");
    expect(
      JSON.stringify(
        useEditorStore.getState().project.rooms.map((room) => room.scene.inventoryItems),
      ),
    ).toBe(inventoryBefore);
  });

  it("keeps missing stock and unsuitable destinations explicit", () => {
    const result = assessLabWorkflow({
      brief: "Unrecorded assay",
      materials: ["Definitely absent reagent 404"],
      equipment: ["Definitely absent reader 404"],
      roomCode: "DEMO-01",
    });
    expect(result.readiness).toBe("blocked");
    expect(result.missing).toEqual([
      "Definitely absent reagent 404",
      "Definitely absent reader 404",
    ]);
    expect(() =>
      startCollection({
        title: "Invalid destination",
        recordIds: [
          buildDigitalTwinIndex(useEditorStore.getState().project).find(
            (record) => record.kind === "inventory" && record.objectId,
          )!.id,
        ],
        workspaceObjectId: "missing-workspace",
      }),
    ).toThrow("workspace was not found");
  });

  it("resolves bounded everyday equipment aliases without inventing a record", () => {
    const result = assessLabWorkflow({
      brief: "Voice-ready equipment check",
      materials: ["Reference standards"],
      equipment: ["laboratory scale"],
      roomCode: "DEMO-01",
    });

    expect(result.equipmentEvidence[0]).toMatchObject({
      status: "exact-match",
      matchMethod: "catalog-alias",
      totalMatches: 1,
      candidates: [{ name: "Analytical balance", roomCode: "DEMO-01" }],
    });
  });
});
