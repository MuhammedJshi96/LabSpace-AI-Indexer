# LabSpace Atlas — commercial and judge-readiness audit

**Audit date:** 2026-09-01  
**Method:** independent static/source audit followed by one narrow, memory-bounded evidence-retention hardening pass. No server, browser, build, or Playwright process was started. One focused unit file, targeted ESLint, and TypeScript were run sequentially.  
**Data boundary:** no room, laboratory, demo snapshot, asset, database, dependency, deployment, commit, tag, or remote branch was changed.

## Executive assessment

**Competition positioning: strong; the final local release gate passed.** LabSpace has a differentiated and demonstrable WebMCP story: 23 semantic browser tools operate on the same canonical spatial model as the visible product; deterministic geometry and inventory facts stay authoritative; project mutations begin behind a visible human review boundary; and exact physical evidence remains visible in the normal interface. The user-approved DEMO-01 remediation is now readiness-clean; release-tag decisions remain with the owner.

**Commercial deployment positioning: credible single-user pilot, not yet a shared production service.** The current public build is appropriate as a no-account judge demo with same-browser persistence. It must not be presented as authenticated cloud sync, a certified safety/compliance product, a protocol engine, a stock-consumption system, or a permanent audit service. Real laboratory deployment still needs identity, authorization, tenant isolation, retention, security operations, and measured customer outcomes.

### Severity legend

- **Pass** — source and current product copy support the claim.
- **Attention** — credible for the challenge, but should be disclosed or improved before a commercial pilot.
- **Blocker** — resolve before calling the current branch/tag a verified final submission or before storing real multi-user laboratory data.

## Release decision matrix

