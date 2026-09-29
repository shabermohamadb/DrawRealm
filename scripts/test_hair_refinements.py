# Let's write the polished version of anime_hair_engine and back_hair
import os
import math
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

print("Refinement helper functions verified.")
