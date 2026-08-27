# WebMCP Challenge deployment

LabSpace is a stateful Node/Express application with a Vite frontend and local SQLite repository. The challenge deployment keeps that architecture intact and uses the root `render.yaml` Blueprint.

## Render Blueprint

The Blueprint creates one free Node web service from `webmcp-challenge-2026`:

- build: `npm ci --include=dev && npm run build` (the TypeScript build uses
  development-only type packages even though the deployed runtime is production)
- start: `npm run start`
- health check: `/api/health`
- production database: `/tmp/labspace-agent-twin.sqlite`
- no API keys, secrets, or paid services required

The server binds to Render's `PORT` on `0.0.0.0`. In production it serves `dist/`, keeps API responses uncached, and does not mount `/api/testing/reset`.

## One external deployment action

1. Sign in to Render and choose **New → Blueprint**.
2. Connect `https://github.com/MuhammedJshi96/LabSpace-AI-Indexer`.
3. Select/confirm the repository Blueprint and free plan; do not add billing.
4. After the deploy succeeds, copy the `https://…onrender.com` URL into the Devpost and judge materials.

No credential belongs in this repository.

## Free-tier data behavior

Render free web services use an ephemeral filesystem. The SQLite database therefore starts from LabSpace's deterministic source-controlled seed after a restart, redeploy, or spin-down. This is suitable for a repeatable judge demo but is not durable production storage. A session's edits work normally while the instance remains live; export JSON for a portable copy. A production SaaS deployment should use a managed database or paid persistent disk.

## Production smoke test

Replace `$URL` with the deployed HTTPS origin:

```powershell
$URL = "https://your-service.onrender.com"
Invoke-RestMethod "$URL/api/health"
Invoke-WebRequest "$URL/" -UseBasicParsing
Invoke-WebRequest "$URL/digital-twin" -UseBasicParsing
```

Expected health response:

```json
{ "ok": true, "database": "sqlite", "schemaVersion": 2 }
```

Then use a WebMCP-capable top-level browser context to verify the six registered tools on `/` and `/digital-twin`, and no tools on the internal preview/capture routes. Do not set `Origin-Agent-Cluster: ?0`, expose tools cross-origin, or weaken the `tools` Permissions Policy.

Official hosting references:

- [Render Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Render web services](https://render.com/docs/web-services)
- [Render free instance limitations](https://render.com/docs/free)
- [Render persistent disks](https://render.com/docs/disks)
