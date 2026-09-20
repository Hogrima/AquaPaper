"""Build the original AquaPaper tetra in Blender. No downloaded meshes/textures.
blender --background --python-exit-code 1 --python scripts/build-neon-tetra.py [-- --rummy-nose]
Coordinates in Blender: +X nose, +Z dorsal; runtime: +X nose, +Y dorsal.
"""
import bpy
import math
import json
import struct
import sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
RUMMY = '--rummy-nose' in sys.argv
SLUG = 'rummy-nose' if RUMMY else 'neon-tetra'
SPECIES = 'Petitella bleheri' if RUMMY else 'Paracheirodon innesi'
ASSETS = ROOT / 'web/assets' / SLUG
SOURCE = ROOT / 'assets-source'
ART = ROOT / 'artifacts' / ('rummy-nose' if RUMMY else 'tetra')
for folder in (ASSETS, SOURCE, ART):
    folder.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0.0, roughness=0.35, alpha=1.0, vertex=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    bsdf = mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, alpha)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Alpha'].default_value = alpha
    if vertex:
        attr = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Color'
        mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
        mat.node_tree.links.new(attr.outputs['Alpha'], bsdf.inputs['Alpha'])
    if alpha < 1 or name == 'Fin membrane':
        mat.surface_render_method = 'DITHERED'
    return mat

