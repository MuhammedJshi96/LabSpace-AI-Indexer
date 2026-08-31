# Local rendering comparison — 2026-08-31

## Release boundary

Published baseline: `db4b8bb8aa0894ec5df0e0745aa9b01d556078cd` on
[the existing Render site](https://labspace-agent-twin.onrender.com/).
The catalog/lighting update is `68f24f5`; `db4b8bb` only makes the all-texel
roughness regression test faster on clean CI. Render reported the revision live;
six representative public GLB, thumbnail, microtexture and HDR files matched
their local SHA-256 hashes. GitHub's release checks and WebMCP browser suite passed.
No showcase snapshot, SQLite, IndexedDB schema, room or laboratory data was replaced.

The quality experiment lives on **`codex/local-render-quality`**, locally only.
Checkpoint: **`local-before-render-quality-2026-08-31`**. Do not push or deploy this
branch until the user approves the comparison.

## Controls and safety

The editor's 3D toolbar, Spatial Index command bar, Facility header and Asset
Studio preview share one native **Quality** selector and an accessible reset button.
Choose **Restore Balanced rendering** to return to the published lighting recipe
and original opaque finish detail. The clear-glass correction remains in every tier.
The canvas, camera, selected object, open storage and loaded GLBs are not remounted
when changing the tier. Only the shadow-casting light is recreated, releasing its
old shadow buffers so map resolution changes actually take effect.

Preferences use the separate browser key `labspace-render-settings-v1`. They are
not project data, do not create undo steps, and do not trigger room saves. Invalid
or future preference versions default to Balanced. When browser storage is
blocked, switching still works and the control displays “This visit only”.

| Tier     | Resolution cap        | Key shadow                                                     | Appearance / cost                                                                                                                    |
| -------- | --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Low      | 1× device-pixel ratio | 512 px PCF                                                     | No contact-shadow capture passes; all geometry, materials and stock remain present.                                                  |
| Balanced | 1.5× (Facility 1.45×) | Published 2048 px room / 1024 px studio / 1536 px facility PCF | Published lighting strengths and shadow recipe. Default and rollback target.                                                         |
| High     | 2×                    | 2048 px variance shadow map, 8 blur samples                    | Softer shadows, controlled fill, color-preserving tonality, fine coating grain and directional brushed-metal detail. Extra GPU cost. |

High keeps authored colors and geometry, while applying reference-counted material
variants with four shared pairs of 256 px normal/roughness maps (coating, brushed
metal, phenolic and polymer). All eight maps together use less than 3 MiB including
mipmaps. Only exposed metal receives directional brushed grain; laminate/paint remains
dielectric and grips remain matte black. No catalog GLBs or thumbnail files have
been regenerated or recolored. It adds no downloads,
ray tracing, screen-space AO, per-object reflection probes or polygon subdivisions.
Contact-shadow buffer sizes stay fixed across tiers to avoid reallocating those
buffers on each change. Low suppresses their capture passes, rather than hiding
objects. Facility now renders on demand as the room and Asset Studio already did.

High uses Khronos PBR Neutral tone mapping and lower fill lighting to retain hue
and midtone contrast instead of repainting pale objects. Low/Balanced retain the
published ACES pipeline and exposure. Tone mapping adds no render target or extra
draw pass; see the [Khronos PBR Neutral specification](https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral).
An experimental anisotropy lobe was rejected in visual QA because these batched
assets lack authored tangent frames and it produced blown-out steel surfaces.
Directional normal/roughness detail provides a stable, cheaper substitute.

The settings follow the installed Three.js shadow implementation. See the
[official shadow controls](https://threejs.org/docs/pages/LightShadow.html) for
the cost of map resolution and variance-shadow blur samples. High is intentionally
opt-in; identical frame rate on all GPUs is not claimed.

## Clear glazing correction

The catalog's laminate rule accidentally matched “Laminated laboratory safety
glass”, raising 17 architectural assets' pane roughness to 0.4. A separate issue
let clear panes cast solid shadows. The local runtime now distinguishes clear
glazing from coated furniture and excludes it from both opaque-shadow flags.
The generator rule is guarded against the same regression on a future rebuild.

Thin window/cabinet panes retain the user's subtle blue accent with single-pass
alpha transparency, keeping shelves,
other panes and editor grids crisp through the glass. Glassware keeps physical
transmission with full alpha; frosted shelves, ground joints, smoked displays and
amber bottles retain their authored finishes. Neither path gets coating grain.
See Three.js' [physical material documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html)
and [transparency limitations](https://threejs.org/manual/en/transparency.html).

This is a rendering correction in every tier, not a data migration. Cached GLTF
source materials remain unchanged; only per-instance mesh material bindings are
switched, and variants are released when no instance needs them.

Catalog thumbnails and 2D image files remain the published renders in this local
comparison; they have not been batch-regenerated with the experimental lighting.

## Local verification

- Final material/color pass: **365 tests across 52 files**, lint, TypeScript,
  asset validation and production build passed. Build retains its existing
  large-chunk advisory; this is not a claim of zero GPU or bundle cost.
- Visually checked transparent blue cabinet panes and three-pane windows,
  stainless wash station and dark phenolic/greige bench in the real browser.
  Cabinet sliding panels remained open across High → Balanced, with the exact
  camera transform preserved. Tone-map diagnostics changed Neutral (7) → ACES (4).
- After warm-up, repeated cabinet quality cycles returned to 144 geometries and
  48 textures at both High checkpoints. The shared texture budget did not grow
  per switch. Resource counts include previously loaded previews in that session.

- 356 unit tests passed for the initial quality checkpoint, including tier budgets, legacy/invalid preference input,
  persistence, storage failures and one-click restoration; lint, TypeScript,
  asset validation and production build passed.
- Browser checked Low / Balanced / High and reload persistence in Asset Studio;
  observed shader modes PCF / VSM match the requested tier.
- A full High → Balanced → Low → High cycle retained the exact Asset Studio
  camera position and orientation, 63 geometries and 19 textures at both High
  checkpoints. High added three draw calls in this sampled preview, not
  additional asset geometry.
- A drawer opened in High remained open when restored to Balanced.
- Editor Balanced → High retained the camera transform. The renderer still
  displayed every room object.
- The five-room/four-floor Facility view settled at 10 rendered frames and stayed
  at 10 in a later idle inspection, confirming that demand rendering stops.
- Development-only DOM counters expose rendered frames, resource counts and
  camera transforms for inspection without continuous rendering or GPU readback.
  These are diagnostic observations, not a cross-device FPS benchmark.

## Reversal

For a visual reversal, use the reset button; no reload or data restore is needed.
It restores base lighting/opaque finishes while retaining clear glazing. The
intermediate local commit `c6833a1` contains quality controls without material
variants. The tagged published baseline contains neither local experiment.
For a complete code reversal, with a clean working tree switch back to
`webmcp-challenge-2026` (the published baseline). The local experiment remains
preserved on its own branch. Never reset or import project data to reverse a
rendering change.
