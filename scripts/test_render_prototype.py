import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 384, 384

def create_gradient_radial(size, center, radius, color_inner, color_outer):
    w, h = size
    cx, cy = center
    y, x = np.ogrid[:h, :w]
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    t = np.clip(dist / radius, 0, 1)
    
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for c in range(4):
        img[..., c] = (color_inner[c] * (1 - t) + color_outer[c] * t).astype(np.uint8)
    return Image.fromarray(img, "RGBA")

def create_face():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # 1. Neck & Shoulders
    # Base neck
    neck_pts = [(165, 230), (165, 305), (219, 305), (219, 230)]
    d.polygon(neck_pts, fill=(240, 212, 192, 255))
    
    # Neck shadow under chin
    neck_shadow = [(165, 240), (192, 268), (219, 240), (219, 275), (165, 275)]
    d.polygon(neck_shadow, fill=(218, 182, 160, 255))

    # Sternocleidomastoid tendons & clavicle
    d.line([(180, 260), (188, 305)], fill=(215, 178, 155, 180), width=3)
    d.line([(204, 260), (196, 305)], fill=(215, 178, 155, 180), width=3)
    d.line([(170, 310), (192, 316), (214, 310)], fill=(210, 170, 148, 200), width=3)

    # Shoulders / Clothes (Black tactical hoodie with orange trim)
    hoodie_pts = [
        (60, 384), (75, 335), (120, 310), (160, 298), (192, 320), (224, 298),
        (264, 310), (309, 335), (324, 384)
    ]
    d.polygon(hoodie_pts, fill=(28, 32, 40, 255))
    # Collar trim
    d.line([(160, 298), (192, 320), (224, 298)], fill=(249, 115, 22, 255), width=5)
    # Drawstrings
    d.line([(180, 320), (180, 365)], fill=(240, 240, 245, 255), width=4)
    d.line([(204, 320), (204, 365)], fill=(240, 240, 245, 255), width=4)
    # Shoulder seams
    d.line([(120, 310), (105, 384)], fill=(18, 20, 26, 255), width=3)
    d.line([(264, 310), (279, 384)], fill=(18, 20, 26, 255), width=3)

    # 2. Ears
    d.ellipse([110, 125, 128, 170], fill=(245, 218, 200, 255), outline=(180, 140, 120, 255), width=3)
    d.ellipse([115, 135, 125, 160], fill=(225, 185, 165, 255))
    d.ellipse([256, 125, 274, 170], fill=(245, 218, 200, 255), outline=(180, 140, 120, 255), width=3)
    d.ellipse([259, 135, 269, 160], fill=(225, 185, 165, 255))

    # 3. Face Contour (Smooth, semi-realistic anime jawline)
    # Using smooth bezier-sampled polygon
    face_pts = [
        (124, 90), (122, 130), (128, 175), (142, 215), (165, 240),
        (185, 250), (192, 251), (199, 250), (219, 240), (242, 215),
        (256, 175), (262, 130), (260, 90), (192, 70)
    ]
    d.polygon(face_pts, fill=(252, 228, 212, 255))
    
    # Soft facial contour shading
    d.line([
        (124, 90), (122, 130), (128, 175), (142, 215), (165, 240),
        (185, 250), (192, 251), (199, 250), (219, 240), (242, 215),
        (256, 175), (262, 130), (260, 90)
    ], fill=(160, 115, 95, 255), width=3)

    # Soft cheek blush (Gaussian blur layer)
    blush_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    blush_d = ImageDraw.Draw(blush_layer)
    blush_d.ellipse([136, 170, 164, 192], fill=(248, 135, 135, 120))
    blush_d.ellipse([220, 170, 248, 192], fill=(248, 135, 135, 120))
    blush_layer = blush_layer.filter(ImageFilter.GaussianBlur(radius=6))
    im.alpha_composite(blush_layer)

    # 4. Sculpted Anime Nose
    d = ImageDraw.Draw(im)
    # Bridge shadow
    d.line([(190, 148), (190, 175)], fill=(218, 175, 150, 130), width=2)
    # Ridge highlight
    d.line([(192, 150), (192, 176)], fill=(255, 245, 240, 180), width=2)
    # Nose tip & sub-nasal shadow
    d.ellipse([191, 176, 194, 179], fill=(255, 255, 255, 230)) # tip highlight
    d.polygon([(188, 181), (193, 180), (196, 182), (192, 183)], fill=(165, 115, 95, 255)) # nostril shadow

    return im

