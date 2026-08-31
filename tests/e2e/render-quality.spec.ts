import { test, expect, type Locator } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/testing/reset")).ok()).toBeTruthy();
});

async function diagnostics(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => ({ ...element.dataset }));
}

test("quality tiers preserve the preview camera, open drawer and project, and release contact buffers", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const before = await (await request.get("/api/project")).json();
  await page.goto("/asset-preview?asset=asymmetric-lab-bench");
  const preview = page.locator(".asset-preview-canvas");
  const canvas = preview.locator("canvas");
  const quality = page.getByRole("combobox", { name: "Render quality" });
  await expect(preview).toHaveAttribute("data-model-ready", "true", { timeout: 45_000 });
  await quality.selectOption("high");
  await expect(canvas).toHaveAttribute("data-contact-shading", "active");
  await page
    .getByRole("combobox", { name: "Preview storage location" })
    .selectOption({ label: "Right bank drawer 1" });
  await expect(page.getByRole("button", { name: "Close storage preview" })).toBeVisible();
  const high = await diagnostics(canvas);
  const [width, height] = high.contactShadingSize!.split("x").map(Number);
  expect(width * height).toBeLessThanOrEqual(524288);
  expect(Math.max(width, height)).toBeLessThanOrEqual(960);

  await page.getByRole("button", { name: "Restore Balanced rendering" }).click();
  await expect(canvas).not.toHaveAttribute("data-contact-shading");
  await expect(canvas).toHaveAttribute("data-tone-mapping", "4");
  const balanced = await diagnostics(canvas);
  expect(balanced.cameraPosition).toBe(high.cameraPosition);
  expect(balanced.cameraOrientation).toBe(high.cameraOrientation);
  expect(Number(balanced.renderCalls)).toBeLessThan(Number(high.renderCalls));
  expect(Number(balanced.renderGeometries)).toBe(Number(high.renderGeometries) - 1);
  await expect(page.getByRole("button", { name: "Close storage preview" })).toBeVisible();

  await quality.selectOption("low");
  await expect(canvas).not.toHaveAttribute("data-contact-shading");
  await quality.selectOption("high");
  await expect(canvas).toHaveAttribute("data-contact-shading", "active");
  expect((await diagnostics(canvas)).cameraPosition).toBe(high.cameraPosition);
  const settled = await diagnostics(canvas);
  // This bounded idle interval is a regression assertion, not a claimed FPS benchmark.
  await page.waitForTimeout(750);
  expect((await diagnostics(canvas)).renderFrames).toBe(settled.renderFrames);
  expect((await (await request.get("/api/project")).json()).rooms).toEqual(before.rooms);
  await page.reload();
  await expect(quality).toHaveValue("high");
  // A cold persisted-High reload recompiles the software-rendered CI shaders.
  // Keep interaction deadlines short; allow model/HDR compilation to finish.
  await expect(preview).toHaveAttribute("data-model-ready", "true", { timeout: 45_000 });
  await expect(canvas).toHaveAttribute("data-contact-shading", "active");
  await expect(page.getByRole("combobox", { name: "Preview storage location" })).toHaveValue("");
  expect(errors).toEqual([]);
});

test("room, index and facility expose the same quality preference without changing saved content", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("3d-view")).toBeVisible();
  const before = await (await request.get("/api/project")).json();
  const quality = page.getByRole("combobox", { name: "Render quality" });
  await quality.selectOption("low");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-render-quality", "low");
  const count = await page.getByTestId("3d-view").getAttribute("data-visible-asset-count");
  await quality.selectOption("balanced");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-visible-asset-count", count!);
  await page.getByRole("link", { name: "Spatial Index", exact: true }).click();
  await expect(quality).toHaveValue("balanced");
  await quality.selectOption("low");
  await page.getByRole("link", { name: "Facility Manager", exact: true }).click();
  await expect(quality).toHaveValue("low");
  await page.getByRole("button", { name: "Restore Balanced rendering" }).click();
  await expect(quality).toHaveValue("balanced");
  const after = await (await request.get("/api/project")).json();
  expect(after.rooms.map((room: { scene: unknown }) => room.scene)).toEqual(
    before.rooms.map((room: { scene: unknown }) => room.scene),
  );
});
