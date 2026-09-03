import { LabSpaceActionError, labSpaceReadActions } from "../agent/labspace-read-actions";
import {
  recordControlledToolError,
  recordWebMCPToolSuccess,
  type AgentActivityStatus,
} from "../agent/agent-activity-store";
import { labSpaceNavigationActions } from "../agent/labspace-navigation-actions";
import { labSpaceSpatialActions } from "../agent/labspace-spatial-actions";
import { labSpaceStagingActions } from "../agent/labspace-staging-actions";
import { labSpaceLayoutActions } from "../agent/labspace-layout-actions";
import { labSpaceInventoryActions } from "../agent/labspace-inventory-actions";
import { labSpaceWorkspaceActions } from "../agent/labspace-workspace-actions";
import { labSpaceCollectionActions } from "../agent/labspace-collection-actions";
import { labSpaceWorkflowActions } from "../agent/labspace-workflow-actions";
import { executionDecisionForTool } from "../agent/webmcp-execution-policy";
import { labSpaceAnnexActions } from "../agent/labspace-annex-actions";
import type {
  LabSpaceLayoutActions,
  LabSpaceInventoryActions,
  LabSpaceNavigationActions,
  LabSpaceReadActions,
  LabSpaceSpatialActions,
  LabSpaceStagingActions,
  LabSpaceWorkspaceActions,
  LabSpaceAnnexActions,
} from "../agent/labspace-action-types";
import {
  auditRoomSchema,
  assessWorkflowSchema,
  resolveMaterialsSchema,
  startCollectionSchema,
  collectionStepSchema,
  createRoomSchema,
  emptyObjectSchema,
  focusRecordSchema,
  inspectRecordSchema,
  listInventoryLocationsSchema,
  planInventorySchema,
  planRoomLayoutSchema,
  planAnnexSchema,
  recommendObjectPlacementsSchema,
  searchRecordsSchema,
  searchAssetsSchema,
  stageRoomLayoutSchema,
  stageAnnexPlanSchema,
  stageInventoryPlanSchema,
  stageObjectMoveSchema,
  stageObjectResizeSchema,
  validateObjectMoveSchema,
  validateObjectResizeSchema,
} from "./tool-schemas";
import type { LabSpaceToolRegistration, RegisterLabSpaceToolsOptions } from "./webmcp-types";

export const LABSPACE_WEBMCP_TOOL_NAMES = [
  "labspace_add_inventory",
  "labspace_assess_workflow",
  "labspace_audit_room",
  "labspace_collection_step",
  "labspace_create_room",
  "labspace_find_valid_placements",
  "labspace_focus_record",
  "labspace_get_context",
  "labspace_inspect_record",
  "labspace_inventory_locations",
  "labspace_plan_annex",
  "labspace_plan_inventory",
  "labspace_plan_room",
  "labspace_resolve_materials",
  "labspace_search_assets",
  "labspace_search_records",
  "labspace_stage_annex_plan",
  "labspace_stage_inventory_plan",
  "labspace_stage_object_move",
  "labspace_stage_resize",
  "labspace_stage_room_plan",
  "labspace_start_collection",
  "labspace_validate_object_move",
  "labspace_validate_resize",
] as const;

