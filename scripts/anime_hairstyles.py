import math
from PIL import Image, ImageDraw, ImageFilter

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

def draw_lock(d, pts, base_col, outline_col=(18, 18, 24, 255), width=2):
    d.polygon(pts, fill=base_col)
    if outline_col:
        d.line(pts + [pts[0]], fill=outline_col, width=width)

def draw_anisotropic_sheen(im, crown_pts, hi_col, blur_rad=4):
    halo = Image.new("RGBA", im.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.polygon(crown_pts, fill=hi_col)
    halo = halo.filter(ImageFilter.GaussianBlur(radius=blur_rad))
    im.alpha_composite(halo)

def draw_forehead_shadow(im, shadow_pts, skin_shadow):
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    col = (max(0, skin_shadow[0]-35), max(0, skin_shadow[1]-35), max(0, skin_shadow[2]-35), 110)
    sd.polygon(shadow_pts, fill=col)
    sh = sh.filter(ImageFilter.GaussianBlur(radius=5))
    im.alpha_composite(sh)

# ==============================================================================
# FRONT HAIR STYLES IMPLEMENTATION (28 INDIVIDUAL BESPOKE ROUTINES)
# ==============================================================================

def render_front_hair_for_archetype(im, arch):
    style = arch["style"]
    h_base = arch["hair_base"] + (255,)
    h_dark = arch["hair_dark"] + (255,)
    h_hi = arch["hair_hi"] + (220,)
    c_acc = arch["clothing_accent"] + (255,)
    skin_shadow = arch["skin"][1]
    line_col = (max(0, arch["hair_dark"][0]-12), max(0, arch["hair_dark"][1]-12), max(0, arch["hair_dark"][2]-12), 255)

    front_im = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(front_im)

    # ---------------------------------------------------------
    # 0: Messy Layered Shonen (Shadow Rogue)
    # ---------------------------------------------------------
    if style == "messy_shonen":
        draw_forehead_shadow(im, [(115, 90), (192, 85), (269, 90), (260, 135), (192, 142), (124, 135)], skin_shadow)
        crown = [(48, 120), (45, 80), (60, 50), (90, 28), (130, 16), (165, 8), (192, 18),
                 (220, 8), (255, 18), (295, 30), (325, 55), (339, 85), (336, 120),
                 (290, 85), (192, 80), (95, 85)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Sidelocks
        l_lock = [(48, 120), (62, 175), (78, 235), (92, 245), (86, 190), (75, 130)]
        r_lock = [(336, 120), (322, 175), (306, 235), (292, 245), (298, 190), (309, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Bangs
        b1 = make_lock((115, 85), (125, 105), (135, 125), (138, 138), (145, 115), (140, 95), (135, 85))
        b2 = make_lock((145, 85), (155, 110), (165, 135), (172, 148), (175, 120), (170, 98), (165, 84))
        b3 = make_lock((180, 84), (190, 110), (200, 135), (208, 145), (212, 118), (205, 96), (198, 84))
        b4 = make_lock((215, 85), (225, 105), (235, 125), (242, 135), (245, 112), (240, 95), (235, 85))
        for b in [b1, b2, b3, b4]:
            draw_lock(d, b, h_base, line_col, 2)
        # Top spikes
        d.polygon([(160, 12), (175, -2), (188, 10)], fill=h_base)
        d.polygon([(200, 10), (215, -2), (228, 12)], fill=h_base)
        d.line([(160, 12), (175, -2), (188, 10)], fill=line_col, width=3)
        d.line([(200, 10), (215, -2), (228, 12)], fill=line_col, width=3)
        # Sheen
        draw_anisotropic_sheen(front_im, [(105, 60), (150, 48), (192, 45), (234, 48), (279, 60), (272, 70), (192, 55), (112, 70)], h_hi)

    # ---------------------------------------------------------
    # 1: Curtain Bangs Bob (Cyber Samurai)
    # ---------------------------------------------------------
    elif style == "curtain_bob":
        draw_forehead_shadow(im, [(125, 90), (192, 85), (259, 90), (250, 132), (192, 100), (134, 132)], skin_shadow)
        # Two lobes parting in center
        crown_l = bezier_curve((52, 120), (55, 60), (105, 22), (188, 18), 15) + [(192, 34)]
        crown_r = [(192, 34)] + bezier_curve((196, 18), (279, 22), (329, 60), (332, 120), 15)
        hairline = [(332, 120), (285, 90), (192, 85), (99, 90), (52, 120)]
        d.polygon(crown_l + crown_r + hairline, fill=h_base)
        d.line(crown_l + crown_r, fill=line_col, width=3)
        # Sidelocks curving around jaw
        l_lock = bezier_curve((52, 120), (65, 175), (85, 235), (120, 260), 15) + [(105, 215), (78, 140)]
        r_lock = bezier_curve((332, 120), (319, 175), (299, 235), (264, 260), 15) + [(279, 215), (306, 140)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Curtain Bangs
        b_l = make_lock((192, 35), (160, 65), (140, 105), (130, 148), (148, 115), (175, 75), (188, 40))
        b_r = make_lock((196, 40), (209, 75), (236, 115), (254, 148), (244, 105), (224, 65), (192, 35))
        draw_lock(d, b_l, h_base, line_col, 2)
        draw_lock(d, b_r, h_base, line_col, 2)
        # Soft sheen
        draw_anisotropic_sheen(front_im, [(95, 55), (145, 42), (185, 40), (185, 50), (140, 52), (95, 65)], h_hi)
        draw_anisotropic_sheen(front_im, [(199, 40), (239, 42), (289, 55), (289, 65), (244, 52), (199, 50)], h_hi)

    # ---------------------------------------------------------
    # 2: Spiky Shonen Short Hair (Crimson Blaze)
    # ---------------------------------------------------------
    elif style == "spiky_shonen":
        draw_forehead_shadow(im, [(110, 85), (192, 80), (274, 85), (265, 128), (192, 120), (119, 128)], skin_shadow)
        crown = [(48, 120), (38, 85), (50, 55), (75, 30), (105, 12), (140, 0), (170, -6),
                 (192, 10), (214, -6), (244, 0), (279, 12), (309, 30), (334, 55), (346, 85), (336, 120),
                 (290, 85), (192, 75), (95, 85)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Sidelocks
        l_lock = [(48, 120), (60, 165), (75, 220), (88, 230), (84, 180), (74, 130)]
        r_lock = [(336, 120), (324, 165), (309, 220), (296, 230), (300, 180), (310, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Dynamic Starburst Bangs
        s1 = make_lock((110, 82), (120, 100), (128, 118), (130, 132), (138, 110), (134, 92), (130, 82))
        s2 = make_lock((138, 80), (148, 102), (155, 120), (160, 135), (168, 108), (164, 90), (158, 80))
        s3 = make_lock((175, 76), (185, 95), (190, 118), (192, 130), (199, 100), (195, 88), (190, 76))
        s4 = make_lock((205, 80), (215, 102), (222, 120), (224, 135), (234, 108), (230, 90), (224, 80))
        s5 = make_lock((238, 82), (248, 100), (256, 118), (254, 132), (266, 110), (262, 92), (258, 82))
        for s in [s1, s2, s3, s4, s5]:
            draw_lock(d, s, h_base, line_col, 2)
        # Glossy spike tips
        draw_anisotropic_sheen(front_im, [(120, 45), (160, 30), (192, 35), (224, 30), (264, 45), (255, 55), (192, 45), (129, 55)], h_hi)

    # ---------------------------------------------------------
    # 3: Side-Swept Medium Layers (Frost Sorcerer)
    # ---------------------------------------------------------
    elif style == "side_sweep_medium":
        draw_forehead_shadow(im, [(115, 88), (180, 82), (250, 88), (240, 120), (160, 145), (115, 140)], skin_shadow)
        # Asymmetric crown, part on right (x=240), flowing to left
        crown = [(48, 120), (45, 75), (65, 42), (105, 18), (155, 12), (200, 16), (240, 24),
                 (285, 45), (325, 75), (334, 120), (285, 90), (192, 85), (95, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Left sweeping lock
        l_lock = bezier_curve((48, 120), (62, 175), (75, 235), (100, 255), 15) + [(85, 210), (74, 140)]
        r_lock = bezier_curve((334, 120), (324, 175), (312, 225), (298, 235), 15) + [(302, 185), (310, 135)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Giant sweeping fringe from right part line across forehead to left cheek
        sw1 = make_lock((240, 28), (200, 50), (165, 95), (145, 142), (170, 95), (215, 55), (248, 35))
        sw2 = make_lock((205, 30), (175, 60), (140, 105), (120, 148), (145, 105), (185, 65), (215, 36))
        sw3 = make_lock((250, 36), (262, 70), (275, 105), (278, 125), (270, 95), (260, 65), (252, 42))
        draw_lock(d, sw1, h_base, line_col, 2)
        draw_lock(d, sw2, h_base, line_col, 2)
        draw_lock(d, sw3, h_base, line_col, 2)
        # Sheen
        draw_anisotropic_sheen(front_im, [(115, 45), (160, 35), (205, 38), (200, 48), (155, 46), (115, 56)], h_hi)

    # ---------------------------------------------------------
    # 4: Runner Textured w/ Headband (Electric Prodigy)
    # ---------------------------------------------------------
    elif style == "runner_textured":
        # Short spiky hair with athletic headband
        crown = [(55, 120), (50, 75), (70, 45), (105, 24), (145, 12), (192, 10), (239, 12),
                 (279, 24), (314, 45), (334, 75), (329, 120), (280, 85), (192, 80), (104, 85)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Top spiky texture
        for px, py in [(130, 16), (165, 10), (192, 8), (219, 10), (254, 16)]:
            d.polygon([(px-12, py+10), (px, py-6), (px+12, py+10)], fill=h_base)
            d.line([(px-12, py+10), (px, py-6), (px+12, py+10)], fill=line_col, width=2)
        # Headband across forehead
        hb_pts = [(78, 92), (192, 82), (306, 92), (306, 116), (192, 106), (78, 116)]
        d.polygon(hb_pts, fill=(252, 252, 255, 255))
        d.line([(78, 104), (192, 94), (306, 104)], fill=c_acc, width=5)
        d.line(hb_pts + [hb_pts[0]], fill=line_col, width=3)
        # Sidelocks
        l_lock = [(75, 116), (72, 165), (88, 205), (94, 210), (90, 170), (84, 125)]
        r_lock = [(309, 116), (312, 165), (296, 205), (290, 210), (294, 170), (300, 125)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Forward spiky bangs spilling over headband
        f1 = make_lock((125, 90), (135, 105), (140, 118), (142, 128), (148, 108), (145, 94), (140, 90))
        f2 = make_lock((168, 86), (175, 102), (180, 120), (182, 130), (188, 106), (185, 92), (180, 86))
        f3 = make_lock((204, 86), (212, 102), (218, 120), (220, 130), (226, 106), (222, 92), (218, 86))
        f4 = make_lock((244, 90), (252, 105), (258, 118), (260, 128), (266, 108), (262, 94), (258, 90))
        for f in [f1, f2, f3, f4]:
            draw_lock(d, f, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(115, 48), (155, 38), (192, 36), (229, 38), (269, 48), (260, 58), (192, 46), (124, 58)], h_hi)

    # ---------------------------------------------------------
    # 5: Wavy Shoulder Layers (Star Vocalist)
    # ---------------------------------------------------------
    elif style == "wavy_layers":
        draw_forehead_shadow(im, [(120, 90), (192, 85), (264, 90), (255, 132), (192, 135), (129, 132)], skin_shadow)
        crown = bezier_curve((52, 120), (55, 60), (105, 20), (192, 16), 18) + \
                bezier_curve((192, 16), (279, 20), (329, 60), (332, 120), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # S-curve wavy front framing locks
        l_lock = bezier_curve((52, 120), (68, 175), (82, 235), (115, 265), 15) + [(100, 230), (75, 150)]
        r_lock = bezier_curve((332, 120), (316, 175), (302, 235), (269, 265), 15) + [(284, 230), (309, 150)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Soft wispy arched bangs
        w1 = make_lock((122, 86), (135, 105), (145, 120), (148, 132), (154, 110), (148, 92), (140, 86))
        w2 = make_lock((155, 84), (165, 105), (174, 124), (178, 136), (184, 112), (178, 94), (170, 84))
        w3 = make_lock((214, 84), (222, 105), (218, 124), (214, 136), (226, 112), (224, 94), (229, 84))
        w4 = make_lock((244, 86), (252, 105), (248, 120), (244, 132), (256, 110), (254, 92), (262, 86))
        for w in [w1, w2, w3, w4]:
            draw_lock(d, w, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(105, 52), (150, 40), (192, 38), (234, 40), (279, 52), (270, 62), (192, 48), (114, 62)], h_hi)

    # ---------------------------------------------------------
    # 6: Asymmetrical Cyber Bob (Digital Nomad)
    # ---------------------------------------------------------
    elif style == "cyber_asym":
        draw_forehead_shadow(im, [(115, 88), (180, 82), (255, 90), (245, 115), (160, 135), (115, 135)], skin_shadow)
        crown = [(50, 120), (45, 70), (70, 35), (115, 18), (170, 14), (220, 20), (275, 38),
                 (320, 68), (330, 120), (280, 88), (192, 82), (96, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Right side: clean high undercut
        d.polygon([(285, 90), (325, 105), (320, 160), (290, 145)], fill=h_dark)
        d.line([(285, 90), (325, 105), (320, 160)], fill=line_col, width=2)
        # Left side: razor sharp long angular blade extending past chin
        l_blade = bezier_curve((50, 120), (60, 185), (75, 260), (95, 305), 18) + \
                  bezier_curve((95, 305), (105, 245), (95, 185), (82, 135), 15)
        draw_lock(d, l_blade, h_base, line_col, 2)
        # Sharp diagonal micro-fringe
        b1 = make_lock((115, 86), (125, 102), (135, 118), (138, 128), (145, 106), (140, 92), (135, 86))
        b2 = make_lock((145, 85), (155, 102), (165, 116), (170, 125), (175, 104), (170, 90), (165, 84))
        b3 = make_lock((180, 84), (190, 98), (198, 110), (202, 118), (206, 98), (202, 88), (198, 84))
        b4 = make_lock((215, 86), (225, 96), (232, 105), (235, 112), (238, 96), (235, 88), (230, 86))
        for b in [b1, b2, b3, b4]:
            draw_lock(d, b, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(100, 52), (145, 42), (185, 40), (185, 50), (140, 52), (100, 62)], h_hi)

    # ---------------------------------------------------------
    # 7: Shaggy Wolf Cut Mullet (Desert Wanderer)
    # ---------------------------------------------------------
    elif style == "wolf_cut":
        draw_forehead_shadow(im, [(120, 88), (192, 84), (264, 88), (255, 132), (192, 138), (129, 132)], skin_shadow)
        crown = [(48, 120), (42, 80), (55, 50), (85, 26), (125, 14), (165, 10), (192, 18),
                 (219, 10), (259, 14), (299, 26), (329, 50), (342, 80), (336, 120),
                 (285, 85), (192, 80), (99, 85)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Flared side locks
        l_lock = [(48, 120), (55, 175), (42, 225), (78, 235), (86, 185), (75, 130)]
        r_lock = [(336, 120), (329, 175), (342, 225), (306, 235), (298, 185), (309, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Tousled piecey curtain bangs
        b1 = make_lock((125, 84), (135, 105), (145, 124), (150, 136), (156, 112), (152, 94), (146, 84))
        b2 = make_lock((160, 82), (170, 104), (178, 126), (182, 140), (188, 114), (184, 94), (178, 82))
        b3 = make_lock((206, 82), (214, 104), (220, 126), (222, 140), (228, 114), (224, 94), (222, 82))
        b4 = make_lock((238, 84), (246, 105), (252, 124), (254, 136), (260, 112), (256, 94), (254, 84))
        for b in [b1, b2, b3, b4]:
            draw_lock(d, b, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(105, 50), (150, 38), (192, 36), (234, 38), (279, 50), (270, 60), (192, 46), (114, 60)], h_hi)

    # ---------------------------------------------------------
    # 8: Slicked-Back Undercut (Silent Striker)
    # ---------------------------------------------------------
    elif style == "slicked_undercut":
        # High comb back, temples faded
        d.polygon([(65, 100), (95, 105), (90, 155), (65, 145)], fill=h_dark)
        d.polygon([(319, 100), (289, 105), (294, 155), (319, 145)], fill=h_dark)
        # High crown lifted off forehead
        crown = bezier_curve((92, 105), (96, 45), (140, 12), (192, 10), 18) + \
                bezier_curve((192, 10), (244, 12), (288, 45), (292, 105), 18) + \
                bezier_curve((292, 105), (250, 75), (134, 75), (92, 105), 18)
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Directional comb lines
        for offset in [-60, -30, 0, 30, 60]:
            x_b = 192 + offset
            d.line([(x_b, 75), (x_b + int(offset * 0.2), 25)], fill=line_col, width=2)
        # Forehead hairline & single stray rebellious lock
        draw_forehead_shadow(im, [(110, 75), (192, 72), (274, 75), (265, 95), (192, 92), (119, 95)], skin_shadow)
        stray = make_lock((220, 76), (225, 95), (230, 115), (234, 130), (238, 110), (232, 92), (228, 76))
        draw_lock(d, stray, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(125, 42), (160, 30), (192, 28), (224, 30), (259, 42), (250, 52), (192, 38), (134, 52)], h_hi)

    # ---------------------------------------------------------
    # 9: High Twin Tails w/ Ribbons (Sakura Idol)
    # ---------------------------------------------------------
    elif style == "twin_tails":
        draw_forehead_shadow(im, [(120, 90), (192, 85), (264, 90), (255, 128), (192, 130), (129, 128)], skin_shadow)
        # Crown gathered towards twin tails
        crown = [(55, 115), (55, 75), (75, 45), (120, 20), (192, 16), (264, 20), (309, 45),
                 (329, 75), (329, 115), (280, 88), (192, 82), (104, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Straight sleek anime bangs
        b_main = bezier_curve((115, 86), (150, 118), (234, 118), (269, 86), 20) + \
                 bezier_curve((269, 86), (234, 82), (150, 82), (115, 86), 20)
        d.polygon(b_main, fill=h_base)
        d.line(b_main, fill=line_col, width=2)
        # Sidelocks
        l_lock = [(65, 115), (70, 175), (82, 240), (94, 250), (90, 195), (80, 130)]
        r_lock = [(319, 115), (314, 175), (302, 240), (290, 250), (294, 195), (304, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(105, 52), (150, 40), (192, 38), (234, 40), (279, 52), (270, 62), (192, 48), (114, 62)], h_hi)

    # ---------------------------------------------------------
    # 10: 7:3 Side-Parted Medium (Arcane Scholar)
    # ---------------------------------------------------------
    elif style == "scholar_part":
        draw_forehead_shadow(im, [(120, 88), (170, 82), (260, 88), (250, 125), (170, 135), (120, 130)], skin_shadow)
        crown = [(50, 120), (50, 75), (75, 40), (120, 18), (160, 14), (210, 18), (265, 35),
                 (315, 65), (332, 120), (285, 90), (192, 85), (96, 90)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Part line at x=155
        d.line([(160, 14), (165, 85)], fill=line_col, width=3)
        # Sidelocks
        l_lock = bezier_curve((50, 120), (65, 175), (80, 230), (98, 245), 15) + [(88, 195), (76, 140)]
        r_lock = bezier_curve((332, 120), (320, 175), (305, 230), (288, 245), 15) + [(296, 195), (308, 140)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Elegant side-parted fringe arching over right brow
        s_r1 = make_lock((165, 82), (185, 102), (210, 122), (220, 134), (226, 110), (215, 92), (195, 82))
        s_r2 = make_lock((200, 84), (220, 104), (242, 124), (248, 135), (252, 110), (245, 94), (230, 84))
        s_l = make_lock((155, 82), (145, 102), (135, 120), (132, 128), (140, 106), (148, 92), (155, 82))
        draw_lock(d, s_r1, h_base, line_col, 2)
        draw_lock(d, s_r2, h_base, line_col, 2)
        draw_lock(d, s_l, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(105, 52), (145, 42), (175, 40), (175, 50), (140, 52), (105, 62)], h_hi)
        draw_anisotropic_sheen(front_im, [(185, 40), (225, 42), (275, 55), (270, 65), (225, 52), (185, 50)], h_hi)

    # ---------------------------------------------------------
    # 11: Wild Spiky Wolf Cut (Neon Phantom)
    # ---------------------------------------------------------
    elif style == "wild_wolf":
        draw_forehead_shadow(im, [(115, 85), (192, 80), (269, 85), (260, 135), (192, 130), (124, 135)], skin_shadow)
        crown = [(45, 120), (32, 80), (45, 45), (75, 20), (115, 5), (155, -2), (192, 8),
                 (229, -2), (269, 5), (309, 20), (339, 45), (352, 80), (339, 120),
                 (285, 85), (192, 75), (96, 85)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Wild spiky sidelocks
        l_lock = [(45, 120), (55, 170), (35, 225), (72, 240), (84, 190), (74, 135)]
        r_lock = [(339, 120), (329, 170), (349, 225), (312, 240), (300, 190), (310, 135)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Deep jagged multi-level fringe
        w1 = make_lock((115, 82), (125, 105), (135, 130), (138, 145), (146, 115), (142, 95), (136, 82))
        w2 = make_lock((145, 80), (155, 105), (165, 135), (170, 148), (178, 118), (172, 95), (166, 80))
        w3 = make_lock((180, 80), (190, 105), (198, 135), (200, 148), (208, 118), (204, 95), (198, 80))
        w4 = make_lock((215, 82), (225, 105), (235, 130), (238, 145), (246, 115), (242, 95), (236, 82))
        for w in [w1, w2, w3, w4]:
            draw_lock(d, w, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(105, 45), (150, 32), (192, 30), (234, 32), (279, 45), (270, 55), (192, 40), (114, 55)], h_hi)

    # ---------------------------------------------------------
    # 12: Textured Military Crop (Iron Vanguard)
    # ---------------------------------------------------------
    elif style == "military_crop":
        # Structured square crew cut
        crown = [(85, 110), (82, 60), (110, 35), (150, 24), (192, 22), (234, 24), (274, 35),
                 (302, 60), (299, 110), (275, 88), (192, 85), (109, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # High fade sides
        d.polygon([(70, 110), (88, 110), (86, 155), (70, 150)], fill=h_dark)
        d.polygon([(314, 110), (296, 110), (298, 155), (314, 150)], fill=h_dark)
        # Short blunt textured micro-fringe
        draw_forehead_shadow(im, [(115, 88), (192, 85), (269, 88), (265, 108), (192, 106), (119, 108)], skin_shadow)
        for i in range(7):
            bx = 125 + i * 20
            d.polygon([(bx, 86), (bx + 10, 104), (bx + 20, 86)], fill=h_base)
            d.line([(bx, 86), (bx + 10, 104), (bx + 20, 86)], fill=line_col, width=2)
        draw_anisotropic_sheen(front_im, [(115, 52), (155, 42), (192, 40), (229, 42), (269, 52), (260, 60), (192, 48), (124, 60)], h_hi)

    # ---------------------------------------------------------
    # 13: Curtain Bangs Flow (Solar Knight)
    # ---------------------------------------------------------
    elif style == "curtain_flow":
        draw_forehead_shadow(im, [(125, 90), (192, 85), (259, 90), (250, 135), (192, 100), (134, 135)], skin_shadow)
        crown_l = bezier_curve((52, 120), (55, 55), (110, 18), (188, 16), 15) + [(192, 32)]
        crown_r = [(192, 32)] + bezier_curve((196, 16), (274, 18), (329, 55), (332, 120), 15)
        hairline = [(332, 120), (285, 90), (192, 84), (99, 90), (52, 120)]
        d.polygon(crown_l + crown_r + hairline, fill=h_base)
        d.line(crown_l + crown_r, fill=line_col, width=3)
        # Flowing sidelocks
        l_lock = bezier_curve((52, 120), (65, 175), (82, 235), (115, 265), 15) + [(100, 225), (75, 145)]
        r_lock = bezier_curve((332, 120), (319, 175), (302, 235), (269, 265), 15) + [(284, 225), (309, 145)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Romantic wide curtain bangs
        b_l = make_lock((192, 34), (160, 65), (135, 105), (125, 150), (145, 115), (175, 75), (188, 38))
        b_r = make_lock((196, 38), (209, 75), (239, 105), (259, 150), (249, 115), (224, 65), (192, 34))
        draw_lock(d, b_l, h_base, line_col, 2)
        draw_lock(d, b_r, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(95, 52), (145, 38), (185, 36), (185, 46), (140, 48), (95, 62)], h_hi)
        draw_anisotropic_sheen(front_im, [(199, 36), (239, 38), (289, 52), (289, 62), (244, 48), (199, 46)], h_hi)

    # ---------------------------------------------------------
    # 14: Long Cascading Waves (Ocean Mist)
    # ---------------------------------------------------------
    elif style == "cascading_waves":
        draw_forehead_shadow(im, [(120, 88), (192, 85), (264, 88), (255, 130), (192, 134), (129, 130)], skin_shadow)
        crown = bezier_curve((48, 120), (52, 55), (105, 16), (192, 12), 18) + \
                bezier_curve((192, 12), (279, 16), (332, 55), (336, 120), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Front cascading wave locks reaching chest
        l_front = bezier_curve((48, 120), (65, 185), (82, 265), (105, 335), 18) + \
                  bezier_curve((105, 335), (90, 265), (75, 185), (65, 130), 15)
        r_front = bezier_curve((336, 120), (319, 185), (302, 265), (279, 335), 18) + \
                  bezier_curve((279, 335), (294, 265), (309, 185), (319, 130), 15)
        draw_lock(d, l_front, h_base, line_col, 2)
        draw_lock(d, r_front, h_base, line_col, 2)
        # Soft parted wispy fringe
        w1 = make_lock((130, 86), (142, 105), (150, 122), (154, 134), (160, 112), (155, 94), (148, 86))
        w2 = make_lock((236, 86), (244, 105), (238, 122), (234, 134), (246, 112), (244, 94), (252, 86))
        draw_lock(d, w1, h_base, line_col, 2)
        draw_lock(d, w2, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(100, 48), (148, 36), (192, 34), (236, 36), (284, 48), (275, 58), (192, 44), (109, 58)], h_hi)

    # ---------------------------------------------------------
    # 15: High Ponytail w/ Draping Arch (Midnight Ace)
    # ---------------------------------------------------------
    elif style == "high_ponytail":
        draw_forehead_shadow(im, [(120, 88), (192, 85), (264, 88), (255, 128), (192, 132), (129, 128)], skin_shadow)
        # Sleek pulled-back tension lines leading to top tie at (245, 45)
        crown = bezier_curve((55, 120), (60, 70), (120, 25), (245, 40), 18) + \
                bezier_curve((245, 40), (280, 50), (325, 80), (330, 120), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Tension sweep lines
        d.line([(100, 95), (235, 45)], fill=line_col, width=2)
        d.line([(140, 90), (240, 45)], fill=line_col, width=2)
        d.line([(190, 85), (245, 45)], fill=line_col, width=2)
        # Long slender face framing locks
        l_lock = [(55, 120), (68, 175), (84, 240), (96, 255), (90, 195), (78, 130)]
        r_lock = [(330, 120), (318, 175), (304, 240), (292, 255), (296, 195), (308, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Light feathered brow fringe
        f1 = make_lock((135, 86), (145, 104), (152, 120), (155, 130), (160, 108), (155, 92), (150, 86))
        f2 = make_lock((175, 84), (185, 102), (190, 118), (192, 128), (198, 106), (194, 90), (188, 84))
        draw_lock(d, f1, h_base, line_col, 2)
        draw_lock(d, f2, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(115, 52), (165, 42), (215, 44), (210, 54), (160, 52), (115, 62)], h_hi)

    # ---------------------------------------------------------
    # 16: Windblown Spiky Wild Cut (Emerald Hunter)
    # ---------------------------------------------------------
    elif style == "windblown_spikes":
        draw_forehead_shadow(im, [(115, 85), (192, 80), (269, 85), (260, 132), (192, 128), (124, 132)], skin_shadow)
        # Windblown crown tufts sweeping diagonally
        crown = [(48, 120), (42, 80), (52, 45), (80, 20), (120, 8), (165, 2), (205, 8),
                 (250, 18), (290, 35), (325, 60), (342, 85), (336, 120), (285, 85), (192, 78), (96, 85)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Sidelocks
        l_lock = [(48, 120), (60, 175), (75, 230), (90, 245), (84, 185), (74, 130)]
        r_lock = [(336, 120), (325, 165), (312, 220), (300, 235), (304, 185), (312, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Windblown feathered bangs flicking sideways
        w1 = make_lock((115, 82), (125, 102), (135, 122), (142, 136), (148, 112), (142, 94), (135, 82))
        w2 = make_lock((145, 80), (160, 102), (175, 124), (185, 138), (188, 112), (180, 94), (170, 80))
        w3 = make_lock((185, 78), (200, 100), (218, 122), (228, 136), (230, 110), (220, 92), (210, 78))
        for w in [w1, w2, w3]:
            draw_lock(d, w, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(115, 46), (160, 32), (205, 32), (245, 42), (235, 52), (195, 42), (150, 42), (115, 56)], h_hi)

    # ---------------------------------------------------------
    # 17: Curly / Wavy Voluminous Crop (Golden Champion)
    # ---------------------------------------------------------
    elif style == "curly_crop":
        draw_forehead_shadow(im, [(120, 88), (192, 85), (264, 88), (255, 125), (192, 126), (129, 125)], skin_shadow)
        # Bumpy undulating curly crown silhouette
        crown_pts = [(55, 120)]
        for angle_deg in range(180, 360, 15):
            rad = math.radians(angle_deg)
            r = 135 + 8 * math.sin(angle_deg * 0.4)
            cx = 192 + int(r * math.cos(rad) * 0.95)
            cy = 130 + int(r * math.sin(rad) * 0.85)
            crown_pts.append((cx, cy))
        crown_pts += [(329, 120), (280, 88), (192, 84), (104, 88)]
        d.polygon(crown_pts, fill=h_base)
        d.line(crown_pts + [crown_pts[0]], fill=line_col, width=3)
        # Curly sidelocks
        l_lock = [(55, 120), (68, 165), (75, 205), (92, 215), (86, 175), (75, 130)]
        r_lock = [(329, 120), (316, 165), (309, 205), (292, 215), (298, 175), (309, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Bouncy ringlet curl bangs
        for i in range(5):
            rx = 135 + i * 26
            d.chord([rx - 12, 102, rx + 12, 132], start=0, end=180, fill=h_base, outline=line_col, width=2)
            d.arc([rx - 8, 108, rx + 8, 126], start=0, end=180, fill=line_col, width=2)
        draw_anisotropic_sheen(front_im, [(115, 55), (155, 45), (192, 42), (229, 45), (269, 55), (260, 65), (192, 52), (124, 65)], h_hi)

    # ---------------------------------------------------------
    # 18: Long Straight Hime Cut (Twilight Reaper)
    # ---------------------------------------------------------
    elif style == "hime_straight":
        draw_forehead_shadow(im, [(115, 88), (192, 85), (269, 88), (265, 128), (192, 128), (119, 128)], skin_shadow)
        # Ultra-straight sleek crown
        crown = bezier_curve((55, 120), (60, 60), (110, 20), (192, 16), 18) + \
                bezier_curve((192, 16), (274, 20), (324, 60), (329, 120), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Razor-sharp square cheek hime sideblocks ending cleanly at chin (y=230)
        l_hime = [(55, 120), (62, 175), (65, 230), (105, 230), (100, 175), (85, 125)]
        r_hime = [(329, 120), (322, 175), (319, 230), (279, 230), (284, 175), (299, 125)]
        draw_lock(d, l_hime, h_base, line_col, 2)
        draw_lock(d, r_hime, h_base, line_col, 2)
        # Perfectly horizontal straight blunt bangs
        b_blunt = [(110, 85), (274, 85), (274, 125), (110, 125)]
        d.polygon(b_blunt, fill=h_base)
        d.line([(110, 125), (274, 125)], fill=line_col, width=3)
        # Thin texture lines
        for bx in [135, 165, 195, 225, 250]:
            d.line([(bx, 88), (bx, 125)], fill=line_col, width=1)
        draw_anisotropic_sheen(front_im, [(105, 52), (150, 40), (192, 38), (234, 40), (279, 52), (270, 62), (192, 48), (114, 62)], h_hi)

    # ---------------------------------------------------------
    # 19: Feathered Pixie Cut (Ruby Duelist)
    # ---------------------------------------------------------
    elif style == "feathered_pixie":
        draw_forehead_shadow(im, [(120, 88), (180, 82), (260, 88), (250, 125), (170, 138), (120, 132)], skin_shadow)
        crown = [(55, 120), (50, 75), (75, 42), (115, 20), (160, 12), (205, 14), (255, 28),
                 (305, 55), (329, 85), (324, 120), (280, 88), (192, 80), (104, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Feathered ear locks
        l_lock = [(55, 120), (68, 165), (82, 210), (94, 215), (88, 175), (78, 125)]
        r_lock = [(324, 120), (315, 165), (302, 210), (290, 215), (296, 175), (306, 125)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Chic feathered diagonal fringe
        p1 = make_lock((120, 84), (135, 105), (145, 124), (148, 136), (156, 112), (150, 94), (142, 84))
        p2 = make_lock((150, 82), (165, 105), (175, 128), (180, 142), (188, 115), (182, 94), (174, 82))
        p3 = make_lock((182, 82), (195, 102), (205, 122), (210, 134), (218, 110), (212, 92), (204, 82))
        p4 = make_lock((214, 84), (225, 100), (234, 115), (238, 124), (245, 105), (240, 90), (232, 84))
        for p in [p1, p2, p3, p4]:
            draw_lock(d, p, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(115, 48), (160, 36), (205, 36), (245, 48), (235, 58), (195, 46), (150, 46), (115, 58)], h_hi)

    # ---------------------------------------------------------
    # 20: Braided Accent Flow (Verdant Druid)
    # ---------------------------------------------------------
    elif style == "braided_flow":
        draw_forehead_shadow(im, [(125, 90), (192, 85), (264, 90), (255, 132), (192, 136), (130, 132)], skin_shadow)
        crown = bezier_curve((52, 120), (55, 60), (105, 20), (192, 16), 18) + \
                bezier_curve((192, 16), (279, 20), (329, 60), (332, 120), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Crown braid detail on left
        for i in range(5):
            bx = 90 + i * 16
            by = 75 - i * 8
            d.ellipse([bx - 9, by - 6, bx + 9, by + 6], fill=h_dark, outline=line_col, width=2)
            d.line([(bx - 7, by), (bx + 7, by)], fill=c_acc, width=2)
        # Sidelocks
        l_lock = bezier_curve((52, 120), (65, 175), (82, 245), (110, 275), 15) + [(95, 235), (75, 145)]
        r_lock = bezier_curve((332, 120), (319, 175), (302, 245), (274, 275), 15) + [(289, 235), (309, 145)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Natural separated fringe
        b1 = make_lock((130, 86), (140, 105), (148, 120), (150, 132), (156, 110), (152, 92), (145, 86))
        b2 = make_lock((165, 84), (175, 105), (182, 125), (185, 138), (192, 112), (188, 92), (182, 84))
        b3 = make_lock((210, 84), (220, 105), (226, 125), (228, 138), (235, 112), (230, 92), (225, 84))
        for b in [b1, b2, b3]:
            draw_lock(d, b, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(105, 52), (150, 40), (192, 38), (234, 40), (279, 52), (270, 62), (192, 48), (114, 62)], h_hi)

    # ---------------------------------------------------------
    # 21: Pristine Hime Cut (Silver Valkyrie)
    # ---------------------------------------------------------
    elif style == "silver_hime":
        draw_forehead_shadow(im, [(115, 88), (192, 85), (269, 88), (265, 126), (192, 126), (119, 126)], skin_shadow)
        crown = bezier_curve((55, 120), (60, 58), (110, 18), (192, 14), 18) + \
                bezier_curve((192, 14), (274, 18), (324, 58), (329, 120), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Razor-sharp silver cheek blocks
        l_hime = [(55, 120), (62, 175), (65, 235), (102, 235), (98, 175), (85, 125)]
        r_hime = [(329, 120), (322, 175), (319, 235), (282, 235), (286, 175), (299, 125)]
        draw_lock(d, l_hime, h_base, line_col, 2)
        draw_lock(d, r_hime, h_base, line_col, 2)
        # Separated straight fringe
        b_blunt = [(112, 86), (272, 86), (272, 124), (112, 124)]
        d.polygon(b_blunt, fill=h_base)
        d.line([(112, 124), (272, 124)], fill=line_col, width=3)
        for bx in [130, 150, 170, 192, 214, 234, 254]:
            d.line([(bx, 88), (bx, 124)], fill=line_col, width=1)
        draw_anisotropic_sheen(front_im, [(105, 50), (150, 38), (192, 36), (234, 38), (279, 50), (270, 60), (192, 46), (114, 60)], h_hi)

    # ---------------------------------------------------------
    # 22: Undercut Side-Sweep (Cyberpunk Rebel)
    # ---------------------------------------------------------
    elif style == "undercut_sweep":
        draw_forehead_shadow(im, [(115, 85), (180, 80), (260, 85), (250, 120), (160, 142), (115, 138)], skin_shadow)
        crown = [(50, 120), (45, 70), (70, 35), (115, 12), (170, 8), (225, 15), (275, 35),
                 (320, 68), (330, 120), (280, 88), (192, 80), (96, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Shaved right temple
        d.polygon([(290, 92), (325, 105), (320, 155), (295, 145)], fill=h_dark)
        d.line([(290, 92), (325, 105), (320, 155)], fill=line_col, width=2)
        # Voluminous left sweep
        l_lock = bezier_curve((50, 120), (62, 185), (78, 255), (105, 295), 18) + [(90, 240), (75, 140)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        # Heavy sweeping fringe
        s1 = make_lock((230, 24), (195, 50), (155, 95), (135, 145), (165, 95), (205, 55), (238, 30))
        s2 = make_lock((195, 26), (165, 58), (132, 105), (115, 150), (140, 105), (175, 65), (205, 32))
        draw_lock(d, s1, h_base, line_col, 2)
        draw_lock(d, s2, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(115, 42), (165, 30), (210, 32), (205, 42), (160, 42), (115, 52)], h_hi)

    # ---------------------------------------------------------
    # 23: Twin Drill Spiral Curls (Gothic Aristocrat)
    # ---------------------------------------------------------
    elif style == "drill_curls":
        draw_forehead_shadow(im, [(125, 90), (192, 85), (259, 90), (250, 130), (192, 132), (134, 130)], skin_shadow)
        crown = bezier_curve((55, 120), (60, 55), (110, 15), (192, 12), 18) + \
                bezier_curve((192, 12), (274, 15), (324, 55), (329, 120), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Victorian arched fringe
        d.arc([115, 84, 192, 132], start=180, end=360, fill=line_col, width=2)
        d.arc([192, 84, 269, 132], start=180, end=360, fill=line_col, width=2)
        d.polygon([(115, 86), (192, 86), (192, 125), (154, 130), (115, 122)], fill=h_base)
        d.polygon([(192, 86), (269, 86), (269, 122), (230, 130), (192, 125)], fill=h_base)
        d.line([(115, 122), (154, 130), (192, 125), (230, 130), (269, 122)], fill=line_col, width=2)
        # Spiral corkscrew ringlets in front
        l_drill = [(65, 120), (55, 170), (45, 220), (68, 255), (52, 290), (78, 310), (84, 250), (68, 205), (85, 145)]
        r_drill = [(319, 120), (329, 170), (339, 220), (316, 255), (332, 290), (306, 310), (300, 250), (316, 205), (299, 145)]
        draw_lock(d, l_drill, h_base, line_col, 2)
        draw_lock(d, r_drill, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(105, 50), (150, 38), (192, 36), (234, 38), (279, 50), (270, 60), (192, 46), (114, 60)], h_hi)

    # ---------------------------------------------------------
    # 24: Modern Pompadour Quiff (Caramel Maverick)
    # ---------------------------------------------------------
    elif style == "pompadour_quiff":
        # Temples faded
        d.polygon([(65, 100), (95, 105), (90, 155), (65, 145)], fill=h_dark)
        d.polygon([(319, 100), (289, 105), (294, 155), (319, 145)], fill=h_dark)
        # High lifted quiff crest rising high above forehead
        crown = bezier_curve((90, 105), (85, 35), (135, 6), (192, 6), 18) + \
                bezier_curve((192, 6), (249, 6), (299, 35), (294, 105), 18) + \
                bezier_curve((294, 105), (254, 78), (130, 78), (90, 105), 18)
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Sculpted roll lines
        for offset in [-40, -15, 15, 40]:
            cx = 192 + offset
            d.line([(cx, 78), (cx + int(offset * 0.15), 18)], fill=line_col, width=2)
        draw_forehead_shadow(im, [(110, 78), (192, 75), (274, 78), (265, 95), (192, 92), (119, 95)], skin_shadow)
        draw_anisotropic_sheen(front_im, [(120, 38), (160, 24), (192, 22), (224, 24), (264, 38), (255, 48), (192, 34), (129, 48)], h_hi)

    # ---------------------------------------------------------
    # 25: Twin Odango Buns (Crimson Lotus)
    # ---------------------------------------------------------
    elif style == "twin_buns":
        draw_forehead_shadow(im, [(125, 90), (192, 85), (259, 90), (250, 132), (192, 100), (134, 132)], skin_shadow)
        crown_l = bezier_curve((55, 115), (60, 60), (110, 22), (188, 20), 15) + [(192, 35)]
        crown_r = [(192, 35)] + bezier_curve((196, 20), (274, 22), (324, 60), (329, 115), 15)
        hairline = [(329, 115), (285, 90), (192, 84), (99, 90), (55, 115)]
        d.polygon(crown_l + crown_r + hairline, fill=h_base)
        d.line(crown_l + crown_r, fill=line_col, width=3)
        # Sidelocks
        l_lock = [(65, 115), (70, 175), (82, 240), (94, 250), (90, 195), (80, 130)]
        r_lock = [(319, 115), (314, 175), (302, 240), (290, 250), (294, 195), (304, 130)]
        draw_lock(d, l_lock, h_base, line_col, 2)
        draw_lock(d, r_lock, h_base, line_col, 2)
        # Delicate center-parted fringe
        b_l = make_lock((192, 36), (165, 65), (145, 98), (138, 136), (150, 108), (175, 75), (188, 42))
        b_r = make_lock((196, 42), (209, 75), (234, 108), (246, 136), (239, 98), (219, 65), (192, 36))
        draw_lock(d, b_l, h_base, line_col, 2)
        draw_lock(d, b_r, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(95, 52), (145, 38), (185, 36), (185, 46), (140, 48), (95, 62)], h_hi)
        draw_anisotropic_sheen(front_im, [(199, 36), (239, 38), (289, 52), (289, 62), (244, 48), (199, 46)], h_hi)

    # ---------------------------------------------------------
    # 26: Floating Astral Waves (Stellar Oracle)
    # ---------------------------------------------------------
    elif style == "astral_waves":
        draw_forehead_shadow(im, [(120, 88), (192, 85), (264, 88), (255, 130), (192, 134), (129, 130)], skin_shadow)
        crown = bezier_curve((45, 115), (50, 50), (105, 12), (192, 8), 18) + \
                bezier_curve((192, 8), (279, 12), (334, 50), (339, 115), 18) + \
                [(285, 88), (192, 82), (99, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Floating ethereal front locks curving outwards
        l_astral = bezier_curve((45, 115), (35, 175), (45, 255), (75, 315), 18) + \
                   bezier_curve((75, 315), (65, 245), (58, 175), (62, 125), 15)
        r_astral = bezier_curve((339, 115), (349, 175), (339, 255), (309, 315), 18) + \
                   bezier_curve((309, 315), (319, 245), (326, 175), (322, 125), 15)
        draw_lock(d, l_astral, h_base, line_col, 2)
        draw_lock(d, r_astral, h_base, line_col, 2)
        # Delicate astral fringe
        w1 = make_lock((135, 86), (145, 105), (152, 122), (155, 135), (160, 112), (156, 94), (150, 86))
        w2 = make_lock((233, 86), (239, 105), (232, 122), (229, 135), (241, 112), (239, 94), (247, 86))
        draw_lock(d, w1, h_base, line_col, 2)
        draw_lock(d, w2, h_base, line_col, 2)
        draw_anisotropic_sheen(front_im, [(95, 45), (145, 32), (192, 30), (239, 32), (289, 45), (280, 56), (192, 40), (104, 56)], h_hi)

    # ---------------------------------------------------------
    # 27: Caesar Crop Fade (Bronze Gladiator)
    # ---------------------------------------------------------
    elif style == "caesar_crop":
        # Sharp horizontal hairline, boxy fade
        crown = [(80, 110), (78, 65), (105, 38), (148, 26), (192, 24), (236, 26), (279, 38),
                 (306, 65), (304, 110), (280, 88), (192, 85), (104, 88)]
        d.polygon(crown, fill=h_base)
        d.line(crown + [crown[0]], fill=line_col, width=3)
        # Sharp fade sides
        d.polygon([(65, 110), (84, 110), (82, 155), (65, 150)], fill=h_dark)
        d.polygon([(319, 110), (300, 110), (302, 155), (319, 150)], fill=h_dark)
        # Crisp straight horizontal Caesar bangs
        draw_forehead_shadow(im, [(105, 88), (192, 85), (279, 88), (275, 108), (192, 105), (109, 108)], skin_shadow)
        c_bang = [(100, 86), (284, 86), (284, 106), (100, 106)]
        d.polygon(c_bang, fill=h_base)
        d.line([(100, 106), (284, 106)], fill=line_col, width=3)
        for i in range(8):
            bx = 115 + i * 20
            d.line([(bx, 88), (bx, 106)], fill=line_col, width=1)
        draw_anisotropic_sheen(front_im, [(115, 52), (155, 42), (192, 40), (229, 42), (269, 52), (260, 60), (192, 48), (124, 60)], h_hi)

    im.alpha_composite(front_im)

print("All 28 front hairstyle routines loaded successfully!")