| Area                                     | Status                                          | Evidence and decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product category and buyer               | Pass                                            | The application clearly connects laboratory design, physical inventory, exact storage evidence, and browser-agent action. The primary buyer is a laboratory operations/facilities manager; researchers are daily operators. `README.md:9-15`, `docs/webmcp/submission/DEVPOST_SUBMISSION.md:11-21`.                                                                                                                                                                                                                                                                                                                     |
| Canonical WebMCP surface                 | Pass                                            | `LABSPACE_WEBMCP_TOOL_NAMES` contains exactly 23 names, and the definition array covers the same capabilities (`src/webmcp/register-labspace-tools.ts:52-76,186-569`). Current in-product and judge copy now consistently says 23.                                                                                                                                                                                                                                                                                                                                                                                      |
| Human execution boundary                 | Pass                                            | Every session initializes to Reviewed; Fast Draft allowlists only additive room creation and a complete pristine first blueprint; invalid, existing-state, inventory, stock, and destructive changes fail closed or require review (`src/agent/webmcp-execution-policy.ts:34-115`). No tool schema exposes the human mode setter.                                                                                                                                                                                                                                                                                       |
| Grounding and safety language            | Pass                                            | Material resolution refuses to certify protocols/substitutions (`src/webmcp/register-labspace-tools.ts:218-231`); collection is explicitly not a verified route, safety instruction, permission, stock deduction, or certified audit log (`src/webmcp/register-labspace-tools.ts:234-263`, `src/agent/labspace-collection-actions.ts:312`). Spatial results also disclaim regulatory certification (`src/agent/labspace-spatial-actions.ts:171,709`).                                                                                                                                                                   |
| Judge onboarding                         | Pass with attention                             | The README leads with the live URL, wake-up expectation, inspector, tool table, and copy-ready workflows (`README.md:11-71`). The in-product Inspector explains ChatGPT, optional Chrome surfaces, and manual JSON verification (`src/components/AgentActivityPanel.tsx:647-736`). Chrome WebMCP remains experimental and flag-dependent, so the ChatGPT in-app browser should remain the recommended path.                                                                                                                                                                                                             |
| Current release test sign-off            | Pass                                            | The Windows managed-server teardown hang was isolated and fixed with a token-protected development-only graceful shutdown. The owner then verified a normal Playwright summary/exit, completed all 55 product browser scenarios and all 7 public-persistence scenarios, and passed lint, strict TypeScript, 59 files/420 tests, asset validation and the production build (`docs/qa/RELEASE_CANDIDATE_SYSTEM_AUDIT_2026-09-01.md`).                                                                                                                                                                                     |
| Submission-demo content                  | Pass                                            | The user approved a reversible correction of the three affected DEMO-01 transforms. The saved room and published fresh-session snapshot now return `ready` with zero deterministic errors or warnings, and a regression test protects that release condition (`docs/qa/RELEASE_CANDIDATE_SYSTEM_AUDIT_2026-09-01.md`). Existing online visitor workspaces remain independent and are not overwritten.                                                                                                                                                                                                                   |
| Published evidence identity              | Pass                                            | The owner approved publication after the final gate. Judge and submission documents now reference the new immutable `webmcp-submission-v1.3` tag; earlier tags remain unchanged as historical candidates.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Persistence and recovery                 | Pass for demo/pilot                             | Public saves are explicitly same-browser/device IndexedDB, not account/cloud sync, and the UI offers JSON backup plus a save-failure export path (`README.md:247`, `docs/webmcp/DEPLOYMENT.md:29-37`, `src/components/ProjectSaveLifecycle.tsx:57-68`). Stale tabs and invalid saved data are designed to fail closed. Named versions and browser project data are distinct; JSON export is the portable project backup, not a cloud account.                                                                                                                                                                           |
| Security for a shared commercial service | **Blocker for real data**                       | Development mode has no auth and listens on all interfaces (`server/index.ts:20-32,143-147`). The public demo has isolated temporary sessions and browser persistence, but no authentication, organization authorization, CSRF/origin enforcement, rate limiting, complete CSP, or tenant repository policy. Basic headers and a 12 MB JSON limit are present. `SECURITY_NOTES.md` now describes this boundary accurately.                                                                                                                                                                                              |
| Privacy and evidence retention           | Pass with attention                             | No telemetry/analytics/model API is present. This audit now caps memory/localStorage at the newest 500 bounded events, caps unread count, sanitizes legacy events on load, redacts raw and JSON-escaped local paths containing spaces, explains retained/export semantics, and confirms destructive Clear (`src/agent/agent-activity-store.ts:3-10,76-149,226-269`, `src/components/AgentActivityPanel.tsx:340-370,490-550`). Evidence is still browser-local, not project-scoped, immutable, or tamper-proof; add organization/project scope and a formal retention policy before a multi-user pilot.                  |
| Accessibility and recovery UI            | Pass with attention                             | Main workspaces use semantic landmarks, empty states, retryable renderer boundaries, alerts, labeled inputs, and export-on-save-failure (`src/App.tsx:55-65`, `src/components/DigitalTwinPage.tsx:55-68`, `src/components/InventoryPage.tsx:202-340`). The WebMCP tablist lacks tab IDs/`aria-controls`, roving tab focus, and arrow-key handling (`src/components/AgentActivityPanel.tsx:464-480`), and custom modal sections close on Escape but do not implement a complete focus trap/return contract (`src/components/Dialogs.tsx:46-89`). Schedule keyboard/screen-reader verification before a commercial pilot. |
| Licensing and provenance                 | Pass                                            | Apache-2.0 source and separately reserved visual assets are clearly separated. Original planning models are described as logo-free, reference-informed, and non-certified (`LICENSE-ASSETS.md:5-45`, `ASSET_LICENSES.md:3-38`). Public release still requires the owner to confirm redistribution rights for every referenced or user-supplied image.                                                                                                                                                                                                                                                                   |
| Business proof and pricing               | Attention                                       | No pricing is claimed, which is preferable to inventing it. No measured time-to-find, assignment-completion, error-prevention, retention, or willingness-to-pay evidence exists. Describe impact as a hypothesis and instrument a future pilot before making ROI claims. A commercial website will also need owner/contact, privacy, terms, support expectations, and data-processing language.                                                                                                                                                                                                                         |

## Documentation consistency audit

### Corrected in this pass

