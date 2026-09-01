import type { FullConfig } from "@playwright/test";

const SHUTDOWN_TIMEOUT_MS = 10_000;

export default async function globalTeardown(config: FullConfig) {
  const token = process.env.LABSPACE_E2E_SHUTDOWN_TOKEN;
  const baseURL = config.projects[0]?.use.baseURL;
  if (!token || typeof baseURL !== "string") return;

  const shutdownUrl = new URL("/api/testing/shutdown", baseURL);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHUTDOWN_TIMEOUT_MS);
  try {
    const response = await fetch(shutdownUrl, {
      method: "POST",
      headers: { "x-labspace-e2e-token": token },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`LabSpace E2E server rejected shutdown with HTTP ${response.status}.`);
    }

    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        await fetch(new URL("/api/health", baseURL), {
          signal: AbortSignal.timeout(500),
        });
      } catch {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("LabSpace E2E server did not close within 10 seconds.");
  } finally {
    clearTimeout(timeout);
  }
}
