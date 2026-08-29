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
  await expect(page.getByRole("heading", { name: "Facility workspace" })).toBeVisible();
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
  await page.getByRole("button", { name: "Full catalog 94" }).click();

  await expect(page.getByText("Straight wall", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Half-height wall", { exact: true })).toHaveCount(0);
  const firstThumbnail = page.locator(".asset-preview-thumbnail-frame > img").first();
  await expect(firstThumbnail).toBeVisible();
  await expect(firstThumbnail).toHaveCSS("object-fit", "contain");

  await page.getByRole("button", { name: "Standard laboratory bench Furniture" }).click();
  await page.getByRole("button", { name: "Archive from library" }).click();
  await expect(page.locator(".asset-preview-count")).toContainText("93 active · 1 archived");
  await expect(page.locator(".asset-archive-list")).toContainText("Standard laboratory bench");
});
