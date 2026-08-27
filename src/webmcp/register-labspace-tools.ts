import { LabSpaceActionError, labSpaceReadActions } from "../agent/labspace-read-actions";
import type { LabSpaceReadActions } from "../agent/labspace-action-types";
import { emptyObjectSchema, inspectRecordSchema, searchRecordsSchema } from "./tool-schemas";
import type { LabSpaceToolRegistration, RegisterLabSpaceToolsOptions } from "./webmcp-types";

export const LABSPACE_WEBMCP_TOOL_NAMES = [
  "labspace_get_context",
  "labspace_inspect_record",
  "labspace_search_records",
] as const;

function controlledExecution(signal: AbortSignal, read: () => unknown) {
  signal.throwIfAborted();
  try {
    const result = read();
    signal.throwIfAborted();
    return result;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof LabSpaceActionError) throw new Error(error.message, { cause: error });
    throw new Error("LabSpace could not complete this read request.", { cause: error });
  }
}

export function createLabSpaceToolDefinitions(
  actions: LabSpaceReadActions = labSpaceReadActions,
): WebMCP.ModelContextTool[] {
  return [
    {
      name: "labspace_get_context",
      title: "Get LabSpace context",
      description:
        "Return the active LabSpace project, laboratory, room, selection, and compact Spatial Index counts.",
      inputSchema: emptyObjectSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (_input, { signal }) => controlledExecution(signal, () => actions.getLabContext()),
    },
    {
      name: "labspace_search_records",
      title: "Search LabSpace records",
      description:
        "Search the canonical LabSpace Spatial Index for equipment, inventory, and exact storage locations.",
      inputSchema: searchRecordsSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, { signal }) =>
        controlledExecution(signal, () => actions.searchLabRecords(input)),
    },
    {
      name: "labspace_inspect_record",
      title: "Inspect LabSpace record",
      description:
        "Retrieve current canonical details for one exact Spatial Index record discovered in LabSpace.",
      inputSchema: inspectRecordSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input, { signal }) =>
        controlledExecution(signal, () => actions.inspectLabRecord(input)),
    },
  ];
}

export function registerLabSpaceTools({
  modelContext,
  actions = labSpaceReadActions,
}: RegisterLabSpaceToolsOptions = {}): LabSpaceToolRegistration {
  const controller = new AbortController();
  const tools = modelContext ? createLabSpaceToolDefinitions(actions) : [];
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