function completeControlledExecution(
  signal: AbortSignal | undefined,
  toolName: string,
  action: string,
  input: unknown,
  result: unknown,
) {
  signal?.throwIfAborted();
  const rawResultRecord =
    result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const policyDecision = executionDecisionForTool(toolName);
  const decoratedResult =
    policyDecision && rawResultRecord.requiresHumanApproval === true
      ? {
          ...rawResultRecord,
          executionMode: policyDecision.mode,
          executionDisposition: policyDecision.disposition,
          executionReason: policyDecision.reason,
        }
      : result;
  const resultRecord =
    decoratedResult && typeof decoratedResult === "object"
      ? (decoratedResult as Record<string, unknown>)
      : {};
  const status: AgentActivityStatus =
    (toolName === "labspace_create_room" && resultRecord.created === true) ||
    resultRecord.autoCommitted === true
      ? "committed"
      : resultRecord.requiresHumanApproval === true
        ? "pending"
        : toolName === "labspace_audit_room"
          ? resultRecord.status === "blocked"
            ? "blocked"
            : "valid"
          : toolName === "labspace_stage_object_move" ||
              toolName === "labspace_stage_resize" ||
              toolName === "labspace_stage_room_plan" ||
              toolName === "labspace_stage_inventory_plan" ||
              toolName === "labspace_stage_annex_plan" ||
              toolName === "labspace_add_inventory"
            ? "pending"
            : toolName === "labspace_find_valid_placements"
              ? Array.isArray(resultRecord.candidates) && resultRecord.candidates.length > 0
                ? "found"
                : "blocked"
              : toolName === "labspace_assess_workflow"
                ? resultRecord.readiness === "blocked"
                  ? "blocked"
                  : "found"
                : toolName === "labspace_plan_room" || toolName === "labspace_plan_annex"
                  ? Number(resultRecord.plannedObjects) > 0
                    ? "found"
                    : "blocked"
                  : toolName === "labspace_validate_object_move" ||
                      toolName === "labspace_validate_resize"
                    ? resultRecord.valid === false
                      ? "blocked"
                      : "valid"
                    : toolName === "labspace_focus_record"
                      ? "focused"
                      : toolName === "labspace_search_records"
                        ? Array.isArray(resultRecord.results) && resultRecord.results.length > 0
                          ? "found"
                          : "read"
                        : "read";
  const subject =
    typeof resultRecord.objectName === "string"
      ? resultRecord.objectName
      : typeof resultRecord.roomName === "string"
        ? resultRecord.roomName
        : typeof resultRecord.name === "string"
          ? resultRecord.name
          : typeof (input as Record<string, unknown> | null)?.query === "string"
            ? `“${String((input as Record<string, unknown>).query)}”`
            : action;
  recordWebMCPToolSuccess(toolName, action, subject, status, input, decoratedResult);
  return decoratedResult;
}

function controlledExecution(
  signal: AbortSignal | undefined,
  toolName: string,
  action: string,
  input: unknown,
  execute: () => unknown,
) {
  signal?.throwIfAborted();
  try {
    const result = execute();
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      return Promise.resolve(result).then(
        (resolved) => completeControlledExecution(signal, toolName, action, input, resolved),
        (error: unknown) => {
          signal?.throwIfAborted();
          recordControlledToolError(action, error, toolName, input);
          if (error instanceof LabSpaceActionError) throw new Error(error.message);
          throw new Error("LabSpace could not complete this tool request.");
        },
      );
    }
    return completeControlledExecution(signal, toolName, action, input, result);
  } catch (error) {
    signal?.throwIfAborted();
    recordControlledToolError(action, error, toolName, input);
    if (error instanceof LabSpaceActionError) {
      // Tool-facing errors intentionally omit internal causes, stacks, and filesystem details.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(error.message);
    }
    // eslint-disable-next-line preserve-caught-error
    throw new Error("LabSpace could not complete this tool request.");
  }
}

