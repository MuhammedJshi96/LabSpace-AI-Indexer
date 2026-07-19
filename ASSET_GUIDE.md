# Asset guide

## Catalog status

LabSpace currently contains 84 reusable catalog definitions. Twenty high-use,
reference-informed assets have original Blender-authored GLBs and 40 GLB-derived PNG renders: 20
isometric Asset Library views and 20 top-view plan images. The remaining 64
assets use recognizable Three.js `ProceduralAssetModel` planning geometry and
128 deterministic PNG captures of those exact models: 64 isometric and 64 top
views. The complete catalog therefore ships 168 same-geometry PNGs. This makes
the library, plan, room, and Asset Studio visually consistent in every laboratory; it does not make
the procedural models photoreal or manufacturer-authored, so the
`references/ref1.png` and `references/ref2.png` target remains incomplete.

The authored hero set is:

- laboratory bench, sink bench, overhead service bench, and centre-island bench;
- raised-service-bridge island bench;
- open and enclosed stainless wash basins;
- touchscreen rotary evaporator;
- ultra-low freezer and top-loading autoclave;
- fume hood and biosafety cabinet;
- benchtop centrifuge and compound microscope;
- slotted-angle storage rack and wire-basket trolley.
- oil-rotary vacuum pump, forced-air oven, six-position heating bath, and
  stacked vacuum cold-trap/chiller station.

Room 809 photographs are reference evidence for this initial batch, not a
runtime assignment boundary. Assets remain project-wide definitions that can be
placed, indexed, resized, and rendered in any laboratory and room.

## Manifest contract

Add assets to `src/domain/assets.ts` through the shared `asset(...)` factory.
Every definition includes:

- stable ID, name, short name, category, tags, and description;
- object type and indexing behaviour;
- default, minimum, and maximum dimensions in millimetres;
- procedural profile, material, accent, anchor, and connection metadata;
- optional authored-GLB source, real authored dimensions, and cache revision;
- collision footprint, top-view footprint, 3D representation, and generated
  thumbnail metadata.

The same editable dimensions drive the plan footprint, collision checks, room
model, and generated asset imagery. `AssetVisual` prefers a declared authored
GLB and scales its real authored dimensions to the current item dimensions. The
room and Asset Studio load that orbitable model directly. The Asset Library and
2D plan load deterministic isometric/top PNGs generated from the exact same GLB
by `render_hero_catalog.py`; this preserves material detail without compiling a
second WebGL scene during every edit. Non-authored assets instead load their
all-sided `ProceduralAssetModel` in the room and Asset Studio, while
`scripts/render-procedural-assets.ts` captures that same geometry into a 384 × 256
isometric PNG and a 384 × 384 top PNG. Across both pipelines, every one of the
84 definitions has two same-geometry views: 40 authored GLB-derived renders plus
128 procedural renders, or 168 PNGs total. Missing resources remain isolated to
the affected asset and fail safely; the equipment-specific canvas illustration
is an image-load fallback, not the normal presentation for the 64 procedural
entries. `assetThumbnailKind(...)` is therefore fallback-only display routing
and must not replace the canonical asset manifest.

Scene placement resolves the active room's semantic layer role rather than a
demonstration layer ID. Equipment indexing likewise uses the active
laboratory/room/zone context, and a new equipment record derives its default
equipment ID from the placed object's actual index code.

Asset surface materials and room floor materials are separate registries. The
current room-floor registry contains light-gray epoxy, sealed concrete, and
welded vinyl sheet; the selected finish drives synchronized 2D plan and 3D PBR
treatments. Only epoxy currently has photographic maps, so concrete and vinyl
must not be described as photo-textured until authored map sets are added.

## Add an equipment type

```ts
asset("orbital-shaker", "Orbital shaker", "Laboratory equipment", [520, 600, 320], {
  connection: "bench",
  profile: "box",
  material: "white",
  accent: "#4f8f9d",
});
```

Then:

1. Add useful search tags and an equipment-specific description.
2. Extend `ProceduralAssetModel.tsx` when an existing fallback does not create a
   recognizable all-sided planning silhouette.
3. Rebuild its isometric and top captures with
   `npm run assets:render-procedural`; update `asset-thumbnail.ts` only when its
   image-load fallback also needs more recognizable anatomy.
4. For authored hero treatment, add a floor-centred, real-scale model to the
   appropriate script in `scripts/blender/`. Declare `model3d.previewSrc`,
   `model3d.authoredDimensions`, and `model3d.revision` in the manifest.
5. Export a plain self-contained GLB without Draco. The runtime is intentionally
   offline and must not depend on a remote decoder.
6. Run `npm run assets:build` to rebuild all eight authored source families and
   their 40 transparent isometric/top catalog renders. Run
   `npm run assets:render-procedural` to rebuild the other 128 captures, then
   run `npm run validate:assets` to verify all 168 PNGs.
7. Open [Asset Studio](http://127.0.0.1:3004/asset-preview), locate the asset, and
   inspect its front, back, left, right, top, and isometric views. Confirm that
   its generated plan and library imagery use the same material treatment.
8. Add or update a browser assertion when the asset changes interaction
   behaviour, and record any third-party provenance in `ASSET_LICENSES.md`.

## Authoring constraints

- Preserve a footprint-centred floor anchor and real metric planning scale.
- Model credible construction on every orbitable side; do not use billboards or
  a detailed front attached to an empty box.
- Use shared geometry/materials and consolidated static groups to keep authored
  assets practical in full-room views.
- Keep each GLB below 12 MB and include no production cameras or lights.
- Do not use Draco, remote fonts, remote textures, or runtime asset services.
- Treat the supplied Room 809 photographs as primary evidence for matching
  equipment and casework, while keeping every finished asset reusable outside
  that demonstration room. Use manufacturer documents as supplementary anatomy
  references.
- Never claim manufacturer certification or import commercial catalog geometry
  without a verified redistributable licence.

See `scripts/blender/README.md` for the eight Blender sources and reproducible build
workflow, and `docs/ASSET_REFERENCE_CATALOG.md` for the official anatomy links.
