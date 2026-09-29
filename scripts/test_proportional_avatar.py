import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 384, 384

def bezier_curve(p0, p1, p2, p3, num_pts=20):
    pts = []
    for i in range(num_pts + 1):
        t = i / num_pts
        x = (1-t)**3 * p0[0] + 3*(1-t)**2 * t * p1[0] + 3*(1-t) * t**2 * p2[0] + t**3 * p3[0]
        y = (1-t)**3 * p0[1] + 3*(1-t)**2 * t * p1[1] + 3*(1-t) * t**2 * p2[1] + t**3 * p3[1]
        pts.append((int(x), int(y)))
    return pts

def create_back_hair():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    hair_dark = (14, 14, 20, 255)

    # Left back hair mass
    l_pts = [(85, 110), (55, 160), (45, 230), (68, 275), (88, 230), (95, 160)]
    d.polygon(l_pts, fill=hair_dark)
    d.line(l_pts + [l_pts[0]], fill=(10, 10, 15, 255), width=2)

    # Right back hair mass
    r_pts = [(299, 110), (329, 160), (339, 230), (316, 275), (296, 230), (289, 160)]
    d.polygon(r_pts, fill=hair_dark)
    d.line(r_pts + [r_pts[0]], fill=(10, 10, 15, 255), width=2)

    return im

def create_face():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    skin_base = (252, 230, 215, 255)
    skin_shadow = (222, 188, 168, 255)

    # 1. Neck & Shoulders (Tech Hoodie)
    neck_pts = [(152, 240), (150, 315), (234, 315), (232, 240)]
    d.polygon(neck_pts, fill=skin_base)

    # Smooth under-chin shadow curve
    shadow_curve = bezier_curve((152, 248), (170, 280), (214, 280), (232, 248), 15)
    shadow_pts = shadow_curve + [(234, 285), (150, 285)]
    d.polygon(shadow_pts, fill=skin_shadow)

    # Anatomical neck lines (SCM tendons & clavicles)
    d.line([(172, 275), (184, 315)], fill=(215, 178, 155, 140), width=3)
    d.line([(212, 275), (200, 315)], fill=(215, 178, 155, 140), width=3)
    d.line([(160, 318), (192, 324), (224, 318)], fill=(210, 170, 148, 180), width=3)

    # Hoodie
    hoodie_pts = [
        (20, 384), (35, 335), (95, 305), (145, 292), (192, 318), (239, 292),
        (289, 305), (349, 335), (364, 384)
    ]
    d.polygon(hoodie_pts, fill=(24, 26, 32, 255))
    d.line([(145, 292), (192, 318), (239, 292)], fill=(249, 115, 22, 255), width=6)
    d.line([(175, 318), (175, 370)], fill=(245, 245, 250, 255), width=4)
    d.line([(209, 318), (209, 370)], fill=(245, 245, 250, 255), width=4)
    d.line([(175, 366), (175, 372)], fill=(249, 115, 22, 255), width=5)
    d.line([(209, 366), (209, 372)], fill=(249, 115, 22, 255), width=5)
    d.line([(95, 305), (80, 384)], fill=(15, 15, 20, 180), width=3)
    d.line([(289, 305), (304, 384)], fill=(15, 15, 20, 180), width=3)
    d.line(hoodie_pts + [hoodie_pts[0]], fill=(15, 15, 20, 255), width=4)

    # 2. Ears
    d.ellipse([82, 148, 108, 205], fill=skin_base, outline=(170, 125, 105, 255), width=3)
    d.ellipse([88, 160, 104, 192], fill=skin_shadow)
    d.ellipse([276, 148, 302, 205], fill=skin_base, outline=(170, 125, 105, 255), width=3)
    d.ellipse([280, 160, 296, 192], fill=skin_shadow)

    # 3. Smooth Anime Jawline
    left_jaw = bezier_curve((96, 110), (94, 180), (120, 240), (192, 274), 25)
    right_jaw = bezier_curve((192, 274), (264, 240), (290, 180), (288, 110), 25)
    head_top = bezier_curve((288, 110), (280, 60), (104, 60), (96, 110), 20)
    face_contour = left_jaw + right_jaw + head_top

    d.polygon(face_contour, fill=skin_base)
    d.line(left_jaw + right_jaw, fill=(170, 125, 105, 255), width=3)

    # Airbrushed Soft Cheek Blush
    blush = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blush)
    bd.ellipse([115, 185, 155, 215], fill=(248, 125, 125, 125))
    bd.ellipse([229, 185, 269, 215], fill=(248, 125, 125, 125))
    blush = blush.filter(ImageFilter.GaussianBlur(radius=8))
    im.alpha_composite(blush)

    # 4. Sculpted Nose
    d = ImageDraw.Draw(im)
    d.line([(190, 182), (190, 216)], fill=(215, 175, 150, 140), width=2)
    d.line([(192, 184), (192, 217)], fill=(255, 250, 245, 180), width=2)
    d.ellipse([191, 217, 194, 220], fill=(255, 255, 255, 230))
    d.polygon([(187, 223), (192, 222), (197, 224), (192, 225)], fill=(160, 110, 90, 255))

    return im

