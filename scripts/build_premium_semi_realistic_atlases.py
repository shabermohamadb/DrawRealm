import os
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

# ==============================================================================
# 1. COLOR ATLAS — 28 BASE ANIME ARCHETYPES
# ==============================================================================

ARCHETYPES = [
    # 0: Shadow Rogue
    {
        "name": "Shadow Rogue",
        "skin": ((252, 230, 215), (225, 192, 172)),
        "hair_base": (28, 28, 36), "hair_dark": (14, 14, 20), "hair_hi": (85, 95, 120),
        "style": "messy_shonen",
        "clothing_type": "tech_hoodie",
        "clothing_base": (24, 26, 32), "clothing_accent": (249, 115, 22),
    },
    # 1: Cyber Samurai
    {
        "name": "Cyber Samurai",
        "skin": ((254, 238, 228), (230, 200, 185)),
        "hair_base": (235, 240, 248), "hair_dark": (160, 175, 195), "hair_hi": (255, 255, 255),
        "style": "curtain_bangs",
        "clothing_type": "tactical_jacket",
        "clothing_base": (20, 24, 34), "clothing_accent": (6, 182, 212),
    },
    # 2: Crimson Blaze
    {
        "name": "Crimson Blaze",
        "skin": ((250, 224, 205), (222, 186, 164)),
        "hair_base": (220, 38, 38), "hair_dark": (145, 18, 18), "hair_hi": (252, 120, 120),
        "style": "spiky_shonen",
        "clothing_type": "bomber",
        "clothing_base": (30, 30, 35), "clothing_accent": (220, 38, 38),
    },
    # 3: Frost Sorcerer
    {
        "name": "Frost Sorcerer",
        "skin": ((253, 236, 225), (228, 198, 182)),
        "hair_base": (210, 225, 245), "hair_dark": (140, 165, 195), "hair_hi": (250, 252, 255),
        "style": "side_part_fringe",
        "clothing_type": "turtleneck",
        "clothing_base": (28, 38, 58), "clothing_accent": (96, 165, 250),
    },
    # 4: Electric Prodigy
    {
        "name": "Electric Prodigy",
        "skin": ((248, 222, 198), (220, 184, 156)),
        "hair_base": (250, 204, 21), "hair_dark": (185, 130, 10), "hair_hi": (254, 245, 170),
        "style": "runner_spikes",
        "clothing_type": "track_jacket",
        "clothing_base": (24, 24, 28), "clothing_accent": (250, 204, 21),
    },
    # 5: Star Vocalist
    {
        "name": "Star Vocalist",
        "skin": ((252, 232, 218), (228, 195, 175)),
        "hair_base": (192, 132, 252), "hair_dark": (130, 70, 195), "hair_hi": (235, 205, 255),
        "style": "wavy_layers",
        "clothing_type": "blazer_tie",
        "clothing_base": (30, 25, 45), "clothing_accent": (192, 132, 252),
    },
    # 6: Digital Nomad
    {
        "name": "Digital Nomad",
        "skin": ((246, 220, 196), (218, 182, 154)),
        "hair_base": (20, 184, 166), "hair_dark": (13, 115, 104), "hair_hi": (94, 234, 212),
        "style": "cyber_asym",
        "clothing_type": "tech_hoodie",
        "clothing_base": (17, 24, 39), "clothing_accent": (20, 184, 166),
    },
    # 7: Desert Wanderer
    {
        "name": "Desert Wanderer",
        "skin": ((235, 196, 166), (205, 160, 128)),
        "hair_base": (146, 64, 14), "hair_dark": (90, 35, 8), "hair_hi": (217, 119, 6),
        "style": "wolf_cut",
        "clothing_type": "cozy_scarf",
        "clothing_base": (180, 83, 9), "clothing_accent": (254, 215, 170),
    },
    # 8: Silent Striker
    {
        "name": "Silent Striker",
        "skin": ((240, 208, 180), (212, 172, 142)),
        "hair_base": (35, 30, 32), "hair_dark": (18, 15, 16), "hair_hi": (80, 75, 80),
        "style": "short_undercut",
        "clothing_type": "tactical_jacket",
        "clothing_base": (35, 38, 45), "clothing_accent": (148, 163, 184),
    },
    # 9: Sakura Idol
    {
        "name": "Sakura Idol",
        "skin": ((254, 236, 224), (232, 202, 184)),
        "hair_base": (251, 113, 133), "hair_dark": (190, 45, 75), "hair_hi": (254, 205, 215),
        "style": "twin_tails",
        "clothing_type": "tech_hoodie",
        "clothing_base": (255, 245, 248), "clothing_accent": (244, 63, 94),
    },
    # 10: Arcane Scholar
    {
        "name": "Arcane Scholar",
        "skin": ((250, 228, 212), (224, 192, 172)),
        "hair_base": (30, 64, 145), "hair_dark": (15, 32, 85), "hair_hi": (96, 165, 250),
        "style": "side_part_fringe",
        "clothing_type": "turtleneck",
        "clothing_base": (22, 28, 45), "clothing_accent": (147, 197, 253),
    },
    # 11: Neon Phantom
    {
        "name": "Neon Phantom",
        "skin": ((246, 222, 204), (220, 186, 164)),
        "hair_base": (168, 85, 247), "hair_dark": (107, 33, 168), "hair_hi": (233, 213, 255),
        "style": "wolf_cut",
        "clothing_type": "street_vest",
        "clothing_base": (20, 15, 30), "clothing_accent": (168, 85, 247),
    },
    # 12: Iron Vanguard
    {
        "name": "Iron Vanguard",
        "skin": ((234, 198, 170), (204, 162, 130)),
        "hair_base": (100, 116, 139), "hair_dark": (51, 65, 85), "hair_hi": (180, 195, 215),
        "style": "short_undercut",
        "clothing_type": "tactical_jacket",
        "clothing_base": (30, 41, 59), "clothing_accent": (234, 179, 8),
    },
    # 13: Solar Knight
    {
        "name": "Solar Knight",
        "skin": ((250, 226, 208), (226, 190, 168)),
        "hair_base": (245, 195, 75), "hair_dark": (180, 130, 30), "hair_hi": (255, 245, 190),
        "style": "curtain_bangs",
        "clothing_type": "blazer_tie",
        "clothing_base": (248, 250, 252), "clothing_accent": (218, 165, 32),
    },
    # 14: Ocean Mist
    {
        "name": "Ocean Mist",
        "skin": ((254, 238, 226), (230, 202, 185)),
        "hair_base": (56, 189, 248), "hair_dark": (14, 116, 144), "hair_hi": (186, 230, 253),
        "style": "flowing_waves",
        "clothing_type": "casual_crew",
        "clothing_base": (30, 45, 65), "clothing_accent": (56, 189, 248),
    },
    # 15: Midnight Ace
    {
        "name": "Midnight Ace",
        "skin": ((248, 224, 206), (222, 188, 166)),
        "hair_base": (20, 24, 40), "hair_dark": (10, 12, 22), "hair_hi": (70, 85, 125),
        "style": "high_ponytail",
        "clothing_type": "bomber",
        "clothing_base": (24, 24, 27), "clothing_accent": (203, 213, 225),
    },
    # 16: Emerald Hunter
    {
        "name": "Emerald Hunter",
        "skin": ((244, 216, 192), (216, 178, 150)),
        "hair_base": (16, 185, 129), "hair_dark": (5, 120, 80), "hair_hi": (110, 231, 183),
        "style": "messy_shonen",
        "clothing_type": "tactical_jacket",
        "clothing_base": (25, 45, 35), "clothing_accent": (16, 185, 129),
    },
    # 17: Golden Champion
    {
        "name": "Golden Champion",
        "skin": ((248, 220, 195), (220, 182, 152)),
        "hair_base": (234, 179, 8), "hair_dark": (161, 98, 7), "hair_hi": (253, 224, 71),
        "style": "curly_crop",
        "clothing_type": "track_jacket",
        "clothing_base": (30, 35, 45), "clothing_accent": (234, 179, 8),
    },
    # 18: Twilight Reaper
    {
        "name": "Twilight Reaper",
        "skin": ((252, 234, 222), (226, 196, 178)),
        "hair_base": (88, 28, 135), "hair_dark": (45, 10, 75), "hair_hi": (168, 85, 247),
        "style": "flowing_waves",
        "clothing_type": "ninja_wrap",
        "clothing_base": (18, 15, 25), "clothing_accent": (147, 51, 234),
    },
    # 19: Ruby Duelist
    {
        "name": "Ruby Duelist",
        "skin": ((246, 218, 196), (218, 180, 154)),
        "hair_base": (225, 29, 72), "hair_dark": (140, 12, 40), "hair_hi": (251, 113, 133),
        "style": "runner_spikes",
        "clothing_type": "tech_hoodie",
        "clothing_base": (24, 24, 27), "clothing_accent": (225, 29, 72),
    },
    # 20: Verdant Druid
    {
        "name": "Verdant Druid",
        "skin": ((250, 226, 210), (224, 192, 172)),
        "hair_base": (52, 211, 153), "hair_dark": (16, 140, 95), "hair_hi": (167, 243, 208),
        "style": "wavy_layers",
        "clothing_type": "cozy_scarf",
        "clothing_base": (6, 78, 59), "clothing_accent": (52, 211, 153),
    },
    # 21: Silver Valkyrie
    {
        "name": "Silver Valkyrie",
        "skin": ((254, 238, 230), (230, 202, 188)),
        "hair_base": (226, 232, 240), "hair_dark": (148, 163, 184), "hair_hi": (255, 255, 255),
        "style": "hime_cut",
        "clothing_type": "blazer_tie",
        "clothing_base": (15, 23, 42), "clothing_accent": (226, 232, 240),
    },
    # 22: Cyberpunk Rebel
    {
        "name": "Cyberpunk Rebel",
        "skin": ((242, 212, 186), (214, 174, 144)),
        "hair_base": (132, 204, 22), "hair_dark": (77, 124, 15), "hair_hi": (190, 242, 100),
        "style": "cyber_asym",
        "clothing_type": "tactical_jacket",
        "clothing_base": (17, 24, 39), "clothing_accent": (234, 179, 8),
    },
    # 23: Gothic Aristocrat
    {
        "name": "Gothic Aristocrat",
        "skin": ((254, 240, 232), (232, 206, 192)),
        "hair_base": (24, 24, 28), "hair_dark": (10, 10, 12), "hair_hi": (65, 65, 75),
        "style": "drill_curls",
        "clothing_type": "turtleneck",
        "clothing_base": (15, 15, 20), "clothing_accent": (159, 18, 57),
    },
    # 24: Caramel Maverick
    {
        "name": "Caramel Maverick",
        "skin": ((220, 176, 146), (190, 140, 110)),
        "hair_base": (180, 83, 9), "hair_dark": (115, 48, 6), "hair_hi": (245, 158, 11),
        "style": "side_part_fringe",
        "clothing_type": "bomber",
        "clothing_base": (45, 30, 20), "clothing_accent": (245, 158, 11),
    },
    # 25: Crimson Lotus
    {
        "name": "Crimson Lotus",
        "skin": ((252, 230, 216), (226, 194, 174)),
        "hair_base": (244, 63, 94), "hair_dark": (180, 20, 55), "hair_hi": (253, 164, 175),
        "style": "twin_tails",
        "clothing_type": "tactical_jacket",
        "clothing_base": (24, 24, 28), "clothing_accent": (244, 63, 94),
    },
    # 26: Stellar Oracle
    {
        "name": "Stellar Oracle",
        "skin": ((252, 232, 218), (226, 196, 176)),
        "hair_base": (30, 58, 138), "hair_dark": (15, 25, 70), "hair_hi": (96, 165, 250),
        "style": "flowing_waves",
        "clothing_type": "tech_hoodie",
        "clothing_base": (15, 23, 42), "clothing_accent": (96, 165, 250),
    },
    # 27: Bronze Gladiator
    {
        "name": "Bronze Gladiator",
        "skin": ((195, 145, 115), (165, 115, 85)),
        "hair_base": (30, 24, 22), "hair_dark": (15, 12, 10), "hair_hi": (75, 65, 60),
        "style": "wolf_cut",
        "clothing_type": "street_vest",
        "clothing_base": (30, 30, 34), "clothing_accent": (217, 119, 6),
    }
]