- Current user-visible catalog counts are now **104 authored GLBs**, with **106 total definitions** including the two hidden procedural wall primitives. Stale 94/96/39 counts were corrected in `README.md`, `ROADMAP.md`, `ASSET_LICENSES.md`, `docs/webmcp/CHALLENGE_EVIDENCE.md`, and `docs/webmcp/CHALLENGE_SCORECARD.md`.
- The current Devpost draft now names all **23** capabilities; it previously said 23 but enumerated only 21, omitting annex planning and staging. Its testing instructions previously said 16 tools.
- The WebMCP demo checklist now expects all **14** current browser cases and, importantly, a clean process exit instead of the stale 7/7 claim.
- The scorecard no longer freezes obsolete unit-test/render totals; the dated final release audit should own totals after the gate finishes.
- The README and roadmap now acknowledge implemented project/laboratory/room rename and guarded room deletion instead of describing them as missing.
- Security notes now distinguish local development, the isolated public judge demo, and the requirements for a real shared deployment. They also disclose that a user-selected online inventory image host receives a normal browser request.
- The activity UI now says **total recorded**, not **total persisted**, because localStorage quota failure intentionally leaves the session evidence in memory.
- Agent Activity now retains the newest 500 events rather than growing without bound. Paging and filtered JSON/CSV export remain newest-first; quota failure leaves only the retained in-tab window available.
- Raw evidence and JSON-stringified tool payloads now redact Windows/macOS/Linux local paths containing spaces or JSON-escaped separators, including legacy records when loaded.
- Clearing retained activity now asks for confirmation and recommends exporting first.
- “Persistent exportable activity” was softened to **locally recorded, exportable activity**; the current implementation is not a permanent or tamper-proof service.

### Remaining historical/conflicting claims to manage

- `docs/webmcp/DEPLOYMENT.md:43-48` intentionally records a dated 2026-08-31 gate (96 definitions, 251 tests, WebMCP 13/14). Keep it clearly historical or move it under a release-history heading; do not quote it as the current result.
- `docs/webmcp/CHALLENGE_EVIDENCE.md:93-95` records an earlier eight-case WebMCP sweep. The current dated QA report supersedes it.
- `docs/submission/DEVPOST_STORY_FINAL.md:85-87` and the rest of `docs/submission/` are earlier Build Week materials with old 96/74/115 counts and the former product name. `README.md:200` labels that guide as earlier, but Devpost submission should use only `docs/webmcp/submission/`.
- Release follow-up: the owner authorized publication, so the current judge documents now identify `webmcp-submission-v1.3` as the audited evidence boundary.

## In-product WebMCP commercial audit

### What works commercially

1. **Capabilities, not pixels.** Tools expose canonical IDs, exact locations, geometry validation, and normal product actions instead of scripting UI selectors.
2. **Human authority is visible.** Reviewed/Fast Draft is part of the interface and cannot be selected by an agent argument.
3. **Evidence remains in the product.** Search, focus, storage access, staged previews, and decisions appear beside the spatial twin rather than in an ungrounded chat transcript.
4. **Failure is useful.** Invalid movement, incomplete plans, ambiguous materials, missing stock, and stale proposals return controlled evidence instead of silently mutating state.
5. **No hidden platform bill.** LabSpace embeds no model and requires no API key; the browser agent supplies intelligence and LabSpace supplies deterministic domain tools.

### What must not be marketed yet

- “Certified audit trail,” “compliance-ready,” “safety-approved,” “verified protocol,” or “safe route.”
- Automatic stock consumption/reservation or proof of material suitability.
- Account/cloud sync, collaboration, cross-device continuity, or managed backup.
- Manufacturer-certified equipment geometry, BIM/MEP, or measured facility clearance.
- Production security, enterprise tenancy, uptime SLA, support SLA, or regulatory compliance.
- Proven productivity/ROI improvement without a measured pilot.

## Recommended submission narrative

> **LabSpace Atlas turns a browser agent into a controlled operator for a laboratory spatial twin.** The agent discovers 23 structured tools, plans against canonical room geometry, grounds material requests in recorded inventory, navigates to an exact cabinet/shelf/drawer, and stages consequential changes for a researcher. LabSpace—not generated text—remains the source of truth. Reviewed mode is the default; Fast Draft is a visible session-only authorization limited to a validated blank room and its complete pristine first blueprint. Collection guidance never deducts stock or claims to be a protocol, safety approval, or certified route.

