# Diversity reference additions — 2 September 2026

Eleven additive, original, logo-free Blender product models based on the user's supplied
visual references. No existing model, material, thumbnail, saved room,
laboratory, inventory, demo, or public starter snapshot is replaced. The visible
authored library grows from 104 to 115 families.

## Reference-to-catalog decisions

| Supplied reference            | Added family                        | Deliberate interpretation                                                                                                                                |
| ----------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-pipette holder          | Laboratory pipette holder           | Passive weighted five-position rack with individually modeled micro, standard, large-volume, electronic and multichannel pipette anatomy; no charging or power hardware |
| Automated plate instrument    | Automated microplate reader         | Larger automated family kept distinct from the existing compact plate reader, with touch interface, motorized carriage, and modeled 96-well plate        |
| Chest laboratory freezer      | Chest ultra-low-temperature freezer | Insulated lid, gasket, latch, controller, equalization port, ventilation, compressor/service back, and leveling hardware                                 |
| High-performance computer set | GPU analysis workstation            | Professional laboratory analysis station with transparent blue-accented compute enclosure, visible abstract internals, peripherals, and cable management |
| White steel pedestal desk     | Steel pedestal office desk          | Institutional powder-coated frame and hygienic top with one functional three-drawer pedestal                                                             |
| Dark wood pedestal desk       | Walnut pedestal office desk         | Sealed-walnut workplace variant with slab sides, modesty return, and functional three-drawer pedestal                                                    |
| Maple/white pedestal desk     | Maple-top steel pedestal desk       | Light maple laminate on white steel, with functional three-drawer pedestal                                                                               |
| Dark four-leg table           | Graphite steel utility table        | Connected square-tube frame, continuous aprons, rear brace, glides, and one clean uninterrupted sealed graphite surface                                  |
| Large multifunction printer   | High-volume multifunction printer   | Formed scanner/ADF, two cassettes, bounded input/output paths, touch interface, service bay, rear connections, and feet                                    |
| Compact office printer        | Compact multifunction printer       | Low, wide scanner/printer family with a formed scanner bridge, bounded output path, cassette, control panel, rear service construction, and feet           |
| Open stainless bath           | Benchtop ultrasonic cleaner         | Formed light stainless enclosure, genuinely recessed basin, rolled rim, controller, drain, rear service, and isolation feet                              |

Brand marks, text labels, copyrighted screen artwork, and manufacturer geometry
are not reproduced. The references establish recognizable silhouette, relative
anatomy, and surface relationships only. Dimensions are representative planning
envelopes, not certified product specifications.

## Authored envelopes and behavior

| Manifest ID                         |     W × D × H, mm | Catalog behavior                                                                 |
| ----------------------------------- | ----------------: | -------------------------------------------------------------------------------- |
| `electronic-pipette-station`        |   345 × 150 × 260 | Bench-connected passive holder; fixed individual pipette geometry, no charging   |
| `automated-microplate-reader`       |   520 × 500 × 330 | Bench-connected instrument with a fixed presentation-state plate carriage        |
| `chest-ultra-low-freezer`           |   900 × 760 × 980 | Freestanding cold-storage equipment; no fabricated capacity or temperature claim |
| `gpu-analysis-workstation`          | 1200 × 600 × 1250 | Integrated analysis desk, display, inputs, compute tower, internals, and cables  |
| `steel-pedestal-desk`               |  1200 × 700 × 740 | Three independently opening, assignable drawer locations                         |
| `wood-pedestal-desk`                |  1200 × 650 × 750 | Three independently opening, assignable drawer locations                         |
| `maple-steel-desk`                  |  1400 × 700 × 740 | Three independently opening, assignable drawer locations                         |
| `black-utility-table`               |  1600 × 800 × 740 | Open fixed table; no fabricated storage                                          |
| `high-volume-multifunction-printer` |   580 × 480 × 380 | All-sided office/laboratory support equipment with two cassette levels           |
| `compact-ink-tank-printer`          |   480 × 420 × 250 | Distinct low-profile printer with bounded output and rear-service construction   |
| `ultrasonic-cleaner`                |   360 × 330 × 330 | Open stainless basin; no process-validation claim                                |

