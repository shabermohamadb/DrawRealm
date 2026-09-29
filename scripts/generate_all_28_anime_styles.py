import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCALE = 4
W_96 = 96 * SCALE    # 384
H_96 = 96 * SCALE    # 384

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

def draw_lock(d, pts, base_col, dark_col=None, outline_col=(18, 18, 24, 255), width=2):
    if dark_col:
        # Subtle drop/root shadow polygon
        d.polygon([(p[0], p[1] + 2) for p in pts], fill=dark_col)
    d.polygon(pts, fill=base_col)
    if outline_col:
        d.line(pts + [pts[0]], fill=outline_col, width=width)

# 28 ARCHETYPE DEFINITIONS
ARCHETYPES = [
    # 0: Shadow Rogue — Messy Layered Shonen
    {
        "id": 0, "name": "Shadow Rogue",
        "skin": ((252, 230, 215), (222, 188, 168)),
        "hair_base": (36, 36, 46), "hair_dark": (18, 18, 26), "hair_hi": (105, 120, 150),
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
        "hair_base": (38, 34, 36), "hair_dark": (18, 16, 18), "hair_hi": (95, 90, 95),
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
        "hair_base": (25, 28, 48), "hair_dark": (12, 14, 26), "hair_hi": (85, 100, 145),
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
        "hair_base": (26, 24, 30), "hair_dark": (12, 10, 14), "hair_hi": (75, 70, 85),
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

# ==============================================================================
# 1. BACK HAIR RENDERING (PER-STYLE CUSTOM SILHOUETTE)
# ==============================================================================

def render_back_hair(im, arch):
    bd = ImageDraw.Draw(im)
    style = arch["style"]
    h_base = arch["hair_base"] + (255,)
    h_dark = arch["hair_dark"] + (255,)
    c_acc = arch["clothing_accent"] + (255,)
    line_col = (max(0, arch["hair_dark"][0]-10), max(0, arch["hair_dark"][1]-10), max(0, arch["hair_dark"][2]-10), 255)

    if style == "messy_shonen":
        # Spiky jagged tufts sticking out behind neck and ears
        l_pts = [(96, 140), (58, 175), (42, 225), (68, 245), (88, 225), (96, 180)]
        r_pts = [(288, 140), (326, 175), (342, 225), (316, 245), (296, 225), (288, 180)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "curtain_bob":
        # Smooth inward curved bob framing neck
        l_pts = bezier_curve((92, 125), (55, 175), (60, 245), (115, 275), 15) + \
                bezier_curve((115, 275), (95, 235), (95, 175), (92, 125), 15)
        r_pts = bezier_curve((292, 125), (329, 175), (324, 245), (269, 275), 15) + \
                bezier_curve((269, 275), (289, 235), (289, 175), (292, 125), 15)
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "spiky_shonen":
        # Angular upward spikes flared outward at neck
        l_pts = [(95, 135), (50, 165), (35, 215), (55, 235), (75, 215), (96, 170)]
        r_pts = [(289, 135), (334, 165), (349, 215), (329, 235), (309, 215), (288, 170)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "side_sweep_medium":
        # Flowing medium locks swept diagonally to left
        l_pts = bezier_curve((90, 130), (45, 190), (38, 275), (82, 305), 15) + [(115, 260), (95, 175)]
        r_pts = bezier_curve((294, 130), (328, 185), (320, 260), (285, 285), 15) + [(275, 240), (289, 175)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "runner_textured":
        # Short spiky nape tufts below ears
        l_pts = [(96, 160), (70, 195), (92, 215)]
        r_pts = [(288, 160), (314, 195), (292, 215)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "wavy_layers":
        # Bouncy S-curve waves reaching shoulders with flicked tips
        l_pts = bezier_curve((90, 125), (40, 180), (30, 245), (55, 290), 12) + \
                bezier_curve((55, 290), (32, 330), (65, 345), (95, 305), 12) + [(96, 210)]
        r_pts = bezier_curve((294, 125), (344, 180), (354, 245), (329, 290), 12) + \
                bezier_curve((329, 290), (352, 330), (319, 345), (289, 305), 12) + [(288, 210)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "cyber_asym":
        # Dramatic asymmetric cut: short right, long angular blade on left
        l_blade = bezier_curve((88, 125), (38, 195), (28, 280), (48, 345), 15) + \
                  bezier_curve((48, 345), (78, 315), (96, 250), (96, 175), 15)
        draw_lock(bd, l_blade, h_dark, outline_col=line_col, width=3)

    elif style == "wolf_cut":
        # Classic flared wolf-cut mullet locks flicking out at neck
        l_pts = [(92, 135), (48, 185), (30, 245), (18, 295), (54, 315), (82, 275), (98, 210)]
        r_pts = [(292, 135), (336, 185), (354, 245), (366, 295), (330, 315), (302, 275), (286, 210)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "slicked_undercut":
        # Very neat tapered nape shadow
        l_pts = [(135, 235), (120, 260), (145, 265)]
        r_pts = [(249, 235), (264, 260), (239, 265)]
        bd.polygon(l_pts, fill=h_dark)
        bd.polygon(r_pts, fill=h_dark)

    elif style == "twin_tails":
        # Two high, voluminous pigtails billowing outwards
        l_bunch = bezier_curve((78, 95), (28, 145), (14, 245), (48, 330), 16) + \
                  bezier_curve((48, 330), (75, 280), (92, 215), (96, 135), 16)
        r_bunch = bezier_curve((306, 95), (356, 145), (370, 245), (336, 330), 16) + \
                  bezier_curve((336, 330), (309, 280), (292, 215), (288, 135), 16)
        draw_lock(bd, l_bunch, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_bunch, h_dark, outline_col=line_col, width=3)
        # Ribbon ties
        bd.ellipse([70, 90, 88, 108], fill=c_acc)
        bd.ellipse([296, 90, 314, 108], fill=c_acc)

    elif style == "scholar_part":
        # Well-groomed medium neck taper
        l_pts = [(94, 135), (68, 185), (74, 250), (105, 240)]
        r_pts = [(290, 135), (316, 185), (310, 250), (279, 240)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "wild_wolf":
        # Multi-tiered spiky flared wolf hair
        l_pts = [(92, 130), (45, 175), (24, 235), (14, 285), (55, 305), (80, 265), (96, 205)]
        r_pts = [(292, 130), (339, 175), (360, 235), (370, 285), (329, 305), (304, 265), (288, 205)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "military_crop":
        # Clean high military fade
        pass

    elif style == "curtain_flow":
        # Lush medium waves reaching shoulders
        l_pts = [(92, 130), (52, 185), (42, 255), (68, 315), (98, 295), (105, 225)]
        r_pts = [(292, 130), (332, 185), (342, 255), (316, 315), (286, 295), (279, 225)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "cascading_waves":
        # Long luxurious waves billowing wide past chest
        l_pts = bezier_curve((88, 120), (35, 180), (18, 260), (42, 345), 18) + \
                bezier_curve((42, 345), (75, 360), (100, 310), (102, 220), 15)
        r_pts = bezier_curve((296, 120), (349, 180), (366, 260), (342, 345), 18) + \
                bezier_curve((342, 345), (309, 360), (284, 310), (282, 220), 15)
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "high_ponytail":
        # Arched high ponytail cascading over right shoulder
        pony = bezier_curve((245, 45), (325, 20), (368, 95), (355, 195), 18) + \
               bezier_curve((355, 195), (340, 265), (295, 245), (275, 140), 18)
        draw_lock(bd, pony, h_dark, outline_col=line_col, width=3)
        bd.ellipse([238, 40, 256, 58], fill=c_acc)

    elif style == "windblown_spikes":
        # Diagonal windblown locks
        l_pts = [(92, 135), (48, 175), (38, 235), (68, 250), (96, 205)]
        r_pts = [(292, 135), (338, 165), (352, 215), (324, 245), (288, 195)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "curly_crop":
        # Textured curls at nape
        l_pts = [(96, 150), (72, 175), (65, 215), (88, 235), (105, 215)]
        r_pts = [(288, 150), (312, 175), (319, 215), (296, 235), (279, 215)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "hime_straight":
        # Flat, razor-straight long curtain of hair falling behind shoulders
        l_curtain = [(82, 120), (45, 180), (35, 384), (95, 384), (98, 220)]
        r_curtain = [(302, 120), (339, 180), (349, 384), (289, 384), (286, 220)]
        draw_lock(bd, l_curtain, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_curtain, h_dark, outline_col=line_col, width=3)

    elif style == "feathered_pixie":
        # Soft feathered neck wisps
        l_pts = [(96, 165), (80, 205), (100, 220)]
        r_pts = [(288, 165), (304, 205), (284, 220)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=2)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=2)

    elif style == "braided_flow":
        # Long flowing locks behind shoulders
        l_pts = [(88, 125), (42, 185), (35, 275), (62, 345), (96, 315), (98, 220)]
        r_pts = [(296, 125), (342, 185), (349, 275), (322, 345), (288, 315), (286, 220)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_pts, h_dark, outline_col=line_col, width=3)

    elif style == "silver_hime":
        # Pristine silky straight long hair with glossy silver drape
        l_curtain = [(82, 120), (45, 180), (38, 384), (95, 384), (98, 220)]
        r_curtain = [(302, 120), (339, 180), (346, 384), (289, 384), (286, 220)]
        draw_lock(bd, l_curtain, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_curtain, h_dark, outline_col=line_col, width=3)

    elif style == "undercut_sweep":
        # Shaved right, flicked layers on left
        l_pts = [(90, 135), (45, 185), (32, 260), (65, 290), (96, 240)]
        draw_lock(bd, l_pts, h_dark, outline_col=line_col, width=3)

    elif style == "drill_curls":
        # Spiral corkscrew ringlets framing both sides of face
        l_curl = [(85, 125), (42, 175), (32, 235), (55, 275), (40, 320), (70, 335), (78, 265), (65, 215), (95, 175)]
        r_curl = [(299, 125), (342, 175), (352, 235), (329, 275), (344, 320), (314, 335), (306, 265), (319, 215), (289, 175)]
        draw_lock(bd, l_curl, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_curl, h_dark, outline_col=line_col, width=3)

    elif style == "pompadour_quiff":
        # High fade, minimal nape hair
        pass

    elif style == "twin_buns":
        # Two spherical Odango buns on upper sides + neck wisps
        bd.ellipse([55, 45, 115, 105], fill=h_base, outline=line_col, width=3)
        bd.ellipse([65, 55, 105, 95], fill=h_dark)
        bd.ellipse([269, 45, 329, 105], fill=h_base, outline=line_col, width=3)
        bd.ellipse([279, 55, 319, 95], fill=h_dark)
        # Ribbon wraps
        bd.ellipse([70, 95, 100, 115], fill=c_acc)
        bd.ellipse([284, 95, 314, 115], fill=c_acc)
        # Loose hanging neck wisps
        l_wisp = [(85, 140), (60, 210), (75, 260), (82, 215)]
        r_wisp = [(299, 140), (324, 210), (309, 260), (302, 215)]
        bd.polygon(l_wisp, fill=h_dark)
        bd.polygon(r_wisp, fill=h_dark)

    elif style == "astral_waves":
        # Grand billowing cosmic waves floating wide
        l_astral = bezier_curve((85, 115), (25, 165), (10, 265), (30, 365), 18) + \
                   bezier_curve((30, 365), (75, 370), (105, 310), (102, 215), 15)
        r_astral = bezier_curve((299, 115), (359, 165), (374, 265), (354, 365), 18) + \
                   bezier_curve((354, 365), (309, 370), (279, 310), (282, 215), 15)
        draw_lock(bd, l_astral, h_dark, outline_col=line_col, width=3)
        draw_lock(bd, r_astral, h_dark, outline_col=line_col, width=3)

    elif style == "caesar_crop":
        # Low crisp square nape fade
        pass

# ==============================================================================
# 2. FACE, NECK & CLOTHING RENDERING
# ==============================================================================

def render_face_and_clothing(im, arch):
    fd = ImageDraw.Draw(im)
    skin_base, skin_shadow = arch["skin"]
    c_base = arch["clothing_base"] + (255,)
    c_acc = arch["clothing_accent"] + (255,)
    c_type = arch["clothing_type"]
    face_type = arch.get("face_type", "slender")

    # Neck
    neck_pts = [(152, 235), (150, 315), (234, 315), (232, 235)]
    fd.polygon(neck_pts, fill=skin_base + (255,))
    shadow_curve = bezier_curve((152, 245), (172, 275), (212, 275), (232, 245), 15)
    shadow_pts = shadow_curve + [(234, 280), (150, 280)]
    fd.polygon(shadow_pts, fill=skin_shadow + (255,))

    # Neck tendons & collarbones
    fd.line([(172, 275), (184, 315)], fill=skin_shadow + (140,), width=3)
    fd.line([(212, 275), (200, 315)], fill=skin_shadow + (140,), width=3)
    fd.line([(160, 318), (192, 324), (224, 318)], fill=skin_shadow + (180,), width=3)

    # Clothing
    if c_type == "tech_hoodie":
        hoodie_pts = [
            (20, 384), (35, 335), (95, 305), (145, 292), (192, 318), (239, 292),
            (289, 305), (349, 335), (364, 384)
        ]
        fd.polygon(hoodie_pts, fill=c_base)
        fd.line([(145, 292), (192, 318), (239, 292)], fill=c_acc, width=6)
        fd.line([(175, 318), (175, 370)], fill=(245, 245, 250, 255), width=4)
        fd.line([(209, 318), (209, 370)], fill=(245, 245, 250, 255), width=4)
        fd.line([(175, 366), (175, 372)], fill=c_acc, width=5)
        fd.line([(209, 366), (209, 372)], fill=c_acc, width=5)
        fd.line([(95, 305), (80, 384)], fill=(15, 15, 20, 180), width=3)
        fd.line([(289, 305), (304, 384)], fill=(15, 15, 20, 180), width=3)
        fd.line(hoodie_pts + [hoodie_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "tactical_jacket":
        jack_pts = [
            (20, 384), (35, 335), (95, 305), (140, 280), (165, 270), (192, 310),
            (219, 270), (244, 280), (289, 305), (349, 335), (364, 384)
        ]
        fd.polygon(jack_pts, fill=c_base)
        fd.line([(165, 270), (192, 310), (198, 384)], fill=(210, 215, 225, 255), width=4)
        fd.polygon([(90, 310), (125, 300), (120, 320), (85, 330)], fill=c_acc)
        fd.polygon([(294, 310), (259, 300), (264, 320), (299, 330)], fill=c_acc)
        fd.line(jack_pts + [jack_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "turtleneck":
        t_pts = [
            (20, 384), (35, 335), (95, 305), (145, 290), (145, 245), (192, 250),
            (239, 245), (239, 290), (289, 305), (349, 335), (364, 384)
        ]
        fd.polygon(t_pts, fill=c_base)
        for y_r in [260, 272, 284]:
            fd.line([(146, y_r), (238, y_r)], fill=c_acc, width=3)
        fd.line(t_pts + [t_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "bomber":
        b_pts = [
            (20, 384), (35, 330), (95, 305), (145, 300), (192, 335), (239, 300),
            (289, 305), (349, 330), (364, 384)
        ]
        fd.polygon(b_pts, fill=c_base)
        fd.line([(192, 335), (192, 384)], fill=(220, 225, 235, 255), width=5)
        fd.line([(145, 300), (192, 335), (239, 300)], fill=c_acc, width=6)
        fd.line(b_pts + [b_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "blazer_tie":
        blaz_pts = [
            (20, 384), (35, 335), (95, 305), (140, 300), (192, 360), (244, 300),
            (289, 305), (349, 335), (364, 384)
        ]
        fd.polygon(blaz_pts, fill=c_base)
        fd.polygon([(150, 300), (192, 350), (234, 300)], fill=(248, 250, 255, 255))
        fd.polygon([(188, 310), (196, 310), (194, 365), (190, 365)], fill=c_acc)
        fd.line([(140, 300), (170, 340), (192, 360)], fill=(15, 15, 20, 255), width=3)
        fd.line([(244, 300), (214, 340), (192, 360)], fill=(15, 15, 20, 255), width=3)
        fd.line(blaz_pts + [blaz_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "track_jacket":
        tr_pts = [
            (20, 384), (35, 335), (95, 305), (148, 290), (192, 305), (236, 290),
            (289, 305), (349, 335), (364, 384)
        ]
        fd.polygon(tr_pts, fill=c_base)
        fd.line([(60, 350), (115, 310)], fill=c_acc, width=4)
        fd.line([(324, 350), (269, 310)], fill=c_acc, width=4)
        fd.line([(192, 305), (192, 384)], fill=(230, 235, 245, 255), width=4)
        fd.line(tr_pts + [tr_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "cozy_scarf":
        sh_pts = [(20, 384), (35, 335), (95, 310), (289, 310), (349, 335), (364, 384)]
        fd.polygon(sh_pts, fill=(30, 35, 45, 255))
        sc_pts = [(130, 260), (192, 275), (254, 260), (262, 320), (192, 340), (122, 320)]
        fd.polygon(sc_pts, fill=c_base)
        fd.polygon([(175, 315), (210, 315), (215, 375), (170, 375)], fill=c_acc)
        fd.line(sc_pts + [sc_pts[0]], fill=(15, 15, 20, 255), width=4)

    else:
        c_pts = [
            (20, 384), (35, 335), (95, 310), (148, 300), (192, 335), (236, 300),
            (289, 310), (349, 335), (364, 384)
        ]
        fd.polygon(c_pts, fill=c_base)
        fd.polygon([(155, 300), (192, 335), (229, 300)], fill=c_acc)
        fd.line(c_pts + [c_pts[0]], fill=(15, 15, 20, 255), width=4)

    # Ears
    fd.ellipse([82, 148, 108, 205], fill=skin_base + (255,), outline=(170, 125, 105, 255), width=3)
    fd.ellipse([88, 160, 104, 192], fill=skin_shadow + (255,))
    fd.ellipse([276, 148, 302, 205], fill=skin_base + (255,), outline=(170, 125, 105, 255), width=3)
    fd.ellipse([280, 160, 296, 192], fill=skin_shadow + (255,))

    # Jawline according to face_type
    if face_type == "sharp":
        left_jaw = bezier_curve((96, 110), (94, 185), (124, 245), (192, 276), 25)
        right_jaw = bezier_curve((192, 276), (260, 245), (290, 185), (288, 110), 25)
    elif face_type == "angular":
        left_jaw = bezier_curve((96, 110), (96, 190), (130, 248), (192, 278), 25)
        right_jaw = bezier_curve((192, 278), (254, 248), (288, 190), (288, 110), 25)
    elif face_type == "soft":
        left_jaw = bezier_curve((96, 110), (94, 178), (120, 238), (192, 272), 25)
        right_jaw = bezier_curve((192, 272), (264, 238), (290, 178), (288, 110), 25)
    else: # slender
        left_jaw = bezier_curve((96, 110), (94, 180), (120, 240), (192, 274), 25)
        right_jaw = bezier_curve((192, 274), (264, 240), (290, 180), (288, 110), 25)

    head_top = bezier_curve((288, 110), (280, 60), (104, 60), (96, 110), 20)
    face_contour = left_jaw + right_jaw + head_top

    fd.polygon(face_contour, fill=skin_base + (255,))
    fd.line(left_jaw + right_jaw, fill=(170, 125, 105, 255), width=3)

    # Soft Cheek Blush
    blush = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blush)
    bd.ellipse([115, 185, 155, 215], fill=(248, 125, 125, 120))
    bd.ellipse([229, 185, 269, 215], fill=(248, 125, 125, 120))
    blush = blush.filter(ImageFilter.GaussianBlur(radius=8))
    im.alpha_composite(blush)

    # Sculpted Nose
    fd = ImageDraw.Draw(im)
    fd.line([(190, 182), (190, 216)], fill=skin_shadow + (140,), width=2)
    fd.line([(192, 184), (192, 217)], fill=(255, 250, 245, 180), width=2)
    fd.ellipse([191, 217, 194, 220], fill=(255, 255, 255, 230))
    fd.polygon([(187, 223), (192, 222), (197, 224), (192, 225)], fill=(160, 110, 90, 255))

print("Back hair and face renderers defined.")
