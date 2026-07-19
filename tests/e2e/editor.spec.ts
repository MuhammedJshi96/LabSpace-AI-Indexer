import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { BUILD_WEEK_DEMO } from "../../src/domain/build-week-demo";
import {
  ROOM_809_DEPTH,
  ROOM_809_WIDTH,
  SHOWCASE_DEMO_ROOM_ID,
  STARTER_ROOM_ID,
} from "../../src/domain/seed";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  const response = await request.post("/api/testing/reset");
  expect(response.ok()).toBeTruthy();
});

test("the compact orientation cube exposes only distinct camera commands", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Empty lab plan", { exact: true })).toBeVisible();

  const orientation = page.getByRole("group", { name: "3D orientation" });
  await expect(orientation).toBeVisible();
  await expect(orientation.getByRole("button", { name: "Top view" })).toBeVisible();
  await expect(orientation.getByRole("button", { name: "Left view" })).toBeVisible();
  await expect(orientation.getByRole("button", { name: "Front view" })).toBeVisible();
  await expect(orientation.getByRole("button", { name: "Isometric view" })).toBeVisible();
  await expect(orientation.getByText(/\b(N|E|S|W)\b/)).toHaveCount(0);
  await expect(
    page.locator(".three-d-actions").getByRole("button", { name: /fullscreen/i }),
  ).toHaveCount(0);

  await orientation.getByRole("button", { name: "Top view" }).click();
  await expect(orientation.getByRole("button", { name: "Top view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await orientation.getByRole("button", { name: "Isometric view" }).click();
  await expect(orientation.getByRole("button", { name: "Isometric view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("application starts empty, opens the bundled showcase, and can create a lean demo copy", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByText("Empty lab plan", { exact: true })).toBeVisible();
  await expect(page.getByTestId("2d-editor")).toBeVisible();
  await expect(page.getByTestId("3d-view")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Room information" })).toBeVisible();

  let projectResponse = await request.get("/api/project");
  expect(projectResponse.ok()).toBeTruthy();
  let project = await projectResponse.json();
  expect(project.activeRoomId).toBe(STARTER_ROOM_ID);
  expect(
    project.rooms.find((entry: any) => entry.id === STARTER_ROOM_ID).scene.objects,
  ).toHaveLength(0);

  await page.getByTestId("demo-room-action").click();
  await expect(page.getByText("Build Week Demo", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Open saved Demo Room", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(async () => {
      projectResponse = await request.get("/api/project");
      project = await projectResponse.json();
      return project.activeRoomId;
    })
    .toBe(SHOWCASE_DEMO_ROOM_ID);

  const laboratory = project.laboratories.find((entry: any) =>
    entry.roomIds.includes(project.activeRoomId),
  );
  const room = project.rooms.find((entry: any) => entry.id === project.activeRoomId);
  expect(laboratory?.roomIds).toContain(room?.id);
  expect(room).toMatchObject({
    name: "Build Week Demo",
    code: "DEMO-01",
    roomKind: "demo",
    width: ROOM_809_WIDTH,
    depth: ROOM_809_DEPTH,
  });
  expect(room.scene.objects.filter((object: any) => object.objectType === "wall")).toHaveLength(12);
  expect(
    room.scene.objects.filter(
      (object: any) => !["wall", "door", "window"].includes(object.objectType),
    ),
  ).toHaveLength(30);
  expect(
    room.scene.objects.filter(
      (object: any) => object.assetDefinitionId === "rotary-evaporator",
    ),
  ).toHaveLength(1);
  expect(room.scene.layers.length).toBeGreaterThanOrEqual(9);
  await expect(page.getByRole("button", { name: /Demo kit \d+/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Curated \d+/ })).toHaveCount(0);
  await expect(page.getByText(/\d+ assets .* \d+ favorites/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Reset camera|Fit room/ })).toHaveCount(0);

  // The competition demo deliberately omits the optional ceiling/services profile.
  // Rooms that do not own a profile must not expose an inert context control.
  await expect(page.getByTestId("lab-environment-context-toggle")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("DEMO-01", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Open project workspace" }).click();
  await page.getByTestId("open-build-week-demo").click();
  await expect(page.getByText("DEMO-02", { exact: true }).first()).toBeVisible();
  project = await (await request.get("/api/project")).json();
  const leanDemo = project.rooms.find((entry: any) => entry.id === project.activeRoomId);
  expect(leanDemo.id).not.toBe(SHOWCASE_DEMO_ROOM_ID);
  expect(
    leanDemo.scene.objects.filter(
      (object: any) => !["wall", "door", "window"].includes(object.objectType),
    ),
  ).toHaveLength(12);
});

test("the 3D canvas renders real pixels and Asset Studio opens safely", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Loading laboratory materials…")).toBeHidden({ timeout: 10000 });
  const canvas = page.getByTestId("3d-view").locator("canvas");
  await expect(canvas).toBeVisible();
  const image = PNG.sync.read(await canvas.screenshot());
  const sampledColors = new Set<string>();
  let darkPixels = 0;
  for (let index = 0; index < image.data.length; index += 16) {
    const red = image.data[index];
    const green = image.data[index + 1];
    const blue = image.data[index + 2];
    sampledColors.add(`${red >> 4}-${green >> 4}-${blue >> 4}`);
    if (red + green + blue < 570) darkPixels += 1;
  }
  expect(sampledColors.size).toBeGreaterThan(20);
  expect(darkPixels).toBeGreaterThan(100);

  const authoredThumbnail = page
    .getByRole("article", { name: /Standard laboratory bench —/ })
    .locator("img")
    .first();
  await expect(authoredThumbnail).toHaveAttribute("data-render-source", "3d");
  await expect(authoredThumbnail).toHaveAttribute("src", /models\/hero\/renders\/lab-bench/);

  const studioLink = page.getByRole("link", { name: "Open Asset Studio" });
  await expect(studioLink).toHaveAttribute("target", "_blank");
  const popupPromise = page.waitForEvent("popup");
  await studioLink.click();
  const studio = await popupPromise;
  await expect(studio.getByRole("heading", { name: /PBR Asset Studio/ })).toBeVisible();
  await studio.close();
  await expect(page.getByTestId("2d-editor")).toBeVisible();
});

test("the Digital Twin links indexed search results to the live room and editor", async ({
  page,
}) => {
  await page.goto("/digital-twin");
  await expect(page.getByTestId("digital-twin-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nitrile gloves, M" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Nitrile gloves, M evidence image" })).toHaveAttribute(
    "src",
    "/images/inventory/nitrile-gloves.png",
  );
  await expect(page.getByTestId("3d-view").locator("canvas")).toBeVisible();
  await expect(page.getByText("Stable indexed identity", { exact: true })).toBeVisible();

  const search = page.getByRole("textbox", {
    name: "Ask LabSpace or search indexed records",
  });
  await search.fill("Reference standards");
  await expect(page.getByTestId("digital-twin-record")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Reference standards" })).toBeVisible();
  const detail = page.getByRole("complementary", { name: "Selected record details" });
  await expect(detail.getByText("Analysis island storage", { exact: true })).toBeVisible();
  await expect(detail.getByText("Sample bin 01", { exact: true })).toBeVisible();
  await expect(
    detail.getByRole("img", { name: "Reference standards evidence image" }),
  ).toHaveAttribute("src", "/images/inventory/reference-standards.png");
  await expect(page.getByTestId("3d-view")).toHaveAttribute(
    "data-focus-location-id",
    "storage-location-0023",
  );

  await search.fill("HPLC autosampler vials");
  await expect(page.getByTestId("digital-twin-record")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "HPLC autosampler vials, 2 mL" })).toBeVisible();
  await expect(
    detail.getByRole("img", { name: "HPLC autosampler vials, 2 mL evidence image" }),
  ).toHaveAttribute("src", "/images/inventory/hplc-vials.png");

  await search.fill("Reference standards");

  await page.getByRole("button", { name: "Navigate to location" }).click();
  await expect(page.getByTestId("3d-view")).toHaveAttribute(
    "data-focus-object-id",
    /^[0-9a-f-]{36}$/,
  );
  await expect(page.getByTestId("3d-view")).toHaveAttribute(
    "data-focus-location-id",
    "storage-location-0023",
  );

  await page.getByRole("button", { name: "2D fallback" }).click();
  await expect(page.getByTestId("2d-editor")).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to 3D" })).toBeVisible();
  await page.getByRole("button", { name: "Return to 3D" }).click();
  await expect(page.getByTestId("3d-view").locator("canvas")).toBeVisible();

  const editorLink = page.getByRole("link", { name: "Open record in editor" });
  await expect(editorLink).toHaveAttribute("href", /object=.*panel=properties/);
  await editorLink.click();
  await expect(page.locator(".selection-trace-card")).toContainText("LAB-R809-Z02-CAB-001");
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  await expect(page.getByRole("link", { name: "Open Digital Twin" })).toBeVisible();
});

test("project search switches to a record in another laboratory and preserves the editor trace", async ({
  page,
  request,
}) => {
  const resetBeforeHandoff = await request.post("/api/testing/reset");
  expect(resetBeforeHandoff.ok()).toBeTruthy();
  const project = await (await request.get("/api/project")).json();
  const sourceRoom = project.rooms.find((entry: any) => entry.id === BUILD_WEEK_DEMO.roomId);
  project.activeRoomId = sourceRoom.id;
  const annex = structuredClone(sourceRoom);
  annex.id = "room-annex-0001";
  annex.laboratoryId = "laboratory-annex-0001";
  annex.name = "Instrument Annex";
  annex.code = "ANNEX-12";
  annex.roomKind = "standard";
  annex.demoSavedAt = null;
  annex.scene.id = "scene-annex-0001";
  annex.scene.roomId = annex.id;
  annex.scene.objects = annex.scene.objects.map((object: any) => ({
    ...object,
    roomId: annex.id,
  }));
  annex.scene.zones = annex.scene.zones.map((zone: any) => ({ ...zone, roomId: annex.id }));
  annex.scene.storageLocations = annex.scene.storageLocations.map((location: any) => ({
    ...location,
    roomId: annex.id,
  }));
  annex.scene.inventoryItems[0] = {
    ...annex.scene.inventoryItems[0],
    name: "Cross-room calibration tracer",
  };
  project.laboratories.push({
    id: annex.laboratoryId,
    projectId: project.id,
    name: "Analytical Instrument Core",
    code: "AIC-02",
    roomIds: [annex.id],
  });
  project.rooms.push(annex);

  try {
    const saved = await request.put(`/api/project/${project.id}`, { data: project });
    expect(saved.ok()).toBeTruthy();

    await page.goto("/digital-twin");
    await expect(page.getByText("3 labs · 3 rooms", { exact: true })).toBeVisible();
    await page
      .getByRole("textbox", { name: "Ask LabSpace or search indexed records" })
      .fill("Cross-room calibration tracer");
    await expect(page.getByTestId("digital-twin-record")).toHaveCount(1);
    await expect(page.getByText("AIC-02 / ANNEX-12", { exact: true })).toBeVisible();
    await expect(page.getByText("Instrument Annex", { exact: true }).first()).toBeVisible();

    const editorLink = page.getByRole("link", { name: "Open record in editor" });
    await expect(editorLink).toHaveAttribute("href", /room=room-annex-0001/);
    await editorLink.click();
    await expect(page.getByText("Instrument Annex", { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    await expect(page.locator(".selection-trace-card")).toContainText("LAB-R809-Z01-CAB-001");
  } finally {
    await page.close();
    const reset = await request.post("/api/testing/reset");
    expect(reset.ok()).toBeTruthy();
  }
});

test("the split divider resizes with keyboard controls", async ({ page }) => {
  await page.goto("/");
  const workspace = page.locator(".workspace-surface");
  const divider = page.getByRole("separator", { name: "Resize 2D and 3D views" });
  const before = await workspace.evaluate((element) =>
    element.style.getPropertyValue("--split-plan-basis"),
  );
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  const after = await workspace.evaluate((element) =>
    element.style.getPropertyValue("--split-plan-basis"),
  );
  expect(after).not.toBe(before);
  await divider.dblclick({ force: true });
  await expect(divider).toHaveAttribute("aria-valuenow", "57");
});

test("an asset can be dragged in, moved, resized, and synchronized", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("article", { name: /Standard laboratory bench —/ });
  const editor = page.getByTestId("2d-editor");
  await card.dragTo(editor, { targetPosition: { x: 380, y: 360 } });
  await expect(page.getByRole("heading", { name: "Standard laboratory bench" })).toBeVisible();
  await expect(page.locator(".selection-trace-card")).toContainText("Standard laboratory bench");
  await expect(page.locator(".spatial-model-loading")).toBeHidden({ timeout: 15000 });

  const xInput = page.getByRole("spinbutton", { name: "X mm" });
  const xBefore = Number(await xInput.inputValue());
  const cameraCommandBeforeDrag = await page
    .getByTestId("3d-view")
    .getAttribute("data-camera-command-key");
  const box = await editor.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 150, box!.y + 150);
  const fixedPointBefore = await page.locator(".canvas-coordinates").innerText();
  await page.mouse.move(box!.x + 380, box!.y + 360);
  await page.mouse.down();
  await page.mouse.move(box!.x + 430, box!.y + 390);
  await page.mouse.up();
  const xAfter = Number(await xInput.inputValue());
  const yAfter = Number(await page.getByRole("spinbutton", { name: "Y mm" }).inputValue());
  expect(xAfter).not.toBe(xBefore);
  expect(xAfter).toBeGreaterThan(0);
  expect(yAfter).toBeGreaterThan(0);
  await page.mouse.move(box!.x + 150, box!.y + 150);
  await expect(page.locator(".canvas-coordinates")).toHaveText(fixedPointBefore);
  await expect(page.getByTestId("3d-view")).toHaveAttribute(
    "data-camera-command-key",
    cameraCommandBeforeDrag!,
  );

  await page.getByRole("spinbutton", { name: "Width mm" }).fill("2100");
  await expect(page.getByRole("spinbutton", { name: "Width mm" })).toHaveValue("2100");
  const cameraCommandBeforeMove = await page
    .getByTestId("3d-view")
    .getAttribute("data-camera-command-key");
  await page.getByRole("spinbutton", { name: "X mm" }).fill(String(xAfter + 120));
  await expect(page.getByRole("spinbutton", { name: "X mm" })).toHaveValue(String(xAfter + 120));
  await expect(page.getByTestId("3d-view")).toHaveAttribute(
    "data-camera-command-key",
    cameraCommandBeforeMove!,
  );
  await expect(page.locator(".status-bar .save-ok")).toContainText("Saved", { timeout: 5000 });
});

test("a cabinet receives indexed internals and exact inventory", async ({ page, request }) => {
  await page.goto("/");
  // This workflow exercises storage/index state only. Keeping the software-rendered
  // WebGL pane mounted makes the role-heavy inventory dialog unnecessarily slow.
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByRole("article", { name: /Base cabinet —/ }).dblclick();
  await expect(page.getByText("Storage configuration", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Shelf", exact: true }).click();
  await page.getByRole("button", { name: "Drawer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2 internal locations" })).toBeVisible();
  await page.getByRole("button", { name: "Open index" }).click();
  await page.waitForTimeout(1100);

  const project = await (await request.get("/api/project")).json();
  const room = project.rooms.find((entry: any) => entry.id === project.activeRoomId);
  const selectedObjectId = room.scene.objects.at(-1).id;
  const drawer = room.scene.storageLocations.find(
    (entry: any) => entry.objectId === selectedObjectId && entry.type === "drawer",
  );
  await page
    .getByRole("button", { name: `${drawer.name} ${drawer.indexCode} Empty`, exact: true })
    .click();
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("heading", { name: /inventory items/ })).toBeVisible();
  await expect(page.getByRole("combobox").last()).toHaveValue(drawer.id);

  const codes = room.scene.storageLocations.map((entry: any) => entry.indexCode);
  expect(new Set(codes).size).toBe(codes.length);
});

test("undo, redo, layer visibility, versions, persistence, and exports work", async ({ page }) => {
  await page.goto("/");
  // This workflow validates editor state and file exports, not 3D rendering.
  // Unmounting the software-rendered WebGL pane keeps its long sequence of
  // history actions, dialogs, and reload within the test budget.
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.getByTestId("3d-view")).toHaveCount(0);
  await page.getByRole("article", { name: /Office chair —/ }).dblclick();
  await expect(page.getByRole("heading", { name: "Office chair" })).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("heading", { name: "Office chair" })).toBeHidden();
  await page.keyboard.press("Control+y");
  await expect(page.getByRole("heading", { name: "Office chair" })).toBeVisible();

  await page.getByRole("tab", { name: "Layers" }).click();
  const furnitureRow = page
    .locator(".layer-row")
    .filter({ has: page.getByRole("textbox", { name: "Rename Furniture" }) });
  await furnitureRow.getByTitle("Hide layer").click();
  await expect(furnitureRow).toHaveClass(/muted/);
  await furnitureRow.getByTitle("Show layer").click();

  await page.getByRole("button", { name: "Save room version" }).click();
  await page.getByRole("textbox", { name: "Version name" }).fill("Playwright verified");
  await page.getByRole("button", { name: "Save version", exact: true }).click();

  await page.reload();
  await expect(page.getByText("Empty lab plan", { exact: true })).toBeVisible();
  await expect(page.locator(".status-bar .save-ok")).toBeVisible();

  await page.getByRole("button", { name: "Open project menu" }).click();
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export project/ }).click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);

  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Reports" }).click();
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Storage-location register/ }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/location-register\.csv$/);
});

