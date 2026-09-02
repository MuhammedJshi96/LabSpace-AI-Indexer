# WebMCP Challenge evidence

## Competition boundary

| Boundary                                   | Git evidence                               |
| ------------------------------------------ | ------------------------------------------ |
| Verified pre-existing LabSpace application | Annotated tag `pre-webmcp-2026-08-27`      |
| Application/source baseline behavior       | `b4d8471483472a42901d5fbb20b781666c0a8d3b` |
| Baseline documentation tag target          | `1d8caa07cc1dbc4b80fc015f9e325dec7973d70a` |
| Challenge branch                           | `webmcp-challenge-2026`                    |
| Final challenge evidence                   | Annotated tag `webmcp-submission-v1.3`     |

The baseline documentation commit adds only `docs/webmcp/BASELINE.md`; it states the green pre-existing release checks and the known historical E2E issue. It contains no WebMCP implementation.

## What existed before WebMCP

- Multi-laboratory React/TypeScript Layout Editor with synchronized 2D/3D views.
- Express/SQLite project persistence, history, autosave, versions, import/export, reports, and labels.
- Spatial Index records for rooms, equipment, inventory, and nested cabinet/shelf/drawer/bin locations.
- Exact-location 3D focus and evidence UI.
- Deterministic placement validation in the editor.
- DEMO-01 showcase, authored laboratory assets, and the full existing Build Week documentation.

## What was added during the WebMCP Challenge

- Browser-native registration through `document.modelContext` on the editor, Digital Twin, and Inventory routes.
- A compact read-only room-readiness audit that reuses the canonical floor, boundary, overlap, support, opening, height, and identity checks instead of inventing agent-only rules.
- Bounded blank-room creation with laboratory selection, persisted room identity, and Floor 1–15 assignment/inference.
- Three canonical read tools for context, search, and inspection.
- Shared focus action used by both the visible UI and `labspace_focus_record`.
- Deterministic hypothetical move validation reusing the existing geometry engine.
- Read-only ranked placement search that turns a blocked preferred target into diverse valid alternatives using that same geometry engine.
- Canonical asset discovery plus read-only room planning that can propose rectangular or 3–16 corner polygon shells, derive their floors, preserve explicit transforms, host doors/windows, pair seats with workstations, face perimeter furniture inward, and place bench equipment at support elevation.
- Canonical location discovery plus project-wide inventory planning with human-reviewed creation.
- One coherent cyan room-blueprint preview in 2D/3D, with a manifest and deterministic evidence before a researcher decides.
- Reversible move staging with a strict one-pending-change rule.
- Reversible multi-object staging that creates scene objects and applicable equipment/storage index records as one undoable approval.
- A visible, session-only Reviewed/Fast Draft execution boundary. Reviewed stages every project mutation; Fast Draft may apply only a validated additive blank room and its one complete pristine first blueprint, with the blueprint committed as one undoable history update.
- Human-only Approve/Cancel UI for existing-room layouts, later placements, object moves, and inventory; no agent approval tool or unrestricted persistence bypass.
- Normal history, Undo/Redo, autosave, and stale-preview protection after approval.
- A visible in-product WebMCP mission-control inspector that opens on one 60-second **Ask → Prove → Decide** exact-location journey, then discloses the twenty-four browser registrations, eight additional compositional workflows, and locally recorded activity evidence on demand.
- A one-click, explicitly bounded session-evidence export containing workspace context, tool registrations, the human-controlled execution mode, outcome counts, and chronological redacted activity—never hidden reasoning, a certified audit log, or an approved protocol.
- A genuine read-only check executed through `document.modelContext.executeTool`, with bounded tool-name/input/result evidence.
- Cross-runtime manual execution for ChatGPT object arguments and Chrome testing JSON-string arguments.
- Bounded activity evidence contains no chain-of-thought and redacts obvious local-path prefixes; ordinary human clicks are not mislabeled as agent calls. A commercial deployment still needs stronger field-aware redaction and scoped retention.
- Strict schemas, output budgets, controlled errors, safe annotations, and route/lifecycle cleanup.
- Twenty-six expected-call eval cases plus deterministic contract tests.
- Independent Playwright coverage for route registration, compact-header evidence, the complete signature exact-location mission and proof export, automatic first-room construction, and the complete human-reviewed later-change workflow.
- Independent, automatically saved browser workspaces survive refresh and deployment; stale tabs cannot silently overwrite newer saves. No account or cloud-sync claim is made.
- GitHub Actions verification for the release gate and independent WebMCP browser workflow.
- Judge, deployment, Devpost, video, and screenshot materials.
- A complete visible Asset Library conversion: 115 authored orbitable PBR GLBs with matching top/isometric renders; only two hidden wall-drawing primitives remain procedural.

