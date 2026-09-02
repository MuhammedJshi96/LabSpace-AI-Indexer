# LabSpace 3D Asset Production Standard

## Status and scope

This document is the repository source of truth for creating or materially improving production-visible LabSpace 3D assets. It applies to Asset Studio, Layout Editor, Spatial Index, generated catalog renders, and any other view that presents the asset as a real laboratory object.

The target is **believable digital-twin quality at practical browser cost**: spatially correct, recognizable, interactive, and materially convincing—not a crude CAD placeholder and not an unnecessarily cinematic VFX model.

This standard does not require immediate mass conversion of legacy assets. Apply it to new assets and to legacy assets when the task concerns production visual quality, asset architecture, or spatially meaningful articulation. Preserve canonical asset IDs, storage bindings, saved-room compatibility, and established material-family rules during incremental migration.

## Current LabSpace architecture

Future work must map onto the system that exists rather than inventing a parallel pipeline.

- **Runtime renderer:** Three.js through React Three Fiber and Drei. `src/components/AssetVisual.tsx` loads authored models with `useGLTF`; Three.js remains responsible for rendering, selection, storage articulation, quality settings, and application interaction.
- **Delivery format:** authored, all-sided `.glb` files under `public/models/hero/`. The searchable catalog currently uses GLB, not OBJ, FBX, or standalone GLTF delivery.
- **Compression:** the build exports inspectable GLBs and `scripts/blender/compress_hero_glbs.py` creates Draco-compressed delivery files. Decoders are served locally from `public/draco/gltf/`. Meshopt and KTX2/Basis are not current runtime dependencies; adopt them only after measured benefit and loader integration.
- **Authoring:** deterministic Blender Python sources live under `scripts/blender/`. Editable batch-14 product scenes live under `assets/blender/batch14/`; older batches are primarily reproducible from their generator scripts. The project-local Blender tool is authoring infrastructure, not a browser dependency.
- **Catalog and metadata:** `src/domain/assets.ts` is the canonical asset registry. `src/domain/schema.ts` defines asset and scene-object data. Preserve this architecture and extend it deliberately when new metadata is justified.
- **Units:** canonical dimensions and scene coordinates are millimetres. Runtime authored-model scaling converts those millimetres to Three.js metres (`1,000 mm = 1 m`). Never change or conceal that boundary.
- **Spatial logic:** `src/domain/geometry.ts` derives rotation-aware footprints, object bounds, collision checks, snapping behavior, door envelopes, and front-access working zones from compact scene metadata—not from triangle-level visual meshes.
- **Articulation:** `src/lib/storage-articulation.ts`, `src/domain/storage-access.ts`, and `src/data/storage-rigs.json` map stable storage locations to named drawer/door transforms. GLB node metadata such as `storageMechanism` drives the actual motion while geometry and materials remain shared.
- **Lighting and presentation:** runtime views use an offline studio HDR environment, sRGB output, tone/color management, bounded shadows, and Low/Balanced/High quality levels. Catalog isometric and top renders are generated from the same delivered GLB.
- **Fallbacks:** `src/components/ProceduralAssetModel.tsx` and procedural thumbnail drawing remain compatibility/error fallbacks. They are not evidence that a complex production asset meets this standard. Straight and half-height walls are valid procedural construction primitives because users generate their dimensions and they are not catalog products.
- **Validation:** `npm run validate:assets` checks registry declarations, GLB structure and mesh content, Draco availability, the current 12 MB delivery ceiling, and same-model catalog renders. Blender scripts add source, shell-continuity, coplanar-surface, and visual-render QA.

Related implementation and provenance documents:

- [`scripts/blender/README.md`](../../scripts/blender/README.md) — current build commands, generators, and QA tools.
- [`docs/ASSET_REFERENCE_CATALOG.md`](../ASSET_REFERENCE_CATALOG.md) — reference and provenance catalog.
- [`docs/EQUIPMENT_REFERENCE_MATRIX.md`](../EQUIPMENT_REFERENCE_MATRIX.md) — equipment-specific reference coverage.
- [`docs/catalog-polish.md`](../catalog-polish.md) — material-family and compatibility boundaries.
- [`ASSET_LICENSES.md`](../../ASSET_LICENSES.md) and [`LICENSE-ASSETS.md`](../../LICENSE-ASSETS.md) — licensing and distribution boundary.

