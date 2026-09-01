import { expect, test, type Page } from "@playwright/test";
import type { Project } from "../../src/domain/schema";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { StorageAnatomyLocation } from "../../src/domain/storage-access";

test.use({ actionTimeout: 10_000 });

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/testing/reset")).ok()).toBeTruthy();
});

async function openInventory(page: Page) {
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory Studio" })).toBeVisible();
  await expect(page.getByTitle("All changes saved", { exact: true })).toBeVisible();
}

test("bulk assignment uses named storage and preserves records through Undo, Redo and reload", async ({
  page,
  request,
}) => {
  await openInventory(page);
  const before: Project = await (await request.get("/api/project")).json();
  const demo = before.rooms.find(
    (room) => room.code === "DEMO-01" && room.roomKind !== "demo-template",
  )!;
  const root = demo.scene.storageLocations.find(
    (location) => location.name === "Wall cabinet" && !location.parentId,
  )!;
  const shelf = demo.scene.storageLocations.find(
    (location) => location.parentId === root.id && location.name === "Shelf 01",
  )!;
  const source = before.rooms.find((room) => room.code === "CHR-A")!;
  const sourceItem = source.scene.inventoryItems.find(
    (item) => item.name === "Autosampler vial caps, blue",
  )!;
  const tips = demo.scene.inventoryItems.find((item) => item.name === "Pipette tips, 200 µL")!;

  await page.getByRole("button", { name: "Assign inventory", exact: true }).click();
  const dialog = page.getByRole("region", { name: "Storage workspace", exact: true });
  await dialog.getByRole("button", { name: "Choose cabinet", exact: true }).click();
  await dialog.getByLabel("Location filter").selectOption(demo.id);
  await dialog.getByRole("button", { name: "Manage Wall cabinet in DEMO-01", exact: true }).click();
  await dialog
    .getByRole("checkbox", { name: "Select Autosampler vial caps, blue in CHR-A" })
    .check();
  await dialog.getByRole("checkbox", { name: "Select Pipette tips, 200 µL in DEMO-01" }).check();
  await dialog.getByLabel("Storage location").selectOption(shelf.id);
  await dialog.getByRole("button", { name: "Place 2 items here", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Place 2 items here", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  const read = async () => (await (await request.get("/api/project")).json()) as Project;
  await expect
    .poll(
      async () =>
        (await read()).rooms
          .find((room) => room.id === demo.id)!
          .scene.inventoryItems.find((item) => item.id === sourceItem.id)?.storageLocationId,
    )
    .toBe(shelf.id);
  const assigned = await read();
  expect(assigned.activeRoomId).toBe(before.activeRoomId);
  expect(assigned.rooms.flatMap((room) => room.scene.inventoryItems)).toHaveLength(
    before.rooms.flatMap((room) => room.scene.inventoryItems).length,
  );
  expect(
    assigned.rooms
      .find((room) => room.id === demo.id)!
      .scene.inventoryItems.find((item) => item.id === sourceItem.id),
  ).toMatchObject({ ...sourceItem, storageLocationId: shelf.id, updatedAt: expect.any(String) });
  expect(assigned.rooms.find((room) => room.id === demo.id)!.scene.objects).toEqual(
    demo.scene.objects,
  );

  await page.getByRole("button", { name: /^Undo last (storage )?change$/ }).click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await read()).rooms
          .find((room) => room.id === source.id)!
          .scene.inventoryItems.find((item) => item.id === sourceItem.id)?.storageLocationId,
    )
    .toBe(sourceItem.storageLocationId);
  expect(
    (await read()).rooms
      .find((room) => room.id === demo.id)!
      .scene.inventoryItems.find((item) => item.id === tips.id)?.storageLocationId,
  ).toBe(tips.storageLocationId);
  await page.getByRole("button", { name: /^Redo last (storage )?change$/ }).click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await read()).rooms
          .find((room) => room.id === demo.id)!
          .scene.inventoryItems.find((item) => item.id === sourceItem.id)?.storageLocationId,
    )
    .toBe(shelf.id);
  await page.reload();
  await page.getByRole("tab", { name: "Inventory", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Inventory records" }).getByRole("button", {
      name: /Autosampler vial caps, blue.*DEMO-01.*Wall cabinet.*Shelf 01/,
    }),
  ).toBeVisible();
});

