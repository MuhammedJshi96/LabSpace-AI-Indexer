# WebMCP system audit — 2026-09-01

## Audit boundary

- Repository: `D:\LabLayoutIndexer`
- Baseline commit: `fe4edb0`
- Scope: WebMCP discovery/registration, schemas and action-level validation, Reviewed/Fast Draft execution policy, staging, human approval/cancellation, Undo/Redo, inventory and collection, room/blueprint/annex/move/resize flows, activity evidence, and judge-facing workflows.
- Safety: no production URL writes, deploys, pushes, commits, room resets, public-snapshot changes, or production database access. Tests used the seed fixtures and Playwright's isolated `data/labspace-e2e.sqlite` workspace.
- Resource limit: one Vitest/Playwright worker, no full build, and no additional browser contexts.

## Executive result

The WebMCP trust boundary is coherent and demonstrable. All 23 tools register through one adapter, schemas exclude an agent-controlled execution mode, Reviewed is the volatile default, and Fast Draft is human-authorized and limited to additive room creation plus one complete pristine initial blueprint. Existing layouts, moves, resizes, annexes, inventory, stock, and destructive operations cannot silently pass that boundary. There is no tool for approval, delete, reset, import, unrestricted save, stock mutation, or mode selection.

The audit found and fixed one material reversibility defect: approved WebMCP inventory creation changed canonical inventory but did not create an editor history entry, so Undo did not reverse it. Inventory creation now uses a bounded project-wide `inventory-creation` command, supports Undo/Redo, clears Redo on approval, and records that evidence. The same pass tightened action-level expiry validation so impossible dates such as `2026-02-31` are rejected, and it added a direct bypass-field regression test.

Final targeted results: TypeScript passed; 9 WebMCP-focused unit/integration files passed with 51/51 tests; all 14 dedicated WebMCP browser cases reported `ok` with one worker. The original browser test process did not terminate after the fourteenth result and emitted no summary/exit code for more than 70 seconds, so it was manually interrupted. A bounded one-case follow-up proved that execution reached Playwright's managed `webServer` teardown and hung there after the assertion passed. The harness now owns the dedicated server and invokes an authenticated test-only graceful shutdown before Playwright attempts Windows process-tree termination. Static verification is clean, and an owner revalidation after the fix completed normally with Playwright reporting `1 passed (12.2s)` and the command exiting 0 in 14.8 seconds.

## Static findings

### 1. Tool discovery and lifecycle — pass

- `LABSPACE_WEBMCP_TOOL_NAMES` and the definitions expose exactly 23 bounded tools (`src/webmcp/register-labspace-tools.ts:52`).
- Registration uses `modelContext.registerTool(tool, { signal })`, tracks a registration-ready promise, and unregisters by aborting the controller (`src/webmcp/register-labspace-tools.ts:572-604`).
- The bridge waits for canonical project hydration before registration, reports registering/ready/error state, and never exposes actions against the temporary seed (`src/components/WebMCPBridge.tsx:6-39`).
- Registration, remount cleanup, Chrome-compatible execution without callback context, current-state reads, controlled errors, tool annotations, and schemas are covered by `tests/unit/webmcp-registration.test.ts`.
- Product-route registration and exclusion from internal asset/capture routes are covered by the browser suite.

### 2. Reviewed / Fast Draft boundary — pass

- The Zustand policy initializes to `reviewed` and is deliberately volatile (`src/agent/webmcp-execution-policy.ts:36-39`).
- Only human UI code receives `setModeFromHumanUi`; tool schemas contain no mode, approval, or bypass field.
- The Fast Draft allowlist contains only `create-room` and `initial-room-blueprint` (`src/agent/webmcp-execution-policy.ts:34`).
- Failed validation is fail-closed; non-allowlisted changes escalate to review; an initial blueprint also requires both `pristine === true` and `complete === true` (`src/agent/webmcp-execution-policy.ts:62-115`).
- The first-blueprint capability is in-memory, room-scoped, tied to dirty revision and scene timestamp, requires a truly empty editable room, and is consumed after the first room-plan commit (`src/agent/labspace-workspace-actions.ts:13-175`, `src/agent/labspace-staging-actions.ts:639-650,1174-1176`).
- Browser coverage proves Reviewed on entry/reload, human Fast Draft opt-in, bounded automatic creation, incomplete and later plans escalating, and move/resize/inventory remaining reviewed.

