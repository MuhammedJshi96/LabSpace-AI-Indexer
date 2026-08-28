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
import type {
  LabSpaceLayoutActions,
  LabSpaceNavigationActions,
  LabSpaceReadActions,
  LabSpaceSpatialActions,
  LabSpaceStagingActions,
} from "../agent/labspace-action-types";
import {
  emptyObjectSchema,
  focusRecordSchema,
  inspectRecordSchema,
  planRoomLayoutSchema,
  recommendObjectPlacementsSchema,
  searchRecordsSchema,
  searchAssetsSchema,
  stageRoomLayoutSchema,
  stageObjectMoveSchema,
  validateObjectMoveSchema,
} from "./tool-schemas";
import type { LabSpaceToolRegistration, RegisterLabSpaceToolsOptions } from "./webmcp-types";

export const LABSPACE_WEBMCP_TOOL_NAMES = [
  "labspace_find_valid_placements",
  "labspace_focus_record",
  "labspace_get_context",
  "labspace_inspect_record",
  "labspace_plan_room",
  "labspace_search_assets",
  "labspace_search_records",
  "labspace_stage_object_move",
  "labspace_stage_room_plan",
  "labspace_validate_object_move",
] as const;

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
    signal?.throwIfAborted();
    const resultRecord =
      result && typeof result === "object" ? (result as Record<string, unknown>) : {};
    const status: AgentActivityStatus =
      toolName === "labspace_stage_object_move" || toolName === "labspace_stage_room_plan"
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
): WebMCP.ModelContextTool[] {
  return [
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
      name: "labspace_plan_room",
      title: "Plan a LabSpace room",
      description:
        "Calculate a closed wall-and-floor room shell when the canvas is blank, then arrange exact catalog assets inside it. Existing walls are preserved. Returns a read-only proposal for separate staging and human approval.",
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
        "Search the canonical room-planning catalog for furniture, storage, equipment, and safety assets with exact dimensions and indexing behavior.",
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
        "Display a calculated wall, floor, and asset plan as one reversible blueprint. It remains unsaved until a researcher approves it in LabSpace.",
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
  spatialActions = labSpaceSpatialActions,
  stagingActions = labSpaceStagingActions,
}: RegisterLabSpaceToolsOptions = {}): LabSpaceToolRegistration {
  const controller = new AbortController();
  const tools = modelContext
    ? createLabSpaceToolDefinitions(
        actions,
        navigationActions,
        spatialActions,
        stagingActions,
        layoutActions,
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