test("cabinet and shelf naming is discoverable, keyboard-accessible and persists without changing IDs", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1078, height: 912 });
  await openInventory(page);
  const before: Project = await (await request.get("/api/project")).json();
  const demo = before.rooms.find(
    (room) => room.code === "DEMO-01" && room.roomKind !== "demo-template",
  )!;
  const root = demo.scene.storageLocations.find(
    (location) => location.name === "Wall cabinet" && !location.parentId,
  )!;
  const shelf = demo.scene.storageLocations.find(
    (location) => location.parentId === root.id && location.name === "Shelf 01",
  )!;
  await page.getByRole("tab", { name: "Storage", exact: true }).click();
  const names = page.getByRole("region", { name: "Storage workspace", exact: true });
  await names.getByRole("button", { name: "Choose cabinet", exact: true }).click();
  await names.getByLabel("Location filter", { exact: true }).selectOption(demo.id);
  await names.getByRole("button", { name: "Manage Wall cabinet in DEMO-01", exact: true }).click();
  await names.getByRole("button", { name: "Rename cabinet", exact: true }).click();
  const rename = page.getByRole("form", { name: "Rename cabinet", exact: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rename.getByLabel("Storage name")).toBeFocused();
  expect((await rename.boundingBox())!.height).toBeLessThan(500);
  await rename.getByLabel("Storage name").fill("Laboratory bench with overhead cabinets");
  await rename.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(names.getByRole("button", { name: "Rename cabinet", exact: true })).toBeFocused();
  await names.getByLabel("Storage location").selectOption(shelf.id);
  await names.getByRole("button", { name: "Rename shelf", exact: true }).click();
  const renameShelf = page.getByRole("form", { name: "Rename shelf", exact: true });
  await renameShelf.getByLabel("Storage name").fill("Daily supplies");
  await renameShelf.getByLabel("Storage name").press("Enter");
  await expect(names.getByRole("region", { name: "Selected storage contents" })).toContainText(
    "Daily supplies",
  );
  const frame = names.locator(".storage-context-model");
  const thumbnail = frame.locator("img");
  await expect(thumbnail).toBeVisible();
  expect((await thumbnail.boundingBox())!.height).toBeLessThanOrEqual(
    (await frame.boundingBox())!.height,
  );
  await page.getByRole("tab", { name: "Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect
    .poll(async () => {
      const saved: Project = await (await request.get("/api/project")).json();
      return saved.rooms
        .find((room) => room.id === demo.id)!
        .scene.storageLocations.find((location) => location.id === shelf.id)?.name;
    })
    .toBe("Daily supplies");
  const saved: Project = await (await request.get("/api/project")).json();
  const room = saved.rooms.find((entry) => entry.id === demo.id)!;
  expect(room.scene.inventoryItems).toEqual(demo.scene.inventoryItems);
  expect(room.scene.storageLocations.find((location) => location.id === shelf.id)).toMatchObject({
    ...shelf,
    name: "Daily supplies",
    updatedAt: expect.any(String),
  });
  expect(room.scene.objects.find((object) => object.id === root.objectId)?.name).toBe(
    "Laboratory bench with overhead cabinets",
  );
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Inventory records" }).getByRole("button", {
      name: /Reference standards.*Laboratory bench with overhead cabinets.*Daily supplies/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assign inventory", exact: true }).click();
  await page.getByRole("button", { name: "Choose cabinet", exact: true }).click();
  await page.getByLabel("Location filter", { exact: true }).selectOption(demo.id);
  const longBench = page.getByRole("button", {
    name: "Manage Laboratory bench with overhead cabinets in DEMO-01",
    exact: true,
  });
  await expect(longBench).toContainText("Lab bench · overhead cabinets");
  await expect(longBench).toHaveAttribute(
    "title",
    "Laboratory bench with overhead cabinets · Build Week Demo · DEMO-01",
  );
  await page.getByLabel("Search storage").press("Escape");
  await expect(page.getByRole("region", { name: "Choose a cabinet", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose cabinet", exact: true })).toBeFocused();
});

test("the Storage inspector opens the full workspace at the selected shelf and preserves the layout on return", async ({
  page,
  request,
}) => {
  test.setTimeout(30_000);
  const project: Project = await (await request.get("/api/project")).json();
  const room = project.rooms.find(
    (entry) => entry.code === "DEMO-01" && entry.roomKind !== "demo-template",
  )!;
  const root = room.scene.storageLocations.find(
    (location) => location.name === "Wall cabinet" && !location.parentId,
  )!;
  const shelf = room.scene.storageLocations.find(
    (location) => location.parentId === root.id && location.name === "Shelf 01",
  )!;
  project.activeRoomId = room.id;
  room.viewState = {
    cameraPreset: "isometric",
    presentation: "2d",
    floorVisible: true,
    wallTransparent: false,
    environmentContextVisible: false,
    cameraPose: null,
  };
  expect((await request.put(`/api/project/${project.id}`, { data: project })).ok()).toBeTruthy();
  await page.goto(`/?room=${room.id}&object=${root.objectId}&location=${shelf.id}&panel=index`);
  await expect(page.getByTitle("All changes saved", { exact: true })).toBeVisible();
  await page
    .getByRole("region", { name: "Room inspector", exact: true })
    .getByRole("tab", { name: "Storage", exact: true })
    .click();
  await page.getByRole("button", { name: "Manage storage", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Storage workspace", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected storage contents" })).toContainText(
    shelf.name,
  );
  await page.getByText("Advanced details", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Index code", exact: true })).toHaveValue(
    shelf.indexCode,
  );
  await page.getByText("Advanced details", { exact: true }).click();
  await expect(page.getByLabel("Storage location")).toHaveValue(shelf.id);
  await page
    .getByRole("checkbox", { name: "Select Reference standards in DEMO-01", exact: true })
    .check();
  await expect(page.getByRole("button", { name: "Place item here", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await page.getByRole("button", { name: "Rename shelf", exact: true }).click();
  const rename = page.getByRole("form", { name: "Rename shelf", exact: true });
  await expect(rename.getByLabel("Storage name")).toHaveValue("Shelf 01");
  await rename.getByLabel("Storage name").fill("Cancelled name");
  await rename.getByLabel("Storage name").press("Escape");
  await expect(rename).toHaveCount(0);
  await page.getByRole("button", { name: "Back to layout", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".storage-inspector-summary")).toContainText(shelf.name);
  await expect(page.getByRole("region", { name: "2D laboratory plan" })).toBeVisible();
  const after: Project = await (await request.get("/api/project")).json();
  expect(after.rooms.find((entry) => entry.id === room.id)!.scene.storageLocations).toEqual(
    room.scene.storageLocations,
  );
  expect(after.rooms.find((entry) => entry.id === room.id)!.scene.inventoryItems).toEqual(
    room.scene.inventoryItems,
  );
  expect(after.activeRoomId).toBe(room.id);
  expect(after.rooms.find((entry) => entry.id === room.id)!.viewState).toEqual(room.viewState);
  await page.getByRole("button", { name: "Manage storage", exact: true }).click();
  await page.getByText("Advanced details", { exact: true }).click();
  await page.getByRole("button", { name: "Label preview in layout", exact: true }).click();
  const labels = page.getByRole("dialog", { name: "Location label preview" });
  await expect(labels).toBeVisible();
  await expect(labels.locator(".label-sheet")).toContainText(shelf.indexCode);
});

test("row selection feeds the physical map and commits the exact shelf without changing stock or geometry", async ({
  page,
  request,
}) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const project: Project = await (await request.get("/api/project")).json();
  const room = project.rooms.find(
    (entry) => entry.code === "DEMO-01" && entry.roomKind !== "demo-template",
  )!;
  const cabinet = room.scene.objects.find((object) => object.assetDefinitionId === "wall-cabinet")!;
  // The isolated E2E fixture explicitly binds this known cabinet to its authored
  // anatomy; the production chooser itself must never create or infer bindings.
  const root = room.scene.storageLocations.find(
    (location) => location.objectId === cabinet.id && !location.parentId,
  )!;
  const rigs = JSON.parse(
    readFileSync(new URL("../../src/domain/storage-rigs.json", import.meta.url), "utf8"),
  ) as Record<string, { locations: StorageAnatomyLocation[] }>;
  const ids = new Map<string, string>();
  for (const slot of rigs[cabinet.assetDefinitionId].locations) {
    const existing = room.scene.storageLocations.find(
      (location) =>
        location.objectId === cabinet.id &&
        location.type === slot.type &&
        location.name === slot.name,
    );
    if (existing) {
      existing.anatomyKey = slot.key;
      ids.set(slot.key, existing.id);
      continue;
    }
    const id = randomUUID();
    const parentId = slot.parentKey ? ids.get(slot.parentKey)! : root.id;
    room.scene.storageLocations.push({
      id,
      objectId: cabinet.id,
      roomId: room.id,
      parentId,
      type: slot.type,
      name: slot.name,
      anatomyKey: slot.key,
      indexCode: `${root.indexCode}-TEST-${ids.size + 1}`,
      order: ids.size,
      capacityNotes: "",
      childIds: [],
      createdAt: root.createdAt,
      updatedAt: root.updatedAt,
    });
    room.scene.storageLocations.find((location) => location.id === parentId)!.childIds.push(id);
    ids.set(slot.key, id);
  }
  const destination = room.scene.storageLocations.find(
    (location) => location.objectId === cabinet.id && location.name === "Shelf 02",
  )!;
  const custom = {
    ...destination,
    id: "custom-visual-test-bin",
    parentId: root.id,
    name: "Hand-labelled box",
    type: "bin" as const,
    anatomyKey: undefined,
    indexCode: `${root.indexCode}-BIN-99`,
    childIds: [],
  };
  room.scene.storageLocations.push(custom);
  root.childIds.push(custom.id);
  project.activeRoomId = room.id;
  expect((await request.put(`/api/project/${project.id}`, { data: project })).ok()).toBeTruthy();
  await openInventory(page);
  const records = page.getByRole("region", { name: "Inventory records" });
  await records.getByRole("checkbox", { name: "Select Reference standards in DEMO-01" }).check();
  await records.getByRole("checkbox", { name: "Select Pipette tips, 200 µL in DEMO-01" }).check();
  await page.getByRole("textbox", { name: "Search inventory", exact: true }).fill("No such record");
  await expect(records.getByText("2 hidden by filters", { exact: true })).toBeVisible();
  await records.getByRole("button", { name: "Assign selected (2)" }).click();
  const dialog = page.getByRole("region", { name: "Storage workspace", exact: true });
  await expect(
    dialog.getByRole("checkbox", { name: "Select Reference standards in DEMO-01" }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "Select Pipette tips, 200 µL in DEMO-01" }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Choose cabinet", exact: true }).click();
  await dialog.getByRole("button", { name: "Manage Wall cabinet in DEMO-01", exact: true }).click();
  const map = dialog.getByRole("region", { name: "Visual storage picker" });
  await expect(map.getByText(/saved locations are not linked to model geometry/)).toBeVisible();
  await expect(
    map.getByRole("button", { name: "Select Hand-labelled box on storage map" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("combobox", { name: "Storage location", exact: true }),
  ).toBeVisible();
  await map
    .getByRole("button", { name: "Select Wall cabinet on storage map", exact: true })
    .press("Enter");
  await expect(
    map.getByRole("button", { name: "Select Shelf 01 on storage map", exact: true }),
  ).toBeFocused();
  await map.getByRole("button", { name: "Select Shelf 02 on storage map", exact: true }).click();
  await expect(
    map.getByRole("button", { name: "Select Shelf 02 on storage map", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByLabel("Storage location")).toHaveValue(destination.id);
  await dialog.getByRole("button", { name: "Rename shelf", exact: true }).click();
  const rename = dialog.getByRole("form", { name: "Rename shelf", exact: true });
  await rename.getByLabel("Storage name").fill("Do not save this");
  await rename.getByLabel("Storage name").press("Escape");
  await expect(rename).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("direct-placement-desktop.png") });
  // Real native drag: all checked records move together to the exact mapped shelf.
  await dialog
    .getByRole("article", { name: "Drag Reference standards from DEMO-01", exact: true })
    .dragTo(map.getByRole("button", { name: "Select Shelf 02 on storage map", exact: true }));
  await expect(dialog.getByRole("button", { name: "Place 2 items here", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  const read = async () => (await (await request.get("/api/project")).json()) as Project;
  const targets = room.scene.inventoryItems.filter((item) =>
    ["Reference standards", "Pipette tips, 200 µL"].includes(item.name),
  );
  await expect
    .poll(async () =>
      (await read()).rooms
        .find((entry) => entry.id === room.id)!
        .scene.inventoryItems.filter((item) => targets.some((target) => target.id === item.id))
        .map((item) => item.storageLocationId),
    )
    .toEqual(targets.map(() => destination.id));
  const saved = await read();
  const result = saved.rooms.find((entry) => entry.id === room.id)!;
  expect(result.scene.objects).toEqual(room.scene.objects);
  expect(result.scene.storageLocations).toEqual(room.scene.storageLocations);
  for (const item of targets)
    expect(result.scene.inventoryItems.find((entry) => entry.id === item.id)).toMatchObject({
      ...item,
      storageLocationId: destination.id,
      updatedAt: expect.any(String),
    });
  await page.getByRole("tab", { name: "Inventory", exact: true }).click();
  await page.getByRole("textbox", { name: "Search inventory", exact: true }).fill("");
  await expect(
    records.getByRole("button", { name: /Reference standards.*Shelf 02.*12 vials/ }),
  ).toBeVisible();
});

test("inventory stock, bulk controls and inline naming remain usable at compact widths", async ({
  page,
  request,
}) => {
  test.setTimeout(30_000);
  await openInventory(page);
  const before: Project = await (await request.get("/api/project")).json();
  const records = page.getByRole("region", { name: "Inventory records" });
  for (const width of [1078, 390]) {
    await page.setViewportSize({ width, height: 912 });
    const first = records.locator(".inventory-registry-row").first();
    await expect(first.locator(".inventory-stock")).toBeVisible();
    await expect(first.locator(".inventory-stock small")).not.toBeEmpty();
    const rowBox = (await first.boundingBox())!;
    const stockBox = (await first.locator(".inventory-stock").boundingBox())!;
    expect(stockBox.x).toBeGreaterThanOrEqual(rowBox.x);
    expect(stockBox.x + stockBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      )
      .toBe(true);
    await records.getByRole("checkbox", { name: "Select all matching inventory" }).check();
    await expect(records.getByRole("button", { name: /Assign selected \(/ })).toBeVisible();
    await records.getByRole("button", { name: "Clear selection", exact: true }).click();
    await page.screenshot({ path: test.info().outputPath(`inventory-${width}.png`) });
  }
  await records.getByRole("button", { name: /Reference standards.*Shelf 01/ }).click();
  await page.getByRole("button", { name: "Manage this storage", exact: true }).click();
  const names = page.getByRole("region", { name: "Storage workspace", exact: true });
  await names.getByRole("button", { name: "Rename shelf", exact: true }).click();
  const form = names.getByRole("form", { name: "Rename shelf", exact: true });
  await form.getByLabel("Storage name").fill("Temporary label");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(names).toBeVisible();
  const bounds = (await names.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath("storage-names-mobile.png") });
  await page.getByRole("tab", { name: "Inventory", exact: true }).click();
  const after: Project = await (await request.get("/api/project")).json();
  expect(after.rooms).toEqual(before.rooms);
});

test("full storage workspace creates inventory at an exact location without switching the editor room", async ({
  page,
  request,
}) => {
  await openInventory(page);
  const before: Project = await (await request.get("/api/project")).json();
  const room = before.rooms.find((entry) => entry.code === "CHR-A")!;
  const drawer = room.scene.storageLocations.find((entry) => entry.name === "Drawer 01")!;
  await page.getByRole("tab", { name: "Storage", exact: true }).click();
  await page.getByRole("button", { name: "Choose cabinet", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage Chromatography consumables cabinet in CHR-A" })
    .click();
  await page.getByLabel("Storage location").selectOption(drawer.id);
  const detail = page.getByRole("region", { name: "Selected storage contents" });
  await detail.getByRole("button", { name: "Add item", exact: true }).click();
  const form = detail.getByRole("form", { name: "New item at this location" });
  await form.getByLabel("Item name").fill("Storage workspace test vials");
  await form.getByLabel("Quantity").fill("6");
  await form.getByLabel("Unit", { exact: true }).fill("boxes");
  await form.getByRole("button", { name: "Create item here" }).click();
  await expect(
    detail.getByRole("button", { name: "Storage workspace test vials", exact: true }),
  ).toBeVisible();
  await expect(detail.getByRole("region", { name: "Assigned inventory" })).toContainText("6 boxes");
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect(page.getByTitle("All changes saved", { exact: true })).toBeVisible();
  const after: Project = await (await request.get("/api/project")).json();
  expect(after.activeRoomId).toBe(before.activeRoomId);
  const updated = after.rooms.find((entry) => entry.id === room.id)!;
  expect(
    updated.scene.inventoryItems.find((item) => item.name === "Storage workspace test vials"),
  ).toMatchObject({ quantity: 6, unit: "boxes", storageLocationId: drawer.id });
  expect(updated.scene.objects).toEqual(room.scene.objects);
  expect(updated.scene.storageLocations).toEqual(room.scene.storageLocations);
  await detail.getByRole("button", { name: "Storage workspace test vials", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Inventory item details" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Recorded stock" })).toContainText("6 boxes");
  await expect(page.getByRole("region", { name: "Exact location" })).toContainText(drawer.name);
  await page.getByRole("button", { name: "Edit item details", exact: true }).click();
  await expect(page.getByLabel("Item name", { exact: true })).toHaveValue(
    "Storage workspace test vials",
  );
  await page.getByRole("button", { name: "Close item details", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search inventory", exact: true })
    .fill("Storage workspace test vials");
  await page
    .getByRole("region", { name: "Inventory records" })
    .getByRole("button", { name: /Storage workspace test vials/ })
    .click();
  await page.getByRole("button", { name: "Edit item details", exact: true }).click();
  await page.getByLabel("Item name", { exact: true }).fill("Prepared sample vials");
  await expect(page.getByLabel("Item name", { exact: true })).toHaveValue("Prepared sample vials");
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue("6");
  await page.getByRole("button", { name: "Close item details", exact: true }).click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect
    .poll(async () => {
      const saved: Project = await (await request.get("/api/project")).json();
      return saved.rooms
        .find((entry) => entry.id === room.id)!
        .scene.inventoryItems.find((item) => item.name === "Prepared sample vials");
    })
    .toMatchObject({ quantity: 6, unit: "boxes", storageLocationId: drawer.id });
});

test("storage preview is opt-in and returns to the map without changing project data", async ({
  page,
  request,
}) => {
  const before: Project = await (await request.get("/api/project")).json();
  const room = before.rooms.find(
    (entry) => entry.code === "DEMO-01" && entry.roomKind !== "demo-template",
  )!;
  const root = room.scene.storageLocations.find(
    (entry) => entry.name === "Wall cabinet" && !entry.parentId,
  )!;
  const shelf = room.scene.storageLocations.find((entry) => entry.parentId === root.id)!;
  await page.goto(
    `/inventory?view=storage&room=${room.id}&object=${root.objectId}&location=${shelf.id}`,
  );
  await expect(page.getByTitle("All changes saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Isolated cabinet preview" })).toHaveCount(0);
  await page.getByRole("button", { name: "3D preview", exact: true }).click();
  const preview = page.getByRole("region", { name: "Isolated cabinet preview" });
  await expect(preview.getByText("Loading cabinet preview…", { exact: true })).toHaveCount(0, {
    timeout: 15000,
  });
  await preview.getByRole("button", { name: "Show access preview", exact: true }).click();
  await expect(
    preview.getByRole("button", { name: "Close access preview", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: test.info().outputPath("storage-access-preview.png") });
  await page.getByRole("button", { name: "Storage map", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "3D preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show access preview", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const after: Project = await (await request.get("/api/project")).json();
  expect(after).toEqual(before);
});

test("inventory pictures accept a project link or an optimized local file and survive reload", async ({
  page,
  request,
}) => {
  await openInventory(page);
  const before: Project = await (await request.get("/api/project")).json();
  const room = before.rooms.find(
    (entry) => entry.code === "DEMO-01" && entry.roomKind !== "demo-template",
  )!;
  const item = room.scene.inventoryItems.find((entry) => entry.name === "Nitrile gloves, M")!;
  await page
    .getByRole("region", { name: "Inventory records" })
    .getByRole("button", { name: /Nitrile gloves, M/ })
    .click();
  await page.getByRole("button", { name: "Edit item details", exact: true }).click();
  const picture = page.getByRole("region", { name: "Inventory item picture", exact: true });
  const preview = picture.getByRole("img", { name: /Nitrile gloves, M inventory reference/ });

  await picture
    .getByRole("textbox", { name: "Online inventory image URL", exact: true })
    .fill("/images/inventory/reference-standards.png");
  await picture.getByRole("button", { name: "Use link", exact: true }).click();
  await expect(preview).toHaveAttribute("src", "/images/inventory/reference-standards.png");

  await picture.locator('input[type="file"]').setInputFiles({
    name: "inventory-photo.png",
    mimeType: "image/png",
    buffer: readFileSync("public/images/inventory/nitrile-gloves.png"),
  });
  await expect(preview).toHaveAttribute("src", /^data:image\/webp;base64,/);
  await page.getByRole("button", { name: "Close item details", exact: true }).click();
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect
    .poll(async () => {
      const saved: Project = await (await request.get("/api/project")).json();
      return saved.rooms
        .find((entry) => entry.id === room.id)!
        .scene.inventoryItems.find((entry) => entry.id === item.id)?.imageSrc;
    })
    .toMatch(/^data:image\/webp;base64,/);

  const saved: Project = await (await request.get("/api/project")).json();
  const savedSource = saved.rooms
    .find((entry) => entry.id === room.id)!
    .scene.inventoryItems.find((entry) => entry.id === item.id)?.imageSrc;
  expect(savedSource!.length).toBeLessThanOrEqual(360_000);
  expect(saved.rooms.find((entry) => entry.id === room.id)!.scene.objects).toEqual(
    room.scene.objects,
  );

  await page.reload();
  await page
    .getByRole("region", { name: "Inventory records" })
    .getByRole("button", { name: /Nitrile gloves, M/ })
    .click();
  await page.getByRole("button", { name: "Edit item details", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Inventory item picture", exact: true })
      .getByText("Saved with project", { exact: true }),
  ).toBeVisible();
});
