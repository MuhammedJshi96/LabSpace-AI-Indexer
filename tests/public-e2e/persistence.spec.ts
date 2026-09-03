import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { Project } from "../../src/domain/schema";

// Only this suite's process is stopped. The user's local server/database are never touched.
let server: ChildProcess;
const url = "http://127.0.0.1:3114";
async function startServer() {
  server = spawn(process.execPath, ["--import", "tsx", "server/index.ts", "--production"], {
    env: { ...process.env, PORT: "3114", LABSPACE_PUBLIC_DEMO: "1" },
    windowsHide: true,
    stdio: "ignore",
  });
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null)
          throw new Error("Isolated test server exited; check port 3114.");
        return fetch(`${url}/api/health`)
          .then((response) => response.ok)
          .catch(() => false);
      },
      { timeout: 25_000 },
    )
    .toBe(true);
}
async function stopServer() {
  if (!server || server.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    server.once("exit", () => resolve());
    server.kill();
  });
}
test.beforeAll(async () => {
  const occupied = await fetch(`${url}/api/health`)
    .then(() => true)
    .catch(() => false);
  if (occupied)
    throw new Error("Port 3114 is already occupied; refusing to use or stop another server.");
  await startServer();
});
test.afterAll(stopServer);

async function saved(page: Page) {
  await expect(page.getByTitle("Saved in this browser", { exact: true })).toBeVisible();
}
async function openWorkspace(page: Page) {
  await page.getByRole("button", { name: "Open project workspace", exact: true }).click();
  return page.getByRole("dialog", { name: "Laboratories and rooms", exact: true });
}
async function exportProject(page: Page): Promise<Project> {
  const dialog = await openWorkspace(page);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export project Download versioned JSON" }).click();
  const file = await (await download).path();
  const project = JSON.parse(await readFile(file!, "utf8")) as Project;
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  return project;
}
async function renameProject(page: Page, name: string) {
  const dialog = await openWorkspace(page);
  await dialog.getByRole("button", { name: "Rename project", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Rename project", exact: true });
  await form.getByLabel("Project name", { exact: true }).fill(name);
  await form.getByRole("button", { name: "Save changes", exact: true }).click();
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
}

test("created laboratories, rooms and named versions survive reload, server restart and a new tab", async ({
  page,
  context,
  browser,
}) => {
  await page.goto("/inventory");
  await saved(page);
  const original = await exportProject(page);
  const dialog = await openWorkspace(page);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await dialog.getByRole("menuitem", { name: /Laboratory/ }).click();
  const form = page.getByRole("dialog", { name: "Create laboratory", exact: true });
  await form.getByLabel("Laboratory name", { exact: true }).fill("Persistent student laboratory");
  await form.getByLabel("Laboratory code", { exact: true }).fill("KEEP");
  await form.getByLabel("Room name", { exact: true }).fill("Students room saved");
  await form.getByLabel("Room code", { exact: true }).fill("R816");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  await saved(page);
  await page.getByRole("button", { name: "Save a named room version", exact: true }).click();
  await page.getByLabel("Version name", { exact: true }).fill("Before furniture");
  await page.getByRole("button", { name: "Save version", exact: true }).click();
  const before = await exportProject(page);
  expect(before.laboratories).toHaveLength(original.laboratories.length + 1);
  expect(before.rooms).toHaveLength(original.rooms.length + 1);
  expect(
    before.rooms.some((room) => room.name === "Students room saved" && room.code === "R816"),
  ).toBe(true);
  await page.reload();
  await saved(page);
  expect(await exportProject(page)).toEqual(before);
  await stopServer();
  await startServer();
  // Expire the server-session cookie too; browser project is not keyed to it.
  await context.clearCookies();
  await page.reload();
  await saved(page);
  expect(await exportProject(page)).toEqual(before);
  const versions = await openWorkspace(page);
  await versions
    .getByRole("button", { name: "Version history Restore a named room version" })
    .click();
  await expect(page.getByRole("dialog", { name: "Room version history" })).toContainText(
    "Before furniture",
  );
  const second = await context.newPage();
  await second.goto("/inventory");
  await saved(second);
  expect(await exportProject(second)).toEqual(before);
  // Another visitor receives the public starter, not this browser's private rooms.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`${url}/inventory`);
  await saved(visitorPage);
  expect((await exportProject(visitorPage)).rooms.some((room) => room.code === "R816")).toBe(false);
  await visitor.close();
});

test("full project data is durable and subsequent loads do not require project APIs", async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile("server/public-showcase-project.json", "utf8"),
  ) as Project;
  fixture.name = "Recovery fixture";
  // Bootstrap a representative existing public session once; subsequent API data must never win.
  const inventory = {
    id: crypto.randomUUID(),
    name: "Saved standards",
    quantity: 12,
    unit: "vials",
    expiryDate: null,
    storageLocationId: null,
    owner: "Student",
    notes: "Keep this note",
    createdAt: fixture.createdAt,
    updatedAt: fixture.updatedAt,
  };
  fixture.rooms[0].scene.inventoryItems.push(
    inventory as Project["rooms"][number]["scene"]["inventoryItems"][number],
  );
  await page.route("**/api/project?*", (route) => route.fulfill({ json: fixture }));
  await page.goto("/inventory");
  await saved(page);
  const before = await exportProject(page);
  expect(before.rooms[0].scene.inventoryItems.at(-1)).toMatchObject(inventory);
  expect(before.rooms[0].scene.objects.length).toBeGreaterThan(0);
  expect(before.rooms[0].scene.storageLocations.length).toBeGreaterThan(0);
  await page.route("**/api/**", (route) => route.abort());
  await page.reload();
  await saved(page);
  expect(await exportProject(page)).toEqual(before);
  await renameProject(page, "Saved without server APIs");
  await saved(page);
  await page.reload();
  await saved(page);
  expect((await exportProject(page)).name).toBe("Saved without server APIs");
});

