import { expect, test, type Page } from "@playwright/test";
import type { Project, Room, SceneObject } from "../../src/domain/schema";

const WEBMCP_TOOL_NAMES = [
  "labspace_focus_record",
  "labspace_get_context",
  "labspace_inspect_record",
  "labspace_search_records",
  "labspace_stage_object_move",
  "labspace_validate_object_move",
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

async function findClearMove(page: Page, room: Room) {
  const movable = room.scene.objects.filter(
    (object) =>
      !object.locked && ["furniture", "storage", "equipment"].includes(object.objectType),
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
      const result = await executeTool<MoveValidation>(
        page,
        "labspace_validate_object_move",
        { objectId: object.id, target },
      );
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

test("registers exactly six tools on product routes and excludes internal asset routes", async ({
  page,
}) => {
  for (const route of ["/", "/digital-twin"]) {
    await page.goto(route);
    await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
  }

  for (const route of ["/asset-preview", "/procedural-asset-capture"]) {
    await page.goto(route);
    await expect.poll(() => registeredToolNames(page)).toEqual([]);
  }

  await page.goto("/");
  await expect.poll(() => registeredToolNames(page)).toEqual(WEBMCP_TOOL_NAMES);
});

test("searches and focuses canonical indexed evidence across rooms", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Empty lab plan", { exact: true })).toBeVisible();
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
  expect(currentObject(await readProject(page), room.id, object.id).position).toMatchObject(original);

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
  expect(currentObject(await readProject(page), room.id, object.id).position).toMatchObject(original);

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
