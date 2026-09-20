"""Original Pterygoplichthys pardalis and hollow driftwood shelter, generated in Blender.
blender --background --threads 6 --python-exit-code 1 --python scripts/build-pleco.py
Blender: +X head, +Z dorsal. Runtime: +X head, +Y dorsal, +Z lateral.
"""
import bpy, math, json, struct
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'web/assets/pleco'; ART=ROOT/'artifacts/pleco'; SOURCE=ROOT/'assets-source'
for folder in (OUT,ART,SOURCE):folder.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
objects=[]

def mat(name,color,metal=.05,rough=.5,vertex=True):
    m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
    m.node_tree.nodes.clear();p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');o=m.node_tree.nodes.new('ShaderNodeOutputMaterial')
    m.node_tree.links.new(p.outputs['BSDF'],o.inputs['Surface'])
    p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Alpha'].default_value=color[3]
    if vertex:
        c=m.node_tree.nodes.new('ShaderNodeVertexColor');c.layer_name='Color'
        m.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(c.outputs['Alpha'],p.inputs['Alpha'])
    if color[3]<1:m.surface_render_method='DITHERED'
    return m
skin=mat('Olive brown armored skin',(.16,.125,.055,1))
# High-detail editable procedural skin in Blender: spotted pigment + plate relief + pores.
nodes=skin.node_tree.nodes;links=skin.node_tree.links
bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1.7,1.7,1.7);links.new(coord.outputs['Generated'],mapping.inputs[0])
cells=nodes.new('ShaderNodeTexVoronoi');cells.inputs['Scale'].default_value=12;links.new(mapping.outputs[0],cells.inputs['Vector'])
ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.30;ramp.color_ramp.elements[0].color=(.016,.024,.010,1);ramp.color_ramp.elements[1].position=.44;ramp.color_ramp.elements[1].color=(.10,.076,.026,1);links.new(cells.outputs['Distance'],ramp.inputs[0]);links.new(ramp.outputs[0],bsdf.inputs['Base Color'])
pores=nodes.new('ShaderNodeTexNoise');pores.inputs['Scale'].default_value=210;pores.inputs['Detail'].default_value=3;links.new(coord.outputs['Generated'],pores.inputs['Vector'])
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.007;links.new(pores.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
rough=nodes.new('ShaderNodeMapRange');rough.inputs['From Min'].default_value=0;rough.inputs['From Max'].default_value=1;rough.inputs['To Min'].default_value=.38;rough.inputs['To Max'].default_value=.62;links.new(pores.outputs['Fac'],rough.inputs['Value']);links.new(rough.outputs['Result'],bsdf.inputs['Roughness'])
fins=mat('Spotted sail membranes',(.20,.15,.06,.72),.02,.6)
eye=mat('Golden iris',(.32,.27,.08,1),.25,.25,False)
pupil=mat('Dark iris operculum',(.005,.008,.003,1),.05,.12,False)
mouthmat=mat('Soft suction lips',(.23,.17,.095,1),.01,.68)
cavity=mat('Inside of sucker',(.062,.048,.024,1),0,.78,False)
wood=mat('Waterlogged driftwood',(.10,.065,.028,1),0,.9)

def pattern(p,alpha=1):
    x,y,z=p
    # Irregular honeycomb spots on the broad head and bony flank plates.
    u=x*19+math.sin(z*31)*.16;v=y*37+z*26
    u+=.5*(math.floor(v)%2);cx=u-math.floor(u)-.5;cy=v-math.floor(v)-.5
    edge=math.sqrt(cx*cx+cy*cy)>.26+.035*math.sin(math.floor(u)*2.3)
    color=(.20,.16,.075) if edge else (.022,.030,.013)
    if z<-.02:color=tuple(c*.65+.05 for c in color)
    return (*color,alpha)

def mesh(name,verts,faces,material,kind=0,color=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);data.materials.append(material)
    for poly in data.polygons:poly.use_smooth=True
    attr=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,v in enumerate(data.vertices):attr.data[i].color=color(v.co) if color else material.diffuse_color
    obj['surface_kind']=kind;objects.append(obj);return obj

def tube(name,points,radius,material,kind=0,color=None):
    verts=[];faces=[];sides=6
    for i,p in enumerate(points):
        p=Vector(p);t=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        n=t.cross(Vector((0,0,1)))
        if n.length<.01:n=t.cross(Vector((0,1,0)))
        n.normalize();b=t.cross(n)
        for j in range(sides):verts.append(tuple(p+radius*(n*math.cos(j*math.tau/sides)+b*math.sin(j*math.tau/sides))))
    for i in range(len(points)-1):
        for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
    return mesh(name,verts,faces,material,kind,color)

def ellipsoid(name,center,radii,material,kind=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=14,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=radii;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(material)
    for p in obj.data.polygons:p.use_smooth=True
    obj['surface_kind']=kind;objects.append(obj);return obj

# Dorsoventrally flattened head, broad pectoral girdle, tapered caudal peduncle.
profile=[(-.95,.038,.028),(-.72,.078,.065),(-.45,.16,.12),(-.15,.27,.205),(.12,.35,.245),(.38,.38,.25),(.62,.33,.21),(.82,.22,.13),(.96,.075,.045)]
def section(x):
    for a,b in zip(profile,profile[1:]):
        if a[0]<=x<=b[0]:
            t=(x-a[0])/(b[0]-a[0]);t=t*t*(3-2*t)
            return a[1]*(1-t)+b[1]*t,a[2]*(1-t)+b[2]*t
    return profile[-1][1:]
verts=[];faces=[];rings=81;sides=56
for i in range(rings):
    x=-.95+1.91*i/(rings-1);width,height=section(x)
    for j in range(sides):
        a=math.tau*j/sides;s=math.sin(a)
        z=height*s if s>=0 else .068*s
        verts.append((x,width*math.cos(a),z))
for i in range(rings-1):
    for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
faces.extend([tuple(reversed(range(sides))),tuple((rings-1)*sides+j for j in range(sides))])
body=mesh('Pleco armored body',verts,faces,skin,0,pattern)
# Longitudinal rows of raised armor seams, not tetra-like overlapping scales.
for side in (-1,1):
    for row in range(3):
        points=[]
        for j in range(30):
            x=-.83+j*1.46/29;w,h=section(x);a=.23+row*.35
            points.append((x,side*w*math.cos(a)*1.008,h*math.sin(a)+.002))
        tube('Armor ridge %s %s'%(side,row),points,.005,skin,color=pattern)

def fin(name,root,edge,rays):
    v=[];f=[];steps=8
    for i in range(rays+1):
        u=i/rays*(len(edge)-1);k=min(len(edge)-2,int(u));t=u-k
        tip=tuple(edge[k][d]*(1-t)+edge[k+1][d]*t for d in range(3))
        points=[]
        for j in range(steps+1):
            q=j/steps;p=tuple(root[d]*(1-q)+tip[d]*q for d in range(3));v.append(p);points.append(p)
        tube(name+' ray '+str(i),points,.0035,skin,1,lambda p:pattern(p,.82))
    for i in range(rays):
        for j in range(steps):a=i*(steps+1)+j;b=a+steps+1;f.append((a,b,b+1,a+1))
    mesh(name,v,f,fins,1,lambda p:pattern(p,.65))
fin('Tall sail dorsal fin',(.15,0,.22),[(.27,0,.77),(.05,0,.72),(-.29,0,.48),(-.62,0,.08)],11)
fin('Forked caudal fin',(-.88,0,.015),[(-1.43,.01,.34),(-1.34,0,.19),(-1.23,0,0),(-1.37,0,-.22),(-1.44,0,-.29)],14)
fin('Adipose fin',(-.63,0,.09),[(-.62,0,.18),(-.79,0,.09)],4)
for side in (-1,1):
    fin('Pectoral '+str(side),(.39,side*.27,.008),[(.38,side*.69,-.048),(.03,side*.57,-.055),(-.10,side*.28,-.025)],8)
    fin('Pelvic '+str(side),(-.21,side*.18,-.015),[(-.40,side*.43,-.052),(-.62,side*.22,-.044)],6)
    ellipsoid('Raised eye '+str(side),(.60,side*.205,.181),(.047,.037,.033),eye,2)
    ellipsoid('Pupil '+str(side),(.614,side*.228,.201),(.027,.017,.021),pupil,2)
    tube('Short maxillary barbel '+str(side),[(.83,side*.15,-.035),(.85,side*.225,-.037),(.78,side*.25,-.04)],.006,mouthmat)
# Ventral oral disc: visible from the front pane, with concentric soft lips and dark cavity.
ellipsoid('Oral cavity',(.72,0,-.066),(.138,.126,.012),cavity,3)
for ring in range(2):
    rad=.145+ring*.018
    tube('Suction lip '+str(ring),[(.72+rad*math.cos(i*math.tau/48),rad*.93*math.sin(i*math.tau/48),-.080+ring*.005) for i in range(49)],.017-ring*.004,mouthmat,3)
for side in (-1,1):tube('Rasping jaw '+str(side),[(.70,side*.10,-.083),(.64,side*.04,-.085),(.63,0,-.085)],.007,mouthmat,3)

def export(slug,items,length,species):
    def binary(lod=False):
        opaque=[];transparent=[];bpy.context.view_layer.update()
        for obj in items:
            if lod and ' ray ' in obj.name and int(obj.name.rsplit(' ',1)[1])%2:continue
            modifier=None;evaluated=None
            if lod and len(obj.data.vertices)>80:
                modifier=obj.modifiers.new('LOD','DECIMATE');modifier.ratio=.25
                dg=bpy.context.evaluated_depsgraph_get();evaluated=obj.evaluated_get(dg);data=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
            else:data=obj.data
            data.calc_loop_triangles();colors=data.color_attributes.get('Color');kind=obj['surface_kind'];matrix=obj.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
            target=transparent if kind==1 else opaque
            for tri in data.loop_triangles:
                for index in tri.vertices:
                    vertex=data.vertices[index];p=matrix@vertex.co;n=(normal_matrix@vertex.normal).normalized();color=colors.data[index].color[:] if colors else data.materials[0].diffuse_color[:]
                    target.extend([p.x,p.z,-p.y,n.x,n.z,-n.y,*color,float(kind)])
            if evaluated:evaluated.to_mesh_clear()
            if modifier:obj.modifiers.remove(modifier)
        values=opaque+transparent;name=slug+('.lod.bin' if lod else '.mesh.bin');(OUT/name).write_bytes(struct.pack('<%sf'%len(values),*values))
        return {'opaqueVertices':len(opaque)//11,'finVertices':len(transparent)//11,'binary':name}
    meta={'version':1,'generator':'Blender '+bpy.app.version_string,'stride':11,'length':length,'species':species,'originalAsset':True,'coordinates':'+X head, +Y dorsal, +Z lateral',**binary(),'lod':binary(True)}
    (OUT/(slug+'.mesh.json')).write_text(json.dumps(meta,indent=2),encoding='utf-8')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in items:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(slug+'.glb')),use_selection=True,export_format='GLB',export_animations=False)
    print('AQUAPAPER_MODEL',json.dumps(meta))

pleco=list(objects);export('pleco',pleco,2.4,'Pterygoplichthys pardalis')
# A real hollow, closed-back arch: the depth buffer, not opacity animation, hides fish.
# In runtime coordinates the tunnel opens toward +Z and extends along -Z.
v=[];f=[];segments=32;depths=16
for layer in range(2):
    for k in range(depths+1):
        runtime_z=.5-2.3*k/depths
        for j in range(segments+1):
            a=j*math.pi/segments;ripple=1+.055*math.sin(k*.7+j*1.8)+.023*math.cos(j*4.2)
            rx=(.38 if layer==0 else .30)*ripple;ry=(.54 if layer==0 else .44)*ripple
            v.append((rx*math.cos(a),-runtime_z,ry*math.sin(a)))
layer_size=(depths+1)*(segments+1)
for layer in range(2):
    for k in range(depths):
        for j in range(segments):
            a=layer*layer_size+k*(segments+1)+j;b=a+segments+1
            f.append((a,b,b+1,a+1) if layer==0 else (a,a+1,b+1,b))
for k in (0,depths):
    for j in range(segments):a=k*(segments+1)+j;b=a+layer_size;f.append((a,a+1,b+1,b))
f.append(tuple(depths*(segments+1)+j for j in range(segments+1)))
def bark(p):
    grain=.72+.28*math.sin(p.y*11+math.sin(p.x*49)*2)*math.sin(p.z*34+p.y*3)
    return (.10*grain,.070*grain,.031*grain,1)
shelter=mesh('Hollow driftwood refuge',v,f,wood,color=bark);export('shelter',[shelter],1,'Driftwood refuge');shelter.hide_render=True;shelter.hide_set(True)
for obj in pleco:
    if obj['surface_kind']==2:continue
    obj.shape_key_add(name='Basis')
    for name,sign in [('Tail left',1),('Tail right',-1)]:
        key=obj.shape_key_add(name=name)
        for i,vertex in enumerate(obj.data.vertices):key.data[i].co.y+=sign*.20*max(0,min(1,(.15-vertex.co.x)/1.6))**2
        for frame,value in [(1,0),(7,1 if sign==1 else 0),(13,0),(19,1 if sign==-1 else 0),(25,0)]:key.value=value;key.keyframe_insert(data_path='value',frame=frame)
        key.value=0
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=24;scene.frame_set(1)
world=bpy.data.worlds.new('Underwater studio');scene.world=world;world.use_nodes=True
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.025,.040,.027,1)
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,color,size in [('Surface',(.3,-3,4),420,(.88,1,.85),3.5),('Rim',(-2,2,3),480,(.68,.85,1),2.5),('Fill',(3,-3,1),180,(1,.9,.7),3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.color=color;o.data.size=size;aim(o,(-.15,0,0))
bpy.ops.object.camera_add(location=(1.9,-4.1,2.7));cam=bpy.context.object;aim(cam,(-.22,0,.08));cam.data.type='ORTHO';cam.data.ortho_scale=3.15;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ART/'blender-pleco.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'pleco.blend'));bpy.ops.render.render(write_still=True)
# A second view proves the ventral sucker is geometry, not a painted spot.
cam.location=(1.7,-3.8,-2.7);aim(cam,(.05,0,0));scene.render.filepath=str(ART/'blender-pleco-underside.png');bpy.ops.render.render(write_still=True)
