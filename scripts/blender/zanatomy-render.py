"""
Render muscle-highlight PNGs from Z-Anatomy for Keep Fit.

Outputs (to public/muscle-anatomy/, 36 PNGs total + 34 transparent overlays):
  base-{front,back}.png             — gray full body
  <group>-{front,back}.png          — full body with one group highlighted in red
  <group>-{front,back}-overlay.png  — red-only mask of one group on transparent bg

Usage (from inside the Blender that has Z-Anatomy/Startup.blend opened):
  In Blender's Scripting workspace, paste this file and run.
  Or, via CLI:
      blender Startup.blend --python scripts/blender/zanatomy-render.py

Inputs needed in repo:
  scripts/blender/zanatomy-muscle-map.json — produced once via the helper
                                             discover_mapping() below.

Tested against Z-Anatomy 0.9.9 / Blender 5.1.

License notes:
  Z-Anatomy data: CC-BY-SA 4.0 © Lluís Vinent Juanico
  Generated PNGs inherit CC-BY-SA. Credit Z-Anatomy when shipping.
"""

import bpy
import os
import json
import math
from mathutils import Vector

# --- paths (relative to project root, two levels above this file) ---
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MAP_PATH = os.path.join(HERE, "zanatomy-muscle-map.json")
OUT_DIR = os.path.join(PROJECT_ROOT, "public", "muscle-anatomy")

# Render config
RES_X, RES_Y = 400, 600
BODY_HEIGHT = 1.85  # metres; size of the bbox we frame the camera around
LENS_MM = 50  # used only as a fallback for legacy perspective mode
ORTHO_SCALE = 1.85  # vertical extent of orthographic camera; matches body height
USE_ORTHOGRAPHIC = True  # ortho avoids the foreshortening that made calves look stubby

# Outer skull bones to keep visible (Z-Anatomy splits the cranium into many
# pieces — these are the ones with a real silhouette contribution).
SKULL_BONE_PATTERNS = [
    "Frontal bone", "Parietal bone", "Occipital bone", "Temporal bone",
    "Nasal bone", "Zygomatic bone", "Maxilla", "Mandible",
]

# 17 muscle keys → list of Z-Anatomy mesh basenames (resolved into .l/.r at runtime)
CURATED = {
    "abdominals": [
        "Rectus abdominis muscle",
        "External abdominal oblique muscle",
        "Internal abdominal oblique muscle",
        "Transversus abdominis muscle",
    ],
    "abductors": ["Gluteus medius muscle", "Gluteus minimus muscle", "Tensor fasciae latae"],
    "adductors": [
        "Adductor longus", "Adductor brevis", "Adductor magnus",
        "Gracilis muscle", "Pectineus muscle",
    ],
    "biceps": ["Long head of biceps brachii", "Short head of biceps brachii"],
    "calves": [
        "Lateral head of gastrocnemius", "Medial head of gastrocnemius",
        "Soleus muscle",
    ],
    "chest": [
        "Pectoralis major muscle", "Pectoralis minor muscle",
        "Clavicular head of pectoralis major muscle",
        "Sternocostal head of pectoralis major muscle",
    ],
    "forearms": [
        "Brachioradialis muscle",
        "Flexor carpi radialis", "Flexor carpi ulnaris", "Flexor digitorum superficialis",
        "Extensor carpi radialis brevis", "Extensor carpi radialis longus", "Extensor carpi ulnaris",
        "Extensor digitorum",
        "Pronator teres", "Pronator quadratus", "Supinator", "Palmaris longus",
    ],
    "glutes": ["Gluteus maximus muscle"],
    "hamstrings": [
        "Long head of biceps femoris", "Short head of biceps femoris",
        "Semimembranosus muscle", "Semitendinosus muscle",
    ],
    "lats": ["Latissimus dorsi muscle", "Teres major muscle"],
    "lower back": [
        "Quadratus lumborum", "Multifidus lumborum muscle",
        "Iliocostalis lumborum", "Longissimus thoracis",
    ],
    "middle back": [
        "Rhomboid major muscle", "Rhomboid minor muscle",
        "Infraspinatus muscle", "Teres minor muscle",
    ],
    "neck": [
        "Sternocleidomastoid muscle",
        "Splenius capitis muscle", "Splenius colli muscle",
    ],
    "quadriceps": [
        "Rectus femoris muscle",
        "Vastus lateralis muscle", "Vastus medialis muscle", "Vastus intermedius muscle",
        "Sartorius muscle",
    ],
    "shoulders": [
        "Acromial part of deltoid muscle",
        "Clavicular part of deltoid muscle",
        "Spinal part of deltoid muscle",
    ],
    "traps": [
        "Ascending part of trapezius muscle",
        "Descending part of trapezius muscle",
        "Transverse part of trapezius muscle",
    ],
    "triceps": [
        "Lateral head of triceps brachii",
        "Long head of triceps brachii",
        "Medial head of triceps brachii",
    ],
}

