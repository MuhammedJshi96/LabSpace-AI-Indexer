# July reference additions — 31 August 2026

Ten additive, original, logo-free planning models. No existing model, material,
thumbnail, saved room, laboratory, inventory, demo or starter snapshot is replaced.
The visible authored library grows from 94 to 104 families.

## Reference-to-catalog audit

| Supplied reference                   | Existing coverage                                                         | Added missing family                                                         |
| ------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Single-door sheet, `11_54_29 AM (1)` | Solid utility door, narrow-lite service door, glazed door                 | Wider-lite single door; single door with fixed transom                       |
| Double-door sheet, `11_54_29 AM (2)` | Double vision-lite door and double slider                                 | Double transom door; double push-bar door                                    |
| Window sheet, `11_54_29 AM (3)`      | Fixed, two-pane, three-pane, sliding and pass-through glazing             | Integral-blind observation window; high-level clerestory                     |
| Analytical sheet, `01_39_26 AM (6)`  | Centrifuges, ovens, plate reader, spectrophotometer, computer workstation | Computer bench with right drawer pedestal; under-bench recirculating chiller |
| `Lab Bench Shimadzu ref 3.jpg`       | Existing standard bench has a different symmetric layout                  | Asymmetric five-drawer / two-door bench                                      |
| `images.jpg`                         | Existing sink families have different bowls/worktops/fronts               | White institutional stainless-trough cabinet                                 |

Different camera angles and partially open doors are not new catalog families.
The mixed-instrument workstation is an arrangement of separately placeable assets,
not a new fused instrument. The unspecified analytical box is covered by named
instrument families rather than claiming a new, unidentified scientific device.

## Authored envelopes and behavior

| Manifest ID                  | W × D × H, mm     | Specific construction / behavior                                                                    |
| ---------------------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `wide-lite-door`             | 950 × 160 × 2150  | Real aperture and wide vision glass; two-sided hardware                                             |
| `single-transom-door`        | 1000 × 160 × 2650 | Narrow-lite leaf, fixed upper glass and cross rail                                                  |
| `double-transom-door`        | 1800 × 160 × 2650 | Paired leaves; transom included in the single wall cut                                              |
| `double-egress-door`         | 1800 × 180 × 2150 | Paired push bars, closers and kick plates; no compliance claim                                      |
| `integral-blind-window`      | 1800 × 160 × 1200 | Modeled slats, cords, cassette and bottom rail; fixed partially raised state                        |
| `clerestory-window`          | 1800 × 140 × 500  | Default sill 2200 mm; editable width/elevation                                                      |
| `asymmetric-lab-bench`       | 1800 × 750 × 900  | Five moving drawer trays, two hinged doors, two physical shelves                                    |
| `institutional-sink-cabinet` | 1500 × 700 × 1200 | Hollow trough, taps, drain/trap, three doors, two left storage shelves; 900 mm rim                  |
| `computer-lab-bench`         | 1600 × 750 × 1350 | Three drawer trays; left knee space, 800 mm worktop, modeled computer peripherals                   |
| `recirculating-chiller`      | 400 × 550 × 650   | Front intake, side vents, filler, controller, level indicator, rear hose/power connections, casters |

Dimensions are deliberately representative, not manufacturer-certified replicas.
Door handing and inward/outward plan swings use the existing hosted-opening
contract. Architectural leaves retain the existing closed 3D presentation; these
additions do not claim an interactive architectural-door animation. Furniture
access previews move the actual authored drawer assemblies and cabinet leaves.
Only the new computer bench gains offset chair snapping; its pedestal is not
treated as open knee space. The fixed blind state is explicitly described in UI.

## Source packet and materials

The six user-supplied images establish silhouette, composition and surface choices.
No image, branded geometry or downloaded manufacturer mesh is embedded in an asset.
Primary-source construction checks:

- [Shimadzu Rika TW1-A sink](https://www.shimadzu-rika.co.jp/products/laboratory/sink/tw1-a.html): SUS304 trough, stainless trap and 220 mm bowl depth; 1500 mm width is an offered size. Our 900 mm rim, 700 mm depth, taps and steel casework remain original reference-led choices, not TW1-A specifications.
- [Shimadzu Rika laboratory furniture](https://www.shimadzu-rika.co.jp/products/laboratory/index.html): modular steel, desk and instrument furniture families. The supplied bench photo, not a generic drawer template, determines the asymmetric front layout.
- [Steelcraft technical data](https://www.steelcraft.com/content/dam/steelcraft/documents/Steelcraft_Tech_Data_Manual_105001.pdf): continuous transom frames and fixed horizontal bars. No fire rating, emergency-egress approval or compliance is represented by these models.
- [Dortek privacy vision panels](https://dortek.com/product-showcase-privacy-vision-panels/): flush glazing/bead construction as a hygiene cue; the supplied window sheet determines the original Venetian-blind arrangement.
- [JULABO FL300](https://julabo.us/product/fl300/): reservoir, controller, level indication, removable condenser grille and hose connections. Its published envelope is approximately 250 × 500 × 600 mm and it has no side vents; our broader 400 × 550 × 650 mm model with side vents follows the supplied sheet and is **not** an FL300 replica. No operating temperature/capacity is fabricated.

New finishes are scoped inside the new GLBs: light powder coat, satin aluminium,
brushed stainless, pale glazing, and restrained dark hardware/screens. Black
phenolic is used only on bench worktops. Existing shared runtime lighting and
material enhancement are unchanged.

## Reproduction and review

Author with `scripts/blender/lab_reference_batch13.py`. It accepts repeatable
`--asset <id>` arguments and builds only these ten IDs by default. Then run
`compress_hero_glbs.py` and `render_hero_catalog.py` with the same explicit IDs,
and `node scripts/build-storage-rigs.mjs` to derive geometry-bound storage.
The full `assets:build` pipeline also includes this batch for reproducibility.

Catalog renders are generated from the delivered GLB, in both isometric and top
views, using the unchanged studio and contain-framing rules. Tests cover authored
dimensions, storage part bindings/counts, wall hosting, clerestory sill and
mirrored/rotated pedestal-aware chair snapping. Review in Asset Studio → Full
catalog; search `transom`, `asymmetric`, `trough`, `computer laboratory`, `blinds`
or `chiller`. Nothing is deployed by this local asset-authoring task.

Verification completed on 31 August 2026: `npm run release:check` passed lint,
TypeScript, all 276 unit tests (47 files), asset validation and the production
build. All 208 authored catalog renders passed framing checks. Live Asset Studio
review covered all ten new models plus real drawer/cabinet access previews;
that review caught and corrected the sink bowl obstruction and its new stainless
finish before handoff. The existing 28 storage rigs and all previously shipped
GLBs/renders remain unchanged. No new end-to-end browser test suite was run.
