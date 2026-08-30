import { z } from "zod";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildDigitalTwinIndex, filterDigitalTwinIndex } from "../domain/digital-twin-index";
import type { Project } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { focusLabRecord } from "./labspace-navigation-actions";
import { LabSpaceActionError } from "./labspace-read-actions";

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
    action: z.enum(["status", "next", "previous", "finish"]),
  })
  .strict();
const storedRouteSchema = z
  .object({
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

export type CollectionRoute = {
  projectId: string;
  title: string;
  recordIds: string[];
  step: number;
};
export const useCollectionStore = create<{
  route: CollectionRoute | null;
  setRoute: (route: CollectionRoute | null) => void;
}>()(
  persist((set) => ({ route: null, setRoute: (route) => set({ route }) }), {
    name: "labspace-collection-guide-v1",
    storage: createJSONStorage(() => sessionStorage),
    partialize: (state) => ({ route: state.route }),
    merge: (persisted, current) => {
      const result = storedRouteSchema.safeParse(
        (persisted as { route?: unknown } | undefined)?.route,
      );
      return { ...current, route: result.success ? result.data : null };
    },
  }),
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
    stops: route.recordIds.map((id) => {
      const record = index.find((entry) => entry.id === id);
      return {
        recordId: id,
        name: record?.name ?? "Record unavailable",
        roomCode: record?.roomCode ?? null,
        path: record?.path ?? [],
        available: Boolean(record?.objectId),
      };
    }),
    notice:
      "Grouped collection itinerary, not a verified walking route or experiment protocol. No stock is consumed or reserved.",
  };
}

/** Collection is view-agnostic: retain the researcher's 2D/3D choice between stops. */
export function focusCollectionRecord(recordId: string) {
  const { digitalTwinSpatialMode, presentation } = useEditorStore.getState();
  const result = focusLabRecord({ recordId }, { revealStorage: false });
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
  useCollectionStore.getState().setRoute({
    projectId: project.id,
    title,
    recordIds: ordered.map((record) => record.id),
    step: 0,
  });
  return collectionStatus();
}

export function controlCollection(input: unknown) {
  const { action } = parse(controlInput, input);
  const route = currentRoute(useEditorStore.getState().project);
  if (action === "finish") {
    useCollectionStore.getState().setRoute(null);
    return { finished: true, inventoryChanged: false };
  }
  if (action !== "status") {
    const step = Math.max(
      0,
      Math.min(route.recordIds.length - 1, route.step + (action === "next" ? 1 : -1)),
    );
    focusCollectionRecord(route.recordIds[step]);
    useCollectionStore.getState().setRoute({ ...route, step });
  }
  return collectionStatus();
}

export const labSpaceCollectionActions = { resolveMaterials, startCollection, controlCollection };