### 3. Staging and human review — pass

- Move, resize, room plan, inventory plan, workspace creation, and annex staging all reject competing pending changes and unsaved human edits.
- Identical repeated stages are idempotent; unrelated second proposals are rejected.
- Stage inputs accept only a canonical plan ID or explicit bounded movement/resize data. Action functions revalidate unknown input even if a browser fails to enforce JSON Schema.
- Plans bind to current project/room/scene identity and timestamps. Approval fails closed if dirty revision, project/room timestamps, object identity, room size, spaces, or proposed scene no longer matches.
- Approval and cancellation are intentionally absent from the 23-tool surface. `AgentReviewPanel` is the sole visible human control and calls `approveStagedChange` / `cancelStagedChange` with the current stage ID.
- Cancel removes a matching preview and restores recorded timestamps/data; stale cancellation does not overwrite a newer human state.

### 4. Mutation coverage and reversibility — pass after fix

| Flow                | Result                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blank room          | Reviewed proposal by default; human approval creates it. Fast Draft may apply only the validated additive room.                                                |
| First blueprint     | Reviewed by default; only a complete plan in the pristine capability room can Fast Draft commit; one scene history command and Undo.                           |
| Later room plan     | Always preview/review; atomic scene, room size, spaces, assets and index records; cancel/approve/Undo tested.                                                  |
| Annex               | Always reviewed, including in Fast Draft; stable host split, independent floor, openings remapped; cancel/approve/Undo unit-tested.                            |
| Object move         | Validate first; invalid input creates no preview; valid preview is not persisted; stale approval rejected; cancel/approve/Undo/Redo and save lifecycle tested. |
| Resize              | Hosted-opening bounds/overlap validation; reviewed preview; cancel/approve/Undo tested.                                                                        |
| Inventory creation  | Always reviewed. **Fixed in this audit:** approval now adds one project-wide history command and Undo/Redo removes/recreates the approved records.             |
| Stock updates       | No WebMCP mutation tool exists. Material resolution and collection are evidence/navigation only and never deduct or reserve stock.                             |
| Destructive changes | No WebMCP delete/reset/import/reindex/unrestricted-save tool exists. Eval fixtures explicitly forbid these routes.                                             |

### 5. Schemas and validation — pass after fix

- Tool schemas use bounded lengths/counts/ranges and `additionalProperties: false`; native action normalizers repeat critical checks.
- `create_room` accepts only name, code, laboratory selector, and user-facing floor 1–15; it rejects duplicate codes and hidden templates.
- Room planning caps assets, quantities and candidate positions, validates polygon closure/non-crossing, hosted openings, wall indexes, elevations, support and collision geometry.
- Inventory caps 1–20 entries, requires canonical editable room codes, verifies the storage location belongs to that room, rejects fabricated extra fields, and now rejects impossible calendar dates.
- Error handling exposes controlled user-facing messages and hides unexpected stacks/filesystem detail.

### 6. Activity evidence — pass with one residual risk

- Every registered execution records a bounded WebMCP event with actor, status, tool name, input, result, correlation ID and room ID (`src/agent/agent-activity-store.ts:259-281`).
- Request/response payloads are capped at 420 characters and scrub obvious local filesystem paths (`src/agent/agent-activity-store.ts:7,81-95`).
- Human mode selection, proposal, approval/rejection, commit, Fast Draft decisions and collection checkpoints record separate factual events.
- JSON and CSV activity export exists (`src/agent/agent-activity-store.ts:143-195`).
- Residual P2: the in-memory/localStorage activity event array has no count/age cap. Quota errors are contained, but a very long-lived commercial session can grow memory. Add a generous retention policy or project-scoped archive before multi-user production use.

