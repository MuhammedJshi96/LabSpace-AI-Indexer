import { expect, test } from "@playwright/test";

test("the blank starter creates its floor only after the wall outline closes", async ({ page }) => {
  await page.request.post("/api/testing/reset");
  await page.goto("/");
  await page.getByRole("button", { name: "2D", exact: true }).click();

  const editor = page.getByTestId("2d-editor");
  await expect(editor).toHaveAttribute("data-floor-state", "awaiting-closed-walls");
  await expect(page.getByTestId("canvas-floor-guidance")).toContainText("Floor not generated");

  const box = await editor.boundingBox();
  expect(box).not.toBeNull();
  const scale = Number(await editor.getAttribute("data-plan-scale"));
  const origin = {
    x: box!.x + Number(await editor.getAttribute("data-plan-origin-x")),
    y: box!.y + Number(await editor.getAttribute("data-plan-origin-y")),
  };
  const toScreen = (x: number, y: number) => ({
    x: origin.x + x * scale,
    y: origin.y + y * scale,
  });
  const corners = [
    toScreen(1500, 1250),
    toScreen(6500, 1250),
    toScreen(6500, 5250),
    toScreen(1500, 5250),
  ];
  const wallCount = async () => {
    const project = await (await page.request.get("/api/project")).json();
    const room = project.rooms.find((entry: { id: string }) => entry.id === project.activeRoomId);
    return room.scene.objects.filter(
      (object: { objectType: string }) => object.objectType === "wall",
    ).length;
  };
  const expectChainNear = async (x: number, y: number) => {
    await expect
      .poll(async () => Math.abs(Number(await editor.getAttribute("data-wall-chain-start-x")) - x))
      .toBeLessThanOrEqual(125);
    await expect
      .poll(async () => Math.abs(Number(await editor.getAttribute("data-wall-chain-start-y")) - y))
      .toBeLessThanOrEqual(125);
  };

  await page.getByRole("button", { name: "Draw walls" }).click();
  await page.mouse.click(corners[0].x, corners[0].y);
  await expectChainNear(1500, 1250);
  for (let index = 1; index < corners.length; index += 1) {
    await page.mouse.click(corners[index].x, corners[index].y);
    await expectChainNear([6500, 6500, 1500][index - 1], [1250, 5250, 5250][index - 1]);
    await expect.poll(wallCount).toBe(index);
  }
  await expect(editor).toHaveAttribute("data-floor-state", "awaiting-closed-walls");

  await page.mouse.click(corners[0].x, corners[0].y);
  await expect.poll(wallCount).toBe(4);
  await expect(editor).toHaveAttribute("data-floor-state", "wall-derived");
  await expect(page.getByTestId("canvas-floor-guidance")).toHaveCount(0);
  await expect(page.locator(".pane-label-value")).toContainText(/4\.9\d .* 4\.00 m/);

  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect.poll(wallCount).toBe(3);
  await expect(editor).toHaveAttribute("data-floor-state", "awaiting-closed-walls");

  await page.getByTitle("Redo (Ctrl+Y)").click();
  await expect.poll(wallCount).toBe(4);
  await expect(editor).toHaveAttribute("data-floor-state", "wall-derived");

  // A divider may split the room after the perimeter exists; it must not
  // invalidate or replace the exterior floor boundary.
  await page.keyboard.press("Enter");
  const resizedBox = await editor.boundingBox();
  const resizedScale = Number(await editor.getAttribute("data-plan-scale"));
  const resizedOrigin = {
    x: resizedBox!.x + Number(await editor.getAttribute("data-plan-origin-x")),
    y: resizedBox!.y + Number(await editor.getAttribute("data-plan-origin-y")),
  };
  await page.mouse.click(resizedOrigin.x + 2500 * resizedScale, resizedOrigin.y);
  await page.mouse.click(
    resizedOrigin.x + 2500 * resizedScale,
    resizedOrigin.y + 4000 * resizedScale,
  );
  await expect.poll(wallCount).toBe(5);
  await expect(editor).toHaveAttribute("data-floor-state", "wall-derived");

  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-floor-state", "wall-derived");
  await expect(page.getByRole("button", { name: "Toggle floor visibility" })).toBeEnabled();
});

