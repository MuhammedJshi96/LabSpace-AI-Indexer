import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { ASSET_CATALOG } from "../src/domain/assets";

const DEFAULT_PORT = 4178;
const CAPTURE_TIMEOUT_MS = 30_000;
const VIEWS = ["isometric", "top"] as const;

type CatalogView = (typeof VIEWS)[number];

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function inspectPng(path: string, expectedWidth: number, expectedHeight: number) {
  const buffer = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 33 || buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error(`${path} is not a PNG`);
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${path} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}`);
  }
  if (colorType !== 6) throw new Error(`${path} does not contain an RGBA transparency channel`);
}

async function main() {
  const selectedAssetId = argumentValue("asset");
  const selectedView = argumentValue("view") as CatalogView | undefined;
  const port = Number(argumentValue("port") ?? DEFAULT_PORT);
  const workerCount = Math.max(1, Math.min(6, Number(argumentValue("workers") ?? 4)));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Invalid dedicated capture port: ${port}`);
  }
  if (selectedView && !VIEWS.includes(selectedView)) {
    throw new Error(`Unknown view ${selectedView}; expected ${VIEWS.join(" or ")}`);
  }

  const outputDirectory = resolve(process.cwd(), "public", "models", "procedural", "renders");
  mkdirSync(outputDirectory, { recursive: true });

  // Authored migrations must not leave stale procedural cards behind. The
  // authored GLB and its exact catalog renders are canonical once `model3d` is
  // declared, so remove any older captures deterministically on every run.
  let staleRenderCount = 0;
  for (const asset of ASSET_CATALOG.filter((entry) => entry.model3d)) {
    for (const view of VIEWS) {
      const stalePath = resolve(outputDirectory, `${asset.id}-${view}.png`);
      if (!existsSync(stalePath)) continue;
      rmSync(stalePath);
      staleRenderCount += 1;
      console.log(`PROCEDURAL_RENDER_STALE_REMOVED ${asset.id} ${view}`);
    }
  }

  const proceduralAssets = ASSET_CATALOG.filter((asset) => !asset.model3d).filter(
    (asset) => !selectedAssetId || asset.id === selectedAssetId,
  );
  if (!proceduralAssets.length) {
    throw new Error(
      selectedAssetId
        ? `${selectedAssetId} is not a non-authored catalog asset`
        : "No procedural catalog assets were found",
    );
  }

  const server = await createServer({
    root: process.cwd(),
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: false,
    },
  });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const jobs = proceduralAssets.flatMap((asset) =>
      (selectedView ? [selectedView] : VIEWS).map((view) => ({ asset, view })),
    );
    let rendered = 0;
    let nextJob = 0;
    const runWorker = async (workerId: number) => {
      const page = await browser!.newPage({
        viewport: { width: 384, height: 384 },
        deviceScaleFactor: 1,
        colorScheme: "light",
        reducedMotion: "reduce",
      });
      page.on("console", (message) => {
        if (message.type() === "error")
          console.error(`browser worker=${workerId}: ${message.text()}`);
      });
      page.on("pageerror", (error) =>
        console.error(`browser worker=${workerId}: ${error.message}`),
      );
      try {
        while (nextJob < jobs.length) {
          const jobIndex = nextJob;
          nextJob += 1;
          const { asset, view } = jobs[jobIndex];
          const width = 384;
          const height = view === "top" ? 384 : 256;
          await page.setViewportSize({ width, height });
          const url = new URL(`http://127.0.0.1:${port}/procedural-asset-capture`);
          url.searchParams.set("asset", asset.id);
          url.searchParams.set("view", view);
          await page.goto(url.toString(), {
            waitUntil: "networkidle",
            timeout: CAPTURE_TIMEOUT_MS,
          });
          const capture = page.locator("#procedural-catalog-capture");
          await capture.waitFor({ state: "visible", timeout: CAPTURE_TIMEOUT_MS });
          const captureError = await capture.getAttribute("data-capture-error");
          if (captureError) throw new Error(`${asset.id}/${view}: ${captureError}`);
          await capture.waitFor({ state: "visible", timeout: CAPTURE_TIMEOUT_MS });
          await page.waitForFunction(
            () =>
              document
                .querySelector("#procedural-catalog-capture")
                ?.getAttribute("data-capture-ready") === "true",
            undefined,
            { timeout: CAPTURE_TIMEOUT_MS },
          );

          const outputPath = resolve(outputDirectory, `${asset.id}-${view}.png`);
          await page.screenshot({
            path: outputPath,
            type: "png",
            omitBackground: true,
            animations: "disabled",
            clip: { x: 0, y: 0, width, height },
          });
          inspectPng(outputPath, width, height);
          rendered += 1;
          console.log(
            `PROCEDURAL_RENDER ${rendered}/${jobs.length} worker=${workerId} ${asset.id} ${view}`,
          );
        }
      } finally {
        await page.close();
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(workerCount, jobs.length) }, (_, index) =>
        runWorker(index + 1),
      ),
    );
    console.log(
      `PROCEDURAL_CATALOG_COMPLETE assets=${proceduralAssets.length} renders=${rendered} stale_removed=${staleRenderCount} workers=${Math.min(workerCount, jobs.length)} output=${outputDirectory}`,
    );
  } finally {
    await browser?.close();
    await server.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