Recommended three-part judge flow:

1. **Build:** create a blank Floor 8 room, calculate a six-wall blueprint, and show the Reviewed/Fast Draft boundary plus Undo.
2. **Ground:** resolve a researcher-supplied material list against actual records, explicitly keeping missing/ambiguous candidates separate.
3. **Prove:** search one record, focus its exact physical storage, then validate and stage a blocked/corrected spatial change for a human decision.

Recommended commercial positioning:

- **Category:** laboratory spatial operations and physical inventory evidence.
- **Primary buyer:** laboratory operations/facilities manager.
- **Daily users:** researchers, technicians, inventory coordinators, and facilities staff.
- **Current offer:** self-contained single-user pilot and public judge demo.
- **Future managed offer:** organization-scoped projects, role-based approval, managed backup, retention, and operational support—only after the security/data model is implemented.
- **Pilot metrics to measure (not current claims):** median search-to-location time, percentage of inventory with exact storage assignment, placement conflicts found before commit, guide completion rate, tool error/review/cancel rate, and time to recover from an interrupted save.

## Exact commands used

Initial audit commands were read-only/lightweight source and Git inspection:

```powershell
git status --short
rg --files -g "README*" -g "docs/**" -g "src/**" -g "server/**" -g "package.json" -g "render.yaml"
rg -n <claim/count/security/accessibility patterns> README.md docs src server package.json render.yaml
git tag --list "pre-webmcp-2026-08-27" "webmcp-submission-v1" "webmcp-submission-v1.1"
git branch --list "webmcp-challenge-2026"
git rev-parse "pre-webmcp-2026-08-27^{}"
git rev-parse "webmcp-submission-v1.1^{}"
git rev-list --count "webmcp-submission-v1.1^{}..HEAD"
git rev-parse origin/webmcp-challenge-2026
git rev-list --left-right --count origin/webmcp-challenge-2026...HEAD
git show "webmcp-submission-v1.1:src/webmcp/register-labspace-tools.ts"
```

The scoped hardening change was verified sequentially with:

```powershell
npx vitest run tests/unit/agent-activity-store.test.ts --maxWorkers=1 --no-file-parallelism
npx eslint src/agent/agent-activity-store.ts src/components/AgentActivityPanel.tsx tests/unit/agent-activity-store.test.ts --max-warnings=0
npm run typecheck
git diff --check
```

Results: the focused Vitest file passed **1 file / 7 tests** in 740 ms on the final run; targeted ESLint passed; TypeScript passed; `git diff --check` reported no whitespace errors (only the repository's existing LF-to-CRLF notices). No build, server, browser, Playwright, dependency-install, commit, push, deployment, reset, or database command was run.

## Changed files from this commercial audit

- `README.md` — current asset/management/material limitations.
- `SECURITY_NOTES.md` — accurate local/public-demo/commercial security and external-image privacy boundary.
- `ROADMAP.md` — removed obsolete missing-feature and procedural-asset statements.
- `ASSET_LICENSES.md` — current authored-asset count.
- `src/agent/agent-activity-store.ts` — 500-event newest-first retention, bounded unread count, legacy-load sanitation, and stronger local-path redaction.
- `src/components/AgentActivityPanel.tsx` — factual “recorded” wording, retained-history disclosure, and confirmed destructive Clear.
- `tests/unit/agent-activity-store.test.ts` — retention and path-with-spaces/JSON-escaping regressions.
- `docs/webmcp/CHALLENGE_SCORECARD.md` — current catalog scope and non-stale release-gate wording.
- `docs/webmcp/CHALLENGE_EVIDENCE.md` — current catalog/eval counts and qualified local activity evidence.
- `docs/webmcp/submission/DEVPOST_SUBMISSION.md` — complete 23-capability list and current discovery instruction.
- `docs/webmcp/submission/DEMO_CHECKLIST.md` — current 14-case clean-exit criterion.
- `docs/qa/COMMERCIAL_READINESS_AUDIT_2026-09-01.md` — this record.

No commit, push, deployment, tag, room, demo, catalog asset, or persistence data was changed.
