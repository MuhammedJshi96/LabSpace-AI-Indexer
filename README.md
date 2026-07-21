# LabSpace AI Indexer

<p align="center">
  <img src="docs/submission/labspace-ai-indexer-thumbnail-3x2-source-v1.png" alt="LabSpace AI — Design, Index, Find" width="100%" />
</p>

<p align="center"><strong>Design the lab. Index every location. Find anything instantly.</strong></p>

LabSpace AI Indexer is a local-first, multi-laboratory layout editor and indexing system with synchronized 2D and 3D views, millimetre-accurate scene data, physical storage indexing, inventory assignment, equipment records, versioning, labels, reports, and validation. It stores projects in a local SQLite database. The included competition showcase is **DEMO-01**; its laboratory character and selected spatial references were informed by the author's Room 809 laboratory, but Room 809 is not the demo's identity or a feature boundary.

## Finalized product tour

### Layout Editor

The complete planning workspace combines the searchable 94-asset library, material-aware 2D plan, synchronized 3D room, editable room data, and surface controls in one desktop composition.

![Finalized LabSpace Layout Editor with synchronized 2D and 3D views](docs/screenshots/layout-editor-final.png)

### Spatial Index Finder and exact-location evidence

The Spatial Index Finder searches canonical equipment, inventory, rooms, and storage paths, then navigates from the selected record to precise room and cabinet evidence.

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/spatial-index-finder-final.png" alt="Spatial Index Finder locating the BÜCHI rotary evaporator" />
      <br /><strong>Equipment focus:</strong> deterministic project search, room navigation, equipment identity, service evidence, and one precise spatial selection.
    </td>
    <td width="50%">
      <img src="docs/screenshots/spatial-index-drawer-final.png" alt="Exact Drawer 02 access preview for the rotary evaporator flask set" />
      <br /><strong>Storage proof:</strong> Drawer 02 opened in place with the inventory photograph, canonical location trail, quantity, owner, and QR identity.
    </td>
  </tr>
</table>

### PBR Asset Studio

Authored laboratory models remain orbitable and inspectable from every side, with validated dimensions, materials, indexing behavior, catalog thumbnails, and the same GLB used in the room renderer.

![Asset Studio showing the authored BÜCHI R-300-class rotary evaporator](docs/screenshots/asset-studio-rotary-final.png)

## Highlights

- One canonical, versioned scene model drives React Konva 2D and React Three Fiber 3D.
- A project navigator creates and switches among multiple laboratories and rooms; generic project/laboratory/room factories never clone demonstration content into a blank workspace.
- A dedicated project-wide Spatial Index Finder searches inventory, equipment, and nested storage locations across every laboratory and room, switches the live spatial scene to a selected result, highlights the related 3D asset or drawer/shelf/bin region, and deep-links back to the same room and editor record.
- Every room owns semantic scene-local layers for walls, openings, furniture, storage, equipment, utilities, safety, labels, and measurements, so placement never depends on seed-owned layer IDs.
- Laboratory-aware object indexes and equipment IDs use the active laboratory, room, and optional zone codes with normalized, case-insensitive uniqueness checks.
- 96 original planning assets across architecture, furniture, storage, equipment, utilities, and safety.
- 74 reference-informed hero assets use authored, genuinely orbitable GLB geometry with front, back, side, and top construction; the other 22 assets retain dimension-driven procedural representations while the authored library expands.
- The authored set now includes detailed benches and wash stations, core casework/storage, professional openings, a raised-service-bridge island, a fully rebuilt BÜCHI R-300-class touchscreen rotary evaporator, and manufacturer-class analytical, thermal, cold-storage, imaging, washing, and clean-air equipment.
- All 96 assets supply material-aware isometric library images and top-view plan images derived from the same authored GLB or procedural geometry used by the 3D view.
- The 22 non-authored entries are captured deterministically from `ProceduralAssetModel` rather than drawn as unrelated geometric icons; they remain performant planning geometry while the authored library expands.
- A visible Asset Studio provides an orbitable PBR preview plus front, back, left, right, top, and isometric camera presets.
- Interactive select, marquee, pan, wall, door, window, measure, move, resize, rotate, copy, paste, duplicate, delete, lock, hide, and z-order actions.
- Newly created laboratories and rooms open with genuinely blank planning canvases; **DEMO-01** remains available separately as the competition showcase.
- DEMO-01 uses a user-authored, storage-first workflow informed by selected layout and equipment references from the author's Room 809 laboratory. It remains separate from the blank planning canvas. The factory demo source is immutable; creating or saving a demo produces a normal persisted room and never rewrites the template.
- Selected wall segments can be translated directly or reshaped from endpoint handles while joined corners and hosted openings remain attached.
- One simple closed straight-wall loop defines the floor: rectangles, concave L-shapes, split edges, and skewed loops share one clipped 2D floor, triangulated 3D floor, area/perimeter result, placement boundary, and normalized undoable resize.
- Placed objects keep a reliable hit area and pointer-relative drag offset, and Select mode pans with middle-mouse drag, Space+drag, Arrow keys, or WASD.
- Continuous wall drawing carries each committed endpoint into the next segment; Enter or double-click finishes a chain, while Escape returns to Select.
- Grid, multi-surface snapping, alignment guides, pointer-centred zoom, fit-to-room, camera presets, wall transparency, and floor visibility.
- Split presentation has a draggable, keyboard-accessible, persistent divider with protected minimum pane widths.
- Rooms without a saved camera pose open with the user-approved relaxed split-view isometric framing; manual orbit poses persist per room, and ordinary 2D object moves never reset the 3D camera.
- The Asset Library and Inspector collapse into narrow, labeled, keyboard-accessible rails when more canvas space is needed.
- A dedicated Favorites tab gives quick access to starred assets; stars update immediately, persist safely across reloads, and remain usable for the current session even when browser storage is unavailable.
- Optional room environment profiles can add 3D-only ceiling, lighting, duct, utility, and service context without altering the indexed scene. The DEMO-01 reference-services profile is the first bundled example and remains independently hideable.
- Visual predefined libraries synchronize six laboratory floor finishes and six professional wall finishes between the 2D plan and 3D PBR room, with per-wall overrides in the Inspector.
- Cabinet, shelf, drawer, compartment, and bin hierarchies with stable codes and exact inventory locations.
- Equipment identity, service, ownership, and utility requirements.
- Readable desktop typography uses a 12px visible minimum, 13px labels, and 14px controls/body text without shrinking the CAD workspace.
- Revision-aware autosave, presentation-safe renderer mounting, contained pane errors, and guarded Konva drag handling protect live edits from stale saves, blank views, and upper-corner snapping.
- Named room versions, restore, version-to-room duplication, and portable JSON import/export.
- QR labels, A4 print layouts, and CSV reports.
- Collision, boundary, door-swing, hierarchy, duplicate code, equipment ID, and serial-number warnings.

