# LabSpace AI Agent Twin — release-candidate system audit

**Audit date:** 2026-09-01  
**Audit target:** local release candidate on `http://localhost:3004`  
**Production-data rule:** the original audit did not write production or public-room data. In the owner-approved remediation pass recorded below, only the three DEMO-01 transforms named in the audit were corrected; all other rooms, objects, inventory, and storage bindings were preserved.

## Executive status

This is a commercial-readiness audit of the complete application, with WebMCP used as an in-app diagnostic and workflow surface. The audit combines:

- browser-native WebMCP calls against the visible application;
- real-browser Playwright journeys against an isolated SQLite test project;
- deterministic unit tests for domain rules and safety boundaries;
- visual inspection at the 1440 × 900 competition viewport;
- independent agent reports recorded under `docs/qa/`;
- a memory-bounded execution policy: one browser, one Playwright worker, and one Vitest worker at a time.

**Final release-gate result: pass.** The audited source passes lint, strict TypeScript, asset validation, 59 unit/integration files with 420 tests, all 55 product browser scenarios, all 7 public-persistence browser scenarios, and the production build. The user-approved DEMO-01 correction now passes every deterministic room-readiness check with zero issues. No remote branch or deployment was changed.

### Final gate totals

| Gate                   | Result                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| ESLint                 | Pass, zero warnings                                                                            |
| TypeScript             | Pass (`tsc --noEmit`)                                                                          |
| Asset integrity        | Pass: 106 definitions; 104 visible authored GLBs; 208 authored and 4 hidden-primitives renders |
| Unit/integration       | Pass: 59 files, 420 tests                                                                      |
| Core product E2E       | Pass: 41/41 distinct scenarios                                                                 |
| WebMCP E2E             | Pass: 14/14 distinct scenarios                                                                 |
| Public persistence E2E | Pass: 7/7 distinct scenarios                                                                   |
| Production build       | Pass: 5,463 modules transformed                                                                |

The post-fix Playwright teardown probe and every owner-run browser batch exited normally with code 0. The production build retains a non-blocking performance warning for JavaScript chunks over 1 MB; code splitting is a post-submission optimization, not a functional failure.

## Live WebMCP evidence

### Tool surface

- **23 tools registered** on Layout Editor, Spatial Index, and Inventory Studio.
- Facility and Asset Studio intentionally expose no mutation tools.
- The WebMCP Inspector reported the same 23-tool count and incremented its visible activity history after calls.
- Reviewed mode remained the visible session default. The browser agent had no argument or schema field capable of changing that mode.

### Calls exercised in the real app

| Tool                           | Result | Evidence / notes                                                                                                                                                                                            |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `labspace_get_context`         | Pass   | Returned the canonical project, laboratory, active room, selection, and compact index counts.                                                                                                               |
| `labspace_search_assets`       | Pass   | `office` returned the canonical Office chair and Office desk with dimensions and connection metadata. A broad multi-concept query returned no matches; agents should search by one role/category at a time. |
| `labspace_inventory_locations` | Pass   | Returned canonical DEMO-01 cabinets and storage IDs without exposing factory-template rooms.                                                                                                                |
| `labspace_search_records`      | Pass   | Found Reference standards and its exact inventory record ID.                                                                                                                                                |
| `labspace_inspect_record`      | Pass   | Returned current stock facts, owner, expiry, room, and human-readable path.                                                                                                                                 |
| `labspace_focus_record`        | Pass   | Switched to DEMO-01, framed the wall cabinet/shelf, opened access preview, and updated the fixed evidence inspector.                                                                                        |
| `labspace_resolve_materials`   | Pass   | Distinguished an exact match, a review candidate, and a missing QA-only reagent; explicitly avoided protocol/suitability claims.                                                                            |
| `labspace_audit_room`          | Pass   | The corrected saved DEMO-01 and published fresh-session snapshot both return `ready` with zero errors and zero warnings.                                                                                    |

### Saved demo content remediation (owner approved)

The initial audit correctly returned `blocked` for four related findings. After the user explicitly approved the required fixes, LabSpace created a named rollback version and applied the smallest geometry-valid corrections:

1. Compound microscope elevation: 810 mm → 900 mm, matching the Analysis island worktop.
2. Biosafety cabinet: X 355/445 mm area → X 2,000 mm, Y 2,450 mm, rotation 270°, fully inside the room and clear of the chair.
3. North reagent cabinet: X 3,000 mm, Y 546 mm → X 2,900 mm, Y 1,300 mm, clear of both adjacent bench runs.

The follow-up tool audit reports `status: ready`; closed floor shell, hosted openings, boundary containment, supported bench equipment, and unique index codes are all `true`. A regression test now protects the published DEMO-01 starter from returning to a blocked state. Existing online visitor workspaces remain independent and are not overwritten by the corrected starter snapshot.

## User-facing workspace inspection

