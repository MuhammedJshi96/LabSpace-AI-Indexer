# WebMCP signature-workflow acceptance — 2026-09-02

## Outcome

The four requested WebMCP systems passed deterministic action tests and a live browser-agent
acceptance run against an isolated SQLite project at `http://localhost:3104`. The test project was
separate from the user's saved rooms and the public showcase. No production room, inventory record,
or deployment snapshot was overwritten.

LabSpace currently registers **24 unique `labspace_*` tools** on Layout Editor, Spatial Index, and
Inventory. Internal Asset Studio, Facility, and procedural-capture routes register none.

## Exact Bio-001 acceptance scenario

The user-supplied natural-language specification was executed through the page-defined WebMCP
tools, with visible human decisions at the configured trust boundaries.

| Requirement     | Observed evidence                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity        | `Biological assays Laboratory`, `Bio-001`, Floor 5                                                                                                                               |
| Main floor      | 8,000 × 5,500 mm = **44.00 m²**, closed four-wall floor                                                                                                                          |
| Main openings   | centered inward double door on bottom wall; one three-pane window on back wall; one on left wall                                                                                 |
| Main contents   | one island, two working benches, cabinet, freezer, two overhead cabinets, microscope, plate reader, vortex mixer, analytical balance, desk, computer workstation, and two chairs |
| Chair semantics | chairs paired with the office desk and computer workstation, not a generic bench                                                                                                 |
| Initial plan    | 18/18 requested opening/content entries placed; no unplaced item; 22 total shell/asset objects                                                                                   |
| Annex           | connected right-side annex, 4,000 × 5,000 mm = **20.00 m²**, single door opens into annex                                                                                        |
| Annex contents  | three lockers and one freezer                                                                                                                                                    |
| Final audit     | **ready**; 64.00 m² total; 44.00 m² primary + 20.00 m² annex; 9 walls; 4 openings; 19 placed non-architectural assets; 0 reported issues                                         |

Reviewed mode first staged the room and allowed cancellation without persistence. Human-authorized
Fast Draft then applied only the additive blank room and its complete pristine first blueprint.
The annex still required explicit approval, as designed. This confirms that a long prompt does not
bypass the human execution policy.

Everyday voice-style vocabulary was also checked through catalog search: `computer table` resolved
to Computer workstation, `laboratory scale` to Analytical balance, `3 panel window` to Wide
three-pane observation window, `working bench` to Standard laboratory bench, and `overhead cabinet`
to Wall cabinet. A voice transcript uses this same WebMCP path. Audio capture/transcription belongs
to the host browser conversation and was not falsely claimed or simulated as a LabSpace feature.

## Inventory and exact assignment

`labspace_inventory_locations` returned 95 canonical destinations in Bio-001. Three records were
validated, displayed in one review, and created only after visible human approval:

| Inventory             | Recorded quantity | Canonical destination used in the test         |
| --------------------- | ----------------- | ---------------------------------------------- |
| DPPH reagent          | 3 bottles         | Bench 01 right drawer bank · Drawer 02         |
| Pipette Tips 100 ul   | 5,000 tips        | Bench 02 centre paired-door cabinet · Shelf 01 |
| Tris-HCl stop reagent | 2 bottles         | Tall cabinet · Shelf 03                        |

Search, inspect, focus, and access-preview evidence returned the same canonical record and physical
path. Starting or navigating a collection guide did not change quantities, assignments, room
geometry, or saved stock.

## Find one, find many, and exact focus

- A DPPH search returned one canonical inventory record; inspect preserved quantity, code, and full
  human-readable storage trail.
- Focus switched the active workspace to Spatial Index and framed the assigned object/location.
- A multi-record reagent search returned DPPH and Tris-HCl candidates.
- The collection guide exposed deterministic Previous/Next navigation, an unavailable Next control
  at the last stop, and separate human-only checkpoint confirmation.
