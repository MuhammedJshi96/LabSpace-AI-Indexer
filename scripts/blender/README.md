# Blender asset authoring

This folder contains the deterministic, headless Blender sources for LabSpace's
104 authored catalog models. Every searchable catalog item has an authored GLB;
hidden wall construction primitives remain procedural. Casework generators share strict
face-reveal, pull, plinth, and module-proportion rules so a revision rebuilds one
current asset per catalog id rather than stacking a legacy model beneath it.

## Rebuild the hero library

From the repository root, rebuild every authored GLB with:

```powershell
npm run assets:build
```

The wrapper uses the project-local Blender 4.5.11 LTS executable, runs all eighteen
authoring sources, compresses geometry, applies the explicit family/role finish
recipes, rebuilds storage rigs, and then runs `render_hero_catalog.py` to regenerate the
transparent isometric and top images used in the Asset Library and 2D plan:

| Source script                        | Authored GLB output                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lab_casework_batch3.py`             | `lab-bench-sink.glb`, `lab-bench-overhead.glb`, `stainless-wash-basin.glb`, `stainless-enclosed-basin.glb`, `island-bench-service-bridge.glb`                                                                                                                 |
| `lab_storage_batch4.py`              | `base-cabinet.glb`, `base-drawer-cabinet.glb`, `sink-cabinet.glb`, `glass-wall-cabinet.glb`, `tall-cabinet.glb`, `open-shelving.glb`                                                                                                                          |
| `lab_reference_storage_batch5.py`    | `sliding-door-cabinet.glb`, `glazed-sliding-cabinet.glb`, `laboratory-drying-rack.glb`, `lab-freezer.glb`, `solvent-cabinet.glb`                                                                                                                              |
| `lab_architecture_batch8.py`         | `single-door.glb`, `double-door.glb`, `sliding-door.glb`, `narrow-lite-door.glb`, `cleanroom-glazed-door.glb`, `double-sliding-door.glb`, `standard-window.glb`, `wide-window.glb`, `sliding-window.glb`, `observation-window.glb`, `pass-through-window.glb` |
| `lab_support_batch9.py`              | `rolling-bottle-cart.glb`, `stainless-process-vessel.glb`, `retort-stand-assembly.glb`, `gas-cylinder.glb`, `eyewash.glb`, `fire-extinguisher.glb`                                                                                                            |
| `build_rotary_evaporator.py`         | `rotary-evaporator.glb`                                                                                                                                                                                                                                       |
| `lab_furniture.py`                   | `lab-bench.glb`, `center-island-bench.glb`                                                                                                                                                                                                                    |
| `cold_autoclave.py`                  | `ultra-low-freezer.glb`, `autoclave.glb`                                                                                                                                                                                                                      |
| `hoods.py`                           | `fume-hood.glb`, `biosafety-cabinet.glb`                                                                                                                                                                                                                      |
| `instruments.py`                     | `benchtop-centrifuge.glb`, `compound-microscope.glb`                                                                                                                                                                                                          |
| `storage_carts.py`                   | `slotted-angle-storage-rack.glb`, `wire-basket-trolley.glb`                                                                                                                                                                                                   |
| `equipment_batch2.py`                | `vacuum-pump.glb`, `forced-air-lab-oven.glb`, `multi-position-heating-bath.glb`, `vacuum-cold-trap-system.glb`                                                                                                                                                |
| `lab_fidelity_batch6.py`             | `round-stool.glb`, `laboratory-chair.glb`, `office-chair.glb`, `analytical-balance.glb`, `top-loading-balance.glb`, `water-bath.glb`, `dry-block-heater.glb`, `vortex-mixer.glb`                                                                              |
| `lab_fidelity_batch7.py`             | `hplc-system.glb`, `gas-chromatograph.glb`, `spectrophotometer.glb`, `plate-reader.glb`, `microcentrifuge.glb`, `hotplate-stirrer.glb`                                                                                                                        |
| `lab_instruments_batch10.py`         | `floor-centrifuge.glb`, `incubator.glb`, `shaking-incubator.glb`, `pcr-machine.glb`, `real-time-pcr.glb`, `lab-refrigerator.glb`                                                                                                                              |
| `lab_remaining_equipment_batch11.py` | `laminar-flow.glb`, `stereo-microscope.glb`, `electrophoresis-tank.glb`, `gel-doc.glb`, `ice-maker.glb`, `glassware-washer.glb`                                                                                                                               |
| `lab_catalog_completion_batch12.py`  | Columns, corner/mobile benches, desks, wall/safety cabinets, mobile drawers, lockers, racks, cold storage, computer workstation, printer, shower and bins                                                                                                     |
| `lab_reference_batch13.py`           | Wide-lite/transom/egress doors, blind/clerestory windows, asymmetric bench, institutional trough sink, computer laboratory bench and chiller                                                                                                                  |

The files are written to `public/models/hero/`. They use metric, real-scale
planning dimensions; a footprint-centred, zero-height floor anchor; orbitable
front, back, side, and top construction; and PBR-named material groups. Static
parts are consolidated by material to keep room rendering practical.

`render_hero_catalog.py` auto-frames every delivered GLB and writes
`public/models/hero/renders/<asset>-isometric.png` at 384×256 and
`<asset>-top.png` at 384×384. These are derived artifacts; the GLB and its Python
authoring source remain authoritative. The current authored set therefore
provides 208 same-geometry static renders. Cycles denoising gives glass and metal
clean offline catalog captures without increasing runtime rendering cost.

`polish-catalog-materials.mjs` is the authoritative delivered finish review. Its
explicit family and component-role mapping keeps benches, sinks, bins, lockers,
storage and equipment internally consistent while retaining safety colors,
reference-specific accents, rubber and glass. It changes only GLB material JSON,
not geometry or storage identifiers. `AssetVisual` must not apply its older
photographic overlays or recoloring rules to revision-marked reviewed materials.

Shared source construction helpers include `reference_sink_construction.py`
(continuous formed decks and coved bowls), `manufactured_surfaces.py` (rounded
enclosures/pads and spun basins), `fixed_casework_joints.py` (bearing collars),
and `storage_anatomy.py` (fixed face frames and working storage assemblies).
See `docs/catalog-polish.md` for references, checks and compatibility boundaries.

After a rebuild, validate the delivered binaries with:

```powershell
npm run validate:assets
```

The validator checks the manifest declarations, GLB headers and JSON chunks,
mesh content, the 12 MB size ceiling, the local decoder bundle for Draco-compressed
models, and the presence, dimensions, and alpha channel of every authored catalog
render.

## Offline runtime contract

Authoring sources first export plain, inspectable GLBs. The delivery pass then
Draco-compresses their geometry and serves the decoder entirely from
`public/draco/gltf/`, so the application never depends on a CDN or external asset
service. `AssetVisual` attempts the authored model first and contains loading or
decoding failures within that asset; it falls back to the asset's procedural
Three.js model instead of blanking the room or Asset Studio. The fallback is
error-only and is never rendered underneath a loading authored model. A missing
generated PNG similarly falls back to the procedural plan/library drawing.

## Provenance and intended use

The models are original, dimension-driven planning representations. The
user-supplied Kyushu University Room 809 photographs are the primary reference
for proportions, finishes, wear, cabling, and recognizable laboratory context.
Official manufacturer pages and manuals are anatomy references for controls,
vents, service connections, and hidden-side construction only. No manufacturer
mesh, CAD drawing, logo, label, or catalog texture is copied into these files,
and the dimensions are not certified installation dimensions.

## Individual builds and QA

Each source accepts its own command-line options for selective builds, preview
renders, or optional `.blend` snapshots. For example:

```powershell
$blender = '.\.tools\blender-4.5.11-windows-x64\blender.exe'
& $blender --background --factory-startup `
  --python scripts\blender\lab_furniture.py -- `
  --output-dir public\models\hero

& $blender --background --factory-startup `
  --python scripts\blender\inspect_glb.py -- `
  public\models\hero\lab-bench.glb
```

`inspect_glb.py` re-imports a delivered model for structural inspection, while
`render_glb_preview.py` produces deterministic studio QA views. Generated QA
cameras and lights are not included in production GLBs. The Python authoring
scripts, rather than optional `.blend` snapshots, remain the source of truth.
