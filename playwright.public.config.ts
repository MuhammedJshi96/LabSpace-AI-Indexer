import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/public-e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3114",
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
  },
});