test("2D, split, and 3D presentation modes remain mounted", async ({ page }) => {
  await page.request.post("/api/testing/reset");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");

  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.getByTestId("3d-view")).toBeVisible();
  const threeDBounds = await page.getByTestId("3d-view").boundingBox();
  expect(threeDBounds?.width).toBeGreaterThan(700);
  expect(threeDBounds?.height).toBeGreaterThan(300);

  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.getByTestId("2d-editor")).toBeVisible();
  await expect(page.getByTestId("3d-view")).toHaveCount(0);

  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect(page.getByTestId("2d-editor")).toBeVisible();
  await expect(page.getByTestId("3d-view")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("a completed autosave never overwrites newer 2D edits", async ({ page, request }) => {
  await request.post("/api/testing/reset");
  let releaseFirstSave!: () => void;
  let markFirstSaveStarted!: () => void;
  const firstSaveGate = new Promise<void>((resolve) => {
    releaseFirstSave = resolve;
  });
  const firstSaveStarted = new Promise<void>((resolve) => {
    markFirstSaveStarted = resolve;
  });
  let heldFirstSave = false;

  await page.route("**/api/project/*", async (route) => {
    if (route.request().method() === "PUT" && !heldFirstSave) {
      heldFirstSave = true;
      markFirstSaveStarted();
      await firstSaveGate;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("article", { name: /Mobile bench —/ }).dblclick();
  await firstSaveStarted;
  await page.getByRole("article", { name: /Vacuum pump —/ }).dblclick();
  await expect(page.getByRole("heading", { name: "Vacuum pump" })).toBeVisible();

  releaseFirstSave();
  await expect(page.locator(".status-bar .save-ok")).toContainText("Saved", { timeout: 10000 });
  await expect(page.getByRole("heading", { name: "Vacuum pump" })).toBeVisible();
  await expect(page.getByTestId("2d-editor")).toBeVisible();

  const savedProject = await (await request.get("/api/project")).json();
  const savedRoom = savedProject.rooms.find(
    (room: { id: string }) => room.id === savedProject.activeRoomId,
  );
  const savedNames = savedRoom.scene.objects.map((object: { name: string }) => object.name);
  expect(savedNames).toContain("Mobile bench");
  expect(savedNames).toContain("Vacuum pump");
});

test("principal editor screenshots render without clipping", async ({ page }) => {
  await page.request.post("/api/testing/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("demo-room-action").click();
  await expect(page.getByText("Build Week Demo", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.waitForTimeout(900);

  const assertReadableLayout = async () => {
    const metrics = await page.evaluate(() => {
      const textElements = Array.from(document.querySelectorAll("body *")).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const hasOwnText = Array.from(element.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0,
        );
        return (
          hasOwnText &&
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      });
      return {
        minimumFontSize: Math.min(
          ...textElements
            .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
            .filter((fontSize) => Number.isFinite(fontSize) && fontSize > 0),
        ),
        bodyOverflowsHorizontally: document.body.scrollWidth > document.body.clientWidth,
        workspaceOverflowsHorizontally: Array.from(
          document.querySelectorAll(".app-shell, .editor-main, .workspace-surface, .spatial-pane"),
        ).some((element) => element.scrollWidth > element.clientWidth + 1),
      };
    });
    // Eleven pixels is reserved for genuinely tertiary technical annotations;
    // normal controls and body copy remain at the 12–14 px product standard.
    expect(metrics.minimumFontSize).toBeGreaterThanOrEqual(11);
    expect(metrics.bodyOverflowsHorizontally).toBe(false);
    expect(metrics.workspaceOverflowsHorizontally).toBe(false);
  };

  await assertReadableLayout();
  await page.screenshot({ path: "docs/screenshots/editor-1440x900.png" });

  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByTestId("3d-view")).toBeVisible();
  const wallToggle = page.getByRole("button", { name: /Make walls transparent|Show solid walls/ });
  if ((await wallToggle.getAttribute("class"))?.includes("active") !== true) {
    await wallToggle.click();
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "docs/screenshots/room809-authored-3d-1440x900.png" });

  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  await page.waitForTimeout(900);
  await assertReadableLayout();
  await page.screenshot({ path: "docs/screenshots/editor-1920x1080.png" });
});

test("the asset browser frames both large equipment and small instruments", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/asset-preview?asset=compound-microscope");
  await expect(page.getByRole("heading", { name: "Compound microscope" })).toBeVisible();
  await expect(page.locator(".asset-preview-canvas canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Curated 15", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".asset-preview-count")).toContainText("16 loaded · 96 validated");
  await expect(page.locator(".asset-preview-details")).toContainText("300 × 420 × 480 mm");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: "docs/screenshots/asset-microscope-1440x900.png" });

  await page.goto("/asset-preview?asset=fume-hood");
  await expect(page.getByRole("heading", { name: "Fume hood" })).toBeVisible();
  await expect(page.locator(".asset-preview-details")).toContainText("1500 × 850 × 2400 mm");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "docs/screenshots/asset-fume-hood-1440x900.png" });
});