skin = material('Silver scales and structural blue stripe', (.25,.36,.42), .38, .39, vertex=True)
noise=skin.node_tree.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value=155
noise.inputs['Detail'].default_value=2
bump=skin.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value=.17
bump.inputs['Distance'].default_value=.004
skin.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
skin.node_tree.links.new(bump.outputs['Normal'],next(n for n in skin.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Normal'])
finmat = material('Fin membrane', (.20,.32,.38), .12, .36, .27, True)
raymat = material('Fin rays', (.23,.34,.39), .23, .32, .34, vertex=RUMMY)
eye = material('Obsidian eye', (.003,.006,.009), .12, .08)
iris = material('Silver iris' if RUMMY else 'Blue silver iris', (.34,.40,.30) if RUMMY else (.015,.34,.50), .7, .2)
gill = material('Operculum and mouth', (.08,.15,.18), .4, .3)
objects = []

def smooth(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)

def skin_color(p):
    x,y,z = p
    if RUMMY:
        dorsal = smooth(.025,.20,z)
        color = [a*(1-dorsal)+b*dorsal for a,b in zip((.42,.47,.43),(.055,.10,.075))]
        red = smooth(.32,.49,x)
        color = [a*(1-red)+b*red for a,b in zip(color,(.62,.012,.025))]
        scale = 1 + .035*math.sin(x*115+math.sin(z*95)*1.2)*math.sin(z*95)
        return (*[c*scale for c in color],1)
    dorsal = smooth(.035,.20,z)
    color = [a*(1-dorsal)+b*dorsal for a,b in zip((.30,.39,.43),(.025,.055,.085))]
    # Red only on the posterior ventral flank: P. innesi, not a cardinal tetra.
    red = (1-smooth(-.05,.17,x)) * (1-smooth(.014,.055,z)) * smooth(.008,.035,abs(y))
    color = [a*(1-red)+b*red for a,b in zip(color,(.60,.009,.023))]
    stripe_z = .056 + .018*math.sin((x+.55)*2.2)
    stripe = (1-smooth(.019,.036,abs(z-stripe_z))) * smooth(-.78,-.58,x) * (1-smooth(.55,.70,x))
    stripe *= smooth(.008,.030,abs(y))
    color = [a*(1-stripe)+b*stripe for a,b in zip(color,(.008,.42,.90))]
    # Subtle overlapping scale cells, stored as vertex color as well as shaded live.
    scale = 1 + .04*math.sin(x*115+math.sin(z*95)*1.2)*math.sin(z*95)
    return (*[c*scale for c in color],1)

def mesh_obj(name, verts, faces, mat, kind, color_fn=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    attr = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for i,v in enumerate(mesh.vertices):
        attr.data[i].color = color_fn(v.co) if color_fn else mat.diffuse_color
    obj['surface_kind'] = kind
    objects.append(obj)
    return obj

# Smooth tapered body with real dorsoventral and lateral cross sections.
profile = [(-.80,.035,.018,0),(-.65,.064,.030,0),(-.43,.12,.054,0),
           (-.18,.18,.085,0),(.08,.213,.111,0),(.30,.222,.126,-.004),
           (.48,.195,.123,-.007),(.63,.145,.098,-.002),(.74,.080,.059,.010),(.80,.014,.013,.018)]
def section(x):
    for index,(a,b) in enumerate(zip(profile,profile[1:])):
        if a[0] <= x <= b[0]:
            t=(x-a[0])/(b[0]-a[0]); span=b[0]-a[0]
            prev=profile[max(0,index-1)]; after=profile[min(len(profile)-1,index+2)]
            result=[]
            for k in range(1,4):
                da=(b[k]-prev[k])/(b[0]-prev[0]); db=(after[k]-a[k])/(after[0]-a[0])
                if (a[k]-prev[k])*(b[k]-a[k])<=0:da=0
                if (b[k]-a[k])*(after[k]-b[k])<=0:db=0
                result.append((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*span*da+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*span*db)
            return tuple(result)
    return profile[-1][1:]
verts=[]; faces=[]
RINGS=65; SIDES=40
for i in range(RINGS):
    x=-.80+1.60*i/(RINGS-1)
    height,width,center=section(x)
    for j in range(SIDES):
        theta=2*math.pi*j/SIDES
        verts.append((x,width*math.cos(theta),center+height*math.sin(theta)))
for i in range(RINGS-1):
    for j in range(SIDES):
        a=i*SIDES+j; b=i*SIDES+(j+1)%SIDES
        faces.append((a,b,b+SIDES,a+SIDES))
faces.extend([tuple(reversed(range(SIDES))),tuple((RINGS-1)*SIDES+j for j in range(SIDES))])
body=mesh_obj('Rummy-nose body' if RUMMY else 'Neon tetra body',verts,faces,skin,0,skin_color)

def line(name, points, radius, mat, kind, sides=5):
    # Tiny mesh tubes rather than expensive per-fish curve objects in the runtime.
    v=[]; f=[]
    for i,p in enumerate(points):
        p=Vector(p)
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize()
        n=tangent.cross(Vector((0,1,0)))
        if n.length<.01: n=tangent.cross(Vector((0,0,1)))
        n.normalize(); b=tangent.cross(n).normalized()
        for j in range(sides):
            q=p+radius*(n*math.cos(j*2*math.pi/sides)+b*math.sin(j*2*math.pi/sides))
            v.append(tuple(q))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            f.append((a,b,b+sides,a+sides))
    return mesh_obj(name,v,f,mat,kind)

def tail_color(p):
    # Three black bars separated by pale bands across the forked caudal fin.
    black = abs(p.z) < .045 or .17 < abs(p.z) < .245
    return (.006,.010,.008,.94) if black else (.66,.72,.68,.72)

def fin(name, root, edge, rays=10):
    if RUMMY and name == 'Forked caudal fin':
        v=[]; f=[]; steps=12
        for k in range(rays+1):
            u=k/rays*(len(edge)-1); n=min(len(edge)-2,int(u)); t=u-n
            tip=tuple(edge[n][d]*(1-t)+edge[n+1][d]*t for d in range(3))
            for j in range(steps+1):
                q=j/steps
                v.append(tuple(root[d]*(1-q)+tip[d]*q for d in range(3)))
        for k in range(rays):
            for j in range(steps):
                a=k*(steps+1)+j; b=a+steps+1
                f.append((a,b,b+1,a+1))
        return mesh_obj(name,v,f,finmat,1,tail_color)
    # Radially segmented thin membrane; bent slightly out of plane.
    v=[root]; f=[]
    for k in range(rays+1):
        u=k/rays*(len(edge)-1); n=min(len(edge)-2,int(u)); t=u-n
        tip=tuple(edge[n][d]*(1-t)+edge[n+1][d]*t for d in range(3))
        v.append(tip)
        points=[tuple(root[d]*(1-q)+tip[d]*q for d in range(3)) for q in (0,.33,.66,1)]
        line(name+' ray %02d'%k,points,.0019,raymat,1)
    for k in range(rays): f.append((0,k+1,k+2))
    return mesh_obj(name,v,f,finmat,1,lambda p:(.22,.34,.40,.20+min(.17,abs(p.z)*.35)))

fin('Forked caudal fin',(-.75,0,0),[(-1.20,.012,.33),(-1.15,.006,.22),(-1.00,0,0),(-1.16,-.006,-.22),(-1.20,-.012,-.32)],18)
fin('Dorsal fin',(.14,0,.19),[(-.20,.004,.51),(-.28,.008,.39),(-.37,0,.15)],12)
fin('Anal fin',(-.06,0,-.17),[(-.22,.003,-.41),(-.46,.006,-.27),(-.60,0,-.07)],11)
fin('Adipose fin',(-.53,0,.095),[(-.57,0,.16),(-.67,0,.105)],5)
for side in (-1,1):
    fin('Pectoral fin '+str(side),(.43,side*.098,-.055),[(.25,side*.29,-.17),(.07,side*.20,-.21),(.21,side*.10,-.10)],8)
    fin('Pelvic fin '+str(side),(.10,side*.045,-.18),[(-.08,side*.13,-.36),(-.15,side*.05,-.23)],6)

def sphere(name, loc, scale, mat, kind):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
    obj=bpy.context.object; obj.name=name; obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth=True
    obj['surface_kind']=kind; objects.append(obj)
    return obj
for side in (-1,1):
    sphere('Dark eye '+str(side),(.583,side*.096,.065),(.068,.028,.071),eye,2)
    bpy.ops.mesh.primitive_torus_add(major_segments=28,minor_segments=6,location=(.583,side*.118,.065),rotation=(math.pi/2,0,0),major_radius=.058,minor_radius=.008)
    obj=bpy.context.object; obj.name='Iridescent iris '+str(side)
    obj.data.materials.append(iris); obj['surface_kind']=2; objects.append(obj)
    for p in obj.data.polygons:p.use_smooth=True
    pts=[]
    for i in range(15):
        angle=-1.05+2.10*i/14
        pts.append((.43-.060*math.cos(angle),side*(.113+.01*math.cos(angle)),.01+.16*math.sin(angle)))
    line('Gill cover '+str(side),pts,.0028,gill,0)
    line('Small terminal mouth '+str(side),[(.794,side*.009,.015),(.779,side*.038,.005),(.746,side*.055,-.008)],.0024,gill,0)

if RUMMY:
    transform=Matrix.Diagonal((1.08,.90,.82,1.0))
    for obj in objects:
        obj.matrix_world=transform@obj.matrix_world

# Export evaluated Blender mesh geometry in a deliberately small, documented runtime format.
# Each vertex: position.xyz, normal.xyz, linear RGBA, surface_kind (11 float32 values).
def export_runtime(lod=False):
    opaque=[]; transparent=[]
    bpy.context.view_layer.update()
    for obj in objects:
        if lod and ' ray ' in obj.name and int(obj.name.rsplit(' ',1)[1])%2: continue
        modifier=None; evaluated=None
        if lod and (obj==body or obj['surface_kind']==2):
            modifier=obj.modifiers.new('Runtime LOD', 'DECIMATE')
            modifier.ratio=.26 if obj==body else .42
            depsgraph=bpy.context.evaluated_depsgraph_get()
            evaluated=obj.evaluated_get(depsgraph)
            mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
        else:mesh=obj.data
        mesh.calc_loop_triangles()
        colors=mesh.color_attributes.get('Color')
        mat=mesh.materials[0]; kind=obj['surface_kind']
        matrix=obj.matrix_world; normal_matrix=matrix.to_3x3().inverted().transposed()
        dest=transparent if kind==1 else opaque
        for tri in mesh.loop_triangles:
            for index in tri.vertices:
                vert=mesh.vertices[index]; p=matrix@vert.co; n=(normal_matrix@vert.normal).normalized()
                color=colors.data[index].color[:] if colors else mat.diffuse_color[:]
                dest.extend([p.x,p.z,-p.y,n.x,n.z,-n.y,*color,float(kind)])
        if evaluated:evaluated.to_mesh_clear()
        if modifier:obj.modifiers.remove(modifier)
    data=opaque+transparent
    name=SLUG+('.lod.bin' if lod else '.mesh.bin')
    (ASSETS/name).write_bytes(struct.pack('<%sf'%len(data),*data))
    return len(opaque)//11,len(transparent)//11
opaque_count,fin_count=export_runtime()
lod_opaque,lod_fin=export_runtime(True)
meta={'version':1,'generator':'Blender '+bpy.app.version_string,'stride':11,'opaqueVertices':opaque_count,
      'finVertices':fin_count,'length':2.16 if RUMMY else 2.0,'coordinates':'+X head, +Y dorsal, +Z lateral',
      'binary':SLUG+'.mesh.bin','species':SPECIES,'originalAsset':True,
      'lod':{'opaqueVertices':lod_opaque,'finVertices':lod_fin,'binary':SLUG+'.lod.bin'}}
(ASSETS/(SLUG+'.mesh.json')).write_text(json.dumps(meta,indent=2),encoding='utf-8')

# An editable demonstration swim loop in the .blend, separate from the real-time simulation.
for obj in objects:
    if obj['surface_kind']==2: continue
    obj.shape_key_add(name='Basis')
    for name,sign in [('Tail left',1),('Tail right',-1)]:
        key=obj.shape_key_add(name=name)
        for i,vert in enumerate(obj.data.vertices):
            amount=max(0,min(1,(.48-vert.co.x)/1.65))**2
            key.data[i].co.y+=sign*.20*amount
        for frame,value in [(1,0),(7,1 if sign==1 else 0),(13,0),(19,1 if sign==-1 else 0),(25,0)]:
            key.value=value; key.keyframe_insert(data_path='value',frame=frame)
        key.value=0

scene=bpy.context.scene
scene.frame_start=1;scene.frame_end=24;scene.render.fps=30;scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(ASSETS/(SLUG+'.glb')),use_selection=True,export_format='GLB',export_animations=False,export_morph=False)

world=bpy.data.worlds.new('Deep green studio')
scene.world=world;world.use_nodes=True
world.node_tree.nodes.clear()
background=world.node_tree.nodes.new('ShaderNodeBackground')
world_output=world.node_tree.nodes.new('ShaderNodeOutputWorld')
world.node_tree.links.new(background.outputs[0],world_output.inputs['Surface'])
background.inputs[0].default_value=(.018,.043,.034,1)
background.inputs[1].default_value=.5
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,color,size):
    bpy.ops.object.light_add(type='AREA',location=loc)
    obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.color=color;obj.data.shape='DISK';obj.data.size=size;aim(obj,(-.1,0,0))
area('Soft surface light',(.4,-2.8,3.8),240,(.74,.88,1),3.5)
area('Silver rim',(-1.4,1.8,2.1),350,(.28,.64,1),2.2)
area('Front fill',(2,-3,-.4),80,(.8,1,.88),2.8)
bpy.ops.object.camera_add(location=(.9,-4.8,1.05))
cam=bpy.context.object;cam.name='Tetra portrait';aim(cam,(-.18,0,.015));cam.data.type='ORTHO';cam.data.ortho_scale=2.7;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(ART/('blender-'+SLUG+'.png'))
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(SLUG+'.blend')))
bpy.ops.render.render(write_still=True)
print('AQUAPAPER_MODEL',json.dumps(meta))
