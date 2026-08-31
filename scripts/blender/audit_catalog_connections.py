"""Read-only fixed-part gap candidates from the delivered geometry.

Bounds are a conservative discovery aid, not a watertightness certificate:
intended work apertures, glass, ventilation and moving reveals need review.
Coincident split vertices are welded only in the analysis graph, never the GLB.
"""
import json
import sys
import argparse
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]

def components(obj):
    mesh = obj.data
    parent = list(range(len(mesh.vertices)))
    def find(i):
        while i != parent[i]:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def union(a, b):
        a, b = find(a), find(b)
        if a != b: parent[b] = a
    points = [obj.matrix_world @ v.co for v in mesh.vertices]
    coincident = {}
    for i, point in enumerate(points):
        key = tuple(round(v, 5) for v in point)
        if key in coincident: union(i, coincident[key])
        else: coincident[key] = i
    for edge in mesh.edges: union(*edge.vertices)
    groups = {}
    for i, point in enumerate(points): groups.setdefault(find(i), []).append(point)
    output = []
    for group in groups.values():
        if len(group) < 8: continue
        lo = [min(p[a] for p in group) for a in range(3)]
        hi = [max(p[a] for p in group) for a in range(3)]
        size = sorted(hi[a]-lo[a] for a in range(3))
        output.append({'object': obj.name, 'lo': lo, 'hi': hi,
                       'size': size, 'vertices': len(group)})
    return output

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='artifacts/realism-review/connections-after.json')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    records = []
    for path in sorted((ROOT/'public/models/hero').glob('*.glb')):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(path))
        bpy.context.view_layer.update()
        parts = [p for obj in bpy.context.scene.objects if obj.type == 'MESH' for p in components(obj)]
        flags = []
        for i, part in enumerate(parts):
            if part['size'][1] < .055 or part['size'][2] < .12: continue
            distances = []
            for j, other in enumerate(parts):
                if i == j: continue
                delta = [max(0, part['lo'][a]-other['hi'][a], other['lo'][a]-part['hi'][a]) for a in range(3)]
                distances.append((sum(v*v for v in delta)**.5, j))
            if not distances: continue
            distance, nearest = min(distances)
            if distance > .002:
                flags.append({**part, 'gap_mm': round(distance*1000, 2),
                              'nearest': parts[nearest]['object']})
        records.append({'id':path.stem, 'components':len(parts), 'detached':flags})
        print('CONNECTION_AUDIT', path.stem, len(flags), flush=True)
    output = ROOT/args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(records, indent=2))
    print('COMPLETE',len(records),'assets',sum(len(r['detached']) for r in records),'candidates')

if __name__ == '__main__': main()