test("a room rectangle is atomic and an attached rectangle becomes a side-by-side annex", async ({
  page,
}) => {
  await page.request.post("/api/testing/reset");
  await page.goto("/");
  await page.getByRole("button", { name: "2D", exact: true }).click();

  const editor = page.getByTestId("2d-editor");
  const scenePoint = async (x: number, y: number) => {
    const box = await editor.boundingBox();
    expect(box).not.toBeNull();
    const scale = Number(await editor.getAttribute("data-plan-scale"));
    return {
      x: box!.x + Number(await editor.getAttribute("data-plan-origin-x")) + x * scale,
      y: box!.y + Number(await editor.getAttribute("data-plan-origin-y")) + y * scale,
    };
  };
  const readRoom = async () => {
    const project = await (await page.request.get("/api/project")).json();
    return project.rooms.find((room: { id: string }) => room.id === project.activeRoomId);
  };
  const chooseRectangle = async () => {
    await page.getByRole("button", { name: "Room construction options" }).click();
    await page
      .locator(".wall-kind-menu")
      .getByRole("button", { name: /Rectangular room/ })
      .click();
  };

  await chooseRectangle();
  const firstStart = await scenePoint(1500, 1250);
  const firstEnd = await scenePoint(6500, 5250);
  await page.mouse.move(firstStart.x, firstStart.y);
  await page.mouse.down();
  await page.mouse.move(firstEnd.x, firstEnd.y, { steps: 8 });
  await page.mouse.up();

  await expect(editor).toHaveAttribute("data-floor-state", "wall-derived");
  await expect
    .poll(
      async () =>
        (await readRoom()).scene.objects.filter(
          (object: { objectType: string }) => object.objectType === "wall",
        ).length,
    )
    .toBe(4);
  await expect.poll(async () => (await readRoom()).spaces.length).toBe(1);

  await chooseRectangle();
  const annexStart = await scenePoint(5000, 500);
  const annexEnd = await scenePoint(7500, 3500);
  await page.mouse.move(annexStart.x, annexStart.y);
  await page.mouse.down();
  await page.mouse.move(annexEnd.x, annexEnd.y, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await readRoom()).spaces.length).toBe(2);
  await expect
    .poll(
      async () =>
        (await readRoom()).scene.objects.filter(
          (object: { objectType: string }) => object.objectType === "wall",
        ).length,
    )
    .toBe(9);
  const annexRoom = await readRoom();
  const wallCodes = annexRoom.scene.objects
    .filter((object: { objectType: string }) => object.objectType === "wall")
    .map((object: { indexCode: string }) => object.indexCode);
  expect(new Set(wallCodes).size).toBe(wallCodes.length);
  await expect(page.getByText(/Connected annex created/)).toBeVisible();

  await page.getByTitle("Undo (Ctrl+Z)").click();
  await expect.poll(async () => (await readRoom()).spaces.length).toBe(1);
  await expect
    .poll(
      async () =>
        (await readRoom()).scene.objects.filter(
          (object: { objectType: string }) => object.objectType === "wall",
        ).length,
    )
    .toBe(4);

  const beforeConstrainedRoom = await readRoom();
  const topWall = beforeConstrainedRoom.scene.objects.find(
    (object: { id: string; wall?: { start: { y: number }; end: { y: number } } }) =>
      object.wall && Math.abs(object.wall.start.y - object.wall.end.y) < 1,
  );
  expect(topWall).toBeTruthy();
  const wallMidpoint = await scenePoint(
    (topWall.wall.start.x + topWall.wall.end.x) / 2,
    (topWall.wall.start.y + topWall.wall.end.y) / 2,
  );
  await page.mouse.move(wallMidpoint.x, wallMidpoint.y);
  await page.keyboard.down("Control");
  await page.mouse.down();
  await page.mouse.move(wallMidpoint.x + 90, wallMidpoint.y + 32, { steps: 7 });
  await page.mouse.up();
  await page.keyboard.up("Control");

  await expect
    .poll(async () => {
      const changed = (await readRoom()).scene.objects.find(
        (object: { id: string }) => object.id === topWall.id,
      );
      const deltaX = Math.round(changed.wall.start.x - topWall.wall.start.x);
      const deltaY = Math.round(changed.wall.start.y - topWall.wall.start.y);
      return Math.abs(deltaX) > 100 && deltaY === 0;
    })
    .toBe(true);
});
