# Architecture

## Shape of the system

```text
React editor shell
  ├─ Zustand editor state + command history
  ├─ React Konva 2D renderer
  ├─ React Three Fiber 3D renderer
  ├─ indexing / geometry / validation domain services
  └─ local HTTP API
       └─ ProjectRepository interface
            └─ SQLite implementation
```

The canonical `Project → Laboratory → Room → Scene` object graph is the only layout state. A project may contain multiple laboratories and rooms, while each room owns one independent scene. Both renderers consume the active scene directly. Positions and dimensions remain in millimetres; only the 3D renderer converts millimetres to metres at its boundary. DEMO-01 is seeded showcase data, not an architectural singleton; Room 809 appears only as reference provenance.

Spatial Index Finder reads the same canonical object graph and derives searchable equipment, inventory, room, and nested storage records. Explicit result selection drives scene focus and the evidence inspector; it does not maintain a competing copy of room state. Placement findings come directly from deterministic geometry services in the Layout Editor. No live model provider is present in the shipped runtime.

## Module boundaries

- `src/domain`: Zod schemas, generic project/laboratory/room factories, semantic layers, materials, optional environment profiles, migrations, seed data, lab-aware index generation, geometry, history commands, serialization, and the asset manifest.
- `src/store`: editor orchestration, selection, previews, command commits, autosave state, versions, and UI state.
- `src/components`: editor shell and rendering surfaces.
- `src/lib`: API client and export builders.
- `server`: HTTP routes plus the repository adapter.
- `tests`: unit/integration and browser workflows.

## Important decisions

### Vite + Express instead of Next.js

The prototype is a desktop-like editor with a local API, no server-rendered pages, and no cloud deployment requirement. Vite provides faster local startup and a smaller runtime surface; Express owns the narrow persistence API. A future hosted product can place the same React editor inside Next.js without changing the domain model.

### Node SQLite instead of Prisma

Node 24's built-in `node:sqlite` keeps installation project-local and avoids a generated client, native binary lifecycle, or external database process. All persistence is behind `ProjectRepository`, so a Prisma/PostgreSQL implementation can replace it later. The adapter stores validated versioned project JSON and immutable room-version rows in SQLite.

### Plain CSS instead of Tailwind or Radix

The reference required a dense, highly specific CAD composition. A small tokenized stylesheet provides tighter control and no additional runtime. Native semantic buttons, inputs, dialogs, and focus states cover the current accessibility requirements.

### Procedural geometry

All assets share validated dimensions, a 2D footprint/thumbnail generator, and a low-to-medium-detail Three.js profile. Geometry is reused where practical. This avoids unlicensed catalog models and keeps resize behaviour coherent.

### Generic workspace and scene-local layers

`createBlankProject`, `createBlankLaboratory`, and `createBlankRoom` build professional defaults without cloning the demonstration scene. The project workspace activates any room in any laboratory. New rooms start empty and have no environment profile.

Layers carry semantic roles such as `walls`, `openings`, `storage`, and `equipment`. Asset placement resolves the matching role inside the active room's scene, so imported projects and newly generated rooms do not depend on IDs from `seed.ts`. Known legacy layer names can be normalized to roles, custom layers are preserved, and missing defaults receive fresh IDs.

### Index, material, and environment registries

Index generation requires the active laboratory code along with room and optional zone codes. Equipment records derive their initial equipment ID from the placed object's actual spatial index. These are domain rules rather than Room 809 conventions.

The floor-material registry is the shared source for 2D plan patterns and 3D PBR parameters. It currently includes light-gray epoxy, sealed concrete, and welded vinyl; epoxy has photographic maps, while concrete and vinyl are procedural.

Environmental context is assigned with nullable `Room.environmentProfileId`. It is presentation-only and remains outside the selectable/indexed scene. The DEMO-01 reference-services profile is the only registered example today; the registry accepts additional room templates without identity checks.

### Camera command boundary

The 3D renderer only reframes for an explicit room, preset, presentation, or exact-record focus command. Ordinary 2D object movement updates scene geometry without resetting the orbit. Per-room saved camera poses remain authoritative; rooms without one open with the user-approved relaxed split-view isometric scale, expressed relative to the room envelope rather than DEMO-01 coordinates.

### Future LabSpace Atlas API boundary

An optional future provider may translate natural-language intent into calls to the canonical Spatial Index and validator. Its output must remain an explanation of returned evidence, never a source of inventory, ownership, maintenance, or safety facts. The current application is complete and testable without that adapter, an API key, or usage billing.

## Editing and history

Property changes and completed gestures become `SceneCommand` records. Dragging uses a live preview, then commits one command on pointer release; it does not create a history snapshot for every movement. Undo and redo apply or revert commands against the scene.

## Persistence and versioning

The client debounces autosave by 900 ms and exposes unsaved, saving, saved, and error states. The API validates every project with Zod. Named versions store a complete immutable scene document and schema version. Import passes through migration handling and schema validation before becoming active.

## PostgreSQL/SaaS path

Add organization, membership, and user identifiers at the API boundary; normalize projects/rooms/versions for indexed queries; use PostgreSQL JSONB for the scene payload; enforce organization filters in the repository; add object storage for exports; add authenticated event streams for collaboration; and retain Zod as the client/server contract.
