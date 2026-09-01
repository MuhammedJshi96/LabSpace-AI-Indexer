# Core Product Audit — 2026-09-01

## Outcome

**Core product status: pass after two test-harness expectation corrections.**

- Branch audited: `codex/local-render-quality`
- Starting revision: `fe4edb0`
- Domain/store coverage: **28 files, 156 tests passed**
- Browser coverage: **41 distinct core scenarios passed** with one Playwright worker
- Combined product E2E inventory: **55/55 distinct scenarios passed** — 41 core plus 14 WebMCP
- TypeScript: passed
- Targeted ESLint: passed
- Product defects found in the exercised flows: **0 reproducible blockers**
- Test defects corrected: **2 stale assertions**
- QA-infrastructure follow-up: the Windows managed-server teardown hang was isolated, fixed and revalidated with normal exit 0

This audit did not run a production build, publish code, deploy the site, access the hosted production database, reset a user workspace, or change a saved user/demo room. Browser tests used the repository's isolated E2E database at `data/labspace-e2e.sqlite` and disposable fixture records.

## Resource controls

- Playwright configuration was kept at `workers: 1`; every invocation also specified `--workers=1`.
- Vitest used `--maxWorkers=1 --no-file-parallelism`.
- Tests were divided into bounded sequential groups rather than opened in parallel.
- No extra manual browser context was opened.
- No trace or video recording was enabled.
- Finished Playwright runners that remained idle after all assertion results were printed were stopped instead of being left resident.
- No production build was run.

## Coverage ledger

| System                                | Evidence exercised                                                                                                                                                                                           | Result | Notes                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------ |
| Project / laboratory / room lifecycle | Blank project, laboratory and room creation, room switching, demo ownership, repository persistence, versions, export and reload                                                                             | Pass   | User-owned demo geometry and saved camera state remained independent of factory templates. |
| Layout Editor construction            | Continuous walls, zero-length protection, half-height walls, rectangular primary room, attached rectangular annex, freeform annex, wall endpoint/side editing and joint continuity                           | Pass   | Rectangle/annex browser flow remained one atomic Undo command.                             |
| Placement and transforms              | Asset drag/drop, move, resize, chair knee-space snapping, multi-selection rigid movement, wall-hosted opening movement, Ctrl-constrained wall movement and Undo/Redo                                         | Pass   | No inventory identities were changed by geometry edits.                                    |
| Doors, windows and validation         | Nearest-wall hosting, clamping, host transforms, professional defaults, impossible fits, sibling overlap, obstacle validation                                                                                | Pass   | Layout validation remained available from both editor and Spatial Index flows.             |
| Facility                              | Floor inference, side-by-side packing, saved coordinates, floor setter 1–15, facility discovery and exact inspector room routing                                                                             | Pass   | Facility selected the requested room rather than the prior active room.                    |
| Inventory Studio                      | Stock list, bulk named assignment, Undo/Redo, exact address, compact widths, URL image, local file image and reload                                                                                          | Pass   | Image sources and assignments survived persistence without geometry or stock drift.        |
| Storage workspace                     | Cabinet chooser, physical map, keyboard map navigation, long/custom names, drag/drop multi-assignment, exact-location creation, openable access preview and return to map                                    | Pass   | Canonical IDs, anatomy bindings and stock facts were preserved.                            |
| Spatial Index                         | Cross-room/cross-lab search, exact equipment/inventory evidence, camera focus, correct authored face, automatic verified access preview, Close/Reopen preview, collection Next/Previous and validation trace | Pass   | Explicit exact-location selection automatically opened the verified drawer as designed.    |
| Asset Studio / catalog                | Real 3D pixels, studio navigation, thumbnail contain/alignment, architectural primitives excluded, archive visibility and lifecycle                                                                          | Pass   | Catalog archiving remained non-destructive in store coverage.                              |
| Render quality                        | Low/Balanced/High budgets, reversible color management, preference propagation across Room/Spatial Index/Facility, buffer release and content isolation                                                      | Pass   | Quality changes did not rewrite project, camera, geometry or open storage state.           |
| Reload / autosave safety              | Inventory reload, renamed storage reload, versions, repository load/save and completed-autosave race                                                                                                         | Pass   | A completed older autosave did not overwrite newer 2D edits.                               |

## Exact commands and results

### Prerequisite

```powershell
$npx = Get-Command npx -ErrorAction SilentlyContinue; if ($null -eq $npx) { exit 1 }; $npx.Source
```

