import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { ProjectSchema, SceneSchema } from "../src/domain/schema";
import { SqliteProjectRepository } from "./repository";
import { PublicDemoSessionStore } from "./public-demo-sessions";

const root = process.cwd();
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 3004);
const databasePath =
  process.env.LABSPACE_DB_PATH ?? resolve(root, "data", "labspace-indexer.sqlite");
const publicDemo = production && process.env.LABSPACE_PUBLIC_DEMO === "1";
const repository = publicDemo ? null : new SqliteProjectRepository(databasePath);
const publicDemoSessions = publicDemo ? new PublicDemoSessionStore(true) : null;
const app = express();
let viteServer: Awaited<ReturnType<typeof createViteServer>> | null = null;

app.disable("x-powered-by");
app.use(express.json({ limit: "12mb" }));
app.use((_request, response, next) => {
  response.set("X-Content-Type-Options", "nosniff");
  response.set("Referrer-Policy", "same-origin");
  response.set("Permissions-Policy", "tools=(self)");
  next();
});
app.use("/api", (_request, response, next) => {
  response.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.set("Pragma", "no-cache");
  next();
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    database: publicDemo ? "session-memory" : "sqlite",
    publicDemo,
    schemaVersion: 2,
  });
});

const requestRepository = (request: express.Request, response: express.Response) => {
  if (publicDemoSessions) return publicDemoSessions.getRepository(request, response);
  if (!repository) throw new Error("Project repository is unavailable.");
  return repository;
};

app.get("/api/project", (request, response) => {
  response.json(requestRepository(request, response).getActiveProject());
});

app.put("/api/project/:id", (request, response) => {
  const parsed = ProjectSchema.safeParse(request.body);
  if (!parsed.success || parsed.data.id !== request.params.id) {
    response.status(400).json({
      error: "The project data is invalid.",
      details: parsed.success ? undefined : parsed.error.issues,
    });
    return;
  }
  response.json(requestRepository(request, response).saveProject(parsed.data));
});

app.delete("/api/project/:id", (request, response) => {
  requestRepository(request, response).deleteProject(request.params.id);
  response.status(204).end();
});

app.get("/api/versions", (request, response) => {
  const projectId = String(request.query.projectId ?? "");
  const roomId = String(request.query.roomId ?? "");
  response.json(requestRepository(request, response).listVersions(projectId, roomId));
});

app.post("/api/versions", (request, response) => {
  const { projectId, roomId, name, note = "", scene } = request.body as Record<string, unknown>;
  const parsedScene = SceneSchema.safeParse(scene);
  if (!projectId || !roomId || typeof name !== "string" || !name.trim() || !parsedScene.success) {
    response
      .status(400)
      .json({ error: "A project, room, version name, and valid scene are required." });
    return;
  }
  response
    .status(201)
    .json(
      requestRepository(request, response).saveVersion(
        String(projectId),
        String(roomId),
        name.trim(),
        String(note),
        parsedScene.data,
      ),
    );
});

app.get("/api/versions/:id", (request, response) => {
  const version = requestRepository(request, response).getVersion(request.params.id);
  if (!version) {
    response.status(404).json({ error: "Version not found." });
    return;
  }
  response.json(version);
});

app.post("/api/import", (request, response) => {
  const parsed = ProjectSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: "The imported project JSON does not match the current schema.",
      details: parsed.error.issues,
    });
    return;
  }
  response.json(requestRepository(request, response).saveProject(parsed.data));
});

if (!production) {
  app.post("/api/testing/reset", (_request, response) => {
    if (!repository) throw new Error("Project repository is unavailable.");
    response.json(repository.resetToSeed());
  });
}

const e2eShutdownToken = process.env.LABSPACE_E2E_SHUTDOWN_TOKEN;
if (!production && e2eShutdownToken) {
  app.post("/api/testing/shutdown", (request, response) => {
    if (request.get("x-labspace-e2e-token") !== e2eShutdownToken) {
      response.status(403).json({ error: "Invalid test shutdown token." });
      return;
    }
    response.status(202).json({ shuttingDown: true });
    response.once("finish", () => setImmediate(() => void shutdown()));
  });
}

if (production) {
  const dist = resolve(root, "dist");
  if (!existsSync(dist)) throw new Error("Production build not found. Run npm run build first.");
  app.use(express.static(dist));
  app.get(/.*/, (_request, response) => response.sendFile(resolve(dist, "index.html")));
} else {
  viteServer = await createViteServer({
    root,
    server: {
      middlewareMode: true,
      hmr: process.env.LABSPACE_DISABLE_HMR === "1" ? false : { port: port + 20_000 },
    },
    appType: "spa",
  });
  app.use(viteServer.middlewares);
}

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`LabSpace Atlas running at http://localhost:${port}`);
  console.log(
    publicDemo ? "Judge data: isolated in-memory browser sessions" : `Local data: ${databasePath}`,
  );
});

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const forceExit = setTimeout(() => process.exit(0), 2_000);
  forceExit.unref();
  server.close();
  server.closeAllConnections();
  await viteServer?.close();
  repository?.close();
  publicDemoSessions?.close();
  clearTimeout(forceExit);
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
