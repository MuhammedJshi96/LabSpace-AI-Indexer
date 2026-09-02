import { expect, test, type Page } from "@playwright/test";

async function installModelContext(page: Page) {
  await page.addInitScript(() => {
    const activeTools = new Map<string, WebMCP.ModelContextTool>();
    const modelContext = {
      async registerTool(
        tool: WebMCP.ModelContextTool,
        options?: WebMCP.ModelContextRegisterToolOptions,
      ) {
        if (options?.signal?.aborted) return;
        activeTools.set(tool.name, tool);
        options?.signal?.addEventListener(
          "abort",
          () => {
            if (activeTools.get(tool.name) === tool) activeTools.delete(tool.name);
          },
          { once: true },
        );
      },
      async getTools() {
        return [...activeTools.values()].sort((left, right) => left.name.localeCompare(right.name));
      },
      async executeTool(tool: WebMCP.ModelContextTool, input: Record<string, unknown> | string) {
        const parsedInput = typeof input === "string" ? JSON.parse(input) : input;
        return tool.execute(parsedInput, { signal: new AbortController().signal });
      },
    };
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: modelContext,
    });
  });
}

async function executeTool<T>(page: Page, name: string, input: Record<string, unknown>) {
  return page.evaluate(
    async ({ toolName, toolInput }) => {
      const tools = await document.modelContext?.getTools();
      const tool = tools?.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Missing WebMCP tool: ${toolName}`);
      const executable = tool as unknown as {
        execute: (
          input: Record<string, unknown>,
          options: WebMCP.ToolExecuteCallbackOptions,
        ) => WebMCP.MaybePromise<unknown>;
      };
      return executable.execute(toolInput, { signal: new AbortController().signal });
    },
    { toolName: name, toolInput: input },
  ) as Promise<T>;
}

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/api/testing/reset");
  expect(reset.ok()).toBeTruthy();
});

test("presents the three-part judge demonstration and exports bounded session proof", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await installModelContext(page);
  await page.goto("/");

  const webMcpButton = page.getByRole("button", { name: /Open WebMCP Inspector/i });
  await expect(webMcpButton).toContainText("24");
  const search = await executeTool<{
    results: Array<{ recordId: string; roomCode: string; name: string }>;
  }>(page, "labspace_search_records", { query: "Reference standards" });
  const reference = search.results.find(
    (record) => record.name === "Reference standards" && record.roomCode === "DEMO-01",
  );
  expect(reference).toBeTruthy();
  await executeTool(page, "labspace_inspect_record", { recordId: reference!.recordId });
  await executeTool(page, "labspace_focus_record", { recordId: reference!.recordId });
  await webMcpButton.click();

  const inspector = page.getByRole("complementary", { name: "WebMCP Inspector" });
  await expect(inspector.getByRole("tab", { name: "Judge mission" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    inspector.getByRole("heading", { name: "Build. Stock. Find the work." }),
  ).toBeVisible();
  await expect(inspector.getByText("Ground evidence", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Create R-003 from one request", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Stage two enzyme records", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Ground a DPPH collection", { exact: true })).toBeVisible();
  await expect(inspector.getByRole("radio", { name: /Reviewed/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    inspector.getByRole("button", { name: "Copy + show workspace" }).first(),
  ).toBeVisible();
  if (process.env.LABSPACE_CAPTURE_UI === "1") {
    await page.screenshot({
      path: "test-results/webmcp-mission-control.png",
      fullPage: true,
    });
  }

  const downloadPromise = page.waitForEvent("download");
  await inspector.getByRole("button", { name: "Export WebMCP session evidence" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^labspace-webmcp-session-evidence-.*\.json$/);
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  const proof = JSON.parse(text) as {
    schema: string;
    browserBridge: { status: string; registeredToolCount: number };
    humanControl: { executionMode: string; agentCanSelectMode: boolean };
    summary: { toolCalls: number; uniqueToolsUsed: number; errors: number };
    timeline: unknown[];
  };
  expect(proof).toMatchObject({
    schema: "labspace.webmcp-session-evidence.v1",
    browserBridge: { status: "ready", registeredToolCount: 24 },
    humanControl: { executionMode: "reviewed", agentCanSelectMode: false },
  });
  expect(proof.summary).toMatchObject({ toolCalls: 3, uniqueToolsUsed: 3, errors: 0 });
  expect(proof.timeline).toHaveLength(3);

  await inspector.getByRole("button", { name: "Copy + show workspace" }).first().click();
  await expect(inspector).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("create a new room named Researcher Office, code R-003");
  const copiedPrompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedPrompt).toContain("Use only the LabSpace WebMCP tools");
  expect(copiedPrompt).toContain("Do not click, drag, type into forms");
  expect(copiedPrompt).toContain("do not fall back to UI automation");
});