# Connective tissue keywords to hide (fascia covers muscles, breaks the highlight)
HIDE_KEYWORDS = [
    "fascia", "septum", "retinaculum", "aponeurosis", "sheath", "bursa",
    "compartment", "tendon", "ligament",
]

# ---------------------------------------------------------------------------

def get_muscular_collection():
    for c in bpy.context.scene.collection.children:
        if c.name.startswith("4:") and "muscular" in c.name.lower():
            return c
    raise RuntimeError("Couldn't find '4: Muscular system' collection")

def get_skeletal_collection():
    """Z-Anatomy ships skeletal as collection 1: ..."""
    for c in bpy.context.scene.collection.children:
        if c.name.startswith("1:") and "skeletal" in c.name.lower():
            return c
    return None

def all_objects_in(collection):
    """Recursive walk: Z-Anatomy nests `Skull` etc. under `1: Skeletal system`."""
    seen = []
    if collection is None:
        return seen
    for o in collection.objects:
        seen.append(o)
    for ch in collection.children:
        seen.extend(all_objects_in(ch))
    return seen

def is_outer_skull_bone(name: str) -> bool:
    """Match the bones that form the visible outer skull silhouette."""
    nl = name.lower()
    # the patterns include "Mandible" / "Maxilla" / "Frontal bone" etc; allow
    # both ".l/.r" suffixed copies and unsuffixed singletons (Frontal/Occipital).
    for p in SKULL_BONE_PATTERNS:
        if nl.startswith(p.lower()):
            return True
    return False

def get_or_create_material(name, rgba):
    if name in bpy.data.materials:
        m = bpy.data.materials[name]
    else:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = rgba
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.7
    return m

def discover_mapping():
    """Build the resolved map by searching the loaded blendfile for known names."""
    muscular = get_muscular_collection()
    all_objs = {o.name: o for o in muscular.objects}
    resolved, unresolved = {}, {}
    for key, patterns in CURATED.items():
        matched, misses = [], []
        for p in patterns:
            found = []
            for suffix in [".l", ".r"]:
                cand = f"{p}{suffix}"
                obj = all_objs.get(cand)
                if obj and obj.type == "MESH" and len(obj.data.vertices) > 5:
                    found.append(cand)
            if found:
                matched.extend(found)
            else:
                misses.append(p)
        resolved[key] = sorted(set(matched))
        if misses:
            unresolved[key] = misses
    return {"resolved": resolved, "unresolved": unresolved}

def load_or_build_mapping():
    if os.path.exists(MAP_PATH):
        with open(MAP_PATH) as f:
            return json.load(f)
    mapping = discover_mapping()
    os.makedirs(os.path.dirname(MAP_PATH), exist_ok=True)
    with open(MAP_PATH, "w") as f:
        json.dump(mapping, f, indent=2)
    return mapping

