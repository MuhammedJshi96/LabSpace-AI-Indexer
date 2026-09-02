import { z } from "zod";
import { ASSET_BY_ID } from "../domain/assets";
import {
  buildDigitalTwinIndex,
  filterDigitalTwinIndex,
  type DigitalTwinRecord,
} from "../domain/digital-twin-index";
import {
  findBenchSupport,
  requiresBenchSupport,
  supportSurfaceElevation,
  validatePlacement,
} from "../domain/geometry";
import type { Project, Room, SceneObject } from "../domain/schema";
import { useEditorStore } from "../store/editor-store";
import { LabSpaceActionError } from "./labspace-read-actions";

const workflowAssessmentInput = z
  .object({
    brief: z.string().trim().min(1).max(240),
    materials: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
    equipment: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
    roomCode: z.string().trim().min(1).max(40).optional(),
    workspacePreference: z
      .enum(["laboratory-bench", "island-bench", "any-work-surface"])
      .default("laboratory-bench"),
    minimumClearAreaM2: z.number().min(0.25).max(6).default(0.6),
  })
  .strict();

function parseInput(input: unknown) {
  const result = workflowAssessmentInput.safeParse(input);
  if (!result.success) {
    throw new LabSpaceActionError(
      "Invalid workflow assessment. Check the material, equipment, room, and workspace fields.",
    );
  }
  return result.data;
}

function compact(value: number) {
  return Math.round(value * 100) / 100;
}

const WORKFLOW_TERM_ALIASES = new Map<string, string[]>([
  ["microplate reader", ["plate reader"]],
  ["absorbance plate reader", ["plate reader"]],
  ["laboratory scale", ["analytical balance"]],
  ["precision scale", ["analytical balance"]],
  ["mixer", ["vortex mixer"]],
  ["benchtop mixer", ["vortex mixer"]],
  ["microscope", ["compound microscope"]],
]);

function matchRequirements(
  queries: string[],
  records: DigitalTwinRecord[],
  kinds: Array<DigitalTwinRecord["kind"]>,
) {
  const eligible = records.filter((record) => kinds.includes(record.kind));
  return [...new Set(queries)].map((query) => {
    const normalizedQuery = query.toLocaleLowerCase();
    const directNames = [normalizedQuery, ...(WORKFLOW_TERM_ALIASES.get(normalizedQuery) ?? [])];
    const direct = eligible.filter((record) =>
      directNames.includes(record.name.toLocaleLowerCase()),
    );
    const matches = direct.length
      ? direct
      : filterDigitalTwinIndex(eligible, {
          query,
          mode: "browse",
          scope: "project",
          activeRoomId: useEditorStore.getState().project.activeRoomId,
        });
    return {
      query,
      status:
        matches.length === 0
          ? ("missing" as const)
          : direct.length === 1
            ? ("exact-match" as const)
            : ("review-candidates" as const),
      matchMethod:
        direct.length === 1
          ? direct[0].name.toLocaleLowerCase() === normalizedQuery
            ? ("exact-name" as const)
            : ("catalog-alias" as const)
          : matches.length
            ? ("search-candidates" as const)
            : ("none" as const),
      totalMatches: matches.length,
      candidates: matches.slice(0, 4).map((record) => ({
        recordId: record.id,
        kind: record.kind,
        name: record.name,
        laboratoryCode: record.laboratoryCode,
        roomCode: record.roomCode,
        path: record.path,
        recordedAmount: record.primaryValue,
        status: record.status,
        navigable: Boolean(record.objectId),
      })),
    };
  });
}

function workspaceProfileMatches(
  object: SceneObject,
  preference: z.infer<typeof workflowAssessmentInput>["workspacePreference"],
) {
  const definition = ASSET_BY_ID.get(object.assetDefinitionId ?? "");
  if (!definition || supportSurfaceElevation(object) === null) return false;
  const identity = `${definition.id} ${definition.name}`.toLocaleLowerCase();
  if (/sink|basin|wash station/.test(identity)) return false;
  if (preference === "island-bench") return identity.includes("island");
  if (preference === "laboratory-bench") return definition.profile === "bench";
  return ["bench", "table", "workstation"].includes(definition.profile);
}

function workspacePath(project: Project, room: Room, object: SceneObject) {
  const laboratory = project.laboratories.find((entry) => entry.id === room.laboratoryId);
  const zone = room.scene.zones.find((entry) => entry.id === object.zoneId);
  const space = room.spaces.find((entry) => entry.id === object.spaceId);
  return [
    laboratory?.name ?? "Laboratory",
    room.name,
    space && (space.kind === "annex" || space.name !== room.name) ? space.name : undefined,
    zone?.name,
    object.name,
  ].filter((entry): entry is string => Boolean(entry));
}