def create_front_hair():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    hair_base = (28, 28, 36, 255)
    hair_dark = (14, 14, 20, 255)
    hair_hi = (95, 105, 130, 255)

    # 1. Crown Mass (Curves over head, from Y=22 down to hairline Y=95)
    crown_top = bezier_curve((60, 115), (75, 45), (150, 22), (192, 22), 20) + \
                bezier_curve((192, 22), (234, 22), (309, 45), (324, 115), 20)
    hairline = bezier_curve((324, 115), (280, 90), (104, 90), (60, 115), 20)
    d.polygon(crown_top + hairline, fill=hair_base)

    # 2. Side Face-Framing Locks (Left & Right temples)
    left_lock = [(60, 115), (72, 160), (84, 220), (96, 235), (92, 185), (80, 130)]
    d.polygon(left_lock, fill=hair_base)
    d.line(left_lock + [left_lock[0]], fill=(15, 15, 20, 255), width=2)

    right_lock = [(324, 115), (312, 160), (300, 220), (288, 235), (292, 185), (304, 130)]
    d.polygon(right_lock, fill=hair_base)
    d.line(right_lock + [right_lock[0]], fill=(15, 15, 20, 255), width=2)

    # 3. Center Bangs (Stylized tapered locks sweeping diagonally, leaving forehead open)
    # Left bang strand (sweeps down to (135, 126))
    b1 = [(110, 88), (125, 105), (135, 126), (138, 105), (130, 86)]
    d.polygon(b1, fill=hair_base)
    d.line(b1 + [b1[0]], fill=(15, 15, 20, 255), width=2)

    # Center-left bang strand (sweeps to (162, 122))
    b2 = [(145, 86), (155, 105), (165, 122), (170, 105), (160, 86)]
    d.polygon(b2, fill=hair_base)
    d.line(b2 + [b2[0]], fill=(15, 15, 20, 255), width=2)

    # Center-right bang strand (sweeps to (218, 122))
    b3 = [(225, 86), (220, 105), (218, 122), (228, 105), (240, 86)]
    d.polygon(b3, fill=hair_base)
    d.line(b3 + [b3[0]], fill=(15, 15, 20, 255), width=2)

    # Right bang strand (sweeps to (250, 126))
    b4 = [(255, 88), (248, 105), (248, 126), (260, 105), (275, 88)]
    d.polygon(b4, fill=hair_base)
    d.line(b4 + [b4[0]], fill=(15, 15, 20, 255), width=2)

    # Dynamic top spikes / cowlicks
    d.polygon([(170, 24), (185, 10), (192, 22)], fill=hair_base)
    d.polygon([(192, 22), (205, 12), (215, 24)], fill=hair_base)

    # Angel Ring Sheen across crown
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    halo_pts = [(110, 68), (150, 55), (192, 50), (234, 55), (274, 68), (268, 78), (192, 62), (116, 78)]
    hd.polygon(halo_pts, fill=hair_hi)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=4))
    im.alpha_composite(halo)

    # Outline crown
    d = ImageDraw.Draw(im)
    d.line(crown_top, fill=(15, 15, 20, 255), width=3)

    return im

