"""Original formed-steel wash assemblies, informed by Shimadzu and Elkay.

Continuous basin/deck geometry replaces intersecting beveled blocks. These are
planning representations, not manufacturer models or certified installations.
"""
import math
import bpy
import lab_furniture as f
import lab_casework_batch3 as c


def finishes():
    return {
        'steel': f.make_material('Wash assembly brushed 304 steel',(.48,.54,.56,1),metallic=.92,roughness=.26),
        'polished': f.make_material('Wash assembly polished hardware',(.62,.67,.69,1),metallic=.96,roughness=.18),
        'body': f.make_material('Institutional warm grey casework',(.46,.51,.51,1),metallic=.05,roughness=.32),
        'face': f.make_material('Institutional porcelain door enamel',(.72,.75,.73,1),metallic=.035,roughness=.28),
        'toe': f.make_material('Wash cabinet graphite plinth',(.035,.047,.049,1),roughness=.47),
    }


def rounded_ring(w,d,r,cx,cy,z):
    points=[]
    for x,y,start in ((w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)):
        for i in range(9):
            a=math.radians(start+i*90/8)
            points.append((cx+x+r*math.cos(a),cy+y+r*math.sin(a),z))
    return points


def formed_sink_deck(name,w,d,bowl,center,rim_z,depth,material):
    """One connected sheet: rolled perimeter, deck, coved walls and basin floor."""
    bw,bd=bowl; x,y=center
    sections=[(w,d,.016,0,0,rim_z-.050),(w,d,.016,0,0,rim_z-.004),
              (w-.008,d-.008,.014,0,0,rim_z),
              (bw+.016,bd+.016,.045,x,y,rim_z),
              (bw,bd,.042,x,y,rim_z-.008),
              (bw-.028,bd-.028,.058,x,y,rim_z-.060),
              (bw-.085,bd-.085,.075,x,y,rim_z-depth+.020),
              (bw-.12,bd-.12,.065,x,y,rim_z-depth)]
    count=36; verts=[p for s in sections for p in rounded_ring(*s)]
    faces=[(i*count+j,i*count+(j+1)%count,(i+1)*count+(j+1)%count,(i+1)*count+j)
           for i in range(len(sections)-1) for j in range(count)]
    faces.append(tuple(range((len(sections)-1)*count,len(verts))))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
    f.assign_material(obj,material); f.parent_to_root(obj,'formed sink deck')
    # Recalculate a coherent shell before adding a physical 2-mm sheet gauge.
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    for p in mesh.polygons:
        p.use_smooth=abs(p.normal.z)<.999
    solid=obj.modifiers.new('Welded stainless sheet gauge','SOLIDIFY'); solid.thickness=.002; solid.offset=-1
    obj['construction_revision']='formed-sink-r2'
    return obj


def drain(name,x,y,z,metal):
    f.add_cylinder(name+' basket',(x,y,z+.004),.033,.007,metal,vertices=64,bevel=.001,category='drain')
    for i in range(9):
        a=2*math.pi*i/9
        f.add_cylinder(name+' perforation',(x+.021*math.cos(a),y+.021*math.sin(a),z+.008),.0025,.001,f.MATERIALS['shadow'],vertices=12,category='drain')


def faucet(name,x,y,z,top,metal):
    f.add_cylinder(name+' deck escutcheon',(x,y,z+.005),.032,.014,metal,vertices=48,bevel=.002,category='tap')
    f.add_cylinder(name+' mixer body',(x,y,z+.041),.024,.075,metal,vertices=48,bevel=.003,category='tap')
    # Smooth semicircular swan neck, no unsupported nozzle or disconnected rod.
    pts=[(x,y,z+.062),(x,y,top-.10),(x,y-.055,top-.025),(x,y-.14,top-.042),(x,y-.17,top-.105)]
    c.add_curve_tube(name+' formed spout',pts,.013,metal,category='tap')
    f.add_cylinder(name+' aerator',(x,y-.17,top-.115),.016,.026,metal,vertices=48,bevel=.002,category='tap')
    f.add_cylinder(name+' lever spindle',(x+.032,y,z+.065),.011,.066,metal,axis=(1,0,0),vertices=32,category='tap')
    f.add_box(name+' lever',(x+.067,y,z+.066),(.078,.014,.012),metal,bevel=.003,category='tap')
    for side,key in ((-1,'blue'),(1,'red')):
        f.add_cylinder(name+' temperature mark',(x+.065,y+side*.005,z+.073),.002,.002,f.MATERIALS.get(key,f.MATERIALS['shadow']),vertices=16,category='tap')


def folded_pull(name,x,y,z,width,metal):
    """Slim integrated return grip; no oversized black bar or floating U-loop."""
    span=min(width-.052,.42)
    f.add_box(name+' folded pull mount',(x,y-.009,z), (span,.022,.016),metal,bevel=.002,category='pull')
    f.add_box(name+' folded pull return',(x,y-.023,z+.006),(span,.014,.005),metal,bevel=.0015,category='pull')