test("the public judge site retires legacy LAB-01 browser workspaces", async ({ page }) => {
  await page.goto("/inventory");
  await saved(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("labspace-saved-workspace", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("workspace", "readwrite");
        const store = tx.objectStore("workspace");
        const read = store.get("active");
        read.onsuccess = () => {
          const workspace = read.result;
          const laboratory = workspace.project.laboratories[0];
          store.put(
            {
              ...workspace,
              revision: workspace.revision + 1,
              project: {
                ...workspace.project,
                name: "Legacy judge workspace",
                laboratories: [{ ...laboratory, name: "Laboratory 1", code: "LAB-01" }],
              },
            },
            "active",
          );
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(new Error("Legacy fixture failed"));
      };
    });
  });

  await page.reload();
  await saved(page);
  const migrated = await exportProject(page);
  expect(migrated.name).not.toBe("Legacy judge workspace");
  expect(migrated.laboratories.map((laboratory) => laboratory.code)).toEqual(["LAB-D-00"]);
  expect(migrated.rooms.map((room) => room.code)).toEqual(["R-001", "R-002"]);
});

test("a stale tab cannot overwrite a newer save", async ({ page, context }) => {
  await page.goto("/inventory");
  await saved(page);
  const stale = await context.newPage();
  await stale.goto("/inventory");
  await saved(stale);
  await renameProject(page, "Newest workspace");
  await saved(page);
  await renameProject(stale, "Stale tab edits");
  await expect(stale.getByRole("alert", { name: "Project save needs attention" })).toContainText(
    "Another tab saved",
  );
  const recovery = await context.newPage();
  await recovery.goto("/inventory");
  await saved(recovery);
  expect((await exportProject(recovery)).name).toBe("Newest workspace");
  // Unsaved edits remain exportable; failure never rewrites the tab to defaults.
  expect((await exportProject(stale)).name).toBe("Stale tab edits");
});

test("storage write failure never claims saved or replaces the previous project", async ({
  page,
  context,
}) => {
  await page.goto("/inventory");
  await saved(page);
  const before = await exportProject(page);
  // Test-only fault injection in an isolated browser context, not the user's browser.
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await renameProject(page, "Unsaved quota test");
  await expect(page.getByRole("alert", { name: "Project save needs attention" })).toContainText(
    "Browser storage could not save",
  );
  await expect(page.getByTitle("Saved in this browser", { exact: true })).toHaveCount(0);
  const recovery = await context.newPage();
  await recovery.goto("/inventory");
  await saved(recovery);
  expect(await exportProject(recovery)).toEqual(before);
});

test("unsupported saved data is not silently replaced with a default project", async ({ page }) => {
  await page.goto("/inventory");
  await saved(page);
  const before = await exportProject(page);
  // Isolated fixture: simulate a database written by a newer incompatible application.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("labspace-saved-workspace", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("workspace", "readwrite");
        const store = tx.objectStore("workspace");
        const read = store.get("active");
        read.onsuccess = () => store.put({ ...read.result, format: 999 }, "active");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(new Error("Fixture failed"));
      };
    });
  });
  await page.reload();
  await expect(page.getByRole("alert", { name: "Project save needs attention" })).toContainText(
    "has not been replaced",
  );
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Project save needs attention" })).toContainText(
    "Saving is blocked",
  );
  const retained = await page.evaluate(
    async () =>
      new Promise<Project>((resolve) => {
        const request = indexedDB.open("labspace-saved-workspace", 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("workspace", "readonly");
          const read = tx.objectStore("workspace").get("active");
          read.onsuccess = () => resolve(read.result.project);
          tx.oncomplete = () => db.close();
        };
      }),
  );
  expect(retained).toEqual(before);
});

test("unavailable browser storage cannot claim a durable save", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { value: undefined });
  });
  await page.goto("/inventory");
  await expect(page.getByRole("alert", { name: "Project save needs attention" })).toContainText(
    "Browser storage could not save",
  );
  await expect(page.getByTitle("Saved in this browser", { exact: true })).toHaveCount(0);
});

test("explicit JSON import persists and explicit deletion stays blank rather than reseeding", async ({
  page,
}) => {
  await page.goto("/inventory");
  await saved(page);
  const fixture = await exportProject(page);
  fixture.name = "Imported portable workspace";
  fixture.rooms[0].name = "Imported saved room";
  page.on("dialog", (dialog) => void dialog.accept());
  const projectDialog = await openWorkspace(page);
  await projectDialog.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(projectDialog).toHaveCount(0);
  await saved(page);
  const imported = await exportProject(page);
  expect(imported.name).toBe(fixture.name);
  expect(imported.rooms).toEqual(fixture.rooms);
  await page.reload();
  await saved(page);
  expect(await exportProject(page)).toEqual(imported);
  const deletion = await openWorkspace(page);
  await deletion.getByRole("button", { name: "Delete project", exact: true }).click();
  await expect(deletion).toHaveCount(0);
  await saved(page);
  const blank = await exportProject(page);
  expect(blank.rooms).toHaveLength(1);
  expect(blank.rooms[0].scene.objects).toHaveLength(0);
  await page.reload();
  await saved(page);
  expect(await exportProject(page)).toEqual(blank);
});
