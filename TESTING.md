# Testing

LabSpace Atlas is checked as one connected product: the domain model, WebMCP
contracts, authored assets, browser interactions, public persistence, and the
judge-facing Build → Stock → Find workflow all have automated coverage.

## Release gate

Run the complete local gate with:

```powershell
npm ci
npm run release:check
npm run test:e2e:webmcp
npm run test:e2e -- tests/e2e/render-quality.spec.ts
npm run test:e2e:public
```

`npm run release:check` includes linting, strict TypeScript, asset validation,
the Vitest suite, and the production build. The latest audited release passed:

- 63 Vitest files and 450 tests;
- 117 catalog definitions;
- 230 authored renders plus 4 intentional procedural construction renders;
- the production build and Render health check;
- the dedicated WebMCP, rendering-quality, and public-persistence browser suites.

The remaining build-size warning is non-blocking and tracked as a future code-
splitting improvement. It does not hide a failed test or asset-validation error.

## What the browser tests prove

The browser suites exercise the same interfaces a visitor uses:

- the twenty-four WebMCP tools register only on the supported top-level routes;
- room creation, blueprint review, inventory staging, spatial search, and
  collection guidance preserve the human approval boundary;
- read-only tools never mutate the workspace, and proposed changes remain
  previewable, cancellable, and undoable;
- exact-location results select the correct laboratory, room, object, and nested
  storage region, with a close evidence-oriented camera;
- public browser saves and named versions survive refreshes, server restarts,
  and deployments without merging one visitor's workspace into another;
- the Asset Studio and room renderer load the authored GLBs used by the catalog,
  while the Low / Balanced / High controls do not rewrite saved materials;
- the final public fixture contains only `LAB-D-00`, R-001, and R-002, with R-003
  intentionally absent until it is created during a live demonstration.

## Submission screenshots

Current product captures live in `docs/screenshots/submission-*.png`. Regenerate
them from the privacy-checked fixture with:

```powershell
npm run test:e2e:submission
```

The capture workflow selects **High** rendering quality and waits for the real
WebGL scene or authored model to report ready before taking an image. The README
uses these checked captures for WebMCP mission control, the tool registry, live
evidence, the Layout Editor, Inventory Studio, Spatial Index, and Asset Studio.

## Focused development checks

Use the smallest relevant test while editing, then run the complete release gate
before publishing. Useful focused commands include:

```powershell
npx vitest run tests/unit/camera-command.test.ts
npx vitest run tests/unit/webmcp-evals.test.ts
npx playwright test tests/e2e/submission-rehearsal.spec.ts
npx playwright test tests/e2e/submission-screenshots.spec.ts
npm run validate:assets
```

The WebMCP development examples in `docs/webmcp/LOCAL_TESTING.md` document the
public tool contract. Personal narration, timed presentation notes, and private
judge rehearsal scripts are deliberately kept outside the published repository.

## Production verification

After Render deploys `main`, verify the public origin rather than assuming that a
successful push updated production:

```powershell
$URL = "https://labspace-agent-twin.onrender.com"
Invoke-RestMethod "$URL/api/health"
Invoke-WebRequest "$URL/" -UseBasicParsing
Invoke-WebRequest "$URL/digital-twin" -UseBasicParsing
Invoke-WebRequest "$URL/inventory" -UseBasicParsing
```

The expected health response is:

```json
{ "ok": true, "database": "session-memory", "publicDemo": true, "schemaVersion": 2 }
```

Finally, use a WebMCP-capable top-level browser to confirm that the tools are
discoverable and that the visible workspace still contains the clean public
fixture. Do not use a private project export as the production seed.