## Non-negotiable production invariant

**A complex final visible laboratory asset must not default to crude runtime primitive geometry.**

The preferred production flow is:

> reference material → reference analysis → asset specification → high-quality mesh authoring → PBR materials → GLB export → optimization → simple collision/interaction proxies → LabSpace / Three.js

Three.js and React Three Fiber are primarily the real-time renderer and interaction environment. Do not duplicate detailed authoring geometry in TypeScript merely because boxes and cylinders are convenient.

The forbidden outcome is not “a cube was used.” Professional hard-surface modeling often starts from cubes, cylinders, booleans, and curves. The forbidden outcome is a final complex instrument that still looks like a handful of untouched programming primitives.

Primitive or simplified geometry is correct for:

- collision and footprint proxies;
- placement previews, snapping guides, and raycast/selection volumes;
- clearance and working-zone visualization;
- debugging and measurement aids;
- hidden parametric room-construction tools; and
- clearly named temporary placeholders with an explicit replacement requirement.

If the available environment cannot produce the required final quality, keep a bounded placeholder for functionality, label it as a placeholder, document what authoring capability or reference is missing, and prepare the GLB integration path. Do not quietly lower the target and call the placeholder complete.

## Quality priority

When tradeoffs are necessary, prioritize in this order:

1. Correct real-world scale and floor anchor.
2. Correct physical footprint and authored front.
3. Recognizable silhouette.
4. Spatially meaningful articulated parts and clearance.
5. Major proportions and construction continuity.
6. Material-role differentiation.
7. Manufacturing detail and readable surface hierarchy.
8. Fine texture and decal detail.
9. Invisible internal detail.

A beautiful model with incorrect dimensions is not acceptable for LabSpace. Nor is a spatially correct box an acceptable final representation of a distinctive instrument.

## Complexity classes

Classify the asset before choosing the authoring effort. A task may move up a class when it is a competition hero or frequent close-inspection subject.

| Class | Typical assets | Minimum expectation |
| --- | --- | --- |
| **A — simple** | waste bin, plain stool, simple shelf, bottle rack | Intentional authored or sophisticated procedural form, correct scale, softened edges, credible construction and materials. Searchable catalog products still ship as authored GLB; runtime geometry is reserved for hidden construction tools or explicit fallbacks. |
| **B — standard equipment** | balance, hotplate, sonicator, mixer, plate reader, printer, workstation | Reference-matched silhouette and proportions, manufactured shell hierarchy, distinct material roles, controls/vents/feet/services, and all-sided construction. |
| **C — interactive/spatial** | centrifuge, freezer, incubator, hood, cabinet, drawer bench, storage system | Class B plus independently addressable doors/drawers/lids/sashes/trays, correct pivots, open-state transforms, and clearance behavior. |
| **D — hero/high-value** | signature demo instrument or frequent Asset Studio close-up | Class C where relevant, richer but measured detail, stronger reference confidence, close-view material/decals, and a justified LOD or detail-reduction strategy. |

Do not pay Class D cost for every object. Do not downgrade a distinctive Class B or C instrument to Class A solely to reduce coding effort.

## Phase 1: reference packet and analysis

Never invent a production instrument from memory when useful reference material exists.

Build a small reference packet from, in priority order:

1. supplied Room 809 or user reference photographs for contextual appearance;
2. supplied multi-view/product sheets and user annotations;
3. official manufacturer pages, manuals, specifications, and dimension drawings for scale and functional anatomy;
4. licensed or permission-cleared supplementary images for hidden-side understanding; and
5. analogous equipment only for conservative inference where direct evidence is absent.

Extract and record:

- width, depth, height, worktop or access height, and floor contact;
- silhouette and principal proportional ratios;
- authored front and service/rear orientation;
- doors, drawers, shelves, lids, sashes, trays, rotors, arms, and other motion;
- controls, bezels, vents, handles, hinges, feet, fasteners, ports, cables, sockets, and service anatomy;
- material roles: coating, polymer, stainless, glass, rubber, screen, ceramic, wood/composite, liquid;
- mounting, ventilation, maintenance, operator, door-swing, and drawer-extension needs; and
- evidence gaps and confidence levels.

Use exact dimensions when known. If only some dimensions are known, preserve trustworthy ratios and label estimates. Never silently present an inferred underside, rear panel, clearance, manufacturer, or specification as authoritative.

Reference material is evidence, not distributable source art. Author original, logo-free geometry unless the project owner has explicit rights and a product requirement says otherwise. Do not import manufacturer meshes, trace proprietary CAD, or reuse unknown-license textures.

## Phase 2: concise asset specification

Before modeling a non-trivial asset, write a compact specification in the task notes, source-script header, or relevant reference document. Use the existing catalog ID and registry rather than creating a competing manifest.

```text
Asset ID / name:
Complexity class:
Target dimensions (mm): W × D × H
Authored front and floor anchor:
Reference sources:

Major assemblies:
- ...

Articulated parts:
- node / movement / local axis / pivot / maximum transform

Material roles:
- ...

Spatial behavior:
- physical footprint
- operator/front access
- door, drawer, lid, ventilation, or maintenance clearance

Runtime detail strategy:
- normal editor distance
- close preview needs
- shared/repeated resources

Confidence:
- dimensions: high / medium / low
- front/side/rear/underside: high / medium / low

Compatibility constraints:
- canonical ID, storage rig, revision, saved-room behavior
```

The specification exists to prevent arbitrary geometry from replacing design reasoning. It is not permission to invent data: omit or mark unknown fields.

## Phase 3: authoring strategy

Choose the least expensive route that can actually meet the visual and spatial requirement:

1. reuse an existing approved internal GLB when it is genuinely the same asset;
2. improve an existing editable Blender scene;
3. author an original Blender product scene;
4. use deterministic Blender Python for dimension-driven, repeatable hard-surface construction;
5. use a sufficiently sophisticated authored procedural mesh for a genuinely simple Class A form; or
6. create an explicitly temporary placeholder when production authoring is blocked.

Blender plus Python is the preferred programmable route already supported by the repository. Do not install tools, buy marketplace models, call paid generation/rendering services, or add large dependencies without explicit authorization.

For current batches, the source of truth is either the deterministic Python generator or, where present, the editable `.blend` product scene plus its generator. The runtime GLB is a delivery artifact, not the most editable modeling source.

### Blender source expectations

- Keep major manufacturing parts named and editable.
- Preserve parent hierarchy and local transforms for moving parts.
- Keep manufactured-edge modifiers unapplied in editable product scenes when practical.
- Use booleans, insets, extrusions, bevels/chamfers, weighted normals, support geometry, and custom profiles intentionally.
- Apply transforms or export settings deliberately; do not use arbitrary non-uniform scaling of a finished model to force new dimensions.
- Do not ship authoring cameras, lights, reference planes, hidden duplicates, or obsolete prior versions in the GLB.
- Avoid co-planar overlays and duplicate shells that cause z-fighting during orbit. Use a genuine recess/opening or a deliberate depth cascade.
- Maintain positive bearing joints: fixed panels, legs, aprons, gables, roofs, frames, handles, and worktops must meet or overlap appropriately rather than float or expose the background.

## Geometry and manufacturing quality

Model the structure that explains the object, not detail for its own sake.

### Silhouette and proportions

Match the reference’s large shapes before controls and labels. Confirm front, rear, both sides, top, and close oblique views. Infer hidden construction conservatively from standard laboratory practice.

### Edge treatment

Visible manufactured edges normally need physically plausible bevels or chamfers. Scale edge widths in millimetres to the real product. A single arbitrary bevel across all parts produces toy-like rounding; razor-sharp edges produce synthetic highlights.

### Surface hierarchy

Use real depth relationships:

> chassis → formed shell → inset fascia → recessed control field → bezel → display glass → display surface → button caps / fasteners

Do not simulate this hierarchy with unexplained colored plaques, generic service rectangles, black circles, or coplanar decorative layers. Casework must include real face frames/returns, credible reveals, plinths, and hardware rather than stacked boxes.

### Functional anatomy

Include visible details that identify construction or operation: seams, seals, handles, hinges, vents, feet, fasteners, sockets, drain valves, shelves, rails, ports, and cable/service exits where references support them. Do not add invented details merely to increase polygon count.

### All-sided construction

Asset Studio is orbitable. A polished front facade on an empty box is incomplete. Rear and side panels, vents, service fields, hinges, feet, and top/underside transitions must remain believable from every normal orbit angle.

## Naming, hierarchy, origins, and pivots

The root name should be stable and derived from the canonical asset ID. Child names must describe their runtime or manufacturing role.

```text
plate_reader
├── chassis
├── upper_shell
├── front_bezel
├── plate_tray
├── display_bezel
├── display_glass
├── display_surface
├── vent_left
├── rear_service_panel
└── foot_FL / foot_FR / foot_RL / foot_RR
```

Avoid names such as `Cube.004` for nodes that runtime code, QA, or future authors may need to address. Static subparts may be consolidated during the delivery pass, but editable sources must retain understandable construction.

- The root origin must support footprint-centred placement, rotation, snapping, floor alignment, and predictable bounds. Current delivered assets use a footprint-centred root at floor height.
- Door pivots belong on hinge axes; lids on hinge axes; knobs/rotors at rotational centres; drawers and trays on their true local travel axes.
- Keep a stable authored front. Storage rigs, access cameras, working zones, and object-relative placement depend on it.
- Do not fuse a spatially meaningful moving component into the chassis.

For storage, use stable mechanism IDs and the existing storage-rig pipeline. Do not invent extra doors or drawers to make the model look busy, and do not rename a referenced moving node without updating and validating its rig mapping.

## PBR material standard

Material response must represent the visible finish, not merely the substrate.

- Powder coat, enamel, laminate, porcelain, polymer, and painted steel are dielectric even when metal exists underneath.
- Reserve metallic response for exposed stainless, brushed metal, bare fasteners, shafts, rails, hinges, and other conductive surfaces.
- Use distinct calibrated roles for powder-coated steel, stainless steel, anodized aluminium, ABS/polycarbonate, rubber, glass, screens, ceramic, wood/composite, and liquids when present.
- Preserve the established LabSpace family palettes and role recipes. Consistency means coherent finish behavior within a family, not turning every part white, silver, or metallic.
- Clear architectural/cabinet glass remains transparent with its approved subtle cyan accent. Transmission is only for physically clear parts; screens, printer windows, pipette bodies, and microplate wells do not inherit generic cabinet-glass transmission.
- Use roughness and restrained normal detail to communicate fine coating/mesh grain. Do not model microtexture as dense geometry.
- Screens require housing, bezel, recessed glass, and display content; a luminous rectangle floating on a shell is not a finished display.

Use compact shared textures where they materially improve identification or surface scale. Keep texel density appropriate to expected view distance. Prefer reusable normal/roughness tiles and compact decal atlases over unique oversized images. Decals and screens may carry generic, original markings; do not reproduce protected branding by default.

The runtime enhancement layer may tune known material roles, but it must not repaint a reviewed asset or compensate for missing authoring structure. The GLB and its reviewed material assignments remain authoritative.

## Articulation and operational clearance

Keep any component that changes access, placement, or usable laboratory space independently addressable. Examples include cabinet/refrigerator doors, drawers, lids, hood sashes, plate trays, and movable shelves.

For each meaningful motion, define or preserve:

- closed transform;
- movement type (hinge, linear drawer/slide, lift, rotation);
- local axis and direction;
- pivot or travel origin;
- maximum angle or distance; and
- clearance or access implication.

LabSpace’s current storage motion uses stable storage rig metadata. New non-storage animation requirements should extend the existing asset metadata deliberately; do not hide critical movement in ad hoc component state.