def setup_scene():
    """One-time scene setup: hide non-muscle collections + connective tissue,
    set up cameras, materials, render settings."""
    scene = bpy.context.scene

    # Show muscular (4:) and skeletal (1:) — skeletal is needed for the skull
    # silhouette so the head doesn't look chopped off. Hide the rest.
    for c in scene.collection.children:
        if c.name.startswith("4:") or c.name.startswith("1:"):
            c.hide_viewport = False
            c.hide_render = False
        else:
            c.hide_viewport = True
            c.hide_render = True

    # Force the layer-collection visibility too
    def _force_show_in_view_layer(layer_coll, target_name):
        if layer_coll.name == target_name:
            layer_coll.hide_viewport = False
            layer_coll.exclude = False
            return True
        for ch in layer_coll.children:
            if _force_show_in_view_layer(ch, target_name):
                return True
        return False
    muscular = get_muscular_collection()
    skeletal = get_skeletal_collection()
    _force_show_in_view_layer(scene.view_layers[0].layer_collection, muscular.name)
    if skeletal is not None:
        _force_show_in_view_layer(scene.view_layers[0].layer_collection, skeletal.name)

    # Hide connective tissue inside muscular system
    for o in muscular.objects:
        if o.type != "MESH":
            o.hide_viewport = True
            o.hide_render = True
            continue
        nl = o.name.lower()
        if any(k in nl for k in HIDE_KEYWORDS):
            o.hide_viewport = True
            o.hide_render = True
        else:
            o.hide_viewport = False
            o.hide_render = False

    # Hide any UI font/text objects still loitering
    for o in bpy.data.objects:
        if o.type == "FONT" or o.name.startswith("HOW"):
            o.hide_viewport = True
            o.hide_render = True

    # Disable Freestyle (it draws outline-only otherwise)
    scene.render.use_freestyle = False

    # Materials
    mat_gray = get_or_create_material("ZA_GRAY", (0.7, 0.7, 0.7, 1.0))
    mat_red = get_or_create_material("ZA_RED", (0.9, 0.15, 0.15, 1.0))
    mat_bone = get_or_create_material("ZA_BONE", (0.92, 0.90, 0.84, 1.0))

    # Default-paint every muscle gray
    for o in muscular.objects:
        if o.type != "MESH" or not (o.name.endswith(".l") or o.name.endswith(".r")):
            continue
        if not o.data.materials:
            o.data.materials.append(mat_gray)
        else:
            o.data.materials[0] = mat_gray

    # Skeletal: hide everything except the outer skull bones, and paint those
    # in bone-tone so the head silhouette completes the body.
    if skeletal is not None:
        # Make sure every nested sub-collection is visible at the layer level
        # (Z-Anatomy ships them collapsed/excluded by default).
        def _unhide_all(layer_coll):
            layer_coll.exclude = False
            layer_coll.hide_viewport = False
            for ch in layer_coll.children:
                _unhide_all(ch)
        for top in scene.view_layers[0].layer_collection.children:
            if top.name == skeletal.name:
                _unhide_all(top)
                break
        for sub in skeletal.children_recursive if hasattr(skeletal, "children_recursive") else skeletal.children:
            sub.hide_viewport = False
            sub.hide_render = False

        kept = 0
        hidden = 0
        for o in all_objects_in(skeletal):
            if o.type != "MESH":
                o.hide_viewport = True
                o.hide_render = True
                continue
            if is_outer_skull_bone(o.name):
                o.hide_viewport = False
                o.hide_render = False
                if not o.data.materials:
                    o.data.materials.append(mat_bone)
                else:
                    o.data.materials[0] = mat_bone
                kept += 1
            else:
                o.hide_viewport = True
                o.hide_render = True
                hidden += 1
        print(f"  skeletal: kept {kept} skull bones, hid {hidden} other bones")

    # Cameras: front (-Y direction) and back (+Y direction).
    # We anchor the camera on the spine (X = 0), NOT on the bbox center —
    # the model's arms are outstretched, so the bbox is offset from the body
    # midline and would put the figure off-center.
    target = Vector((0.0, 0.0, BODY_HEIGHT / 2))
    fov_v = 2 * math.atan(36 / (2 * LENS_MM))
    dist = (BODY_HEIGHT * 0.55) / math.tan(fov_v / 2)

    def make_or_update_cam(name, location, look_at):
        cam = bpy.data.objects.get(name)
        if cam is None:
            cam_data = bpy.data.cameras.new(name + "_data")
            cam = bpy.data.objects.new(name, cam_data)
            bpy.context.scene.collection.objects.link(cam)
        cam.location = location
        direction = Vector(look_at) - Vector(location)
        direction.normalize()
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = direction.to_track_quat("-Z", "Y")
        # Orthographic projection — no foreshortening, no calf-shrinking, no
        # disproportionately-large head/torso when the camera gets too close.
        if USE_ORTHOGRAPHIC:
            cam.data.type = "ORTHO"
            cam.data.ortho_scale = ORTHO_SCALE
        else:
            cam.data.type = "PERSP"
            cam.data.lens = LENS_MM
        cam.data.clip_start = 0.1
        cam.data.clip_end = 100
        cam.show_name = False
        return cam

    front_cam = make_or_update_cam("ZA_FrontCam", (0.0, target.y - dist, target.z), target)
    back_cam = make_or_update_cam("ZA_BackCam", (0.0, target.y + dist, target.z), target)

    # Render settings — Workbench (fast, ignores complex shaders) via OpenGL
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.light = "STUDIO"
    scene.render.film_transparent = True
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    return front_cam, back_cam, mat_gray, mat_red, mat_bone

def render_via_viewport(camera, output_path):
    """Render through the 3D viewport's OpenGL pipeline. Direct
    bpy.ops.render.render() on this Z-Anatomy file produces empty images for
    reasons we never fully diagnosed; OpenGL render works reliably."""
    scene = bpy.context.scene
    scene.camera = camera
    bpy.context.view_layer.update()
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != "VIEW_3D":
                continue
            for region in area.regions:
                if region.type != "WINDOW":
                    continue
                space = area.spaces.active
                space.shading.type = "SOLID"
                space.shading.color_type = "MATERIAL"
                space.shading.light = "STUDIO"
                space.camera = camera
                space.region_3d.view_perspective = "CAMERA"
                override = {
                    "window": window, "screen": window.screen,
                    "area": area, "region": region, "scene": scene,
                }
                scene.render.filepath = output_path
                with bpy.context.temp_override(**override):
                    bpy.ops.render.opengl(write_still=True)
                return os.path.getsize(output_path) if os.path.exists(output_path) else 0
    return 0

