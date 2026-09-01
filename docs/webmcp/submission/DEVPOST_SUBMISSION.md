# Devpost submission — LabSpace AI Agent Twin

## Project name

**LabSpace AI Agent Twin**

## Short tagline

**WebMCP for the physical laboratory: find exact evidence, test spatial changes, and keep the researcher in control.**

## Inspiration / problem

Laboratories often spread their physical knowledge across memory, paper labels, spreadsheets, photos, and floor plans. Knowing that an evaporator exists is different from knowing which room it is in, which cabinet contains its flasks, and whether a proposed nearby trolley position is physically valid.

I am a biologist, not a programmer. I began LabSpace because I needed a professional way to design a laboratory and index every asset and storage location in the same spatial system. The pre-existing application already provided a synchronized 2D/3D editor, a Spatial Index, equipment and inventory records, exact cabinet/shelf/drawer locations, and deterministic placement validation.

## Why WebMCP

A generic browser agent would otherwise need to inspect text and click pixels, then guess whether two records refer to the same physical place. WebMCP lets LabSpace expose its semantic digital twin directly: canonical IDs, current room state, human location trails, equipment evidence, and geometry-backed placement results.

This makes the application meaningfully better when a researcher and agent work together. The agent handles discovery and structured reasoning; LabSpace remains the source of truth; the researcher sees and controls the physical change.

## What it does

LabSpace registers twenty-three focused browser-native tools:

1. audit an active or selected room with deterministic floor, boundary, support, hosted-opening, overlap, height, and identity checks;
2. create, activate, and save one genuinely blank room in a selected laboratory;
3. read active laboratory context;
4. search equipment, inventory, and exact storage;
5. inspect one canonical record;
6. focus the real room, selection, evidence inspector, and 3D camera;
7. discover canonical openings, furniture, storage, equipment, and safety assets with real dimensions;
8. build a rectangular or 3–16 corner polygon shell, derive its floor, host doors/windows, pair seats with workstations, and calculate transform-aware placement;
9. apply that complete room blueprint through the visible Reviewed/Fast Draft execution boundary or a reversible later-change review;
10. discover canonical inventory destinations across editable rooms;
11. validate project-wide inventory proposals against exact rooms and storage IDs;
12. stage an inventory proposal for human approval;
13. validate a hypothetical object move without mutation;
14. turn a blocked target into ranked, geometry-valid alternatives;
15. stage a chosen valid move as a reversible visual preview;
16. validate object dimensions and hosted-opening wall fit without mutation;
17. stage a dimension-accurate resize as a reversible visual preview;
18. validate and stage detailed inventory in one reviewed call;
19. ground a proposed material checklist in actual stock, preserving missing/ambiguous results;
20. start a room-grouped collection guide from reviewed canonical records;
21. follow exact locations with Next/Previous without consuming inventory.

An agent can propose room 812, infer Floor 8, calculate a six-wall office of roughly 32 square metres, host a door and window, pair four chairs with four desks, and orient the cabinet correctly. Reviewed mode visibly pauses before creation and before the blueprint commit. A researcher may instead authorize Fast Draft for the session, allowing only the validated additive blank room and its complete pristine first blueprint to apply; the blueprint is one Undo-capable history update. The agent can also locate the BÜCHI rotary evaporator, trace its flask set to the exact shelf or drawer, reject a trolley collision, and stage a corrected target for researcher review.

## Human + agent collaboration

LabSpace uses a human-controlled, risk-based policy instead of one blanket confirmation rule. Every session starts in Reviewed mode. `labspace_create_room` therefore returns a visual proposal without mutation, and the complete blueprint is reviewed separately. Only a researcher can select Fast Draft in the Inspector; there is no tool argument. In that mode, `labspace_create_room` may save only a validated additive blank room, and that exact pristine room receives a one-use in-memory capability for its complete, fully placed, deterministic first blueprint. The stage response reports `autoCommitted: true`, creates a normal undoable history entry, and uses ordinary autosave. The capability fails closed for incomplete plans, disappears after use/reload/manual editing, and cannot rewrite an existing room, placement, dimension, inventory record, or stock fact.

Every later room change, object move, object resize, and inventory proposal remains **Preview · not saved**. LabSpace shows current and proposed evidence, blocks competing edits, and exposes only human-facing Approve/Cancel controls. Approval creates one ordinary undoable history entry; Cancel restores the exact prior state.

