import { expect, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const reset = await request.post("/api/testing/reset");
  expect(reset.ok()).toBeTruthy();
});

test("keeps room switching and facility management discoverable", async ({ page }) => {
  await page.goto("/");

  const roomSwitcher = page.getByRole("button", { name: /Switch room/ });
  await expect(roomSwitcher).toHaveAttribute("aria-expanded", "false");
  await roomSwitcher.click();
  await expect(roomSwitcher).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("dialog", { name: "Switch laboratory room" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Facility overview" })).toBeVisible();

  await page.getByRole("link", { name: "Facility Manager" }).click();
  await expect(page).toHaveURL(/\/facility$/);
  await expect(page.getByRole("heading", { name: "Facility by floor" })).toBeVisible();
  const floorStack = page.getByLabel("Three-dimensional facility floor stack");
  await expect(floorStack).toBeVisible();
  await expect(floorStack).toHaveAttribute("data-facility-render-mode", "material-aware");
  await expect(floorStack).toHaveAttribute("data-facility-envelope", "cutaway");
  await expect(floorStack).toHaveAttribute("data-building-frame", "continuous-section");
  await expect(floorStack).toHaveAttribute("data-room-identification", "slab-mounted-plates");
  await expect(floorStack).toHaveAttribute("data-hosted-openings", "cut-wall");
  await expect(page.locator(".facility-stack-label")).toHaveCount(0);
  await expect(page.locator(".facility-stack-summary b")).toContainText(/occupied floor/);
  await expect(page.locator(".facility-floor-setter select option")).toHaveCount(15);
  await page.getByRole("button", { name: "Organize floors from room numbers" }).click();
  await expect(page.getByRole("status")).toContainText(/rooms organized across floors/);
});

test("exposes blueprint conversion and selectable measurement evidence", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Blueprint" }).click();
  const blueprint = page.getByRole("dialog", { name: "Blueprint to Lab" });
  await expect(blueprint).toBeVisible();
  await expect(blueprint.getByText("Local processing · reversible proposal")).toBeVisible();
  await expect(blueprint.getByText(/Only approved wall geometry enters the project/)).toBeVisible();
  await expect(blueprint.locator('input[type="file"]')).toHaveAttribute(
    "accept",
    "application/pdf,image/png,image/jpeg,image/webp,image/svg+xml",
  );
  await blueprint.getByRole("button", { name: "Close blueprint import" }).click();

  const dimensions = page.getByRole("button", { name: /Dimensions/ });
  await dimensions.click();
  const menu = page.getByRole("menu", { name: "Automatic measurements" });
  await expect(menu).toBeVisible();
  await menu.getByRole("checkbox", { name: /Wall lengths/ }).check();
  await menu.getByRole("checkbox", { name: /Doors and windows/ }).check();
  await expect(page.locator("[data-automatic-measurements]")).toHaveAttribute(
    "data-automatic-measurements",
    "overall,walls,openings",
  );
  await expect(menu.getByText(/Manual tape measure remains available/)).toBeVisible();
});

test("turns a calibrated local blueprint into a reversible room proposal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Blueprint" }).click();
  const blueprint = page.getByRole("dialog", { name: "Blueprint to Lab" });
  const source = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="white"/>
      <rect x="100" y="100" width="600" height="400" fill="none" stroke="#111" stroke-width="8"/>
    </svg>
  `);
  await blueprint.locator('input[type="file"]').setInputFiles({
    name: "simple-laboratory-plan.svg",
    mimeType: "image/svg+xml",
    buffer: source,
  });

  const calibration = blueprint.locator('svg[aria-label="Select two scale points"]');
  await expect(calibration).toBeVisible();
  await expect(blueprint.getByText("Long wall pairs detected")).toBeVisible();
  const box = await calibration.boundingBox();
  expect(box).not.toBeNull();
  await calibration.click({ position: { x: box!.width * 0.125, y: box!.height * 0.17 } });
  await calibration.click({ position: { x: box!.width * 0.875, y: box!.height * 0.17 } });

  const metrics = blueprint.locator(".blueprint-metrics");
  await expect(metrics.getByText("5.00 m", { exact: true })).toBeVisible();
  await expect(metrics.getByText("3.33 m", { exact: true })).toBeVisible();
  await expect(metrics.getByText("4", { exact: true })).toBeVisible();
  await blueprint.getByRole("button", { name: "Stage editable room proposal" }).click();

  await expect(page.getByText("Preview · not saved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve room plan" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await expect(page.getByText("Preview · not saved")).toHaveCount(0);
});

test("opens the exact room selected in the Facility inspector", async ({ page, request }) => {
  await page.goto("/facility");
  await page.getByRole("button", { name: /Build Week Demo DEMO-01/ }).click();
  await page.getByRole("button", { name: "Open room editor" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: /Switch room.*Build Week Demo.*DEMO-01/ }),
  ).toBeVisible();
  const project = await (await request.get("/api/project")).json();
  const activeRoom = project.rooms.find((room: any) => room.id === project.activeRoomId);
  expect(activeRoom).toMatchObject({ name: "Build Week Demo", code: "DEMO-01" });
});

test("keeps the complete desktop shell separated at capture width", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/digital-twin");

  const left = await page.locator(".top-bar-left").boundingBox();
  const navigation = await page.locator(".primary-navigation").boundingBox();
  const right = await page.locator(".top-bar-right").boundingBox();
  expect(left).not.toBeNull();
  expect(navigation).not.toBeNull();
  expect(right).not.toBeNull();
  expect(left!.x + left!.width).toBeLessThanOrEqual(navigation!.x + 0.5);
  expect(navigation!.x + navigation!.width).toBeLessThanOrEqual(right!.x + 0.5);
  await expect(page.locator(".editable-badge")).toBeHidden();
});

test("uses one ordered Create menu and focused workspace forms", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open project workspace" }).click();

  const workspace = page.getByRole("dialog", { name: "Laboratories and rooms" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Rename project" })).toBeVisible();

  await workspace.getByRole("button", { name: "Create", exact: true }).click();
  const creationChoices = workspace.getByRole("menuitem");
  await expect(creationChoices).toHaveCount(2);
  await expect(creationChoices.nth(0)).toContainText("Laboratory");
  await expect(creationChoices.nth(1)).toContainText("Room");

  await creationChoices.nth(0).click();
  const createLaboratory = page.getByRole("dialog", { name: "Create laboratory" });
  await expect(createLaboratory).toBeVisible();
  await expect(createLaboratory.getByLabel("Laboratory name")).toBeVisible();
  await expect(createLaboratory.getByRole("group", { name: "First blank room" })).toBeVisible();
  await createLaboratory.getByRole("button", { name: "Cancel" }).click();

  await workspace
    .getByRole("button", { name: /Rename .*room|Rename Build Week Demo/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Rename room" })).toBeVisible();
});

test("keeps construction primitives out of Asset Studio and contains thumbnails", async ({
  page,
}) => {
  await page.goto("/asset-preview");
  await page.getByRole("button", { name: "Full catalog 104" }).click();

  await expect(page.getByText("Straight wall", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Half-height wall", { exact: true })).toHaveCount(0);
  const firstThumbnail = page.locator(".asset-preview-thumbnail-frame > img").first();
  await expect(firstThumbnail).toBeVisible();
  await expect(firstThumbnail).toHaveCSS("object-fit", "contain");
  await expect(firstThumbnail).toHaveAttribute("data-thumbnail-alignment", "alpha-baseline");

  await page.getByRole("button", { name: "Standard laboratory bench Furniture" }).click();
  await page.getByRole("button", { name: "Archive from library" }).click();
  await expect(page.locator(".asset-preview-count")).toContainText("103 active · 1 archived");
  await expect(page.locator(".asset-archive-list")).toContainText("Standard laboratory bench");
});
