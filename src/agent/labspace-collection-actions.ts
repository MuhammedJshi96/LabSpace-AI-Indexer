import { z } from "zod";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildDigitalTwinIndex, filterDigitalTwinIndex } from "../domain/digital-twin-index";
import type { Project } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { focusLabRecord } from "./labspace-navigation-actions";
import { LabSpaceActionError } from "./labspace-read-actions";
import { agentActivityActions } from "./agent-activity-store";

const requirementsInput = z
  .object({
    brief: z.string().trim().min(1).max(240),
    materials: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  })
  .strict();
const routeInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    recordIds: z.array(z.string().trim().min(1).max(300)).min(1).max(24),
  })
  .strict();
const controlInput = z
  .object({
    action: z.enum(["status", "next", "previous", "finish", "history"]),
  })
  .strict();
const storedRouteSchema = z
  .object({
    id: z.string().default("legacy-guide"),
    startedAt: z.string().default(""),
    endedAt: z.string().optional(),
    records: z
      .array(
        z.object({
          id: z.string().max(300),
          name: z.string(),
          roomCode: z.string(),
          path: z.array(z.string()),
          recordedAmount: z.string(),
        }),
      )
      .max(24)
      .default([]),
    checked: z
      .array(z.object({ recordId: z.string().max(300), at: z.string() }))
      .max(24)
      .default([]),
    trail: z
      .array(
        z.object({
          action: z.string().max(100),
          at: z.string(),
          recordId: z.string().max(300),
          actor: z.enum(["Human", "WebMCP"]),
        }),
      )
      .max(96)
      .default([]),
    projectId: z.string(),
    title: z.string().max(120),
    recordIds: z.array(z.string().max(300)).min(1).max(24),
    step: z.number().int().min(0),
  })
  .refine((route) => route.step < route.recordIds.length);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new LabSpaceActionError(
      "Invalid collection request. Check the tool's required fields and limits.",
    );
  return result.data;
}

/** Suggestions are supplied by the agent/user; this resolver never invents a protocol or stock. */
export function resolveMaterials(input: unknown, project = useEditorStore.getState().project) {
  const { brief, materials } = parse(requirementsInput, input);
  const index = buildDigitalTwinIndex(project).filter((record) => record.kind !== "location");
  const requirements = [...new Set(materials)].map((query) => {
    const exact = index.filter(
      (record) => record.name.toLocaleLowerCase() === query.toLocaleLowerCase(),
    );
    const matches = exact.length
      ? exact
      : filterDigitalTwinIndex(index, {
          query,
          mode: "browse",
          scope: "project",
          activeRoomId: project.activeRoomId,
        });
    return {
      query,
      status:
        matches.length === 0 ? "missing" : exact.length === 1 ? "exact-match" : "review-candidates",
      totalMatches: matches.length,
      candidates: matches.slice(0, 4).map((record) => ({
        recordId: record.id,
        kind: record.kind,
        name: record.name,
        roomCode: record.roomCode,
        laboratoryCode: record.laboratoryCode,
        path: record.path,
        recordedAmount: record.primaryValue,
        status: record.status,
        navigable: Boolean(record.objectId),
      })),
    };
  });
  return {
    brief,
    requirements,
    missing: requirements.filter((entry) => entry.status === "missing").map((entry) => entry.query),
    requiresResearcherReview: true,
    notice:
      "Materials are agent/user suggestions, not an approved protocol. Matches are stored facts, not proof of suitability, sufficient stock, or permission to use. Confirm candidates before starting a collection guide.",
  };
}

export type CollectionRoute = z.infer<typeof storedRouteSchema>;
export const useCollectionStore = create<{
  route: CollectionRoute | null;
  history: CollectionRoute[];
  setRoute: (route: CollectionRoute | null) => void;
  archive: (route: CollectionRoute) => void;
}>()(
  persist(
    (set) => ({
      route: null,
      history: [],
      setRoute: (route) => set({ route }),
      archive: (route) =>
        set((state) => ({ route: null, history: [route, ...state.history].slice(0, 8) })),
    }),
    {
      name: "labspace-collection-guide-v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ route: state.route, history: state.history }),
      merge: (persisted, current) => {
        const result = storedRouteSchema.safeParse(
          (persisted as { route?: unknown } | undefined)?.route,
        );
        const history = z
          .array(storedRouteSchema)
          .max(8)
          .safeParse((persisted as { history?: unknown } | undefined)?.history);
        return {
          ...current,
          route: result.success ? result.data : null,
          history: history.success ? history.data : [],
        };
      },
    },
  ),
);

function currentRoute(project: Project) {
  const route = useCollectionStore.getState().route;
  if (!route || route.projectId !== project.id)
    throw new LabSpaceActionError("No collection guide is active for this project.");
  return route;
}

export function collectionStatus(project = useEditorStore.getState().project) {
  const route = currentRoute(project);
  const index = buildDigitalTwinIndex(project);
  return {
    title: route.title,
    step: route.step + 1,
    totalSteps: route.recordIds.length,
    checkedStops: route.checked.length,
    processId: route.id,
    stops: route.recordIds.map((id) => {
      const record = index.find((entry) => entry.id === id);
      return {
        recordId: id,
        name: record?.name ?? "Record unavailable",
        roomCode: record?.roomCode ?? null,
        path: record?.path ?? [],
        available: Boolean(record?.objectId),
        checkedAt: route.checked.find((entry) => entry.recordId === id)?.at ?? null,
      };
    }),
    notice:
      "Grouped collection itinerary, not a verified walking route or experiment protocol. No stock is consumed or reserved.",
  };
}

