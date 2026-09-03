import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";

const submissionPort = 3124;
const submissionBaseUrl = `http://127.0.0.1:${submissionPort}`;
const shutdownToken = process.env.LABSPACE_E2E_SHUTDOWN_TOKEN ?? randomUUID();
process.env.LABSPACE_E2E_SHUTDOWN_TOKEN = shutdownToken;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: submissionBaseUrl,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "node --import tsx server/index.ts",
    env: {
      PORT: String(submissionPort),
      LABSPACE_DB_PATH: "data/labspace-submission-e2e.sqlite",
      LABSPACE_DISABLE_HMR: "1",
      LABSPACE_E2E_SHUTDOWN_TOKEN: shutdownToken,
    },
    url: `${submissionBaseUrl}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
