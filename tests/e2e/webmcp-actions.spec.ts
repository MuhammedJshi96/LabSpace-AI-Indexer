import { expect, test, type Page } from "@playwright/test";
import type { RoomAuditResult } from "../../src/agent/labspace-action-types";
import type { Project, Room, SceneObject } from "../../src/domain/schema";

const WEBMCP_TOOL_NAMES = [
  "labspace_audit_room",
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
  "labspace_stage_resize",
  "labspace_stage_room_plan",
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

test("registers exactly seventeen tools on product routes and excludes internal asset routes", async ({
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

  const left = await page.locator(".top-bar-left").boundingBox();
  const navigation = await page.locator(".primary-navigation").boundingBox();
  const right = await page.locator(".top-bar-right").boundingBox();
  expect(left && navigation && right).toBeTruthy();
  expect(left!.x + left!.width).toBeLessThanOrEqual(navigation!.x);
  expect(navigation!.x + navigation!.width).toBeLessThanOrEqual(right!.x);
  expect(right!.x + right!.width).toBeLessThanOrEqual(1120);

  await page.getByRole("button", { name: /Open WebMCP Inspector/ }).click();
  const inspector = page.getByRole("complementary", { name: "WebMCP Inspector" });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText("Type this in your browser-agent conversation");
  await expect(inspector).toContainText("there is no second chat box");

  await inspector.getByRole("button", { name: "Run read-only check" }).click();
  await expect(inspector).toContainText("labspace_get_context");
  await expect(inspector).toContainText("Empty lab plan");

  await inspector.getByRole("tab", { name: "Use WebMCP" }).click();
  await expect(inspector).toContainText("ChatGPT in-app browser");
  await expect(inspector).toContainText("Chrome Model Context Tool Inspector");
  await expect(inspector).toContainText("Chrome DevTools WebMCP pane");
  await expect(inspector).toContainText("DevTools is a debugger, not an AI chat");
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

test("creates a blank room and auto-commits only its first complete WebMCP blueprint", async ({
  page,
}) => {
  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);

  const created = await executeTool<{
    roomId: string;
    roomName: string;
    roomCode: string;
    floor: number;
    persisted: boolean;
    initialLayoutAutoCommitEligible: boolean;
  }>(page, "labspace_create_room", {
    name: "WebMCP Student Office",
    code: "812",
  });
  expect(created).toMatchObject({
    roomName: "WebMCP Student Office",
    roomCode: "812",
    floor: 8,
    persisted: true,
    initialLayoutAutoCommitEligible: true,
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
