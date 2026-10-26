"""Slim a rigged, animated character for the web/Quest without losing its texture detail.

Run headless:
  blender --background --python scripts/assets/blender-slim.py -- <in.glb> <out.glb> <target_triangles> <texture_px>

Steps: import -> duplicate the skinned mesh -> decimate the copy (vertex groups/skin
weights are kept) -> fresh smart-UV layout -> Cycles "selected to active" bake of the
high-poly base color onto the low-poly copy -> delete the high-poly -> export GLB with
every animation action.
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, out, target_tris, tex_px = argv[0], argv[1], int(argv[2]), int(argv[3])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene

meshes = [o for o in scene.objects if o.type == "MESH"]
hi = max(meshes, key=lambda o: len(o.data.polygons))
arm = next((o for o in scene.objects if o.type == "ARMATURE"), None)
if arm:
    arm.data.pose_position = "REST"  # bake in the bind pose

# Low-poly copy.
bpy.ops.object.select_all(action="DESELECT")
hi.select_set(True)
bpy.context.view_layer.objects.active = hi
bpy.ops.object.duplicate()
lo = bpy.context.active_object
lo.name = "bigfoot"
# Generated meshes are seam-split and spiky (fur); rebuild a clean, closed, smooth
# surface with the voxel remesher. Skin weights are transferred back afterwards.
for m in list(lo.modifiers):
    lo.modifiers.remove(m)
lo.vertex_groups.clear()
rem = lo.modifiers.new("remesh", "REMESH")
rem.mode = "VOXEL"
rem.voxel_size = max(lo.dimensions) / 150
rem.adaptivity = 0.0
bpy.ops.object.modifier_apply(modifier="remesh")
bpy.ops.object.shade_smooth()
tris = sum(len(p.vertices) - 2 for p in lo.data.polygons)
dec = lo.modifiers.new("slim", "DECIMATE")
dec.ratio = min(1.0, target_tris / max(tris, 1))
dec.use_collapse_triangulate = True
bpy.ops.object.modifier_move_to_index(modifier="slim", index=0)
bpy.ops.object.modifier_apply(modifier="slim")
# Skin weights from the original (nearest surface, interpolated), then re-skin.
dt = lo.modifiers.new("weights", "DATA_TRANSFER")
dt.object = hi
dt.use_vert_data = True
dt.data_types_verts = {"VGROUP_WEIGHTS"}
dt.vert_mapping = "POLYINTERP_NEAREST"
dt.layers_vgroup_select_src = "ALL"
dt.layers_vgroup_select_dst = "NAME"
bpy.ops.object.datalayout_transfer(modifier="weights")
bpy.ops.object.modifier_apply(modifier="weights")
if arm:
    skin = lo.modifiers.new("Armature", "ARMATURE")
    skin.object = arm
print(f"[slim] triangles {tris} -> {sum(len(p.vertices) - 2 for p in lo.data.polygons)}")

# Fresh UV layout for the low-poly copy only.
for uv in list(lo.data.uv_layers):
    lo.data.uv_layers.remove(uv)
lo.data.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.003)
bpy.ops.object.mode_set(mode="OBJECT")

# Material with the image the bake writes into.
img = bpy.data.images.new("bigfoot_color", tex_px, tex_px)
mat = bpy.data.materials.new("bigfoot")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes["Principled BSDF"]
tex = nodes.new("ShaderNodeTexImage")
tex.image = img
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.85
nodes.active = tex
lo.data.materials.clear()
lo.data.materials.append(mat)

# Bake high-poly color onto the low-poly copy.
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 1
bake = scene.render.bake
bake.use_selected_to_active = True
height = max(hi.dimensions)
bake.cage_extrusion = 0.02 * height
bake.max_ray_distance = 0.06 * height
bake.margin = 8
bpy.ops.object.select_all(action="DESELECT")
hi.select_set(True)
lo.select_set(True)
bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
png = os.path.splitext(out)[0] + "_color.png"
img.filepath_raw = png
img.file_format = "PNG"
img.save()
img.pack()
print(f"[slim] baked {tex_px}px -> {png}")

bpy.data.objects.remove(hi, do_unlink=True)
if arm:
    arm.data.pose_position = "POSE"
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
    export_yup=True,
)
print(f"[slim] wrote {out}")
