"""Build five original editable tropical reef fish in Blender.

blender --background --threads 4 --python-exit-code 1 --python scripts/build-coral-fish.py -- --species clown
Repeat with yellow-tang, blue-tang, moorish-idol and dwarf-hawkfish. Each run exports .blend, .glb,
full/LOD WebGL meshes and a lit diagnostic render.
"""
import bpy, math, json, struct, sys
from pathlib import Path
from mathutils import Vector

SPECIES = next((sys.argv[i+1] for i,v in enumerate(sys.argv[:-1]) if v == '--species'), 'clown')
CONFIG = {
 'clown': {'name':'Amphiprion ocellaris','profile':[(.03,.015),(.09,.05),(.17,.10),(.23,.135),(.27,.145),(.23,.125),(.17,.09),(.09,.045),(.015,.010)],'nose':.61,'tail':-.79,'color':(.95,.225,.025),'eye':.47},
 'yellow-tang': {'name':'Zebrasoma flavescens','profile':[(.025,.018),(.11,.055),(.26,.125),(.38,.17),(.42,.19),(.38,.16),(.28,.105),(.11,.045),(.014,.008)],'nose':.62,'tail':-.83,'color':(.95,.72,.035),'eye':.43},
 'blue-tang': {'name':'Paracanthurus hepatus','profile':[(.03,.015),(.10,.047),(.22,.11),(.32,.16),(.36,.175),(.33,.17),(.25,.12),(.12,.055),(.014,.008)],'nose':.65,'tail':-.84,'color':(.025,.18,.86),'eye':.48},
 'moorish-idol': {'name':'Zanclus cornutus','profile':[(.018,.012),(.10,.028),(.25,.046),(.39,.062),(.44,.073),(.38,.067),(.26,.055),(.105,.034),(.012,.008)],'nose':.78,'tail':-.82,'color':(.90,.86,.68),'eye':.47},
 'dwarf-hawkfish': {'name':'Cirrhitichthys falco','profile':[(.025,.018),(.075,.047),(.125,.085),(.16,.115),(.175,.128),(.17,.120),(.13,.095),(.072,.054),(.016,.012)],'nose':.62,'tail':-.80,'color':(.76,.66,.52),'eye':.44},
}
if SPECIES not in CONFIG: raise ValueError('unknown species '+SPECIES)
C=CONFIG[SPECIES]
ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'web'/'assets'/('coral-'+SPECIES)
SRC=ROOT/'assets-source'
ART=ROOT/'artifacts'/'coral-fish'
for path in (DEST,SRC,ART):path.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
objects=[]

def mat(name,color,alpha=1,metal=0,rough=.34,vertex=False):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,alpha);m.use_nodes=True
 bs=next((n for n in m.node_tree.nodes if n.bl_idname=='ShaderNodeBsdfPrincipled'),None) or m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
 output=next((n for n in m.node_tree.nodes if n.bl_idname=='ShaderNodeOutputMaterial'),None) or m.node_tree.nodes.new('ShaderNodeOutputMaterial')
 m.node_tree.links.new(bs.outputs['BSDF'],output.inputs['Surface'])
 m['skin_node']=bs.name
 bs.inputs['Base Color'].default_value=(*color,alpha)
 bs.inputs['Alpha'].default_value=alpha;bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 if vertex:
  a=m.node_tree.nodes.new('ShaderNodeAttribute');a.attribute_name='Color'
  m.node_tree.links.new(a.outputs['Color'],bs.inputs['Base Color'])
  m.node_tree.links.new(a.outputs['Alpha'],bs.inputs['Alpha'])
 if alpha<1:m.surface_render_method='DITHERED'
 return m

