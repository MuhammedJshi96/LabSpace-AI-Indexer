import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { Project } from "../../src/domain/schema";

const showcaseProject = JSON.parse(
  readFileSync("server/public-showcase-project.json", "utf8"),
) as Project;

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
    };
    Object.defineProperty(document, "modelContext", { configurable: true, value: modelContext });
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

test.beforeEach(async ({ page, request }) => {
  expect((await request.post("/api/testing/reset")).ok()).toBeTruthy();
  expect((await request.post("/api/import", { data: showcaseProject })).ok()).toBeTruthy();
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "labspace-render-settings-v1",
      JSON.stringify({ version: 1, quality: "high" }),
    );
  });
  await installModelContext(page);
});

test("captures the final public judge experience from one clean fixture", async ({ page }) => {
  test.setTimeout(360_000);
  await page.goto("/");
  await expect(page.getByText("Analytical Chemistry Lab", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("3d-view").locator("canvas")).toBeVisible();
  await expect.poll(async () => (await documentTools(page)).length).toBe(24);
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-scene-ready", "true", {
    timeout: 180_000,
  });
  await page.screenshot({
    path: "docs/screenshots/submission-layout-editor.png",
  });

  await page.getByRole("button", { name: /Open WebMCP Inspector/i }).click();
  const inspector = page.getByRole("complementary", { name: "WebMCP Inspector" });
  await expect(
    inspector.getByRole("heading", { name: "Build. Stock. Find the work." }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "docs/screenshots/submission-webmcp-mission-control.png",
  });

  await inspector.getByRole("tab", { name: /Tools 24/i }).click();
  await expect(inspector.getByText("labspace_assess_workflow", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/submission-webmcp-tools.png",
  });

  await inspector.getByRole("button", { name: "Close WebMCP Inspector" }).click();
  await page.getByRole("link", { name: "Inventory", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inventory Studio" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Inventory records" })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/submission-inventory-studio.png",
  });

  await page.getByRole("link", { name: "Spatial Index", exact: true }).click();
  await expect(page.getByTestId("digital-twin-page")).toBeVisible();
  await expect.poll(async () => (await documentTools(page)).length).toBe(24);
  const search = await executeTool<{
    results: Array<{ recordId: string; name: string }>;
  }>(page, "labspace_search_records", {
    query: "DPPH Reagent",
    scope: "project",
    kinds: ["inventory"],
  });
  const dpph = search.results.find((record) => record.name === "DPPH Reagent");
  expect(dpph).toBeTruthy();
  await executeTool(page, "labspace_inspect_record", { recordId: dpph!.recordId });
  await executeTool(page, "labspace_focus_record", { recordId: dpph!.recordId });
  await expect(page.getByRole("heading", { name: "DPPH Reagent", exact: true })).toBeVisible();
  const evidenceImage = page.getByRole("img", { name: "DPPH Reagent evidence image" });
  await expect(evidenceImage).toHaveAttribute("src", "/images/inventory/dpph-reagent.svg");
  await expect
    .poll(
      () =>
        evidenceImage.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      { timeout: 90_000 },
    )
    .toBe(true);
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-scene-ready", "true", {
    timeout: 180_000,
  });
  await page.screenshot({
    path: "docs/screenshots/submission-spatial-index-dpph.png",
  });

  await page.getByRole("button", { name: /Open WebMCP Inspector/i }).click();
  const evidenceInspector = page.getByRole("complementary", { name: "WebMCP Inspector" });
  await evidenceInspector.getByRole("tab", { name: /Evidence/i }).click();
  await expect(evidenceInspector.getByText("Record focus", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/submission-webmcp-evidence.png",
  });
  await evidenceInspector.getByRole("button", { name: "Close WebMCP Inspector" }).click();

  await page.goto("/asset-preview?asset=ultrasonic-cleaner");
  await expect(page.getByRole("heading", { name: "Benchtop ultrasonic cleaner" })).toBeVisible();
  await expect(page.locator(".asset-preview-canvas")).toHaveAttribute("data-model-ready", "true", {
    timeout: 90_000,
  });
  await page.screenshot({
    path: "docs/screenshots/submission-authored-asset-studio.png",
  });
});

async function documentTools(page: Page) {
  return page.evaluate(async () => (await document.modelContext?.getTools()) ?? []);
}
