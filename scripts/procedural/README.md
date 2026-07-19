# Procedural catalog renders

LabSpace keeps static Asset Library and 2D plan images for every catalog asset.
The 62 authored hero assets retain their Blender/GLB renders under
`public/models/hero/renders`. The other 34 assets are captured directly from
`ProceduralAssetModel`, so their library portrait, plan image, and orbitable 3D
fallback share the same geometry and reusable laboratory material treatment. The bundled texture
photographs retain Room 809 provenance in the material registry.

Rebuild all 68 procedural images from the repository root:

```powershell
npm run assets:render-procedural
```

The command starts a temporary Vite capture server on dedicated port 4178,
uses four isolated headless-browser workers, waits for material textures and a
settled WebGL frame, then writes transparent RGBA PNGs to
`public/models/procedural/renders`:

- `<asset-id>-isometric.png` at 384×256 for Asset Library cards.
- `<asset-id>-top.png` at 384×384 for the 2D plan.

For a focused rebuild while developing one model:

```powershell
npm run assets:render-procedural -- --asset=spectrophotometer
npm run assets:render-procedural -- --asset=spectrophotometer --view=top
```

Optional `--port=<number>` and `--workers=<1..6>` switches are available for
isolated CI or local work. `npm run validate:assets` verifies that all authored
and procedural renders exist, retain their required dimensions, and contain an
RGBA channel.

These captures make the UI consistent with the live procedural models; they do
not upgrade procedural geometry to the photoreal, manufacturer-informed quality
target represented by `references/ref1.png` and `references/ref2.png`.