skin=mat('species-specific patterned skin',C['color'],vertex=True,metal=.12,rough=.30)
noise=skin.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=58;noise.inputs['Detail'].default_value=4
scales=skin.node_tree.nodes.new('ShaderNodeTexVoronoi');scales.feature='DISTANCE_TO_EDGE';scales.inputs['Scale'].default_value=42
scales.inputs['Randomness'].default_value=.72
relief=skin.node_tree.nodes.new('ShaderNodeMath');relief.operation='MULTIPLY'
skin.node_tree.links.new(noise.outputs['Fac'],relief.inputs[0]);skin.node_tree.links.new(scales.outputs['Distance'],relief.inputs[1])
bump=skin.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28;bump.inputs['Distance'].default_value=.010
skin.node_tree.links.new(relief.outputs['Value'],bump.inputs['Height'])
skin.node_tree.links.new(bump.outputs['Normal'],skin.node_tree.nodes[skin['skin_node']].inputs['Normal'])
skin.node_tree.nodes[skin['skin_node']].inputs['Coat Weight'].default_value=.27
skin.node_tree.nodes[skin['skin_node']].inputs['Coat Roughness'].default_value=.13
grain=skin.node_tree.nodes.new('ShaderNodeMixRGB');grain.blend_type='MULTIPLY';grain.inputs['Fac'].default_value=.15
attribute=next(n for n in skin.node_tree.nodes if n.bl_idname=='ShaderNodeAttribute')
skin.node_tree.links.new(attribute.outputs['Color'],grain.inputs['Color1'])
skin.node_tree.links.new(noise.outputs['Color'],grain.inputs['Color2'])
skin.node_tree.links.new(grain.outputs['Color'],skin.node_tree.nodes[skin['skin_node']].inputs['Base Color'])
membrane=mat('translucent fin membrane',C['color'],alpha=.53,vertex=True,rough=.38)
raymat=mat('fin ray',C['color'],alpha=.9,vertex=True,rough=.32)
black=mat('glossy black pupil',(.002,.004,.009),rough=.08)
iris=mat('species iris',(.50,.31,.025) if SPECIES=='clown' else (.45,.25,.08) if SPECIES in ('moorish-idol','dwarf-hawkfish') else (.12,.27,.62),metal=.3,rough=.19)
lip=mat('mouth and operculum',(.12,.10,.085) if SPECIES=='clown' else (.08,.15,.23),rough=.44)

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def mix(a,b,t):return tuple(a[i]*(1-t)+b[i]*t for i in range(3))
def cubic(p0,p1,p2,p3,t):
 return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
def body_color(co):
 x,y,z=co
 if SPECIES=='clown':
  orange=mix((.76,.10,.018),(.98,.34,.035),smooth(-.6,.6,x))
  band=max(1-smooth(.047,.086,abs(x-u)) for u in (.39,.0,-.43))
  edge=max(1-smooth(.080,.118,abs(x-u)) for u in (.39,.0,-.43))
  color=mix(orange,(.026,.022,.018),edge*.94)
  color=mix(color,(.92,.90,.73),band)
  color=mix(color,(.23,.060,.023),smooth(.11,.24,z)*.31)
 elif SPECIES=='yellow-tang':
  gold=mix((.60,.30,.006),(.91,.59,.014),smooth(-.22,.50,x))
  color=mix(gold,(.94,.69,.045),smooth(-.22,-.04,z)*.20)
  color=mix(color,(.29,.20,.02),smooth(.26,.42,z)*.14)
 elif SPECIES=='blue-tang':
  blue=mix((.006,.055,.48),(.012,.20,.77),smooth(-.25,.48,x))
  saddle=smooth(-.015,.10,z)*smooth(-.76,-.51,x)*(1-smooth(.28,.50,x))
  palette=(1-smooth(.015,.12,abs(z-(.16+.08*math.cos(x*4.1)))))+saddle*.8
  color=mix(blue,(.003,.008,.038),min(.97,palette*.96))
  color=mix(color,(.018,.15,.68),1-smooth(-.20,-.06,z))
 elif SPECIES=='moorish-idol':
  ivory=mix((.71,.69,.61),(.97,.94,.82),smooth(-.65,.35,x))
  bar=max(1-smooth(.105,.18,abs(x-.11)),1-smooth(.13,.205,abs(x+.38)))
  color=mix(ivory,(.012,.019,.025),bar*.985)
  color=mix(color,(.94,.64,.055),smooth(.31,.52,x)*(1-smooth(.01,.30,abs(z))))
  color=mix(color,(.015,.025,.030),1-smooth(-.75,-.62,x))
 else:
  ivory=mix((.46,.34,.28),(.70,.60,.46),smooth(-.65,.50,x))
  bar=.5+.5*math.sin(x*17+z*5)
  spots=max(0,math.sin(x*35+z*12)*math.sin(z*31+x*9))
  color=mix(ivory,(.20,.045,.025),min(.92,smooth(.56,.76,bar)*.64+smooth(.53,.70,spots)*.52))
  color=mix(color,(.76,.68,.54),(1-smooth(-.13,-.05,z))*.53)
  color=mix(color,(.31,.075,.035),smooth(.31,.38,x)*(1-smooth(.43,.51,x))*.65)
 # Fine scales in vertex colors; additional micro normal variation lives in the .blend.
 scale=1+.048*math.sin(x*39+math.sin(z*30))*math.sin(z*34+y*27)
 return (*[max(0,min(1,v*scale)) for v in color],1)

