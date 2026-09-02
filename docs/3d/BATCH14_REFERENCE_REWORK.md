# Batch 14 Reference Rework Specification

## Scope

This is the asset specification for the September 2 reference-led rebuild. The approved `ultrasonic-cleaner` is the locked construction and material benchmark and is excluded from geometry changes. The ten other diversity-pack assets plus the older catalog `printer` form the eleven-target rework set.

All dimensions below are canonical planning envelopes in millimetres. They are not manufacturer-certified. Preserve existing asset IDs, storage bindings, authored fronts, room placement behavior, and floor anchors.

## Reference packet

- `codex-clipboard-ee6eb581-ffe8-4e69-8ad9-d9f8edf80fdb.jpg` — passive multi-pipette holder.
- `codex-clipboard-f6623797-c3c0-4876-a1b3-17c960c94522.jpg` and `ChatGPT Image Sep 2, 2026, 12_01_07 PM (1).png` — automated microplate reader.
- `codex-clipboard-c1a6847f-c24a-4901-8ed4-d9f8a3d7a1d1.jpg` — chest ULT freezer.
- `codex-clipboard-9c980a55-638e-4aff-bfb3-d1c42c1f631e.webp` and `ChatGPT Image Sep 2, 2026, 12_01_09 PM (5).png` — GPU workstation.
- `codex-clipboard-99ef81a7-be3d-4062-8a33-901cc780cd11.webp`, `codex-clipboard-c7bd0ac4-3dee-43ff-82df-c02039cffcad.webp`, and `codex-clipboard-b844871a-1a52-48cf-b8eb-ea5c4b182548.webp` — pedestal desks.
- `codex-clipboard-e8d05070-88f4-421b-9a50-c16c51a2a479.webp` — four-leg utility table.
- `codex-clipboard-9bd1c737-2ba5-4e73-86eb-9a0a11bdceae.jpg`, `codex-clipboard-babdda80-79b2-49a3-98e2-5d276a2e7f6b.jpg`, and `ChatGPT Image Sep 2, 2026, 12_01_08 PM (3).png` — printer families.
- `ChatGPT Image Sep 2, 2026, 12_01_07 PM (2).png` — multi-view pipette holder proportions and subtype differentiation.
- `ChatGPT Image Sep 2, 2026, 12_01_08 PM (4).png` — approved sonicator benchmark only.

The supplied images define silhouette, relative anatomy, and visible finish. Hidden sides use conservative original construction. No manufacturer logo, proprietary screen artwork, or third-party geometry is reproduced.

## Asset specifications

