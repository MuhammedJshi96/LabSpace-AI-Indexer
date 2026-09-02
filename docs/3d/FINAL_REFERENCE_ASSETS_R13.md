# Final reference product assets — r14

The September 2 final reference pass replaces the legacy hotplate and
analytical-balance delivery models and refreshes the GPU analysis workstation.
All three products are authored as named-part Blender scenes first and exported
to separate optimized runtime GLBs. No Three.js primitives are used as their
source geometry and no downloaded manufacturer mesh or logo is included.

## Reference contracts

- **Magnetic stirrer hot plate:** 200 × 260 × 120 mm body, 180 mm ceramic plate,
  dual knobs, two-field red LED display, rear IEC inlet and removable support
  rod. The rod makes the complete stored planning envelope 200 × 260 × 420 mm.
- **Analytical balance:** 210 × 320 × 310 mm envelope, 90 mm stainless pan,
  three independently represented sliding draft-shield doors, clear low-iron
  blue-edge glass, tracks, pulls, 0.0000 g display and IEC/RS232 rear service.
- **GPU analysis workstation:** 1200 × 600 × 750 mm desk inside a 1250 mm total
  monitor envelope, 25 mm light-wood top and square-tube frame. The supplied
  reference explicitly requires one 60 mm cable grommet. The monitor is a
  watertight concave ultrawide shell; the centre recedes and its edges wrap
  toward the user. Its upright, pivot and VESA boss are mounted entirely behind
  the panel; only the weighted base extends toward the user. The tower retains
  its physically captured tempered side glass, complete rear service panel and
  visible original internals.

## Release gates

The editable `.blend` files preserve named manufacturing parts, hierarchy and
unapplied manufactured-edge modifiers. Runtime GLBs must pass exact-envelope
validation, a same-facing coplanar render-risk audit before and after Draco,
multi-view catalog rendering, local browser orbit review and the complete app
test/build suite. The shipped GLBs remain planning representations rather than
manufacturer-certified replicas.