def mesh_obj(name,verts,faces,material,kind,color=None):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);data.materials.append(material)
 for p in data.polygons:p.use_smooth=True
 attr=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
 for i,v in enumerate(data.vertices):attr.data[i].color=color(v.co) if color else material.diffuse_color
 obj['surface_kind']=kind;objects.append(obj);return obj

# Distinct cross-sections: rounded clownfish, tall tangs, laterally compressed
# idol and compact bottom-perching hawkfish. +X faces the nose; +Z is dorsal.
def dimensions(x):
 t=max(0,min(.999,(x-C['tail'])/(C['nose']-C['tail'])))*(len(C['profile'])-1)
 k=int(t);f=t-k
 a,b=C['profile'][k],C['profile'][k+1]
 before=C['profile'][max(0,k-1)];after=C['profile'][min(len(C['profile'])-1,k+2)]
 h=cubic(before[0],a[0],b[0],after[0],f)
 w=cubic(before[1],a[1],b[1],after[1],f)
 return h,w
N=64;SIDES=40;verts=[];faces=[]
for i in range(N):
 x=C['tail']+(C['nose']-C['tail'])*i/(N-1);h,w=dimensions(x)
 for j in range(SIDES):
  theta=2*math.pi*j/SIDES
  verts.append((x,w*math.cos(theta),h*math.sin(theta)))
for i in range(N-1):
 for j in range(SIDES):
  a=i*SIDES+j;b=i*SIDES+(j+1)%SIDES;faces.append((a,b,b+SIDES,a+SIDES))
faces.extend([tuple(reversed(range(SIDES))),tuple((N-1)*SIDES+j for j in range(SIDES))])
body=mesh_obj(C['name']+' sculpted body',verts,faces,skin,0,body_color)

