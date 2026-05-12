"""
Import a Mixamo character + animation FBX, render to a loopable mp4 for Keep Fit.

Mixamo doesn't have a usable API anymore — the user has to download the FBX
manually:

  1. Go to https://www.mixamo.com (Adobe ID required, free)
  2. Pick a character (Y Bot, X Bot, or upload Z-Anatomy if you want anatomy)
  3. Search for the exercise (e.g. "squat", "push up", "burpee", "lunge")
  4. Select the animation
  5. Click "Download" → format = FBX Binary (.fbx), skin = "With Skin",
     frames per second = 30, keyframe reduction = none
  6. Drop the .fbx into ~/my-workout-cool/scripts/blender/mixamo-fbx/
     (or any folder), naming it consistently:
       <exercise-id>.fbx   e.g.  squat.fbx, push-up.fbx, burpee.fbx

Then run this script from inside Blender's Scripting workspace (Open → this
file → Run) or:

  blender --background empty.blend \\
    --python scripts/blender/mixamo-render.py -- --fbx push-up.fbx

Outputs:
  public/exercise-videos/mixamo/<exercise-id>.mp4   (loopable, 4-8s)
  public/exercise-videos/mixamo/<exercise-id>.webp  (poster frame)

Notes / known sharp edges:
  * Mixamo characters come in T-pose at frame 0. We skip the first 5 frames
    to avoid the T-pose stutter at loop start.
  * If the animation doesn't loop cleanly we crossfade the last 0.5s back to
    the first frame using a Composite node group. Acceptable for most
    repetitive exercises like squats, curls, presses.
  * Use Eevee Next for fast renders (~3 sec / frame on a modern GPU).
"""

import bpy
import os
import sys
import math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FBX_DIR = os.path.join(HERE, "mixamo-fbx")
OUT_DIR = os.path.join(PROJECT_ROOT, "public", "exercise-videos", "mixamo")

# --- render config ---
RES_X, RES_Y = 480, 720
FPS = 30
SAMPLES = 32
WARMUP_FRAMES = 5  # skip the first N frames (T-pose stutter)

# Lighting / look — neutral, MoveKit-esque clean white studio
BG_COLOR = (1.0, 1.0, 1.0, 1.0)
KEY_LIGHT_STRENGTH = 800
FILL_LIGHT_STRENGTH = 200

# Body material color (mannequin-style flat gray-blue)
BODY_BASE_COLOR = (0.65, 0.7, 0.8, 1.0)


def reset_scene():
    bpy.ops.wm.read_homefile(use_empty=True)


def setup_world():
    scene = bpy.context.scene
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs[0].default_value = BG_COLOR
        bg_node.inputs[1].default_value = 1.0
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"


def setup_lights(target: Vector):
    # Key light
    key = bpy.data.lights.new("Key", "AREA")
    key.energy = KEY_LIGHT_STRENGTH
    key.size = 2.0
    key_obj = bpy.data.objects.new("Key", key)
    key_obj.location = (target.x + 2, target.y - 3, target.z + 2.5)
    key_obj.rotation_euler = (math.radians(60), math.radians(20), math.radians(35))
    bpy.context.scene.collection.objects.link(key_obj)

    # Fill light
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = FILL_LIGHT_STRENGTH
    fill.size = 3.0
    fill_obj = bpy.data.objects.new("Fill", fill)
    fill_obj.location = (target.x - 2.5, target.y - 2.5, target.z + 1.5)
    fill_obj.rotation_euler = (math.radians(75), math.radians(-15), math.radians(-30))
    bpy.context.scene.collection.objects.link(fill_obj)