Result: `D:\Program Files\nodejs\npx.ps1`.

### Domain and store audit

```powershell
npx vitest run tests/unit/project-workspace.test.ts tests/unit/repository.test.ts tests/unit/demo-ownership.test.ts tests/unit/facility.test.ts tests/unit/room-building.test.ts tests/unit/wall-drawing.test.ts tests/unit/wall-editing.test.ts tests/unit/selection-drag.test.ts tests/unit/wall-openings.test.ts tests/unit/geometry.test.ts tests/unit/object-transforms.test.ts tests/unit/chair-snapping.test.ts tests/unit/blueprint.test.ts tests/unit/layers.test.ts tests/unit/inventory-image.test.ts tests/unit/inventory-organization.test.ts tests/unit/storage-workspace.test.ts tests/unit/storage-map.test.ts tests/unit/storage-access.test.ts tests/unit/storage-catalog.test.ts tests/unit/storage-display.test.ts tests/unit/storage-highlight.test.ts tests/unit/digital-twin-index.test.ts tests/unit/camera-command.test.ts tests/unit/collection-guide.test.ts tests/unit/asset-thumbnail.test.ts tests/unit/render-quality.test.ts tests/unit/editor-view-preferences.test.ts --maxWorkers=1 --no-file-parallelism
```

Result: **28 files passed, 156 tests passed**, 7.96 s Vitest duration.

### Construction, Facility and Asset Studio shell

```powershell
npx playwright test tests/e2e/floor-generation.spec.ts tests/e2e/plan-interactions.spec.ts tests/e2e/workspace-polish.spec.ts --workers=1 --reporter=list
```

Result: **12/12 assertions passed**. Covered floor closure, rectangle/annex/Undo, pan, asset movement, connected wall movement, room/facility discovery, blueprint/measurement, exact Facility routing, responsive shell, project Create flow, catalog construction exclusions, archived asset evidence and thumbnail alignment. Runner was manually stopped only after all 12 pass lines because teardown remained resident.

### Inventory and Storage

```powershell
npx playwright test tests/e2e/inventory-organization.spec.ts --workers=1 --reporter=list
```

Initial result: 7 scenarios passed; the map drag/drop scenario completed the assignment but its final assertion compared the pre-serialization fixture with the server-normalized storage schema. The persisted server object correctly added primary `spaceId` values and omitted an `undefined` `anatomyKey`.

Correction: capture the normalized persisted fixture immediately after fixture PUT, then verify that drag/drop does not change those normalized storage records.

```powershell
npx playwright test tests/e2e/inventory-organization.spec.ts -g "row selection feeds the physical map" --workers=1 --reporter=list
```

Focused result after correction: **1/1 passed**. Therefore all **8 distinct Inventory/Storage scenarios passed**.

### Spatial Index, access preview and render isolation

```powershell
npx playwright test tests/e2e/build-week-demo.spec.ts tests/e2e/render-quality.spec.ts --workers=1 --reporter=list
```

Initial result: both render-quality scenarios passed. The first serial Spatial Index scenario reached and opened the correct physical drawer automatically, but the old assertion looked for `Show access preview`; the page correctly displayed `Close access preview`. The two following serial cases were skipped by Playwright after that stale assertion.

Correction: verify automatic open, Close, manual Reopen and Close again.

```powershell
npx playwright test tests/e2e/build-week-demo.spec.ts --workers=1 --reporter=list
```

Result after correction: **3/3 passed**. The exact-location scenario took approximately 1.3 minutes in software WebGL; identifier containment and validation trace also passed.

### Core editor, persistence and cross-room routing

```powershell
npx playwright test tests/e2e/editor.spec.ts -g "application starts empty|3D canvas renders real pixels|Spatial Index links indexed|project search switches|asset can be dragged|cabinet receives indexed|undo, redo, layer visibility|completed autosave" --workers=1 --reporter=list
```

Result: **8/8 passed**. Covered empty start/demo ownership, real 3D/Asset Studio, Spatial Index-to-editor trace, cross-lab routing, asset movement/resize, indexed cabinet internals, Undo/Redo/layers/versions/export/reload and autosave ordering.

### Static verification for the corrected tests

```powershell
npx eslint tests/e2e/inventory-organization.spec.ts tests/e2e/build-week-demo.spec.ts --max-warnings=0
npm run typecheck
```

Result: both passed. No production build was run.

## Owner completion evidence

