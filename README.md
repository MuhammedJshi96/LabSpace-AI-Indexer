# LabSpace Atlas

<p align="center">
  <img src="docs/submission/labspace-atlas-thumbnail-3x2-v1.png" alt="LabSpace Atlas — The living map of your laboratory" width="100%" />
</p>

<p align="center"><strong>Design the lab. Index every location. Find anything instantly.</strong></p>

<p align="center">
  <a href="https://labspace-agent-twin.onrender.com"><strong>Live judge app</strong></a>
  · <a href="docs/webmcp/JUDGE_GUIDE.md">60-second judge guide</a>
  · <a href="docs/submission/FINAL_DEMO_SCRIPT_2026-09-03.md">under-three-minute demo runbook</a>
  · <a href="LICENSE">Apache-2.0 source licence</a>
</p>

**LabSpace Atlas** is a browser-native spatial operating system for laboratories. Researchers and browser agents work on the same millimetre-accurate 2D/3D model to design rooms, index physical storage, validate placements, find exact equipment or inventory locations, and hand off a grounded collection route. The application is deterministic, local-first, inspectable, and usable without an API key or paid model call.

## WebMCP Challenge — LabSpace Atlas

**WebMCP for the physical laboratory.** LabSpace now lets a browser agent work with a structured semantic digital twin instead of scraping pixels or guessing what laboratory controls mean. The agent can create and activate a genuinely blank room, infer its building floor, calculate a rectangular or multi-wall polygon shell, host doors and windows on exact wall segments, pair chairs with workstations, orient perimeter furniture inward, and place bench equipment on real support surfaces. It can also search exact physical records, focus the real 2D/3D workspace, validate equipment moves, and propose project inventory at canonical locations.

![LabSpace Atlas WebMCP mission control showing the three connected judge missions and human-controlled execution boundary](docs/screenshots/submission-webmcp-mission-control.png)