export function createLabSpaceToolDefinitions(
  actions: LabSpaceReadActions = labSpaceReadActions,
  navigationActions: LabSpaceNavigationActions = labSpaceNavigationActions,
  spatialActions: LabSpaceSpatialActions = labSpaceSpatialActions,
  stagingActions: LabSpaceStagingActions = labSpaceStagingActions,
  layoutActions: LabSpaceLayoutActions = labSpaceLayoutActions,
  inventoryActions: LabSpaceInventoryActions = labSpaceInventoryActions,
  workspaceActions: LabSpaceWorkspaceActions = labSpaceWorkspaceActions,
  collectionActions = labSpaceCollectionActions,
  annexActions: LabSpaceAnnexActions = labSpaceAnnexActions,
): WebMCP.ModelContextTool[] {
  return [
    {
      name: "labspace_add_inventory",
      title: "Add inventory with researcher review",
      description:
        "Validate and stage up to twenty inventory entries in one call. Use exact room codes and optional storage IDs from inventory_locations. Shows a review panel; records are saved only after the researcher approves. Never fabricate stock.",
      inputSchema: planInventorySchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, context?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          context?.signal,
          "labspace_add_inventory",
          "Inventory creation review",
          input,
          () =>
            stagingActions.stageInventoryPlan({
              planId: inventoryActions.planInventory(input).planId,
            }),
        ),
    },
    {
      name: "labspace_assess_workflow",
      title: "Assess a grounded laboratory workflow",
      description:
        "Match a researcher-supplied material and equipment checklist to canonical records, then rank real authored work surfaces by clear area and current geometry. Returns evidence and a final workspace ID for the collection guide. It does not generate or approve a protocol, certify suitability, or claim a safe route.",
      inputSchema: assessWorkflowSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, context?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          context?.signal,
          "labspace_assess_workflow",
          "Workflow readiness assessment",
          input,
          () => labSpaceWorkflowActions.assessLabWorkflow(input),
        ),
    },
    {
      name: "labspace_resolve_materials",
      title: "Match suggested materials to real stock",
      description:
        "Ground an agent/researcher material list in actual inventory and equipment. Returns missing items, exact matches, and candidates needing review. Does not derive or certify a protocol, infer substitutions, create stock, or claim suitability.",
      inputSchema: resolveMaterialsSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, context?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          context?.signal,
          "labspace_resolve_materials",
          "Material evidence",
          input,
          () => collectionActions.resolveMaterials(input),
        ),
    },
    {
      name: "labspace_start_collection",
      title: "Start a guided collection itinerary",
      description:
        "Create a Next/Previous guide from reviewed canonical record IDs, grouped by room, with an optional assessed work surface as the final highlighted stop. Focuses spatial evidence without modifying stock. This is an ordered itinerary, not a verified walking path, safety instruction, or permission to run an experiment.",
      inputSchema: startCollectionSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, context?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          context?.signal,
          "labspace_start_collection",
          "Collection guide",
          input,
          () => collectionActions.startCollection(input),
        ),
    },
    {
      name: "labspace_collection_step",
      title: "Navigate the collection guide",
      description:
        "Read guide status or project-scoped session history (action: history), focus next/previous, or finish. Navigation is timestamped but does not confirm collection. Human-only checkpoints and start-time record snapshots are available in history. No stock is consumed or reserved; this is not a certified audit log. Missing records fail with a controlled error.",
      inputSchema: collectionStepSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, context?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          context?.signal,
          "labspace_collection_step",
          "Collection navigation",
          input,
          () => collectionActions.controlCollection(input),
        ),
    },
    {
      name: "labspace_audit_room",
      title: "Audit LabSpace room readiness",
      description:
        "Summarize the active or selected editable room using deterministic floor, boundary, overlap, support, front-working-zone, opening, height, and identity checks without changing project state.",
      inputSchema: auditRoomSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_audit_room",
          "Room readiness audit",
          input,
          () => spatialActions.auditRoom(input),
        ),
    },
    {
      name: "labspace_create_room",
      title: "Create a blank LabSpace room",
      description:
        "Propose one genuinely blank room in the current or selected laboratory. Reviewed mode pauses before creation; human-authorized Fast Draft may apply this validated additive change. The agent cannot select the mode.",
      inputSchema: createRoomSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_create_room",
          "Room creation",
          input,
          () => workspaceActions.createRoom(input),
        ),
    },
    {
      name: "labspace_find_valid_placements",
      title: "Find valid LabSpace placements",
      description:
        "Rank geometry-valid positions near a preferred area or relative to another object's authored front. Preserves usable front working zones and returns a facing rotation without changing the room, preview, history, or saved project.",
      inputSchema: recommendObjectPlacementsSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_find_valid_placements",
          "Placement search",
          input,
          () => spatialActions.recommendObjectPlacements(input),
        ),
    },
    {
      name: "labspace_get_context",
      title: "Get LabSpace context",
      description:
        "Return the active LabSpace project, laboratory, room, selection, and compact Spatial Index counts.",
      inputSchema: emptyObjectSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (_input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_get_context",
          "Context read",
          {},
          () => actions.getLabContext(),
        ),
    },
    {
      name: "labspace_focus_record",
      title: "Focus LabSpace record",
      description:
        "Reveal one canonical Spatial Index record in the correct LabSpace room, selection, storage evidence, and 3D camera.",
      inputSchema: focusRecordSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_focus_record",
          "Record focus",
          input,
          () => navigationActions.focusLabRecord(input),
        ),
    },
    {
      name: "labspace_inventory_locations",
      title: "List LabSpace inventory locations",
      description:
        "List canonical storage destinations across editable LabSpace rooms before proposing inventory records. Hidden factory-template rooms are excluded.",
      inputSchema: listInventoryLocationsSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_inventory_locations",
          "Inventory location search",
          input,
          () => inventoryActions.listInventoryLocations(input),
        ),
    },
    {
      name: "labspace_plan_inventory",
      title: "Plan LabSpace inventory records",
      description:
        "Validate up to twenty inventory records against exact editable rooms and canonical storage locations. Returns a read-only proposal for human review.",
      inputSchema: planInventorySchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_plan_inventory",
          "Inventory planning",
          input,
          () => inventoryActions.planInventory(input),
        ),
    },
    {
      name: "labspace_plan_annex",
      title: "Plan a connected LabSpace annex",
      description:
        "Calculate a separate annex floor by splitting one stable primary-space wall, remapping hosted openings, and optionally adding a connected door, exterior windows, and floor assets. Read-only; validates both closed floors and never changes the primary area.",
      inputSchema: planAnnexSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_plan_annex",
          "Annex planning",
          input,
          () => annexActions.planAnnex(input),
        ),
    },
    {
      name: "labspace_plan_room",
      title: "Plan a LabSpace room",
      description:
        "Calculate a validated rectangular or multi-wall shell, wall-hosted openings, and exact catalog assets. Seats pair with workstations, perimeter assets face inward, and bench equipment snaps to worktops. Existing walls are preserved.",
      inputSchema: planRoomLayoutSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_plan_room",
          "Room planning",
          input,
          () => layoutActions.planRoomLayout(input),
        ),
    },
    {
      name: "labspace_search_assets",
      title: "Search LabSpace assets",
      description:
        "Search the canonical room-planning catalog for openings, furniture, storage, equipment, and safety assets with exact dimensions and indexing behavior.",
      inputSchema: searchAssetsSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_search_assets",
          "Asset search",
          input,
          () => layoutActions.searchLabAssets(input),
        ),
    },
    {
      name: "labspace_search_records",
      title: "Search LabSpace records",
      description:
        "Search the canonical LabSpace Spatial Index for equipment, inventory, and exact storage locations.",
      inputSchema: searchRecordsSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_search_records",
          "Spatial search",
          input,
          () => actions.searchLabRecords(input),
        ),
    },
    {
      name: "labspace_inspect_record",
      title: "Inspect LabSpace record",
      description:
        "Retrieve current canonical details for one exact Spatial Index record discovered in LabSpace.",
      inputSchema: inspectRecordSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_inspect_record",
          "Record inspection",
          input,
          () => actions.inspectLabRecord(input),
        ),
    },
    {
      name: "labspace_stage_annex_plan",
      title: "Stage a connected LabSpace annex",
      description:
        "Preview a calculated annex as one atomic change. Existing-room annexes always require explicit human approval, regardless of Fast Draft mode; approval creates one Undo entry and cancellation restores the room exactly.",
      inputSchema: stageAnnexPlanSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_stage_annex_plan",
          "Annex staging",
          input,
          () => annexActions.stageAnnexPlan(input),
        ),
    },
    {
      name: "labspace_stage_room_plan",
      title: "Stage LabSpace room plan",
      description:
        "Stage a calculated blueprint. Reviewed mode always pauses for approval. Fast Draft may apply only a complete validated first blueprint in a pristine WebMCP-created room, with Undo; all other layouts escalate to review.",
      inputSchema: stageRoomLayoutSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_stage_room_plan",
          "Room-plan staging",
          input,
          () => stagingActions.stageRoomLayout(input),
        ),
    },
    {
      name: "labspace_stage_inventory_plan",
      title: "Stage LabSpace inventory plan",
      description:
        "Present a validated inventory plan for explicit researcher approval. No inventory record is created until approval in LabSpace.",
      inputSchema: stageInventoryPlanSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_stage_inventory_plan",
          "Inventory-plan staging",
          input,
          () => stagingActions.stageInventoryPlan(input),
        ),
    },
    {
      name: "labspace_stage_object_move",
      title: "Stage LabSpace object move",
      description:
        "Validate and display a reversible object-move preview for explicit human approval. For in-front-of, behind, left-of, or right-of requests, call labspace_find_valid_placements first and stage its returned position and rotation. The preview is not saved until approved.",
      inputSchema: stageObjectMoveSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_stage_object_move",
          "Move staging",
          input,
          () => stagingActions.stageObjectMove(input),
        ),
    },
    {
      name: "labspace_stage_resize",
      title: "Stage LabSpace object resize",
      description:
        "Validate and display a reversible dimension preview for explicit human approval. Hosted doors and windows keep their wall relationship and are checked against wall bounds and sibling openings.",
      inputSchema: stageObjectResizeSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_stage_resize",
          "Resize staging",
          input,
          () => stagingActions.stageObjectResize(input),
        ),
    },
    {
      name: "labspace_validate_object_move",
      title: "Validate LabSpace object move",
      description:
        "Evaluate a hypothetical position, including collisions and front working zones, without changing project, preview, or history. Use labspace_find_valid_placements for object-relative language so orientation comes from authored fronts.",
      inputSchema: validateObjectMoveSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_validate_object_move",
          "Move validation",
          input,
          () => spatialActions.validateObjectMove(input),
        ),
    },
    {
      name: "labspace_validate_resize",
      title: "Validate LabSpace object resize",
      description:
        "Evaluate hypothetical object dimensions without changing project state. Hosted openings are checked against their wall, sill height, and neighboring doors or windows.",
      inputSchema: validateObjectResizeSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(
          executionContext?.signal,
          "labspace_validate_resize",
          "Resize validation",
          input,
          () => spatialActions.validateObjectResize(input),
        ),
    },
  ];
}

export function registerLabSpaceTools({
  modelContext,
  actions = labSpaceReadActions,
  navigationActions = labSpaceNavigationActions,
  layoutActions = labSpaceLayoutActions,
  inventoryActions = labSpaceInventoryActions,
  spatialActions = labSpaceSpatialActions,
  stagingActions = labSpaceStagingActions,
  workspaceActions = labSpaceWorkspaceActions,
  annexActions = labSpaceAnnexActions,
}: RegisterLabSpaceToolsOptions = {}): LabSpaceToolRegistration {
  const controller = new AbortController();
  const tools = modelContext
    ? createLabSpaceToolDefinitions(
        actions,
        navigationActions,
        spatialActions,
        stagingActions,
        layoutActions,
        inventoryActions,
        workspaceActions,
        labSpaceCollectionActions,
        annexActions,
      )
    : [];
  const ready = modelContext
    ? Promise.all(
        tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })),
      )
        .then(() => undefined)
        .catch((error: unknown) => {
          controller.abort();
          throw error;
        })
    : Promise.resolve();

  return {
    tools,
    signal: controller.signal,
    ready,
    unregister: () => controller.abort(),
  };
}
