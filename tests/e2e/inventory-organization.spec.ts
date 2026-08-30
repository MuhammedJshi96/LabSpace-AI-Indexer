import { expect, test, type Page } from "@playwright/test";
import type { Project } from "../../src/domain/schema";

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
  const dialog = page.getByRole("dialog", { name: "Assign inventory", exact: true });
  await dialog.getByLabel("Destination room").selectOption(demo.id);
  await dialog
    .getByRole("checkbox", { name: "Select Autosampler vial caps, blue in CHR-A" })
    .check();
  await dialog.getByRole("checkbox", { name: "Select Pipette tips, 200 µL in DEMO-01" }).check();
  await dialog.getByRole("button", { name: "Choose Wall cabinet", exact: true }).click();
  await dialog.getByRole("button", { name: "Choose Shelf 01", exact: true }).click();
  await expect(dialog.locator(".organizer-final-address")).toContainText("Wall cabinet → Shelf 01");
  await dialog.getByRole("button", { name: "Assign 2 items", exact: true }).click();
  await expect(dialog).toHaveCount(0);
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

  await page.getByRole("button", { name: "Undo last change" }).click();
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
  await page.getByRole("button", { name: "Redo last change" }).click();
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
  await page.getByRole("button", { name: "Storage names", exact: true }).click();
  const names = page.getByRole("dialog", { name: "Storage names", exact: true });
  await names.getByLabel("Destination room").selectOption(demo.id);
  await names.getByRole("button", { name: "Choose Wall cabinet", exact: true }).click();
  await names.getByRole("button", { name: "Rename cabinet", exact: true }).click();
  const rename = page.getByRole("dialog", { name: "Rename cabinet", exact: true });
  await expect(rename.getByLabel("Storage name")).toBeFocused();
  expect((await rename.boundingBox())!.height).toBeLessThan(500);
  await rename.getByLabel("Storage name").fill("Student supplies");
  await rename.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(names.getByRole("button", { name: "Rename cabinet", exact: true })).toBeFocused();
  await names.getByRole("button", { name: "Choose Shelf 01", exact: true }).click();
  await names.getByRole("button", { name: "Rename shelf", exact: true }).click();
  const renameShelf = page.getByRole("dialog", { name: "Rename shelf", exact: true });
  await renameShelf.getByLabel("Storage name").fill("Daily supplies");
  await renameShelf.getByLabel("Storage name").press("Enter");
  await expect(names.locator(".organizer-final-address")).toContainText(
    "Student supplies → Daily supplies",
  );
  const frame = names.locator(".organizer-asset");
  const thumbnail = frame.locator("img");
  await expect(thumbnail).toBeVisible();
  expect((await thumbnail.boundingBox())!.height).toBeLessThanOrEqual(
    (await frame.boundingBox())!.height,
  );
  await names.getByRole("button", { name: "Done", exact: true }).click();
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
    "Student supplies",
  );
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Inventory records" })
      .getByRole("button", { name: /Reference standards.*Student supplies.*Daily supplies/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assign inventory", exact: true }).click();
  const assignment = page.getByRole("dialog", { name: "Assign inventory", exact: true });
  await assignment.getByLabel("Search inventory to assign").press("Escape");
  await expect(assignment).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Assign inventory", exact: true })).toBeFocused();
});

test("the Storage inspector starts assignment at the selected shelf without changing it on cancel", async ({
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
  await page.goto("/");
  await expect(page.getByTitle("All changes saved", { exact: true })).toBeVisible();
  await page
    .getByRole("region", { name: "Room inspector", exact: true })
    .getByRole("tab", { name: "Storage", exact: true })
    .click();
  await page
    .getByTitle(`${shelf.name} — ${shelf.indexCode}`, { exact: true })
    .click({ timeout: 10_000 });
  await page.getByRole("button", { name: "Assign inventory here", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Assign inventory", exact: true });
  await expect(chooser.getByLabel("Destination room")).toHaveValue(room.id);
  await expect(chooser.locator(".organizer-final-address")).toContainText(
    "Wall cabinet → Shelf 01",
  );
  await chooser.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Rename shelf", exact: true }).click();
  const rename = page.getByRole("dialog", { name: "Rename shelf", exact: true });
  await expect(rename.getByLabel("Storage name")).toHaveValue("Shelf 01");
  await rename.getByLabel("Storage name").fill("Cancelled name");
  await rename.getByLabel("Storage name").press("Escape");
  await expect(rename).toHaveCount(0);
  const after: Project = await (await request.get("/api/project")).json();
  expect(after.rooms.find((entry) => entry.id === room.id)!.scene.storageLocations).toEqual(
    room.scene.storageLocations,
  );
  expect(after.rooms.find((entry) => entry.id === room.id)!.scene.inventoryItems).toEqual(
    room.scene.inventoryItems,
  );
});