### 7. Judge workflows and commercial clarity — pass with documentation correction

- The Inspector and judge guide explain where the browser agent runs, show connection/tool evidence, provide copyable workflows, distinguish suggestions from inventory facts, and state that collection is not a protocol, safety approval, or verified pedestrian route.
- The scorecard had stale counts (21 tools and 10 browser cases). It now reports the verified 23 tools and 14 browser cases.
- Residual P2: several broader release-count claims in the scorecard (total assets/renders/tests) were not revalidated in this bounded WebMCP audit. Refresh them only from the final full release gate.

### 8. Windows Playwright teardown — root cause isolated and harness fix applied

- The full suite and a separate one-case reproduction both printed successful assertions before hanging.
- With `DEBUG=pw:webserver`, the one-case run logged `Terminating the WebServer` and never logged `Terminated the WebServer`. The server had been started by Playwright in that run; this excludes assertion, worker, and reused-server causes.
- Playwright 1.61.1 documents that graceful `SIGINT`/`SIGTERM` shutdown is ignored on Windows. Its fallback force-kills a shell process tree and waits for the spawned shell's close event. That close wait is the point that did not resolve for `node --import tsx server/index.ts`.
- `playwright.config.ts` now gives every run a random shutdown token, disables `reuseExistingServer`, and passes the token only to the owned E2E server.
- A global teardown hook posts the token to a development-only `/api/testing/shutdown` route. The route responds first, then calls the server's existing orderly shutdown path (HTTP connections, Vite middleware, SQLite repository and public-demo sessions). Playwright's web-server plugin subsequently sees an already-closed process instead of invoking the hanging Windows fallback.
- The shutdown route does not exist in production and rejects requests without the per-run token. Product APIs and data behavior are unchanged.
- `prettier`, targeted ESLint and `tsc --noEmit` pass after the fix.
- Post-fix verification: the owner ran one focused case after the harness change. Playwright reported `1 passed (12.2s)`, and the command exited normally with code 0 in 14.8 seconds. This confirms that the managed server and browser worker now tear down cleanly for the bounded Windows reproduction path.

## Commands and exact results

1. Prerequisite and source discovery:

   - `Get-Command npx` → `D:\Program Files\nodejs\npx.ps1`.
   - `rg ... src tests docs package.json` → identified the 23-tool adapter, policy, staging actions, schemas, evals and browser suite.

2. First single-worker Vitest attempt:

   - `npx vitest run ... --maxWorkers=1 --minWorkers=1`
   - Result: command error before tests, because Vitest 4.1.10 does not support `--minWorkers`.

3. Corrected targeted baseline:

   - `npx vitest run tests/unit/webmcp-registration.test.ts tests/unit/webmcp-execution-policy.test.ts tests/unit/labspace-staging-actions.test.ts tests/unit/labspace-workspace-actions.test.ts tests/unit/labspace-annex-actions.test.ts tests/unit/labspace-inventory-actions.test.ts tests/unit/agent-activity-store.test.ts tests/unit/webmcp-evals.test.ts tests/unit/execute-tool-compat.test.ts --maxWorkers=1 --no-file-parallelism`
   - Baseline result: 9 files passed, 50 tests passed.

4. Dedicated browser journey:

   - `npm run test:e2e:webmcp -- --workers=1`
   - Result stream: all 14 cases individually reported `ok`, including inventory/collection, Ctrl+D/Undo, exact 23-tool route registration, audit, judge header, responsive dialogs, reviewed blueprint, Reviewed/Fast Draft boundary, cross-room evidence, dismissible focus, cabinet access, asset preview, valid placements, and reviewed move persistence/reversal.
   - Teardown: after test 14 reported `ok`, the process produced no further output and did not terminate for more than 70 seconds. It was stopped with Ctrl+C, producing shell exit code 1. The assertion results are 14/14 pass; the invocation exit status is not clean because of the manual termination. Investigate Playwright/web-server teardown on Windows.