## Challenge commits

```text
bbc226e feat: add LabSpace read action boundary
43d2f5a feat: expose read-only LabSpace WebMCP tools
c1591eb test: cover WebMCP registration lifecycle
4e6c0f0 docs: document WebMCP Phase 1 foundation
be108ba fix: support Chrome WebMCP execution context
809a225 feat: add WebMCP spatial record focus
98a76cb feat: expose deterministic placement validation
4737ef5 feat: add human-reviewed WebMCP layout staging
960da75 feat: add bounded agent activity evidence
3efdca5 test: harden WebMCP tool contracts
4f06bdb test: add WebMCP competition eval cases
a364121 test: cover WebMCP human-reviewed workflow
```

Deployment and submission-document commits follow this list. Use `git log --reverse pre-webmcp-2026-08-27..webmcp-submission-v1.3` for the authoritative complete history. The earlier submission tags remain immutable historical release candidates.

## Before and after

```text
BEFORE: human UI → canonical LabSpace services → project state

AFTER:  human UI ─┐
                   ├→ shared canonical actions → project state
        WebMCP ────┘             |
                                  ├→ bounded first-room capability → history/autosave + Undo
                                  └→ later reversible preview → human approval → history/autosave
```

The challenge did not replace or relabel pre-existing product features as new agent work. It made those capabilities discoverable, composable, and safely actionable by a browser agent.

## Verification evidence

- `npm run release:check`: lint, TypeScript, validation of 117 definitions (115 authored user-visible assets plus two hidden procedural wall primitives), unit/integration tests, and production build.
- `tests/e2e/webmcp-actions.spec.ts`: independent browser workflow tests including route registration, read-only room audit, visible Inspector evidence, Reviewed room creation, bounded Fast Draft, reload reset, later-change review, room-blueprint approval, and reversal.
- `docs/webmcp/evals/cases.json`: 26 direct, compositional, room-planning, audit, invalid, recommendation, and safety-oriented tool-selection cases.
- `docs/webmcp/PRODUCTIVITY_BENCHMARK_V2.md`: repeated same-seed application benchmark with one excluded warm-up and five counterbalanced measured trials per task and method. All 140 outcome checks passed; direct operations fell from 54 to 12. Medians and IQRs preserve task-dependent latency, including the slower Reviewed inventory case. The benchmark does not relabel automated UI execution as human speed.
- `benchmarks/webmcp-productivity.spec.ts`: reproducible, memory-bounded harness for the three equal-outcome paths. It runs one browser context at a time against an isolated database and verifies persisted scene and inventory state.
- Manual Chrome 151 evidence confirmed `document.modelContext`, tool discovery, `labspace_get_context`, and canonical record search. Browser automation cannot directly observe the main-world producer API in its isolated evaluation context, so deterministic Playwright coverage injects that boundary rather than claiming otherwise.

## Historical test note

The pre-WebMCP baseline documented a stale historical Spatial Index serial E2E assumption. The final 36-test regression sweep reproduced only that known project-state leak: its serial file stopped the following nine cases after the search saw three records instead of the pristine-seed expectation of one. The same sweep exposed one ambiguous test locator after facility organization; that test-only locator was narrowed to its status region and verified independently. All eight WebMCP E2E workflows are green, and no production behavior was weakened to rewrite the historical Spatial Index expectation.