def tube(name,points,radius,material,kind=0,color=None,sides=5):
 verts=[];faces=[]
 for i,p in enumerate(points):
  p=Vector(p);d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  if d.length<.0001:d=Vector((1,0,0))
  d.normalize();up=d.cross(Vector((0,1,0)))
  if up.length<.001:up=d.cross(Vector((0,0,1)))
  up.normalize();v=d.cross(up).normalized()
  for j in range(sides):verts.append(tuple(p+radius*(up*math.cos(j*2*math.pi/sides)+v*math.sin(j*2*math.pi/sides))))
 for i in range(len(points)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
 return mesh_obj(name,verts,faces,material,kind,color)

def fin_color(p):
 x,y,z=p
 if SPECIES=='clown':base=(.78,.21,.025)
 elif SPECIES=='yellow-tang':base=(.86,.53,.012)
 elif SPECIES=='blue-tang':base=(.040,.26,.78) if x>-.7 else (.96,.73,.025)
 elif SPECIES=='moorish-idol':base=(.92,.91,.77) if z>.38 else (.025,.031,.035)
 else:base=(.44,.18,.12)
 tip=smooth(.20,.48,abs(z))
 return (*mix(base,(.035,.055,.09),tip*.30),.52)

def fin(name,root,outline,rays=12):
 verts=[root];faces=[]
 for k in range(rays+1):
  u=k/rays*(len(outline)-1);a=min(len(outline)-2,int(u));f=u-a
  tip=tuple(cubic(outline[max(0,a-1)][d],outline[a][d],outline[a+1][d],outline[min(len(outline)-1,a+2)][d],f) for d in range(3))
  verts.append(tip)
  points=[tuple(root[d]*(1-t)+tip[d]*t for d in range(3)) for t in (0,.32,.65,1)]
  tube(name+' ray %02d'%k,points,.0013,raymat,1,lambda p:(*fin_color(p)[:3],.82))
 for k in range(rays):faces.append((0,k+1,k+2))
 return mesh_obj(name,verts,faces,membrane,1,fin_color)

profile_top=C['profile'][4][0]
dorsal_rise={'clown':.11,'yellow-tang':.17,'blue-tang':.14,'moorish-idol':.21,'dwarf-hawkfish':.095}[SPECIES]
anal_drop={'clown':.10,'yellow-tang':.16,'blue-tang':.13,'moorish-idol':.18,'dwarf-hawkfish':.075}[SPECIES]
tail_span={'clown':.18,'yellow-tang':.23,'blue-tang':.25,'moorish-idol':.17,'dwarf-hawkfish':.13}[SPECIES]
fin('dorsal sail',(0,0,profile_top*.78),[(.37,0,profile_top+.025),(.19,0,profile_top+dorsal_rise),(-.08,0,profile_top+dorsal_rise*1.15),(-.40,0,profile_top+dorsal_rise*.77),(-.65,0,.08)],18)
fin('anal sail',(-.13,0,-profile_top*.68),[(.14,0,-profile_top-.025),(-.11,0,-profile_top-anal_drop),(-.39,0,-profile_top-anal_drop*.83),(-.67,0,-.08)],14)
fin('caudal fan',(C['tail']+.06,0,0),[(C['tail']-.24,0,tail_span),(C['tail']-.19,0,tail_span*.52),(C['tail']-.11,0,0),(C['tail']-.19,0,-tail_span*.52),(C['tail']-.24,0,-tail_span)],18)
for side in (-1,1):
 fin('pectoral '+str(side),(.23,side*.11,-.06),[(.10,side*.27,-.15),(-.18,side*.20,-.21),(-.09,side*.11,-.10)],10)
 fin('pelvic '+str(side),(-.04,side*.06,-profile_top*.7),[(-.16,side*.12,-profile_top-.14),(-.29,side*.08,-profile_top-.03)],7)
if SPECIES=='moorish-idol':
 banner=mat('ivory dorsal pennant',(.93,.93,.86),alpha=.82,rough=.30)
 controls=[(.21,.64,.12),(.08,.91,.075),(-.13,1.09,.045),(-.39,1.13,.026),(-.68,1.02,.014),(-.91,.94,.005)]
 path=[]
 for k in range((len(controls)-1)*8+1):
  u=k/8;a=min(len(controls)-2,int(u));f=u-a
  path.append(tuple(cubic(controls[max(0,a-1)][d],controls[a][d],controls[a+1][d],controls[min(len(controls)-1,a+2)][d],f) for d in range(3)))
 pennant_vertices=[];pennant_faces=[]
 for x,z,width in path:pennant_vertices.extend([(x,0,z),(x,0,z-width)])
 for k in range(len(path)-1):pennant_faces.append((2*k,2*k+1,2*k+3,2*k+2))
 mesh_obj('narrow trailing dorsal pennant',pennant_vertices,pennant_faces,banner,1,lambda p:(.93,.93,.86,.82))
 tube('pennant leading edge',[(x,0,z) for x,z,_ in path],.004,banner,1)
 for side in (-1,1):
  tube('supraorbital horn '+str(side),[(.49,side*.07,.20),(.53,side*.075,.25),(.51,side*.08,.29)],.008,lip)
if SPECIES=='dwarf-hawkfish':
 spine=mat('reddish dorsal cirri',(.37,.10,.073),rough=.49)
 for k in range(10):
  x=.34-k*.105;h=dimensions(x)[0]
  tube('dorsal cirrus %02d'%k,[(x,0,h*.95),(x-.018,0,h+.055),(x-.032,0,h+.082)],.004,spine,1)
 for side in (-1,1):
  for k in range(6):
   tube('free lower pectoral ray %d %d'%(side,k),[(.12-k*.035,side*.10,-.06),(-.03-k*.04,side*.19,-.14),(-.19-k*.025,side*.25,-.19)],.0025,spine,1)

def sphere(name,loc,scale,material,kind=2):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16,location=loc)
 obj=bpy.context.object;obj.name=name;obj.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 obj.data.materials.append(material)
 for p in obj.data.polygons:p.use_smooth=True
 obj['surface_kind']=kind;objects.append(obj);return obj
eye_x=C['eye'];_,eye_w=dimensions(eye_x);eye_z=.18 if SPECIES=='moorish-idol' else .088 if SPECIES=='dwarf-hawkfish' else .074
for side in (-1,1):
 sphere('iris '+str(side),(eye_x,side*(eye_w-.006),eye_z),(.037,.014,.040),iris)
 sphere('pupil '+str(side),(eye_x+.006,side*(eye_w+.006),eye_z+.002),(.025,.010,.028),black)
 sphere('catchlight '+str(side),(eye_x+.017,side*(eye_w+.015),eye_z+.012),(.005,.003,.006),mat('white catchlight '+str(side),(.89,.96,.99),rough=.13))
 tube('operculum seam '+str(side),[(.31-.10*math.cos(a),side*(dimensions(.31)[1]+.003),.04+.20*math.sin(a)) for a in [-1.2+i*2.4/18 for i in range(19)]],.003,lip)
tube('upper terminal lip',[(C['nose']-.026,-.024,-.018),(C['nose']+.007,0,-.020),(C['nose']-.026,.024,-.018)],.004,lip)

