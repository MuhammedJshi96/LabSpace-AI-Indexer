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
Choose **Restore Balanced rendering** to return to the published lighting recipe.
The canvas, camera, selected object, open storage and loaded GLBs are not remounted
when changing the tier. Only the shadow-casting light is recreated, releasing its
old shadow buffers so map resolution changes actually take effect.

Preferences use the separate browser key `labspace-render-settings-v1`. They are
not project data, do not create undo steps, and do not trigger room saves. Invalid
or future preference versions default to Balanced. When browser storage is
blocked, switching still works and the control displays “This visit only”.

| Tier | Resolution cap | Key shadow | Appearance / cost |
| --- | --- | --- | --- |
| Low | 1× device-pixel ratio | 512 px PCF | No contact-shadow capture passes; all geometry, materials and stock remain present. |
| Balanced | 1.5× (Facility 1.45×) | Published 2048 px room / 1024 px studio / 1536 px facility PCF | Published lighting strengths and shadow recipe. Default and rollback target. |
| High | 2× | 2048 px variance shadow map, 8 blur samples | Softer shadows, restrained shadow density and a small shift from direct light toward the existing studio environment. Extra GPU cost. |

High keeps the same colors, shaders, normal/roughness maps and authored geometry;
it is a lighting comparison, not a new catalog recolor. It adds no downloads,
ray tracing, screen-space AO, per-object reflection probes or polygon subdivisions.
Contact-shadow buffer sizes stay fixed across tiers to avoid reallocating those
buffers on each change. Low suppresses their capture passes, rather than hiding
objects. Facility now renders on demand as the room and Asset Studio already did.

The settings follow the installed Three.js shadow implementation. See the
[official shadow controls](https://threejs.org/docs/pages/LightShadow.html) for
the cost of map resolution and variance-shadow blur samples. High is intentionally
opt-in; identical frame rate on all GPUs is not claimed.

## Local verification

- 356 unit tests passed, including tier budgets, legacy/invalid preference input,
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
For a complete code reversal, with a clean working tree switch back to
`webmcp-challenge-2026` (the published baseline). The local experiment remains
preserved on its own branch. Never reset or import project data to reverse a
rendering change.