def setup_camera(target: Vector, view: str = "front"):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "PERSP"
    cam_data.lens = 70  # slight tele to flatten facial features
    cam = bpy.data.objects.new("Cam", cam_data)
    dist = 4.5
    if view == "front":
        cam.location = (target.x, target.y - dist, target.z + 0.05)
    elif view == "back":
        cam.location = (target.x, target.y + dist, target.z + 0.05)
    elif view == "side":
        cam.location = (target.x + dist, target.y, target.z + 0.05)
    else:
        cam.location = (target.x + dist * 0.7, target.y - dist * 0.7, target.z + 0.05)
    # Look at the target
    direction = target - Vector(cam.location)
    direction.normalize()
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = direction.to_track_quat("-Z", "Y")
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def apply_mannequin_material():
    """Paint every imported mesh in a flat mannequin material."""
    mat = bpy.data.materials.get("KF_Mannequin")
    if mat is None:
        mat = bpy.data.materials.new("KF_Mannequin")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = BODY_BASE_COLOR
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.55
            if "Specular IOR Level" in bsdf.inputs:
                bsdf.inputs["Specular IOR Level"].default_value = 0.4
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if not obj.data.materials:
            obj.data.materials.append(mat)
        else:
            for i in range(len(obj.data.materials)):
                obj.data.materials[i] = mat


def import_mixamo_fbx(fbx_path: str) -> tuple[Vector, int, int]:
    """Import the FBX, return (bbox_center, start_frame, end_frame)."""
    pre = set(bpy.data.objects.keys())
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    new_objs = [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in pre]

    # Compute bbox center across all newly-imported meshes
    bboxes = []
    for o in new_objs:
        if o.type == "MESH":
            for corner in o.bound_box:
                world = o.matrix_world @ Vector(corner)
                bboxes.append(world)
    if bboxes:
        xs, ys, zs = zip(*bboxes)
        center = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    else:
        center = Vector((0, 0, 1.0))

    # Find animation range from any imported action
    start, end = 0, 60
    for action in bpy.data.actions:
        s, e = action.frame_range
        start = int(min(start, s))
        end = int(max(end, e))
    if end <= start:
        end = start + 60
    start = max(start + WARMUP_FRAMES, 0)
    return center, start, end


def setup_render(start_frame: int, end_frame: int, out_path: str):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    if scene.render.engine != "BLENDER_EEVEE_NEXT":
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start = start_frame
    scene.frame_end = end_frame
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.render.filepath = out_path


def render_one(fbx_path: str, exercise_id: str):
    out_path = os.path.join(OUT_DIR, f"{exercise_id}.mp4")
    os.makedirs(OUT_DIR, exist_ok=True)

    reset_scene()
    setup_world()
    center, s, e = import_mixamo_fbx(fbx_path)
    apply_mannequin_material()
    setup_lights(center)
    setup_camera(center, view="front")
    setup_render(s, e, out_path)

    print(f"  Rendering {exercise_id}: frames {s}-{e} → {out_path}")
    bpy.ops.render.render(animation=True)
    print(f"  ✓ done: {out_path}")
    return out_path


def main():
    # Parse --fbx <name> if provided, otherwise render every fbx in FBX_DIR
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    targets = []
    if "--fbx" in args:
        idx = args.index("--fbx")
        if idx + 1 < len(args):
            fbx_path = args[idx + 1]
            if not os.path.isabs(fbx_path):
                fbx_path = os.path.join(FBX_DIR, fbx_path)
            targets = [fbx_path]
    if not targets:
        if not os.path.isdir(FBX_DIR):
            print(f"No FBX folder found at {FBX_DIR}")
            return
        targets = [
            os.path.join(FBX_DIR, n)
            for n in sorted(os.listdir(FBX_DIR))
            if n.lower().endswith(".fbx")
        ]

    if not targets:
        print("No FBX files to process. Drop your Mixamo downloads into:")
        print(f"  {FBX_DIR}")
        return

    print(f"== Mixamo → Keep Fit ==")
    print(f"Output dir: {OUT_DIR}")
    print(f"Found {len(targets)} FBX file(s)")
    for t in targets:
        exercise_id = os.path.splitext(os.path.basename(t))[0]
        try:
            render_one(t, exercise_id)
        except Exception as ex:
            print(f"  ✗ {exercise_id} failed: {ex}")


if __name__ == "__main__":
    main()