def render_full_body_passes(resolved, front_cam, back_cam, mat_gray, mat_red):
    """Pass 1: full body (gray) + one muscle highlighted in red, all visible."""
    muscular = get_muscular_collection()
    muscle_objs = [
        o for o in muscular.objects
        if o.type == "MESH" and (o.name.endswith(".l") or o.name.endswith(".r"))
    ]

    def reset_all():
        for o in muscle_objs:
            o.hide_render = False
            o.hide_viewport = False
            if o.data.materials and o.data.materials[0] != mat_gray:
                o.data.materials[0] = mat_gray

    # Base
    reset_all()
    render_via_viewport(front_cam, os.path.join(OUT_DIR, "base-front.png"))
    render_via_viewport(back_cam, os.path.join(OUT_DIR, "base-back.png"))
    print("  base done")

    # Per-muscle
    for key, mesh_names in resolved.items():
        reset_all()
        for n in mesh_names:
            obj = bpy.data.objects.get(n)
            if obj and obj.data.materials:
                obj.data.materials[0] = mat_red
        slug = key.replace(" ", "_")
        render_via_viewport(front_cam, os.path.join(OUT_DIR, f"{slug}-front.png"))
        render_via_viewport(back_cam, os.path.join(OUT_DIR, f"{slug}-back.png"))
        print(f"  {key} (full): done")

def render_overlay_passes(resolved, front_cam, back_cam, mat_red):
    """Pass 2: ONLY the target muscle visible, rest hidden, transparent bg.

    Skull bones are also hidden during overlay passes — the base PNG already
    contains the head silhouette, so re-rendering it here would double up.
    """
    muscular = get_muscular_collection()
    skeletal = get_skeletal_collection()
    muscle_objs = [
        o for o in muscular.objects
        if o.type == "MESH" and (o.name.endswith(".l") or o.name.endswith(".r"))
    ]
    skull_objs = []
    if skeletal is not None:
        skull_objs = [
            o for o in all_objects_in(skeletal)
            if o.type == "MESH" and is_outer_skull_bone(o.name)
        ]

    # Hide the skull during overlays and restore at the end.
    saved_skull_state = [(o, o.hide_render, o.hide_viewport) for o in skull_objs]
    for o in skull_objs:
        o.hide_render = True
        o.hide_viewport = True

    def hide_all():
        for o in muscle_objs:
            o.hide_render = True
            o.hide_viewport = True

    for key, mesh_names in resolved.items():
        hide_all()
        for n in mesh_names:
            obj = bpy.data.objects.get(n)
            if obj is None:
                continue
            obj.hide_render = False
            obj.hide_viewport = False
            if obj.data.materials:
                obj.data.materials[0] = mat_red
            else:
                obj.data.materials.append(mat_red)
        slug = key.replace(" ", "_")
        render_via_viewport(front_cam, os.path.join(OUT_DIR, f"{slug}-front-overlay.png"))
        render_via_viewport(back_cam, os.path.join(OUT_DIR, f"{slug}-back-overlay.png"))
        print(f"  {key} (overlay): done")

    # Restore skull visibility for any subsequent operations.
    for o, hr, hv in saved_skull_state:
        o.hide_render = hr
        o.hide_viewport = hv

# ---------------------------------------------------------------------------

def main():
    print(f"== Z-Anatomy → Keep Fit muscle PNGs ==")
    print(f"Output dir: {OUT_DIR}")
    os.makedirs(OUT_DIR, exist_ok=True)

    front_cam, back_cam, mat_gray, mat_red, mat_bone = setup_scene()
    mapping = load_or_build_mapping()
    resolved = mapping["resolved"]
    print(f"Resolved {len(resolved)} muscle groups")

    print("\n[1/2] Full-body renders (gray + one muscle red)…")
    render_full_body_passes(resolved, front_cam, back_cam, mat_gray, mat_red)

    print("\n[2/2] Transparent overlays (one muscle in red, rest hidden)…")
    render_overlay_passes(resolved, front_cam, back_cam, mat_red)

    files = sorted(os.listdir(OUT_DIR))
    print(f"\n✓ {len(files)} PNGs in {OUT_DIR}")

if __name__ == "__main__":
    main()
