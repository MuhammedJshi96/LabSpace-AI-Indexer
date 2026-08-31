"""Contoured, closed manufactured shells; no billboards or silhouette scaling."""
import math
import bpy


def rounded_loft(f, name, location, dimensions, material, *, rotation=(0, 0, 0),
                 category="molded shell", corner=.14, taper=.93):
    """Four section rings give pads/covers rounded plan corners and rolled edges.

    Corner rounding is independent of thin panel thickness; a box bevel clamped
    by thickness previously left upholstered chairs looking like flat boards.
    """
    w, d, h = dimensions
    vertices = []
    rings = ((-.5, taper), (-.30, 1), (.25, 1), (.5, taper))
    for height, scale in rings:
        xh, yh = w * scale / 2, d * scale / 2
        radius = min(w, d) * corner
        for cx, cy, start in ((xh-radius, yh-radius, 0), (-xh+radius, yh-radius, 90),
                              (-xh+radius, -yh+radius, 180), (xh-radius, -yh+radius, 270)):
            for step in range(9):
                angle = math.radians(start + step * 90 / 8)
                vertices.append((cx + radius*math.cos(angle), cy + radius*math.sin(angle), height*h))
    n = 36
    faces = [tuple(reversed(range(n))), tuple(range(3*n, 4*n))]
    for ring in range(3):
        for i in range(n):
            j = (i + 1) % n
            faces.append((ring*n+i, ring*n+j, (ring+1)*n+j, (ring+1)*n+i))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    f.assign_material(obj, material)
    for poly in mesh.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    normals = obj.modifiers.new("Area-weighted molded surface normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True
    return f.parent_to_root(obj, category)
def formed_bowl(f, name, location, radius, depth, material):
    """Continuous spun-metal bowl, including inner basin and rolled lip.

    The meridian runs from the drain floor around the exterior and back into
    the basin. Unlike a capped cylinder/cone, the upper surface is truly open.
    """
    import bpy
    import math
    profile = [(0, -.98), (.20, -.98), (.35, -.94), (.56, -.76),
               (.77, -.44), (.96, -.08), (1, 0), (1, .03),
               (.985, .055), (.96, .03), (.945, -.04), (.74, -.41),
               (.53, -.73), (.32, -.89), (.20, -.91), (0, -.91)]
    segments = 64
    vertices = [(location[0] + radius*r*math.cos(2*math.pi*j/segments),
                 location[1] + radius*r*math.sin(2*math.pi*j/segments),
                 location[2] + depth*z)
                for r,z in profile for j in range(segments)]
    faces = [(i*segments+j, i*segments+(j+1)%segments,
              (i+1)*segments+(j+1)%segments, (i+1)*segments+j)
             for i in range(len(profile)-1) for j in range(segments)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    f.assign_material(obj, material)
    f.smooth(obj)
    return f.parent_to_root(obj, "formed eyewash bowl")