5. In-app browser availability check:

   - Local preview health: `Invoke-WebRequest http://localhost:3004/` → HTTP 200.
   - Browser runtime selection for that URL → `No browser is available`; the documented availability check returned `[]`.
   - No fallback browser context was created. Live WebMCP browser injection could not be independently inspected in this environment; the isolated Playwright WebMCP shim remains the browser-facing evidence.

6. Regression after scoped fix:

   - First focused run found the expected missing history routing: 1 failure (`Undo` left 11 rather than 10 items), which exposed that the editor dispatcher did not yet recognize the new command kind.
   - Added `inventory-creation` to `applyHistoryCommandToProject`.
   - Corrected focused run: 4 files passed, 34 tests passed.
   - `npm run typecheck` → passed (`tsc --noEmit`).
   - Final targeted run (same 9 files): 9 files passed, 51 tests passed.

7. Bounded Windows teardown reproduction:

   - Command: `$env:PWTEST_CHILD_PROCESS_TIMEOUT='15000'; $env:DEBUG='pw:webserver'; npx playwright test tests/e2e/webmcp-actions.spec.ts -g 'audits canonical room readiness' --workers=1 --reporter=list`
   - Test result: the one selected case reported `ok` in 3.8 seconds.
   - Lifecycle evidence: the trace logged Playwright starting its own port-3104 server, health returning 200, the assertion passing, and then `pw:webserver Terminating the WebServer` with no corresponding `Terminated the WebServer`. The process remained blocked until manually interrupted. No port-3104 listener remained after interruption.
   - This was the only browser run in the follow-up. No post-fix browser process was opened.

8. Static verification of the teardown fix:

   - `npx prettier --write playwright.config.ts server/index.ts tests/e2e/global-teardown.ts docs/qa/WEBMCP_SYSTEM_AUDIT_2026-09-01.md` → clean.
   - `npx eslint playwright.config.ts server/index.ts tests/e2e/global-teardown.ts` → passed.
   - `npm run typecheck` → passed (`tsc --noEmit`).

9. Owner clean-exit revalidation after the teardown fix:

   - Command: `npx playwright test tests/e2e/webmcp-actions.spec.ts -g "registers exactly twenty-three tools" --workers=1 --reporter=list`
   - Result: Playwright reported `1 passed (12.2s)`; the selected case took 10.2 seconds, and the command exited 0 in 14.8 seconds.
   - This closes the bounded teardown verification item while preserving the original full-suite and one-case hang evidence above.

## Changed files

- `src/agent/labspace-inventory-actions.ts` — real ISO calendar-date validation.
- `src/agent/labspace-staging-actions.ts` — approved inventory uses one history command and records Undo evidence.
- `src/domain/inventory-organization.ts` — bounded project-wide `inventory-creation` command and apply/revert logic.
- `src/store/editor-store.ts` — routes inventory-creation through organization history for Undo/Redo.
- `tests/unit/labspace-inventory-actions.test.ts` — Undo/Redo, impossible-date and agent bypass-field regressions.
- `docs/webmcp/CHALLENGE_SCORECARD.md` — verified tool/browser-case counts and audit date.
- `docs/qa/WEBMCP_SYSTEM_AUDIT_2026-09-01.md` — this audit record.
- `playwright.config.ts` — dedicated-server ownership, per-run shutdown token and global teardown.
- `server/index.ts` — authenticated development-only E2E shutdown route reusing the existing orderly server shutdown.
- `tests/e2e/global-teardown.ts` — bounded graceful shutdown before Playwright's Windows web-server cleanup.

No commit, push or deployment was performed.
