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

async function readProject(page: Page) {
  const response = await page.request.get("/api/project");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Project;
}

test.beforeEach(async ({ page, request }) => {
  const reset = await request.post("/api/testing/reset");
  expect(reset.ok()).toBeTruthy();
  const imported = await request.post("/api/import", { data: showcaseProject });
  expect(imported.ok()).toBeTruthy();
  await installModelContext(page);
});

test("rehearses the final Build, Stock, and Find-the-work judge story", async ({
  page,
}, testInfo) => {
  if (process.env.LABSPACE_CAPTURE_UI === "1") test.setTimeout(360_000);
  await page.goto("/");
  await expect.poll(async () => (await documentTools(page)).length).toBe(24);

  const initial = await readProject(page);
  expect(initial.laboratories.map((laboratory) => laboratory.code)).toEqual(["LAB-D-00"]);
  expect(initial.rooms.map((room) => room.code).sort()).toEqual(["R-001", "R-002"]);

  await page.getByRole("button", { name: /Open WebMCP Inspector/i }).click();
  await page.getByRole("radio", { name: /Fast Draft/i }).click();
  await page.getByRole("button", { name: "Close WebMCP Inspector" }).click();

  const assetQueries = [
    ["office desk", "office-desk"],
    ["office chair", "office-chair"],
    ["three panel window", "wide-window"],
    ["solid laboratory door", "single-door"],
    ["locker", "locker"],
    ["fire extinguisher", "fire-extinguisher"],
    ["waste bin", "waste-bin"],
  ] as const;
  for (const [query, assetId] of assetQueries) {
    const search = await executeTool<{ results: Array<{ assetId: string }> }>(
      page,
      "labspace_search_assets",
      { query, limit: 8 },
    );
    expect(
      search.results.some((candidate) => candidate.assetId === assetId),
      query,
    ).toBe(true);
  }

  const created = await executeTool<{
    created: boolean;
    roomId: string;
    roomCode: string;
    laboratoryCode: string;
  }>(page, "labspace_create_room", {
    name: "Researcher Office",
    code: "R-003",
    laboratoryCode: "LAB-D-00",
  });
  expect(created).toMatchObject({
    created: true,
    roomCode: "R-003",
    laboratoryCode: "LAB-D-00",
  });

  const plan = await executeTool<{
    planId: string;
    plannedObjects: number;
    unplaced: Array<{ assetId: string; reason: string }>;
    shell: { widthMm: number; depthMm: number; segments: unknown[] };
    proposals: Array<{
      assetId: string;
      snappedTo?: { relation: string };
      opening?: { wallIndex: number; offsetMm: number; sillHeightMm: number };
    }>;
  }>(page, "labspace_plan_room", {
    brief: "A 38 square metre researcher office with three paired workstations.",
    aisleMm: 700,
    roomShell: {
      widthMm: 7600,
      depthMm: 5000,
      wallHeightMm: 3000,
      wallThicknessMm: 150,
    },
    assets: [
      { assetId: "office-desk", quantity: 3, placement: "perimeter" },
      { assetId: "office-chair", quantity: 3, placement: "auto" },
      { assetId: "locker", quantity: 1, placement: "perimeter" },
      { assetId: "fire-extinguisher", quantity: 1, placement: "perimeter" },
      { assetId: "waste-bin", quantity: 1, placement: "perimeter" },
      {
        assetId: "single-door",
        quantity: 1,
        placement: "wall",
        host: { wallIndex: 3, offsetMm: 3800, handing: "right", swing: "inward" },
      },
      {
        assetId: "wide-window",
        quantity: 1,
        placement: "wall",
        host: { wallIndex: 1, offsetMm: 3800, sillHeightMm: 900 },
      },
      {
        assetId: "wide-window",
        quantity: 1,
        placement: "wall",
        host: { wallIndex: 4, offsetMm: 2500, sillHeightMm: 900 },
      },
    ],
  });
  expect(plan.shell).toMatchObject({ widthMm: 7600, depthMm: 5000 });
  expect(plan.shell.segments).toHaveLength(4);
  expect(plan.unplaced).toEqual([]);
  expect(plan.plannedObjects).toBe(12);
  expect(
    plan.proposals
      .filter((proposal) => proposal.assetId === "office-chair")
      .every((proposal) => proposal.snappedTo?.relation === "workstation"),
  ).toBe(true);
  expect(
    plan.proposals.find((proposal) => proposal.assetId === "single-door")?.opening,
  ).toMatchObject({ wallIndex: 3, offsetMm: 3800, sillHeightMm: 0 });
  expect(
    plan.proposals
      .filter((proposal) => proposal.assetId === "wide-window")
      .map((entry) => entry.opening?.wallIndex),
  ).toEqual([1, 4]);

  const stagedRoom = await executeTool<{
    autoCommitted: boolean;
    requiresHumanApproval: boolean;
    objectCount: number;
    wallCount: number;
    assetCount: number;
  }>(page, "labspace_stage_room_plan", { planId: plan.planId });
  expect(stagedRoom).toMatchObject({
    autoCommitted: true,
    requiresHumanApproval: false,
    objectCount: 16,
    wallCount: 4,
    assetCount: 12,
  });
  const audit = await executeTool<{
    room: { code: string };
    summary: { walls: number; placedAssets: number };
  }>(page, "labspace_audit_room", { roomCode: "R-003" });
  expect(audit).toMatchObject({
    room: { code: "R-003" },
    // Hosted openings are counted separately from the nine movable/furnishing assets.
    summary: { walls: 4, placedAssets: 9 },
  });
  await expect(page.locator(".header-save-control")).toHaveAttribute(
    "title",
    /^(All changes saved|Saved in this browser)$/,
    { timeout: 20_000 },
  );

  const inventoryStage = await executeTool<{
    staged: boolean;
    requiresHumanApproval: boolean;
    entryCount: number;
    assignedEntries: number;
  }>(page, "labspace_add_inventory", {
    entries: [
      {
        roomCode: "R-002",
        name: "Alpha-glucosidase enzyme",
        quantity: 2,
        unit: "bottles",
        expiryDate: "2026-10-06",
      },
      {
        roomCode: "R-002",
        name: "Lipase enzyme",
        quantity: 1,
        unit: "bottle",
        expiryDate: "2026-10-16",
      },
    ],
  });
  expect(inventoryStage).toMatchObject({
    staged: true,
    requiresHumanApproval: true,
    entryCount: 2,
    assignedEntries: 0,
  });
  const review = page.getByTestId("agent-change-review");
  await expect(review).toContainText("Alpha-glucosidase enzyme");
  await expect(review).toContainText("Lipase enzyme");
  await review.getByRole("button", { name: /Approve/ }).click();
  await expect(page.locator(".header-save-control")).toHaveAttribute(
    "title",
    /^(All changes saved|Saved in this browser)$/,
    { timeout: 20_000 },
  );

  await page.goto("/digital-twin");
  await expect.poll(async () => (await documentTools(page)).length).toBe(24);
  const fallback = page.getByRole("button", { name: "2D fallback", exact: true });
  if (await fallback.isVisible()) await fallback.click();

  const requirements = [
    ["DPPH Reagent", "inventory"],
    ["100 uL Pipette tips", "inventory"],
    ["200 uL Pipette tips", "inventory"],
    ["Laboratory pipette holder", "equipment"],
    ["Automated microplate reader", "equipment"],
  ] as const;
  const reviewedRecordIds: string[] = [];
  for (const [query, kind] of requirements) {
    const search = await executeTool<{
      results: Array<{ recordId: string; name: string; kind: string }>;
    }>(page, "labspace_search_records", { query, scope: "project", kinds: [kind] });
    const exact = search.results.find(
      (result) => result.name.toLocaleLowerCase() === query.toLocaleLowerCase(),
    );
    expect(exact, query).toBeTruthy();
    const inspection = await executeTool<{ recordId: string; name: string }>(
      page,
      "labspace_inspect_record",
      { recordId: exact!.recordId },
    );
    expect(inspection).toMatchObject({ recordId: exact!.recordId, name: exact!.name });
    reviewedRecordIds.push(exact!.recordId);
  }
  const chloroform = await executeTool<{ totalMatches: number }>(page, "labspace_search_records", {
    query: "Chloroform",
    scope: "project",
    kinds: ["inventory"],
  });
  expect(chloroform.totalMatches).toBe(0);

  const lleStock = await executeTool<{
    requirements: Array<{ query: string; status: string }>;
    missing: string[];
  }>(page, "labspace_resolve_materials", {
    brief: "Researcher-approved LLE solvent stock check; no procedure generation.",
    materials: [
      "Methanol Solvent 99.9%",
      "Ethyl acetate Solvent",
      "n-Hexane Solvent",
      "n-Butanol Solvent",
      "Chloroform",
    ],
  });
  expect(lleStock.missing).toEqual(["Chloroform"]);
  expect(
    lleStock.requirements
      .filter((requirement) => requirement.query !== "Chloroform")
      .every((requirement) => requirement.status === "exact-match"),
  ).toBe(true);

  const assessment = await executeTool<{
    readiness: string;
    missing: string[];
    ambiguous: string[];
    recommendedWorkspace: { objectId: string; objectName: string; roomCode: string } | null;
  }>(page, "labspace_assess_workflow", {
    brief: "Researcher-approved DPPH collection checklist; no protocol generation.",
    materials: ["DPPH Reagent", "100 uL Pipette tips", "200 uL Pipette tips"],
    equipment: ["Laboratory pipette holder", "Automated microplate reader"],
    roomCode: "R-002",
    workspacePreference: "any-work-surface",
    minimumClearAreaM2: 0.6,
  });
  expect(assessment.readiness).toBe("ready-for-researcher-review");
  expect(assessment.missing).toEqual([]);
  expect(assessment.ambiguous).toEqual([]);
  expect(assessment.recommendedWorkspace).toMatchObject({ objectId: expect.any(String) });

  await executeTool(page, "labspace_start_collection", {
    title: "DPPH evidence collection",
    recordIds: reviewedRecordIds,
    workspaceObjectId: assessment.recommendedWorkspace!.objectId,
  });
  const collectionReview = page.getByRole("dialog", { name: "Review collection", exact: true });
  await expect(collectionReview).toBeVisible();
  await expect(collectionReview).toContainText("DPPH Reagent");
  await expect(collectionReview).not.toContainText("Methanol");
  await expect(
    collectionReview.getByRole("list", { name: "Proposed collection items" }).getByRole("listitem"),
  ).toHaveCount(5);
  for (const size of [
    { width: 1440, height: 900 },
    { width: 860, height: 720 },
  ]) {
    await page.setViewportSize(size);
    const bounds = await collectionReview.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    await expect(
      collectionReview.getByRole("button", { name: "Approve & start guide" }),
    ).toBeInViewport();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("collection-review.png") });
  await collectionReview
    .getByRole("button", { name: "Approve & start guide", exact: true })
    .click();
  const guide = page.getByRole("region", { name: "Collection guide" });
  await expect(guide).toContainText("1 / 6");
  await guide.getByRole("button", { name: "All stops" }).click();
  await expect(guide.getByRole("listitem")).toHaveCount(6);
  const guideBounds = await guide.boundingBox();
  const detailBounds = await page
    .getByRole("complementary", { name: "Selected record details" })
    .boundingBox();
  expect(guideBounds!.x + guideBounds!.width).toBeLessThanOrEqual(detailBounds!.x + 1);
  await guide.getByRole("button", { name: "Hide stops" }).click();
  for (let step = 0; step < reviewedRecordIds.length; step += 1) {
    await guide.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(guide).toContainText("FINAL WORKSPACE");
  await expect(page.getByText("6 stops · 0 human-confirmed", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: assessment.recommendedWorkspace!.objectName, exact: true }),
  ).toBeVisible();

  const finalProject = await readProject(page);
  const r003 = finalProject.rooms.find((room) => room.code === "R-003");
  const r002 = finalProject.rooms.find((room) => room.code === "R-002");
  expect(r003?.scene.objects).toHaveLength(16);
  expect(r002?.scene.inventoryItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "Alpha-glucosidase enzyme",
        quantity: 2,
        expiryDate: "2026-10-06",
        storageLocationId: null,
      }),
      expect.objectContaining({
        name: "Lipase enzyme",
        quantity: 1,
        expiryDate: "2026-10-16",
        storageLocationId: null,
      }),
    ]),
  );

  if (process.env.LABSPACE_CAPTURE_UI === "1") {
    const returnTo3d = page.getByRole("button", { name: "Return to 3D", exact: true });
    if (await returnTo3d.isVisible()) await returnTo3d.click();
    await expect(page.getByTestId("3d-view")).toHaveAttribute("data-scene-ready", "true", {
      timeout: 180_000,
    });
    await page.screenshot({
      path: testInfo.outputPath("final-workspace-handoff.png"),
      fullPage: true,
    });
  }
});

async function documentTools(page: Page) {
  return page.evaluate(async () => (await document.modelContext?.getTools()) ?? []);
}
