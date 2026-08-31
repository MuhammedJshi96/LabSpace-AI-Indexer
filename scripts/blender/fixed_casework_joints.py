"""Close reviewed fixed worktop/carcass gaps without touching moving fronts."""
import bpy
from mathutils import Vector

REVIEWED = {
    "lab-bench-sink": "Carcass upper rail",
    "lab-bench-overhead": "Carcass upper rail",
    "stainless-enclosed-basin": "Enclosed stainless cabinet shell",
}


def apply(f):
    root = f.ROOT
    if root is None or root.get('asset_id') not in REVIEWED or root.get('fixed_joint_revision'):
        return
    aid = root['asset_id']
    bpy.context.view_layer.update()
    def bounds(obj):
        p = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        return Vector(tuple(min(v[a] for v in p) for a in range(3))), Vector(tuple(max(v[a] for v in p) for a in range(3)))
    body = bpy.data.objects[REVIEWED[aid]]
    lo, hi = bounds(body)
    tops = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.get('part_category') == 'worktop']
    top_bottom = min(bounds(o)[0].z for o in tops)
    gap = top_bottom - hi.z
    if not .004 < gap < .08:
        raise RuntimeError(f'{aid}: unexpected fixed joint {gap:.4f} m; review source anatomy')
    # A four-sided folded bearing collar supports the top while leaving the sink
    # bowl and its plumbing unobstructed. No opaque slab through the basin.
    m = f.MATERIALS['stainless'] if aid == 'stainless-enclosed-basin' else f.MATERIALS['powder_light']
    z = (hi.z + top_bottom) / 2
    for side in (-1, 1):
        f.add_box(f'Continuous worktop bearing end {side}', (lo.x + .010 if side < 0 else hi.x - .010, (lo.y+hi.y)/2, z),
                  (.020, hi.y-lo.y, gap+.001), m, bevel=.002, category='fixed worktop joint')
        f.add_box(f'Continuous worktop bearing face {side}', ((lo.x+hi.x)/2, lo.y+.010 if side < 0 else hi.y-.010, z),
                  (hi.x-lo.x-.040, .020, gap+.001), m, bevel=.002, category='fixed worktop joint')
    root['fixed_joint_revision'] = 'catalog-polish-r1'
    root['fixed_worktop_gap_closed_m'] = round(gap, 6)