## Spatial Index Finder and future AI API

The competition workflow is fully testable without an OpenAI Platform API key or usage billing. The **Spatial Index Finder** performs deterministic multi-term search over canonical equipment, inventory, laboratory, room, owner, note, identifier, cabinet, drawer, shelf, compartment, and bin data. Selecting a result controls the existing 2D/3D focus, evidence inspector, QR identity, editor deep link, and opt-in physical access preview.

There is no live model response in the shipped runtime. GPT-5.6/Codex was the central Build Week engineering and design collaborator for product architecture, synchronized interaction delivery, UI iteration, debugging, asset workflows, browser verification, and automated tests. That work is captured by primary Codex session `019f6a4d-25a9-7812-804c-88b695589b2a`. A future optional **LabSpace AI API** may provide model-driven intent selection and explanations over the existing index and validator tools; until implemented, it is described only as API-ready future architecture.

The Spatial Index renders every visible object in the active room so evidence always matches the Layout Editor. Performance comes from local assets, shared geometry/material reuse, offline decoders, loading discipline, and detail management rather than hiding room contents. The Layout Editor exposes the complete searchable 96-asset library, while Asset Studio loads one orbitable model at a time and releases the previous preview cache.

## Start locally

Requirements: Node.js 22.5 or newer (Node.js 24 LTS is recommended). The built-in SQLite module is the only platform-sensitive runtime requirement.

### One-click Windows launcher

After installing Node.js, Windows users can double-click **[`Start LabSpace.cmd`](Start%20LabSpace.cmd)** in the repository root. The launcher installs missing npm dependencies, keeps the required port `3004`, avoids starting a duplicate server, waits until LabSpace is reachable, and opens the application in the default browser. Keep the minimized **LabSpace AI Server** terminal open while using the application.

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

The repository is self-contained: authored GLBs, plan/library renders, inventory evidence images, material textures, and offline Draco decoder files live under `public/` and are copied into the production bundle by Vite. Judges do **not** need Blender, the private reference photographs, an OpenAI API key, or an asset-rebuild step.

```powershell
git clone https://github.com/MuhammedJshi96/LabSpace-AI-Indexer.git
cd LabSpace-AI-Indexer
npm ci
npm run release:check
npm run dev
```

The server creates a new local SQLite database from the source-controlled seed on first launch. SQLite files, local reference photographs, browser-test output, generated caches, and bulk QA captures are intentionally excluded from Git. The seed opens on an empty planning canvas and includes the user's complete sanitized **DEMO-01** video-showcase room. Choose **Demo room** in the header to open that full room immediately. An immutable 12-object factory template is also retained only as an optional copy/reset utility; it is not a reduced build and does not replace any website code or DEMO-01 content. Copying the developer SQLite database is neither required nor recommended.

See [docs/submission/JUDGE_GUIDE.md](docs/submission/JUDGE_GUIDE.md) for the exact three-minute evaluation workflow and expected evidence.

## Commands

