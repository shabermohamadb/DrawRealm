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

def render_new_messy_shonen(arch):
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    h_base = arch["hair_base"] + (255,)
    h_dark = arch["hair_dark"] + (255,)
    h_hi = arch["hair_hi"] + (220,)
    line_col = (12, 12, 16, 255)
    skin_shadow = arch["skin"][1]

    # 1. Back hair (flared nape tufts)
    l_nape = [(90, 140), (45, 175), (28, 225), (55, 250), (82, 225), (96, 175)]
    r_nape = [(294, 140), (339, 175), (356, 225), (329, 250), (302, 225), (288, 175)]
    d.polygon(l_nape, fill=h_dark)
    d.polygon(r_nape, fill=h_dark)
    d.line(l_nape + [l_nape[0]], fill=line_col, width=3)
    d.line(r_nape + [r_nape[0]], fill=line_col, width=3)

    # 2. Face, eyes, mouth
    render_face_and_clothing(im, arch)

    eyes_img = render_eyes_tile(0).resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(eyes_img)

    mouth_img = render_mouth_tile(0).resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(mouth_img)

    # 3. Forehead shadow cast by the entire hair mass
    sh = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    f_shadow = [(90, 110), (140, 155), (165, 162), (192, 152), (218, 165), (245, 155), (294, 110),
                (280, 80), (192, 70), (104, 80)]
    sd.polygon(f_shadow, fill=(max(0, skin_shadow[0]-40), max(0, skin_shadow[1]-40), max(0, skin_shadow[2]-40), 130))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=6))
    im.alpha_composite(sh)

    # 4. ONE CONTINUOUS FRONT HAIR MASS:
    # Outer crown outline + sideburns + bangs tips as ONE seamless silhouette!
    # Crown spikes at top:
    crown_outer = [
        # Left sideburn
        (85, 240), (70, 185), (42, 145), (32, 105),
        # Left crown spikes
        (48, 70), (35, 45), (65, 35), (75, 15), (105, 20), (120, -2), (145, 12),
        # Center crown spikes
        (165, -8), (185, 8), (192, 0), (200, 8), (218, -8), (238, 12),
        # Right crown spikes
        (264, -2), (278, 20), (308, 15), (318, 35), (348, 45), (336, 70),
        # Right sideburn
        (352, 105), (342, 145), (314, 185), (299, 240),
        # Inner right sideburn
        (288, 185), (278, 145),
        # Bangs: deep jagged locks reaching over the eyebrows!
        (260, 125), (248, 148), (238, 130),
        (225, 158), (214, 135),
        (198, 162), (188, 135),
        (170, 160), (158, 132),
        (142, 150), (130, 125),
        # Inner left sideburn
        (106, 145), (96, 185)
    ]

    front_layer = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    fd = ImageDraw.Draw(front_layer)

    # Draw base hair mass
    fd.polygon(crown_outer, fill=h_base)

    # Strand detail creases / shadow grooves
    grooves = [
        [(142, 150), (145, 95), (135, 55)],
        [(170, 160), (168, 90), (165, 40)],
        [(198, 162), (195, 90), (192, 30)],
        [(225, 158), (220, 90), (220, 40)],
        [(248, 148), (245, 95), (250, 55)],
        [(85, 240), (75, 165), (70, 110)],
        [(299, 240), (309, 165), (314, 110)],
    ]
    for g in grooves:
        fd.line(g, fill=h_dark, width=3)

    # Crisp line art
    fd.line(crown_outer + [crown_outer[0]], fill=line_col, width=3)

    # Anisotropic hair shine band
    halo = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    sheen_pts = [(80, 68), (135, 48), (192, 42), (249, 48), (304, 68), (294, 80), (192, 58), (90, 80)]
    hd.polygon(sheen_pts, fill=h_hi)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=5))
    front_layer.alpha_composite(halo)

    im.alpha_composite(front_layer)
    return im.resize((96, 96), Image.Resampling.LANCZOS)

# Generate comparison
arch0 = ARCHETYPES[0]
new_img = render_new_messy_shonen(arch0)

# Build side-by-side with old version
from test_composite_sheet import render_full_character
old_img = render_full_character(0)

cmp = Image.new("RGBA", (280, 180), (14, 20, 48, 255))
cd = ImageDraw.Draw(cmp)

cd.rounded_rectangle([16, 16, 128, 156], radius=8, fill=(24, 32, 68, 255), outline=(220, 38, 38, 180), width=2)
cmp.paste(old_img, (24, 24), old_img)
cd.text((72, 130), "OLD (Cap)", fill=(240, 150, 150, 255), anchor="mt")

cd.rounded_rectangle([152, 16, 264, 156], radius=8, fill=(24, 32, 68, 255), outline=(16, 185, 129, 220), width=2)
cmp.paste(new_img, (160, 24), new_img)
cd.text((208, 130), "NEW (Anime)", fill=(150, 255, 180, 255), anchor="mt")

cmp.save("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/shonen_comparison.png")
print("Saved comparison image!")
