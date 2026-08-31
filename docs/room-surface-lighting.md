# Room surface and lighting correction

Local review, 2026-08-31. No room/project migration or deployment is part of this change.

## What caused the reported glare

`RoomFloor3D` supplied a `RedFormat` data texture as a roughness map. Three.js samples the **green** channel for roughness. The missing green channel made the physical floor effectively mirror-smooth; the studio environment and lights then appeared as blown-out patches. Multiplying roughness by a mid-grey map would still have made the finish much glossier than its declared value.

The old photographic floor crop also contained shading and edge marks, and repeated four times per metre for epoxy. This produced conspicuous bands rather than a seamless resin finish. Wall panels similarly multiplied the chosen paint color by a photographic powder-coat map.

## Changes

- Original, illumination-free, tileable albedo, normal and roughness maps replace the room-surface photographs. The photographs remain available for legacy asset fallbacks and provenance; authored furniture materials are unchanged.
- Nine shared surface profiles cover resin/vinyl, concrete, stone, terrazzo, oak, coated panels, plaster, ceramic tile and exposed stainless. Existing finish IDs, colors and per-wall overrides remain intact.
- Roughness is explicitly packed into RGBA green, within 242–255. Floors retain satin/honed response, restrained clearcoat and nonmetallic shading. Only the actual stainless wall lining uses conductive shading.
- Wall UVs are in metres, including headers, sills and jambs. Fine mesh-like coating detail comes from normals, not extra polygons. Facility room walls now use the same selected finishes as the editor and Spatial Index.
- A predominantly overhead key and diffuse fill replace the harsher, low-angle stacked room rig. The shadow camera fits the room. Contact shadows are limited to the lowest 700 mm and start after room models are ready, so whole cabinets do not become broad floor stains.
- Hidden optional ceiling-service fixtures no longer contribute invisible additional lights. The standard room light rig remains available regardless of that setting.

## Performance and checks

- 128 × 128 maps, generated lazily once per surface family; no new texture downloads.
- All nine profiles together use 2.25 MiB of texture texels including mip chains, excluding driver overhead. Most rooms need only two families. Maps and finish materials are shared across rooms and transparent wall variants.
- No extra wall/floor subdivisions; a wall piece remains 12 triangles. Geometries are disposed when replaced/unmounted; cached maps/materials remain reusable.
- One shadow-casting room light, two bounded contact-shadow frames, existing demand rendering. No SSAO/postprocessing or continuously captured environment maps were added.
- Regression tests cover the green-channel failure, roughness bounds, texture reuse/budget, unchanged finish colors, transparent/solid material isolation, physical UV scale and shadow coverage for larger rooms.
- Local release check passed: lint, typecheck, 351 tests in 50 files, asset/render validation and production build. The existing large-chunk build warning remains. Visually checked the office in the editor and Spatial Index, plus the multi-floor facility. No post-reload runtime error was observed; the transient React dependency-array warning occurred only while editing the live module.
- A local cold-generation check created all nine profiles in approximately 105 ms once; subsequent calls reuse them. This is a CPU/map budget check, not a before/after browser frame-rate benchmark.

These are optimized real-time planning materials, not a ray-traced lighting simulation or a manufacturer finish specification.