Distinguish:

- **physical footprint:** body volume used for placement/collision;
- **operational clearance:** opened door/drawer/lid, operator, loading, or working zone;
- **service clearance:** ventilation, cable, plumbing, and maintenance access.

These regions are normally invisible and may be shown by planning/audit tools. They are planning evidence, not manufacturer certification. Use known values where available and mark conservative estimates.

## Visual mesh versus spatial proxies

Never assume the detailed GLB triangles should drive every spatial calculation.

| Responsibility | Preferred representation in LabSpace |
| --- | --- |
| Final appearance | Authored, optimized GLB and reviewed PBR materials |
| Placement footprint and broad collision | Existing millimetre dimensions and rotation-aware compact bounds/proxies |
| Selection/raycast | Deliberate simplified hit volumes or bounded visual raycast where measured acceptable |
| Snapping | Existing scene-object dimensions, anchors, and wall/bench rules |
| Storage motion | Named GLB nodes plus canonical storage-rig metadata |
| Door/drawer/operator/service clearance | Simple hidden envelopes or zones tied to stable metadata |
| Debugging | Temporary visible proxy overlays, never exported presentation geometry |

This separation allows a visually rich centrifuge to retain a simple collision box and a hinged-lid clearance envelope. Do not degrade the visible model to make collision cheap, and do not make placement iterate over thousands of display triangles without a measured need.

The current schema already has dimensions, anchors, profiles, scene-object transforms, storage mechanisms, and selected clearance rules. Extend those structures only when a real use case needs explicit collision shape, LOD, animation, reference-confidence, or clearance metadata. Avoid a second asset registry.

## Export and integration contract

### GLB delivery

GLB is the preferred runtime format because it packages geometry, hierarchy, transforms, PBR materials, textures, animations, and custom extras. A production integration should:

1. export a clean inspectable GLB from Blender;
2. inspect/re-import it before compression;
3. run the repository delivery/compression pass;
4. write it to `public/models/hero/<asset-id>.glb`;
5. update the existing `model3d` record and revision in `src/domain/assets.ts`;
6. preserve canonical dimensions in millimetres and verify the runtime mm-to-m scale;
7. update storage rig metadata only when anatomy actually changed;
8. regenerate same-GLB isometric and top renders; and
9. validate the actual browser orbit and room use.

Do not render a second hidden copy beneath an authored asset. Loading fallbacks must remain mutually exclusive with the successful GLB, as `AssetVisual` currently intends.

### Authoritative data

- Canonical asset ID, category, dimensions, anchors, profile, storage template, and delivery metadata remain in the existing TypeScript/Zod catalog architecture.
- Blender node extras may describe visual mechanisms, but must not become an undocumented competing catalog.
- Static renders are derived previews, never the visual-model source of truth.
- Preserve revision keys so caches, plan renders, and runtime models update together.

## Performance and optimization

Optimize after the correct silhouette, spatial behavior, and material hierarchy are established.

Use measured, value-preserving techniques:

- merge only static parts that do not need separate animation, selection, or material identity;
- remove genuinely invisible or duplicate geometry, but retain believable orbitable construction;
- reuse geometry, materials, and compact textures across repeated assets;
- allow cloned scene transforms while sharing geometry/material resources, as storage articulation already does;
- keep material count and draw calls intentional;
- resize textures to actual screen contribution;
- use Draco through the existing offline delivery path;
- lazy-load and cache assets through the current GLTF loader;
- use instancing for large repeated populations when interaction semantics permit; and
- create LODs only when profiling shows a useful reduction at real LabSpace camera distances.

LOD is an engineering response, not a checkbox. A practical concept is:

- **LOD0:** Asset Studio or close evidence view;
- **LOD1:** normal Layout Editor / Spatial Index distance;
- **LOD2:** distant room overview.

Do not create three nearly identical files. Current metadata does not yet expose a formal LOD chain; add one only with a runtime selection policy, validation, and measured scene benefit.

