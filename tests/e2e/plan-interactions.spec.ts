import { expect, test } from "@playwright/test";
import { ROOM_809_DEPTH, ROOM_809_WIDTH } from "../../src/domain/seed";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/testing/reset");
  await page.goto("/");
  await page.getByTestId("demo-room-action").click();
  await expect(page.getByText("DEMO-01", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".status-bar .save-ok")).toContainText("Saved", { timeout: 10000 });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByTitle("Fit room to view").click();
});

test("Select mode pans with keyboard and middle mouse without stealing text input", async ({
  page,
}) => {
  const editor = page.getByTestId("2d-editor");
  const box = await editor.boundingBox();
  expect(box).not.toBeNull();

  const sample = { x: box!.x + box!.width * 0.55, y: box!.y + box!.height * 0.52 };
  await page.mouse.move(sample.x, sample.y);
  const before = await page.locator(".canvas-coordinates").innerText();

  await page.keyboard.press("ArrowRight");
  await page.mouse.move(sample.x + 1, sample.y);
  await page.mouse.move(sample.x, sample.y);
  const afterArrow = await page.locator(".canvas-coordinates").innerText();
  expect(afterArrow).not.toBe(before);
  await expect(page.locator(".status-bar")).toContainText("Tool Select");

  await page.mouse.move(sample.x, sample.y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(sample.x + 90, sample.y + 35, { steps: 5 });
  await page.mouse.up({ button: "middle" });
  await page.mouse.move(sample.x + 1, sample.y);
  await page.mouse.move(sample.x, sample.y);
  const afterMiddlePan = await page.locator(".canvas-coordinates").innerText();
  expect(afterMiddlePan).not.toBe(afterArrow);

  const search = page.getByRole("textbox", { name: "Search assets" });
  await search.fill("wasd 123");
  await expect(search).toHaveValue("wasd 123");
  await expect(page.locator(".status-bar")).toContainText("Tool Select");
});

test("placed assets drag without jumping to the plan origin", async ({ page }) => {
  const editor = page.getByTestId("2d-editor");
  const box = await editor.boundingBox();
  expect(box).not.toBeNull();

  const card = page.getByRole("article", { name: /Standard laboratory bench —/ });
  await card.dblclick();
  const xInput = page.getByRole("spinbutton", { name: "X mm" });
  const yInput = page.getByRole("spinbutton", { name: "Y mm" });
  const xBefore = Number(await xInput.inputValue());
  const yBefore = Number(await yInput.inputValue());
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 85, box!.y + box!.height / 2 + 55, {
    steps: 6,
  });
  await page.mouse.up();
  const xAfter = Number(await xInput.inputValue());
  const yAfter = Number(await yInput.inputValue());
  expect(xAfter).not.toBe(xBefore);
  expect(yAfter).not.toBe(yBefore);
  expect(xAfter).toBeGreaterThan(500);
  expect(yAfter).toBeGreaterThan(500);
});

test("dragging one wall side keeps connected room corners joined", async ({ page, request }) => {
  const editor = page.getByTestId("2d-editor");
  const box = await editor.boundingBox();
  expect(box).not.toBeNull();
  const roomScale = Number(await editor.getAttribute("data-plan-scale"));
  const roomOrigin = {
    x: box!.x + Number(await editor.getAttribute("data-plan-origin-x")),
    y: box!.y + Number(await editor.getAttribute("data-plan-origin-y")),
  };
  // Use the clear west section of the wall; the midpoint is occupied by a
  // wall-hosted observation window and correctly routes input to that opening.
  const northGrabPoint = { x: roomOrigin.x + ROOM_809_WIDTH * 0.1 * roomScale, y: roomOrigin.y };
  await page.mouse.move(northGrabPoint.x, northGrabPoint.y);
  await page.mouse.down();
  await page.mouse.move(northGrabPoint.x, northGrabPoint.y + 45, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".status-bar .save-ok")).toContainText("Saved", { timeout: 5000 });

  await expect
    .poll(async () => {
      const persisted = await (await request.get("/api/project")).json();
      const persistedRoom = persisted.rooms.find(
        (entry: any) => entry.id === persisted.activeRoomId,
      );
      return persistedRoom.depth;
    })
    .toBeLessThan(ROOM_809_DEPTH);

  const project = await (await request.get("/api/project")).json();
  const room = project.rooms.find((entry: any) => entry.id === project.activeRoomId);
  const north = room.scene.objects.find((object: any) => object.name === "Room wall 1");
  const east = room.scene.objects.find((object: any) => object.name === "Room wall 2");
  const south = room.scene.objects.find((object: any) => object.name === "Room wall 3");
  const west = room.scene.objects.find((object: any) => object.name === "Room wall 4");
  expect(room.depth).toBeLessThan(ROOM_809_DEPTH);
  expect(north.wall.start.y).toBe(0);
  expect(north.wall.end.y).toBe(north.wall.start.y);
  expect(east.wall.start.y).toBe(north.wall.end.y);
  expect(west.wall.end.y).toBe(north.wall.start.y);
  expect(south.wall.start.y).toBe(room.depth);
  expect(south.wall.end.y).toBe(room.depth);
});