def export(lod=False):
 opaque=[];fins=[];bpy.context.view_layer.update()
 for obj in objects:
  if lod and ' ray ' in obj.name and int(obj.name.rsplit(' ',1)[1])%2:continue
  dec=None;ev=None
  if lod and (obj==body or obj['surface_kind']==2):
   dec=obj.modifiers.new('runtime LOD','DECIMATE');dec.ratio=.28 if obj==body else .35
   dg=bpy.context.evaluated_depsgraph_get();ev=obj.evaluated_get(dg)
   data=ev.to_mesh(preserve_all_data_layers=True,depsgraph=dg)
  else:data=obj.data
  data.calc_loop_triangles();colors=data.color_attributes.get('Color')
  transform=obj.matrix_world;norms=transform.to_3x3().inverted().transposed()
  dst=fins if obj['surface_kind']==1 else opaque
  for tri in data.loop_triangles:
   for index in tri.vertices:
    v=data.vertices[index];p=transform@v.co;n=(norms@v.normal).normalized()
    c=colors.data[index].color[:] if colors else data.materials[0].diffuse_color[:]
    dst.extend([p.x,p.z,-p.y,n.x,n.z,-n.y,*c,float(obj['surface_kind'])])
  if ev:ev.to_mesh_clear()
  if dec:obj.modifiers.remove(dec)
 values=opaque+fins
 (DEST/(SPECIES+('.lod.bin' if lod else '.mesh.bin'))).write_bytes(struct.pack('<%sf'%len(values),*values))
 return {'opaqueVertices':len(opaque)//11,'finVertices':len(fins)//11,'binary':SPECIES+('.lod.bin' if lod else '.mesh.bin')}

full=export();lod=export(True)
meta={'version':1,'generator':'Blender '+bpy.app.version_string,'stride':11,'length':C['nose']-C['tail']+.37,
 'species':C['name'],'originalAsset':True,'coordinates':'+X head, +Y dorsal, +Z lateral',**full,'lod':lod}
(DEST/(SPECIES+'.mesh.json')).write_text(json.dumps(meta,indent=2),encoding='utf-8')

# Editable tail strokes in the source blend; the runtime animates them smoothly.
for obj in objects:
 if obj['surface_kind']==2:continue
 obj.shape_key_add(name='Basis')
 for label,sign in [('tail-left',1),('tail-right',-1)]:
  key=obj.shape_key_add(name=label)
  for i,v in enumerate(obj.data.vertices):
   bend=max(0,min(1,(.3-v.co.x)/1.25))**2
   key.data[i].co.y+=sign*.16*bend
  for frame,value in [(1,0),(7,1 if sign==1 else 0),(13,0),(19,1 if sign==-1 else 0),(25,0)]:
   key.value=value;key.keyframe_insert(data_path='value',frame=frame)
  key.value=0
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=24;scene.render.fps=30;scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(DEST/(SPECIES+'.glb')),use_selection=True,export_format='GLB',export_animations=False,export_morph=False)

world=bpy.data.worlds.new('Tropical reef studio');world.use_nodes=True;scene.world=world
background=next((n for n in world.node_tree.nodes if n.bl_idname=='ShaderNodeBackground'),None) or world.node_tree.nodes.new('ShaderNodeBackground')
world_output=next((n for n in world.node_tree.nodes if n.bl_idname=='ShaderNodeOutputWorld'),None) or world.node_tree.nodes.new('ShaderNodeOutputWorld')
world.node_tree.links.new(background.outputs['Background'],world_output.inputs['Surface'])
background.inputs['Color'].default_value=(.014,.08,.22,1)
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,color,size in [('surface',(0,-2,3),280,(.40,.75,1),3),('left rim',(-2,1,2),185,(.18,.58,1),2.5),('warm fill',(1,-3,0),85,(1,.76,.38),2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.color=color;light.data.shape='DISK';light.data.size=size;aim(light,(0,0,0))
bpy.ops.object.camera_add(location=(1,-4.4,.9));cam=bpy.context.object;aim(cam,(-.1,0,0));cam.data.type='ORTHO';cam.data.ortho_scale=3.25 if SPECIES=='moorish-idol' else 2.65;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=18;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/('coral-'+SPECIES+'.blend')))
scene.render.filepath=str(ART/('blender-'+SPECIES+'.png'));bpy.ops.render.render(write_still=True)
print('AQUAPAPER_CORAL_MODEL',json.dumps(meta))
