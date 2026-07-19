import { expect, test, type Page } from "@playwright/test";
import { BUILD_WEEK_SAMPLE_PROMPTS } from "../../src/domain/build-week-demo";

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

test("Ask LabSpace locates the BÜCHI evaporator and its indexed flask cabinet", async ({
  page,
  request,
}) => {
  await createSavedDemo(page);
  const project = await (await request.get("/api/project")).json();
  const room = project.rooms.find((entry: any) => entry.id === project.activeRoomId);
  const expectedVisibleAssetCount = room.scene.objects.filter(
    (object: any) => !["wall", "door", "window"].includes(object.objectType),
  ).length;
  const equipmentRecord = room.scene.equipmentRecords.find(
    (record: any) => record.name === "BÜCHI rotary evaporator R-300",
  );

  const flaskItem = room.scene.inventoryItems.find(
    (item: any) => item.name === "Rotary evaporator flask set",
  );
  const flaskLocation = room.scene.storageLocations.find(
    (location: any) => location.id === flaskItem.storageLocationId,
  );

  await page.goto("/digital-twin");
  const assistant = page.getByTestId("ask-labspace");
  await expect(assistant).toBeVisible();
  await expect(assistant).toContainText("Grounded spatial evidence");
  await expect(assistant).toContainText("No API billing");
  const recordDetails = page.getByRole("complementary", {
    name: "Selected record details",
  });
  await expect(recordDetails).toContainText("Select an indexed record");
  await expect(recordDetails).not.toContainText("Nitrile gloves");
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  await assistant.getByRole("button", { name: "Open", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByTestId("3d-view").getAttribute("data-visible-asset-count")),
    )
    .toBe(expectedVisibleAssetCount);

  const locationPrompt = assistant.getByRole("button", {
    name: BUILD_WEEK_SAMPLE_PROMPTS[0],
    exact: true,
  });
  await locationPrompt.click();

  const evidenceCards = assistant.getByTestId("ask-labspace-evidence");
  await expect(evidenceCards).toHaveCount(2);
  await expect(assistant.getByTestId("ask-labspace-summary")).toHaveText(
    "Found 2 grounded records.",
  );
  const equipmentEvidence = evidenceCards.filter({ hasText: "BÜCHI rotary evaporator R-300" });
  await expect(equipmentEvidence).toHaveCount(1);

  const flaskEvidence = evidenceCards.filter({ hasText: "Rotary evaporator flask set" });
  await expect(flaskEvidence).toHaveCount(1);
  await flaskEvidence.click();
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
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  const accessPreview = recordDetails.getByRole("button", {
    name: "Show access preview",
  });
  await expect(accessPreview).toBeVisible();
  // Software-rendered camera easing can keep the inspector button in a
  // sub-pixel "moving" state even though it is visible and enabled.
  await accessPreview.evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "true");
  await recordDetails
    .getByRole("button", { name: "Close access preview" })
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByTestId("3d-view")).toHaveAttribute("data-storage-access-open", "false");
  await expect(page.locator(".twin-scene-breadcrumb")).toHaveCount(0);
  expect(equipmentRecord.objectId).toBeTruthy();
  await page.close();
});

test("Digital Twin result cards keep long equipment identifiers inside their cards", async ({
  page,
}) => {
  await createSavedDemo(page);
  await page.goto("/digital-twin");
  await page.getByRole("button", { name: /^Equipment/ }).click();

  const cards = page.getByTestId("digital-twin-record");
  await expect(cards.first()).toBeVisible();
  const overflow = await cards.evaluateAll((entries) =>
    entries.map((entry) => ({
      name: entry.querySelector(".twin-result-copy > b")?.textContent,
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

test("Ask LabSpace explains an actual conflict and applies a validator-clean alternative", async ({
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

  await page.goto("/digital-twin");
  const assistant = page.getByTestId("ask-labspace");
  await assistant.getByRole("button", { name: "Open", exact: true }).click();
  await page.getByRole("button", { name: "2D fallback", exact: true }).click();
  await expect(page.getByTestId("2d-editor")).toBeVisible();
  await assistant.getByRole("button", { name: BUILD_WEEK_SAMPLE_PROMPTS[0], exact: true }).click();
  const equipmentEvidence = assistant
    .getByTestId("ask-labspace-evidence")
    .filter({ hasText: "BÜCHI rotary evaporator R-300" });
  await expect(equipmentEvidence).toHaveCount(1);
  await equipmentEvidence.click();

  const question = page.getByRole("textbox", {
    name: "Ask LabSpace or search indexed records",
  });
  await question.fill(BUILD_WEEK_SAMPLE_PROMPTS[1]);
  await page.getByRole("button", { name: "Ask LabSpace", exact: true }).click();

  await expect(assistant.getByTestId("ask-labspace-summary")).toContainText(
    "deterministic placement conflict",
  );
  await expect(assistant.getByRole("button", { name: "Apply valid placement" })).toBeVisible();
  await assistant.getByRole("button", { name: "Apply valid placement" }).click();
  await expect(assistant.getByTestId("ask-labspace-summary")).toContainText(
    "no deterministic placement conflict",
  );
  await page.close();
});
