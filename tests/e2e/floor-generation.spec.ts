import { expect, test } from "@playwright/test";

test("the blank starter creates its floor only after the wall outline closes", async ({ page }) => {
  await page.request.post("/api/testing/reset");
  await page.goto("/");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByTitle("Fit room to view").click();

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
    return room.scene.objects.filter((object: { objectType: string }) => object.objectType === "wall")
      .length;
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
  await expect(page.locator(".pane-label-value")).toContainText(/5\.0\d .* 4\.00 m/);

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
