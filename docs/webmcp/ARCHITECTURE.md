# LabSpace Agent Twin architecture

LabSpace exposes a semantic laboratory digital twin through the browser-native WebMCP Imperative API. WebMCP is an adapter over the same canonical actions used by the interface; it does not contain a second copy of search, camera, validation, history, or persistence logic.

```text
Browser agent
    |
    v
document.modelContext (ten small WebMCP tools)
    |
    v
LabSpace schema/error adapter
    |
    +--> canonical read actions --> Spatial Index --> project state
    +--> shared focus action -----> room/selection/camera state
    +--> catalog + room planner --> geometry-checked layout proposal
    +--> placement action --------> deterministic geometry validator
    +--> staging action ----------> reversible move / blueprint preview
                                      |
                                      v
                              researcher Approve / Cancel
                                      |
                                      v
                         normal history + autosave (Approve only)
```

## Public tool surface

| Tool                             | Role                                                                    | Mutates saved project?                                    |
| -------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| `labspace_get_context`           | Active project, laboratory, room, selection, and index counts           | No                                                        |
| `labspace_search_records`        | Canonical equipment, inventory, and exact-location search               | No                                                        |
| `labspace_inspect_record`        | Current evidence for one record returned by search                      | No                                                        |
| `labspace_focus_record`          | Reveal that record in the normal room, evidence inspector, and camera   | No; presentation state only                               |
| `labspace_search_assets`         | Find canonical planning assets, dimensions, and connection behavior     | No                                                        |
| `labspace_plan_room`             | Calculate a bounded multi-object plan against current room geometry      | No                                                        |
| `labspace_find_valid_placements` | Search and rank diverse candidates that pass the current geometry rules | No                                                        |
| `labspace_validate_object_move`  | Test a hypothetical move using current room geometry                    | No                                                        |
| `labspace_stage_object_move`     | Apply a reversible visual preview after successful validation           | No; human approval is required before history or autosave |
| `labspace_stage_room_plan`       | Apply one reversible multi-object room blueprint for review              | No; human approval is required before history or autosave |

There is deliberately no agent-accessible approve, save, delete, reset, import, or project-write tool.

## Code boundaries

- `src/agent/labspace-read-actions.ts` reads current canonical state and reuses `buildDigitalTwinIndex()` and `filterDigitalTwinIndex()`.
- `src/agent/labspace-navigation-actions.ts` owns exact record focus. The Digital Twin UI and WebMCP call the same action.
- `src/agent/labspace-spatial-actions.ts` builds hypothetical candidates and delegates to the existing `validatePlacement()` geometry rules for both exact validation and ranked placement search. It does not duplicate collision math.
- `src/agent/labspace-layout-actions.ts` searches the canonical asset catalog and calculates bounded multi-object plans from canonical dimensions, the active floor/wall geometry, and the existing placement validator. Plans are read-only.
- `src/agent/labspace-staging-actions.ts` creates one reversible move or complete room-blueprint preview only after validation. It never writes directly to SQLite.
- `src/components/AgentReviewPanel.tsx` is the human trust boundary. Approve creates one normal undoable history entry and schedules the existing autosave; Cancel restores the exact prior object or scene.
- `src/agent/agent-activity-store.ts` keeps a bounded, sanitized evidence trail. It records actions and outcomes, not hidden reasoning or chain-of-thought.
- `src/webmcp/register-labspace-tools.ts` owns schemas, annotations, controlled errors, and registration lifecycle only.
- `src/components/WebMCPBridge.tsx` feature-detects `document.modelContext`. Unsupported browsers retain the complete LabSpace experience.

## Registration lifecycle

The bridge mounts only on `/` and `/digital-twin`. Each mount registers exactly ten tools using one `AbortController`. Cleanup aborts that registration before React StrictMode can remount it. Internal `/asset-preview` and `/procedural-asset-capture` routes receive no tools.

## Grounding and safety

- Each call reads current project state at execution time; registration never captures a stale scene snapshot.
- Search excludes immutable `demo-template` rooms, just like the visible Spatial Index.
- User-authored names, notes, owners, and records are returned as untrusted data, never interpreted as instructions.
- Tool schemas reject unexpected fields, empty identifiers, non-finite coordinates, and excessive values.
- Validation permits only movable furniture, storage, and equipment. Structural, safety-critical, or locked objects are rejected.
- Placement evidence is limited to rules the existing geometry engine actually proves: room boundary, collisions, floor elevation, room height, and restrictions. LabSpace does not invent utility or safety certification.
- Ranked alternatives remain planning recommendations: each one passes those deterministic rules, reports its distance and approximate plan gap, and still requires separate staging plus human approval before persistence.
- Room plans are capped at 12 objects, use only supported floor/free-connected planning assets, and report unplaced requests rather than inventing wall hosts or certified safety clearances.
- Staged room plans create canonical scene objects and their applicable storage/equipment records together. Approval commits that complete scene change as one undoable history entry.
- An invalid move returns conflicts and causes no project, preview, history, or persistence mutation.
- A valid staged move is visibly labeled **Preview · not saved** and blocks competing edits until the researcher approves or cancels it.
- Approval is available only through deliberate LabSpace UI interaction. It records one ordinary history entry, preserves Undo/Redo, and uses normal autosave.
- Tool-facing failures omit stack traces, local paths, SQL, and caught internal causes.
- Outputs are compact and bounded; the staging response remains below 1,500 characters in the contract tests.
- No tool is exposed cross-origin. LabSpace does not opt out of origin isolation and does not weaken the `tools` Permissions Policy.

## Testing strategy

Deterministic unit/integration tests cover schemas, actions, safety invariants, lifecycle cleanup, output budgets, and expected-call evaluation cases. Independent Playwright coverage injects the browser API boundary and proves asset search → room plan → blueprint review, search → focus, blocked-target → ranked-valid-alternatives, and stage → cancel/approve → persistence → undo/redo workflows without depending on historical editor tests.

Official references:

- [Chrome WebMCP Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP evaluation guidance](https://developer.chrome.com/docs/ai/webmcp/evals)
- [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [WebMCP specification draft](https://github.com/webmachinelearning/webmcp/blob/main/index.bs)