function workspaceCandidates(
  project: Project,
  rooms: Room[],
  preference: z.infer<typeof workflowAssessmentInput>["workspacePreference"],
  minimumClearAreaM2: number,
) {
  return rooms
    .flatMap((room) => {
      const warnings = validatePlacement(room);
      const supportedEquipment = room.scene.objects.filter(
        (object) =>
          object.visible &&
          requiresBenchSupport(object) &&
          findBenchSupport(room, object)?.object.id,
      );
      return room.scene.objects
        .filter((object) => object.visible && workspaceProfileMatches(object, preference))
        .map((object) => {
          const occupants = supportedEquipment.filter(
            (equipment) => findBenchSupport(room, equipment)?.object.id === object.id,
          );
          const surfaceAreaM2 = (object.dimensions.width * object.dimensions.depth) / 1_000_000;
          const occupiedAreaM2 = occupants.reduce(
            (total, equipment) =>
              total + (equipment.dimensions.width * equipment.dimensions.depth) / 1_000_000,
            0,
          );
          // Reserve a restrained edge/service allowance without pretending to know a protocol.
          const clearAreaM2 = Math.max(0, surfaceAreaM2 * 0.84 - occupiedAreaM2 * 1.12);
          const relatedWarnings = warnings.filter((warning) =>
            warning.objectIds.includes(object.id),
          );
          const errors = relatedWarnings.filter((warning) => warning.severity === "error");
          const cautions = relatedWarnings.filter((warning) => warning.severity === "warning");
          const status = errors.length
            ? ("blocked" as const)
            : clearAreaM2 >= minimumClearAreaM2
              ? ("clear" as const)
              : clearAreaM2 >= minimumClearAreaM2 * 0.55
                ? ("limited" as const)
                : ("blocked" as const);
          const laboratory = project.laboratories.find((entry) => entry.id === room.laboratoryId);
          const activeBonus = room.id === project.activeRoomId ? 0.15 : 0;
          const preferenceBonus = object.assetDefinitionId?.includes("island") ? 0.08 : 0;
          const score =
            (status === "clear" ? 3 : status === "limited" ? 1 : -3) +
            clearAreaM2 +
            activeBonus +
            preferenceBonus -
            cautions.length * 0.3 -
            errors.length;
          return {
            objectId: object.id,
            objectName: object.name,
            objectIndexCode: object.indexCode,
            assetId: object.assetDefinitionId ?? "",
            laboratoryCode: laboratory?.code ?? "LAB",
            roomCode: room.code,
            roomName: room.name,
            path: workspacePath(project, room, object),
            status,
            surfaceAreaM2: compact(surfaceAreaM2),
            estimatedClearAreaM2: compact(clearAreaM2),
            mountedEquipment: occupants.map((entry) => entry.name),
            cautions: relatedWarnings.slice(0, 4).map((warning) => warning.message),
            score,
          };
        });
    })
    .sort(
      (left, right) => right.score - left.score || left.objectName.localeCompare(right.objectName),
    )
    .slice(0, 6)
    .map(({ score, ...candidate }) => {
      void score;
      return candidate;
    });
}

/**
 * Grounds a researcher-supplied workflow checklist in recorded stock/equipment and ranks real
 * work surfaces. It deliberately does not generate, approve, or certify an experimental protocol.
 */
export function assessLabWorkflow(input: unknown, project = useEditorStore.getState().project) {
  const normalized = parseInput(input);
  const editableRooms = project.rooms.filter((room) => room.roomKind !== "demo-template");
  const rooms = normalized.roomCode
    ? editableRooms.filter(
        (room) => room.code.toLocaleLowerCase() === normalized.roomCode!.toLocaleLowerCase(),
      )
    : editableRooms;
  if (!rooms.length) {
    throw new LabSpaceActionError(
      normalized.roomCode
        ? `Editable room ${normalized.roomCode} was not found.`
        : "No editable LabSpace room is available for workflow assessment.",
    );
  }

  const records = buildDigitalTwinIndex(project);
  const materials = matchRequirements(normalized.materials, records, ["inventory"]);
  const equipmentRecords = normalized.roomCode
    ? records.filter(
        (record) =>
          record.roomCode.toLocaleLowerCase() === normalized.roomCode!.toLocaleLowerCase(),
      )
    : records;
  const equipment = matchRequirements(normalized.equipment, equipmentRecords, ["equipment"]);
  const workspaces = workspaceCandidates(
    project,
    rooms,
    normalized.workspacePreference,
    normalized.minimumClearAreaM2,
  );
  const missing = [
    ...materials.filter((entry) => entry.status === "missing").map((entry) => entry.query),
    ...equipment.filter((entry) => entry.status === "missing").map((entry) => entry.query),
  ];
  const ambiguous = [...materials, ...equipment]
    .filter((entry) => entry.status === "review-candidates")
    .map((entry) => entry.query);
  const recommendedWorkspace = workspaces.find((candidate) => candidate.status === "clear") ?? null;
  const readiness =
    missing.length || !recommendedWorkspace
      ? ("blocked" as const)
      : ambiguous.length
        ? ("review-needed" as const)
        : ("ready-for-researcher-review" as const);

  return {
    brief: normalized.brief,
    readiness,
    materialEvidence: materials,
    equipmentEvidence: equipment,
    missing,
    ambiguous,
    recommendedWorkspace,
    workspaceCandidates: workspaces,
    nextStep: recommendedWorkspace
      ? {
          tool: "labspace_start_collection",
          instruction:
            "After the researcher chooses exact material record IDs, start_collection may include this workspaceObjectId as the final highlighted stop.",
          workspaceObjectId: recommendedWorkspace.objectId,
        }
      : null,
    requiresResearcherReview: true,
    basis: [
      "Inventory and equipment matches come only from the canonical Spatial Index.",
      "Workspace ranking uses authored support surfaces, mounted-equipment footprints, current placement warnings, and the requested minimum clear area.",
      "The final collection stop can highlight the chosen work surface without changing stock, room geometry, or saved assignments.",
    ],
    notice:
      "Planning evidence only—not an approved assay protocol, suitability determination, decontamination assessment, safety-approved route, or permission to use stock or equipment. A researcher must review every candidate and local procedure.",
  };
}

export const labSpaceWorkflowActions = { assessLabWorkflow };
