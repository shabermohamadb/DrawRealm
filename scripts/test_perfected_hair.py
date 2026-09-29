import os
import math
from PIL import Image, ImageDraw, ImageFilter
from generate_all_28_anime_styles import ARCHETYPES, render_face_and_clothing
from build_premium_semi_realistic_atlases import render_eyes_tile, render_mouth_tile

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

def make_lock(root_l, c_l1, c_l2, tip, c_r1, c_r2, root_r, num=15):
    left_edge = bezier_curve(root_l, c_l1, c_l2, tip, num)
    right_edge = bezier_curve(tip, c_r1, c_r2, root_r, num)
    return left_edge + right_edge[1:]

def draw_hair_base(arch, render_fn):
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))

    # Face & clothes
    render_face_and_clothing(im, arch)

    # Eyes & Mouth
    eyes = render_eyes_tile(arch["id"]).resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(eyes)

    mouth = render_mouth_tile(arch["id"] % 10).resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(mouth)

    # Custom hair
    render_fn(im, arch)

    return im.resize((96, 96), Image.Resampling.LANCZOS)

# -------------------------------------------------------------
# 0: Perfected Messy Shonen
# -------------------------------------------------------------
def render_shonen(im, arch):
    h_base = arch["hair_base"] + (255,)
    h_dark = arch["hair_dark"] + (255,)
    h_hi = arch["hair_hi"] + (200,)
    line_col = (12, 12, 16, 255)
    skin_shadow = arch["skin"][1]

    # Back hair (connected neck hair)
    back_im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    bd = ImageDraw.Draw(back_im)
    b_pts = [(80, 140), (45, 175), (32, 235), (55, 275), (85, 255), (105, 235),
             (140, 245), (192, 250), (244, 245), (279, 235), (299, 255), (329, 275),
             (352, 235), (339, 175), (304, 140)]
    bd.polygon(b_pts, fill=h_dark)
    bd.line(b_pts + [b_pts[0]], fill=line_col, width=3)
    # Layer behind
    im_back = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    im_back.alpha_composite(back_im)
    im_back.alpha_composite(im)
    im.paste(im_back, (0, 0))

    # Forehead shadow
    sh = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    f_sh = [(85, 110), (135, 155), (170, 165), (192, 155), (215, 165), (250, 155), (300, 110),
            (280, 80), (192, 70), (105, 80)]
    sd.polygon(f_sh, fill=(max(0, skin_shadow[0]-45), max(0, skin_shadow[1]-45), max(0, skin_shadow[2]-45), 130))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=6))
    im.alpha_composite(sh)

    # Main front hair
    front = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    fd = ImageDraw.Draw(front)

    # Volumetric crown + bold curved clumps
    crown = [
        # Left sideburn
        (78, 245), (65, 185), (42, 145), (30, 95),
        # Bold sweeping left tufts
        (35, 55), (62, 38), (55, 18), (88, 14), (88, -2), (120, 2),
        # Center sweeping crests
        (130, -12), (155, 2), (168, -14), (192, -4), (216, -14), (229, 2), (254, -12),
        # Right sweeping tufts
        (264, 2), (296, -2), (296, 14), (329, 18), (322, 38), (349, 55),
        # Right sideburn
        (354, 95), (342, 145), (319, 185), (306, 245),
        # Inner temple framing
        (292, 185), (280, 140),
        # Bangs: layered anime locks
        (265, 125), (250, 150), (242, 130),
        (230, 162), (218, 135),
        (198, 168), (188, 135),
        (168, 165), (156, 132),
        (138, 152), (126, 125),
        # Inner left temple
        (104, 140), (92, 185)
    ]
    fd.polygon(crown, fill=h_base)

    # Shading grooves & lock ridges
    grooves = [
        [(138, 152), (145, 95), (135, 45)],
        [(168, 165), (165, 90), (160, 35)],
        [(198, 168), (195, 90), (192, 25)],
        [(230, 162), (225, 90), (225, 35)],
        [(250, 150), (245, 95), (250, 45)],
        [(78, 245), (70, 165), (65, 110)],
        [(306, 245), (314, 165), (319, 110)],
    ]
    for g in grooves:
        fd.line(g, fill=h_dark, width=3)

    fd.line(crown + [crown[0]], fill=line_col, width=3)

    # Soft anisotropic sheen
    halo = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    sheen = [(80, 68), (135, 48), (192, 42), (249, 48), (304, 68), (294, 78), (192, 56), (90, 78)]
    hd.polygon(sheen, fill=h_hi)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=5))
    front.alpha_composite(halo)

    im.alpha_composite(front)

