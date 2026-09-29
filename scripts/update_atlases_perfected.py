import sys

# We will generate the complete, self-contained scripts/build_premium_semi_realistic_atlases.py
output_file = "/home/shaber/skribbl.io/scripts/build_premium_semi_realistic_atlases.py"

content = '''import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUTPUT_DIR = "/home/shaber/skribbl.io/img/avatar"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SCALE = 4
W_96 = 96 * SCALE    # 384
H_96 = 96 * SCALE    # 384
W_160 = 160 * SCALE  # 640
H_160 = 160 * SCALE  # 640

ATLAS_96_SIZE = 960   # 10 x 96
ATLAS_160_SIZE = 1600 # 10 x 160

def bezier_curve(p0, p1, p2, p3, num_pts=20):
    pts = []
    for i in range(num_pts + 1):
        t = i / num_pts
        x = (1-t)**3 * p0[0] + 3*(1-t)**2 * t * p1[0] + 3*(1-t) * t**2 * p2[0] + t**3 * p3[0]
        y = (1-t)**3 * p0[1] + 3*(1-t)**2 * t * p1[1] + 3*(1-t) * t**2 * p2[1] + t**3 * p3[1]
        pts.append((int(x), int(y)))
    return pts

def make_lock(root_l, c_l1, c_l2, tip, c_r1, c_r2, root_r, num=12):
    left_edge = bezier_curve(root_l, c_l1, c_l2, tip, num)
    right_edge = bezier_curve(tip, c_r1, c_r2, root_r, num)
    return left_edge + right_edge[1:]

def draw_forehead_shadow(im, shadow_pts, skin_shadow):
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    col = (max(0, skin_shadow[0]-45), max(0, skin_shadow[1]-45), max(0, skin_shadow[2]-45), 125)
    sd.polygon(shadow_pts, fill=col)
    sh = sh.filter(ImageFilter.GaussianBlur(radius=6))
    im.alpha_composite(sh)

def draw_anisotropic_sheen(im, arc_pts, hi_col, width=6, blur_rad=4):
    halo = Image.new("RGBA", im.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    for i in range(len(arc_pts) - 1):
        hd.line([arc_pts[i], arc_pts[i+1]], fill=hi_col, width=width)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=blur_rad))
    im.alpha_composite(halo)

# ==============================================================================
# 1. COLOR ATLAS — 28 UNIQUE ANIME ARCHETYPES (INDIVIDUAL SILHOUETTES & DESIGNS)
# ==============================================================================

ARCHETYPES = [
    # 0: Shadow Rogue — Messy Layered Shonen
    {
        "id": 0, "name": "Shadow Rogue",
        "skin": ((252, 230, 215), (222, 188, 168)),
        "hair_base": (36, 36, 46), "hair_dark": (18, 18, 26), "hair_hi": (115, 130, 165),
        "style": "messy_shonen", "face_type": "sharp",
        "clothing_type": "tech_hoodie",
        "clothing_base": (24, 26, 32), "clothing_accent": (249, 115, 22),
    },
    # 1: Cyber Samurai — Curtain Bangs Bob
    {
        "id": 1, "name": "Cyber Samurai",
        "skin": ((254, 238, 228), (226, 196, 180)),
        "hair_base": (236, 242, 250), "hair_dark": (165, 180, 202), "hair_hi": (255, 255, 255),
        "style": "curtain_bob", "face_type": "slender",
        "clothing_type": "tactical_jacket",
        "clothing_base": (20, 24, 34), "clothing_accent": (6, 182, 212),
    },
    # 2: Crimson Blaze — Spiky Shonen Short Hair
    {
        "id": 2, "name": "Crimson Blaze",
        "skin": ((250, 224, 205), (220, 184, 162)),
        "hair_base": (220, 38, 38), "hair_dark": (145, 18, 18), "hair_hi": (254, 140, 140),
        "style": "spiky_shonen", "face_type": "sharp",
        "clothing_type": "bomber",
        "clothing_base": (30, 30, 35), "clothing_accent": (220, 38, 38),
    },
    # 3: Frost Sorcerer — Side-Swept Medium Layers
    {
        "id": 3, "name": "Frost Sorcerer",
        "skin": ((253, 238, 228), (226, 198, 182)),
        "hair_base": (195, 220, 245), "hair_dark": (130, 160, 195), "hair_hi": (250, 252, 255),
        "style": "side_sweep_medium", "face_type": "slender",
        "clothing_type": "turtleneck",
        "clothing_base": (28, 38, 58), "clothing_accent": (96, 165, 250),
    },
    # 4: Electric Prodigy — Runner Textured w/ Headband
    {
        "id": 4, "name": "Electric Prodigy",
        "skin": ((248, 220, 196), (218, 182, 154)),
        "hair_base": (250, 204, 21), "hair_dark": (185, 130, 10), "hair_hi": (254, 245, 170),
        "style": "runner_textured", "face_type": "energetic",
        "clothing_type": "track_jacket",
        "clothing_base": (24, 24, 28), "clothing_accent": (250, 204, 21),
    },
    # 5: Star Vocalist — Wavy Shoulder Layers
    {
        "id": 5, "name": "Star Vocalist",
        "skin": ((253, 232, 220), (226, 194, 174)),
        "hair_base": (192, 132, 252), "hair_dark": (125, 65, 190), "hair_hi": (238, 210, 255),
        "style": "wavy_layers", "face_type": "soft",
        "clothing_type": "blazer_tie",
        "clothing_base": (30, 25, 45), "clothing_accent": (192, 132, 252),
    },
    # 6: Digital Nomad — Asymmetrical Cyber Bob
    {
        "id": 6, "name": "Digital Nomad",
        "skin": ((246, 220, 196), (218, 182, 154)),
        "hair_base": (20, 184, 166), "hair_dark": (13, 115, 104), "hair_hi": (115, 240, 225),
        "style": "cyber_asym", "face_type": "slender",
        "clothing_type": "tech_hoodie",
        "clothing_base": (17, 24, 39), "clothing_accent": (20, 184, 166),
    },
    # 7: Desert Wanderer — Shaggy Wolf Cut Mullet
    {
        "id": 7, "name": "Desert Wanderer",
        "skin": ((235, 196, 166), (205, 160, 128)),
        "hair_base": (156, 75, 20), "hair_dark": (95, 40, 10), "hair_hi": (225, 135, 35),
        "style": "wolf_cut", "face_type": "sharp",
        "clothing_type": "cozy_scarf",
        "clothing_base": (180, 83, 9), "clothing_accent": (254, 215, 170),
    },
    # 8: Silent Striker — Slicked-Back Undercut
    {
        "id": 8, "name": "Silent Striker",
        "skin": ((240, 208, 180), (212, 172, 142)),
        "hair_base": (38, 34, 36), "hair_dark": (18, 16, 18), "hair_hi": (115, 110, 120),
        "style": "slicked_undercut", "face_type": "angular",
        "clothing_type": "tactical_jacket",
        "clothing_base": (35, 38, 45), "clothing_accent": (148, 163, 184),
    },
    # 9: Sakura Idol — High Twin Tails w/ Ribbons
    {
        "id": 9, "name": "Sakura Idol",
        "skin": ((254, 236, 225), (230, 200, 184)),
        "hair_base": (251, 113, 133), "hair_dark": (190, 45, 75), "hair_hi": (254, 205, 215),
        "style": "twin_tails", "face_type": "soft",
        "clothing_type": "tech_hoodie",
        "clothing_base": (255, 245, 248), "clothing_accent": (244, 63, 94),
    },
    # 10: Arcane Scholar — 7:3 Side-Parted Medium
    {
        "id": 10, "name": "Arcane Scholar",
        "skin": ((250, 228, 212), (224, 192, 172)),
        "hair_base": (32, 68, 155), "hair_dark": (16, 35, 90), "hair_hi": (110, 175, 255),
        "style": "scholar_part", "face_type": "slender",
        "clothing_type": "turtleneck",
        "clothing_base": (22, 28, 45), "clothing_accent": (147, 197, 253),
    },
    # 11: Neon Phantom — Wild Spiky Wolf Cut
    {
        "id": 11, "name": "Neon Phantom",
        "skin": ((246, 222, 204), (220, 186, 164)),
        "hair_base": (175, 80, 250), "hair_dark": (110, 30, 170), "hair_hi": (235, 190, 255),
        "style": "wild_wolf", "face_type": "sharp",
        "clothing_type": "street_vest",
        "clothing_base": (20, 15, 30), "clothing_accent": (168, 85, 247),
    },
    # 12: Iron Vanguard — Textured Military Crop
    {
        "id": 12, "name": "Iron Vanguard",
        "skin": ((234, 198, 170), (204, 162, 130)),
        "hair_base": (105, 122, 145), "hair_dark": (55, 68, 88), "hair_hi": (185, 200, 220),
        "style": "military_crop", "face_type": "angular",
        "clothing_type": "tactical_jacket",
        "clothing_base": (30, 41, 59), "clothing_accent": (234, 179, 8),
    },
    # 13: Solar Knight — Curtain Bangs Flow
    {
        "id": 13, "name": "Solar Knight",
        "skin": ((250, 226, 208), (226, 190, 168)),
        "hair_base": (245, 195, 75), "hair_dark": (180, 130, 30), "hair_hi": (255, 245, 190),
        "style": "curtain_flow", "face_type": "slender",
        "clothing_type": "blazer_tie",
        "clothing_base": (248, 250, 252), "clothing_accent": (218, 165, 32),
    },
    # 14: Ocean Mist — Long Cascading Waves
    {
        "id": 14, "name": "Ocean Mist",
        "skin": ((254, 238, 226), (228, 200, 184)),
        "hair_base": (45, 180, 240), "hair_dark": (14, 110, 160), "hair_hi": (180, 235, 255),
        "style": "cascading_waves", "face_type": "soft",
        "clothing_type": "casual_crew",
        "clothing_base": (30, 45, 65), "clothing_accent": (56, 189, 248),
    },
    # 15: Midnight Ace — High Ponytail w/ Draping Arch
    {
        "id": 15, "name": "Midnight Ace",
        "skin": ((248, 224, 206), (222, 188, 166)),
        "hair_base": (25, 28, 48), "hair_dark": (12, 14, 26), "hair_hi": (100, 115, 160),
        "style": "high_ponytail", "face_type": "sharp",
        "clothing_type": "bomber",
        "clothing_base": (24, 24, 27), "clothing_accent": (203, 213, 225),
    },
    # 16: Emerald Hunter — Windblown Spiky Wild Cut
    {
        "id": 16, "name": "Emerald Hunter",
        "skin": ((244, 216, 192), (216, 178, 150)),
        "hair_base": (18, 180, 120), "hair_dark": (6, 115, 75), "hair_hi": (120, 235, 185),
        "style": "windblown_spikes", "face_type": "sharp",
        "clothing_type": "tactical_jacket",
        "clothing_base": (25, 45, 35), "clothing_accent": (16, 185, 129),
    },
    # 17: Golden Champion — Curly / Wavy Voluminous Crop
    {
        "id": 17, "name": "Golden Champion",
        "skin": ((248, 220, 195), (220, 182, 152)),
        "hair_base": (235, 175, 15), "hair_dark": (165, 95, 10), "hair_hi": (254, 225, 80),
        "style": "curly_crop", "face_type": "energetic",
        "clothing_type": "track_jacket",
        "clothing_base": (30, 35, 45), "clothing_accent": (234, 179, 8),
    },
    # 18: Twilight Reaper — Long Straight Hime Cut
    {
        "id": 18, "name": "Twilight Reaper",
        "skin": ((252, 234, 222), (226, 196, 178)),
        "hair_base": (85, 25, 130), "hair_dark": (40, 10, 70), "hair_hi": (165, 80, 245),
        "style": "hime_straight", "face_type": "slender",
        "clothing_type": "tactical_jacket",
        "clothing_base": (18, 15, 25), "clothing_accent": (147, 51, 234),
    },
    # 19: Ruby Duelist — Feathered Pixie Cut
    {
        "id": 19, "name": "Ruby Duelist",
        "skin": ((246, 218, 196), (218, 180, 154)),
        "hair_base": (225, 30, 75), "hair_dark": (140, 15, 45), "hair_hi": (252, 125, 145),
        "style": "feathered_pixie", "face_type": "sharp",
        "clothing_type": "tech_hoodie",
        "clothing_base": (24, 24, 27), "clothing_accent": (225, 29, 72),
    },
    # 20: Verdant Druid — Braided Accent Flow
    {
        "id": 20, "name": "Verdant Druid",
        "skin": ((250, 226, 210), (224, 192, 172)),
        "hair_base": (50, 205, 148), "hair_dark": (15, 135, 90), "hair_hi": (165, 242, 205),
        "style": "braided_flow", "face_type": "soft",
        "clothing_type": "cozy_scarf",
        "clothing_base": (6, 78, 59), "clothing_accent": (52, 211, 153),
    },
    # 21: Silver Valkyrie — Pristine Hime Cut
    {
        "id": 21, "name": "Silver Valkyrie",
        "skin": ((254, 238, 230), (230, 202, 188)),
        "hair_base": (228, 234, 242), "hair_dark": (150, 165, 188), "hair_hi": (255, 255, 255),
        "style": "silver_hime", "face_type": "slender",
        "clothing_type": "blazer_tie",
        "clothing_base": (15, 23, 42), "clothing_accent": (226, 232, 240),
    },
    # 22: Cyberpunk Rebel — Undercut Side-Sweep
    {
        "id": 22, "name": "Cyberpunk Rebel",
        "skin": ((242, 212, 186), (214, 174, 144)),
        "hair_base": (135, 210, 25), "hair_dark": (75, 125, 15), "hair_hi": (195, 245, 110),
        "style": "undercut_sweep", "face_type": "sharp",
        "clothing_type": "tactical_jacket",
        "clothing_base": (17, 24, 39), "clothing_accent": (234, 179, 8),
    },
    # 23: Gothic Aristocrat — Twin Drill Spiral Curls
    {
        "id": 23, "name": "Gothic Aristocrat",
        "skin": ((254, 240, 232), (230, 204, 190)),
        "hair_base": (26, 24, 30), "hair_dark": (12, 10, 14), "hair_hi": (85, 80, 95),
        "style": "drill_curls", "face_type": "soft",
        "clothing_type": "turtleneck",
        "clothing_base": (15, 15, 20), "clothing_accent": (159, 18, 57),
    },
    # 24: Caramel Maverick — Modern Pompadour Quiff
    {
        "id": 24, "name": "Caramel Maverick",
        "skin": ((220, 176, 146), (190, 140, 110)),
        "hair_base": (185, 88, 12), "hair_dark": (118, 50, 8), "hair_hi": (248, 165, 18),
        "style": "pompadour_quiff", "face_type": "angular",
        "clothing_type": "bomber",
        "clothing_base": (45, 30, 20), "clothing_accent": (245, 158, 11),
    },
    # 25: Crimson Lotus — Twin Odango Buns
    {
        "id": 25, "name": "Crimson Lotus",
        "skin": ((252, 230, 216), (226, 194, 174)),
        "hair_base": (245, 65, 96), "hair_dark": (180, 22, 58), "hair_hi": (254, 168, 180),
        "style": "twin_buns", "face_type": "soft",
        "clothing_type": "tactical_jacket",
        "clothing_base": (24, 24, 28), "clothing_accent": (244, 63, 94),
    },
    # 26: Stellar Oracle — Floating Astral Waves
    {
        "id": 26, "name": "Stellar Oracle",
        "skin": ((252, 232, 218), (226, 196, 176)),
        "hair_base": (35, 62, 145), "hair_dark": (18, 28, 75), "hair_hi": (115, 185, 255),
        "style": "astral_waves", "face_type": "slender",
        "clothing_type": "tech_hoodie",
        "clothing_base": (15, 23, 42), "clothing_accent": (96, 165, 250),
    },
    # 27: Bronze Gladiator — Caesar Crop Fade
    {
        "id": 27, "name": "Bronze Gladiator",
        "skin": ((195, 145, 115), (165, 115, 85)),
        "hair_base": (32, 26, 24), "hair_dark": (16, 12, 10), "hair_hi": (80, 70, 65),
        "style": "caesar_crop", "face_type": "angular",
        "clothing_type": "street_vest",
        "clothing_base": (30, 30, 34), "clothing_accent": (217, 119, 6),
    }
]

from generate_all_28_anime_styles import render_back_hair, render_face_and_clothing
from anime_hair_engine import render_seamless_front_hair

def render_color_tile(arch):
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))

    # 1. Back hair layer (behind neck/face)
    render_back_hair(im, arch)

    # 2. Face, neck & streetwear clothing
    render_face_and_clothing(im, arch)

    # 3. Seamless front hair mass & bespoke bangs
    render_seamless_front_hair(im, arch)

    return im.resize((96, 96), Image.Resampling.LANCZOS)
'''

# Now append the existing tested eyes, mouth, special renderers, and main()
with open("/home/shaber/skribbl.io/scripts/build_premium_semi_realistic_atlases.py.bak", "r") as f:
    old_code = f.read()

# Extract from line containing '2. EYES ATLAS' onwards
eyes_start = old_code.find("# 2. EYES ATLAS")
rest_of_code = old_code[eyes_start:]

full_code = content + "\n\n# ==============================================================================\n" + rest_of_code

with open(output_file, "w") as f:
    f.write(full_code)

print("build_premium_semi_realistic_atlases.py updated successfully!")
