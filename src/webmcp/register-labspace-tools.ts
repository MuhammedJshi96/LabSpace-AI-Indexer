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
import type {
  LabSpaceLayoutActions,
  LabSpaceInventoryActions,
  LabSpaceNavigationActions,
  LabSpaceReadActions,
  LabSpaceSpatialActions,
  LabSpaceStagingActions,
  LabSpaceWorkspaceActions,
} from "../agent/labspace-action-types";
import {
  createRoomSchema,
  emptyObjectSchema,
  focusRecordSchema,
  inspectRecordSchema,
  listInventoryLocationsSchema,
  planInventorySchema,
  planRoomLayoutSchema,
  recommendObjectPlacementsSchema,
  searchRecordsSchema,
  searchAssetsSchema,
  stageRoomLayoutSchema,
  stageInventoryPlanSchema,
  stageObjectMoveSchema,
  validateObjectMoveSchema,
} from "./tool-schemas";
import type { LabSpaceToolRegistration, RegisterLabSpaceToolsOptions } from "./webmcp-types";

export const LABSPACE_WEBMCP_TOOL_NAMES = [
  "labspace_create_room",
  "labspace_find_valid_placements",
  "labspace_focus_record",
  "labspace_get_context",
  "labspace_inspect_record",
  "labspace_inventory_locations",
  "labspace_plan_inventory",
  "labspace_plan_room",
  "labspace_search_assets",
  "labspace_search_records",
  "labspace_stage_inventory_plan",
  "labspace_stage_object_move",
  "labspace_stage_room_plan",
  "labspace_validate_object_move",
] as const;

function completeControlledExecution(
  signal: AbortSignal | undefined,
  toolName: string,
  action: string,
  input: unknown,
  result: unknown,
) {
  signal?.throwIfAborted();
  const resultRecord =
    result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  const status: AgentActivityStatus =
    toolName === "labspace_create_room" || resultRecord.autoCommitted === true
      ? "committed"
      : toolName === "labspace_stage_object_move" ||
          toolName === "labspace_stage_room_plan" ||
          toolName === "labspace_stage_inventory_plan"
        ? "pending"
        : toolName === "labspace_find_valid_placements"
          ? Array.isArray(resultRecord.candidates) && resultRecord.candidates.length > 0
            ? "found"
            : "blocked"
          : toolName === "labspace_plan_room"
            ? Number(resultRecord.plannedObjects) > 0
              ? "found"
              : "blocked"
            : toolName === "labspace_validate_object_move"
              ? resultRecord.valid === false
                ? "blocked"
                : "valid"
              : toolName === "labspace_focus_record"
                ? "focused"
                : toolName === "labspace_search_records"
                  ? "found"
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
  recordWebMCPToolSuccess(toolName, action, subject, status, input, result);
  return result;
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
): WebMCP.ModelContextTool[] {
  return [
    {
      name: "labspace_create_room",
      title: "Create a blank LabSpace room",
      description:
        "Create, activate, and save one genuinely blank room in the current or selected laboratory. Its first complete validated WebMCP blueprint may auto-commit; later changes still require review.",
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
        "Rank diverse geometry-valid positions near a preferred area without changing the room, preview, history, or saved project.",
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
      name: "labspace_stage_room_plan",
      title: "Stage LabSpace room plan",
      description:
        "Apply a calculated blueprint. The first complete plan for a blank room created by WebMCP auto-commits with Undo; existing-room or later changes remain a researcher-reviewed preview.",
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
        "Validate and display a reversible object-move preview for explicit human approval. The preview is not saved and creates no history entry until a researcher approves it in LabSpace.",
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
      name: "labspace_validate_object_move",
      title: "Validate LabSpace object move",
      description:
        "Evaluate a hypothetical object position with current LabSpace room geometry without changing project, preview, or history state.",
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
