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

def render_curtain_bob_fixed(im, arch):
    h_base = arch["hair_base"] + (255,)
    h_dark = arch["hair_dark"] + (255,)
    h_hi = arch["hair_hi"] + (220,)
    line_col = (12, 12, 16, 255)
    skin_shadow = arch["skin"][1]

    # 1. Back hair: smooth inward curved bob behind neck
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

    # 2. Forehead shadow under curtain bangs
    sh = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    f_sh = [(115, 95), (192, 75), (269, 95), (258, 155), (192, 85), (126, 155)]
    sd.polygon(f_sh, fill=(max(0, skin_shadow[0]-45), max(0, skin_shadow[1]-45), max(0, skin_shadow[2]-45), 130))
    sh = sh.filter(ImageFilter.GaussianBlur(radius=6))
    im.alpha_composite(sh)

    # 3. Front hair: Volumetric center-parted bob (Solid crown + curtain bangs)
    front = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    fd = ImageDraw.Draw(front)

    # Full continuous silhouette with hairline meeting at (192, 78)
    bob_pts = [
        # Left jawline bob tip
        (120, 275), (90, 240), (55, 185), (38, 130), (42, 65), (80, 22), (140, 10), (188, 14), (192, 18),
        # Right lobe
        (196, 14), (244, 10), (304, 22), (342, 65), (346, 130), (329, 185), (294, 240), (264, 275),
        # Inner right curtain bang (starts at 192, 78)
        (275, 215), (258, 155), (235, 115), (205, 85), (192, 78),
        # Inner left curtain bang
        (179, 85), (149, 115), (126, 155), (109, 215)
    ]
    fd.polygon(bob_pts, fill=h_base)

    # Part line on crown
    fd.line([(192, 18), (192, 78)], fill=line_col, width=3)

    # Curtain bangs contours
    fd.line([(192, 78), (205, 85), (235, 115), (258, 155)], fill=line_col, width=3)
    fd.line([(192, 78), (179, 85), (149, 115), (126, 155)], fill=line_col, width=3)

    # Lock grooves
    fd.line([(80, 22), (75, 140), (95, 235)], fill=h_dark, width=3)
    fd.line([(304, 22), (309, 140), (289, 235)], fill=h_dark, width=3)

    fd.line(bob_pts + [bob_pts[0]], fill=line_col, width=3)

    # Soft highlights
    halo = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.polygon([(85, 52), (135, 38), (180, 36), (180, 48), (135, 50), (85, 64)], fill=h_hi)
    hd.polygon([(204, 36), (249, 38), (299, 52), (299, 64), (249, 50), (204, 48)], fill=h_hi)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=5))
    front.alpha_composite(halo)

    im.alpha_composite(front)

im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))
arch1 = ARCHETYPES[1]
render_face_and_clothing(im, arch1)
eyes = render_eyes_tile(1).resize((W_96, H_96), Image.Resampling.NEAREST)
im.alpha_composite(eyes)
mouth = render_mouth_tile(1).resize((W_96, H_96), Image.Resampling.NEAREST)
im.alpha_composite(mouth)
render_curtain_bob_fixed(im, arch1)

out = im.resize((96, 96), Image.Resampling.LANCZOS)
out.save("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/bob_fixed_preview.png")
print("Saved bob_fixed_preview.png")