# -------------------------------------------------------------
# 1: Perfected Curtain Bob (Cyber Samurai)
# -------------------------------------------------------------
def render_curtain_bob(im, arch):
    h_base = arch["hair_base"] + (255,)
    h_dark = arch["hair_dark"] + (255,)
    h_hi = arch["hair_hi"] + (220,)
    line_col = (12, 12, 16, 255)
    skin_shadow = arch["skin"][1]

    # Back hair: smooth inward curved bob behind neck
    back_im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    bd = ImageDraw.Draw(back_im)
    b_pts = bezier_curve((85, 130), (45, 185), (55, 260), (115, 290), 16) + \
            [(192, 295)] + \
            bezier_curve((269, 290), (329, 260), (339, 185), (299, 130), 16)
    bd.polygon(b_pts, fill=h_dark)
    bd.line(b_pts, fill=line_col, width=3)

    im_back = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    im_back.alpha_composite(back_im)
    im_back.alpha_composite(im)
    im.paste(im_back, (0, 0))

    # Forehead shadow
    sh = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    f_sh = [(115, 90), (192, 85), (269, 90), (258, 145), (192, 105), (126, 145)]
    sd.polygon(f_sh, fill=(max(0, skin_shadow[0]-45), max(0, skin_shadow[1]-45), max(0, skin_shadow[2]-45), 130))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=6))
    im.alpha_composite(sh)

    # Front hair: Volumetric center-parted bob
    front = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    fd = ImageDraw.Draw(front)

    # Full continuous silhouette
    bob_pts = [
        # Left jawline bob tip
        (120, 275), (90, 240), (55, 185), (38, 130), (42, 70), (80, 25), (140, 10), (188, 14), (192, 28),
        # Right lobe
        (196, 14), (244, 10), (304, 25), (342, 70), (346, 130), (329, 185), (294, 240), (264, 275),
        # Inner right curtain bang
        (275, 215), (258, 155), (240, 115), (210, 75), (195, 34),
        # Inner left curtain bang
        (189, 34), (174, 75), (144, 115), (126, 155), (109, 215)
    ]
    fd.polygon(bob_pts, fill=h_base)

    # Curtain bangs separation line
    fd.line([(192, 28), (192, 34)], fill=line_col, width=3)
    fd.line([(192, 34), (174, 75), (144, 115), (126, 155)], fill=line_col, width=3)
    fd.line([(192, 34), (210, 75), (240, 115), (258, 155)], fill=line_col, width=3)

    # Lock grooves
    fd.line([(80, 25), (75, 140), (95, 235)], fill=h_dark, width=3)
    fd.line([(304, 25), (309, 140), (289, 235)], fill=h_dark, width=3)

    fd.line(bob_pts + [bob_pts[0]], fill=line_col, width=3)

    # Sheen
    halo = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.polygon([(85, 52), (135, 38), (180, 36), (180, 48), (135, 50), (85, 64)], fill=h_hi)
    hd.polygon([(204, 36), (249, 38), (299, 52), (299, 64), (249, 50), (204, 48)], fill=h_hi)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=5))
    front.alpha_composite(halo)

    im.alpha_composite(front)

# Test both and save
test_sheet = Image.new("RGBA", (280, 180), (14, 20, 48, 255))
td = ImageDraw.Draw(test_sheet)

td.rounded_rectangle([16, 16, 128, 156], radius=8, fill=(24, 32, 68, 255), outline=(99, 102, 241, 180), width=2)
img0 = draw_hair_base(ARCHETYPES[0], render_shonen)
test_sheet.paste(img0, (24, 24), img0)
td.text((72, 130), "#0 Shonen", fill=(240, 245, 255, 255), anchor="mt")

td.rounded_rectangle([152, 16, 264, 156], radius=8, fill=(24, 32, 68, 255), outline=(99, 102, 241, 180), width=2)
img1 = draw_hair_base(ARCHETYPES[1], render_curtain_bob)
test_sheet.paste(img1, (160, 24), img1)
td.text((208, 130), "#1 Curtain Bob", fill=(240, 245, 255, 255), anchor="mt")

test_sheet.save("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/shonen_and_bob_test.png")
print("Saved shonen_and_bob_test.png")
