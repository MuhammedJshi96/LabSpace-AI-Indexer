# WebMCP Challenge evidence

## Competition boundary

| Boundary                                   | Git evidence                               |
| ------------------------------------------ | ------------------------------------------ |
| Verified pre-existing LabSpace application | Annotated tag `pre-webmcp-2026-08-27`      |
| Application/source baseline behavior       | `b4d8471483472a42901d5fbb20b781666c0a8d3b` |
| Baseline documentation tag target          | `1d8caa07cc1dbc4b80fc015f9e325dec7973d70a` |
| Challenge branch                           | `webmcp-challenge-2026`                    |
| Final challenge evidence                   | Annotated tag `webmcp-submission-v1.1`     |

The baseline documentation commit adds only `docs/webmcp/BASELINE.md`; it states the green pre-existing release checks and the known historical E2E issue. It contains no WebMCP implementation.

## What existed before WebMCP

- Multi-laboratory React/TypeScript Layout Editor with synchronized 2D/3D views.
- Express/SQLite project persistence, history, autosave, versions, import/export, reports, and labels.
- Spatial Index records for rooms, equipment, inventory, and nested cabinet/shelf/drawer/bin locations.
- Exact-location 3D focus and evidence UI.
- Deterministic placement validation in the editor.
- DEMO-01 showcase, authored laboratory assets, and the full existing Build Week documentation.

## What was added during the WebMCP Challenge

- Browser-native registration through `document.modelContext` on the two normal LabSpace routes.
- Three canonical read tools for context, search, and inspection.
- Shared focus action used by both the visible UI and `labspace_focus_record`.
- Deterministic hypothetical move validation reusing the existing geometry engine.
- Read-only ranked placement search that turns a blocked preferred target into diverse valid alternatives using that same geometry engine.
- Reversible move staging with a strict one-pending-change rule.
- Human-only Approve/Cancel UI; no agent commit tool or persistence bypass.
- Normal history, Undo/Redo, autosave, and stale-preview protection after approval.
- A visible in-product WebMCP inspector that lists the seven browser registrations and their Read/View/Simulate/Review modes.
- A genuine read-only check executed through `document.modelContext.executeTool`, with bounded tool-name/input/result evidence.
- Sanitized activity evidence with no chain-of-thought, secret fields, or local-path disclosure; ordinary human clicks are not mislabeled as agent calls.
- Strict schemas, output budgets, controlled errors, safe annotations, and route/lifecycle cleanup.
- Fourteen expected-call eval cases plus deterministic contract tests.
- Independent Playwright coverage for route registration and the complete human-reviewed workflow.
- Judge, deployment, Devpost, video, and screenshot materials.

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

Deployment and submission-document commits follow this list. Use `git log --reverse pre-webmcp-2026-08-27..webmcp-submission-v1.1` for the authoritative complete history. The earlier `webmcp-submission-v1` tag remains as an immutable pre-deployment candidate.

## Before and after

```text
BEFORE: human UI → canonical LabSpace services → project state

AFTER:  human UI ─┐
                   ├→ shared canonical actions → project state
        WebMCP ────┘             |
                                  └→ reversible preview → human approval → history/autosave
```

The challenge did not replace or relabel pre-existing product features as new agent work. It made those capabilities discoverable, composable, and safely actionable by a browser agent.

## Verification evidence

- `npm run release:check`: lint, TypeScript, 96-asset validation, 165 unit/integration tests, and production build.
- `tests/e2e/webmcp-actions.spec.ts`: four independent browser workflow tests.
- `docs/webmcp/evals/cases.json`: 14 direct, compositional, invalid, recommendation, and safety-oriented tool-selection cases.
- Manual Chrome 151 evidence confirmed `document.modelContext`, tool discovery, `labspace_get_context`, and canonical record search. Browser automation cannot directly observe the main-world producer API in its isolated evaluation context, so deterministic Playwright coverage injects that boundary rather than claiming otherwise.

## Historical test note

The pre-WebMCP baseline documented a stale historical Spatial Index serial E2E assumption. Final full-suite comparison also showed an existing legacy drag-to fixture failure and a software-WebGL full-sequence timing flake that passes alone. The independent WebMCP E2E suite is green; no production behavior was weakened to rewrite historical expectations.
