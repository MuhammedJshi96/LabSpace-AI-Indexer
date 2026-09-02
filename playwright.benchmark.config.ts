import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";

const port = 3106;
const baseURL = `http://127.0.0.1:${port}`;
const shutdownToken = process.env.LABSPACE_E2E_SHUTDOWN_TOKEN ?? randomUUID();
process.env.LABSPACE_E2E_SHUTDOWN_TOKEN = shutdownToken;

export default defineConfig({
  testDir: "./benchmarks",
  fullyParallel: false,
  workers: 1,
  timeout: 900_000,
  expect: { timeout: 12_000 },
  retries: 0,
  reporter: [["list"]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  outputDir: "test-results/benchmark-v2",
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "node --import tsx server/index.ts",
    env: {
      PORT: String(port),
      LABSPACE_DB_PATH: "data/labspace-benchmark-v2.sqlite",
      LABSPACE_DISABLE_HMR: "1",
      LABSPACE_E2E_SHUTDOWN_TOKEN: shutdownToken,
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
