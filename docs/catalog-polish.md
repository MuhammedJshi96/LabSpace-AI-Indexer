# Catalog construction and finish review

Local catalog revision: `catalog-polish-r7` (August 31, 2026).

The subsequent [visible-finish correction](reference-visible-finishes.md)
supersedes the earlier silver/porcelain recipes below: matching bench panels
are soft grey laminate, handles are matte-black coated, and tops/bases follow the user's
charcoal/plum and graphite color reference. Paint and polymer never use bare
metal response; genuine stainless sinks and small hardware remain distinct.

## Visual contract

The earlier r3 review covered all 104 authored assets in front/isometric and rear
catalog boards. The current correction preserves recognizable silhouettes and
good existing anatomy while repairing specific fixed joints and material roles; it is
not a claim that every model was rebuilt or is manufacturer-certified.

Finishes are now explicit GLB data, shared by Asset Studio, room rendering and
the 208 isometric/top catalog images. Reviewed assets bypass the legacy runtime
photographic overlays and recoloring. A finish decision is recorded on each
material, with its family and (where applicable) a shared component-role recipe.

| Family                          | Finish logic                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Laboratory benches              | Soft grey laminate/coated faces, matte-black pulls, charcoal/plum satin phenolic tops and dark recessed plinths              |
| Sinks                           | Consistent brushed 304-style steel decks/bowls, brighter hardware; institutional enclosure remains painted casework         |
| Cabinets and drawers            | Grey folded structure, light textured enamel fronts, black pulls; hinges/runners remain metal and glazing remains transparent |
| Lockers                         | Muted slate-grey doors, lighter grey structure, restrained locks and vents                                                  |
| Bins                            | Shared metal pedal/hardware response; general steel and biological red remain functionally distinct                         |
| Safety cabinets                 | Blue chemical-cabinet epoxy appearance and yellow flammable-cabinet appearance; neither implies certification               |
| Seating, racks and workstations | Consistent metal frames; preserve deliberate upholstery, polymer and work-surface differences                               |
| Instruments and openings        | Retain category-specific anatomy, glass, control panels and functional colors; common metals/enamels use reviewed responses |

The exact asset-to-family membership and material-name aliases live in
`scripts/polish-catalog-materials.mjs`. These are intentionally explicit: a
global “make everything white” or “turn every pale material into metal” rule
would destroy material semantics.

## Construction changes

- Both the open stainless wash station and institutional trough cabinet use
  continuous formed decks and coved bowls, connected drains, mounted mixers,
  folded splashbacks, and deliberate enclosure/frame construction.
- Storage hollowing retains header, sill and side returns. This closes empty
  strips around doors while preserving the actual moving leaves and shelves.
- Shared casework pulls use slim folded metal channels or straight bars with
  mounting feet. Large black handle rectangles and oversized curved loops are
  removed from the reviewed assemblies. Safety-cabinet labels stay on one leaf.
- Worktop bearing collars close the measured bench/sink gaps; a bearing tray
  joins the mobile drawer unit's top to its body.
- The close-angle `Screenshot 2026-08-31 165005.png` exposed a different problem:
  an open overlay-to-gable channel. Six bench families now receive continuous
  fixed gable edges and inner closure returns, with 2 mm clearance behind the
  moving front and a 5 mm side-edge setback. These fixed parts do not belong to
  moving drawer groups. Both island faces and the asymmetric bench's stepped
  left gable are covered. The 75 mm lower-cabinet recess is preserved.
- Earlier parts of this review refine chair pads, the microcentrifuge shell,
  printer enclosure, table connections, eyewash basins, shower connections and
  bin floor contact. Recessed cabinet bays retain their previously approved
  depth difference from the drawers.

## References and scope

Original, logo-free geometry is informed by the supplied laboratory photos and
these primary sources; no product mesh or copyrighted catalog texture is used:

- [Shimadzu laboratory sinks](https://www.shimadzu-rika.co.jp/products/laboratory/sink/index.html)
  and [laboratory benches](https://www.shimadzu-rika.co.jp/products/laboratory/bench/sk1.html):
  institutional casework and wash-station construction.
- [Elkay commercial sink construction guide](https://www.elkay.com/content/dam/elkayv2/support-and-resources/product-literature/commercial-sinks-and-faucets/f_5122_commercial_brochure_5_21.pdf):
  coved compartments, formed drainboards, splashbacks and tubular frames.
- [Kewaunee steel casework](https://kewaunee.com/product/steel-casework/)
  and [worktops](https://kewaunee.com/product/worktops/): manufactured casework and surface roles.
- [Justrite blue chemical-storage cabinet](https://www.justrite.com/sure-grip-ex-corrosives-acid-steel-safety-cabinet-cap-90-gallons-2-shelves-2-m-c-doors-blue-899002):
  epoxy-blue body, framed doors and ventilation anatomy.
- [Guardian G1902](https://www.gesafety.com/products/stations/G1902.shtml):
  basin, valve, pipe and pull-rod construction.
- [Eppendorf 5425 family](https://www.eppendorf.com/gb-en/Products/Centrifugation/IVD-Products/Centrifuge-5425-5425R-p-PF-934145):
  compact centrifuge silhouette and enclosure anatomy.

These are planning representations, not certified installation, chemical
compatibility, safety, or manufacturer specifications.

## Reliability boundary

No saved room, laboratory, inventory, demo designation or placement is replaced.
Canonical catalog dimensions and asset IDs remain stable. Geometry-derived
selection regions may change slightly when a corrected handle changes mesh
bounds; the 31 existing storage identity graphs are regression-tested against
the pre-polish fixture (part IDs/kinds/bays and location keys/types/parents).

The release checks cover GLB validity, catalog coverage, render framing,
revision-keyed loading, common material roles, authored storage bindings and
fixed-frame metadata. Live Asset Studio checks cover closed and opened storage.
The current 104-item catalog is reviewed on same-model isometric contact
sheets, with live oblique/opening checks for the repaired families. The older
r3 front/rear review remains a baseline, not a claim of exhaustive current
angle-by-angle watertightness verification.

This work is local. Publishing is a separate, explicit user decision.

## Current r7 verification

- 345 unit tests across 49 files pass, including unchanged canonical storage
  identity graphs for all 31 storage rigs and both faces of the stepped islands.
- The circled drawer/gable channel has a dedicated twenty-family regression check,
  separate from the conservative large-detached-component scan. Small designed
  seams, ventilation and working apertures are not treated as accidental gaps.
  Both perpendicular corner-bench runs have the same closure standard, checked
  separately. Mobile, base, wall, tall and computer-pedestal casework use the
  same fixed returns. Hollow safety, locker and cold-storage shells also close
  their overlay-side channels; existing sliding tracks and face frames are
  preserved rather than obstructed by a universal filler strip.
- Every micrograin-mapped primitive has UV coordinates. The texture-only pass
  preserved a SHA-256 comparison of the full catalog's geometry payload and
  base-color/metalness values before the subsequent gable/UV repair.
- Final GLBs total 19,379,520 bytes, 2,287,636 triangles and 1,665 primitive
  batches across 104 assets. The extended joint pass adds one primitive batch
  compared with the initial six-family repair, not a per-frame geometry operation.
- Ten shared 128 px finish maps total 89,649 bytes. The restored white/light
  panel micrograin pair accounts for 25,952 bytes and is used on 79 assets.
  Textures are pooled across model loads; no per-frame environment capture is used.
- These are asset-budget measurements, not an FPS benchmark or a watertightness
  certification. Saved rooms, laboratories, inventory and demo data are not inputs
  to any of the authoring or publishing scripts used in this correction.

## Lighting and plan fidelity

The current renderer uses a shared locally cached 1K HDR, neutral fill and
lower-intensity key lighting across the room, facility and Asset Studio.
Asset Studio keeps a neutral background, low-opacity ground shadows and
bounded contact-shadow rendering. Room shadows use the current Three.js PCF
filter with a restrained radius; obsolete PCFSoftShadowMap fallback warnings
are removed. No continuous environment capture or new post-processing stack
is introduced.

The grey-top regression came from excessive catalog illumination/specular
glare after the reviewed-material early return skipped the phenolic render
adjustment. The fix preserves GLB base colors, lowers plan exposure and
suppresses overhead specular glare in the derived top image. Six delivered-PNG
pixel tests distinguish charcoal worktops from light laminate desks. Catalog
images use the new `catalog-light-r3` cache key; render resume also considers
the lighting script's modification time, not only the GLB date.

## Earlier release verification (r3)

- `npm run release:check`: passed lint, TypeScript, asset validation, 298 tests
  in 48 files, and the production build.
- All 208 regenerated authored catalog images passed render validation.
- All 104 final front/isometric and rear views were visually reviewed.
- Live checks covered the revised sinks, chemical cabinet, asymmetric bench,
  locker and mobile drawer; cabinet and drawer access previews were exercised.
- The build still reports the existing large-bundle advisory; it is not a
  failed build and this asset revision does not introduce a new runtime engine.