def create_eyes():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Eyebrows (tapered hair strokes)
    brow_col = (40, 30, 30, 255)
    # Left brow
    d.line([(135, 116), (155, 108), (174, 112)], fill=brow_col, width=4)
    d.line([(140, 114), (160, 107)], fill=brow_col, width=3) # thickening
    # Right brow
    d.line([(210, 112), (229, 108), (249, 116)], fill=brow_col, width=4)
    d.line([(224, 107), (244, 114)], fill=brow_col, width=3)

    # Double eyelid creases
    crease_col = (180, 135, 115, 180)
    d.line([(140, 124), (155, 120), (170, 123)], fill=crease_col, width=2)
    d.line([(214, 123), (229, 120), (244, 124)], fill=crease_col, width=2)

    # Sclera (eyeball white)
    d.polygon([(138, 135), (155, 127), (172, 135), (168, 153), (145, 153)], fill=(248, 250, 255, 255))
    d.polygon([(212, 135), (229, 127), (246, 135), (241, 153), (218, 153)], fill=(248, 250, 255, 255))

    # Sclera top shadow (ambient occlusion under upper lid)
    d.polygon([(138, 135), (155, 127), (172, 135), (170, 140), (140, 140)], fill=(200, 205, 220, 140))
    d.polygon([(212, 135), (229, 127), (246, 135), (244, 140), (214, 140)], fill=(200, 205, 220, 140))

    # Irises - Sapphire Blue with multi-layer depth
    # Left Iris
    d.ellipse([146, 128, 168, 155], fill=(20, 60, 140, 255)) # deep base
    d.chord([147, 135, 167, 154], start=0, end=180, fill=(30, 140, 240, 255)) # radiant lower rim
    d.chord([149, 141, 165, 153], start=0, end=180, fill=(90, 210, 255, 255)) # bright cyan refractive crescent
    d.ellipse([153, 134, 161, 147], fill=(10, 15, 30, 255)) # pupil
    d.ellipse([150, 132, 155, 138], fill=(255, 255, 255, 255)) # primary specular sparkle
    d.ellipse([160, 144, 164, 148], fill=(255, 255, 255, 200)) # secondary shine

    # Right Iris
    d.ellipse([216, 128, 238, 155], fill=(20, 60, 140, 255))
    d.chord([217, 135, 237, 154], start=0, end=180, fill=(30, 140, 240, 255))
    d.chord([219, 141, 235, 153], start=0, end=180, fill=(90, 210, 255, 255))
    d.ellipse([223, 134, 231, 147], fill=(10, 15, 30, 255))
    d.ellipse([220, 132, 225, 138], fill=(255, 255, 255, 255))
    d.ellipse([230, 144, 234, 148], fill=(255, 255, 255, 200))

    # Upper lash line (sculpted curved tapered wing)
    d.line([(133, 136), (145, 128), (160, 127), (175, 133)], fill=(20, 20, 25, 255), width=6)
    d.line([(131, 137), (140, 131)], fill=(20, 20, 25, 255), width=4) # outer wing flick
    d.line([(209, 133), (224, 127), (239, 128), (251, 136)], fill=(20, 20, 25, 255), width=6)
    d.line([(244, 131), (253, 137)], fill=(20, 20, 25, 255), width=4)

    # Lower lash line
    d.line([(145, 154), (165, 154)], fill=(120, 85, 75, 200), width=2)
    d.line([(219, 154), (239, 154)], fill=(120, 85, 75, 200), width=2)

    return im

def create_mouth():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Confident subtle smile / smirk
    # Upper lip line with Cupid dip
    d.line([(180, 207), (189, 208), (192, 207), (195, 208), (206, 205)], fill=(140, 60, 60, 255), width=3)
    # Corner tuck
    d.ellipse([179, 206, 181, 208], fill=(110, 45, 45, 255))
    d.ellipse([205, 204, 207, 206], fill=(110, 45, 45, 255))
    # Lower lip shadow (creates realistic 3D fullness)
    d.chord([186, 211, 200, 217], start=0, end=180, fill=(185, 110, 100, 160))
    # Delicate lower lip specular highlight
    d.line([(190, 212), (195, 212)], fill=(255, 235, 230, 210), width=2)

    return im

def create_hair():
    # Hair in back & front
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Layered crimson shonen hair
    hair_dark = (140, 20, 30, 255)
    hair_mid = (210, 35, 45, 255)
    hair_light = (245, 80, 85, 255)

    # Back hair mass
    back_pts = [
        (120, 100), (95, 140), (80, 190), (90, 235), (115, 250), (120, 200),
        (264, 200), (269, 250), (294, 235), (304, 190), (289, 140), (264, 100)
    ]
    d.polygon(back_pts, fill=hair_dark)

    # Front bangs and layered crown
    crown_pts = [
        (192, 38), (160, 50), (130, 42), (110, 75), (85, 85), (92, 130), (75, 145),
        (88, 190), (105, 205), (118, 165), (135, 145), (155, 150), (170, 130),
        (192, 142), (214, 130), (229, 150), (249, 145), (266, 165), (279, 205),
        (296, 190), (309, 145), (292, 130), (299, 85), (274, 75), (254, 42), (224, 50)
    ]
    d.polygon(crown_pts, fill=hair_mid)
    
    # Internal lock definition lines
    d.line([(192, 38), (192, 142)], fill=hair_dark, width=3)
    d.line([(160, 50), (170, 130)], fill=hair_dark, width=3)
    d.line([(224, 50), (214, 130)], fill=hair_dark, width=3)
    d.line([(130, 42), (135, 145)], fill=hair_dark, width=3)
    d.line([(254, 42), (249, 145)], fill=hair_dark, width=3)

    # Anisotropic Hair Highlight ("Angel Ring")
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    halo_d = ImageDraw.Draw(halo)
    halo_pts = [(135, 82), (160, 72), (192, 68), (224, 72), (249, 82), (244, 94), (192, 80), (139, 94)]
    halo_d.polygon(halo_pts, fill=hair_light)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=3))
    im.alpha_composite(halo)

    # Hair silhouette outline
    d = ImageDraw.Draw(im)
    d.line(crown_pts + [crown_pts[0]], fill=(60, 10, 15, 255), width=4)

    return im

face = create_face()
eyes = create_eyes()
mouth = create_mouth()
hair = create_hair()

# Composite
composite = Image.new("RGBA", (W, H), (0, 0, 0, 0))
composite.alpha_composite(face)
composite.alpha_composite(hair)
composite.alpha_composite(eyes)
composite.alpha_composite(mouth)

# Downsample to 96x96
final_96 = composite.resize((96, 96), Image.Resampling.LANCZOS)
final_96.save("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/sample_semi_realistic.png")
composite.save("/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/sample_semi_realistic_large.png")
print("Prototype rendered successfully!")