def build_institutional(spec):
    m=finishes(); w,d=spec.width,spec.depth
    # Same three canonical leaves and two usable left shelves, with enclosed
    # plumbing on the right. Keep dimensions and storage identities stable.
    for side in (-1,1):
        f.add_box('Wash cabinet side panel',(side*.72,.006,.480),(.020,.62,.770),m['body'],bevel=.003)
    f.add_box('Wash cabinet rear panel',(0,.307,.480),(1.42,.018,.770),m['body'],bevel=.003)
    f.add_box('Wash cabinet base pan',(0,.006,.104),(1.42,.62,.018),m['body'],bevel=.002)
    f.add_box('Wash cabinet recessed plinth',(0,.03,.0475),(1.415,.525,.095),m['toe'],bevel=.003,category='plinth')
    f.add_box('Wash cabinet continuous apron',(0,-.326,.7725),(1.46,.026,.185),m['body'],bevel=.003,category='fixed apron')
    for side in (-1,1):
        f.add_box('Wash cabinet face return',(side*.721,-.315,.388),(.018,.035,.586),m['body'],bevel=.002)
    for i in range(3):
        x=-.48+i*.48; bay='Wash left cabinet' if i<2 else 'Wash service cabinet'; n=i+1 if i<2 else 1
        name=f'{bay} door {n}'
        f.add_box(name,(x,-.326,.3905),(.472,.021,.569),m['face'],bevel=.0025,category='cabinet door')
        folded_pull(name,x,-.326,.643,.472,m['polished'])
        for z in (.19,.58):
            f.add_cylinder(name+' hinge',(x+(-1 if i!=1 else 1)*.228,-.314,z),.005,.052,m['polished'],vertices=24,category='hinge')
    f.add_box('Wash service partition',(.24,.022,.384),(.018,.59,.565),m['body'],bevel=.002)
    for name,z in (('Wash left shelf',.34),('Wash left lower shelf',.13)):
        f.add_box(name,(-.24,.027,z),(.91,.49,.018),m['face'],bevel=.002,category='interior shelf')
    formed_sink_deck('Continuous institutional trough',w,d,(1.27,.445),(0,-.013),.9,.245,m['steel'])
    f.add_box('Wash formed backsplash',(0,.337,.971),(w,.025,.152),m['steel'],bevel=.003,category='splashback')
    drain('Trough drain',.34,.025,.656,m['polished'])
    c.add_curve_tube('Trapped drain pipe',[(.34,.025,.654),(.34,.025,.43),(.44,.04,.385),(.48,.21,.43),(.48,.29,.50)],.019,m['steel'])
    for x in (-.28,.35): faucet('Wash mixer',x,.26,.90,1.20,m['polished'])
    f.ROOT['construction_revision']='formed-sink-r2'
    f.ROOT['worktop_height_m']=.90


def build_open(spec):
    m=finishes(); w,d=spec.width,spec.depth
    lx,ly=w/2-.070,d/2-.070
    # Tubular legs are welded to underside channels, with real adjustable feet.
    for x in (-lx,lx):
        for y in (-ly,ly):
            f.add_cylinder('Wash tubular leg',(x,y,.442),.023,.816,m['steel'],vertices=48,bevel=.002,category='frame')
            f.add_cylinder('Wash leg welded socket',(x,y,.827),.030,.048,m['steel'],vertices=48,bevel=.002,category='frame')
            f.add_cylinder('Wash adjustable bullet foot',(x,y,.023),.020,.046,m['polished'],vertices=48,bevel=.004,category='foot')
    for y in (-ly,ly): f.add_box('Wash underside channel',(0,y,.828),(2*lx,.050,.048),m['steel'],bevel=.002,category='frame')
    for x in (-lx,lx): f.add_box('Wash underside end channel',(x,0,.828),(.050,2*ly,.048),m['steel'],bevel=.002,category='frame')
    # Preserve the storage shelf's canonical identity and original usable area.
    f.add_box('Wash station lower shelf',(0,0,.17),(w-.11,d-.11,.035),m['steel'],bevel=.004,category='lower shelf')
    for y in (-ly,ly): f.add_box('Wash shelf folded edge',(0,y,.153),(2*lx,.026,.036),m['steel'],bevel=.002,category='shelf edge')
    formed_sink_deck('Continuous drainboard wash deck',w,d,(.84,.50),(-.32,-.035),.90,.285,m['steel'])
    f.add_box('Wash station folded backsplash',(0,d/2-.019,.984),(w,.038,.184),m['steel'],bevel=.004,category='splashback')
    for i in range(8):
        x=.245+i*.075
        f.add_box('Shallow pressed drainboard rib',(x,-.015,.9005),(.005,.46,.003),m['steel'],bevel=.001,category='drainboard')
    drain('Wash drain',-.32,-.035,.616,m['polished'])
    c.add_curve_tube('Wash trap and drain',[(-.32,-.035,.616),(-.32,-.035,.43),(-.32,.045,.38),(-.32,.13,.43),(-.32,.13,.48),(-.32,.29,.48)],.022,m['steel'])
    faucet('Commercial swan mixer',-.32,.26,.90,1.307,m['polished'])
    f.ROOT['construction_revision']='formed-sink-r2'
    f.ROOT['worktop_height_m']=.90
    f.ROOT['reference_anatomy']='Original welded 304 stainless wash station with coved basin, drainboard, tubular legs, adjustable feet and undershelf; informed by Elkay commercial construction'
