import os
import math
from PIL import Image, ImageDraw

OUTPUT_DIR = "/home/shaber/skribbl.io/img/avatar"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SCALE = 4
CELL_96 = 96 * SCALE    # 384
CELL_160 = 160 * SCALE  # 640
ATLAS_96_SIZE = 960     # 10 columns * 96
ATLAS_160_SIZE = 1600   # 10 columns * 160

# ==========================================
# 1. COLOR ATLAS GENERATOR (28 Base Archetypes)
# ==========================================

ARCHETYPES = [
    # 0: Calm Strategist
    {
        "name": "Calm Strategist",
        "skin": ((246, 222, 204), (224, 190, 168)),
        "hair": ((36, 48, 70), (22, 30, 46), (75, 100, 140)),
        "style": "side_swept",
        "collar": ((28, 38, 58), (218, 175, 65)),
        "collar_type": "high_collar"
    },
    # 1: Energetic Gamer
    {
        "name": "Energetic Gamer",
        "skin": ((250, 225, 205), (228, 192, 170)),
        "hair": ((6, 182, 212), (8, 145, 178), (103, 232, 249)),
        "style": "spiky_shonen",
        "collar": ((30, 25, 45), (168, 85, 247)),
        "collar_type": "hoodie"
    },
    # 2: Confident Leader
    {
        "name": "Confident Leader",
        "skin": ((248, 224, 204), (225, 190, 168)),
        "hair": ((220, 38, 38), (153, 27, 27), (248, 113, 113)),
        "style": "shonen",
        "collar": ((24, 24, 28), (220, 38, 38)),
        "collar_type": "jacket"
    },
    # 3: Quiet Genius
    {
        "name": "Quiet Genius",
        "skin": ((252, 232, 216), (230, 198, 180)),
        "hair": ((226, 232, 240), (148, 163, 184), (255, 255, 255)),
        "style": "curtain_bangs",
        "collar": ((30, 35, 45), (71, 85, 105)),
        "collar_type": "turtleneck"
    },
    # 4: Speed Artist / Runner
    {
        "name": "Speed Runner",
        "skin": ((245, 218, 195), (220, 185, 160)),
        "hair": ((245, 158, 11), (180, 83, 9), (253, 224, 71)),
        "style": "spiky_runner",
        "collar": ((234, 88, 12), (255, 255, 255)),
        "collar_type": "jersey"
    },
    # 5: Creative Artist
    {
        "name": "Creative Artist",
        "skin": ((250, 226, 210), (228, 194, 175)),
        "hair": ((167, 139, 250), (124, 58, 237), (221, 214, 254)),
        "style": "wavy_beret",
        "collar": ((15, 118, 110), (94, 234, 212)),
        "collar_type": "casual"
    },
    # 6: Hacker Specialist
    {
        "name": "Hacker Specialist",
        "skin": ((244, 220, 200), (218, 184, 162)),
        "hair": ((5, 150, 105), (4, 120, 87), (52, 211, 153)),
        "style": "hacker_bob",
        "collar": ((17, 24, 39), (16, 185, 129)),
        "collar_type": "hoodie"
    },
    # 7: Wandering Explorer
    {
        "name": "Wandering Explorer",
        "skin": ((235, 198, 168), (205, 162, 132)),
        "hair": ((120, 53, 15), (69, 26, 3), (180, 83, 9)),
        "style": "messy_waves",
        "collar": ((194, 65, 12), (254, 215, 170)),
        "collar_type": "scarf"
    },
    # 8: Competitive Fighter
    {
        "name": "Competitive Fighter",
        "skin": ((245, 215, 192), (218, 180, 155)),
        "hair": ((24, 24, 27), (9, 9, 11), (82, 82, 91)),
        "style": "fighter_crop",
        "collar": ((39, 39, 42), (239, 68, 68)),
        "collar_type": "casual"
    },
    # 9: Friendly Neighbor
    {
        "name": "Friendly Neighbor",
        "skin": ((252, 228, 212), (230, 196, 178)),
        "hair": ((217, 119, 6), (146, 64, 14), (251, 191, 36)),
        "style": "friendly_bob",
        "collar": ((214, 211, 209), (168, 162, 158)),
        "collar_type": "casual"
    },
    # 10: Serious Detective
    {
        "name": "Serious Detective",
        "skin": ((248, 224, 206), (224, 192, 172)),
        "hair": ((15, 23, 42), (2, 6, 23), (51, 65, 85)),
        "style": "detective_part",
        "collar": ((15, 23, 42), (185, 28, 28)),
        "collar_type": "uniform"
    },
    # 11: Playful Trickster
    {
        "name": "Playful Trickster",
        "skin": ((250, 222, 202), (226, 188, 166)),
        "hair": ((234, 88, 12), (154, 52, 18), (251, 146, 60)),
        "style": "wild_spikes",
        "collar": ((31, 41, 55), (249, 115, 22)),
        "collar_type": "jacket"
    },
    # 12: Shadow Infiltrator
    {
        "name": "Shadow Infiltrator",
        "skin": ((242, 218, 200), (216, 182, 162)),
        "hair": ((59, 7, 100), (36, 0, 70), (126, 34, 206)),
        "style": "shadow_curtains",
        "collar": ((20, 10, 30), (147, 51, 234)),
        "collar_type": "ninja"
    },
    # 13: Mecha Pilot
    {
        "name": "Mecha Pilot",
        "skin": ((248, 224, 205), (225, 190, 168)),
        "hair": ((37, 99, 235), (29, 78, 216), (96, 165, 250)),
        "style": "shonen",
        "collar": ((241, 245, 249), (249, 115, 22)),
        "collar_type": "high_collar"
    },
    # 14: Fantasy Mage
    {
        "name": "Fantasy Mage",
        "skin": ((253, 234, 220), (232, 202, 185)),
        "hair": ((147, 197, 253), (59, 130, 246), (239, 246, 255)),
        "style": "twin_tails",
        "collar": ((30, 41, 59), (96, 165, 250)),
        "collar_type": "high_collar"
    },
    # 15: Rhythm Idol
    {
        "name": "Rhythm Idol",
        "skin": ((250, 225, 208), (228, 192, 172)),
        "hair": ((244, 63, 94), (190, 18, 60), (251, 113, 133)),
        "style": "asym_fringe",
        "collar": ((24, 24, 27), (244, 63, 94)),
        "collar_type": "hoodie"
    },
    # 16: Cool Lone Wolf
    {
        "name": "Cool Lone Wolf",
        "skin": ((246, 222, 204), (222, 188, 166)),
        "hair": ((241, 245, 249), (148, 163, 184), (255, 255, 255)),
        "style": "messy_waves",
        "collar": ((24, 24, 27), (203, 213, 225)),
        "collar_type": "jacket"
    },
    # 17: Cheerful Sunshine
    {
        "name": "Cheerful Sunshine",
        "skin": ((252, 226, 208), (230, 194, 172)),
        "hair": ((250, 204, 21), (202, 138, 4), (254, 240, 138)),
        "style": "flipped_bob",
        "collar": ((244, 63, 94), (254, 205, 211)),
        "collar_type": "hoodie"
    },
    # 18: Tactical Operative
    {
        "name": "Tactical Operative",
        "skin": ((238, 208, 182), (212, 174, 148)),
        "hair": ((63, 98, 18), (26, 46, 5), (101, 163, 13)),
        "style": "fighter_crop",
        "collar": ((30, 41, 30), (132, 204, 22)),
        "collar_type": "high_collar"
    },
    # 19: Wild Berserker
    {
        "name": "Wild Berserker",
        "skin": ((244, 216, 196), (218, 182, 160)),
        "hair": ((147, 51, 234), (107, 33, 168), (216, 180, 254)),
        "style": "wolf_cut",
        "collar": ((24, 24, 27), (192, 38, 211)),
        "collar_type": "casual"
    },
    # 20: Forest Sage
    {
        "name": "Forest Sage",
        "skin": ((248, 224, 208), (224, 192, 172)),
        "hair": ((16, 185, 129), (4, 120, 87), (110, 231, 183)),
        "style": "side_swept",
        "collar": ((6, 78, 59), (52, 211, 153)),
        "collar_type": "scarf"
    },
    # 21: Shinobi Warrior
    {
        "name": "Shinobi Warrior",
        "skin": ((242, 216, 196), (216, 182, 160)),
        "hair": ((71, 85, 105), (30, 41, 59), (148, 163, 184)),
        "style": "ponytail",
        "collar": ((15, 23, 42), (100, 116, 139)),
        "collar_type": "ninja"
    },
    # 22: Cyberpunk Rebel
    {
        "name": "Cyberpunk Rebel",
        "skin": ((246, 220, 200), (220, 186, 164)),
        "hair": ((132, 204, 22), (77, 124, 15), (190, 242, 100)),
        "style": "wild_spikes",
        "collar": ((17, 24, 39), (234, 179, 8)),
        "collar_type": "jacket"
    },
    # 23: Gothic Aristocrat
    {
        "name": "Gothic Aristocrat",
        "skin": ((253, 236, 224), (234, 206, 190)),
        "hair": ((24, 24, 27), (9, 9, 11), (63, 63, 70)),
        "style": "drill_curls",
        "collar": ((15, 15, 20), (159, 18, 57)),
        "collar_type": "high_collar"
    },
    # 24: Ace Aviator
    {
        "name": "Ace Aviator",
        "skin": ((244, 214, 190), (218, 180, 154)),
        "hair": ((180, 83, 9), (120, 53, 15), (245, 158, 11)),
        "style": "side_swept",
        "collar": ((67, 40, 24), (254, 243, 199)),
        "collar_type": "jacket"
    },
    # 25: Crimson Brawler
    {
        "name": "Crimson Brawler",
        "skin": ((240, 210, 186), (214, 176, 150)),
        "hair": ((225, 29, 72), (159, 18, 57), (251, 113, 133)),
        "style": "spiky_shonen",
        "collar": ((24, 24, 27), (225, 29, 72)),
        "collar_type": "jersey"
    },
    # 26: Stellar Navigator
    {
        "name": "Stellar Navigator",
        "skin": ((250, 226, 210), (228, 194, 174)),
        "hair": ((30, 58, 138), (15, 23, 42), (96, 165, 250)),
        "style": "hacker_bob",
        "collar": ((15, 23, 42), (203, 213, 225)),
        "collar_type": "high_collar"
    },
    # 27: Golden Champion
    {
        "name": "Golden Champion",
        "skin": ((252, 228, 212), (230, 196, 176)),
        "hair": ((245, 208, 115), (195, 145, 50), (255, 245, 195)),
        "style": "curtain_bangs",
        "collar": ((248, 250, 252), (218, 165, 32)),
        "collar_type": "uniform"
    }
]