| Command                            | Purpose                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `npm run dev`                      | Start the local API and Vite development server           |
| `npm run build`                    | Create the production frontend bundle                     |
| `npm run start`                    | Start the API and serve the production bundle             |
| `npm run assets:build`             | Rebuild the 74 hero GLBs and their 148 catalog renders    |
| `npm run assets:render-procedural` | Rebuild 44 same-geometry procedural catalog renders       |
| `npm run lint`                     | Run ESLint                                                |
| `npm run typecheck`                | Run strict TypeScript checks                              |
| `npm run test`                     | Run the 115 Vitest unit/integration cases                 |
| `npm run test:e2e`                 | Run the Playwright competition and editor workflows       |
| `npm run validate:assets`          | Validate manifests, authored GLBs, and static PNG renders |
| `npm run release:check`            | Run lint, types, asset validation, tests, and build       |
| `npm run format`                   | Format source and documentation                           |

`npm run assets:build` uses Blender 4.5 LTS. It resolves the project-local portable build by default, or a compatible executable supplied through `BLENDER_PATH`.

## Local data

The active database is `<repository>/data/labspace-indexer.sqlite`. No project data, analytics, or telemetry leaves the computer. JSON export is the portable backup format.

## Build Week scope and authorship

Before Build Week, the project had a local laboratory layout/indexing prototype, a canonical scene schema, and an early procedural asset catalog. During the competition period, the work concentrated on the judgeable spatial-digital-twin workflow:

- immutable demo-template ownership plus user-owned Demo Room persistence;
- synchronized, material-aware 2D/3D editing with camera-preserving object movement;
- exact cabinet, shelf, drawer, compartment, and bin indexing;
- project-wide Spatial Index search, photographic result evidence, and exact-location camera navigation;
- direct Layout Editor placement warnings backed by deterministic geometry validation;
- a restrained 12-object DEMO-01 factory template with one BÜCHI station and assigned flask evidence;
- the user's full DEMO-01 video-showcase room as a sanitized source-controlled fixture with its authored layout, indexed equipment, inventory, and exact storage hierarchy;
- authored GLB asset delivery, offline Draco decoding, regression tests, release checks, and submission documentation.

The user made the product, laboratory-workflow, visual-reference, asset-priority, and competition-story decisions. Codex/GPT-5.6 accelerated architecture, implementation, debugging, test authoring, asset-pipeline scripting, UI iteration, browser verification, release audits, and documentation. The shipped Spatial Index is deterministic local software; a possible LabSpace AI API remains a clearly labeled future extension. The primary Codex build-session ID retained for `/feedback` evidence is `019f6a4d-25a9-7812-804c-88b695589b2a`.

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
- [INDEXING_SYSTEM.md](INDEXING_SYSTEM.md) — code rules and storage hierarchy
- [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md) — editor controls
- [TESTING.md](TESTING.md) — automated and manual validation
- [ROADMAP.md](ROADMAP.md) — limitations and recommended next phase
- [SECURITY_NOTES.md](SECURITY_NOTES.md) — local security model

## Licensing

The application source code is licensed under the Apache License 2.0. Visual
assets, 3D models, renders, photographs, reference material, and LabSpace brand
artwork are excluded from that software licence and remain All Rights Reserved
unless explicitly stated otherwise. See [LICENSE-ASSETS.md](LICENSE-ASSETS.md)
and [ASSET_LICENSES.md](ASSET_LICENSES.md) before redistributing repository
media.

## Known prototype limitations

- This is a single-user local prototype; it has no authentication, organizations, permissions, or concurrent editing.
- Project navigation supports multiple laboratories and rooms, but laboratory/room rename, delete, and reorder workflows are not yet implemented.
- The photoreal target is an active authoring phase: 74 of 96 catalog assets currently have authored hero GLBs, while 22 use procedural planning geometry.
- The Spatial Index workspace is functionally connected to canonical project data, but the current room renderer is still a planning visualization rather than a measured or scan-derived facility twin. Inventory pictures currently use the containing spatial asset when no item photograph exists.
- All 96 entries now have same-geometry top/isometric imagery, but procedural equipment captures are not substitutes for manufacturer-informed, all-sided authored GLBs at the `references/ref1.png` and `references/ref2.png` detail level.
- Authored and parametric assets are planning representations, not manufacturer-certified BIM/CAD models.
- Simple single-loop straight-wall floors are supported, but open chains, branches/partitions, multiple loops, holes, curves, and self-crossing perimeters use the rectangular fallback; wall joins and opening anchors are not a full solid-modelling kernel.
- Only the optional DEMO-01 environment profile is currently registered; it is sparse visual dressing, not measured or selectable MEP/BIM geometry.
- Light-gray epoxy has photographic material maps. Sealed concrete and welded vinyl currently use synchronized procedural treatments and still need authored photographic maps.
- Labels use browser print-to-PDF rather than a bundled PDF engine.
- The database stores validated project JSON behind a repository adapter; normalized multi-user relational tables are a future migration.

## Future SaaS migration

Keep the domain schemas and renderer contract, replace the repository with PostgreSQL, add organization-scoped IDs and row-level authorization, store immutable versions separately, add authenticated APIs and collaboration events, and move large exports to background jobs. The browser editor can remain substantially unchanged.
