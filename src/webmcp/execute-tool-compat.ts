export type ExecutableModelContext = WebMCP.ModelContext & {
  executeTool?: (
    tool: WebMCP.RegisteredTool,
    input: Record<string, unknown> | string,
  ) => Promise<unknown>;
};

/**
 * Manual read-only checks cross the two WebMCP execution signatures currently
 * available to judges: object input in ChatGPT and JSON-string input in Chrome.
 */
export async function executeReadOnlyToolCompat(
  modelContext: ExecutableModelContext,
  tool: WebMCP.RegisteredTool,
  input: Record<string, unknown>,
) {
  if (!modelContext.executeTool) {
    throw new Error("This browser can register tools but does not expose manual execution.");
  }

  try {
    return await modelContext.executeTool(tool, input);
  } catch (objectInputError) {
    try {
      return await modelContext.executeTool(tool, JSON.stringify(input));
    } catch {
      throw objectInputError;
    }
  }
}
