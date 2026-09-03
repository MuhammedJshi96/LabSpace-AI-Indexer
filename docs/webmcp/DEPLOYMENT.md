# WebMCP Challenge deployment

LabSpace is a stateful Node/Express application with a Vite frontend. Local development keeps the SQLite repository. The public app saves each browser's project and named versions in IndexedDB; temporary server sessions are used only to bootstrap first-time visitors. Deployment uses the root `render.yaml` Blueprint.

Live judge service: [https://labspace-agent-twin.onrender.com](https://labspace-agent-twin.onrender.com)

## Render Blueprint

The Blueprint creates one Node web service from the single release branch, `main`:

- build: `npm ci --include=dev && npm run build` (the TypeScript build uses
  development-only type packages even though the deployed runtime is production)
- start: `npm run start`
- health check: `/api/health`
- public judge data: durable same-browser IndexedDB, with isolated server-session bootstrap
- no runtime model API key or application secret required

The server binds to Render's `PORT` on `0.0.0.0`. In production it serves `dist/`, keeps API responses uncached, and does not mount `/api/testing/reset`.

## Create or reconnect the deployment

1. Sign in to Render and choose **New → Blueprint**.
2. Connect `https://github.com/MuhammedJshi96/LabSpace-AI-Indexer`.
3. Select the repository Blueprint and the service plan assigned to the project in the Render dashboard.
4. After the deploy succeeds, verify the public HTTPS URL and `/api/health`.

No credential belongs in this repository.

## Public judge-session behavior

With `LABSPACE_PUBLIC_DEMO=1`, first-time visitors adopt their current server-session project and named room versions into IndexedDB. If no prior server session exists, the approved `server/public-showcase-project.json` provides the initial project. The final submission fixture is a privacy-checked, laboratory-filtered export containing only `LAB-D-00`, R-001 and R-002; R-003 is created live. It does not replace existing browser workspaces, local SQLite, or test seeds.

Once a browser workspace exists, it is the authoritative save. Loads do not depend on project APIs and never merge with or replace it from the server snapshot. Project saves resolve only after an atomic IndexedDB transaction completes. Named versions use the same database. Render restarts, deployments, four-hour server-session expiry and cookie removal do not reset browser saves. Database names are stable across build revisions. Revision checks prevent stale tabs from overwriting newer saves. Invalid saved data is not overwritten with defaults; quota/permission failures show an actionable error and leave current unsaved work exportable.

This is **same-browser, same-origin, same-device persistence**, not cloud/account sync. Clearing site data, private-browsing cleanup, device loss or browser eviction can remove the saved copy. Export project JSON for backup and import it explicitly elsewhere. JSON contains the current full project, not the separate named-version archive. Never replace the public snapshot with a user's private project to implement persistence. Authentication and a managed database with organization isolation remain necessary for shared multi-user/cloud storage.

The server still limits bootstrap memory sessions to four hours/250 entries. `/api/health` therefore reports `session-memory`; it describes the server, not the browser's authoritative project storage.

## Persistence regression test

Run `npm run build` then `npm run test:e2e:public`. The suite owns an isolated production/public-mode server on port 3114, creates rooms through the UI, verifies exported project identity through reload and a real process restart, checks version survival, disables project APIs, checks browser isolation and stale-tab conflicts, and simulates a storage-quota failure. It never resets or stops the user's development server.

### Verification — 2026-09-03

- Release checks passed: lint, strict TypeScript, 117 asset definitions, 234 catalog renders, 63 unit/integration files / 450 tests and the production build. Existing large-bundle warnings remain non-blocking.
- Public persistence: 7/7 browser tests passed, including real server restart, full project export equality, named versions, visitor isolation, stale tabs, storage failures, incompatible data, explicit import and deletion without reseeding.
- The dedicated final-submission browser rehearsal passes the complete Build, Stock, and Find-the-work story against isolated test data.
- The public judge fixture contains only `LAB-D-00`, R-001 and R-002; R-003 is absent until the live demonstration creates it.

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

Then use a WebMCP-capable top-level browser context to verify the twenty-four registered tools on `/`, `/digital-twin`, and `/inventory`, and no tools on internal `/asset-preview`, `/facility`, or capture routes. Do not set `Origin-Agent-Cluster: ?0`, expose tools cross-origin, or weaken the `tools` Permissions Policy.

Official hosting references:

- [Render Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Render web services](https://render.com/docs/web-services)
- [Render persistent disks](https://render.com/docs/disks)
