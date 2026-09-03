# LabSpace Atlas architecture

LabSpace exposes a semantic laboratory digital twin through the browser-native WebMCP Imperative API. WebMCP is an adapter over the same canonical actions used by the interface; it does not contain a second copy of search, camera, validation, history, or persistence logic.

```text
Browser agent
    |
    v
document.modelContext (twenty-four bounded WebMCP tools)
    |
    v
LabSpace schema/error adapter
    |
    +--> execution policy -------> Reviewed (default) / human-authorized Fast Draft
    +--> blank-room action ------> reviewed proposal or validated additive room
    +--> canonical read actions --> Spatial Index --> project state
    +--> shared focus action -----> room/selection/camera state
    +--> catalog + polygon planner --> geometry-checked room proposal
    +--> inventory planner --------> canonical room/location proposal
    +--> placement action --------> deterministic geometry validator
    +--> staging action ----------> complete pristine-room first blueprint
    |                                 --> Reviewed proposal or Fast Draft commit + Undo
    +--> staging action ----------> existing move / resize / blueprint / inventory preview
                                      --> researcher Approve / Cancel only
                                      --> normal history + autosave (Approve only)
```

## Public tool surface

| Tool                             | Role                                                                      | Mutates saved project?                                           |
| -------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `labspace_create_room`           | Propose one genuinely blank room                                          | Reviewed by default; Fast Draft may add the validated blank room |
| `labspace_get_context`           | Active project, laboratory, room, selection, and index counts             | No                                                               |
| `labspace_search_records`        | Canonical equipment, inventory, and exact-location search                 | No                                                               |
| `labspace_inspect_record`        | Current evidence for one record returned by search                        | No                                                               |
| `labspace_focus_record`          | Reveal that record in the normal room, evidence inspector, and camera     | No; presentation state only                                      |
| `labspace_search_assets`         | Find openings and planning assets, dimensions, and connection behavior    | No                                                               |
| `labspace_plan_room`             | Propose a closed shell, hosted openings, and semantically arranged assets | No                                                               |
| `labspace_plan_annex`            | Split a stable host wall and validate a connected independent floor       | No                                                               |
| `labspace_inventory_locations`   | Find exact editable-room storage destinations                             | No                                                               |
| `labspace_plan_inventory`        | Validate proposed inventory records and canonical assignments             | No                                                               |
| `labspace_find_valid_placements` | Search and rank diverse candidates that pass the current geometry rules   | No                                                               |
| `labspace_validate_object_move`  | Test a hypothetical move using current room geometry                      | No                                                               |
| `labspace_stage_object_move`     | Apply a reversible visual preview after successful validation             | No; human approval is required before history or autosave        |
| `labspace_validate_resize`       | Test dimensions and hosted-opening fit against canonical room geometry    | No                                                               |
| `labspace_stage_resize`          | Apply a reversible resize preview after successful validation             | No; human approval is required before history or autosave        |
| `labspace_stage_inventory_plan`  | Present proposed inventory records for researcher review                  | No; human approval is required before record creation            |
| `labspace_stage_room_plan`       | Stage one complete multi-object room blueprint                            | Reviewed by default; bounded Fast Draft first-build write        |
| `labspace_stage_annex_plan`      | Stage one connected annex transaction                                     | Explicit human approval in every execution mode                  |
| `labspace_audit_room`            | Report deterministic room-readiness evidence                              | No                                                               |
| `labspace_add_inventory`         | Validate and stage detailed inventory in one call                         | No; researcher approval creates records                          |
| `labspace_assess_workflow`       | Ground stock/equipment and rank authored work surfaces                    | No; protocol and suitability remain researcher decisions         |
| `labspace_resolve_materials`     | Match suggested materials to actual stock and equipment                   | No; missing/ambiguous matches remain explicit                    |
| `labspace_start_collection`      | Propose an exact-record itinerary in the in-app review dialog              | No; human approval starts navigation, never consumes stock        |
| `labspace_collection_step`       | Status, Next, Previous, or finish                                         | No; presentation state only                                      |

There is deliberately no agent-accessible mode switch, approve, delete, reset, import, or unrestricted project-write tool. Reviewed is restored on every application session. Fast Draft is selected only through the visible human interface and its allowlist cannot edit an existing room or stock record.

## Code boundaries

