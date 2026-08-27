import { LabSpaceActionError, labSpaceReadActions } from "../agent/labspace-read-actions";
import { labSpaceNavigationActions } from "../agent/labspace-navigation-actions";
import { labSpaceSpatialActions } from "../agent/labspace-spatial-actions";
import { labSpaceStagingActions } from "../agent/labspace-staging-actions";
import type {
  LabSpaceNavigationActions,
  LabSpaceReadActions,
  LabSpaceSpatialActions,
  LabSpaceStagingActions,
} from "../agent/labspace-action-types";
import {
  emptyObjectSchema,
  focusRecordSchema,
  inspectRecordSchema,
  searchRecordsSchema,
  stageObjectMoveSchema,
  validateObjectMoveSchema,
} from "./tool-schemas";
import type { LabSpaceToolRegistration, RegisterLabSpaceToolsOptions } from "./webmcp-types";

export const LABSPACE_WEBMCP_TOOL_NAMES = [
  "labspace_focus_record",
  "labspace_get_context",
  "labspace_inspect_record",
  "labspace_search_records",
  "labspace_stage_object_move",
  "labspace_validate_object_move",
] as const;

function controlledExecution(signal: AbortSignal | undefined, read: () => unknown) {
  signal?.throwIfAborted();
  try {
    const result = read();
    signal?.throwIfAborted();
    return result;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof LabSpaceActionError) throw new Error(error.message, { cause: error });
    throw new Error("LabSpace could not complete this read request.", { cause: error });
  }
}

export function createLabSpaceToolDefinitions(
  actions: LabSpaceReadActions = labSpaceReadActions,
  navigationActions: LabSpaceNavigationActions = labSpaceNavigationActions,
  spatialActions: LabSpaceSpatialActions = labSpaceSpatialActions,
  stagingActions: LabSpaceStagingActions = labSpaceStagingActions,
): WebMCP.ModelContextTool[] {
  return [
    {
      name: "labspace_get_context",
      title: "Get LabSpace context",
      description:
        "Return the active LabSpace project, laboratory, room, selection, and compact Spatial Index counts.",
      inputSchema: emptyObjectSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (_input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(executionContext?.signal, () => actions.getLabContext()),
    },
    {
      name: "labspace_focus_record",
      title: "Focus LabSpace record",
      description:
        "Reveal one canonical Spatial Index record in the correct LabSpace room, selection, storage evidence, and 3D camera.",
      inputSchema: focusRecordSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(executionContext?.signal, () =>
          navigationActions.focusLabRecord(input),
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
        controlledExecution(executionContext?.signal, () => actions.searchLabRecords(input)),
    },
    {
      name: "labspace_inspect_record",
      title: "Inspect LabSpace record",
      description:
        "Retrieve current canonical details for one exact Spatial Index record discovered in LabSpace.",
      inputSchema: inspectRecordSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(executionContext?.signal, () => actions.inspectLabRecord(input)),
    },
    {
      name: "labspace_stage_object_move",
      title: "Stage LabSpace object move",
      description:
        "Validate and display a reversible object-move preview for explicit human approval. The preview is not saved and creates no history entry until a researcher approves it in LabSpace.",
      inputSchema: stageObjectMoveSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input, executionContext?: WebMCP.ToolExecuteCallbackOptions) =>
        controlledExecution(executionContext?.signal, () =>
          stagingActions.stageObjectMove(input),
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
        controlledExecution(executionContext?.signal, () =>
          spatialActions.validateObjectMove(input),
        ),
    },
  ];
}

export function registerLabSpaceTools({
  modelContext,
  actions = labSpaceReadActions,
  navigationActions = labSpaceNavigationActions,
  spatialActions = labSpaceSpatialActions,
  stagingActions = labSpaceStagingActions,
}: RegisterLabSpaceToolsOptions = {}): LabSpaceToolRegistration {
  const controller = new AbortController();
  const tools = modelContext
    ? createLabSpaceToolDefinitions(actions, navigationActions, spatialActions, stagingActions)
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