def create_eyes():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    brow_col = (28, 22, 24, 255)
    # Eyebrows
    d.line([(120, 142), (145, 132), (174, 137)], fill=brow_col, width=5)
    d.line([(126, 140), (150, 131)], fill=brow_col, width=4)
    d.line([(210, 137), (239, 132), (264, 142)], fill=brow_col, width=5)
    d.line([(234, 131), (258, 140)], fill=brow_col, width=4)

    # Double-eyelid fold
    crease = (180, 135, 115, 180)
    d.line([(130, 150), (148, 145), (168, 149)], fill=crease, width=2)
    d.line([(216, 149), (236, 145), (254, 150)], fill=crease, width=2)

    # Sclera (White base)
    d.polygon([(126, 165), (148, 153), (172, 163), (166, 188), (136, 188)], fill=(250, 252, 255, 255))
    d.polygon([(212, 163), (236, 153), (258, 165), (248, 188), (218, 188)], fill=(250, 252, 255, 255))
    # Ambient top shadow
    d.polygon([(126, 165), (148, 153), (172, 163), (169, 170), (130, 170)], fill=(195, 202, 218, 150))
    d.polygon([(212, 163), (236, 153), (258, 165), (254, 170), (215, 170)], fill=(195, 202, 218, 150))

    # Sapphire Blue Irises
    c_base = (18, 45, 115, 255)
    c_mid = (30, 130, 235, 255)
    c_light = (105, 220, 255, 255)

    for cx in [150, 234]:
        d.ellipse([cx - 15, 154, cx + 15, 190], fill=c_base)
        d.chord([cx - 14, 164, cx + 14, 189], start=0, end=180, fill=c_mid)
        d.chord([cx - 11, 173, cx + 11, 188], start=0, end=180, fill=c_light)
        d.ellipse([cx - 5, 163, cx + 5, 177], fill=(12, 15, 24, 255))
        d.ellipse([cx - 9, 160, cx - 2, 169], fill=(255, 255, 255, 255)) # primary shine
        d.ellipse([cx + 4, 175, cx + 10, 182], fill=(255, 255, 255, 210)) # secondary shine

    # Winged Eyeliner / Lashes
    d.line([(120, 167), (135, 155), (156, 153), (176, 162)], fill=(20, 20, 25, 255), width=7)
    d.line([(117, 168), (128, 160)], fill=(20, 20, 25, 255), width=5)
    d.line([(208, 162), (228, 153), (249, 155), (264, 167)], fill=(20, 20, 25, 255), width=7)
    d.line([(256, 160), (267, 168)], fill=(20, 20, 25, 255), width=5)
    # Lower lash line
    d.line([(136, 189), (164, 189)], fill=(120, 85, 75, 190), width=2)
    d.line([(220, 189), (248, 189)], fill=(120, 85, 75, 190), width=2)

    return im

def create_mouth():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    lip_line = (140, 50, 55, 255)
    corner_tuck = (100, 35, 40, 255)
    lip_shadow = (185, 105, 95, 160)
    lip_highlight = (255, 240, 235, 210)

    # Confident subtle smirk
    p1 = (174, 246)
    p2 = (192, 247)
    p3 = (205, 243)
    p4 = (212, 239)
    d.line([p1, p2, p3, p4], fill=lip_line, width=4)
    d.ellipse([p1[0] - 1, p1[1] - 1, p1[0] + 1, p1[1] + 1], fill=corner_tuck)
    d.ellipse([p4[0] - 1, p4[1] - 1, p4[0] + 1, p4[1] + 1], fill=corner_tuck)
    d.chord([184, 252, 202, 258], start=0, end=180, fill=lip_shadow)
    d.line([(188, 253), (196, 253)], fill=lip_highlight, width=2)

    return im

# 1. Back hair
back_hair = create_back_hair()
# 2. Face (neck, clothes, ears, jaw, blush, nose)
face = create_face()
# 3. Front hair (crown & bangs)
front_hair = create_front_hair()
# 4. Eyes
eyes = create_eyes()
# 5. Mouth
mouth = create_mouth()

# Layering:
# In color_atlas.png tile: back_hair + face + front_hair
color_tile = Image.new("RGBA", (W, H), (0, 0, 0, 0))
color_tile.alpha_composite(back_hair)
color_tile.alpha_composite(face)
color_tile.alpha_composite(front_hair)

# Complete avatar: color_tile + eyes + mouth
comp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
comp.alpha_composite(color_tile)
comp.alpha_composite(eyes)
comp.alpha_composite(mouth)

comp.save("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/sample_perfect_large.png")
comp.resize((96, 96), Image.Resampling.LANCZOS).save("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/sample_perfect_96.png")
print("Rendered perfected prototype!")
