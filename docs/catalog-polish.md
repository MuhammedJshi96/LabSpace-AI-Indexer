# Catalog construction and finish review

Local catalog revision: `catalog-polish-r3` (August 31, 2026).

## Visual contract

All 104 authored assets were reviewed in front/isometric and rear catalog boards.
36 models have changed geometry relative to the pre-polish snapshot; the other
68 retain their geometry while receiving the explicit finish review.
The review preserves recognizable silhouettes and good existing anatomy; it is
not a claim that every model was rebuilt or is manufacturer-certified.

Finishes are now explicit GLB data, shared by Asset Studio, room rendering and
the 208 isometric/top catalog images. Reviewed assets bypass the legacy runtime
photographic overlays and recoloring. A finish decision is recorded on each
material, with its family and (where applicable) a shared component-role recipe.

| Family                          | Finish logic                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Laboratory benches              | Neutral grey structure, porcelain face accents, satin metal pulls, black satin phenolic worktops                            |
| Sinks                           | Consistent brushed 304-style steel decks/bowls, brighter hardware; institutional enclosure remains painted casework         |
| Cabinets and drawers            | Grey folded structure, consistent enamel fronts and metal hardware; glass retains transparency                              |
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
The full catalog is also checked using same-model front/rear contact sheets.

This work is local. Publishing is a separate, explicit user decision.

## Verification result

- `npm run release:check`: passed lint, TypeScript, asset validation, 298 tests
  in 48 files, and the production build.
- All 208 regenerated authored catalog images passed render validation.
- All 104 final front/isometric and rear views were visually reviewed.
- Live checks covered the revised sinks, chemical cabinet, asymmetric bench,
  locker and mobile drawer; cabinet and drawer access previews were exercised.
- The build still reports the existing large-bundle advisory; it is not a
  failed build and this asset revision does not introduce a new runtime engine.
