# WebMCP Challenge deployment

LabSpace is a stateful Node/Express application with a Vite frontend. Local development keeps the SQLite repository; the public challenge service uses isolated in-memory browser sessions so reviewers never share one mutable project. Deployment uses the root `render.yaml` Blueprint.

Live judge service: [https://labspace-agent-twin.onrender.com](https://labspace-agent-twin.onrender.com)

## Render Blueprint

The Blueprint creates one free Node web service from `webmcp-challenge-2026`:

- build: `npm ci --include=dev && npm run build` (the TypeScript build uses
  development-only type packages even though the deployed runtime is production)
- start: `npm run start`
- health check: `/api/health`
- public judge data: isolated four-hour in-memory browser sessions
- no API keys, secrets, or paid services required

The server binds to Render's `PORT` on `0.0.0.0`. In production it serves `dist/`, keeps API responses uncached, and does not mount `/api/testing/reset`.

## One external deployment action

1. Sign in to Render and choose **New → Blueprint**.
2. Connect `https://github.com/MuhammedJshi96/LabSpace-AI-Indexer`.
3. Select/confirm the repository Blueprint and free plan; do not add billing.
4. After the deploy succeeds, copy the `https://…onrender.com` URL into the Devpost and judge materials.

No credential belongs in this repository.

## Public judge-session behavior

With `LABSPACE_PUBLIC_DEMO=1`, the server issues an HTTP-only, same-site session cookie and creates a fresh memory repository from LabSpace's deterministic source-controlled seed. A browser keeps its own edits and versions for four hours of inactivity; another browser receives an independent seed. Up to 250 active sessions are retained with oldest-session eviction. Restart, redeploy, spin-down, expiry, or cookie removal starts a fresh workspace. Export JSON for a portable copy. A production multi-user deployment should add authentication and a managed database with organization-level isolation.

## Production smoke test

Replace `$URL` with the deployed HTTPS origin:

```powershell
$URL = "https://your-service.onrender.com"
Invoke-RestMethod "$URL/api/health"
Invoke-WebRequest "$URL/" -UseBasicParsing
Invoke-WebRequest "$URL/digital-twin" -UseBasicParsing
Invoke-WebRequest "$URL/inventory" -UseBasicParsing
```

Expected health response:

```json
{ "ok": true, "database": "session-memory", "publicDemo": true, "schemaVersion": 2 }
```

Then use a WebMCP-capable top-level browser context to verify the seventeen registered tools on `/`, `/digital-twin`, and `/inventory`, and no tools on internal `/asset-preview`, `/facility`, or capture routes. Do not set `Origin-Agent-Cluster: ?0`, expose tools cross-origin, or weaken the `tools` Permissions Policy.

Official hosting references:

- [Render Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Render web services](https://render.com/docs/web-services)
- [Render free instance limitations](https://render.com/docs/free)
- [Render persistent disks](https://render.com/docs/disks)
