import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import type { Project } from "../src/domain/schema";

type Method = "manual-ui" | "reviewed-webmcp";
type TaskId = "locate-three-materials" | "add-five-inventory-items" | "furnish-office";

type Trial = {
  taskId: TaskId;
  method: Method;
  run: number;
  warmup: boolean;
  sequence: number;
  milliseconds: number;
  uiActions: number;
  toolCalls: number;
  approvals: number;
  outcomeChecks: number;
  outcomeChecksPassed: number;
  errors: string[];
};

type ToolResult = Record<string, unknown>;

const measuredRuns = Math.max(1, Number(process.env.LABSPACE_BENCHMARK_RUNS ?? 5));
const requestedTask = process.env.LABSPACE_BENCHMARK_TASK as TaskId | undefined;
const materials = ["Reference standards", "Nitrile gloves, M", "Rotary evaporator flask set"];
const inventoryNames = [
  "Benchmark citrate buffer",
  "Benchmark wash solvent",
  "Benchmark sample tubes",
  "Benchmark calibration mix",
  "Benchmark filter membranes",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
          () => activeTools.get(tool.name) === tool && activeTools.delete(tool.name),
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

async function executeTool<T extends ToolResult>(
  page: Page,
  name: string,
  input: Record<string, unknown>,
) {
  return page.evaluate(
    async ({ toolName, toolInput }) => {
      const tools = await document.modelContext?.getTools();
      const tool = tools?.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Missing WebMCP tool: ${toolName}`);
      return tool.execute(toolInput, { signal: new AbortController().signal });
    },
    { toolName: name, toolInput: input },
  ) as Promise<T>;
}

async function readProject(page: Page) {
  const response = await page.request.get("/api/project");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Project;
}

async function preparedPage(browser: Browser, route: string, webmcp: boolean) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (webmcp) await installModelContext(page);
  const reset = await page.request.post("/api/testing/reset");
  expect(reset.ok()).toBeTruthy();
  await page.goto(route, { waitUntil: "domcontentloaded" });
  if (route === "/digital-twin") {
    await expect(page.getByTestId("digital-twin-page")).toBeVisible();
    await page.getByRole("button", { name: "2D fallback", exact: true }).click();
    await expect(page.getByTestId("2d-editor")).toBeVisible();
  } else if (route === "/inventory") {
    await expect(
      page.getByRole("heading", { name: "Inventory Studio", exact: true }),
    ).toBeVisible();
    await expect(page.getByTitle("All changes saved", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByTestId("2d-editor")).toBeVisible();
    const twoDimensional = page.getByRole("button", { name: "2D", exact: true });
    if (!((await twoDimensional.getAttribute("class")) ?? "").includes("active")) {
      await twoDimensional.click();
    }
    await expect(twoDimensional).toHaveClass(/active/);
  }
  if (webmcp) {
    await expect
      .poll(async () => (await page.evaluate(() => document.modelContext?.getTools())).length)
      .toBe(23);
  }
  return { context, page, errors };
}

function createTrial(
  taskId: TaskId,
  method: Method,
  run: number,
  warmup: boolean,
  sequence: number,
  overrides: Omit<Trial, "taskId" | "method" | "run" | "warmup" | "sequence">,
): Trial {
  return { taskId, method, run, warmup, sequence, ...overrides };
}

async function manualLocate(browser: Browser, run: number, warmup: boolean, sequence: number) {
  const { context, page, errors } = await preparedPage(browser, "/digital-twin", false);
  let uiActions = 0;
  let checks = 0;
  let passed = 0;
  const started = performance.now();
  try {
    const search = page.getByRole("textbox", { name: "Search spatial index" });
    for (const name of materials) {
      await search.fill(name);
      uiActions += 1;
      const record = page.getByRole("button", {
        name: new RegExp(`^${escapeRegExp(name)} Inventory `),
      });
      await expect(record).toHaveCount(1);
      await record.click({ noWaitAfter: true });
      uiActions += 1;
      const detail = page.getByRole("complementary", { name: "Selected record details" });
      checks += 2;
      await expect(detail.getByRole("heading", { name, exact: true })).toBeVisible();
      passed += 1;
      await expect(detail.getByText("Exact location", { exact: false })).toBeVisible();
      passed += 1;
    }
    return createTrial("locate-three-materials", "manual-ui", run, warmup, sequence, {
      milliseconds: performance.now() - started,
      uiActions,
      toolCalls: 0,
      approvals: 0,
      outcomeChecks: checks,
      outcomeChecksPassed: passed,
      errors,
    });
  } finally {
    await context.close();
  }
}

async function webmcpLocate(browser: Browser, run: number, warmup: boolean, sequence: number) {
  const { context, page, errors } = await preparedPage(browser, "/digital-twin", true);
  let toolCalls = 0;
  let checks = 0;
  let passed = 0;
  const started = performance.now();
  try {
    const resolution = await executeTool<{
      requirements: Array<{
        status: string;
        candidates: Array<{ recordId: string; name: string }>;
      }>;
      missing: string[];
    }>(page, "labspace_resolve_materials", {
      brief: "Benchmark exact-location collection",
      materials,
    });
    toolCalls += 1;
    checks += 2;
    expect(resolution.missing).toEqual([]);
    passed += 1;
    expect(resolution.requirements.every((entry) => entry.status === "exact-match")).toBe(true);
    passed += 1;
    const recordIds = resolution.requirements.map((entry) => entry.candidates[0].recordId);
    await executeTool(page, "labspace_start_collection", {
      title: "Benchmark three-material collection",
      recordIds,
    });
    toolCalls += 1;
    const guide = page.getByRole("region", { name: "Collection guide" });
    await expect(guide).toBeVisible();
    for (let index = 0; index < materials.length; index += 1) {
      if (index > 0) {
        await executeTool(page, "labspace_collection_step", { action: "next" });
        toolCalls += 1;
      }
      checks += 2;
      await expect(guide).toContainText(`${index + 1} / ${materials.length}`);
      passed += 1;
      await expect(
        page.getByRole("complementary", { name: "Selected record details" }).getByRole("heading", {
          name: materials[index],
          exact: true,
        }),
      ).toBeVisible();
      passed += 1;
    }
    return createTrial("locate-three-materials", "reviewed-webmcp", run, warmup, sequence, {
      milliseconds: performance.now() - started,
      uiActions: 0,
      toolCalls,
      approvals: 0,
      outcomeChecks: checks,
      outcomeChecksPassed: passed,
      errors,
    });
  } finally {
    await context.close();
  }
}

async function manualInventory(browser: Browser, run: number, warmup: boolean, sequence: number) {
  const { context, page, errors } = await preparedPage(browser, "/inventory", false);
  let uiActions = 0;
  const started = performance.now();
  try {
    await page.getByRole("tab", { name: "Storage", exact: true }).click();
    uiActions += 1;
    await page.getByRole("button", { name: "Choose cabinet", exact: true }).click();
    uiActions += 1;
    await page
      .getByRole("button", { name: "Manage Chromatography consumables cabinet in CHR-A" })
      .click();
    uiActions += 1;
    const project = await readProject(page);
    const room = project.rooms.find((entry) => entry.code === "CHR-A")!;
    const drawer = room.scene.storageLocations.find((entry) => entry.name === "Drawer 01")!;
    await page.getByLabel("Storage location").selectOption(drawer.id);
    uiActions += 1;
    const detail = page.getByRole("region", { name: "Selected storage contents" });
    for (let index = 0; index < inventoryNames.length; index += 1) {
      await detail.getByRole("button", { name: "Add item", exact: true }).click();
      uiActions += 1;
      const form = detail.getByRole("form", { name: "New item at this location" });
      await form.getByLabel("Item name").fill(inventoryNames[index]);
      uiActions += 1;
      await form.getByLabel("Quantity").fill(String(index + 1));
      uiActions += 1;
      await form.getByLabel("Unit", { exact: true }).fill("boxes");
      uiActions += 1;
      await form.getByRole("button", { name: "Create item here" }).click();
      uiActions += 1;
      await expect(
        detail.getByRole("button", { name: inventoryNames[index], exact: true }),
      ).toBeVisible();
    }
    await page.getByRole("button", { name: "Save now", exact: true }).click();
    uiActions += 1;
    await expect
      .poll(async () => {
        const current = await readProject(page);
        return current.rooms
          .find((entry) => entry.code === "CHR-A")!
          .scene.inventoryItems.filter((item) => inventoryNames.includes(item.name)).length;
      })
      .toBe(inventoryNames.length);
    const saved = await readProject(page);
    const savedRoom = saved.rooms.find((entry) => entry.code === "CHR-A")!;
    const created = savedRoom.scene.inventoryItems.filter((item) =>
      inventoryNames.includes(item.name),
    );
    expect(created).toHaveLength(inventoryNames.length);
    expect(created.every((item) => item.storageLocationId === drawer.id)).toBe(true);
    return createTrial("add-five-inventory-items", "manual-ui", run, warmup, sequence, {
      milliseconds: performance.now() - started,
      uiActions,
      toolCalls: 0,
      approvals: 0,
      outcomeChecks: 2,
      outcomeChecksPassed: 2,
      errors,
    });
  } finally {
    await context.close();
  }
}

async function webmcpInventory(browser: Browser, run: number, warmup: boolean, sequence: number) {
  const { context, page, errors } = await preparedPage(browser, "/inventory", true);
  let toolCalls = 0;
  let approvals = 0;
  const started = performance.now();
  try {
    const locations = await executeTool<{
      locations: Array<{ locationId: string; path: string[] }>;
    }>(page, "labspace_inventory_locations", {
      roomCode: "CHR-A",
      query: "Chromatography consumables cabinet Drawer 01",
    });
    toolCalls += 1;
    const drawer = locations.locations.find((location) => location.path.at(-1) === "Drawer 01")!;
    expect(drawer).toBeTruthy();
    await executeTool(page, "labspace_add_inventory", {
      entries: inventoryNames.map((name, index) => ({
        roomCode: "CHR-A",
        name,
        quantity: index + 1,
        unit: "boxes",
        storageLocationId: drawer.locationId,
        owner: "Benchmark",
      })),
    });
    toolCalls += 1;
    const review = page.getByTestId("agent-change-review");
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Approve inventory" }).click();
    approvals += 1;
    await expect(review).toHaveCount(0);
    await expect
      .poll(async () => {
        const current = await readProject(page);
        return current.rooms
          .find((entry) => entry.code === "CHR-A")!
          .scene.inventoryItems.filter((item) => inventoryNames.includes(item.name)).length;
      })
      .toBe(inventoryNames.length);
    const saved = await readProject(page);
    const savedRoom = saved.rooms.find((entry) => entry.code === "CHR-A")!;
    const created = savedRoom.scene.inventoryItems.filter((item) =>
      inventoryNames.includes(item.name),
    );
    expect(created).toHaveLength(inventoryNames.length);
    expect(created.every((item) => item.storageLocationId === drawer.locationId)).toBe(true);
    return createTrial("add-five-inventory-items", "reviewed-webmcp", run, warmup, sequence, {
      milliseconds: performance.now() - started,
      uiActions: approvals,
      toolCalls,
      approvals,
      outcomeChecks: 2,
      outcomeChecksPassed: 2,
      errors,
    });
  } finally {
    await context.close();
  }
}

async function manualOffice(browser: Browser, run: number, warmup: boolean, sequence: number) {
  const { context, page, errors } = await preparedPage(browser, "/", false);
  let uiActions = 0;
  const started = performance.now();
  try {
    await page.getByRole("button", { name: "Open project workspace", exact: true }).click();
    uiActions += 1;
    const workspace = page.getByRole("dialog", { name: "Laboratories and rooms", exact: true });
    await workspace.getByRole("button", { name: "Create", exact: true }).click();
    uiActions += 1;
    await workspace.getByRole("menuitem", { name: /^Room Add a blank planning/ }).click();
    uiActions += 1;
    const form = page.getByRole("dialog", { name: "Create room", exact: true });
    await form.getByLabel("Room name").fill("Benchmark Student Office");
    uiActions += 1;
    await form.getByLabel("Room code").fill("B812");
    uiActions += 1;
    await form.getByRole("button", { name: "Create", exact: true }).click();
    uiActions += 1;
    await expect(form).toHaveCount(0);
    await workspace.getByRole("button", { name: "Close dialog", exact: true }).click();
    uiActions += 1;
    await expect(workspace).toHaveCount(0);
    await expect(
      page.locator(".room-navigator").getByText("Benchmark Student Office", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Room construction options", exact: true }).click();
    uiActions += 1;
    await page.getByRole("button", { name: /Rectangular room/ }).click();
    uiActions += 1;
    const editor = page.getByTestId("2d-editor");
    const box = (await editor.boundingBox())!;
    const scale = Number(await editor.getAttribute("data-plan-scale"));
    const origin = {
      x: box.x + Number(await editor.getAttribute("data-plan-origin-x")),
      y: box.y + Number(await editor.getAttribute("data-plan-origin-y")),
    };
    await page.mouse.move(origin.x + 1000 * scale, origin.y + 1000 * scale);
    await page.mouse.down();
    await page.mouse.move(origin.x + 9000 * scale, origin.y + 7000 * scale, { steps: 8 });
    await page.mouse.up();
    uiActions += 1;

    const search = page.getByRole("textbox", { name: "Search assets" });
    for (const [query, count] of [
      ["Office desk", 2],
      ["Office chair", 2],
      ["Tall cabinet", 1],
    ] as const) {
      await search.fill(query);
      uiActions += 1;
      const card = page.getByRole("article", { name: new RegExp(`^${escapeRegExp(query)} —`) });
      await expect(card).toHaveCount(1);
      for (let index = 0; index < count; index += 1) {
        await card.dblclick();
        uiActions += 1;
      }
    }
    await expect(page.locator(".status-bar .save-ok")).toContainText(/saved/i);
    await expect
      .poll(
        async () =>
          (await readProject(page)).rooms.find((entry) => entry.code === "B812")?.scene.objects
            .length,
      )
      .toBe(9);
    const project = await readProject(page);
    const room = project.rooms.find((entry) => entry.code === "B812")!;
    const wallCount = room.scene.objects.filter((object) => object.objectType === "wall").length;
    const assetIds = room.scene.objects.map((object) => object.assetDefinitionId);
    expect(room.width * room.depth).toBe(48_000_000);
    expect(wallCount).toBe(4);
    expect(assetIds.filter((id) => id === "office-desk")).toHaveLength(2);
    expect(assetIds.filter((id) => id === "office-chair")).toHaveLength(2);
    expect(assetIds.filter((id) => id === "tall-cabinet")).toHaveLength(1);
    return createTrial("furnish-office", "manual-ui", run, warmup, sequence, {
      milliseconds: performance.now() - started,
      uiActions,
      toolCalls: 0,
      approvals: 0,
      outcomeChecks: 5,
      outcomeChecksPassed: 5,
      errors,
    });
  } finally {
    await context.close();
  }
}

async function webmcpOffice(browser: Browser, run: number, warmup: boolean, sequence: number) {
  const { context, page, errors } = await preparedPage(browser, "/", true);
  let toolCalls = 0;
  let approvals = 0;
  const started = performance.now();
  try {
    await executeTool(page, "labspace_create_room", {
      name: "Benchmark Student Office",
      code: "B812",
    });
    toolCalls += 1;
    let review = page.getByTestId("agent-change-review");
    await review.getByRole("button", { name: "Create room", exact: true }).click();
    approvals += 1;
    await expect(review).toHaveCount(0);
    const plan = await executeTool<{ planId: string; unplaced: unknown[] }>(
      page,
      "labspace_plan_room",
      {
        brief: "A clear 48 square metre student office with paired workstations and storage.",
        aisleMm: 900,
        roomShell: { widthMm: 8000, depthMm: 6000, wallHeightMm: 3000 },
        assets: [
          { assetId: "office-desk", quantity: 2 },
          { assetId: "office-chair", quantity: 2 },
          { assetId: "tall-cabinet", quantity: 1, placement: "perimeter" },
        ],
      },
    );
    toolCalls += 1;
    expect(plan.unplaced).toEqual([]);
    await executeTool(page, "labspace_stage_room_plan", { planId: plan.planId });
    toolCalls += 1;
    review = page.getByTestId("agent-change-review");
    await review.getByRole("button", { name: "Approve room plan", exact: true }).click();
    approvals += 1;
    await expect(review).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await readProject(page)).rooms.find((entry) => entry.code === "B812")?.scene.objects
            .length,
      )
      .toBe(9);
    const project = await readProject(page);
    const room = project.rooms.find((entry) => entry.code === "B812")!;
    const wallCount = room.scene.objects.filter((object) => object.objectType === "wall").length;
    const assetIds = room.scene.objects.map((object) => object.assetDefinitionId);
    expect(room.width * room.depth).toBe(48_000_000);
    expect(wallCount).toBe(4);
    expect(assetIds.filter((id) => id === "office-desk")).toHaveLength(2);
    expect(assetIds.filter((id) => id === "office-chair")).toHaveLength(2);
    expect(assetIds.filter((id) => id === "tall-cabinet")).toHaveLength(1);
    return createTrial("furnish-office", "reviewed-webmcp", run, warmup, sequence, {
      milliseconds: performance.now() - started,
      uiActions: approvals,
      toolCalls,
      approvals,
      outcomeChecks: 5,
      outcomeChecksPassed: 5,
      errors,
    });
  } finally {
    await context.close();
  }
}

const taskRunners = {
  "locate-three-materials": { manual: manualLocate, webmcp: webmcpLocate },
  "add-five-inventory-items": { manual: manualInventory, webmcp: webmcpInventory },
  "furnish-office": { manual: manualOffice, webmcp: webmcpOffice },
} as const;

test("runs the counterbalanced same-seed productivity benchmark", async ({ browser }) => {
  test.slow();
  const trials: Trial[] = [];
  let sequence = 0;
  const taskIds = (Object.keys(taskRunners) as TaskId[]).filter(
    (taskId) => !requestedTask || taskId === requestedTask,
  );
  if (!taskIds.length) throw new Error(`Unknown LABSPACE_BENCHMARK_TASK: ${requestedTask}`);
  for (const taskId of taskIds) {
    const runners = taskRunners[taskId];
    for (let run = 0; run <= measuredRuns; run += 1) {
      const warmup = run === 0;
      const measuredRun = warmup ? 0 : run;
      const order =
        run % 2 === 0 ? (["webmcp", "manual"] as const) : (["manual", "webmcp"] as const);
      for (const method of order) {
        sequence += 1;
        const trial = await runners[method](browser, measuredRun, warmup, sequence);
        trials.push(trial);
        process.stdout.write(
          `\n[benchmark] ${taskId} · ${method} · ${warmup ? "warm-up" : `run ${run}`} · ${trial.milliseconds.toFixed(0)} ms\n`,
        );
      }
    }
  }
  const output = resolve("test-results/webmcp-benchmark-v2.json");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify(
      {
        benchmark: "LabSpace same-outcome UI and Reviewed WebMCP system benchmark v2",
        generatedAt: new Date().toISOString(),
        measuredRunsPerTaskAndMethod: measuredRuns,
        warmupRunsPerTaskAndMethod: 1,
        timingBoundary:
          "Prepared page to verified persisted outcome. Excludes page load, seed reset, language-model inference, and prompt composition.",
        caution:
          "These are automated browser execution times, not measured human completion times. UI actions, WebMCP calls, and approvals are reported separately.",
        trials,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
});