| Asset | Class | Envelope | Required assemblies and visible correction | Articulation / spatial behavior | Materials | Reference confidence |
| --- | --- | ---: | --- | --- | --- | --- |
| `electronic-pipette-station` | B | 345 × 150 × 260 | Weighted A-frame with shaped feet, connected lower tray, continuous hanger beam and individual cradles; five visibly different pipettes with formed grips, plungers, volume windows, finger rests, nose cones and a true eight-channel manifold. No charger anatomy. | Fixed bench asset; simple footprint proxy. | Warm laboratory polymer, graphite elastomer grips, colored controls, stainless/aluminium nose hardware, opaque PP tips. | Dimensions high from supplied sheet; subtype detail medium; rear high. |
| `automated-microplate-reader` | B | 520 × 500 × 330 | Lower dark service plinth, softly formed upper enclosure, sloped integrated fascia, nested display, real sample aperture, rails/rollers, extended tray and 96-well plate; side service cheeks, ventilation and complete rear I/O. | Tray remains independently addressable presentation geometry; front loading zone retained. | Fine warm-white coating, cool-grey base, restrained blue control accents, smoked display, black cavity, opaque microplate polymer. | Envelope medium; front/top high from multi-view sheet; rear medium. |
| `chest-ultra-low-freezer` | C | 900 × 760 × 980 | Broad insulated cabinet, thin manufactured shadow seams, thick formed lid, captured gasket, continuous grey perimeter trim, integrated central controller/latch bridge, pressure equalization port, rear hinges/supports, subtle lower condenser and compressor service construction. | Lid remains separately named with hinge-axis metadata; conservative open-lid clearance can be added without using render triangles. | Warm white enamel, cool-grey trim, dark elastomer gasket/feet, restrained exposed metal, smoked controller. | Front silhouette high; envelope medium; side/rear medium-low. |
| `gpu-analysis-workstation` | B/D | 1200 × 600 × 1250 | 25 mm wood top on connected 25 mm black square-tube frame; modesty panel, under-top power rail, supported tower shelf, detailed closed PC enclosure with one physically clear side panel, internal fans/boards/cooler, proper monitor bezel/stand, keyboard, mouse and supported cable routes. | Fixed workstation footprint; selectable as one asset; no invented desk storage. | Sealed light wood, black powder coat, graphite electronics, clear subtly blue tempered side glass, restrained emissive accents. | Dimensions high from supplied sheet; workstation anatomy high; PC internals medium. |
| `steel-pedestal-desk` | C | 1200 × 700 × 740 | Institutional steel C-leg, 25–50 mm hygienic top, under-top bearer, rear modesty panel and continuous three-drawer pedestal carcass; recessed pulls and lock; no floating or decorative top geometry. | Three canonical drawers retain 8 mm movement reveals, runners and independent storage bindings. | Light neutral powder coat, subtly contrasting edge/inner carcass, matte-black polymer pulls, rubber feet. | Front/side medium-high; rear medium-low. |
| `wood-pedestal-desk` | C | 1200 × 650 × 750 | Reference-led dark sealed-wood slab sides, modesty panel, connected pedestal roof/sides/back, three proportional drawers and believable underside joinery; clean top. | Three canonical drawers remain independent. | Sealed dark wood/laminate with directional microdetail, matte-black pulls, dark recessed toe return. | Front high; rear/underside medium-low. |
| `maple-steel-desk` | C | 1400 × 700 × 740 | Light maple top with thin edge band, white steel C-leg and connected three-drawer pedestal, rear modesty panel, under-top bearer and glides; clean top. | Three canonical drawers remain independent. | Maple laminate, light powder coat, matte-black pulls, rubber feet. | Front high; rear medium-low. |
| `black-utility-table` | A | 1600 × 800 × 740 | Plain continuous graphite top, slim square-tube legs and aprons with positive bearing joints and adjustable glides. Remove unexplained circles, plaques, service fields and excess gusset clutter. | Fixed simple footprint; no fabricated storage or service points. | Low-glare graphite sealed top, satin black powder-coated frame, rubber feet. | Silhouette high; dimensions medium. |
| `high-volume-multifunction-printer` | B | 580 × 480 × 380 | Asymmetric formed body, genuine scanner/ADF layering, front control pod, bounded output cavity, two cassettes with real runners/pulls, right ink/service bay, side seam transitions, rear paper/service path, vents, sockets and feet. Avoid stacked rectangular cakes and coplanar decals. | Scanner hinges and cassettes remain named; no storage inventory binding implied. | Warm-white molded polymer, cool-grey fascia/base, graphite cavities, smoked display, small cyan/magenta/yellow/black level indicators. | Front high; top medium-high; rear medium. |
| `compact-ink-tank-printer` | B | 480 × 420 × 250 | Low wide formed scanner shell, continuous dark control bridge, bounded output throat, single cassette, right service/ink window, side vent and rear duplex/I/O construction. Avoid duplicate shells and loose paper geometry. | Scanner hinge and cassette remain named. | Warm-white polymer, charcoal fascia/cavity, cool-grey base, smoked display, restrained ink indicators. | Front high; top/side medium-high; rear medium. |
| `printer` | B | 500 × 500 × 350 | Replace the older generic box with a distinct compact office MFP: formed scanner lid/body, separated front fascia, nested screen/key panel, bounded output cavity/tray, cassette, side seams/vent and rear hatch/I/O. It must not duplicate either batch-14 printer. | Named scanner hinge/cassette parts; fixed runtime state. | Warm-white polymer, cool-grey fascia/base, graphite cavity, smoked screen, rubber feet. | Based on the supplied printer family; exact product identity intentionally generic, confidence medium. |

## Shared acceptance gates

- One intended current asset per GLB; never render a procedural or old GLB copy underneath it.
- Source scene retains named manufactured parts, hierarchy, local pivots, material roles, and unapplied bevel modifiers where practical.
- Fixed assemblies touch or overlap within the authored continuity tolerance; deliberate drawer/tray reveals remain open.
- No exposed coplanar cross-material overlays, transparent non-glass plastics, unexplained black circles, decorative service rectangles, or loose paper sheets.
- Front, rear, both sides, top, and close oblique views must be believable under the same neutral product lighting as the sonicator.
- Preserve canonical millimetre dimensions, floor anchor, authored front, storage IDs, and room compatibility.
- Rebuild and inspect only the named targets, then run source, shell, coplanar, catalog, schema, and browser orbit checks before release.

## Rollback

The pre-rework delivery snapshot is stored under `artifacts/rollback/reference-rework-pre-r12-2026-09-02/`. The approved sonicator remains at its existing source and runtime revision throughout this pass.
