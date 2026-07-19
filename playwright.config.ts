import { defineConfig, devices } from "@playwright/test";

const e2ePort = 3104;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Software-rendered CI needs extra headroom while compiling the authored
  // WebGL materials; interaction assertions still keep their 10 s limit.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: e2eBaseUrl,
    // Continuous trace/video capture forces repeated WebGL readbacks and can
    // stall the authored Room 809 scene under software rendering. Keep the
    // normal judge-flow run lean; diagnostics remain one environment flag away.
    trace: process.env.LABSPACE_E2E_DIAGNOSTICS === "1" ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
    video: process.env.LABSPACE_E2E_DIAGNOSTICS === "1" ? "retain-on-failure" : "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "node --import tsx server/index.ts",
    env: {
      PORT: String(e2ePort),
      LABSPACE_DB_PATH: "data/labspace-e2e.sqlite",
      LABSPACE_DISABLE_HMR: "1",
    },
    url: `${e2eBaseUrl}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
