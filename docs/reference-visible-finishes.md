# Visible finish correction — 2026-08-31

The user rejected a catalog-wide silver/metal appearance. Construction material
and visible finish are different facts. A painted steel door must render as paint,
not as a conductor. A polymer grip with a steel core is still visibly polymer.

The later supplied `codex-clipboard-504bf1fe-b933-431a-8175-ce0e2a20fcea.jpg`
supersedes the initial ivory palette for matching bench casework: soft grey
faces, cool charcoal/plum phenolic, and dark recessed bases.
Colors are a visual interpretation, not measured manufacturer color values.
This does not copy the photographed knee-space geometry onto storage benches.
The selected panel color is linear RGB `(0.43, 0.415, 0.435)`; the later
black-handle choice uses `(0.008, 0.009, 0.011)`. Both are nonmetallic. The descriptions below refer to
material anatomy; the supplied photograph governs the updated bench colors.

## Evidence and selected planning-model finishes

**Latest user override:** all handles are matte black for visual distinction.
This supersedes ivory/grey pull and anthracite lever suggestions below. The
part-level pass covers cabinet/drawer pulls, door levers, carrying/lifting grips,
sash handles and faucet levers, without recoloring adjacent panels, bowls,
glazing, mounting bolts or supporting shafts. Every generated asset records its
reviewed handle-part names; empty lists are explicit for handle-free assets.

**White-panel texture:** the user subsequently requested the earlier mesh-like
surface detail again. Light neutral coated panels now use a shared 128 px
micrograin normal/roughness pair (25,952 bytes), with no albedo overlay,
transparency, extra geometry or new material passes. Base colors and metalness
were hash-compared before/after this pass and remained identical. Matching grey
bench laminate keeps its color; black handles, worktops, glass, bare metals and
saturated safety colors do not acquire the white-panel texture. All mapped
primitives must have UVs; the molded microcentrifuge chassis needed an analytic
UV wrap, without changing its silhouette.

| Asset/part                                                                  | Evidence                                                                                                                                                                                                                                                                                                                                                                    | LabSpace choice                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard, asymmetric, center/island and overhead laboratory casework panels | [Shimadzu G1-CL-SB1 specification](https://www.shimadzu-rika.co.jp/products/laboratory/g_series/pdf/g1-cl-sb1.pdf) specifies decorative particleboard bodies and resin worktops; the supplied Shimadzu bench image establishes silhouette and light finish.                                                                                                                 | Warm-neutral laminate on panel parts, black nonmetallic phenolic worktops. Metal supports and small fasteners remain separate. This is an original reference-informed variant, not a certified G1 replica. |
| Mobile/base/storage casework and cabinet pulls                              | [Kewaunee specification, pp. 4–5 and 13](https://kewaunee.com/wp-content/uploads/2022/04/steel-spec-2016-03.pdf) distinguishes powder-coated casework, white/black epoxy-painted pulls, anodized pulls, and brushed stainless alternatives.                                                                                                                                 | Satin painted bodies and ivory coated pulls; retain small exposed hinges and runners. Coated pulls are a deliberate supported finish option, not a claim that every reference handle is plastic.           |
| Institutional room doors and frames                                         | [Steelcraft finish options](https://www.steelcraft.com/en/products/finish-options/finish-paint.html) offers painted doors; its [technical manual](https://www.steelcraft.com/content/dam/steelcraft/documents/Steelcraft_Tech_Data_Manual_105001.pdf) describes finish painting and recommends eggshell sheen. Factory finish availability differs for doors versus frames. | Eggshell painted leaves/frames/beads, with distinct glass, seals, hinges, lock cylinders, and stainless kickplates. No bare-metal response on painted panels.                                              |
| Door grips                                                                  | [HEWI System 162](https://www.hewi.com/en/hardware/system-162) offers polyamide, including steel-core polyamide, as well as stainless and coated versions.                                                                                                                                                                                                                  | Matt anthracite polyamide-inspired levers/roses, separated from metal hinge and lock parts before batching. This is a chosen finish variant, not an exact HEWI model.                                      |
| Institutional sink cabinet versus open stainless wash station               | [Shimadzu TW1-A](https://www.shimadzu-rika.co.jp/products/laboratory/sink/tw1-a.html), the supplied sink photograph, and the G1 specification distinguish casework from a stainless sink.                                                                                                                                                                                   | Painted cabinet faces and coated cabinet pulls; exposed stainless trough, drain and faucet remain metallic. The all-stainless wash station remains a different family.                                     |

## Implementation and guardrails

- `reference_finishes.py` selects asset **and named part category before batching**.
  It never converts an entire shared aluminum/stainless material to plastic.
- Finish metadata survives GLB export. The polish pass respects it and prevents
  paint, laminate, polymer, vinyl and rubber from acquiring conductor response.
- Dielectric panels use restrained roughness and no extra clearcoat lobe. Metals
  retain studio reflections; no new per-item textures or lighting passes.
- Catalog and room views use the same GLB. Rebuild is local only and does not read
  or write rooms, laboratories, inventory, demo snapshots or user persistence.
- Small functional door reveals, drawer movement gaps, vents and open work
  apertures are intentional. The separate connection audit checks large detached
  parts; it is not a watertightness certificate.
