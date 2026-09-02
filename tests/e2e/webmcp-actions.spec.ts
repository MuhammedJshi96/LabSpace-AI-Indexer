import { expect, test, type Page } from "@playwright/test";
import type { RoomAuditResult } from "../../src/agent/labspace-action-types";
import type { Project, Room, SceneObject } from "../../src/domain/schema";

const WEBMCP_TOOL_NAMES = [
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
];

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

async function registeredToolNames(page: Page) {
  return page.evaluate(async () => {
    const tools = await document.modelContext?.getTools();
    return tools?.map((tool) => tool.name) ?? [];
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

function eligibleDemoRoom(project: Project) {
  return project.rooms.find((room) => room.roomKind === "demo")!;
}

function currentObject(project: Project, roomId: string, objectId: string) {
  return project.rooms
    .find((room) => room.id === roomId)!
    .scene.objects.find((object) => object.id === objectId)!;
}

interface MoveValidation {
  valid: boolean;
  objectId: string;
  target: { xMm: number; yMm: number; rotationDeg: number };
  conflicts: Array<{ type: string }>;
}

interface PlacementRecommendations {
  objectId: string;
  evaluatedTargets: number;
  candidates: Array<{
    rank: number;
    target: { xMm: number; yMm: number; rotationDeg: number };
    distanceFromPreferredMm: number;
  }>;
}

async function findClearMove(page: Page, room: Room) {
  const movable = room.scene.objects.filter(
    (object) => !object.locked && ["furniture", "storage", "equipment"].includes(object.objectType),
  );
  const offsets = [
    [200, 0],
    [-200, 0],
    [0, 200],
    [0, -200],
    [400, 0],
    [0, 400],
    [-400, 0],
    [0, -400],
  ];
  for (const object of movable) {
    for (const [xOffset, yOffset] of offsets) {
      const target = {
        xMm: object.position.x + xOffset,
        yMm: object.position.y + yOffset,
      };
      const result = await executeTool<MoveValidation>(page, "labspace_validate_object_move", {
        objectId: object.id,
        target,
      });
      if (result.valid) return { object, target };
    }
  }
  throw new Error("The canonical demo did not expose a clear deterministic move candidate.");
}

async function findCollisionTarget(page: Page, room: Room, movingObject: SceneObject) {
  for (const occupied of room.scene.objects) {
    if (occupied.id === movingObject.id) continue;
    const target = { xMm: occupied.position.x, yMm: occupied.position.y };
    const result = await executeTool<MoveValidation>(page, "labspace_validate_object_move", {
      objectId: movingObject.id,
      target,
    });
    if (result.conflicts.some((conflict) => conflict.type === "object-collision")) {
      return { target, result };
    }
  }
  throw new Error("The canonical demo did not expose a deterministic collision target.");
}

test.beforeEach(async ({ page, request }) => {
  const reset = await request.post("/api/testing/reset");
  expect(reset.ok()).toBeTruthy();
  await installModelContext(page);
});

test.afterEach(async ({ page }) => {
  if (page.isClosed()) return;
  const saveControl = page.locator(".header-save-control");
  if ((await saveControl.count()) === 0) return;
  await expect(saveControl).toHaveAttribute(
    "title",
    /^(All changes saved|Saved in this browser)$/,
    { timeout: 20_000 },
  );
});

test("adds reviewed inventory through one tool and guides exact collection stops", async ({
  page,
}) => {
  await page.goto("/digital-twin");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  // This contract tests inventory/review/navigation, not GPU compilation. The
  // shipped fallback keeps CPU-only CI responsive; 3D focus is covered separately.
  await page.getByRole("button", { name: "2D fallback", exact: true }).click();
  const before = await readProject(page);
  const resolution = await executeTool<{
    requirements: Array<{ status: string; candidates: Array<{ recordId: string }> }>;
    missing: string[];
  }>(page, "labspace_resolve_materials", {
    brief: "Researcher-reviewed preparation supplies",
    materials: ["Reference standards", "Nitrile gloves", "not-in-stock-xyz"],
  });
  expect(resolution.missing).toContain("not-in-stock-xyz");
  expect(resolution.requirements[0].status).toBe("exact-match");
  expect(await readProject(page)).toEqual(before);
  const recordIds = resolution.requirements
    .slice(0, 2)
    .map((entry) => entry.candidates[0].recordId);
  await executeTool(page, "labspace_start_collection", {
    title: "Preparation checklist",
    recordIds,
  });
  const guide = page.getByRole("region", { name: "Collection guide" });
  await expect(guide).toContainText("Reference standards");
  await expect(page.getByRole("button", { name: "Return to 3D", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reference standards", exact: true }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await expect(guide).toContainText("2 / 2");
  await expect(page.getByRole("button", { name: "Return to 3D", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nitrile gloves, M", exact: true })).toBeVisible();
  await guide.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(guide).toContainText("1 / 2");
  await expect(guide).toContainText("Stock is not deducted");
  await guide.getByRole("button", { name: "Confirm location checked", exact: true }).click();
  await expect(guide).toContainText("1 of 2 stops checked");
  await page.getByRole("button", { name: "Process tracker", exact: true }).click();
  const tracker = page.getByRole("region", { name: "Process tracker", exact: true });
  await expect(tracker).toContainText("1/2 checked");
  await expect(tracker).toContainText("Checked by you");
  await tracker.screenshot({ path: "test-results/process-tracker.png" });
  const evidence = await executeTool<{
    runs: Array<{ checked: unknown[]; trail: Array<{ actor: string }> }>;
  }>(page, "labspace_collection_step", { action: "history" });
  expect(evidence.runs[0].checked).toHaveLength(1);
  expect(evidence.runs[0].trail.at(-1)?.actor).toBe("Human");
  await page.getByRole("button", { name: "Close process tracker", exact: true }).click();
  expect((await readProject(page)).rooms).toEqual(before.rooms);
  await executeTool(page, "labspace_collection_step", { action: "finish" });
  await expect(guide).not.toBeVisible();

  const demo = eligibleDemoRoom(before);
  await executeTool(page, "labspace_add_inventory", {
    entries: [
      {
        roomCode: demo.code,
        name: "Reviewed test supplies",
        quantity: 12,
        unit: "boxes",
        notes: "E2E verification",
        owner: "Shared",
      },
    ],
  });
  expect((await readProject(page)).rooms).toEqual(before.rooms);
  await expect(page.getByRole("button", { name: /Approve/ })).toBeVisible();
  await page.getByRole("button", { name: /Approve/ }).click();
  await expect
    .poll(async () =>
      (await readProject(page)).rooms
        .find((room) => room.id === demo.id)
        ?.scene.inventoryItems.some(
          (item) => item.name === "Reviewed test supplies" && item.quantity === 12,
        ),
    )
    .toBe(true);
});

test("grounds a workflow and ends its evidence itinerary at an authored work surface", async ({
  page,
}) => {
  await page.goto("/digital-twin");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  await page.getByRole("button", { name: "2D fallback", exact: true }).click();
  const before = await readProject(page);

  const assessment = await executeTool<{
    readiness: string;
    missing: string[];
    ambiguous: string[];
    materialEvidence: Array<{ candidates: Array<{ recordId: string }> }>;
    recommendedWorkspace: { objectId: string; objectName: string } | null;
  }>(page, "labspace_assess_workflow", {
    brief: "DPPH evidence handoff without generating a protocol",
    materials: ["Reference standards"],
    equipment: ["laboratory scale"],
    roomCode: "DEMO-01",
    workspacePreference: "laboratory-bench",
    minimumClearAreaM2: 0.25,
  });

  expect(assessment).toMatchObject({
    readiness: "ready-for-researcher-review",
    missing: [],
    ambiguous: [],
    recommendedWorkspace: { objectId: expect.any(String), objectName: expect.any(String) },
  });
  expect(await readProject(page)).toEqual(before);

  const recordId = assessment.materialEvidence[0].candidates[0].recordId;
  await executeTool(page, "labspace_start_collection", {
    title: "DPPH evidence handoff",
    recordIds: [recordId],
    workspaceObjectId: assessment.recommendedWorkspace!.objectId,
  });
  const guide = page.getByRole("region", { name: "Collection guide" });
  await expect(guide).toContainText("WORKFLOW ITINERARY · 1 / 2");
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await expect(guide).toContainText("FINAL WORKSPACE");
  await expect(
    page.getByRole("heading", {
      name: assessment.recommendedWorkspace!.objectName,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Workflow evidence handoff" })).toContainText(
    "Materials lead to a real work surface",
  );
  await expect(guide).toContainText("not a safety-approved route or protocol");
  expect((await readProject(page)).rooms).toEqual(before.rooms);
  await executeTool(page, "labspace_collection_step", { action: "finish" });
});

test("duplicate control copies a focused item and undo restores the room", async ({ page }) => {
  const project = await readProject(page);
  const demo = eligibleDemoRoom(project);
  const equipment = demo.scene.equipmentRecords[0];
  await page.goto(
    `/?room=${encodeURIComponent(demo.id)}&object=${encodeURIComponent(equipment.objectId)}&panel=properties`,
  );
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  const duplicate = page.getByRole("button", { name: "Duplicate", exact: true });
  await expect(duplicate).toBeVisible();
  const baselineAudit = await executeTool<RoomAuditResult>(page, "labspace_audit_room", {});
  await duplicate.click();
  await expect
    .poll(
      async () =>
        (await executeTool<RoomAuditResult>(page, "labspace_audit_room", {})).summary.placedAssets,
    )
    .toBe(baselineAudit.summary.placedAssets + 1);
  const duplicatedContext = await executeTool<{
    selection: { objectIds: string[] };
  }>(page, "labspace_get_context", {});
  expect(duplicatedContext.selection.objectIds).toHaveLength(1);
  expect(duplicatedContext.selection.objectIds[0]).not.toBe(equipment.objectId);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect
    .poll(
      async () =>
        (await executeTool<RoomAuditResult>(page, "labspace_audit_room", {})).summary.placedAssets,
    )
    .toBe(baselineAudit.summary.placedAssets);
});

test("registers exactly twenty-four tools on product routes and excludes internal asset routes", async ({
  page,
}) => {
  for (const route of ["/", "/digital-twin", "/inventory"]) {
    await page.goto(route);
    await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  }

  for (const route of ["/asset-preview", "/facility", "/procedural-asset-capture"]) {
    await page.goto(route);
    await expect.poll(() => registeredToolNames(page)).toEqual([]);
  }

  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
});

test("audits canonical room readiness without changing the project", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  const before = await readProject(page);

  const audit = await executeTool<RoomAuditResult>(page, "labspace_audit_room", {});

  expect(audit.room.id).toBe(before.activeRoomId);
  expect(["ready", "attention", "blocked"]).toContain(audit.status);
  expect(audit.summary.walls).toBeGreaterThanOrEqual(0);
  expect(audit.issues.length).toBeLessThanOrEqual(12);
  expect(audit.basis.join(" ")).toContain("deterministic");
  expect(await readProject(page)).toEqual(before);
});

test("keeps WebMCP evidence visible in the compact judge header", async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 800 });
  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);

  for (const width of [1120, 1280, 1366, 1440, 1545, 1700, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    const left = await page.locator(".top-bar-left").boundingBox();
    const navigation = await page.locator(".primary-navigation").boundingBox();
    const right = await page.locator(".top-bar-right").boundingBox();
    expect(left && navigation && right).toBeTruthy();
    expect(left!.x + left!.width, `left group at ${width}px`).toBeLessThanOrEqual(navigation!.x);
    expect(navigation!.x + navigation!.width, `navigation at ${width}px`).toBeLessThanOrEqual(
      right!.x,
    );
    expect(right!.x + right!.width, `actions at ${width}px`).toBeLessThanOrEqual(width);
    expect(
      await page
        .locator(".top-bar-left")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      `identity fits at ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1120, height: 900 });

  await page.getByRole("button", { name: /Open WebMCP Inspector/ }).click();
  const inspector = page.getByRole("complementary", { name: "WebMCP Inspector" });
  await expect(inspector).toBeVisible();
  await inspector.getByRole("tab", { name: "Setup" }).click();
  await expect(inspector).toContainText("Type this in your browser-agent conversation");
  await expect(inspector).toContainText("there is no second chat box");

  await inspector.getByRole("button", { name: "Run read-only check" }).click();
  await expect(inspector).toContainText("labspace_get_context");
  await expect(inspector).toContainText("Empty lab plan");

  await inspector.getByRole("tab", { name: "Setup" }).click();
  await expect(inspector).toContainText("ChatGPT in-app browser");
  await expect(inspector).toContainText("Chrome Model Context Tool Inspector");
  await expect(inspector).toContainText("Chrome DevTools WebMCP pane");
  await expect(inspector).toContainText("DevTools is a debugger, not an AI chat");
});

test("keeps dialogs above the header and inspector at narrow and short viewport sizes", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  const before = await readProject(page);
  await page.getByRole("button", { name: /Open WebMCP Inspector/ }).click();

  for (const viewport of [
    { width: 1078, height: 912 },
    { width: 1280, height: 720 },
    { width: 1078, height: 640 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Open project workspace", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Laboratories and rooms", exact: true });
    await expect(dialog).toBeVisible();
    const coverage = await dialog.evaluate((element) => {
      const backdrop = element.closest(".modal-backdrop")!;
      const box = element.getBoundingClientRect();
      const heading = element.querySelector("header")!.getBoundingClientRect();
      return {
        headerCovered: backdrop.contains(document.elementFromPoint(40, 35)),
        inspectorCovered: backdrop.contains(document.elementFromPoint(innerWidth - 20, 150)),
        titleUnobscured: element.contains(
          document.elementFromPoint(heading.x + 30, heading.y + 15),
        ),
        withinViewport:
          box.left >= 16 &&
          box.top >= 16 &&
          box.right <= innerWidth - 16 &&
          box.bottom <= innerHeight - 16,
      };
    });
    expect(coverage).toEqual({
      headerCovered: true,
      inspectorCovered: true,
      titleUnobscured: true,
      withinViewport: true,
    });
    await dialog.getByRole("button", { name: "Close dialog", exact: true }).click({ trial: true });
    if (viewport.width === 1078 && viewport.height === 912) {
      await page.screenshot({ path: testInfo.outputPath("project-dialog-1078.png") });
    }
    await dialog.getByRole("button", { name: "Rename project", exact: true }).click();
    const rename = page.getByRole("dialog", { name: "Rename project", exact: true });
    await expect(rename).toBeVisible();
    await rename.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }

  await page.getByRole("button", { name: "Application settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Editor settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Editor settings" })).toHaveCount(0);
  expect(await readProject(page)).toEqual(before);
});

test("searches, plans, previews, approves, persists, and reverses a reviewed room blueprint", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".room-navigator > .room-identity").getByText("Empty lab plan", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);

  const before = await readProject(page);
  const room = before.rooms.find((entry) => entry.id === before.activeRoomId)!;
  expect(room.scene.objects).toHaveLength(0);

  const search = await executeTool<{
    results: Array<{ assetId: string; name: string; dimensionsMm: Record<string, number> }>;
  }>(page, "labspace_search_assets", { query: "standard laboratory bench" });
  expect(search.results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        assetId: "lab-bench",
        name: "Standard laboratory bench",
        dimensionsMm: { width: 1800, depth: 750, height: 900 },
      }),
    ]),
  );

  const plan = await executeTool<{
    planId: string;
    roomId: string;
    plannedObjects: number;
    unplaced: unknown[];
    proposals: Array<{ assetId: string }>;
    requiresHumanApproval: boolean;
    shell: { mode: string; segments: unknown[] };
  }>(page, "labspace_plan_room", {
    brief: "A compact equipment-preparation room with a clear central aisle.",
    aisleMm: 900,
    roomShell: { widthMm: 8000, depthMm: 6000, wallHeightMm: 3000 },
    assets: [
      { assetId: "lab-bench", quantity: 1, placement: "perimeter" },
      { assetId: "floor-centrifuge", quantity: 1, placement: "open" },
    ],
  });
  expect(plan).toMatchObject({
    roomId: room.id,
    plannedObjects: 2,
    unplaced: [],
    requiresHumanApproval: true,
    shell: { mode: "proposed" },
  });
  expect(plan.shell.segments).toHaveLength(4);
  expect(plan.proposals.map((proposal) => proposal.assetId)).toEqual([
    "lab-bench",
    "floor-centrifuge",
  ]);
  expect(
    (await readProject(page)).rooms.find((entry) => entry.id === room.id)!.scene.objects,
  ).toEqual([]);

  const staged = await executeTool<{
    staged: boolean;
    stageId: string;
    objectCount: number;
    wallCount: number;
    assetCount: number;
    floorGenerated: boolean;
    persisted: boolean;
    requiresHumanApproval: boolean;
  }>(page, "labspace_stage_room_plan", { planId: plan.planId });
  expect(staged).toMatchObject({
    staged: true,
    objectCount: 6,
    wallCount: 4,
    assetCount: 2,
    floorGenerated: true,
    persisted: false,
    requiresHumanApproval: true,
  });
  const review = page.getByTestId("agent-change-review");
  await expect(review).toBeVisible();
  await expect(review).toContainText("Review room shell and layout");
  await expect(review).toContainText("Closed room shell");
  await expect(review).toContainText("Walls generate the floor automatically");
  await expect(review).toContainText("Standard laboratory bench");
  await expect(review).toContainText("Floor centrifuge");
  await review.getByRole("button", { name: "Cancel preview" }).click();
  await expect(review).toHaveCount(0);
  expect(
    (await readProject(page)).rooms.find((entry) => entry.id === room.id)!.scene.objects,
  ).toEqual([]);

  await executeTool(page, "labspace_stage_room_plan", { planId: plan.planId });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Approve room plan" }).click();
  await expect(review).toHaveCount(0);
  await expect
    .poll(async () => {
      const persisted = await readProject(page);
      return persisted.rooms.find((entry) => entry.id === room.id)!.scene.objects.length;
    })
    .toBe(6);

  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect
    .poll(async () => {
      const persisted = await readProject(page);
      return persisted.rooms.find((entry) => entry.id === room.id)!.scene.objects.length;
    })
    .toBe(0);
  await page.getByTitle("Redo (Ctrl+Y)").click();
  await expect
    .poll(async () => {
      const persisted = await readProject(page);
      return persisted.rooms.find((entry) => entry.id === room.id)!.scene.objects.length;
    })
    .toBe(6);
});

test("keeps Reviewed as the default and bounds Fast Draft to additive room creation", async ({
  page,
}) => {
  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);

  await page.getByRole("button", { name: /Open WebMCP Inspector/i }).click();
  const reviewedMode = page.getByRole("radio", { name: /Reviewed/i });
  const fastMode = page.getByRole("radio", { name: /Fast Draft/i });
  await expect(reviewedMode).toHaveAttribute("aria-checked", "true");

  const reviewedProposal = await executeTool<{
    created: boolean;
    staged: boolean;
    stageId: string;
    requiresHumanApproval: boolean;
  }>(page, "labspace_create_room", {
    name: "Reviewed WebMCP Office",
    code: "813",
  });
  expect(reviewedProposal).toMatchObject({
    created: false,
    staged: true,
    requiresHumanApproval: true,
  });
  const creationReview = page.getByTestId("agent-change-review");
  await expect(creationReview).toContainText("Review room creation");
  await expect(creationReview).toContainText("Reviewed WebMCP Office");
  await creationReview.getByRole("button", { name: "Cancel preview" }).click();
  expect((await readProject(page)).rooms.some((room) => room.code === "813")).toBe(false);

  await fastMode.click();
  await expect(fastMode).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Close WebMCP Inspector" }).click();

  const created = await executeTool<{
    created: true;
    roomId: string;
    roomName: string;
    roomCode: string;
    floor: number;
    persisted: boolean;
    initialLayoutAutoCommitEligible: boolean;
    executionMode: string;
  }>(page, "labspace_create_room", {
    name: "WebMCP Student Office",
    code: "812",
  });
  expect(created).toMatchObject({
    created: true,
    roomName: "WebMCP Student Office",
    roomCode: "812",
    floor: 8,
    persisted: true,
    initialLayoutAutoCommitEligible: true,
    executionMode: "fast-draft",
  });
  await expect(
    page.locator(".room-navigator > .room-identity").getByText("WebMCP Student Office", {
      exact: true,
    }),
  ).toBeVisible();

  const plan = await executeTool<{
    planId: string;
    unplaced: unknown[];
    shell: { vertices: Array<{ xMm: number; yMm: number }> };
    proposals: Array<{
      assetId: string;
      rotationDeg: number;
      snappedTo?: { relation: string };
      opening?: { wallIndex: number; sillHeightMm: number };
    }>;
  }>(page, "labspace_plan_room", {
    brief: "Six-wall student office with paired workstations and hosted openings.",
    aisleMm: 700,
    roomShell: {
      vertices: [
        { xMm: 0, yMm: 0 },
        { xMm: 7000, yMm: 0 },
        { xMm: 7000, yMm: 3000 },
        { xMm: 6000, yMm: 3000 },
        { xMm: 6000, yMm: 5000 },
        { xMm: 0, yMm: 5000 },
      ],
    },
    assets: [
      { assetId: "office-desk", quantity: 4 },
      { assetId: "office-chair", quantity: 4 },
      {
        assetId: "tall-cabinet",
        quantity: 1,
        position: { xMm: 500, yMm: 2500 },
      },
      {
        assetId: "single-door",
        quantity: 1,
        placement: "wall",
        host: { wallIndex: 6, offsetMm: 1000, handing: "right" },
      },
      {
        assetId: "standard-window",
        quantity: 1,
        placement: "wall",
        host: { wallIndex: 1, offsetMm: 5000, sillHeightMm: 900 },
      },
    ],
  });
  expect(plan.unplaced).toEqual([]);
  const doubledArea = plan.shell.vertices.reduce((sum, vertex, index, vertices) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + vertex.xMm * next.yMm - next.xMm * vertex.yMm;
  }, 0);
  expect(Math.abs(doubledArea) / 2).toBe(33_000_000);
  expect(
    plan.proposals
      .filter((proposal) => proposal.assetId === "office-chair")
      .every((proposal) => proposal.snappedTo?.relation === "workstation"),
  ).toBe(true);
  expect(plan.proposals.find((proposal) => proposal.assetId === "tall-cabinet")?.rotationDeg).toBe(
    270,
  );
  expect(
    plan.proposals.find((proposal) => proposal.assetId === "single-door")?.opening,
  ).toMatchObject({ wallIndex: 6 });

  const staged = await executeTool<{
    autoCommitted: boolean;
    requiresHumanApproval: boolean;
    objectCount: number;
  }>(page, "labspace_stage_room_plan", { planId: plan.planId });
  expect(staged).toMatchObject({
    autoCommitted: true,
    requiresHumanApproval: false,
    objectCount: 17,
  });
  await expect(page.getByTestId("agent-change-review")).toHaveCount(0);
  await expect
    .poll(async () => {
      const project = await readProject(page);
      return project.rooms.find((room) => room.id === created.roomId)?.scene.objects.length;
    })
    .toBe(17);
  await expect(page.getByText("All changes saved", { exact: true }).first()).toBeVisible();

  const persisted = await readProject(page);
  const room = persisted.rooms.find((entry) => entry.id === created.roomId)!;
  const openings = room.scene.objects.filter((object) => object.opening);
  expect(openings).toHaveLength(2);
  expect(
    openings.every((object) =>
      room.scene.objects.some((wall) => wall.id === object.opening?.wallId),
    ),
  ).toBe(true);

  const window = openings.find((object) => object.objectType === "window")!;
  const resizeValidation = await executeTool<{
    valid: boolean;
    current: { widthMm: number };
    proposed: { widthMm: number };
  }>(page, "labspace_validate_resize", {
    objectId: window.id,
    dimensions: { widthMm: 4000 },
  });
  expect(resizeValidation).toMatchObject({
    valid: true,
    current: { widthMm: window.dimensions.width },
    proposed: { widthMm: 4000 },
  });
  const resizeStage = await executeTool<{
    staged: boolean;
    requiresHumanApproval: boolean;
  }>(page, "labspace_stage_resize", {
    objectId: window.id,
    dimensions: { widthMm: 4000 },
  });
  expect(resizeStage).toMatchObject({ staged: true, requiresHumanApproval: true });
  const resizeReview = page.getByTestId("agent-change-review");
  await expect(resizeReview).toContainText("Review agent resize");
  await resizeReview.getByRole("button", { name: "Approve resize" }).click();
  await expect
    .poll(async () => {
      const current = currentObject(await readProject(page), created.roomId, window.id);
      return { width: current.dimensions.width, openingWidth: current.opening?.width };
    })
    .toEqual({ width: 4000, openingWidth: 4000 });
  await expect(page.getByText("All changes saved", { exact: true }).first()).toBeVisible();

  const laterPlan = await executeTool<{ planId: string }>(page, "labspace_plan_room", {
    assets: [{ assetId: "round-stool", quantity: 1, placement: "open" }],
  });
  const laterStage = await executeTool<{
    autoCommitted: boolean;
    requiresHumanApproval: boolean;
  }>(page, "labspace_stage_room_plan", { planId: laterPlan.planId });
  expect(laterStage).toMatchObject({ autoCommitted: false, requiresHumanApproval: true });
  const review = page.getByTestId("agent-change-review");
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Cancel preview" }).click();

  await page.reload();
  await page.getByRole("button", { name: /Open WebMCP Inspector/i }).click();
  await expect(page.getByRole("radio", { name: /Reviewed/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("searches and focuses canonical indexed evidence across rooms", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator(".room-navigator > .room-identity").getByText("Empty lab plan", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);

  const search = await executeTool<{
    totalMatches: number;
    results: Array<{ recordId: string; roomCode: string; name: string; path: string[] }>;
  }>(page, "labspace_search_records", { query: "Reference standards" });
  const reference = search.results.find(
    (record) => record.name === "Reference standards" && record.roomCode === "DEMO-01",
  );
  expect(reference).toBeTruthy();
  expect(reference?.path).toEqual(
    expect.arrayContaining(["Build Week Demo", "Wall cabinet", "Shelf 01"]),
  );

  const focused = await executeTool<{ roomCode: string; recordId: string }>(
    page,
    "labspace_focus_record",
    { recordId: reference!.recordId },
  );
  expect(focused).toMatchObject({ roomCode: "DEMO-01", recordId: reference!.recordId });

  const context = await executeTool<{
    room: { code: string };
    selection: { storageLocationId: string | null };
  }>(page, "labspace_get_context", {});
  expect(context.room.code).toBe("DEMO-01");
  expect(context.selection.storageLocationId).toBeTruthy();
});

test("dismisses exact-location selection without reloading or changing room data", async ({
  page,
}) => {
  test.setTimeout(60_000);
  // This isolated test DB fixture keeps the real indexed cabinet and shelf,
  // without compiling every unrelated hero asset for each focus interaction.
  const fixture = await readProject(page);
  const demo = eligibleDemoRoom(fixture);
  const item = demo.scene.inventoryItems.find((entry) => entry.name === "Reference standards")!;
  const location = demo.scene.storageLocations.find(
    (entry) => entry.id === item.storageLocationId,
  )!;
  demo.scene.objects = demo.scene.objects.filter((entry) => entry.id === location.objectId);
  demo.scene.storageLocations = demo.scene.storageLocations.filter(
    (entry) => entry.objectId === location.objectId,
  );
  demo.scene.inventoryItems = [item];
  demo.scene.equipmentRecords = [];
  fixture.activeRoomId = demo.id;
  expect(
    (await page.request.put(`/api/project/${fixture.id}`, { data: fixture })).ok(),
  ).toBeTruthy();
  await page.goto("/digital-twin");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  await page.getByRole("button", { name: "2D fallback", exact: true }).click();
  const before = await readProject(page);
  const search = await executeTool<{
    results: Array<{ recordId: string; roomCode: string; name: string }>;
  }>(page, "labspace_search_records", { query: "Reference standards" });
  const reference = search.results.find(
    (record) => record.name === "Reference standards" && record.roomCode === "DEMO-01",
  )!;
  const focus = async () => {
    await executeTool(page, "labspace_focus_record", { recordId: reference.recordId });
    await page.getByRole("button", { name: "2D fallback", exact: true }).click({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toBeVisible();
  };
  const expectClear = async () => {
    await expect(page.getByText("Select an indexed record", { exact: true })).toBeVisible();
    const context = await executeTool<{
      selection: { objectIds: string[]; storageLocationId: string | null };
    }>(page, "labspace_get_context", {});
    expect(context.selection).toEqual({ objectIds: [], storageLocationId: null });
  };
  await focus();
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await expectClear();
  await focus();
  await page.getByRole("button", { name: "Clear selection", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expectClear();
  await page.getByRole("button", { name: /^Inventory \d+$/ }).click();
  const result = page
    .locator(".twin-result-list > button")
    .filter({ has: page.locator(".twin-result-name", { hasText: /^Reference standards$/ }) })
    .first();
  await result.dblclick({ timeout: 10000 });
  await page.getByRole("button", { name: "2D fallback", exact: true }).click({ timeout: 10000 });
  await expect(result).toHaveAttribute("aria-pressed", "true");
  await result.click({ timeout: 10000 });
  await expect(result).toHaveAttribute("aria-pressed", "false");
  await expectClear();
  expect((await readProject(page)).rooms).toEqual(before.rooms);
});

test("opens real cabinet doors and drawers without changing saved room data", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await readProject(page);
  const demo = eligibleDemoRoom(fixture);
  const item = demo.scene.inventoryItems.find((entry) => entry.name === "Reference standards")!;
  const shelf = demo.scene.storageLocations.find((entry) => entry.id === item.storageLocationId)!;
  const cabinet = demo.scene.objects.find((entry) => entry.id === shelf.objectId)!;
  demo.scene.objects = [cabinet];
  demo.scene.storageLocations = demo.scene.storageLocations.filter(
    (entry) => entry.objectId === cabinet.id,
  );
  demo.scene.inventoryItems = [item];
  demo.scene.equipmentRecords = [];
  fixture.activeRoomId = demo.id;
  expect(
    (await page.request.put(`/api/project/${fixture.id}`, { data: fixture })).ok(),
  ).toBeTruthy();
  await page.goto("/digital-twin");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  const before = await readProject(page);
  await page.getByRole("textbox", { name: "Search spatial index" }).fill("Reference standards");
  await page.getByRole("button", { name: "Find indexed records" }).click();
  const open = page.getByRole("button", { name: "Show access preview", exact: true });
  const close = page.getByRole("button", { name: "Close access preview", exact: true });
  await expect(close).toHaveAttribute("aria-pressed", "true");
  await expect(close).toHaveAttribute(
    "data-storage-parts",
    "wall cabinet left door|wall cabinet right door",
  );
  await expect(page.locator("#storage-access-note")).toContainText("fixed interior shelves");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "true");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-scene-ready", "true");
  await page
    .getByTestId("3d-view")
    .screenshot({ path: "test-results/storage-wall-cabinet-open.png" });
  await page.getByRole("button", { name: "Close access preview", exact: true }).click();
  await expect(open).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  await open.click();
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  expect((await readProject(page)).rooms).toEqual(before.rooms);

  // Same isolated fixture, now a physical three-drawer cabinet. This changes
  // only the test database; the user's local project is never reset or edited.
  cabinet.assetDefinitionId = "base-drawer-cabinet";
  cabinet.dimensions = { width: 600, depth: 600, height: 850 };
  cabinet.position.z = 0;
  shelf.type = "drawer";
  shelf.name = "Drawer 01";
  delete shelf.anatomyKey;
  delete shelf.normalizedBounds;
  expect(
    (await page.request.put(`/api/project/${fixture.id}`, { data: fixture })).ok(),
  ).toBeTruthy();
  await page.reload();
  await page.getByRole("textbox", { name: "Search spatial index" }).fill("Reference standards");
  await page.getByRole("button", { name: "Find indexed records" }).click();
  await expect(close).toHaveAttribute("data-storage-parts", "Three-drawer bank drawer 3");
  await expect(page.locator("#storage-access-note")).toContainText("1 drawer");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "true");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-scene-ready", "true");
  await page.getByTestId("3d-view").screenshot({ path: "test-results/storage-drawer-open.png" });
  await page.getByRole("button", { name: "Close access preview", exact: true }).click();
  await expect(open).toHaveAttribute("aria-pressed", "false");
});

test("fits named authored assets and resets preview views at a narrow desktop size", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1078, height: 912 });
  await page.goto("/asset-preview?asset=corner-lab-bench");
  const before = await readProject(page);
  const preview = page.locator(".asset-preview-canvas");
  for (const [id, name] of [
    ["corner-lab-bench", "Corner laboratory bench Furniture"],
    ["computer-workstation", "Computer workstation Laboratory equipment"],
    ["mobile-bench", "Mobile bench Furniture"],
    ["office-desk", "Office desk Furniture"],
    ["lab-bench", "Standard laboratory bench Furniture"],
    ["stainless-wash-basin", "Open stainless laboratory wash basin Furniture"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(preview).toHaveAttribute("data-asset-id", id);
    await expect(preview).toHaveAttribute("data-model-ready", "true");
    await expect(preview.locator("canvas")).toBeVisible();
    for (const view of ["Front", "Back", "Top", "Iso"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      await expect(page.getByRole("button", { name: view, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await page.getByRole("button", { name: "Fit", exact: true }).click();
    await preview.screenshot({ path: `test-results/asset-polish-${id}.png` });
  }
  expect((await readProject(page)).rooms).toEqual(before.rooms);
});

test("finds ranked valid placements without changing the canonical room", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  const project = await readProject(page);
  const room = eligibleDemoRoom(project);
  const movable = room.scene.objects.find(
    (object) => !object.locked && ["furniture", "storage", "equipment"].includes(object.objectType),
  )!;
  const collision = await findCollisionTarget(page, room, movable);
  const before = currentObject(project, room.id, movable.id);

  const result = await executeTool<PlacementRecommendations>(
    page,
    "labspace_find_valid_placements",
    {
      objectId: movable.id,
      preferredTarget: collision.target,
      limit: 3,
    },
  );

  expect(result.objectId).toBe(movable.id);
  expect(result.evaluatedTargets).toBeGreaterThan(0);
  expect(result.candidates).toHaveLength(3);
  expect(result.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3]);
  for (const candidate of result.candidates) {
    const validation = await executeTool<MoveValidation>(page, "labspace_validate_object_move", {
      objectId: movable.id,
      target: { xMm: candidate.target.xMm, yMm: candidate.target.yMm },
      rotationDeg: candidate.target.rotationDeg,
    });
    expect(validation.valid).toBe(true);
  }
  expect(currentObject(await readProject(page), room.id, movable.id)).toEqual(before);
  await expect(page.getByTestId("agent-change-review")).toHaveCount(0);
});

test("validates, stages, cancels, approves, persists, and reverses one human-reviewed move", async ({
  page,
}) => {
  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  const project = await readProject(page);
  const room = eligibleDemoRoom(project);
  const { object, target } = await findClearMove(page, room);
  const collision = await findCollisionTarget(page, room, object);
  const original = { x: object.position.x, y: object.position.y };

  expect(collision.result.valid).toBe(false);
  const invalidStage = await executeTool<{ staged: boolean; persisted: boolean }>(
    page,
    "labspace_stage_object_move",
    { objectId: object.id, target: collision.target },
  );
  expect(invalidStage).toEqual(expect.objectContaining({ staged: false, persisted: false }));
  await expect(page.getByTestId("agent-change-review")).toHaveCount(0);
  expect(currentObject(await readProject(page), room.id, object.id).position).toMatchObject(
    original,
  );

  const staged = await executeTool<{
    staged: boolean;
    persisted: boolean;
    requiresHumanApproval: boolean;
  }>(page, "labspace_stage_object_move", { objectId: object.id, target });
  expect(staged).toEqual(
    expect.objectContaining({
      staged: true,
      persisted: false,
      requiresHumanApproval: true,
    }),
  );
  const review = page.getByTestId("agent-change-review");
  await expect(review).toBeVisible();
  await expect(review).toContainText("Preview · not saved");
  await review.getByRole("button", { name: "Cancel" }).click();
  await expect(review).toHaveCount(0);
  expect(currentObject(await readProject(page), room.id, object.id).position).toMatchObject(
    original,
  );

  await executeTool(page, "labspace_stage_object_move", { objectId: object.id, target });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Approve move" }).click();
  await expect(review).toHaveCount(0);
  await expect
    .poll(async () => currentObject(await readProject(page), room.id, object.id).position)
    .toMatchObject({ x: target.xMm, y: target.yMm });

  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect
    .poll(async () => currentObject(await readProject(page), room.id, object.id).position)
    .toMatchObject(original);
  await page.getByTitle("Redo (Ctrl+Y)").click();
  await expect
    .poll(async () => currentObject(await readProject(page), room.id, object.id).position)
    .toMatchObject({ x: target.xMm, y: target.yMm });

  await page.reload();
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  expect(currentObject(await readProject(page), room.id, object.id).position).toMatchObject({
    x: target.xMm,
    y: target.yMm,
  });
});