def render_color_tile(arch):
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    skin_base, skin_shadow = arch["skin"]
    hair_base = arch["hair_base"] + (255,)
    hair_dark = arch["hair_dark"] + (255,)
    hair_hi = arch["hair_hi"] + (255,)
    c_base = arch["clothing_base"] + (255,)
    c_acc = arch["clothing_accent"] + (255,)
    style = arch["style"]
    c_type = arch["clothing_type"]

    # ---------------------------------------------------------
    # 1. Back Hair (Layered behind neck and shoulders)
    # ---------------------------------------------------------
    if style == "twin_tails":
        l_pts = [(118, 125), (70, 165), (52, 245), (75, 295), (95, 255), (115, 185)]
        d.polygon(l_pts, fill=hair_dark)
        d.line(l_pts + [l_pts[0]], fill=(15, 15, 20, 255), width=3)
        r_pts = [(266, 125), (314, 165), (332, 245), (309, 295), (289, 255), (269, 185)]
        d.polygon(r_pts, fill=hair_dark)
        d.line(r_pts + [r_pts[0]], fill=(15, 15, 20, 255), width=3)
    elif style == "drill_curls":
        l_pts = [(116, 135), (75, 175), (65, 225), (85, 265), (75, 300), (98, 305), (105, 245), (95, 205), (120, 165)]
        r_pts = [(268, 135), (309, 175), (319, 225), (299, 265), (309, 300), (286, 305), (279, 245), (289, 205), (264, 165)]
        d.polygon(l_pts, fill=hair_dark)
        d.polygon(r_pts, fill=hair_dark)
        d.line(l_pts + [l_pts[0]], fill=(15, 15, 20, 255), width=3)
        d.line(r_pts + [r_pts[0]], fill=(15, 15, 20, 255), width=3)
    elif style == "high_ponytail":
        pony = [(235, 65), (305, 45), (338, 95), (318, 170), (282, 185), (268, 120)]
        d.polygon(pony, fill=hair_dark)
        d.line(pony + [pony[0]], fill=(15, 15, 20, 255), width=3)
        d.ellipse([230, 60, 246, 76], fill=c_acc)
    elif style in ["flowing_waves", "wavy_layers", "hime_cut"]:
        b_pts = [
            (115, 120), (82, 175), (74, 250), (96, 310), (124, 305), (118, 230),
            (266, 230), (260, 305), (288, 310), (310, 250), (302, 175), (269, 120)
        ]
        d.polygon(b_pts, fill=hair_dark)
        d.line(b_pts + [b_pts[0]], fill=(15, 15, 20, 255), width=3)
    elif style in ["wolf_cut", "messy_shonen"]:
        w_pts = [
            (120, 130), (90, 180), (85, 235), (105, 245), (118, 210),
            (266, 210), (279, 245), (299, 235), (294, 180), (264, 130)
        ]
        d.polygon(w_pts, fill=hair_dark)

    # ---------------------------------------------------------
    # 2. Neck & Anatomical Shading
    # ---------------------------------------------------------
    neck_pts = [(165, 225), (165, 310), (219, 310), (219, 225)]
    d.polygon(neck_pts, fill=skin_base + (255,))
    
    neck_shadow = [(165, 236), (192, 268), (219, 236), (219, 275), (165, 275)]
    d.polygon(neck_shadow, fill=skin_shadow + (255,))

    d.line([(180, 262), (188, 305)], fill=skin_shadow + (160,), width=3)
    d.line([(204, 262), (196, 305)], fill=skin_shadow + (160,), width=3)
    d.line([(170, 310), (192, 316), (214, 310)], fill=skin_shadow + (180,), width=3)

    # ---------------------------------------------------------
    # 3. Shoulders & Modern Streetwear Clothing
    # ---------------------------------------------------------
    if c_type == "tech_hoodie":
        hoodie_pts = [
            (60, 384), (75, 335), (120, 310), (160, 298), (192, 320), (224, 298),
            (264, 310), (309, 335), (324, 384)
        ]
        d.polygon(hoodie_pts, fill=c_base)
        d.line([(160, 298), (192, 320), (224, 298)], fill=c_acc, width=5)
        d.line([(180, 320), (180, 365)], fill=(245, 245, 250, 255), width=4)
        d.line([(204, 320), (204, 365)], fill=(245, 245, 250, 255), width=4)
        d.line([(180, 362), (180, 367)], fill=c_acc, width=5)
        d.line([(204, 362), (204, 367)], fill=c_acc, width=5)
        d.line([(120, 310), (105, 384)], fill=(15, 15, 20, 180), width=3)
        d.line([(264, 310), (279, 384)], fill=(15, 15, 20, 180), width=3)
        d.line(hoodie_pts + [hoodie_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "tactical_jacket":
        jack_pts = [
            (60, 384), (75, 335), (120, 305), (155, 280), (175, 270), (192, 310),
            (209, 270), (229, 280), (264, 305), (309, 335), (324, 384)
        ]
        d.polygon(jack_pts, fill=c_base)
        d.line([(175, 270), (192, 310), (198, 384)], fill=(210, 215, 225, 255), width=4)
        d.polygon([(115, 310), (145, 300), (140, 320), (110, 330)], fill=c_acc)
        d.polygon([(269, 310), (239, 300), (244, 320), (274, 330)], fill=c_acc)
        d.line(jack_pts + [jack_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "turtleneck":
        t_pts = [
            (60, 384), (75, 335), (120, 310), (155, 290), (155, 245), (192, 250),
            (229, 245), (229, 290), (264, 310), (309, 335), (324, 384)
        ]
        d.polygon(t_pts, fill=c_base)
        for y_r in [260, 272, 284]:
            d.line([(156, y_r), (228, y_r)], fill=c_acc, width=3)
        d.line(t_pts + [t_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "bomber":
        b_pts = [
            (60, 384), (75, 330), (120, 305), (160, 300), (192, 335), (224, 300),
            (264, 305), (309, 330), (324, 384)
        ]
        d.polygon(b_pts, fill=c_base)
        d.line([(192, 335), (192, 384)], fill=(220, 225, 235, 255), width=5)
        d.line([(160, 300), (192, 335), (224, 300)], fill=c_acc, width=6)
        d.line(b_pts + [b_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "blazer_tie":
        blaz_pts = [
            (60, 384), (75, 335), (120, 305), (150, 300), (192, 360), (234, 300),
            (264, 305), (309, 335), (324, 384)
        ]
        d.polygon(blaz_pts, fill=c_base)
        d.polygon([(160, 300), (192, 350), (224, 300)], fill=(248, 250, 255, 255))
        d.polygon([(188, 310), (196, 310), (194, 365), (190, 365)], fill=c_acc)
        d.line([(150, 300), (175, 340), (192, 360)], fill=(15, 15, 20, 255), width=3)
        d.line([(234, 300), (209, 340), (192, 360)], fill=(15, 15, 20, 255), width=3)
        d.line(blaz_pts + [blaz_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "track_jacket":
        tr_pts = [
            (60, 384), (75, 335), (120, 305), (158, 290), (192, 305), (226, 290),
            (264, 305), (309, 335), (324, 384)
        ]
        d.polygon(tr_pts, fill=c_base)
        d.line([(90, 350), (135, 310)], fill=c_acc, width=4)
        d.line([(294, 350), (249, 310)], fill=c_acc, width=4)
        d.line([(192, 305), (192, 384)], fill=(230, 235, 245, 255), width=4)
        d.line(tr_pts + [tr_pts[0]], fill=(15, 15, 20, 255), width=4)

    elif c_type == "cozy_scarf":
        sh_pts = [(60, 384), (75, 335), (120, 310), (264, 310), (309, 335), (324, 384)]
        d.polygon(sh_pts, fill=(30, 35, 45, 255))
        sc_pts = [(140, 260), (192, 275), (244, 260), (252, 320), (192, 340), (132, 320)]
        d.polygon(sc_pts, fill=c_base)
        d.polygon([(175, 315), (210, 315), (215, 375), (170, 375)], fill=c_acc)
        d.line(sc_pts + [sc_pts[0]], fill=(15, 15, 20, 255), width=4)

    else:
        c_pts = [
            (60, 384), (75, 335), (120, 310), (158, 300), (192, 335), (226, 300),
            (264, 310), (309, 335), (324, 384)
        ]
        d.polygon(c_pts, fill=c_base)
        d.polygon([(165, 300), (192, 335), (219, 300)], fill=c_acc)
        d.line(c_pts + [c_pts[0]], fill=(15, 15, 20, 255), width=4)

    # ---------------------------------------------------------
    # 4. Ears
    # ---------------------------------------------------------
    d.ellipse([108, 122, 128, 168], fill=skin_base + (255,), outline=(160, 115, 95, 255), width=3)
    d.ellipse([114, 132, 125, 158], fill=skin_shadow + (255,))
    d.ellipse([256, 122, 276, 168], fill=skin_base + (255,), outline=(160, 115, 95, 255), width=3)
    d.ellipse([259, 132, 270, 158], fill=skin_shadow + (255,))

    # ---------------------------------------------------------
    # 5. Face Contour (Smooth, Semi-realistic Anime Jawline)
    # ---------------------------------------------------------
    face_pts = [
        (124, 90), (122, 130), (128, 175), (142, 215), (165, 240),
        (185, 250), (192, 251), (199, 250), (219, 240), (242, 215),
        (256, 175), (262, 130), (260, 90), (192, 70)
    ]
    d.polygon(face_pts, fill=skin_base + (255,))

    d.line([
        (124, 90), (122, 130), (128, 175), (142, 215), (165, 240),
        (185, 250), (192, 251), (199, 250), (219, 240), (242, 215),
        (256, 175), (262, 130), (260, 90)
    ], fill=(160, 115, 95, 255), width=3)

    # Soft Airbrushed Cheek Blush (Gaussian Blur)
    blush_layer = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blush_layer)
    bd.ellipse([136, 168, 164, 192], fill=(248, 125, 125, 125))
    bd.ellipse([220, 168, 248, 192], fill=(248, 125, 125, 125))
    blush_layer = blush_layer.filter(ImageFilter.GaussianBlur(radius=7))
    im.alpha_composite(blush_layer)

    # ---------------------------------------------------------
    # 6. Sculpted Anime Nose
    # ---------------------------------------------------------
    d = ImageDraw.Draw(im)
    d.line([(190, 148), (190, 175)], fill=skin_shadow + (140,), width=2)
    d.line([(192, 150), (192, 176)], fill=(255, 250, 245, 180), width=2)
    d.ellipse([191, 176, 194, 179], fill=(255, 255, 255, 220))
    d.polygon([(188, 181), (193, 180), (196, 182), (192, 183)], fill=(160, 110, 90, 255))

    # ---------------------------------------------------------
    # 7. Volumetric Hair Crown & Bangs
    # ---------------------------------------------------------
    if style == "messy_shonen":
        crown_pts = [
            (192, 38), (160, 48), (130, 40), (108, 72), (85, 82), (92, 128), (76, 145),
            (88, 188), (105, 205), (118, 165), (135, 142), (155, 148), (172, 126),
            (192, 138), (212, 126), (229, 148), (249, 142), (266, 165), (279, 205),
            (296, 188), (308, 145), (292, 128), (299, 82), (276, 72), (254, 40), (224, 48)
        ]
    elif style == "curtain_bangs":
        crown_pts = [
            (192, 35), (150, 42), (115, 62), (92, 100), (78, 150), (86, 205), (106, 220),
            (120, 170), (142, 145), (168, 136), (184, 152), (192, 135), (200, 152),
            (216, 136), (242, 145), (264, 170), (278, 220), (298, 205), (306, 150),
            (292, 100), (269, 62), (234, 42)
        ]
    elif style == "side_part_fringe":
        crown_pts = [
            (192, 35), (150, 44), (115, 65), (88, 102), (75, 148), (85, 205), (105, 225),
            (118, 175), (135, 160), (155, 172), (175, 138), (192, 148), (220, 132),
            (250, 152), (275, 198), (295, 165), (306, 120), (290, 75), (250, 44), (220, 36)
        ]
    elif style == "wolf_cut":
        crown_pts = [
            (192, 28), (158, 45), (135, 30), (115, 72), (75, 85), (85, 135), (62, 150),
            (78, 195), (100, 225), (118, 175), (140, 160), (165, 175), (192, 145),
            (218, 175), (245, 160), (268, 175), (284, 225), (306, 195), (322, 150),
            (299, 135), (309, 85), (269, 72), (249, 30), (226, 45)
        ]
    elif style == "twin_tails":
        crown_pts = [
            (192, 38), (150, 45), (120, 68), (95, 110), (82, 160), (95, 215), (110, 228),
            (122, 175), (142, 150), (165, 165), (192, 142), (219, 165), (242, 150),
            (262, 175), (274, 228), (289, 215), (302, 160), (289, 110), (264, 68), (234, 45)
        ]
    elif style == "short_undercut":
        crown_pts = [
            (192, 32), (160, 42), (135, 36), (115, 65), (102, 95), (108, 135), (118, 160),
            (138, 140), (162, 145), (192, 130), (222, 145), (246, 140), (266, 160),
            (276, 135), (282, 95), (269, 65), (249, 36), (224, 42)
        ]
    elif style == "hime_cut":
        crown_pts = [
            (192, 35), (145, 42), (112, 65), (88, 105), (80, 165), (84, 230), (104, 230),
            (108, 170), (130, 150), (155, 150), (192, 150), (229, 150), (254, 150),
            (276, 170), (280, 230), (300, 230), (304, 165), (296, 105), (272, 65), (239, 42)
        ]
    elif style == "runner_spikes":
        crown_pts = [
            (192, 22), (165, 45), (140, 28), (125, 65), (90, 60), (98, 105), (75, 115),
            (88, 165), (105, 185), (120, 145), (140, 125), (165, 135), (192, 115),
            (219, 135), (244, 125), (264, 145), (279, 185), (296, 165), (309, 115),
            (286, 105), (294, 60), (259, 65), (244, 28), (219, 45)
        ]
    else:
        crown_pts = [
            (192, 36), (152, 45), (118, 68), (90, 108), (78, 158), (88, 215), (108, 228),
            (120, 178), (140, 155), (165, 168), (192, 146), (219, 168), (244, 155),
            (264, 178), (276, 228), (296, 215), (306, 158), (294, 108), (266, 68), (232, 45)
        ]

    d.polygon(crown_pts, fill=hair_base)

    d.line([(192, 38), (192, 140)], fill=hair_dark, width=3)
    d.line([(160, 48), (168, 132)], fill=hair_dark, width=3)
    d.line([(224, 48), (216, 132)], fill=hair_dark, width=3)
    d.line([(130, 40), (135, 142)], fill=hair_dark, width=3)
    d.line([(254, 40), (249, 142)], fill=hair_dark, width=3)

    # Anisotropic "Angel Ring" Specular Hair Sheen
    halo = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    halo_pts = [(135, 82), (160, 72), (192, 68), (224, 72), (249, 82), (244, 94), (192, 80), (139, 94)]
    hd.polygon(halo_pts, fill=hair_hi)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=3))
    im.alpha_composite(halo)

    d = ImageDraw.Draw(im)
    d.line(crown_pts + [crown_pts[0]], fill=(25, 20, 25, 255), width=3)

    if style == "runner_spikes":
        d.polygon([(118, 90), (192, 80), (266, 90), (266, 110), (192, 100), (118, 110)], fill=(250, 250, 252, 255))
        d.line([(118, 90), (192, 80), (266, 90), (266, 110), (192, 100), (118, 110), (118, 90)], fill=(30, 30, 35, 255), width=3)

    return im.resize((96, 96), Image.Resampling.LANCZOS)


# ==============================================================================
# 2. EYES ATLAS — 57 EYE STYLES (Multi-layer Luminous Depth)
# ==============================================================================

EYE_PALETTES = [
    ("sapphire", (18, 45, 115), (30, 130, 235), (105, 220, 255)),
    ("ruby", (110, 14, 25), (220, 35, 55), (255, 130, 150)),
    ("emerald", (8, 65, 45), (16, 185, 129), (110, 245, 195)),
    ("amethyst", (65, 18, 105), (168, 85, 247), (230, 190, 255)),
    ("amber", (115, 55, 10), (234, 140, 15), (254, 225, 95)),
    ("cyan", (12, 85, 105), (6, 182, 212), (165, 243, 252)),
    ("rose", (125, 20, 55), (244, 63, 94), (254, 180, 200)),
    ("slate", (35, 45, 60), (100, 116, 139), (203, 213, 225)),
    ("gold", (110, 75, 12), (218, 165, 32), (254, 240, 138)),
]

def render_eyes_tile(idx):
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    p_name, c_base, c_mid, c_light = EYE_PALETTES[idx % len(EYE_PALETTES)]
    shape_type = idx % 7
    brow_type = (idx // 7) % 5

    # ---------------------------------------------------------
    # 1. Sculpted Eyebrows (Positioned Y = 106..120)
    # ---------------------------------------------------------
    brow_col = (30, 22, 22, 255)
    if brow_type == 0: # Confident arched
        d.line([(135, 116), (155, 108), (174, 112)], fill=brow_col, width=4)
        d.line([(140, 114), (160, 107)], fill=brow_col, width=3)
        d.line([(210, 112), (229, 108), (249, 116)], fill=brow_col, width=4)
        d.line([(224, 107), (244, 114)], fill=brow_col, width=3)
    elif brow_type == 1: # Determined sharp slant
        d.line([(135, 118), (155, 110), (174, 105)], fill=brow_col, width=4)
        d.line([(142, 116), (162, 108)], fill=brow_col, width=3)
        d.line([(210, 105), (229, 110), (249, 118)], fill=brow_col, width=4)
        d.line([(222, 108), (242, 116)], fill=brow_col, width=3)
    elif brow_type == 2: # Gentle curved
        d.line([(135, 112), (155, 107), (174, 113)], fill=brow_col, width=4)
        d.line([(210, 113), (229, 107), (249, 112)], fill=brow_col, width=4)
    elif brow_type == 3: # Inquisitive / raised
        d.line([(135, 108), (155, 100), (174, 106)], fill=brow_col, width=4)
        d.line([(210, 110), (229, 106), (249, 114)], fill=brow_col, width=4)
    else: # Stoic straight
        d.line([(135, 114), (174, 114)], fill=brow_col, width=4)
        d.line([(210, 114), (249, 114)], fill=brow_col, width=4)

    # ---------------------------------------------------------
    # 2. Double-Eyelid Crease
    # ---------------------------------------------------------
    crease_col = (180, 135, 115, 180)
    d.line([(140, 124), (155, 120), (170, 123)], fill=crease_col, width=2)
    d.line([(214, 123), (229, 120), (244, 124)], fill=crease_col, width=2)

    # ---------------------------------------------------------
    # 3. Eye Geometry & Sclera
    # ---------------------------------------------------------
    if shape_type == 0: # Classic Winged Cat Lash
        d.polygon([(138, 135), (155, 127), (172, 135), (168, 153), (145, 153)], fill=(250, 252, 255, 255))
        d.polygon([(212, 135), (229, 127), (246, 135), (241, 153), (218, 153)], fill=(250, 252, 255, 255))
        d.polygon([(138, 135), (155, 127), (172, 135), (170, 140), (140, 140)], fill=(195, 202, 218, 150))
        d.polygon([(212, 135), (229, 127), (246, 135), (244, 140), (214, 140)], fill=(195, 202, 218, 150))
        # Left Iris
        d.ellipse([146, 128, 168, 155], fill=c_base + (255,))
        d.chord([147, 135, 167, 154], start=0, end=180, fill=c_mid + (255,))
        d.chord([149, 141, 165, 153], start=0, end=180, fill=c_light + (255,))
        d.ellipse([153, 134, 161, 147], fill=(12, 15, 24, 255))
        d.ellipse([150, 132, 155, 138], fill=(255, 255, 255, 255))
        d.ellipse([160, 144, 164, 148], fill=(255, 255, 255, 200))
        # Right Iris
        d.ellipse([216, 128, 238, 155], fill=c_base + (255,))
        d.chord([217, 135, 237, 154], start=0, end=180, fill=c_mid + (255,))
        d.chord([219, 141, 235, 153], start=0, end=180, fill=c_light + (255,))
        d.ellipse([223, 134, 231, 147], fill=(12, 15, 24, 255))
        d.ellipse([220, 132, 225, 138], fill=(255, 255, 255, 255))
        d.ellipse([230, 144, 234, 148], fill=(255, 255, 255, 200))
        # Eyeliner winged flicks
        d.line([(133, 136), (145, 128), (160, 127), (175, 133)], fill=(20, 20, 25, 255), width=6)
        d.line([(131, 137), (140, 131)], fill=(20, 20, 25, 255), width=4)
        d.line([(209, 133), (224, 127), (239, 128), (251, 136)], fill=(20, 20, 25, 255), width=6)
        d.line([(244, 131), (253, 137)], fill=(20, 20, 25, 255), width=4)
        d.line([(145, 154), (165, 154)], fill=(120, 85, 75, 190), width=2)
        d.line([(219, 154), (239, 154)], fill=(120, 85, 75, 190), width=2)

    elif shape_type == 1: # Shojo Starry Catchlights
        d.polygon([(136, 133), (155, 124), (174, 133), (168, 156), (142, 156)], fill=(250, 252, 255, 255))
        d.polygon([(210, 133), (229, 124), (248, 133), (242, 156), (216, 156)], fill=(250, 252, 255, 255))
        d.polygon([(136, 133), (155, 124), (174, 133), (170, 138), (140, 138)], fill=(195, 202, 218, 150))
        d.polygon([(210, 133), (229, 124), (248, 133), (244, 138), (214, 138)], fill=(195, 202, 218, 150))
        for cx in [155, 229]:
            d.ellipse([cx - 12, 126, cx + 12, 156], fill=c_base + (255,))
            d.chord([cx - 11, 134, cx + 11, 155], start=0, end=180, fill=c_mid + (255,))
            d.chord([cx - 9, 142, cx + 9, 154], start=0, end=180, fill=c_light + (255,))
            d.ellipse([cx - 4, 133, cx + 4, 145], fill=(12, 15, 24, 255))
            d.ellipse([cx - 7, 130, cx - 2, 137], fill=(255, 255, 255, 255))
            d.ellipse([cx + 3, 143, cx + 8, 149], fill=(255, 255, 255, 230))
            d.ellipse([cx - 5, 145, cx - 2, 148], fill=(255, 255, 255, 180))
        d.line([(133, 134), (155, 124), (176, 131)], fill=(20, 20, 25, 255), width=6)
        d.line([(208, 131), (229, 124), (251, 134)], fill=(20, 20, 25, 255), width=6)
        d.line([(144, 156), (166, 156)], fill=(120, 85, 75, 190), width=2)
        d.line([(218, 156), (240, 156)], fill=(120, 85, 75, 190), width=2)

    elif shape_type == 2: # Cool / Sleepy Half-Closed
        d.polygon([(136, 136), (155, 130), (174, 133), (168, 149), (142, 149)], fill=(250, 252, 255, 255))
        d.polygon([(210, 133), (229, 130), (248, 136), (242, 149), (216, 149)], fill=(250, 252, 255, 255))
        d.polygon([(136, 136), (155, 130), (174, 133), (170, 138), (140, 138)], fill=(185, 195, 215, 180))
        d.polygon([(210, 133), (229, 130), (248, 136), (244, 138), (214, 138)], fill=(185, 195, 215, 180))
        for cx in [155, 229]:
            d.ellipse([cx - 10, 131, cx + 10, 150], fill=c_base + (255,))
            d.chord([cx - 9, 137, cx + 9, 149], start=0, end=180, fill=c_mid + (255,))
            d.ellipse([cx - 3, 134, cx + 3, 143], fill=(12, 15, 24, 255))
            d.ellipse([cx - 6, 133, cx - 2, 138], fill=(255, 255, 255, 255))
        d.line([(133, 135), (155, 129), (176, 132)], fill=(20, 20, 25, 255), width=6)
        d.line([(208, 132), (229, 129), (251, 135)], fill=(20, 20, 25, 255), width=6)
        d.line([(144, 150), (166, 150)], fill=(120, 85, 75, 180), width=2)
        d.line([(218, 150), (240, 150)], fill=(120, 85, 75, 180), width=2)

    elif shape_type == 3: # Intense Determined Glare
        d.polygon([(138, 132), (155, 127), (174, 133), (168, 147), (144, 147)], fill=(250, 252, 255, 255))
        d.polygon([(210, 133), (229, 127), (246, 132), (240, 147), (216, 147)], fill=(250, 252, 255, 255))
        for cx in [156, 228]:
            d.ellipse([cx - 9, 127, cx + 9, 147], fill=c_base + (255,))
            d.chord([cx - 8, 133, cx + 8, 146], start=0, end=180, fill=c_mid + (255,))
            d.ellipse([cx - 3, 132, cx + 3, 140], fill=(12, 15, 24, 255))
            d.ellipse([cx - 5, 130, cx - 1, 135], fill=(255, 255, 255, 255))
        d.line([(133, 131), (155, 126), (176, 132)], fill=(20, 20, 25, 255), width=7)
        d.line([(208, 132), (229, 126), (251, 131)], fill=(20, 20, 25, 255), width=7)
        d.line([(144, 148), (166, 148)], fill=(120, 85, 75, 200), width=2)
        d.line([(218, 148), (240, 148)], fill=(120, 85, 75, 200), width=2)

    elif shape_type == 4: # Radiant Smiling Curved (^^)
        d.arc([136, 125, 174, 150], start=190, end=350, fill=(20, 20, 25, 255), width=6)
        d.arc([210, 125, 248, 150], start=190, end=350, fill=(20, 20, 25, 255), width=6)
        d.line([(133, 138), (142, 132)], fill=(20, 20, 25, 255), width=4)
        d.line([(242, 132), (251, 138)], fill=(20, 20, 25, 255), width=4)

    elif shape_type == 5: # Holographic Cyber Target Rings
        d.polygon([(138, 135), (155, 127), (172, 135), (168, 153), (145, 153)], fill=(15, 20, 35, 255))
        d.polygon([(212, 135), (229, 127), (246, 135), (241, 153), (218, 153)], fill=(15, 20, 35, 255))
        for cx in [155, 229]:
            d.ellipse([cx - 10, 130, cx + 10, 150], outline=c_mid + (255,), width=3)
            d.ellipse([cx - 4, 136, cx + 4, 144], fill=c_light + (255,))
            d.line([(cx - 12, 140), (cx - 7, 140)], fill=c_light + (255,), width=2)
            d.line([(cx + 7, 140), (cx + 12, 140)], fill=c_light + (255,), width=2)
        d.line([(133, 136), (155, 127), (175, 133)], fill=(20, 20, 25, 255), width=6)
        d.line([(209, 133), (229, 127), (251, 136)], fill=(20, 20, 25, 255), width=6)

    else: # Playful Wink
        d.arc([136, 127, 174, 152], start=190, end=350, fill=(20, 20, 25, 255), width=6)
        d.line([(133, 140), (142, 134)], fill=(20, 20, 25, 255), width=4)
        d.polygon([(212, 135), (229, 127), (246, 135), (241, 153), (218, 153)], fill=(250, 252, 255, 255))
        d.ellipse([218, 128, 238, 155], fill=c_base + (255,))
        d.chord([219, 135, 237, 154], start=0, end=180, fill=c_mid + (255,))
        d.chord([221, 141, 235, 153], start=0, end=180, fill=c_light + (255,))
        d.ellipse([225, 134, 231, 147], fill=(12, 15, 24, 255))
        d.ellipse([222, 132, 226, 138], fill=(255, 255, 255, 255))
        d.ellipse([231, 144, 234, 148], fill=(255, 255, 255, 200))
        d.line([(209, 133), (224, 127), (239, 128), (251, 136)], fill=(20, 20, 25, 255), width=6)
        d.line([(244, 131), (253, 137)], fill=(20, 20, 25, 255), width=4)
        d.line([(219, 154), (239, 154)], fill=(120, 85, 75, 190), width=2)

    return im.resize((96, 96), Image.Resampling.LANCZOS)


# ==============================================================================
# 3. MOUTH ATLAS — 51 EXPRESSIONS (3D Lip Volumetrics & Shading)
# ==============================================================================

def render_mouth_tile(idx):
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    m_type = idx % 10
    w_scale = 1.0 + (idx % 3) * 0.12
    y_shift = ((idx // 10) % 3) * 2

    lip_line = (140, 50, 55, 255)
    corner_tuck = (100, 35, 40, 255)
    lip_shadow = (185, 105, 95, 160)
    lip_highlight = (255, 240, 235, 210)

    if m_type == 0: # Confident subtle smirk
        p1 = (192 - int(14 * w_scale), 206 + y_shift)
        p2 = (192, 207 + y_shift)
        p3 = (192 + int(15 * w_scale), 203 + y_shift)
        p4 = (192 + int(19 * w_scale), 199 + y_shift)
        d.line([p1, p2, p3, p4], fill=lip_line, width=3)
        d.ellipse([p1[0] - 1, p1[1] - 1, p1[0] + 1, p1[1] + 1], fill=corner_tuck)
        d.ellipse([p4[0] - 1, p4[1] - 1, p4[0] + 1, p4[1] + 1], fill=corner_tuck)
        d.chord([186, 211 + y_shift, 200, 217 + y_shift], start=0, end=180, fill=lip_shadow)
        d.line([(190, 212 + y_shift), (195, 212 + y_shift)], fill=lip_highlight, width=2)

    elif m_type == 1: # Warm gentle smile
        hw = int(14 * w_scale)
        p1 = (192 - hw, 206 + y_shift)
        p2 = (192, 209 + y_shift)
        p3 = (192 + hw, 206 + y_shift)
        d.line([p1, p2, p3], fill=lip_line, width=3)
        d.ellipse([p1[0] - 1, p1[1] - 1, p1[0] + 1, p1[1] + 1], fill=corner_tuck)
        d.ellipse([p3[0] - 1, p3[1] - 1, p3[0] + 1, p3[1] + 1], fill=corner_tuck)
        d.chord([184, 212 + y_shift, 200, 218 + y_shift], start=0, end=180, fill=lip_shadow)
        d.line([(189, 213 + y_shift), (195, 213 + y_shift)], fill=lip_highlight, width=2)

    elif m_type == 2: # Cheerful open smile
        hw = int(15 * w_scale)
        pts = [(192 - hw, 203 + y_shift), (192 + hw, 203 + y_shift), (192, 222 + y_shift)]
        d.polygon(pts, fill=(136, 19, 55, 255))
        d.polygon([(192 - hw + 2, 203 + y_shift), (192 + hw - 2, 203 + y_shift), (192 + hw - 5, 208 + y_shift), (192 - hw + 5, 208 + y_shift)], fill=(255, 255, 255, 255))
        d.ellipse([192 - int(8 * w_scale), 212 + y_shift, 192 + int(8 * w_scale), 224 + y_shift], fill=(251, 113, 133, 255))
        d.line([pts[0], pts[1]], fill=lip_line, width=3)
        d.line([pts[0], pts[2], pts[1]], fill=lip_line, width=3)

    elif m_type == 3: # Focused grit / clenched teeth
        hw = int(15 * w_scale)
        x1 = 192 - hw
        x2 = 192 + hw
        y = 205 + y_shift
        d.rounded_rectangle([x1, y - 3, x2, y + 3], radius=2, fill=(252, 252, 255, 255), outline=lip_line, width=3)
        d.line([(192, y - 3), (192, y + 3)], fill=lip_line, width=2)
        d.chord([185, y + 6, 199, y + 11], start=0, end=180, fill=lip_shadow)

    elif m_type == 4: # Cute anime cat mouth (:3)
        cy = 205 + y_shift
        hw = int(12 * w_scale)
        d.arc([192 - hw, cy - 4, 192, cy + 6], start=20, end=165, fill=lip_line, width=3)
        d.arc([192, cy - 4, 192 + hw, cy + 6], start=15, end=160, fill=lip_line, width=3)
        d.ellipse([192 - hw, cy - 1, 192 - hw + 2, cy + 1], fill=corner_tuck)
        d.ellipse([192 + hw - 2, cy - 1, 192 + hw, cy + 1], fill=corner_tuck)
        d.chord([188, cy + 8, 196, cy + 12], start=0, end=180, fill=lip_shadow)

    elif m_type == 5: # Teasing playful tongue out (:P)
        hw = int(14 * w_scale)
        p1 = (192 - hw, 204 + y_shift)
        p2 = (192 + hw, 204 + y_shift)
        d.line([p1, p2], fill=lip_line, width=3)
        d.rounded_rectangle([192 - 6, 204 + y_shift, 192 + 6, 218 + y_shift], radius=5, fill=(251, 113, 133, 255), outline=lip_line, width=2)
        d.line([(192, 206 + y_shift), (192, 213 + y_shift)], fill=(225, 29, 72, 255), width=2)

    elif m_type == 6: # Small surprised 'o'
        rw = int(6 * w_scale)
        rh = int(8 * w_scale)
        d.ellipse([192 - rw, 203 + y_shift, 192 + rw, 203 + y_shift + rh], fill=(136, 19, 55, 255), outline=lip_line, width=3)
        d.chord([186, 203 + y_shift + rh + 3, 198, 203 + y_shift + rh + 7], start=0, end=180, fill=lip_shadow)

    elif m_type == 7: # Stoic calm line
        hw = int(12 * w_scale)
        d.line([(192 - hw, 207 + y_shift), (192 + hw, 207 + y_shift)], fill=lip_line, width=3)
        d.ellipse([192 - hw - 1, 206 + y_shift, 192 - hw + 1, 208 + y_shift], fill=corner_tuck)
        d.ellipse([192 + hw - 1, 206 + y_shift, 192 + hw + 1, 208 + y_shift], fill=corner_tuck)
        d.chord([186, 212 + y_shift, 198, 216 + y_shift], start=0, end=180, fill=lip_shadow)

    elif m_type == 8: # Wide triumphant open laugh
        hw = int(18 * w_scale)
        pts = [(192 - hw, 202 + y_shift), (192 + hw, 202 + y_shift), (192, 226 + y_shift)]
        d.polygon(pts, fill=(159, 18, 57, 255))
        d.polygon([(192 - hw + 3, 202 + y_shift), (192 + hw - 3, 202 + y_shift), (192 + hw - 6, 207 + y_shift), (192 - hw + 6, 207 + y_shift)], fill=(255, 255, 255, 255))
        d.ellipse([192 - 10, 214 + y_shift, 192 + 10, 228 + y_shift], fill=(251, 113, 133, 255))
        d.line(pts + [pts[0]], fill=lip_line, width=3)

    else: # Tsundere cute wavy lip
        hw = int(14 * w_scale)
        p1 = (192 - hw, 209 + y_shift)
        p2 = (192 - 5, 205 + y_shift)
        p3 = (192 + 5, 209 + y_shift)
        p4 = (192 + hw, 205 + y_shift)
        d.line([p1, p2, p3, p4], fill=lip_line, width=3)
        d.chord([186, 213 + y_shift, 198, 217 + y_shift], start=0, end=180, fill=lip_shadow)

    return im.resize((96, 96), Image.Resampling.LANCZOS)


# ==============================================================================
# 4. SPECIAL ATLAS — 20 MODERN ACCESSORIES (640x640 -> 160x160)
# ==============================================================================

def render_special_tile(idx):
    im = Image.new("RGBA", (W_160, H_160), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    acc_id = idx % 20

    if acc_id == 0: # Pro Cyan RGB Gaming Headset
        d.arc([190, 80, 450, 400], start=185, end=355, fill=(28, 35, 48, 255), width=22)
        d.arc([200, 90, 440, 390], start=190, end=350, fill=(6, 182, 212, 255), width=7)
        d.rounded_rectangle([180, 230, 235, 330], radius=16, fill=(18, 22, 30, 255), outline=(6, 182, 212, 255), width=7)
        d.rounded_rectangle([405, 230, 460, 330], radius=16, fill=(18, 22, 30, 255), outline=(6, 182, 212, 255), width=7)
        d.line([(205, 310), (220, 360), (280, 380)], fill=(30, 40, 55, 255), width=9)
        d.ellipse([275, 372, 292, 388], fill=(6, 182, 212, 255))

    elif acc_id == 1: # Crimson & Black Audio Headset
        d.arc([190, 80, 450, 400], start=185, end=355, fill=(24, 24, 27, 255), width=22)
        d.arc([200, 90, 440, 390], start=190, end=350, fill=(220, 38, 38, 255), width=7)
        d.rounded_rectangle([180, 230, 235, 330], radius=16, fill=(24, 24, 27, 255), outline=(220, 38, 38, 255), width=7)
        d.rounded_rectangle([405, 230, 460, 330], radius=16, fill=(24, 24, 27, 255), outline=(220, 38, 38, 255), width=7)

    elif acc_id == 2: # Streamer Neon Cat-Ear Headset
        d.arc([190, 80, 450, 400], start=185, end=355, fill=(35, 25, 45, 255), width=22)
        d.polygon([(220, 110), (210, 30), (260, 85)], fill=(35, 25, 45, 255))
        d.polygon([(225, 95), (220, 45), (250, 80)], fill=(244, 63, 94, 255))
        d.polygon([(420, 110), (430, 30), (380, 85)], fill=(35, 25, 45, 255))
        d.polygon([(415, 95), (420, 45), (390, 80)], fill=(244, 63, 94, 255))
        d.rounded_rectangle([180, 230, 235, 330], radius=16, fill=(35, 25, 45, 255), outline=(244, 63, 94, 255), width=7)
        d.rounded_rectangle([405, 230, 460, 330], radius=16, fill=(35, 25, 45, 255), outline=(244, 63, 94, 255), width=7)

    elif acc_id == 3: # Modern Slim Wireframe Glasses (Gold)
        d.ellipse([250, 232, 302, 284], outline=(218, 165, 32, 255), width=5)
        d.ellipse([338, 232, 390, 284], outline=(218, 165, 32, 255), width=5)
        d.arc([298, 242, 342, 262], start=190, end=350, fill=(218, 165, 32, 255), width=5)
        d.line([(250, 252), (200, 238)], fill=(218, 165, 32, 255), width=4)
        d.line([(390, 252), (440, 238)], fill=(218, 165, 32, 255), width=4)
        d.line([(260, 245), (275, 240)], fill=(255, 255, 255, 180), width=2)
        d.line([(348, 245), (363, 240)], fill=(255, 255, 255, 180), width=2)

    elif acc_id == 4: # Stylish Matte Black Acetate Glasses
        d.rounded_rectangle([245, 235, 305, 275], radius=6, outline=(20, 20, 25, 255), width=7)
        d.rounded_rectangle([335, 235, 395, 275], radius=6, outline=(20, 20, 25, 255), width=7)
        d.line([(305, 250), (335, 250)], fill=(20, 20, 25, 255), width=7)
        d.line([(245, 245), (195, 235)], fill=(20, 20, 25, 255), width=5)
        d.line([(395, 245), (445, 235)], fill=(20, 20, 25, 255), width=5)

    elif acc_id == 5: # Crimson Half-Rim / Browline Designer Glasses
        d.line([(240, 238), (310, 238)], fill=(220, 38, 38, 255), width=8)
        d.line([(330, 238), (400, 238)], fill=(220, 38, 38, 255), width=8)
        d.line([(310, 242), (330, 242)], fill=(218, 165, 32, 255), width=5)
        d.arc([244, 238, 306, 278], start=0, end=180, fill=(200, 200, 210, 160), width=2)
        d.arc([334, 238, 396, 278], start=0, end=180, fill=(200, 200, 210, 160), width=2)

    elif acc_id == 6: # Holographic Cyan Cyber HUD Visor
        visor_pts = [(225, 232), (320, 222), (415, 232), (410, 272), (320, 282), (230, 272)]
        d.polygon(visor_pts, fill=(6, 182, 212, 140))
        d.line(visor_pts + [visor_pts[0]], fill=(34, 211, 238, 255), width=5)
        d.line([(250, 246), (305, 246)], fill=(255, 255, 255, 220), width=3)
        d.line([(335, 256), (390, 256)], fill=(255, 255, 255, 220), width=3)

    elif acc_id == 7: # Amber Tactical Combat Visor
        visor_pts = [(225, 232), (320, 222), (415, 232), (410, 272), (320, 282), (230, 272)]
        d.polygon(visor_pts, fill=(245, 158, 11, 150))
        d.line(visor_pts + [visor_pts[0]], fill=(251, 191, 36, 255), width=5)

    elif acc_id == 8: # Kitsune Fox Mask
        mask_pts = [(310, 110), (350, 50), (390, 110), (410, 150), (350, 185), (290, 150)]
        d.polygon(mask_pts, fill=(252, 252, 255, 255))
        d.polygon([(340, 75), (350, 55), (360, 75)], fill=(220, 38, 38, 255))
        d.arc([315, 130, 345, 155], start=180, end=360, fill=(220, 38, 38, 255), width=5)
        d.arc([355, 130, 385, 155], start=180, end=360, fill=(220, 38, 38, 255), width=5)
        d.line(mask_pts + [mask_pts[0]], fill=(25, 20, 20, 255), width=4)

    elif acc_id == 9: # Shinobi Metal Forehead Protector
        band_pts = [(240, 180), (320, 170), (400, 180), (400, 205), (320, 195), (240, 205)]
        d.polygon(band_pts, fill=(24, 24, 27, 255))
        plate_pts = [(280, 178), (320, 174), (360, 178), (360, 200), (320, 202), (280, 200)]
        d.polygon(plate_pts, fill=(203, 213, 225, 255))
        d.line(plate_pts + [plate_pts[0]], fill=(30, 41, 59, 255), width=3)
        d.ellipse([316, 184, 324, 192], fill=(30, 41, 59, 255))

    elif acc_id == 10: # Twin Golden Star Hairpins
        def draw_star(cx, cy, r):
            pts = []
            for i in range(10):
                angle = i * math.pi / 5 - math.pi / 2
                rad = r if i % 2 == 0 else r * 0.45
                pts.append((cx + rad * math.cos(angle), cy + rad * math.sin(angle)))
            d.polygon(pts, fill=(250, 204, 21, 255))
            d.line(pts + [pts[0]], fill=(180, 83, 9, 255), width=3)
        draw_star(245, 160, 17)
        draw_star(265, 175, 13)

    elif acc_id == 11: # Sakura Cherry Blossom Hairclip
        cx, cy = 250, 165
        for i in range(5):
            angle = i * 2 * math.pi / 5
            px = cx + 16 * math.cos(angle)
            py = cy + 16 * math.sin(angle)
            d.ellipse([px - 10, py - 10, px + 10, py + 10], fill=(251, 113, 133, 255))
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(254, 240, 138, 255))

    elif acc_id == 12: # Anime Protagonist Cheek Cross Bandage
        d.polygon([(245, 280), (275, 270), (270, 295), (240, 305)], fill=(254, 243, 199, 255))
        d.polygon([(245, 270), (275, 305), (265, 310), (235, 275)], fill=(254, 243, 199, 255))
        d.line([(240, 285), (270, 275)], fill=(217, 119, 6, 255), width=2)

    elif acc_id == 13: # Cozy Chunky Knitted Winter Muffler
        sc_pts = [(238, 380), (320, 395), (402, 380), (412, 460), (320, 480), (228, 460)]
        d.polygon(sc_pts, fill=(190, 24, 60, 255))
        for y_s in [405, 425, 445]:
            d.line([(235, y_s), (405, y_s)], fill=(255, 255, 255, 180), width=4)
        d.line(sc_pts + [sc_pts[0]], fill=(120, 15, 40, 255), width=5)

    elif acc_id == 14: # Tactical Streetwear Neck Gaiter
        sc_pts = [(238, 385), (320, 400), (402, 385), (412, 450), (320, 470), (228, 450)]
        d.polygon(sc_pts, fill=(28, 32, 42, 255))
        d.line(sc_pts + [sc_pts[0]], fill=(15, 18, 24, 255), width=5)

    elif acc_id == 15: # Royal Golden Filigree Circlet
        crown_pts = [(290, 110), (280, 60), (305, 80), (320, 45), (335, 80), (360, 60), (350, 110)]
        d.polygon(crown_pts, fill=(250, 204, 21, 255))
        d.line(crown_pts + [crown_pts[0]], fill=(180, 83, 9, 255), width=4)
        d.ellipse([316, 68, 324, 76], fill=(220, 38, 38, 255))

    elif acc_id == 16: # Ethereal Glowing Halo
        d.ellipse([250, 40, 390, 85], outline=(253, 224, 71, 255), width=9)

    elif acc_id == 17: # Cybernetic Cheek Data Nodes
        d.line([(245, 270), (260, 275), (280, 275)], fill=(6, 182, 212, 255), width=4)
        d.ellipse([278, 272, 284, 278], fill=(255, 255, 255, 255))
        d.line([(395, 270), (380, 275), (360, 275)], fill=(6, 182, 212, 255), width=4)
        d.ellipse([356, 272, 362, 278], fill=(255, 255, 255, 255))

    elif acc_id == 18: # Streetwear Neoprene Face Mask
        mask_pts = [(255, 280), (320, 270), (385, 280), (380, 360), (320, 380), (260, 360)]
        d.polygon(mask_pts, fill=(24, 24, 27, 255))
        d.line([(255, 285), (200, 275)], fill=(24, 24, 27, 255), width=5)
        d.line([(385, 285), (440, 275)], fill=(24, 24, 27, 255), width=5)
        d.line(mask_pts + [mask_pts[0]], fill=(10, 10, 12, 255), width=5)

    else: # DJ Headphones Resting Around Neck
        d.arc([220, 370, 420, 490], start=180, end=360, fill=(30, 40, 55, 255), width=20)
        d.rounded_rectangle([210, 360, 250, 420], radius=10, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=5)
        d.rounded_rectangle([390, 360, 430, 420], radius=10, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=5)

    return im.resize((160, 160), Image.Resampling.LANCZOS)


# ==============================================================================
# MAIN COMPILATION LOOP
# ==============================================================================

def main():
    print("=" * 60)
    print("BUILDING PREMIUM SEMI-REALISTIC ANIME SPRITE ATLASES")
    print("=" * 60)

    # 1. Color Atlas
    print("\n[1/4] Generating color_atlas.png (28 Base Archetypes, 10x10 Grid)...")
    color_atlas = Image.new("RGBA", (ATLAS_96_SIZE, ATLAS_96_SIZE), (0, 0, 0, 0))
    for idx in range(100):
        arch = ARCHETYPES[idx % len(ARCHETYPES)]
        tile = render_color_tile(arch)
        col = idx % 10
        row = idx // 10
        color_atlas.paste(tile, (col * 96, row * 96), tile)
    color_atlas_path = os.path.join(OUTPUT_DIR, "color_atlas.png")
    color_atlas.save(color_atlas_path)
    print(f"  ✓ color_atlas.png saved ({os.path.getsize(color_atlas_path)} bytes)")

    # 2. Eyes Atlas
    print("\n[2/4] Generating eyes_atlas.png (57 Eye Styles, 10x10 Grid)...")
    eyes_atlas = Image.new("RGBA", (ATLAS_96_SIZE, ATLAS_96_SIZE), (0, 0, 0, 0))
    for idx in range(100):
        tile = render_eyes_tile(idx)
        col = idx % 10
        row = idx // 10
        eyes_atlas.paste(tile, (col * 96, row * 96), tile)
    eyes_atlas_path = os.path.join(OUTPUT_DIR, "eyes_atlas.png")
    eyes_atlas.save(eyes_atlas_path)
    print(f"  ✓ eyes_atlas.png saved ({os.path.getsize(eyes_atlas_path)} bytes)")

    # 3. Mouth Atlas
    print("\n[3/4] Generating mouth_atlas.png (51 Expressions, 10x10 Grid)...")
    mouth_atlas = Image.new("RGBA", (ATLAS_96_SIZE, ATLAS_96_SIZE), (0, 0, 0, 0))
    for idx in range(100):
        tile = render_mouth_tile(idx)
        col = idx % 10
        row = idx // 10
        mouth_atlas.paste(tile, (col * 96, row * 96), tile)
    mouth_atlas_path = os.path.join(OUTPUT_DIR, "mouth_atlas.png")
    mouth_atlas.save(mouth_atlas_path)
    print(f"  ✓ mouth_atlas.png saved ({os.path.getsize(mouth_atlas_path)} bytes)")

    # 4. Special Atlas
    print("\n[4/4] Generating special_atlas.png (20 Modern Accessories, 10x10 Grid)...")
    special_atlas = Image.new("RGBA", (ATLAS_160_SIZE, ATLAS_160_SIZE), (0, 0, 0, 0))
    for idx in range(100):
        tile = render_special_tile(idx)
        col = idx % 10
        row = idx // 10
        special_atlas.paste(tile, (col * 160, row * 160), tile)
    special_atlas_path = os.path.join(OUTPUT_DIR, "special_atlas.png")
    special_atlas.save(special_atlas_path)
    print(f"  ✓ special_atlas.png saved ({os.path.getsize(special_atlas_path)} bytes)")

    print("\n" + "=" * 60)
    print("ALL 4 PREMIUM SPRITE ATLASES COMPILED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