/** Collection is view-agnostic: retain the researcher's 2D/3D choice between stops. */
export function focusCollectionRecord(recordId: string) {
  const { digitalTwinSpatialMode, presentation } = useEditorStore.getState();
  const result = focusLabRecord({ recordId }, { revealStorage: true });
  useEditorStore.setState({ digitalTwinSpatialMode, presentation });
  return result;
}

export function startCollection(input: unknown) {
  const { title, recordIds } = parse(routeInput, input);
  if (new Set(recordIds).size !== recordIds.length)
    throw new LabSpaceActionError("Collection record IDs must be unique.");
  const project = useEditorStore.getState().project;
  const index = buildDigitalTwinIndex(project);
  const records = recordIds.map((id) => {
    const record = index.find((entry) => entry.id === id);
    if (!record?.objectId)
      throw new LabSpaceActionError(
        "Every collection stop must be an existing record with an assigned physical location.",
      );
    return record;
  });
  // Group by laboratory/room without pretending to know doors, stairs, or safe walking paths.
  const rooms = [...new Set(records.map((record) => record.roomId))];
  const ordered = rooms.flatMap((roomId) => records.filter((record) => record.roomId === roomId));
  focusCollectionRecord(ordered[0].id);
  const previous = useCollectionStore.getState().route;
  if (previous) {
    const at = new Date().toISOString();
    useCollectionStore
      .getState()
      .archive({
        ...previous,
        endedAt: at,
        trail: [
          ...previous.trail,
          {
            action: "Replaced by a new guide",
            actor: "WebMCP" as const,
            at,
            recordId: previous.recordIds[previous.step],
          },
        ].slice(-96),
      });
  }
  useCollectionStore.getState().setRoute({
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    checked: [],
    records: ordered.map((record) => ({
      id: record.id,
      name: record.name,
      roomCode: record.roomCode,
      path: record.path,
      recordedAmount: record.primaryValue,
    })),
    trail: [
      {
        action: "Guide started",
        actor: "WebMCP",
        recordId: ordered[0].id,
        at: new Date().toISOString(),
      },
    ],
    projectId: project.id,
    title,
    recordIds: ordered.map((record) => record.id),
    step: 0,
  });
  return collectionStatus();
}

export function controlCollection(input: unknown, actor: "Human" | "WebMCP" = "WebMCP") {
  const { action } = parse(controlInput, input);
  if (action === "history") return processHistory();
  const route = currentRoute(useEditorStore.getState().project);
  if (action === "finish") {
    const endedAt = new Date().toISOString();
    useCollectionStore
      .getState()
      .archive({
        ...route,
        endedAt,
        trail: [
          ...route.trail,
          { action: "Guide ended", at: endedAt, actor, recordId: route.recordIds[route.step] },
        ].slice(-96),
      });
    return { finished: true, inventoryChanged: false };
  }
  if (action !== "status") {
    const step = Math.max(
      0,
      Math.min(route.recordIds.length - 1, route.step + (action === "next" ? 1 : -1)),
    );
    focusCollectionRecord(route.recordIds[step]);
    useCollectionStore
      .getState()
      .setRoute({
        ...route,
        step,
        trail: [
          ...route.trail,
          {
            action: action === "next" ? "Next location viewed" : "Previous location viewed",
            actor,
            at: new Date().toISOString(),
            recordId: route.recordIds[step],
          },
        ].slice(-96),
      });
  }
  return collectionStatus();
}

/** Read-only, project-scoped evidence. Navigation never counts as a checkpoint. */
export function processHistory() {
  const projectId = useEditorStore.getState().project.id;
  const { route, history } = useCollectionStore.getState();
  return {
    projectId,
    runs: [route, ...history].filter((run) => run?.projectId === projectId),
    notice:
      "Local tab-session evidence, not a certified audit log. Record labels and amounts are snapshots from the start of each guide; no stock is deducted. Only the human checkpoint button confirms a location.",
  };
}

/** An explicit human checkpoint is separate from agent navigation and stock transactions. */
export function confirmCollectionStop() {
  const route = currentRoute(useEditorStore.getState().project);
  const recordId = route.recordIds[route.step];
  if (
    !buildDigitalTwinIndex(useEditorStore.getState().project).some(
      (record) => record.id === recordId && record.objectId,
    )
  )
    throw new LabSpaceActionError(
      "This location is no longer available. Review the assignment first.",
    );
  if (route.checked.some((entry) => entry.recordId === recordId)) return;
  const at = new Date().toISOString();
  useCollectionStore
    .getState()
    .setRoute({
      ...route,
      checked: [...route.checked, { recordId, at }],
      trail: [
        ...route.trail,
        { action: "Location checked", actor: "Human" as const, recordId, at },
      ].slice(-96),
    });
  agentActivityActions.record({
    actor: "Human",
    action: "Location checked",
    subject: route.title,
    status: "approved",
    evidence: "User confirmed this checkpoint. No stock consumed or reserved.",
  });
}

export const labSpaceCollectionActions = { resolveMaterials, startCollection, controlCollection };