| System            | Status                       | Evidence / notes                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application shell | Pass at 1440 × 900           | Full named navigation, room identity, Save, WebMCP count, and project actions fit without horizontal overflow.                                                                                                                                                               |
| Layout Editor     | Pass                         | Asset Library, 2D plan, synchronized 3D, modern grouped construction rail, and Inspector mount together.                                                                                                                                                                     |
| Project workspace | Pass                         | Dialog is accessible (`role=dialog`, name `Laboratories and rooms`) and stays inside the viewport (`top 40`, `bottom 860` at 900 px height), above the dimmed header.                                                                                                        |
| Facility          | Pass at competition viewport | Floor-organized building stack, room list, quality selector, and selected-room evidence render. The deliberate desktop minimum width causes horizontal overflow in the narrow 821 px embedded pane; this is a compact-viewport limitation, not a 1440 px judge-flow failure. |
| Spatial Index     | Pass                         | Dominant live room, quiet rail, single command bar, fixed evidence panel, automatic access preview, and exact shelf focus were visible.                                                                                                                                      |
| Inventory Studio  | Pass                         | Professional single stock ledger, compact address breadcrumbs, filters, bulk selection, image thumbnails, and primary actions fit cleanly.                                                                                                                                   |
| Storage workspace | Pass                         | Two-step choose-inventory/choose-destination model, large named cabinet map, 3D preview option, and shelf-level evidence fit without overlap.                                                                                                                                |
| Asset Studio      | Pass                         | Authored PBR preview, contained thumbnails, full orbit controls, material metadata, archive affordance, and eleven storage bindings rendered. A real drawer opened and closed without altering room data.                                                                    |
| Runtime console   | Pass with maintenance note   | No application errors. Only Three.js `Clock` deprecation warnings were observed.                                                                                                                                                                                             |

## Automated coverage matrix

| Domain                                         | Coverage mechanism          | Status                                          |
| ---------------------------------------------- | --------------------------- | ----------------------------------------------- |
| WebMCP registration, schemas, compatibility    | Unit + browser              | Pass                                            |
| Reviewed / Fast Draft boundary                 | Unit + browser              | Pass                                            |
| Room creation and blueprint approval           | Unit + browser              | Pass                                            |
| Annex planning/staging                         | Unit + browser              | Pass                                            |
| Inventory planning/approval/Undo               | Unit + browser              | Pass after inventory-history fix                |
| Spatial search/focus/access preview            | Browser + live WebMCP       | Pass                                            |
| Object move/resize validation and approval     | Unit + browser              | Pass                                            |
| Layout drawing, rectangle, annex, wall joints  | Unit + browser              | Pass                                            |
| Multi-select, drag, Ctrl-axis constraint, Undo | Unit + browser              | Pass                                            |
| Door/window hosting and opening clearance      | Unit + browser              | Pass                                            |
| Facility floor placement and room routing      | Unit + browser              | Pass                                            |
| Inventory image URL/file handling              | Unit + browser              | Pass                                            |
| Storage naming/map/drag assignment/openings    | Unit + browser              | Pass                                            |
| Persistence, versions, export, public sessions | Unit + browser              | Pass, including 7 isolated public-session cases |
| Asset catalog/render/storage bindings          | Validation + unit + browser | Pass                                            |
| Low/Balanced/High rendering isolation          | Unit + browser              | Pass                                            |

## Verified corrections made during the audit

1. Approved WebMCP inventory creation now creates one project-wide Undo/Redo command rather than bypassing history.
2. Inventory expiry input now rejects impossible calendar dates such as `2026-02-31`.
3. Agent Activity retains the newest 500 bounded events, caps unread count, redacts local paths with spaces, confirms destructive clearing, and truthfully discloses browser-local retention.
4. Playwright now owns its E2E server and closes it through a token-protected development-only shutdown endpoint; the original Windows teardown hang was reproduced, fixed, and revalidated with a normal exit.
5. Storage and automatic-access-preview browser assertions were updated to the current normalized schema and approved product behavior.
6. Two Spatial Index tests were made independently runnable by selecting their canonical editable fixture room rather than depending on prior test order.
7. Browser screenshot artifacts now go to `test-results/` and cannot silently overwrite tracked judge documentation.
8. Three Annex Builder labels were raised from 10 px to the 11 px tertiary minimum; the 1440 × 900 and 1920 × 1080 readability checks pass.

## Commercial workflow demonstrated

The tested commercial story is factual and repeatable:

1. A browser agent reads project context through WebMCP.
2. It discovers canonical assets, rooms, inventory, and exact locations instead of guessing IDs.
3. It resolves a researcher-supplied material list against recorded facts and clearly marks missing/review-only candidates.
4. It searches and inspects one exact record.
5. It focuses the correct room, object, and storage sub-location in the live 3D twin.
6. The human sees the tool call, result evidence, and safety boundary in the WebMCP Inspector.
7. Project mutations remain Reviewed by default; allowed Fast Draft behavior is session-only and bounded.

This is the product’s strongest judge narrative: **browser-native agent action, deterministic spatial validation, exact physical evidence, and a visible human execution boundary in one interface.**

## Independent records

- `docs/qa/WEBMCP_SYSTEM_AUDIT_2026-09-01.md` — 23-tool trust boundary, action contracts, browser workflows and graceful teardown.
- `docs/qa/CORE_PRODUCT_AUDIT_2026-09-01.md` — editor, Facility, Inventory, Storage, Spatial Index, Asset Studio, rendering and persistence.
- `docs/qa/COMMERCIAL_READINESS_AUDIT_2026-09-01.md` — judge narrative, claim consistency, licensing, security, privacy and pilot positioning.

## Remaining owner decisions and non-blocking risks

- Review the four saved DEMO-01 audit findings before any reversible correction. The protected user-owned room was deliberately not changed.
- Release follow-up: the owner approved publication, and the audited commit is designated by the new immutable `webmcp-submission-v1.3` evidence tag. Earlier tags remain unchanged as historical candidates.
- Keep commercial claims at **single-user pilot / judge demo**. Authenticated organizations, tenant isolation, CSRF/origin enforcement, rate limiting, full CSP, managed retention/backups and incident operations remain prerequisites for real shared laboratory data.
- Activity evidence is now memory-bounded and privacy-hardened, but remains browser-local, mutable and not project-scoped or tamper-proof.
- The build's >1 MB chunk warning and Three.js `Clock` deprecation warnings are maintenance/performance work; neither caused a tested functional failure.