def render_color_tile(arch):
    im = Image.new("RGBA", (CELL_96, CELL_96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    
    skin_base, skin_shadow = arch["skin"]
    hair_base, hair_shadow, hair_hi = arch["hair"]
    collar_color, collar_accent = arch["collar"]
    style = arch["style"]
    collar_type = arch["collar_type"]

    # 1. Back Hair (for long styles)
    if style in ["twin_tails", "drill_curls", "ponytail"]:
        if style == "twin_tails":
            left_tail = [(110, 130), (60, 180), (50, 270), (75, 300), (95, 240), (115, 170)]
            right_tail = [(274, 130), (324, 180), (334, 270), (309, 300), (289, 240), (269, 170)]
            d.polygon(left_tail, fill=hair_shadow)
            d.line(left_tail + [left_tail[0]], fill=(20, 20, 25, 255), width=6)
            d.polygon(right_tail, fill=hair_shadow)
            d.line(right_tail + [right_tail[0]], fill=(20, 20, 25, 255), width=6)
        elif style == "drill_curls":
            left_drill = [(115, 140), (75, 180), (65, 230), (85, 270), (75, 305), (100, 310), (105, 250), (95, 210), (120, 170)]
            right_drill = [(269, 140), (309, 180), (319, 230), (299, 270), (309, 305), (284, 310), (279, 250), (289, 210), (264, 170)]
            d.polygon(left_drill, fill=hair_shadow)
            d.line(left_drill + [left_drill[0]], fill=(20, 20, 25, 255), width=6)
            d.polygon(right_drill, fill=hair_shadow)
            d.line(right_drill + [right_drill[0]], fill=(20, 20, 25, 255), width=6)
        elif style == "ponytail":
            pony = [(230, 60), (310, 40), (340, 90), (310, 160), (280, 170), (265, 110)]
            d.polygon(pony, fill=hair_shadow)
            d.line(pony + [pony[0]], fill=(20, 20, 25, 255), width=6)

    # 2. Neck
    neck_pts = [(165, 220), (160, 325), (224, 325), (219, 220)]
    d.polygon(neck_pts, fill=skin_base)
    d.polygon([(165, 220), (162, 265), (192, 275), (222, 265), (219, 220)], fill=skin_shadow)

    # 3. Shoulders / Clothing
    if collar_type == "high_collar":
        shirt_pts = [(80, 384), (105, 305), (145, 290), (160, 260), (192, 295), (224, 260), (239, 290), (279, 305), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        d.polygon([(160, 260), (175, 315), (192, 295)], fill=collar_accent)
        d.polygon([(224, 260), (209, 315), (192, 295)], fill=collar_accent)
        d.line(shirt_pts + [shirt_pts[0]], fill=(20, 20, 25, 255), width=6)
    elif collar_type == "hoodie":
        shirt_pts = [(80, 384), (110, 310), (155, 295), (192, 330), (229, 295), (274, 310), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        d.polygon([(155, 295), (192, 330), (229, 295)], fill=collar_accent)
        d.line([(184, 330), (184, 365)], fill=(255, 255, 255, 200), width=4) # drawstrings
        d.line([(200, 330), (200, 365)], fill=(255, 255, 255, 200), width=4)
        d.line(shirt_pts + [shirt_pts[0]], fill=(20, 20, 25, 255), width=6)
    elif collar_type == "jacket":
        shirt_pts = [(80, 384), (105, 310), (150, 295), (170, 280), (192, 340), (214, 280), (234, 295), (279, 310), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        d.polygon([(170, 280), (192, 340), (214, 280)], fill=collar_accent)
        d.line([(192, 340), (192, 384)], fill=(200, 200, 210, 255), width=5) # zipper
        d.line(shirt_pts + [shirt_pts[0]], fill=(20, 20, 25, 255), width=6)
    elif collar_type == "turtleneck":
        shirt_pts = [(80, 384), (110, 315), (152, 290), (152, 245), (192, 250), (232, 245), (232, 290), (274, 315), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        for y_rib in [260, 275]:
            d.line([(154, y_rib), (230, y_rib)], fill=collar_accent, width=4)
        d.line(shirt_pts + [shirt_pts[0]], fill=(20, 20, 25, 255), width=6)
    elif collar_type == "scarf":
        shirt_pts = [(80, 384), (110, 315), (145, 295), (145, 245), (192, 255), (239, 245), (239, 295), (274, 315), (304, 384)]
        d.polygon(shirt_pts, fill=(35, 45, 60))
        # Scarf wrapping
        scarf_pts = [(140, 255), (192, 270), (244, 255), (250, 305), (192, 325), (134, 305)]
        d.polygon(scarf_pts, fill=collar_color)
        d.polygon([(175, 300), (210, 300), (215, 360), (170, 360)], fill=collar_accent) # scarf tail
        d.line(scarf_pts + [scarf_pts[0]], fill=(20, 20, 25, 255), width=6)
        d.line(shirt_pts + [shirt_pts[0]], fill=(20, 20, 25, 255), width=6)
    elif collar_type == "ninja":
        shirt_pts = [(80, 384), (110, 315), (155, 300), (160, 240), (192, 245), (224, 240), (229, 300), (274, 315), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        d.line([(160, 240), (224, 240)], fill=collar_accent, width=5)
        d.line(shirt_pts + [shirt_pts[0]], fill=(20, 20, 25, 255), width=6)
    else: # uniform / casual / jersey
        shirt_pts = [(80, 384), (110, 315), (155, 305), (192, 345), (229, 305), (274, 315), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        d.polygon([(170, 305), (192, 345), (214, 305)], fill=(245, 245, 250))
        d.polygon([(188, 315), (196, 315), (194, 345), (190, 345)], fill=collar_accent)
        d.line(shirt_pts + [shirt_pts[0]], fill=(20, 20, 25, 255), width=6)

    # 4. Ears
    d.ellipse([102, 100, 126, 145], fill=skin_base, outline=(30, 25, 25, 255), width=4)
    d.ellipse([108, 110, 120, 135], fill=skin_shadow)
    d.ellipse([258, 100, 282, 145], fill=skin_base, outline=(30, 25, 25, 255), width=4)
    d.ellipse([264, 110, 276, 135], fill=skin_shadow)

    # 5. Face Contour
    face_pts = [
        (120, 70), (116, 110), (122, 160), (148, 220), (180, 255), (192, 260),
        (204, 255), (236, 220), (262, 160), (268, 110), (264, 70), (192, 50)
    ]
    d.polygon(face_pts, fill=skin_base)
    d.line(face_pts + [face_pts[0]], fill=(30, 25, 25, 255), width=5)

    # Soft Cheek Blush & Nose
    d.ellipse([136, 155, 164, 175], fill=(245, 130, 130, 90))
    d.ellipse([220, 155, 248, 175], fill=(245, 130, 130, 90))
    d.ellipse([190, 162, 194, 167], fill=(215, 165, 145, 255)) # subtle anime nose dot

    # 6. Hair Front & Bangs
    if style in ["spiky_shonen", "shonen", "spiky_runner"]:
        hair_pts = [
            (192, 20), (165, 45), (140, 28), (125, 65), (90, 60), (98, 105), (75, 115),
            (88, 165), (105, 185), (120, 145), (140, 125), (165, 135), (192, 115),
            (219, 135), (244, 125), (264, 145), (279, 185), (296, 165), (309, 115),
            (286, 105), (294, 60), (259, 65), (244, 28), (219, 45)
        ]
    elif style in ["side_swept", "detective_part"]:
        hair_pts = [
            (192, 35), (150, 45), (115, 68), (90, 105), (75, 150), (85, 205), (105, 225),
            (118, 175), (135, 162), (155, 175), (175, 140), (192, 152), (220, 135),
            (250, 155), (275, 200), (295, 165), (305, 120), (290, 75), (250, 45), (220, 38)
        ]
    elif style in ["friendly_bob", "hacker_bob", "flipped_bob"]:
        hair_pts = [
            (192, 38), (145, 42), (110, 65), (85, 105), (75, 160), (80, 220), (102, 235),
            (115, 185), (130, 155), (155, 162), (180, 152), (192, 158), (210, 152),
            (235, 162), (255, 155), (270, 185), (282, 235), (304, 220), (309, 160),
            (299, 105), (274, 65), (239, 42)
        ]
    elif style in ["wolf_cut", "wild_spikes"]:
        hair_pts = [
            (192, 22), (158, 45), (135, 28), (115, 72), (75, 85), (85, 135), (60, 150),
            (78, 195), (100, 228), (118, 175), (140, 162), (165, 178), (192, 148),
            (218, 178), (245, 162), (268, 175), (284, 228), (306, 195), (324, 150),
            (299, 135), (309, 85), (269, 72), (249, 28), (226, 45)
        ]
    elif style == "wavy_beret":
        # Hair with cute tilted beret
        hair_pts = [
            (192, 40), (150, 48), (115, 70), (88, 110), (78, 160), (88, 215), (108, 230),
            (120, 180), (140, 160), (165, 172), (192, 150), (219, 172), (244, 160),
            (264, 180), (276, 230), (296, 215), (306, 160), (296, 110), (269, 70), (234, 48)
        ]
    else: # curtain_bangs / fighter_crop / shadow_curtains
        hair_pts = [
            (192, 32), (150, 42), (115, 65), (92, 105), (80, 155), (90, 210), (108, 225),
            (122, 175), (145, 150), (170, 142), (188, 162), (196, 162), (214, 142),
            (239, 150), (262, 175), (276, 225), (294, 210), (304, 155), (292, 105),
            (269, 65), (234, 42)
        ]

    d.polygon(hair_pts, fill=hair_base)
    # Hair highlight shine band
    hi_pts = [(145, 75), (192, 65), (239, 75), (235, 88), (192, 78), (149, 88)]
    d.polygon(hi_pts, fill=hair_hi)
    d.line(hair_pts + [hair_pts[0]], fill=(25, 20, 25, 255), width=6)

    # Optional Beret cap on top for style wavy_beret
    if style == "wavy_beret":
        beret_pts = [(120, 45), (180, 20), (270, 25), (300, 60), (280, 95), (180, 85), (130, 80)]
        d.polygon(beret_pts, fill=(28, 42, 74, 255))
        d.line(beret_pts + [beret_pts[0]], fill=(15, 20, 35, 255), width=6)
        d.ellipse([215, 15, 225, 25], fill=(28, 42, 74, 255)) # beret stalk

    # Optional Headband on forehead for spiky_runner
    if style == "spiky_runner":
        d.polygon([(118, 90), (192, 80), (266, 90), (266, 110), (192, 100), (118, 110)], fill=(250, 250, 252, 255))
        d.line([(118, 90), (192, 80), (266, 90), (266, 110), (192, 100), (118, 110), (118, 90)], fill=(30, 30, 35, 255), width=4)

    return im.resize((96, 96), Image.Resampling.LANCZOS)

# Build Color Atlas
color_atlas = Image.new("RGBA", (ATLAS_96_SIZE, ATLAS_96_SIZE), (0, 0, 0, 0))
print(f"Generating {len(ARCHETYPES)} base anime character archetypes into color_atlas...")

for idx in range(100):
    arch = ARCHETYPES[idx % len(ARCHETYPES)]
    tile = render_color_tile(arch)
    col = idx % 10
    row = idx // 10
    color_atlas.paste(tile, (col * 96, row * 96), tile)

color_atlas.save(os.path.join(OUTPUT_DIR, "color_atlas.png"))
print("color_atlas.png generated successfully!")


# ==========================================
# 2. EYES ATLAS GENERATOR (57 Eye Styles)
# ==========================================

EYE_PALETTES = [
    ("sapphire", (37, 99, 235), (15, 23, 42)),
    ("ruby", (220, 38, 38), (69, 10, 10)),
    ("emerald", (5, 150, 105), (6, 78, 59)),
    ("amethyst", (147, 51, 234), (59, 7, 100)),
    ("amber", (217, 119, 6), (120, 53, 15)),
    ("cyan", (6, 182, 212), (21, 94, 117)),
    ("rose", (244, 63, 94), (136, 19, 55)),
    ("slate", (71, 85, 105), (15, 23, 42)),
    ("gold", (234, 179, 8), (113, 63, 18)),
]

def render_eyes_tile(idx):
    im = Image.new("RGBA", (CELL_96, CELL_96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    
    color_name, iris_color, pupil_color = EYE_PALETTES[idx % len(EYE_PALETTES)]
    shape_type = idx % 7
    brow_type = (idx // 7) % 5

    # Eyebrows (positioned at Y = 95..110 in 384x384)
    brow_color = (25, 20, 20, 255)
    if brow_type == 0: # confident / neutral
        d.line([(135, 105), (150, 100), (170, 105)], fill=brow_color, width=5)
        d.line([(214, 105), (234, 100), (249, 105)], fill=brow_color, width=5)
    elif brow_type == 1: # determined / fierce
        d.line([(135, 110), (152, 102), (172, 98)], fill=brow_color, width=6)
        d.line([(212, 98), (232, 102), (249, 110)], fill=brow_color, width=6)
    elif brow_type == 2: # gentle / soft
        d.line([(135, 102), (152, 98), (170, 104)], fill=brow_color, width=5)
        d.line([(214, 104), (232, 98), (249, 102)], fill=brow_color, width=5)
    elif brow_type == 3: # raised / surprised
        d.line([(135, 96), (152, 90), (170, 96)], fill=brow_color, width=5)
        d.line([(214, 96), (232, 90), (249, 96)], fill=brow_color, width=5)
    else: # straight / stoic
        d.line([(135, 103), (170, 103)], fill=brow_color, width=5)
        d.line([(214, 103), (249, 103)], fill=brow_color, width=5)

    # Eyes Geometry (Y centered around 115..145)
    if shape_type == 0: # classic anime / sharp cat lash
        # Left
        d.polygon([(138, 125), (148, 114), (166, 114), (172, 125), (166, 144), (148, 144)], fill=(255, 255, 255))
        d.ellipse([146, 114, 166, 144], fill=iris_color)
        d.ellipse([150, 121, 162, 137], fill=pupil_color)
        d.ellipse([148, 117, 154, 124], fill=(255, 255, 255)) # highlight
        d.line([(134, 122), (148, 111), (168, 111), (176, 120)], fill=(15, 15, 20), width=7)
        d.line([(145, 144), (162, 144)], fill=(15, 15, 20), width=4)
        # Right
        d.polygon([(212, 125), (218, 114), (236, 114), (246, 125), (236, 144), (218, 144)], fill=(255, 255, 255))
        d.ellipse([218, 114, 238, 144], fill=iris_color)
        d.ellipse([222, 121, 234, 137], fill=pupil_color)
        d.ellipse([220, 117, 226, 124], fill=(255, 255, 255))
        d.line([(208, 120), (216, 111), (236, 111), (250, 122)], fill=(15, 15, 20), width=7)
        d.line([(222, 144), (239, 144)], fill=(15, 15, 20), width=4)

    elif shape_type == 1: # round shojo / sparkling catchlights
        # Left
        d.polygon([(136, 126), (148, 112), (166, 112), (174, 126), (166, 148), (148, 148)], fill=(255, 255, 255))
        d.ellipse([145, 112, 167, 148], fill=iris_color)
        d.ellipse([149, 120, 163, 140], fill=pupil_color)
        d.ellipse([147, 115, 155, 123], fill=(255, 255, 255)) # primary shine
        d.ellipse([159, 132, 164, 137], fill=(255, 255, 255)) # secondary shine
        d.line([(133, 123), (148, 110), (168, 110), (176, 122)], fill=(15, 15, 20), width=8)
        d.line([(144, 148), (166, 148)], fill=(15, 15, 20), width=4)
        # Right
        d.polygon([(210, 126), (218, 112), (236, 112), (248, 126), (236, 148), (218, 148)], fill=(255, 255, 255))
        d.ellipse([217, 112, 239, 148], fill=iris_color)
        d.ellipse([221, 120, 235, 140], fill=pupil_color)
        d.ellipse([219, 115, 227, 123], fill=(255, 255, 255))
        d.ellipse([231, 132, 236, 137], fill=(255, 255, 255))
        d.line([(208, 122), (216, 110), (236, 110), (251, 123)], fill=(15, 15, 20), width=8)
        d.line([(218, 148), (240, 148)], fill=(15, 15, 20), width=4)

    elif shape_type == 2: # sleepy / cool half-closed
        # Left
        d.polygon([(136, 128), (150, 120), (172, 122), (166, 142), (144, 142)], fill=(255, 255, 255))
        d.ellipse([146, 122, 166, 142], fill=iris_color)
        d.ellipse([150, 127, 162, 139], fill=pupil_color)
        d.ellipse([148, 124, 153, 129], fill=(255, 255, 255))
        d.line([(133, 126), (150, 118), (174, 120)], fill=(15, 15, 20), width=8)
        d.line([(144, 142), (164, 142)], fill=(15, 15, 20), width=4)
        # Right
        d.polygon([(212, 122), (234, 120), (248, 128), (240, 142), (218, 142)], fill=(255, 255, 255))
        d.ellipse([218, 122, 238, 142], fill=iris_color)
        d.ellipse([222, 127, 234, 139], fill=pupil_color)
        d.ellipse([220, 124, 225, 129], fill=(255, 255, 255))
        d.line([(210, 120), (234, 118), (251, 126)], fill=(15, 15, 20), width=8)
        d.line([(220, 142), (240, 142)], fill=(15, 15, 20), width=4)

    elif shape_type == 3: # determined / intense glare
        # Left
        d.polygon([(138, 122), (150, 116), (170, 118), (168, 138), (144, 138)], fill=(255, 255, 255))
        d.ellipse([146, 116, 166, 138], fill=iris_color)
        d.ellipse([151, 122, 161, 134], fill=pupil_color)
        d.ellipse([148, 118, 153, 124], fill=(255, 255, 255))
        d.line([(133, 120), (152, 114), (173, 116)], fill=(15, 15, 20), width=8)
        # Right
        d.polygon([(214, 118), (234, 116), (246, 122), (240, 138), (216, 138)], fill=(255, 255, 255))
        d.ellipse([218, 116, 238, 138], fill=iris_color)
        d.ellipse([223, 122, 233, 134], fill=pupil_color)
        d.ellipse([220, 118, 225, 124], fill=(255, 255, 255))
        d.line([(211, 116), (232, 114), (251, 120)], fill=(15, 15, 20), width=8)

    elif shape_type == 4: # smiling curved eyes (^^)
        # Left curve
        d.arc([136, 115, 174, 145], start=190, end=350, fill=(20, 20, 25), width=8)
        # Right curve
        d.arc([210, 115, 248, 145], start=190, end=350, fill=(20, 20, 25), width=8)

    elif shape_type == 5: # cyber glowing ring
        # Left
        d.polygon([(138, 125), (148, 114), (166, 114), (172, 125), (166, 144), (148, 144)], fill=(10, 15, 30))
        d.ellipse([146, 114, 166, 144], outline=iris_color, width=4)
        d.ellipse([152, 123, 160, 135], fill=iris_color)
        d.line([(134, 122), (148, 111), (168, 111), (176, 120)], fill=(20, 20, 25), width=7)
        # Right
        d.polygon([(212, 125), (218, 114), (236, 114), (246, 125), (236, 144), (218, 144)], fill=(10, 15, 30))
        d.ellipse([218, 114, 238, 144], outline=iris_color, width=4)
        d.ellipse([224, 123, 232, 135], fill=iris_color)
        d.line([(208, 120), (216, 111), (236, 111), (250, 122)], fill=(20, 20, 25), width=7)

    else: # winking (left winking, right open)
        # Left wink
        d.arc([136, 118, 174, 145], start=195, end=345, fill=(20, 20, 25), width=8)
        # Right open
        d.polygon([(212, 125), (218, 114), (236, 114), (246, 125), (236, 144), (218, 144)], fill=(255, 255, 255))
        d.ellipse([218, 114, 238, 144], fill=iris_color)
        d.ellipse([222, 121, 234, 137], fill=pupil_color)
        d.ellipse([220, 117, 226, 124], fill=(255, 255, 255))
        d.line([(208, 120), (216, 111), (236, 111), (250, 122)], fill=(15, 15, 20), width=7)
        d.line([(222, 144), (239, 144)], fill=(15, 15, 20), width=4)

    return im.resize((96, 96), Image.Resampling.LANCZOS)

eyes_atlas = Image.new("RGBA", (ATLAS_96_SIZE, ATLAS_96_SIZE), (0, 0, 0, 0))
print("Generating 57 anime eye styles into eyes_atlas...")
for idx in range(100):
    tile = render_eyes_tile(idx)
    col = idx % 10
    row = idx // 10
    eyes_atlas.paste(tile, (col * 96, row * 96), tile)

eyes_atlas.save(os.path.join(OUTPUT_DIR, "eyes_atlas.png"))
print("eyes_atlas.png generated successfully!")


# ==========================================
# 3. MOUTH ATLAS GENERATOR (51 Expressions)
# ==========================================

def render_mouth_tile(idx):
    im = Image.new("RGBA", (CELL_96, CELL_96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    
    m_type = idx % 10
    w_scale = 1.0 + (idx % 3) * 0.15
    y_shift = ((idx // 10) % 3) * 3

    lip_color = (25, 20, 20, 255)

    if m_type == 0: # Confident smirk
        p1 = (192 - int(14 * w_scale), 198 + y_shift)
        p2 = (192, 202 + y_shift)
        p3 = (192 + int(18 * w_scale), 195 + y_shift)
        p4 = (192 + int(21 * w_scale), 190 + y_shift)
        d.line([p1, p2, p3, p4], fill=lip_color, width=5)

    elif m_type == 1: # Cat smile (^w^ / :3)
        cy = 198 + y_shift
        # Left lobe
        d.arc([192 - int(16 * w_scale), cy - 6, 192, cy + 8], start=20, end=170, fill=lip_color, width=5)
        # Right lobe
        d.arc([192, cy - 6, 192 + int(16 * w_scale), cy + 8], start=10, end=160, fill=lip_color, width=5)

    elif m_type == 2: # Open cheerful smile with tongue
        pts = [(192 - int(16 * w_scale), 195 + y_shift), (192 + int(16 * w_scale), 195 + y_shift), (192, 218 + y_shift)]
        d.polygon(pts, fill=(159, 18, 57)) # interior
        d.polygon([(192 - int(10 * w_scale), 206 + y_shift), (192 + int(10 * w_scale), 206 + y_shift), (192, 218 + y_shift)], fill=(244, 63, 94)) # tongue
        d.line([pts[0], pts[1]], fill=lip_color, width=5)
        d.line([pts[0], pts[2], pts[1]], fill=lip_color, width=5)

    elif m_type == 3: # Focused grit / clenched teeth
        x1 = 192 - int(18 * w_scale)
        x2 = 192 + int(18 * w_scale)
        y = 198 + y_shift
        d.rounded_rectangle([x1, y - 4, x2, y + 4], radius=3, fill=(255, 255, 255), outline=lip_color, width=4)
        d.line([(192, y - 4), (192, y + 4)], fill=lip_color, width=3) # teeth line

    elif m_type == 4: # Gentle warm curve smile
        d.arc([192 - int(14 * w_scale), 192 + y_shift, 192 + int(14 * w_scale), 208 + y_shift], start=20, end=160, fill=lip_color, width=5)

    elif m_type == 5: # Small surprised 'o'
        d.ellipse([192 - int(7 * w_scale), 196 + y_shift, 192 + int(7 * w_scale), 208 + y_shift], fill=(136, 19, 55), outline=lip_color, width=4)

    elif m_type == 6: # Stoic neutral line
        x1 = 192 - int(12 * w_scale)
        x2 = 192 + int(12 * w_scale)
        d.line([(x1, 200 + y_shift), (x2, 200 + y_shift)], fill=lip_color, width=5)

    elif m_type == 7: # Laughing wide open triangle
        pts = [(192 - int(20 * w_scale), 194 + y_shift), (192 + int(20 * w_scale), 194 + y_shift), (192, 222 + y_shift)]
        d.polygon(pts, fill=(190, 18, 60))
        d.polygon([(192 - int(12 * w_scale), 208 + y_shift), (192 + int(12 * w_scale), 208 + y_shift), (192, 222 + y_shift)], fill=(251, 113, 133))
        d.line(pts + [pts[0]], fill=lip_color, width=5)

    elif m_type == 8: # Playful tongue out (:P)
        p1 = (192 - int(14 * w_scale), 196 + y_shift)
        p2 = (192 + int(14 * w_scale), 196 + y_shift)
        d.line([p1, p2], fill=lip_color, width=5)
        # Tongue sticking down
        d.rounded_rectangle([192 - 6, 196 + y_shift, 192 + 6, 212 + y_shift], radius=5, fill=(244, 63, 94), outline=lip_color, width=3)

    else: # Pout / wavy line
        p1 = (192 - int(12 * w_scale), 202 + y_shift)
        p2 = (192 - int(4 * w_scale), 198 + y_shift)
        p3 = (192 + int(4 * w_scale), 202 + y_shift)
        p4 = (192 + int(12 * w_scale), 198 + y_shift)
        d.line([p1, p2, p3, p4], fill=lip_color, width=5)

    return im.resize((96, 96), Image.Resampling.LANCZOS)

mouth_atlas = Image.new("RGBA", (ATLAS_96_SIZE, ATLAS_96_SIZE), (0, 0, 0, 0))
print("Generating 51 anime expressions into mouth_atlas...")
for idx in range(100):
    tile = render_mouth_tile(idx)
    col = idx % 10
    row = idx // 10
    mouth_atlas.paste(tile, (col * 96, row * 96), tile)

mouth_atlas.save(os.path.join(OUTPUT_DIR, "mouth_atlas.png"))
print("mouth_atlas.png generated successfully!")


# ==========================================
# 4. SPECIAL / ACCESSORIES ATLAS GENERATOR (1600x1600)
# ==========================================

def render_special_tile(idx):
    # 640x640 canvas (4x of 160x160)
    # Head center in 160x160 is (80, 80) -> in 640x640: (320, 320)
    im = Image.new("RGBA", (CELL_160, CELL_160), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    acc_id = idx % 20

    if acc_id == 0: # Cyan Gaming Headset
        d.arc([190, 80, 450, 400], start=185, end=355, fill=(30, 40, 55, 255), width=24)
        d.arc([200, 90, 440, 390], start=190, end=350, fill=(6, 182, 212, 255), width=8)
        d.rounded_rectangle([180, 230, 235, 330], radius=16, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=8)
        d.rounded_rectangle([405, 230, 460, 330], radius=16, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=8)
        d.line([(205, 310), (220, 360), (280, 380)], fill=(30, 40, 55, 255), width=10)
        d.ellipse([275, 372, 292, 388], fill=(6, 182, 212, 255))

    elif acc_id == 1: # Crimson & Black Audio Headset
        d.arc([190, 80, 450, 400], start=185, end=355, fill=(24, 24, 27, 255), width=24)
        d.arc([200, 90, 440, 390], start=190, end=350, fill=(220, 38, 38, 255), width=8)
        d.rounded_rectangle([180, 230, 235, 330], radius=16, fill=(24, 24, 27, 255), outline=(220, 38, 38, 255), width=8)
        d.rounded_rectangle([405, 230, 460, 330], radius=16, fill=(24, 24, 27, 255), outline=(220, 38, 38, 255), width=8)

    elif acc_id == 2: # Cat-Ear Glowing Neon Headset
        d.arc([190, 80, 450, 400], start=185, end=355, fill=(35, 25, 45, 255), width=24)
        # Left cat ear
        d.polygon([(220, 110), (210, 30), (260, 85)], fill=(35, 25, 45, 255))
        d.polygon([(225, 95), (220, 45), (250, 80)], fill=(244, 63, 94, 255)) # neon pink interior
        # Right cat ear
        d.polygon([(420, 110), (430, 30), (380, 85)], fill=(35, 25, 45, 255))
        d.polygon([(415, 95), (420, 45), (390, 80)], fill=(244, 63, 94, 255))
        d.rounded_rectangle([180, 230, 235, 330], radius=16, fill=(35, 25, 45, 255), outline=(244, 63, 94, 255), width=8)
        d.rounded_rectangle([405, 230, 460, 330], radius=16, fill=(35, 25, 45, 255), outline=(244, 63, 94, 255), width=8)

    elif acc_id == 3: # Round Vintage Wireframe Glasses
        # Left circle
        d.ellipse([250, 230, 300, 280], outline=(218, 165, 32, 255), width=6)
        # Right circle
        d.ellipse([340, 230, 390, 280], outline=(218, 165, 32, 255), width=6)
        # Bridge
        d.arc([295, 240, 345, 260], start=190, end=350, fill=(218, 165, 32, 255), width=6)
        # Temples
        d.line([(250, 250), (200, 235)], fill=(218, 165, 32, 255), width=5)
        d.line([(390, 250), (440, 235)], fill=(218, 165, 32, 255), width=5)

    elif acc_id == 4: # Sleek Black Modern Anime Nerd Glasses
        d.rounded_rectangle([245, 235, 305, 275], radius=6, outline=(20, 20, 25, 255), width=8)
        d.rounded_rectangle([335, 235, 395, 275], radius=6, outline=(20, 20, 25, 255), width=8)
        d.line([(305, 250), (335, 250)], fill=(20, 20, 25, 255), width=8)
        d.line([(245, 245), (195, 235)], fill=(20, 20, 25, 255), width=6)
        d.line([(395, 245), (445, 235)], fill=(20, 20, 25, 255), width=6)

    elif acc_id == 5: # Red Top-Rim Designer Glasses
        d.line([(240, 238), (310, 238)], fill=(220, 38, 38, 255), width=9)
        d.line([(330, 238), (400, 238)], fill=(220, 38, 38, 255), width=9)
        d.line([(310, 242), (330, 242)], fill=(220, 38, 38, 255), width=6)

    elif acc_id == 6: # Translucent Cyan Cyber HUD Visor
        visor_pts = [(225, 230), (320, 220), (415, 230), (410, 270), (320, 280), (230, 270)]
        d.polygon(visor_pts, fill=(6, 182, 212, 140))
        d.line(visor_pts + [visor_pts[0]], fill=(34, 211, 238, 255), width=6)
        # HUD grid lines
        d.line([(250, 245), (310, 245)], fill=(255, 255, 255, 220), width=3)
        d.line([(330, 255), (390, 255)], fill=(255, 255, 255, 220), width=3)

    elif acc_id == 7: # Gold & Amber Sci-Fi Visor
        visor_pts = [(225, 230), (320, 220), (415, 230), (410, 270), (320, 280), (230, 270)]
        d.polygon(visor_pts, fill=(245, 158, 11, 150))
        d.line(visor_pts + [visor_pts[0]], fill=(251, 191, 36, 255), width=6)

    elif acc_id == 8: # Kitsune / Fox Half-Mask (forehead tilted right)
        mask_pts = [(310, 110), (350, 50), (390, 110), (410, 150), (350, 185), (290, 150)]
        d.polygon(mask_pts, fill=(250, 250, 252, 255))
        d.polygon([(340, 75), (350, 55), (360, 75)], fill=(220, 38, 38, 255)) # ear red
        d.arc([315, 130, 345, 155], start=180, end=360, fill=(220, 38, 38, 255), width=5) # eye paint
        d.arc([355, 130, 385, 155], start=180, end=360, fill=(220, 38, 38, 255), width=5)
        d.line(mask_pts + [mask_pts[0]], fill=(25, 20, 20, 255), width=5)

    elif acc_id == 9: # Shinobi Metallic Forehead Protector
        band_pts = [(240, 180), (320, 170), (400, 180), (400, 205), (320, 195), (240, 205)]
        d.polygon(band_pts, fill=(24, 24, 27, 255)) # cloth wrap
        plate_pts = [(280, 178), (320, 174), (360, 178), (360, 200), (320, 202), (280, 200)]
        d.polygon(plate_pts, fill=(203, 213, 225, 255)) # metal plate
        d.line(plate_pts + [plate_pts[0]], fill=(30, 41, 59, 255), width=4)
        # Draw emblem dot
        d.ellipse([316, 184, 324, 192], fill=(30, 41, 59, 255))

    elif acc_id == 10: # Cute Golden Star Hairpins
        # Left star on side bangs
        def draw_star(cx, cy, r):
            pts = []
            for i in range(10):
                angle = i * math.pi / 5 - math.pi / 2
                rad = r if i % 2 == 0 else r * 0.45
                pts.append((cx + rad * math.cos(angle), cy + rad * math.sin(angle)))
            d.polygon(pts, fill=(250, 204, 21, 255))
            d.line(pts + [pts[0]], fill=(180, 83, 9, 255), width=3)
        draw_star(245, 160, 18)
        draw_star(265, 175, 14)

    elif acc_id == 11: # Cherry Blossom Flower Hair Clip
        cx, cy = 250, 165
        for i in range(5):
            angle = i * 2 * math.pi / 5
            px = cx + 16 * math.cos(angle)
            py = cy + 16 * math.sin(angle)
            d.ellipse([px - 10, py - 10, px + 10, py + 10], fill=(251, 113, 133, 255))
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(254, 240, 138, 255))

    elif acc_id == 12: # Anime Cross Bandage on cheek
        d.polygon([(245, 280), (275, 270), (270, 295), (240, 305)], fill=(254, 243, 199, 255))
        d.polygon([(245, 270), (275, 305), (265, 310), (235, 275)], fill=(254, 243, 199, 255))
        d.line([(240, 285), (270, 275)], fill=(217, 119, 6, 255), width=2)

    elif acc_id == 13: # Cozy Knitted Winter Muffler / Scarf
        scarf_pts = [(240, 380), (320, 395), (400, 380), (410, 460), (320, 480), (230, 460)]
        d.polygon(scarf_pts, fill=(225, 29, 72, 255))
        # Knit stripes
        for y_stripe in [405, 425, 445]:
            d.line([(235, y_stripe), (405, y_stripe)], fill=(255, 255, 255, 180), width=4)
        d.line(scarf_pts + [scarf_pts[0]], fill=(136, 19, 55, 255), width=6)

    elif acc_id == 14: # Crimson Wanderer Scarf
        scarf_pts = [(240, 385), (320, 400), (400, 385), (410, 450), (320, 470), (230, 450)]
        d.polygon(scarf_pts, fill=(185, 28, 28, 255))
        d.line(scarf_pts + [scarf_pts[0]], fill=(127, 29, 29, 255), width=6)

    elif acc_id == 15: # Tiny Golden Anime Royalty Crown
        crown_pts = [(290, 110), (280, 60), (305, 80), (320, 45), (335, 80), (360, 60), (350, 110)]
        d.polygon(crown_pts, fill=(250, 204, 21, 255))
        d.line(crown_pts + [crown_pts[0]], fill=(180, 83, 9, 255), width=5)
        # Jewels
        d.ellipse([316, 68, 324, 76], fill=(220, 38, 38, 255))

    elif acc_id == 16: # Angelic Golden Halo
        d.ellipse([250, 40, 390, 85], outline=(253, 224, 71, 255), width=10)

    elif acc_id == 17: # Cybernetic Cheek Data Nodes
        d.line([(245, 270), (260, 275), (280, 275)], fill=(6, 182, 212, 255), width=5)
        d.ellipse([278, 272, 284, 278], fill=(255, 255, 255, 255))
        d.line([(395, 270), (380, 275), (360, 275)], fill=(6, 182, 212, 255), width=5)
        d.ellipse([356, 272, 362, 278], fill=(255, 255, 255, 255))

    elif acc_id == 18: # Black Streetwear Face Mask
        mask_pts = [(255, 280), (320, 270), (385, 280), (380, 360), (320, 380), (260, 360)]
        d.polygon(mask_pts, fill=(24, 24, 27, 255))
        d.line([(255, 285), (200, 275)], fill=(24, 24, 27, 255), width=5) # ear loops
        d.line([(385, 285), (440, 275)], fill=(24, 24, 27, 255), width=5)
        d.line(mask_pts + [mask_pts[0]], fill=(9, 9, 11, 255), width=6)

    else: # Headset around neck
        d.arc([220, 370, 420, 490], start=180, end=360, fill=(30, 40, 55, 255), width=22)
        d.rounded_rectangle([210, 360, 250, 420], radius=10, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=6)
        d.rounded_rectangle([390, 360, 430, 420], radius=10, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=6)

    return im.resize((160, 160), Image.Resampling.LANCZOS)

special_atlas = Image.new("RGBA", (ATLAS_160_SIZE, ATLAS_160_SIZE), (0, 0, 0, 0))
print("Generating 20 anime accessories into special_atlas...")
for idx in range(100):
    tile = render_special_tile(idx)
    col = idx % 10
    row = idx // 10
    special_atlas.paste(tile, (col * 160, row * 160), tile)

special_atlas.save(os.path.join(OUTPUT_DIR, "special_atlas.png"))
print("special_atlas.png generated successfully!")
print("ALL 4 ANIME SPRITE ATLASES GENERATED SUCCESSFULLY!")