**Live judge demo:** [labspace-agent-twin.onrender.com](https://labspace-agent-twin.onrender.com) — the privacy-checked public workspace contains only laboratory **`LAB-D-00`** with authored rooms **R-001** and **R-002**. **R-003 is deliberately absent** and is created live during judging. The free instance can take up to about a minute to wake after inactivity.

### Submission evidence map

| Challenge requirement       | Repository evidence                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working public project      | [Live HTTPS app](https://labspace-agent-twin.onrender.com) plus `/api/health` and production smoke checks                                                                                                      |
| WebMCP leverage             | 24 registered `labspace_*` tools; real registration in [`register-labspace-tools.ts`](src/webmcp/register-labspace-tools.ts)                                                                                   |
| Better human-agent UX       | Natural-language/voice-ready missions, visible exact-location evidence, Reviewed-by-default mutations, and bounded Fast Draft                                                                                  |
| Public source + licence     | Complete source, required runtime assets, clean-clone instructions, standard [Apache License 2.0](LICENSE), separate [asset/media terms](LICENSE-ASSETS.md), and [third-party notices](THIRD_PARTY_NOTICES.md) |
| Existing-project boundary   | Annotated tag `pre-webmcp-2026-08-27` and dated [challenge evidence](docs/webmcp/CHALLENGE_EVIDENCE.md)                                                                                                        |
| Testing and reproducibility | [`npm run test:e2e:submission`](package.json), full release check, public-persistence suite, and the [final rehearsal spec](tests/e2e/submission-rehearsal.spec.ts)                                            |
| Demo video preparation      | Timestamped [2:58 recording script](docs/submission/FINAL_DEMO_SCRIPT_2026-09-03.md) with a real product capture after the short optional opener                                                               |

This packaging follows the official [WebMCP Challenge page](https://openai.com/webmcp-challenge/), [Devpost requirements](https://webmcp.devpost.com/), [resources](https://webmcp.devpost.com/resources), and [rules](https://webmcp.devpost.com/rules).

**Measured proof, not a speed fantasy:** a repeated same-outcome browser benchmark passed 140/140
checks and reduced direct operations from 54 to 12 across exact-location, reviewed inventory, and
room-building tasks. It also preserves the honest slower Reviewed-inventory machine-time result.
See the [method, medians, IQRs, and limitations](docs/webmcp/PRODUCTIVITY_BENCHMARK_V2.md).

The trust boundary is human-controlled and risk-based. Every application session starts in **Reviewed** mode: room creation, blueprints, inventory, movement, and resizing stop at **Preview · not saved** until a researcher approves them. The visible **Fast Draft** opt-in can auto-apply only a validated additive blank room and that room's complete first blueprint; the blueprint is one undoable history update. Existing-room layouts, moves, resizes, inventory/stock, destructive changes, incomplete plans, and validation failures always escalate to review. No WebMCP argument can select or bypass the mode, and there is no agent-accessible approve, reset, delete, import, or unrestricted project-write tool.

### See WebMCP working

Open the **WebMCP** status control in the LabSpace header. The Inspector opens on a connected
three-part judge demonstration rather than a tool wall:

1. Run **Build** to create and audit the 38 m² Researcher Office **R-003** from natural language.
2. Run **Stock** to stage two enzyme records with exact quantities/expiry dates for human approval.
3. Run **Find the work** to ground the cross-room DPPH checklist, keep chloroform visibly missing,
   and end a reviewed collection guide at a real R-002 work surface.

The Inspector keeps **24 tools ready** and the visible **Reviewed** execution boundary on screen throughout.

Choose **Copy + show workspace** (or the shorter voice-input version); the Inspector closes so
the exact 2D/3D evidence remains unobstructed while the browser agent works. The copied request
explicitly requires the page's `labspace_*` WebMCP tools and forbids a silent fallback to clicks,
drags, or computer control; a missing bridge is reported instead.
Open **Evidence** to inspect bounded tool inputs/results, then choose **Export proof** for a portable
session-evidence JSON file.

The expandable **More judge workflows** section keeps six compositional LLE, collection, annex,
exact-location, audit, and resize prompts available without making them compete
with the primary story. **Setup** provides a read-only connection check and separates natural-language
agent use from Chrome DevTools' one-tool-at-a-time JSON runner. **Tools** shows the twenty-four live
registrations and their Read, View, Simulate, Create, or Review boundary.

Type the suggested request in the ChatGPT/browser-agent conversation that opened LabSpace. LabSpace does not add a second chatbot: the browser agent discovers the tools directly from the open page, and the inspector shows each call inside the product.

The trace is intentionally evidence, not hidden model reasoning. Ordinary researcher clicks are not mislabeled as agent activity. Human mode changes, reviewed proposals, Fast Draft commits, approvals, cancellations, and Undo-capable commits are recorded as distinct evidence.

The mission-control presentation is independently reversible: build with
`VITE_COMPETITION_EVIDENCE_LAYER=0` to restore the former Inspector information architecture. The
flag changes no WebMCP registration, execution rule, room, inventory record, material, or saved
workspace. See the [rollback checkpoint](docs/rollback/COMPETITION_EVIDENCE_LAYER_2026-09-02.md).

### Twenty-four browser-native tools

| Tool                             | Capability                                                                                         | Saved-data behavior                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `labspace_audit_room`            | Audit floor closure, boundaries, support, front working zones, openings, overlaps, height, and IDs | Read-only; deterministic readiness evidence                     |
| `labspace_create_room`           | Propose one genuinely blank room in a selected laboratory                                          | Reviewed by default; bounded Fast Draft additive write          |
| `labspace_get_context`           | Read the active project, room, selection, and index counts                                         | Read-only                                                       |
| `labspace_search_records`        | Search equipment, inventory, and exact storage                                                     | Read-only                                                       |
| `labspace_inspect_record`        | Inspect current canonical evidence                                                                 | Read-only                                                       |
| `labspace_focus_record`          | Reveal a record in the normal room, evidence panel, and camera                                     | Presentation state only                                         |
| `labspace_search_assets`         | Discover openings and planning assets with dimensions and connection behavior                      | Read-only                                                       |
| `labspace_plan_room`             | Propose a polygon shell, hosted openings, paired workstations, and supported assets                | Read-only                                                       |
| `labspace_plan_annex`            | Split one stable wall and validate a connected space with an independent floor                     | Read-only                                                       |
| `labspace_inventory_locations`   | Discover canonical inventory destinations in editable rooms                                        | Read-only                                                       |
| `labspace_plan_inventory`        | Validate proposed project-wide inventory records and assignments                                   | Read-only                                                       |
| `labspace_find_valid_placements` | Rank valid alternatives near an area or relative to another object's authored front                | Read-only                                                       |
| `labspace_validate_object_move`  | Test a hypothetical position with current geometry                                                 | Read-only                                                       |
| `labspace_stage_object_move`     | Show a reversible valid-move preview                                                               | Not persisted; human approval required                          |
| `labspace_validate_resize`       | Test dimensions, hosted-wall fit, sill height, and opening overlap                                 | Read-only                                                       |
| `labspace_stage_resize`          | Show a reversible dimension-accurate preview                                                       | Not persisted; human approval required                          |
| `labspace_stage_inventory_plan`  | Show a human-reviewable inventory proposal                                                         | Not persisted; human approval required                          |
| `labspace_stage_room_plan`       | Stage a complete blueprint                                                                         | Reviewed by default; Fast Draft only for a pristine first build |
| `labspace_stage_annex_plan`      | Stage one connected annex transaction                                                              | Not persisted; human approval always required                   |
| `labspace_add_inventory`         | Validate and stage detailed inventory entries in one call                                          | Human approval required before records are created              |
| `labspace_assess_workflow`       | Ground materials/equipment and rank authored work surfaces                                         | Read-only; protocol and suitability remain researcher decisions |
| `labspace_resolve_materials`     | Match a suggested materials list to actual stock and equipment                                     | Read-only; missing and ambiguous matches stay explicit          |
| `labspace_start_collection`      | Start an ordered guide ending at an optional assessed workspace                                    | Presentation state only; no stock deduction                     |
| `labspace_collection_step`       | Status, Next, Previous, or finish for the collection guide                                         | Presentation state only                                         |

```text
browser agent → document.modelContext → LabSpace tool adapter
                                      → human-controlled execution policy
                                      → Reviewed → visual proposal → researcher Approve / Cancel
                                      → Fast Draft → validated additive room + first blueprint only
                                      → history + autosave + Undo + bounded activity evidence
```

This challenge work extends the pre-existing LabSpace application. The annotated `pre-webmcp-2026-08-27` tag preserves the verified boundary; later challenge commits add the WebMCP adapter, shared actions, deterministic validation, capability-scoped initial-room creation, human-reviewed later changes, Agent Activity evidence, evals, and independent browser workflow tests. See the [WebMCP judge guide](docs/webmcp/JUDGE_GUIDE.md), [architecture](docs/webmcp/ARCHITECTURE.md), and [challenge evidence](docs/webmcp/CHALLENGE_EVIDENCE.md).

The runtime remains local and no-billing: LabSpace embeds no model, sends no model API request, and needs no OpenAI API key. Intelligence comes from the user's WebMCP-capable browser agent; LabSpace supplies deterministic domain tools, a human-controlled execution policy, and the visible review surface.

## Finalized product tour

### Layout Editor

The complete planning workspace combines the searchable 115-asset library, material-aware 2D plan, synchronized 3D room, editable room data, and surface controls in one desktop composition.

![Current LabSpace Atlas Layout Editor with synchronized material-aware 2D and authored 3D views](docs/screenshots/submission-layout-editor.png)

### Inventory Studio

The project-wide stock ledger keeps human names, quantities, status, room, and physical address readable. Storage assignment remains direct and reversible, while technical codes stay available as evidence rather than dominating the interface.

![Current LabSpace Atlas Inventory Studio showing the sanitized LAB-D-00 judge stock](docs/screenshots/submission-inventory-studio.png)

### Spatial Index Finder and exact-location evidence

The Spatial Index Finder searches canonical equipment, inventory, rooms, and storage paths, then navigates from the selected record to precise room and cabinet evidence.

**Inventory → Storage** opens a full-size workspace with a searchable cabinet rail, anatomy-derived **storage map**, inline naming, readable contents and an opt-in **3D access preview** using the original models and materials. Assign existing stock or add a record at an exact shelf; custom/unlinked locations remain available through the complete location directory. The Layout Editor's Storage Inspector is now a contextual summary with **Manage storage**, and returning preserves the editor view and selection. Inventory rows show images, quantities, units and batch-selection checkboxes. Assignments, renames and storage configuration are undoable without rolling back newer stock quantities. See the [inventory organization guide](docs/INVENTORY_ORGANIZATION.md).

![Current Spatial Index exact-location evidence for DPPH reagent in R-002](docs/screenshots/submission-spatial-index-dpph.png)

The selected reagent remains tied to one exact storage contour, its human-readable address, canonical code, quantity, room context, and the authored 3D camera. The browser agent invokes the same search, inspect, focus, workflow-assessment, and collection actions that the interface displays.

### PBR Asset Studio

Authored laboratory models remain orbitable and inspectable from every side, with validated dimensions, materials, indexing behavior, catalog thumbnails, and the same GLB used in the room renderer.

![Asset Studio showing the authored all-sided benchtop ultrasonic cleaner](docs/screenshots/submission-authored-asset-studio.png)

## Highlights

- One canonical, versioned scene model drives React Konva 2D and React Three Fiber 3D.
- A project navigator creates and switches among multiple laboratories and rooms; generic project/laboratory/room factories never clone demonstration content into a blank workspace.
- A dedicated project-wide Spatial Index Finder searches inventory, equipment, and nested storage locations across every laboratory and room, switches the live spatial scene to a selected result, highlights the related 3D asset or drawer/shelf/bin region, and deep-links back to the same room and editor record.
- Every room owns semantic scene-local layers for walls, openings, furniture, storage, equipment, utilities, safety, labels, and measurements, so placement never depends on seed-owned layer IDs.
- Laboratory-aware object indexes and equipment IDs use the active laboratory, room, and optional zone codes with normalized, case-insensitive uniqueness checks.
- 117 original planning definitions across architecture, furniture, storage, equipment, and safety (including two hidden wall primitives).
- All 115 user-visible library assets use authored, genuinely orbitable GLB geometry with front, back, side, top construction, and dimension-matched catalog/plan renders.
- The authored set now includes detailed benches and wash stations, core casework/storage, professional openings, a raised-service-bridge island, a fully rebuilt BÜCHI R-300-class touchscreen rotary evaporator, and manufacturer-class analytical, thermal, cold-storage, imaging, washing, and clean-air equipment.
- All 117 catalog definitions supply material-aware isometric library images and top-view plan images derived from the same authored GLB or procedural geometry used by the 3D view.
- Only `straight-wall` and `half-height-wall` remain procedural because they are hidden construction primitives controlled by the wall-drawing workflow, not draggable Asset Library products.
- A visible Asset Studio provides an orbitable PBR preview plus front, back, left, right, top, and isometric camera presets.
- Interactive select, marquee, pan, wall, door, window, measure, move, resize, rotate, copy, paste, duplicate, delete, lock, hide, and z-order actions.
- Newly created laboratories and rooms open with genuinely blank planning canvases; historical Build Week fixtures remain isolated for regression compatibility.
- The final WebMCP public fixture is storage-first and contains only `LAB-D-00`, R-001, and R-002. Factory fixtures are immutable; creating or saving a room produces normal persisted data and never rewrites a template.
- Selected wall segments can be translated directly or reshaped from endpoint handles while joined corners and hosted openings remain attached.
- One simple closed straight-wall loop defines the floor: rectangles, concave L-shapes, split edges, and skewed loops share one clipped 2D floor, triangulated 3D floor, area/perimeter result, placement boundary, and normalized undoable resize.
- Placed objects keep a reliable hit area and pointer-relative drag offset, and Select mode pans with middle-mouse drag, Space+drag, Arrow keys, or WASD.
- Continuous wall drawing carries each committed endpoint into the next segment; Enter or double-click finishes a chain, while Escape returns to Select.
- Grid, multi-surface snapping, alignment guides, pointer-centred zoom, fit-to-room, camera presets, wall transparency, and floor visibility.
- Split presentation has a draggable, keyboard-accessible, persistent divider with protected minimum pane widths.
- Rooms without a saved camera pose open with the user-approved relaxed split-view isometric framing; manual orbit poses persist per room, and ordinary 2D object moves never reset the 3D camera.
- The Asset Library and Inspector collapse into narrow, labeled, keyboard-accessible rails when more canvas space is needed.
- A dedicated Favorites tab gives quick access to starred assets; stars update immediately, persist safely across reloads, and remain usable for the current session even when browser storage is unavailable.
- Optional room environment profiles can add 3D-only ceiling, lighting, duct, utility, and service context without altering the indexed scene. The historical reference-services profile remains independently hideable.
- Visual material libraries synchronize ten floor finishes and ten wall finishes between the 2D plan and 3D PBR room, including porcelain, pearl terrazzo, pale oak, ivory stone, and satin panels with per-wall overrides. Decorative office finishes are not wet-laboratory certification.
- Cabinet, shelf, drawer, compartment, and bin hierarchies with stable codes and exact inventory locations.
- Equipment identity, service, ownership, and utility requirements.
- Readable desktop typography uses a 12px visible minimum, 13px labels, and 14px controls/body text without shrinking the CAD workspace.
- Revision-aware autosave, presentation-safe renderer mounting, contained pane errors, and guarded Konva drag handling protect live edits from stale saves, blank views, and upper-corner snapping.
- Named room versions, restore, version-to-room duplication, and portable JSON import/export.
- QR labels, A4 print layouts, and CSV reports.
- Collision, boundary, door-swing, hierarchy, duplicate code, equipment ID, and serial-number warnings.

## Spatial Index Finder and browser-agent API

The competition workflow is fully testable without an OpenAI Platform API key or usage billing. The **Spatial Index Finder** performs deterministic multi-term search over canonical equipment, inventory, laboratory, room, owner, note, identifier, cabinet, drawer, shelf, compartment, and bin data. Selecting a result controls the existing 2D/3D focus, evidence inspector, QR identity, editor deep link, and opt-in physical access preview.

There is no embedded model response in the shipped runtime. GPT-5.6 and Codex were used to build and validate the product, as documented separately below. A WebMCP-capable browser agent can now discover and invoke LabSpace's twenty-four structured tools, while the canonical catalog, room and annex planners, room-readiness audit, inventory planner, index, geometry validator, capability gate, and human review UI remain deterministic application behavior.

The Spatial Index renders every visible object in the active room so evidence always matches the Layout Editor. Performance comes from local assets, shared geometry/material reuse, offline decoders, loading discipline, and detail management rather than hiding room contents. The Layout Editor exposes the complete searchable 115-asset library, while Asset Studio loads one orbitable model at a time and releases the previous preview cache.

**Low / Balanced / High rendering** is shared across the editor, Spatial Index, Facility and Asset Studio. Balanced is the default with a one-click reset; High adds restrained contact shading and cached finish microtexture at extra GPU cost. Clear panes retain their transparent blue accent. Quality changes preserve camera, selection, storage openings and saved room data. See the [rendering comparison and rollback notes](docs/local-render-quality.md).

## Start locally

Requirements: Node.js 22.5 or newer (Node.js 24 LTS is recommended). The built-in SQLite module is the only platform-sensitive runtime requirement.

### One-click Windows launcher

After installing Node.js, Windows users can double-click **[`Start LabSpace.cmd`](Start%20LabSpace.cmd)** in the repository root. The launcher installs missing npm dependencies, keeps the required port `3004`, avoids starting a duplicate server, waits until LabSpace is reachable, and opens the application in the default browser. Keep the minimized **LabSpace Atlas Server** terminal open while using the application.

### Terminal launch

```powershell
git clone https://github.com/MuhammedJshi96/LabSpace-AI-Indexer.git
cd LabSpace-AI-Indexer
npm ci
npm run dev
```

Open [http://127.0.0.1:3004/](http://127.0.0.1:3004/). The searchable spatial index is available at [http://127.0.0.1:3004/digital-twin](http://127.0.0.1:3004/digital-twin), and the asset pipeline preview is available at [http://127.0.0.1:3004/asset-preview](http://127.0.0.1:3004/asset-preview).

For a non-technical Windows walkthrough, see [SETUP.md](SETUP.md).

## Clean clone and judge setup

### Latest competition polish

Storage access now opens the **actual authored door leaves and drawer trays**,
with correct hinge sides, internal shelves, per-instance animation and a safe
explanation when saved storage does not match a model. It never overlays an
invented door or fabricates stored contents. Five verified casework families are
covered; see [model-aware storage access](docs/assets/storage-access-2026-08-30.md).
This release also includes the scoped furniture refinements, viewport-fitted
Asset Studio, dismissible spatial selection, and dialogs above the header.

The live release now includes a one-call reviewed inventory tool, material-list grounding, and a visible Next/Previous collection guide; richer floor/wall finishes; chair-to-desk knee-space snapping; and upgraded authored workstation/desk models. See [Inventory and collection workflows](docs/webmcp/INVENTORY_AND_COLLECTION.md) for exact tool arguments and examples. The guide is a grounded collection itinerary, not an experiment protocol or certified walking route.

The public service uses an explicitly exported, privacy-checked snapshot containing only `LAB-D-00`, R-001 and R-002. It has 55 authored scene objects, 27 inventory records, 15 equipment records and 169 exact storage locations. R-003 is deliberately absent so judges can watch it being created. Local fresh installations continue to use the development seed; neither path overwrites the developer's existing SQLite workspace.

The repository is self-contained: authored GLBs, plan/library renders, inventory evidence images, material textures, and offline Draco decoder files live under `public/` and are copied into the production bundle by Vite. Judges do **not** need Blender, the private reference photographs, an OpenAI API key, or an asset-rebuild step.

```powershell
git clone https://github.com/MuhammedJshi96/LabSpace-AI-Indexer.git
cd LabSpace-AI-Indexer
npm ci
npm run release:check
npm run dev
```

The server creates a new local SQLite database from the source-controlled seed on first launch. SQLite files, private reference photographs, browser-test output, generated caches, and bulk QA captures are intentionally excluded from Git. The local seed keeps historical Build Week fixtures only for regression compatibility; the final WebMCP judging path is the sanitized public `LAB-D-00` fixture described above. Copying the developer SQLite database is neither required nor recommended.

For the WebMCP Challenge, see [docs/webmcp/JUDGE_GUIDE.md](docs/webmcp/JUDGE_GUIDE.md). The earlier Build Week guide remains at [docs/submission/JUDGE_GUIDE.md](docs/submission/JUDGE_GUIDE.md).

## Commands

| Command                            | Purpose                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `npm run dev`                      | Start the local API and Vite development server           |
| `npm run build`                    | Create the production frontend bundle                     |
| `npm run start`                    | Start the API and serve the production bundle             |
| `npm run assets:build`             | Rebuild the 115 visible hero GLBs and 230 catalog renders |
| `npm run assets:render-procedural` | Rebuild four wall-primitive procedural catalog renders    |
| `npm run lint`                     | Run ESLint                                                |
| `npm run typecheck`                | Run strict TypeScript checks                              |
| `npm run test`                     | Run the Vitest unit/integration suite                     |
| `npm run test:e2e`                 | Run the Playwright competition and editor workflows       |
| `npm run test:e2e:webmcp`          | Run the independent WebMCP judge workflow                 |
| `npm run test:e2e:submission`      | Rehearse Build/Stock/Find and regenerate README captures  |
| `npm run validate:assets`          | Validate manifests, authored GLBs, and static PNG renders |
| `npm run release:check`            | Run lint, types, asset validation, tests, and build       |
| `npm run format`                   | Format source and documentation                           |

`npm run assets:build` uses Blender 4.5 LTS. It resolves the project-local portable build by default, or a compatible executable supplied through `BLENDER_PATH`.

## Local data

The active database is `<repository>/data/labspace-indexer.sqlite`. No project data, analytics, or telemetry leaves the computer. JSON export is the portable backup format.

## How I used GPT-5.6 and Codex

I am a biologist, not a programmer. I supplied the laboratory knowledge, Room 809 reference photographs, equipment requirements, product priorities, visual direction, testing feedback, and final acceptance decisions. The project was developed through repeated human–AI collaboration rather than a one-prompt generation process.

- **GPT-5.6 — product reasoning and design translation:** GPT-5.6 helped translate laboratory observations into workflows, information architecture, spatial-data requirements, interaction contracts, asset specifications, competition positioning, and clear acceptance criteria. It helped me reason about how an empty-room builder, synchronized 2D/3D editing, exact storage indexing, and deterministic search should operate as one coherent product.
- **Codex — implementation and verification:** Codex worked directly in the repository to implement the React, TypeScript, Three.js, React Konva, Express, and SQLite application. It built and refined synchronized editor behavior, wall and opening workflows, asset tooling, persistence, validation, search navigation, tests, documentation, and release checks. It also diagnosed failures I reported through hands-on testing and screenshots, including corner snapping, disappearing objects, camera resets, stale saves, and renderer lifecycle problems.
- **My role — domain authority and product decisions:** I evaluated every result from a laboratory-user perspective, corrected equipment anatomy and proportions, selected priorities, rejected unsuitable implementations, authored the laboratory showcases, and decided when each workflow was acceptable. Codex made developing a professional tool approachable despite my lack of programming experience, while the laboratory and product judgment remained mine.

The shipped Spatial Index is deterministic local software and requires no OpenAI API key or paid API billing. The primary Codex build session retained for the required `/feedback` evidence is `019f6a4d-25a9-7812-804c-88b695589b2a`.

## WebMCP local test and deployment

Use a WebMCP-capable ChatGPT in-app browser for the easiest natural-language flow. In Chrome, enable `chrome://flags/#enable-webmcp-testing`; to use Chrome's DevTools WebMCP pane, also enable `chrome://flags/#devtools-webmcp-support`. On `/` or `/digital-twin`, run:

```js
const tools = await document.modelContext.getTools();
tools.map((tool) => tool.name);
```

The result should contain exactly the twenty-four tools listed above. Full commands and the deterministic demo workflows are in [docs/webmcp/LOCAL_TESTING.md](docs/webmcp/LOCAL_TESTING.md).

The repository includes [`render.yaml`](render.yaml) for a no-billing Render web service. It builds with `npm ci --include=dev && npm run build`, starts Express, and checks `/api/health`. The public app automatically saves its full project and named room versions in **IndexedDB in the current browser**. “Saved in this browser” confirms a completed disk transaction. Refresh, server-session expiry, Render restart and redeployment do not replace that saved project. First-time visitors adopt their existing isolated server session (or the approved starter snapshot); other browsers remain independent. Older tabs cannot silently overwrite newer saves. This is same-browser/device storage, not account or cloud sync: export JSON before clearing site data, leaving private browsing, or changing computers. Local SQLite and the automated-test seed remain separate. See [docs/webmcp/DEPLOYMENT.md](docs/webmcp/DEPLOYMENT.md).

## Build Week scope and authorship

Before Build Week, the project had a local laboratory layout/indexing prototype, a canonical scene schema, and an early procedural asset catalog. During the competition period, the work concentrated on the judgeable spatial-digital-twin workflow:

- immutable demo-template ownership plus user-owned Demo Room persistence;
- synchronized, material-aware 2D/3D editing with camera-preserving object movement;
- exact cabinet, shelf, drawer, compartment, and bin indexing;
- project-wide Spatial Index search, photographic result evidence, and exact-location camera navigation;
- direct Layout Editor placement warnings backed by deterministic geometry validation;
- a restrained historical factory template with one BÜCHI station and assigned flask evidence;
- a sanitized source-controlled Build Week fixture with its authored layout, indexed equipment, inventory, and exact storage hierarchy;
- authored GLB asset delivery, offline Draco decoding, regression tests, release checks, and submission documentation.

The Build Week work followed the responsibility split documented in **How I used GPT-5.6 and Codex**: I supplied the laboratory expertise and made the product decisions; GPT-5.6 helped structure requirements and workflows; and Codex implemented, debugged, tested, and documented the working system. A possible LabSpace Atlas API remains a clearly labeled future extension rather than a claimed runtime feature.

See [docs/submission/BUILD_WEEK_IMPLEMENTATION.md](docs/submission/BUILD_WEEK_IMPLEMENTATION.md) for the architecture, originality boundary, human/AI collaboration record, and measured demo facts.

## Technology

React 19, TypeScript strict mode, Vite, Express, Node's SQLite module, Zustand, Zod, React Konva, Three.js, React Three Fiber, Drei, Phosphor Icons, QRCode, Vitest, and Playwright. See [ARCHITECTURE.md](ARCHITECTURE.md) for tradeoffs.

## Documentation

- [SETUP.md](SETUP.md) — Windows installation and daily use
- [ARCHITECTURE.md](ARCHITECTURE.md) — system boundaries and technical decisions
- [DATA_MODEL.md](DATA_MODEL.md) — versioned domain schema
- [ASSET_GUIDE.md](ASSET_GUIDE.md) — manifest and asset authoring pipeline
- [docs/EQUIPMENT_REFERENCE_MATRIX.md](docs/EQUIPMENT_REFERENCE_MATRIX.md) — official manufacturer references for reusable laboratory-equipment GLBs
- [docs/DIGITAL_TWIN_WORKSPACE.md](docs/DIGITAL_TWIN_WORKSPACE.md) — Spatial Index Finder behavior, record trace contract, and fidelity boundary
- [ASSET_LICENSES.md](ASSET_LICENSES.md) — asset provenance
- [LICENSE](LICENSE) — Apache License 2.0 for application source code
- [LICENSE-ASSETS.md](LICENSE-ASSETS.md) — separate terms for models, renders, media, references, and branding
- [NOTICE](NOTICE) — attribution and trademark boundary
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — direct dependency licence inventory
- [INDEXING_SYSTEM.md](INDEXING_SYSTEM.md) — code rules and storage hierarchy
- [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md) — editor controls
- [TESTING.md](TESTING.md) — automated and manual validation
- [ROADMAP.md](ROADMAP.md) — limitations and recommended next phase
- [SECURITY_NOTES.md](SECURITY_NOTES.md) — local security model
- [docs/webmcp/JUDGE_GUIDE.md](docs/webmcp/JUDGE_GUIDE.md) — rapid WebMCP judge workflow
- [docs/webmcp/CHALLENGE_SCORECARD.md](docs/webmcp/CHALLENGE_SCORECARD.md) — evidence-based judging-criteria audit
- [docs/webmcp/ARCHITECTURE.md](docs/webmcp/ARCHITECTURE.md) — WebMCP adapter, shared actions, bounded initial creation, and later-change approval
- [docs/webmcp/CHALLENGE_EVIDENCE.md](docs/webmcp/CHALLENGE_EVIDENCE.md) — dated pre-existing versus challenge-built evidence
- [docs/webmcp/DEPLOYMENT.md](docs/webmcp/DEPLOYMENT.md) — production hosting and smoke checks

## Licensing

The application source code, configuration, tests, and original text documentation are licensed
under the [Apache License 2.0](LICENSE). This is the standard root licence GitHub should detect for
the open-source challenge submission. Visual assets, 3D models, renders, photographs, reference
material, and LabSpace brand artwork use the separate terms in
[LICENSE-ASSETS.md](LICENSE-ASSETS.md) and [ASSET_LICENSES.md](ASSET_LICENSES.md). Open-source
dependencies remain under their own licences as summarized in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Known prototype limitations

- This is a single-user local prototype; it has no authentication, organizations, permissions, or concurrent editing.
- Project navigation supports multiple laboratories and rooms, deliberate project/laboratory/room renaming, guarded room deletion, and guarded whole-laboratory deletion. General laboratory/room reordering is not yet implemented.
- The user-visible 115-asset library is fully authored as orbitable GLBs. Two hidden wall-drawing primitives retain deterministic procedural geometry because their dimensions are created interactively.
- The Spatial Index workspace is functionally connected to canonical project data, but the current room renderer is still a planning visualization rather than a measured or scan-derived facility twin. Inventory pictures currently use the containing spatial asset when no item photograph exists.
- All 117 definitions have same-geometry top/isometric imagery; the 115 user-visible assets use authored GLBs and the two hidden wall primitives remain procedural. These are planning representations rather than manufacturer-certified BIM objects.
- Authored and parametric assets are planning representations, not manufacturer-certified BIM/CAD models.
- Simple single-loop straight-wall floors are supported, but open chains, branches/partitions, multiple loops, holes, curves, and self-crossing perimeters use the rectangular fallback; wall joins and opening anchors are not a full solid-modelling kernel.
- Only one optional historical environment profile is currently registered; it is sparse visual dressing, not measured or selectable MEP/BIM geometry.
- The ten floor and ten wall finishes are optimized planning visuals with a mixture of shared photographic and procedural detail. They are not certified wet-lab, fire, slip, or construction specifications.
- Labels use browser print-to-PDF rather than a bundled PDF engine.
- The database stores validated project JSON behind a repository adapter; normalized multi-user relational tables are a future migration.

## Future SaaS migration

Keep the domain schemas and renderer contract, replace the repository with PostgreSQL, add organization-scoped IDs and row-level authorization, store immutable versions separately, add authenticated APIs and collaboration events, and move large exports to background jobs. The browser editor can remain substantially unchanged.