- Navigation activity was timestamped as bounded tab-session evidence; it was not mislabeled as a
  stock transaction, certified audit log, or proof that an item was physically collected.

## DPPH workflow evidence handoff

`labspace_assess_workflow` grounded the researcher-supplied checklist in the Bio-001 index:

- materials: DPPH reagent, Pipette Tips 100 ul, Tris-HCl stop reagent — three exact matches;
- equipment: Plate reader and Vortex mixer — two exact matches scoped to Bio-001;
- missing requirements: none;
- ambiguous requirements: none;
- recommended authored surface: Center island bench;
- estimated clear surface area: 2.88 m² after the bounded support/occupancy allowance;
- final itinerary: three exact inventory stops, then the highlighted Center island bench.

The final Spatial Index handoff keeps the real 3D work surface dominant and shows the judge-facing
**Ask → Ground → Collect → Decide** chain in the evidence inspector. The result explicitly remains
planning evidence: it is not an assay protocol, suitability determination, safety-approved walking
route, permission to use equipment, reservation, or stock consumption.

## Public tool coverage

| Tool group             | Tools                                                                                                                | Acceptance coverage                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Context and audit      | `labspace_get_context`, `labspace_audit_room`                                                                        | registration, unit, browser E2E, live Bio-001 audit                                            |
| Catalog and room build | `labspace_search_assets`, `labspace_create_room`, `labspace_plan_room`, `labspace_stage_room_plan`                   | exact live Bio-001 build, unit geometry, Reviewed/Fast Draft browser E2E                       |
| Connected annex        | `labspace_plan_annex`, `labspace_stage_annex_plan`                                                                   | exact 20 m² live annex, unit geometry, visible approval                                        |
| Inventory              | `labspace_inventory_locations`, `labspace_plan_inventory`, `labspace_stage_inventory_plan`, `labspace_add_inventory` | exact live assignments plus browser approval/persistence tests                                 |
| Spatial records        | `labspace_search_records`, `labspace_inspect_record`, `labspace_focus_record`                                        | one/many live searches, exact focus, browser navigation and access evidence                    |
| Workflow               | `labspace_resolve_materials`, `labspace_assess_workflow`, `labspace_start_collection`, `labspace_collection_step`    | unit, live DPPH, final-workspace browser E2E, no-mutation assertions                           |
| Placement              | `labspace_validate_object_move`, `labspace_find_valid_placements`, `labspace_stage_object_move`                      | deterministic unit and browser validation, ranking, review, cancel, approve, persistence, Undo |
| Dimensions             | `labspace_validate_resize`, `labspace_stage_resize`                                                                  | hosted-opening/unit contract coverage and reviewed browser staging                             |

## Verification record

| Check                          | Result                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                         | passed with zero warnings                                                                                                                                             |
| TypeScript                     | passed (`tsc --noEmit`)                                                                                                                                               |
| Unit/integration suite         | **435/435 passed across 61 files**                                                                                                                                    |
| Asset validation               | **117 authored asset definitions/models; 230 authored renders; 4 procedural construction renders**                                                                    |
| Production build               | passed; Vite production bundle generated                                                                                                                              |
| Dedicated WebMCP browser suite | **15/15 passed** inside the final run: tool registration, policy, room, inventory, workflow assessment, focus, collection, placement, storage access, and persistence |
| Full product browser suite     | **57/57 passed in one single-worker run**: editor, Spatial Index, Inventory/Storage, Facility, rendering quality, WebMCP, mission control, and responsive shell       |
| Live WebMCP registry           | 24 registrations observed in the in-app browser                                                                                                                       |
| Live data isolation            | dedicated `data/labspace-e2e.sqlite`; user rooms and public showcase untouched                                                                                        |

The production build reports a Rollup advisory for chunks above 1,000 kB. This is a size advisory,
not a failed build; runtime quality tiers, demand rendering, and buffer-release behavior remain
covered by browser tests. Further code splitting is a post-submission optimization and was not mixed
into this stabilization pass.