The three pedestal desks add nine geometry-bound drawer locations. Their trays
move along authored runners while the desk frame, pedestal gable, and worktop stay
fixed. User-facing names remain independent of canonical anatomy keys.

## Materials and optimization

Finishes are scoped inside each new GLB. Light coated equipment uses shared fine
micro-roughness; exposed cleaner and instrument surfaces use restrained stainless;
grips and drawer pulls remain matte black; workstation glazing remains transparent
with the approved subtle blue accent. The walnut, maple, steel, and graphite desk
variants intentionally remain visually distinct and do not recolor laboratory
casework elsewhere in the catalog.

All models are authored as orbitable front/back/side/top geometry and use their
own delivered GLB for room, Asset Studio, isometric thumbnail, and top-plan render.
The current eleven-model batch-14 runtime is 2,949,608 bytes after compression.
Across the eleven assets actually reworked in r12—the ten non-sonicator batch-14
models plus the legacy `printer`—delivery size fell from 11,197,112 to 2,908,640
bytes (74.0%) without changing dimensions or storage bindings.

## Reproduction and review

Author with `scripts/blender/lab_diversity_batch14.py`. It accepts repeatable
`--asset <id>` arguments and builds these eleven IDs by default. The full
`assets:build` pipeline includes the batch. Run the existing GLB compression,
catalog finish, render, storage-rig, and asset-validation stages after authoring.
`scripts/blender/inspect_batch14_sources.py` reopens every `.blend` in a clean
Blender session and rejects destructive runtime batches, detached hierarchy,
missing bevel modifiers, wrong bounds, unorganized parts, or missing desk drawer
mechanisms before the delivery pipeline continues. The sequential
`scripts/blender/audit_runtime_coplanar_surfaces.py` gate imports the delivered
GLBs and rejects exposed, same-facing cross-material overlaps that could flicker
or streak while orbiting. Its `--strict` mode additionally reports intentionally
hidden bearing contacts and same-material overlaps for exhaustive diagnosis.

The resulting library contains 117 total definitions: 115 visible authored GLBs
and two hidden procedural wall-drawing primitives. It contains 230 authored
same-model catalog renders plus four procedural wall renders. Review remains local
until the user separately asks to publish or deploy it.

Local verification on 2 September 2026 reopened and inspected all eleven editable
Blender scenes, then ran the fixed-shell audit across the same batch. The delivered
high-volume printer, compact printer, and ultrasonic cleaner also passed the
default orbit-risk coplanar gate with no actionable exposed overlap. These focused
checks do not replace the repository's ordinary type, build, asset, and browser
validation gates before publication.

## Connected-construction revision r2

The release-candidate geometry was rejected after close visual review and rebuilt
locally. Pedestal gables, desk supports, table legs, aprons, printer chassis and
cleaner rims now positively touch or overlap their bearing construction instead
of stopping short and exposing light leaks. Decorative floating identity plaques
were removed; small service details remain only where they are physically attached.
The GPU workstation and utility table retain their reference-led dark low-glare
surfaces, while all hand-contact pulls remain matte black.

Every batch-14 GLB now stores `connected-construction-r2` evidence with the
reviewed fixed-part contact pairs. Authoring fails when any recorded joint is more
than 2 mm apart, before compression or rendering. The same compressed GLB is then
used for Asset Studio, room views, isometric renders and top renders.

## Formed-product revision r3

The locally reviewed realism pass replaces the remaining stacked-box primary
silhouettes with lightweight Blender-authored side-profile shells. The automated
reader now has a swept control shoulder and crowned service housing; both printer
families have formed chassis/scanner transitions and explicit paper-handling
anatomy; the freezer has a tapered insulated cabinet and layered lid construction.
These are original, logo-free meshes derived from the supplied reference
proportions, not imported manufacturer geometry.

