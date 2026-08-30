"""Geometry-derived, explicitly catalogued storage assemblies. No global finish changes."""
import math
import re
import bpy
from mathutils import Vector

SUPPORTED = set("wall-cabinet base-cabinet base-drawer-cabinet lab-bench mobile-bench lab-bench-sink lab-bench-overhead stainless-enclosed-basin sink-cabinet island-bench-service-bridge center-island-bench corner-lab-bench glass-wall-cabinet tall-cabinet sliding-door-cabinet glazed-sliding-cabinet solvent-cabinet chemical-cabinet flammable-cabinet mobile-drawer locker refrigerator-storage freezer-storage office-desk open-shelving heavy-duty-rack plastic-basket-tower stainless-wash-basin".split())

def prepare(f):
    root=f.ROOT
    if root is None or root.get('asset_id') not in SUPPORTED or root.get('storage_rig_version'): return
    aid=root['asset_id']; root['storage_rig_version']=2
    bpy.context.view_layer.update()
    minimum,maximum=f.mesh_bounds(); size=maximum-minimum; center=(minimum+maximum)/2; m=f.MATERIALS
    def bounds(objects):
        points=[o.matrix_world@Vector(p) for o in objects for p in o.bound_box]
        return Vector(tuple(min(p[a] for p in points) for a in range(3))),Vector(tuple(max(p[a] for p in points) for a in range(3)))
    def hollow(name, front_sign=-1):
        obj=bpy.data.objects.get(name)
        if not obj: return
        lo,hi=bounds([obj]); material=obj.data.materials[0]; mid=(lo+hi)/2; d=hi-lo; t=min(.025,d.x*.04)
        bpy.data.objects.remove(obj,do_unlink=True)
        for side in (-1,1):
            f.add_box(name+' side',(mid.x+side*(d.x-t)/2,mid.y,mid.z),(t,d.y,d.z),material,bevel=.004)
            f.add_box(name+' pan',(mid.x,mid.y,mid.z+side*(d.z-t)/2),(d.x-2*t,d.y,t),material,bevel=.004)
        f.add_box(name+' back',(mid.x,hi.y-t/2 if front_sign<0 else lo.y+t/2,mid.z),(d.x-2*t,t,d.z-2*t),material,bevel=.003)
    solid={'chemical-cabinet':'safety cabinet shell','flammable-cabinet':'safety cabinet shell','mobile-drawer':'mobile drawer carcass','locker':'locker carcass','refrigerator-storage':'cold-storage insulated chassis','freezer-storage':'cold-storage insulated chassis'}
    if aid in solid: hollow(solid[aid])
    if aid=='stainless-enclosed-basin': hollow('Enclosed stainless cabinet shell')
    if aid in {'center-island-bench','island-bench-service-bridge'}:
        for obj in list(bpy.context.scene.objects):
            if obj.type=='MESH' and re.match(r'Island .+ carcass shell$',obj.name):
                hollow(obj.name,-1 if obj.location.y<0 else 1)
    if aid in {'chemical-cabinet','flammable-cabinet','refrigerator-storage','freezer-storage'}:
        levels=(.30,.51,.72) if 'cabinet' in aid else (.31,.46,.61,.76)
        for i,z in enumerate(levels): f.add_box(f'Internal shelf {i+1}',(center.x,center.y+.02,minimum.z+size.z*z),(size.x*.84,size.y*.78,.018),m['interior'],bevel=.003,category='interior shelf')
    if aid=='locker':
        for x in (-size.x*.16,size.x*.16): f.add_box('Locker partition',(x,center.y,size.z*.52),(.018,size.y*.84,size.z*.84),m['interior'],bevel=.003)
        for i,x in enumerate((-size.x*.32,0,size.x*.32)): f.add_box(f'Locker bay {i+1} shelf',(x,center.y,size.z*.76),(size.x*.28,size.y*.8,.018),m['interior'],bevel=.003,category='interior shelf')
    bpy.context.view_layer.update()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']; claimed=set(); metadata=[]
    def find(name): return next((o for o in meshes if o.name==name),None)
    def group(prefix): return [o for o in meshes if o.name==prefix or o.name.startswith(prefix+' ')]
    def move(prefix,face,kind,side=-1,bay='',objects=None,normal=None,travel=None,tray=True):
        if face is None: raise RuntimeError(f'Missing {aid}: {prefix}')
        objects=[o for o in (group(prefix) if objects is None else objects) if o not in claimed]
        assert objects,(aid,prefix)
        lo,hi=bounds(objects if aid=='wall-cabinet' else [face]); mid=(lo+hi)/2
        n=Vector(normal or (0,-1 if mid.y<center.y else 1,0)); t=Vector((-n.y,n.x,0))
        if n.y>0: t=-t
        width=hi.x-lo.x if abs(n.y)>.5 else hi.y-lo.y
        node=bpy.data.objects.new('Access - '+prefix,None); bpy.context.collection.objects.link(node); node.parent=root
        node.location=mid+t*(side*width/2) if kind=='hinge' else mid
        depth=size.y if abs(n.y)>.5 else size.x
        shift=n*(travel if travel is not None else min(depth*(.32 if 'island' in aid else .58),.42))
        if kind=='slide': shift=t*(-side*(travel if travel is not None else width*.82))
        region={'x':(mid.x-center.x)/size.x,'y':(lo.z-minimum.z)/size.z,'z':-(mid.y-center.y)/size.y,'width':max(.012,(hi.x-lo.x)/size.x),'height':(hi.z-lo.z)/size.z,'depth':max(.012,(hi.y-lo.y)/size.y)}
        data={'id':prefix,'kind':kind,'bay':bay or prefix,'angle':side*(-n.y if abs(n.y)>.5 else 1)*math.radians(100) if kind=='hinge' else 0.,'travel':shift.length if kind in {'drawer','slide'} else 0.,'translation':[shift.x,shift.z,-shift.y],'region':region}
        node['storageMechanism']=data; metadata.append(data)
        if kind=='drawer' and tray:
            before=set(bpy.data.objects); td=min(depth*(.34 if 'island' in aid else .65),.48); tw=width-.035; bottom=lo.z+.012; th=max(.025,(hi.z-lo.z)*.62)
            def box(suffix,x,y,z,dims):
                p=mid+t*x-n*y; p.z=z
                o=f.add_box(prefix+suffix,p,dims,m['interior'],bevel=.002); o.rotation_euler.z=math.atan2(t.y,t.x)
            box(' tray floor',0,td/2+.015,bottom,(tw,td,.010))
            for s in (-1,1): box(' tray side',s*tw/2,td/2+.015,bottom+th/2,(.010,td,th))
            box(' tray back',0,td+.015,bottom+th/2,(tw,.010,th))
            objects+=list(set(bpy.data.objects)-before)
        bpy.context.view_layer.update()
        for o in objects:
            matrix=o.matrix_world.copy(); o.parent=node; o.matrix_world=matrix; claimed.add(o)
    # All shared casework functions name their fronts and attached hardware.
    for face in meshes:
        match=re.match(r'(.+ (?:drawer \d+|top drawer \d+)) front$',face.name)
        if match: move(match[1],face,'drawer')
        match=re.match(r'(.+?)(?: lower)? door ([12])$',face.name)
        if match and face.get('part_category')=='cabinet door': move(face.name,face,'hinge',-1 if match[2]=='1' else 1,match[1])
    if aid=='wall-cabinet':
        for side,label in ((-1,'left'),(1,'right')):
            p='wall cabinet '+label+' door'; move(p,find(p+' glass insert'),'hinge',side,'Wall cabinet')
    if aid=='mobile-bench':
        for i in (1,2): move(f'mobile drawer {i}',find(f'mobile drawer {i}'),'drawer')
        for side,label in ((-1,'left'),(1,'right')):
            p=f'mobile cabinet {label} door'; move(p,find(p),'hinge',side,'Mobile cabinet')
    if aid=='tall-cabinet':
        for side in (-1,1):
            p=f'Tall cabinet full-height door {side:+d}'; move(p,find(p),'hinge',side,'Tall cabinet',objects=group(p)+(group('Tall cabinet asset field') if side==1 else []))
    if aid=='stainless-enclosed-basin':
        for side in (-1,1):
            p=f'Enclosed basin door {side:+d}'
            details=[o for o in meshes if o.name.startswith('Enclosed basin ') and o.get('part_category') in {'inspection marker','safety label','service tag','label'} and (o.location.x<0)==(side<0)]
            move(p,find(p),'hinge',side,'Enclosed wash cabinet',objects=group(p)+details)
    if aid=='glass-wall-cabinet':
        for side in (-1,1):
            p=f'Sliding glazed door {side:+d}'; move(p,find(p),'slide',side,'Glazed wall cabinet',objects=group(p)+group(f'Glazed door {side:+d}'))
    if aid in {'sliding-door-cabinet','solvent-cabinet','glazed-sliding-cabinet'}:
        for face in meshes:
            match=re.match(r'(.+) sliding panel ([12])$',face.name)
            if not match: continue
            p,i=match.groups(); objects=[face]+group(f'{p} panel {i}')+group(f'{p} recessed vertical pull {i}')+group(f'{p} satin pull insert {i}')
            if i=='2': objects+=group(p+' central overlap seam')+group(p+' central lock barrel')+group(p+' lock keyway')
            move(face.name,face,'slide',-1 if i=='1' else 1,p,objects=objects)
        if aid=='glazed-sliding-cabinet':
            for side,label in ((-1,'left'),(1,'right')):
                p='Upper glass '+label; move(p,find(p+' glass pane'),'slide',side,'Upper glass',objects=group(p))
    if aid=='lab-bench-overhead':
        for i in range(1,5):
            p=f'Overhead module {i}'; objects=[o for o in group(p) if 'door' in o.name or 'pull' in o.name]
            move(p+' glass door',find(p+' glass door'),'hinge',-1,p,objects=objects,normal=(0,-1,0))
    if aid=='island-bench-service-bridge':
        for sign in (-1,1):
            for bay in range(1,4):
                for pane in (1,2):
                    p=f'Shimadzu hutch {sign:+d} bay {bay} sliding glass {pane}'; objects=group(p)+group(f'Shimadzu hutch pane stile {sign:+d} {bay} {pane}')
                    if pane==2: objects+=group(f'Shimadzu hutch recessed pull {sign:+d} bay {bay}')
                    move(p,find(p),'slide',-1 if pane==1 else 1,f'Service bridge {sign:+d} bay {bay}',objects=objects,normal=(0,sign,0))
    if aid=='corner-lab-bench':
        for i in (1,2,3):
            p=f'corner run drawer {i}'; move(p,find(p),'drawer',objects=group(p)+group(f'corner drawer {i}'),normal=(1,0,0))
        move('return utility drawer',find('return utility drawer'),'drawer',objects=group('return utility drawer')+group('return drawer'),normal=(0,-1,0))
        faces=sorted([o for o in meshes if o.name.startswith('return cabinet leaf')],key=lambda o:o.location.x)
        pulls=[o for o in meshes if o.name.startswith('return satin pull')]
        for i,face in enumerate(faces):
            divider=sum(o.location.x for o in faces)/len(faces)
            nearest=[o for o in pulls if (o.location.x<divider)==(i==0)]
            move(f'Return cabinet door {i+1}',face,'hinge',-1 if i==0 else 1,'Return cabinet',objects=[face]+nearest,normal=(0,-1,0))
    if aid in {'chemical-cabinet','flammable-cabinet'}:
        faces=sorted([o for o in meshes if re.fullmatch(r'safety cabinet door(?:\.\d+)?',o.name)],key=lambda o:o.location.x)
        details=[o for o in meshes if any(o.name.startswith(p) for p in ['safety cabinet pull','safety cabinet vent ','safety cabinet label'])]
        for i,face in enumerate(faces): move(f'Safety cabinet door {i+1}',face,'hinge',-1 if i==0 else 1,'Safety cabinet',objects=[face]+[o for o in details if (o.location.x<0)==(i==0)],normal=(0,-1,0))
    if aid=='mobile-drawer':
        for i in range(1,5):
            p=f'mobile drawer {i}'; move(p,find(p),'drawer',objects=group(p)+group(f'mobile drawer pull {i}'))
    if aid=='locker':
        for i in range(1,4):
            p=f'locker door {i}'; move(p,find(p),'hinge',-1,f'Locker bay {i}',objects=group(p)+group(f'locker {i}')+group(f'locker lock {i}'))
    if aid in {'refrigerator-storage','freezer-storage'}:
        objects=[]
        for p in ('cold-storage door','cold-storage gasket','cold-storage inner door panel','cold-storage vertical handle','cold-storage class marker'): objects+=group(p)
        move('Cold storage door',find('cold-storage door'),'hinge',-1,'Cold storage',objects=objects)
    if aid=='office-desk':
        face=find('underslung pencil drawer'); lo,hi=bounds([face]); face.dimensions.y=.016; face.location.y=lo.y+.008; bpy.context.view_layer.update()
        move('Pencil drawer',face,'drawer',objects=[face]+group('pencil drawer'),normal=(0,-1,0),travel=.22)
    if aid=='plastic-basket-tower':
        floors=sorted([o for o in meshes if o.name.startswith('removable basket floor')],key=lambda o:-o.location.z)
        for i,floor in enumerate(floors):
            objects=[o for o in meshes if o.get('part_category')=='basket' or o.name.startswith('basket label pull')]
            objects=[o for o in objects if floor.location.z-.005<=o.location.z<floor.location.z+size.z*.12]
            face=next(o for o in objects if o.name.startswith('basket front lip'))
            move(f'Removable basket {i+1}',face,'drawer',objects=objects,normal=(0,-1,0),tray=False,travel=size.y*.5)
    for obj in meshes:
        if obj.get('part_category')=='casework reveal': bpy.data.objects.remove(obj,do_unlink=True)
    bpy.context.view_layer.update(); shelves=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or obj in claimed: continue
        category=obj.get('part_category','')
        if ('shelf' not in category or any(s in category for s in ('upright','lip','edge'))) and not re.search(r'wall cabinet shelf|lower.*shelf',obj.name,re.I): continue
        lo,hi=bounds([obj]); d=hi-lo
        if d.z>d.x*.3 or d.z>.09: continue
        shelves.append({'id':obj.name,'x':((lo.x+hi.x)/2-center.x)/size.x,'y':(hi.z-minimum.z)/size.z,'z':-((lo.y+hi.y)/2-center.y)/size.y,'width':d.x/size.x,'depth':d.y/size.y})
    root['storage_shelves']=shelves
    root['storage_shelf_levels']=sorted(set(round(s['y'],5) for s in shelves),reverse=True)
    root['storage_mechanism_count']=len(metadata)
    assert metadata or shelves,f'No storage anatomy: {aid}'