The current validator’s 12 MB per-GLB ceiling is a guardrail, not a target or proof of performance. Evaluate total scene memory, decode time, draw calls, triangle count, texture memory, frame pacing, and interaction responsiveness in Low/Balanced/High modes. Keep High opt-in and do not trade stable interaction for an unbounded effect.

Meshopt and KTX2/Basis are possible future optimizations, not current features. Do not claim or adopt them without updating the loader, offline deployment, build, validation, and browser measurements.

## Lighting and visual evaluation

Judge materials under representative LabSpace lighting, not only in Blender’s material preview.

- Use the existing neutral offline environment and controlled soft key/fill lighting.
- Verify sRGB/color management and restrained tone mapping.
- Preserve soft contact near feet, plinths, and panel junctions without mirror-like floor glare or broad baked shadow stains.
- Check clear glass, satin coatings, phenolic tops, stainless, rubber, and displays from multiple orbit angles.
- Validate Low, Balanced, and High. Balanced is the production baseline; High may add bounded detail but cannot hide poor geometry or materials.
- Compare the delivered GLB in Asset Studio and in a populated room. A model that succeeds alone may still be too expensive, too pale, or unreadable at normal planning distance.

Compilation and schema success do not prove visual quality. If browser inspection is available, capture and compare representative views before acceptance.

## Validation and release gates

A changed production asset is not complete until all applicable gates pass.

### Reference and specification

- [ ] Reference packet inspected; sources and redistribution boundaries recorded.
- [ ] Dimensions and front orientation identified; estimates labeled.
- [ ] Complexity class, major assemblies, material roles, articulation, and spatial behavior specified.

### Source model

- [ ] Silhouette and proportions match references at normal viewing distance.
- [ ] Root origin, scale, transforms, and authored front are deliberate.
- [ ] Named hierarchy remains usable; moving parts have correct local pivots/axes.
- [ ] Manufactured edges are beveled appropriately.
- [ ] Fixed construction is connected; no floating hardware, open background gaps, duplicate shells, or unsupported panels.
- [ ] Surface hierarchy uses real recess/depth, with no exposed coplanar z-fighting risks.
- [ ] Front, rear, sides, top, underside transitions, and service anatomy survive orbit inspection.

### Materials

- [ ] Each visible material role has physically credible metallic/roughness/transmission behavior.
- [ ] Painted/coated surfaces are not incorrectly metallic.
- [ ] Transparent materials are used only for physically clear parts.
- [ ] Texture sizes and material count are proportionate; branding/licensing is safe.

### Integration and spatial behavior

- [ ] Canonical ID, millimetre dimensions, model revision, and saved-room compatibility are preserved or intentionally migrated.
- [ ] Physical bounds, authored front, snapping, placement, and selection behave correctly at relevant rotations.
- [ ] Doors, drawers, lids, trays, shelves, or sashes use the correct node, axis, pivot, and open transform.
- [ ] Collision and clearance use simple spatial representations rather than unnecessarily detailed render triangles.
- [ ] Storage access bindings open the actual authored part and show correct contents.

### Delivery and visual QA

- [ ] Inspectable GLB exported and re-imported successfully.
- [ ] Delivery GLB contains one intended current asset, not stacked legacy/current copies.
- [ ] Draco compression and local decoder path work.
- [ ] `npm run validate:assets` passes.
- [ ] Relevant Blender source/shell/coplanar audits pass.
- [ ] Same-GLB top and isometric renders regenerated.
- [ ] Asset Studio orbit checked in front, rear, sides, top, and close oblique views.
- [ ] Populated-room appearance and Low/Balanced/High performance checked.
- [ ] Diff contains no accidental room, inventory, material, or catalog-ID rewrites.

Use the repository build and QA commands documented in [`scripts/blender/README.md`](../../scripts/blender/README.md). Keep high-memory audits sequential or bounded.

## Failure conditions

A production 3D task is not complete when any material condition below remains:

- a complex instrument is only a few untouched boxes, cylinders, planes, or plaques;
- the result does not resemble supplied references in silhouette or major proportion;
- known dimensions are ignored or inferred values are claimed as authoritative;
- required moving doors, drawers, lids, sashes, or trays are fused into the chassis;
- one generic grey/white/silver material replaces visibly different physical finishes;
- painted surfaces are made metallic because their substrate is steel;
- visible edges are razor sharp everywhere or universally rounded like a toy;
- fixed parts float, fail to bear on one another, expose background gaps, or visibly z-fight;
- the front is polished while the rear, side, or top is empty or implausible;
- a dense visual mesh is used unnecessarily for every collision/clearance calculation;
- origins, pivots, travel axes, dimensions, or authored front are wrong;
- an unlicensed third-party model/texture or protected branding is shipped;
- a placeholder is presented as a final production asset;
- visual inspection was available but only compilation/tests were checked; or
- the implementation was chosen solely because it required fewer lines of code.

## Legacy migration policy

Do not mass-convert the catalog. For each touched legacy asset:

1. determine whether the request is functional, visual, interaction, architecture, or replacement work;
2. preserve the current canonical ID and data bindings;
3. keep the old implementation only as a clearly bounded error fallback or rollback point;
4. author and validate one replacement GLB through this standard;
5. ensure the authored model and fallback never render simultaneously;
6. regenerate derived previews and advance the revision; and
7. publish only after browser and spatial QA.

The large legacy `ProceduralAssetModel` is a compatibility safety net, not a catalog-wide production authoring endorsement. Do not spend repeated polish cycles on a primitive fallback when a reference-led authored GLB is the correct solution.

## Version control, provenance, and licensing

- Record source URLs, supplied reference filenames, date accessed where appropriate, intended use, and confidence in existing reference/provenance documents.
- Follow `ASSET_LICENSES.md`, `LICENSE-ASSETS.md`, and `NOTICE`. User photographs and manufacturer references do not automatically have redistribution rights.
- Author original logo-free geometry and original/shared material maps unless explicit rights say otherwise.
- Keep derived GLBs and catalog renders deterministic and revisioned with their source changes.
- Do not commit `.blend1`, render scratch files, huge simulation caches, or redundant texture intermediates.
- The repository currently marks binary formats in `.gitattributes` but does not configure Git LFS. Evaluate repository size and agree on an LFS/source-storage policy before adding a large new collection of editable binary scenes; do not silently introduce LFS or external storage.
- Keep project-local authoring tools ignored. They are reproducibility aids, not application payloads.

## Future Codex workflow

When asked to create or improve an asset:

1. Read root `AGENTS.md`, this document, `scripts/blender/README.md`, and the relevant reference/material rules.
2. Inspect the existing registry entry, GLB, generator/`.blend`, storage rig, dimensions, derived renders, and fallback.
3. Inspect all supplied and approved references; record dimensions and confidence.
4. Classify the asset and write the concise specification.
5. Choose a production-capable authoring route. If blocked, create only an explicit placeholder and document the path forward.
6. Author the visual model with stable hierarchy, pivots, real seams/recesses, connected construction, and all-sided anatomy.
7. Create or preserve simple spatial/collision/clearance representations separately.
8. Assign calibrated PBR material roles and compact textures/decals.
9. Export, inspect, compress, integrate into the existing catalog, and regenerate previews.
10. Validate scale, footprint, authored front, storage/articulation, placement, selection, and clearance.
11. Render and visually compare the delivered GLB against references in Asset Studio and a real room.
12. Profile/optimize and run all applicable gates before declaring the asset production-ready.

## Decision principle and self-review

Optimize for the **best practical product result**, not the fewest lines of code. At the same time, do not spend geometry, texture memory, or GPU time on invisible detail with no LabSpace value.

Before finishing, ask both questions:

1. Would these instructions stop a future agent from representing a realistic centrifuge as `BoxGeometry + CylinderGeometry + generic grey material` and calling it final? **They must.**
2. Would these instructions stop that agent from using a simple collider box or starting a Blender hard-surface model from a cube? **They must not.**

The intended rule is permanent:

> Simple internal representation is good. Crude final visual representation is not.
