import { expect, test, type Page } from "@playwright/test";
import type { Project } from "../../src/domain/schema";

// The full DEMO-01 scene intentionally remains loaded for these release tests.
// Software WebGL in CI can take materially longer than a hardware-backed judge browser.
test.describe.configure({ mode: "serial", timeout: 300_000 });

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/testing/reset");
  expect(response.ok()).toBeTruthy();
});

async function createSavedDemo(page: Page) {
  await page.goto("/");
  await page.getByTestId("demo-room-action").click();
  await expect(page.getByText("DEMO-01", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".status-bar .save-ok")).toContainText(/saved/i, { timeout: 10000 });
}

test("Spatial Index Finder locates the BÜCHI evaporator and its exact flask drawer", async ({
  page,
  request,
}) => {
  await createSavedDemo(page);
  const project: Project = await (await request.get("/api/project")).json();
  const room = project.rooms.find((entry) => entry.id === project.activeRoomId)!;
  const expectedVisibleAssetCount = room.scene.objects.filter(
    (object: any) => !["wall", "door", "window"].includes(object.objectType),
  ).length;
  const flaskItem = room.scene.inventoryItems.find(
    (item) => item.name === "Rotary evaporator flask set",
  )!;
  // The archived showcase assigned flasks to a generic drawer on a glazed
  // cabinet that has no physical drawers. Arrange only this isolated fixture
  // at the real base-drawer cabinet; never rewrite the shipped snapshot.
  const drawerCabinet = room!.scene.objects.find(
    (object) => object.assetDefinitionId === "base-drawer-cabinet",
  )!;
  const verifiedDrawer = room!.scene.storageLocations.find(
    (location) => location.objectId === drawerCabinet.id && location.type === "drawer",
  )!;
  flaskItem.storageLocationId = verifiedDrawer.id;
  expect((await request.put(`/api/project/${project.id}`, { data: project })).ok()).toBeTruthy();
  const flaskLocation = room.scene.storageLocations.find(
    (location) => location.id === flaskItem.storageLocationId,
  )!;

  await page.goto("/digital-twin");
  await expect(page.getByRole("link", { name: "Spatial Index" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".twin-assistant")).toHaveCount(0);
  const recordDetails = page.getByRole("complementary", {
    name: "Selected record details",
  });
  await expect(recordDetails).toContainText("Select an indexed record");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  await expect
    .poll(async () =>
      Number(await page.getByTestId("3d-view").getAttribute("data-visible-asset-count")),
    )
    .toBe(expectedVisibleAssetCount);

  const search = page.getByRole("textbox", { name: "Search spatial index" });
  await search.fill("rotary evaporator");
  const resultCards = page.getByTestId("digital-twin-record");
  await expect(resultCards).toHaveCount(2);
  await expect(resultCards.filter({ hasText: "BÜCHI rotary evaporator R-300" })).toHaveCount(1);

  const flaskResult = resultCards.filter({ hasText: "Rotary evaporator flask set" });
  await expect(flaskResult).toHaveCount(1);
  await flaskResult.click();
  await expect(recordDetails).toContainText(flaskLocation.name);
  await expect(
    recordDetails.getByRole("img", {
      name: "Rotary evaporator flask set evidence image",
    }),
  ).toHaveAttribute("src", "/images/inventory/rotary-evaporator-flask-set.png");

  await expect(page.getByTestId("3d-view").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("3d-view")).toHaveAttribute(
    "data-focus-object-id",
    flaskLocation.objectId,
  );
  await expect(page.getByTestId("3d-view")).toHaveAttribute(
    "data-focus-location-id",
    flaskLocation.id,
  );
  // An explicit indexed-location selection now opens verified storage automatically.
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "true");
  const closePreview = recordDetails.getByRole("button", { name: "Close access preview" });
  await expect(closePreview).toBeVisible();
  await closePreview.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  const accessPreview = recordDetails.getByRole("button", { name: "Show access preview" });
  await expect(accessPreview).toBeVisible();
  await accessPreview.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "true");
  await recordDetails
    .getByRole("button", { name: "Close access preview" })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  await expect(page.locator(".twin-scene-breadcrumb")).toHaveCount(0);
});

test("Spatial Index result cards keep long equipment identifiers inside their cards", async ({
  page,
}) => {
  await createSavedDemo(page);
  await page.goto("/digital-twin");
  await page.getByRole("button", { name: /^Equipment/ }).click();

  const cards = page.getByTestId("digital-twin-record");
  await expect(cards.first()).toBeVisible();
  const overflow = await cards.evaluateAll((entries) =>
    entries.map((entry) => ({
      clientWidth: entry.clientWidth,
      scrollWidth: entry.scrollWidth,
      valueClientWidth: entry.querySelector<HTMLElement>(".twin-result-value")?.clientWidth ?? 0,
      valueScrollWidth: entry.querySelector<HTMLElement>(".twin-result-value")?.scrollWidth ?? 0,
    })),
  );
  expect(overflow.every((entry) => entry.scrollWidth <= entry.clientWidth + 1)).toBe(true);
  expect(overflow.every((entry) => entry.valueScrollWidth <= entry.valueClientWidth + 1)).toBe(
    true,
  );
});

test("Layout validation remains available after removing the conversational assistant", async ({
  page,
  request,
}) => {
  await createSavedDemo(page);
  const project = await (await request.get("/api/project")).json();
  const room = project.rooms.find((entry: any) => entry.id === project.activeRoomId);
  const equipmentRecord = room.scene.equipmentRecords.find(
    (record: any) => record.name === "BÜCHI rotary evaporator R-300",
  );
  const evaporator = room.scene.objects.find(
    (object: any) => object.id === equipmentRecord.objectId,
  );
  const reagentCabinet = room.scene.objects.find(
    (object: any) => object.name === "North reagent cabinet",
  );
  evaporator.position = { ...reagentCabinet.position };

  const saved = await request.put(`/api/project/${project.id}`, { data: project });
  expect(saved.ok()).toBeTruthy();

  await page.goto(
    `/?room=${encodeURIComponent(room.id)}&object=${encodeURIComponent(evaporator.id)}&panel=validation&presentation=2d`,
  );
  await expect(page.getByTestId("2d-editor")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Issues/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".validation-panel")).toContainText("placement warnings");
  await expect(page.locator(".warning-list button").first()).toBeVisible();
  await expect(page.getByTestId("canvas-placement-status")).not.toContainText("Placement clear");

  await page.goto("/digital-twin");
  const search = page.getByRole("textbox", { name: "Search spatial index" });
  await search.fill("BÜCHI rotary evaporator");
  const result = page
    .getByTestId("digital-twin-record")
    .filter({ hasText: "BÜCHI rotary evaporator R-300" });
  await expect(result).toHaveCount(1);
  await result.click();
  await expect(page.getByRole("heading", { name: "BÜCHI rotary evaporator R-300" })).toBeVisible();
});