Agent Activity records compact factual evidence—search result, focused record, blocked conflict, staged preview, human decision, and commit—without exposing chain-of-thought.

## How it works

`document.modelContext` registers a small adapter over shared LabSpace actions. Search reuses the same Spatial Index builder and filter as the visible application. Focus is one shared action used by the Digital Twin UI and WebMCP. Hypothetical moves reuse the existing `validatePlacement()` geometry engine. Staging changes only live editor preview state; it never writes directly to SQLite.

The tool adapter owns only JSON schemas, annotations, lifecycle, bounded output, and controlled errors. It mounts on the Layout Editor, Digital Twin, and Inventory Studio, cleans up under React StrictMode, and is excluded from internal asset-preview/facility/capture routes.

## Safety and grounding

- No WebMCP tool can approve, delete, reset, import, or perform an unrestricted project save. Direct creation is limited to a blank room and one complete initial blueprint.
- Only movable furniture, storage, and equipment can be staged; structural, safety-critical, locked, and layer-locked objects are rejected.
- Invalid placement returns actual boundary, collision, elevation, or room-height evidence and performs no mutation.
- User-authored names and notes are marked untrusted and treated as data, not instructions.
- Schemas reject unexpected fields and non-finite/out-of-range coordinates.
- Tool errors reveal no stack, SQL, filesystem path, or internal exception cause.
- LabSpace never invents utility compatibility or safety certification that its geometry cannot prove.

## What was pre-existing

Before the challenge, LabSpace already had the 2D/3D editor, multi-room project model, SQLite persistence, Spatial Index, exact storage hierarchy, equipment and inventory evidence, 96-asset library, DEMO-01, camera focus UI, and placement validator. The annotated `pre-webmcp-2026-08-27` tag preserves this boundary.

## What was built during the challenge

The challenge branch adds the twenty-three-tool WebMCP surface, shared browser-agent action layer, canonical asset/location discovery, human-controlled Reviewed/Fast Draft execution, bounded blank-room creation, deterministic polygon room, connected-annex and inventory planning, room-readiness auditing, wall-hosted openings, workstation pairing, inward-facing perimeter transforms, support-aware elevations, focus integration, placement and resize validation, ranked alternatives, capability-scoped additive Fast Draft, reversible human-reviewed staging, safe history/autosave handoff, persistent exportable activity history and copy-ready workflows, strict contracts and error containment, eval cases, independent Playwright workflows, deployment configuration, and judge materials.

## Challenges

The hardest engineering problem was not registering tools; it was preserving one canonical behavior across agent and human interfaces. Camera focus could not be copied into an adapter. Collision math could not be reimplemented. A staged move could not become an invisible database write. The solution was a thin WebMCP layer over shared domain actions with a deliberate human trust boundary.

Chrome's evolving WebMCP execution signature also required a compatibility fix and real-browser verification. Automated browser contexts cannot always observe the main-world producer API, so the project combines manual Chrome evidence, deterministic action tests, registration lifecycle tests, and injected-boundary E2E workflows.

## What I learned

Useful physical-world agents need more than searchable text. They need stable identity, exact spatial hierarchy, deterministic rules, reversible action, and a human-visible evidence trail. WebMCP is especially valuable here because it exposes capabilities from the application that owns the real state instead of asking the agent to infer them from presentation.

## What's next

The next product step is authenticated multi-user persistence with PostgreSQL, role-based approval, measured facility imports, and richer deterministic utility/clearance rules. Those are future capabilities, not claims in this submission.

## Testing instructions

Open LabSpace in a WebMCP-capable browser and use the prompts in `docs/webmcp/JUDGE_GUIDE.md`. Sixteen tools should appear on `/`, `/digital-twin`, and `/inventory`; the agent should create and complete a pristine six-wall room without an unnecessary confirmation interruption, require review for its next change, propose exact-location inventory, find DEMO-01 evidence, reject invalid moves or hosted-opening dimensions, and stage a grounded correction for a human decision.

Local verification:

```powershell
npm ci
npm run release:check
npx playwright test tests/e2e/webmcp-actions.spec.ts
npm run dev
```

## Links

- Repository: https://github.com/MuhammedJshi96/LabSpace-AI-Indexer
- Challenge branch: `webmcp-challenge-2026`
- Baseline tag: `pre-webmcp-2026-08-27`
- Final tag: `webmcp-submission-v1.1`
- Live URL: https://labspace-agent-twin.onrender.com
