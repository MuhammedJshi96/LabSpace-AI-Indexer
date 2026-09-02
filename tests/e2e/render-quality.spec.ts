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
  expect(errors.filter((message) => message !== "WebSocket closed without opened.")).toEqual([]);
});

test("asset view presets cancel orbit momentum and never settle below the studio floor", async ({
  page,
}) => {
  await page.goto("/asset-preview?asset=high-volume-multifunction-printer");
  const preview = page.locator(".asset-preview-canvas");
  const canvas = preview.locator("canvas");
  await expect(preview).toHaveAttribute("data-model-ready", "true", { timeout: 45_000 });

  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds!.x + bounds!.width / 2;
  const centerY = bounds!.y + bounds!.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX, Math.min(bounds!.y + bounds!.height - 8, centerY + 240));
  await page.mouse.up();

  // Clicking while damping is still active used to reapply the previous
  // spherical delta after the preset, drifting Front toward a top/bottom view.
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForTimeout(500);
  const settled = await diagnostics(canvas);
  const [x, y, z] = settled.cameraPosition!.split(",").map(Number);
  expect(x).toBeCloseTo(0, 3);
  expect(y).toBeCloseTo(0.19, 3);
  expect(z).toBeGreaterThan(0);

  await page.waitForTimeout(350);
  const idle = await diagnostics(canvas);
  expect(idle.cameraPosition).toBe(settled.cameraPosition);
  expect(idle.cameraOrientation).toBe(settled.cameraOrientation);
  expect(idle.renderFrames).toBe(settled.renderFrames);
});

test("final Blender reference assets remain single-instance and orbitable across every preset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const assets = [
    ["hotplate-stirrer", "Magnetic stirrer hot plate", "200 × 260 × 420 mm"],
    ["analytical-balance", "Analytical balance", "210 × 320 × 310 mm"],
    ["gpu-analysis-workstation", "GPU analysis workstation", "1200 × 600 × 1250 mm"],
  ] as const;

  await page.goto(`/asset-preview?asset=${assets[0][0]}`);
  for (const [id, name, dimensions] of assets) {
    if (id !== assets[0][0]) {
      // Switch models inside the mounted studio. Repeated full-page navigations
      // only exercise the disabled-HMR socket lifecycle and can emit a harmless
      // Chromium WebSocket-close error unrelated to GLB replacement or orbiting.
      await page.getByRole("button", { name: `${name} Laboratory equipment`, exact: true }).click();
    }
    const stage = page.locator(".asset-preview-stage");
    const preview = page.locator(".asset-preview-canvas");
    await expect(preview).toHaveAttribute("data-model-ready", "true", { timeout: 45_000 });
    await expect(stage.locator(".asset-preview-canvas")).toHaveCount(1);
    await expect(preview.locator("canvas")).toHaveCount(1);
    await expect(page.locator(".asset-preview-details")).toContainText(dimensions);

    const presetPositions = new Set<string>();
    for (const label of ["Front", "Back", "Left", "Right", "Top", "Iso"] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.waitForTimeout(80);
      presetPositions.add((await diagnostics(preview.locator("canvas"))).cameraPosition!);
      await expect(stage.locator(".asset-preview-canvas")).toHaveCount(1);
      await expect(preview.locator("canvas")).toHaveCount(1);
    }
    expect(presetPositions.size).toBe(6);
    await preview.screenshot({ path: `test-results/final-reference-${id}.png` });
  }
  // The isolated server deliberately disables HMR; Chromium can surface the
  // unopened dev socket closing as a page error even though the app is ready.
  expect(errors.filter((message) => message !== "WebSocket closed without opened.")).toEqual([]);
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