- `src/agent/labspace-read-actions.ts` reads current canonical state and reuses `buildDigitalTwinIndex()` and `filterDigitalTwinIndex()`.
- `src/agent/labspace-navigation-actions.ts` owns exact record focus. The Digital Twin UI and WebMCP call the same action.
- `src/agent/labspace-spatial-actions.ts` builds hypothetical candidates and delegates to the existing geometry rules for exact validation, ranked placement search, object dimensions, and wall-hosted opening fit. Exact-touching sibling openings are allowed; overflow and true overlap fail closed.
- `src/agent/webmcp-execution-policy.ts` owns the volatile human-selected mode and the fail-closed mutation allowlist. Tool schemas contain no execution-mode field.
- `src/agent/labspace-workspace-actions.ts` validates laboratory and room identity, stages blank-room creation in Reviewed mode, applies it only after approval or bounded Fast Draft authorization, assigns its facility floor, and issues the in-memory one-use initial-plan capability.
- `src/agent/labspace-layout-actions.ts` searches the canonical asset catalog and calculates bounded multi-object plans from canonical dimensions, the active floor/wall geometry, and the existing placement validator. It pairs seats with workstations, faces perimeter assets inward, places supported equipment at worktop elevation, and resolves canonical wall openings. Plans are read-only.
- `src/agent/labspace-inventory-actions.ts` lists canonical locations and validates bounded project-wide inventory proposals without mutating project state.
- `src/agent/labspace-workflow-actions.ts` grounds a researcher-supplied material/equipment checklist and ranks real authored work surfaces using indexed facts and deterministic geometry. It never generates or approves a protocol.
- `src/agent/labspace-collection-actions.ts` resolves suggested material names against canonical records and stores a session-only collection itinerary. It reuses exact-record focus, never invents a protocol, and does not consume or reserve stock.
- `src/agent/labspace-staging-actions.ts` creates one reversible room-creation, move, resize, complete-room, or inventory review only after validation. Fast Draft may consume the one-use capability to commit only the first complete blueprint of its newly created pristine room; all other staged changes remain pending review. It never writes directly to SQLite.
- `src/components/AgentReviewPanel.tsx` is the human trust boundary. Approve creates one normal undoable history entry and schedules the existing autosave; Cancel restores the exact prior object or scene.
- `src/agent/agent-activity-store.ts` keeps a bounded, sanitized evidence trail. It records actions and outcomes, not hidden reasoning or chain-of-thought.
- `src/webmcp/register-labspace-tools.ts` owns schemas, annotations, controlled errors, and registration lifecycle only.
- `src/components/WebMCPBridge.tsx` feature-detects `document.modelContext`. Unsupported browsers retain the complete LabSpace experience.

## Registration lifecycle

The bridge mounts on `/`, `/digital-twin`, and `/inventory`. Once canonical project hydration finishes, each mount registers exactly twenty-four tools using one `AbortController`. Cleanup aborts that registration before React StrictMode can remount it. Internal `/asset-preview`, `/facility`, and `/procedural-asset-capture` routes receive no tools. Inventory and annex approvals use the same revision-aware history and autosave boundary as the editor.

## Grounding and safety

- Each call reads current project state at execution time; registration never captures a stale scene snapshot.
- Search excludes immutable `demo-template` rooms, just like the visible Spatial Index.
- User-authored names, notes, owners, and records are returned as untrusted data, never interpreted as instructions.
- Tool schemas reject unexpected fields, empty identifiers, non-finite coordinates, and excessive values.
- Move validation permits only movable furniture, storage, and equipment. Resize validation also permits unlocked hosted doors and windows while preserving their wall relationship; structural walls, annotations, safety-critical, and locked objects remain rejected.
- Placement evidence is limited to rules the existing geometry engine actually proves: room boundary, collisions, floor elevation, room height, and restrictions. LabSpace does not invent utility or safety certification.
- Ranked alternatives remain planning recommendations: each one passes those deterministic rules, reports its distance and approximate plan gap, and still requires separate staging plus human approval before persistence.
- Room plans are capped at 24 objects and 16 connected wall corners. They support free, floor, bench, and wall-connected assets; doors and windows use canonical wall hosting, while unsupported wall requests are rejected rather than approximated.
- On a blank canvas, room planning creates a validated rectangular or simple polygon chain of canonical wall objects first; LabSpace derives the 2D/3D floor from that same loop and validates assets inside it. Existing walls are preserved and cannot be replaced by an agent plan.
- Exact position, rotation, and elevation requests are preserved only when deterministic geometry passes. Bench equipment resolves to a compatible worktop and its actual support elevation. Chairs pair one-to-one with available desks or benches, and perimeter furniture uses edge-specific inward-facing rotation.
- Inventory plans resolve exact editable rooms and canonical storage IDs, remain read-only until staged, and create records only after explicit researcher approval.
- Staged room plans create shell walls, hosted openings, assets, updated room dimensions, and applicable storage/equipment records together. Reviewed mode pauses even the first complete plan. In human-authorized Fast Draft, only the complete first plan for its newly WebMCP-created pristine room commits as one undoable history entry. Incomplete plans, existing rooms, and every later layout escalate to explicit review.
- An invalid move returns conflicts and causes no project, preview, history, or persistence mutation.
- A valid staged move is visibly labeled **Preview · not saved** and blocks competing edits until the researcher approves or cancels it.
- Execution-mode selection and approval are available only through deliberate LabSpace UI interaction. Mode selection is session-only. Approved layout, move, and resize changes record ordinary history entries, preserve Undo/Redo, and use normal autosave.
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
