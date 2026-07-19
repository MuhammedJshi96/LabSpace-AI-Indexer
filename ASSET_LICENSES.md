# Asset licences and provenance

## Licensing boundary

The application source code is available under the Apache License 2.0 in
`LICENSE`. The 3D models, textures, renders, thumbnails, photographs, reference
images, videos, promotional media, and LabSpace brand artwork are excluded from
that software licence and remain All Rights Reserved unless a file contains a
different explicit licence. See `LICENSE-ASSETS.md` and `NOTICE` for the
governing terms.

Public releases must not include user-supplied laboratory photographs,
manufacturer-originated images, or files in `references/` unless the repository
owner has confirmed the necessary redistribution rights.

## LabSpace procedural and authored assets

The asset manifests, 2D footprints, generated renders, Blender-authored GLBs,
and Three.js procedural representations were created specifically for LabSpace
AI Indexer. Some catalog entries remain procedural planning representations;
this document does not claim that every asset is photoreal or Blender-authored.

The authored hero files are:

- `lab-bench.glb` and `center-island-bench.glb`;
- `rotary-evaporator.glb`;
- `ultra-low-freezer.glb` and `autoclave.glb`;
- `fume-hood.glb` and `biosafety-cabinet.glb`;
- `benchtop-centrifuge.glb` and `compound-microscope.glb`;
- `slotted-angle-storage-rack.glb` and `wire-basket-trolley.glb`.
- `vacuum-pump.glb`, `forced-air-lab-oven.glb`,
  `multi-position-heating-bath.glb`, and `vacuum-cold-trap-system.glb`.

They are exported as self-contained, non-Draco GLBs for an offline runtime. No
commercial CAD/BIM mesh or manufacturer model was downloaded or redistributed.
Default sizes are editable planning estimates, not certified dimensions.

## Visual and anatomy references

The photographs supplied by the user of Kyushu University Room 809 are the
primary visual source for equipment silhouettes, casework, finishes, wear,
cabling, and laboratory context. Official manufacturer pages and manuals listed
in `docs/ASSET_REFERENCE_CATALOG.md` were consulted only to understand
conventional equipment anatomy, controls, vents, clearances, service points, and
hidden-side construction.

Manufacturer meshes, dimension drawings, brand marks, proprietary labels,
catalog textures, photographs, and copied product geometry are not bundled in
the models. The authored files are original planning interpretations rather than
digital replicas certified by those manufacturers.

## Room 809 material sources

The powder-coat, brushed-steel, and black-phenolic material tiles are original
textures generated for this prototype from the visual characteristics of the
supplied Room 809 photographs. `epoxy-floor-room809.jpg` is a small transformed
material crop from a user-supplied laboratory photograph for this private
prototype. The source laboratory photographs are not bundled in the web
application.

The authored plan and library PNGs are rendered from the original GLB material
definitions. In the live room and Asset Studio, matching phenolic, steel, and
powder-coat material names receive the local Room 809 texture enhancement. No
online texture service is required at runtime.

## Blender authoring tool

Blender 4.5.11 LTS is stored project-locally under `.tools/` for deterministic
asset authoring only. Blender is free software under the GNU GPL. The authoring
tool is not required by or included in the production web application bundle.

## Application mark

`public/labspace-mark.svg` is original temporary geometric artwork created for
this prototype at the user's request.

The README submission banner at
`docs/submission/labspace-ai-indexer-thumbnail-3x2-source-v1.png` was supplied
by the project owner for this competition entry. It remains protected
promotional artwork under `LICENSE-ASSETS.md` and is not included in the Apache
2.0 software grant.

Finalized Layout Editor, Spatial Index Finder, exact-location evidence, and
Asset Studio screenshots are original captures of the LabSpace application.
They remain protected submission media rather than reusable UI or catalog
assets.

## Interface icons

Phosphor Icons are used through `@phosphor-icons/react` under the MIT Licence.
See the installed package metadata for its complete licence text.

## Runtime libraries

React, Three.js, React Three Fiber, Drei, React Konva/Konva, Zustand, Zod,
QRCode, Express, Vite, Vitest, Playwright, ESLint, and related packages are used
under their respective open-source licences. `package-lock.json` records exact
packages and versions.

No downloaded third-party 3D models, catalog textures, online fonts, paid APIs,
live model output, or proprietary asset catalogs are included. The possible
future LabSpace AI API described in product documentation is not part of the
current runtime or asset bundle.