Walnut and maple now share one tiny directional normal/roughness pair so sealed
laminate responds to light without a photographic colour overlay. The batch
records `profile-shells-r3` and retains the r2 fixed-contact gate, stable planning
envelopes, storage bindings, same-GLB catalog renders, and matte-black hand grips.

## Blender product source r7 and runtime product revision r12

The pipette family keeps its compatibility ID but is now correctly presented as a
passive laboratory pipette holder. Its weighted base, formed upright, brace,
elastomer saddles and stabilizer pads support distinct manual micro-volume,
standard manual, large-volume manual, electronic and multichannel pipettes. No
charger dock, indicator, electrical rail, inlet, cable channel or power lead
remains.

All authored desk and table work surfaces were audited together. Generic cable
grommet circles, datum squares, decorative service labels, rear marker plates and
unnecessary top overlays were removed from the pedestal desks, utility table and
GPU workstation. The older office desk, rectangular table, computer lab bench and
center island worktop receive the same clean-surface correction. Real frame rails,
modesty construction, storage, feet, pulls and required cable routes remain.

Equipment detail follows the autoclave construction standard: the reader gains a
real sample shutter, drive roller and tray detents; the chest freezer gains
articulated lid supports; and both printers gain formed input/output paths,
feed/output rollers, cassette runners, scanner hinges, actual rear sockets and
service fasteners. No loose paper sheets are added merely to make the printers
look busy. These are small shared-material parts with no large textures or
subdivision surfaces.

Each of the eleven families now has an editable source scene at
`assets/blender/batch14/<asset-id>.blend`. These scenes are saved before runtime
batching, so named manufacturing parts, parent relationships, per-part material
roles, real recess/seam geometry, and unapplied manufactured-edge bevel modifiers
remain editable. Product parts are grouped into role-based Blender collections,
and the fitted source stays in metres at the same canonical envelope used by the
application.

The delivered GLB is generated only after the source scene is saved. Blender then
bakes the reviewed edge modifiers and joins static geometry by material for a
bounded runtime mesh count; the later catalog-polish pass attaches the shared tiny
normal/roughness maps. The `.blend` is therefore the local authoring and rollback
source, while the GLB remains the optimized delivery artifact. Both preserve the
existing asset IDs, authored dimensions, and storage mechanism bindings.

Runtime revision `diversity-batch14-r12` keeps the editable source revision
`batch14-product-source-r7` while recording `reference-product-model-r12` and
`formed-connected-construction-r7` in each delivered root. The ultrasonic cleaner
is the present quality benchmark: one continuous formed enclosure, nested basin
and rolled-rim returns, a mechanically connected formed lid, a genuinely recessed
controller, and credible drain, handle, rear-service and isolation-foot anatomy.
The printer refresh follows the same procedure with continuous molded shells,
bounded paper cavities, real returns, and stepped controller/cassette/service
depths instead of decorative coplanar plaques.

The r12 work remains local and reversible pending explicit approval to publish.
The editable `.blend` files are the canonical rollback sources; an additional
pre-r12 delivery snapshot is retained at
`artifacts/rollback/reference-rework-pre-r12-2026-09-02/`.

The approved sonicator was hash-locked and not rebuilt in r12. The ten remaining
batch-14 references and the distinct legacy catalog `printer` were staged,
source-audited and compressed independently. Their exposed cross-material
coplanar surfaces were re-authored as nested manufactured joins: inset worktop
cores and edge bands, captured printer recess/bezel depth cascades, reader side
skins, a proud freezer lid insert, and capped computer-tower panels. All eleven
rework targets pass the post-compression orbit-risk gate; all ten modified
batch-14 `.blend` files pass source-shell, real-joint, bounds, root-scale,
opacity and PBR-link validation.