After this audit's original **33 core browser scenarios**, the owner exercised the eight editor scenarios that were not yet included in the core ledger. All eight now pass, bringing the verified core inventory to **41/41 distinct scenarios**. Combined with the separately audited **14/14 WebMCP scenarios**, the complete product E2E inventory is **55/55**.

| Additional editor evidence                      | Result                     | Completion note                                                                                                                                                                     |
| ----------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orientation-cube commands                       | Pass                       | Passed on the initial owner run.                                                                                                                                                    |
| Asset favorite persistence                      | Pass                       | Passed on the initial owner run.                                                                                                                                                    |
| Spatial Index 2D fallback and editor deep link  | Pass, 1/1 with exit 0      | The test was made independent through isolated reset and canonical editable-room selection.                                                                                         |
| Spatial Index selected-inventory evidence image | Pass, 1/1 with exit 0      | The test was made independent through isolated reset and canonical editable-room selection.                                                                                         |
| Split-divider interaction                       | Pass                       | Keyboard resizing remained functional.                                                                                                                                              |
| 2D / Split / 3D presentation mounting           | Pass                       | All presentation surfaces remained mounted as intended.                                                                                                                             |
| Principal editor screenshot and typography      | Pass, 1/1 after correction | The screenshot exposed three 10 px Annex Builder labels. They were raised to the approved 11 px tertiary minimum in `src/components/InspectorStudio.css`, then the scenario passed. |
| Asset-browser framing                           | Pass, 1/1                  | Both large equipment and small instruments remained contained and readable.                                                                                                         |

The owner also redirected generated test artifacts from `docs/screenshots` to `test-results`, so QA execution no longer mutates tracked documentation. These completion changes belong to the owner, not to the original core-audit patch: `tests/e2e/editor.spec.ts` and `src/components/InspectorStudio.css`.

## Findings and corrections

### Corrected — persisted-baseline assertion in Storage drag/drop test

The test constructed fixture storage records in memory and later expected byte-for-byte equality after a JSON/server round trip. Normal project loading enriches storage records with the room's primary `spaceId`; JSON also removes fields whose value is `undefined`. The storage assignment did not create this change and did not alter geometry, location identity, anatomy, names, stock or assignment targets.

The corrected test compares the post-operation storage records with the normalized persisted fixture captured before the UI operation.

### Corrected — automatic Spatial Index access-preview expectation

The approved product behavior automatically opens verified storage when an inventory/location record is explicitly selected. The test still assumed opt-in-only behavior and searched for `Show access preview`, even though the correct `Close access preview` button and opened drawer were visible.

The corrected sequence verifies automatic open, user Close, manual Reopen, and final Close without saved project changes.

### Resolved after this pass — Playwright teardown

Every bounded Playwright invocation in the original core pass printed its complete final test result(s), then stayed alive without producing its usual summary/exit. This occurred for passing groups as well as groups containing a stale assertion. The finished runner was interrupted after the final result line to avoid idle memory consumption.

The follow-up WebMCP audit proved the hang occurred in Playwright's Windows managed-`webServer` termination after assertions—not in the product or browser worker. The harness now owns the dedicated server and invokes a token-protected development-only graceful shutdown from global teardown. The owner revalidated the original bounded reproduction with a normal summary and exit 0, and all subsequent owner browser batches also exited cleanly. The original evidence remains documented in `docs/qa/WEBMCP_SYSTEM_AUDIT_2026-09-01.md`.

## Commercial/judge-flow observations

- The product now demonstrates a credible end-to-end commercial story: create or select a room, construct/measure it, place assets, name storage, record stock with evidence images, search exact locations, automatically expose the real drawer, step through a collection guide, and retain human-controlled changes with Undo and activity evidence.
- The strongest in-app proof is the exact-location transition: search results preserve the live room context, camera focus follows the authored storage face, and the physical drawer preview opens without changing stock or geometry.
- Facility routing, cross-laboratory search, durable naming, image evidence and reversible render quality support a professional multi-room demonstration rather than a single static scene.
- For submission-day reliability, keep the demo workflow short enough to avoid software-WebGL delays on weak judge hardware. Balanced rendering remains the safest default.

## Changed files from this audit

- `tests/e2e/inventory-organization.spec.ts`
- `tests/e2e/build-week-demo.spec.ts`
- `docs/qa/CORE_PRODUCT_AUDIT_2026-09-01.md`

No application source file was changed by this core audit.
