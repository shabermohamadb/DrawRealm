import sys
from PIL import Image, ImageDraw

def create_base(idx, name, skin_base, skin_shadow, hair_base, hair_shadow, hair_hi, style, collar_color, collar_accent):
    # 4x resolution: 384x384 -> 96x96
    im = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    
    # 1. Neck
    neck_pts = [(166, 235), (164, 335), (220, 335), (218, 235)]
    d.polygon(neck_pts, fill=skin_base)
    # Neck shadow under chin
    d.polygon([(166, 235), (164, 275), (192, 285), (218, 275), (218, 235)], fill=skin_shadow)
    d.line([(166, 235), (164, 335)], fill=(30, 25, 25, 200), width=4)
    d.line([(218, 235), (220, 335)], fill=(30, 25, 25, 200), width=4)
    
    # 2. Shoulders / Clothing
    if style in ["hoodie", "jersey", "casual"]:
        shirt_pts = [(80, 384), (110, 315), (160, 315), (192, 335), (224, 315), (274, 315), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        d.polygon([(160, 315), (192, 335), (224, 315)], fill=collar_accent)
        d.line(shirt_pts + [shirt_pts[0]], fill=(25, 25, 30, 255), width=6)
    elif style in ["high_collar", "jacket", "coat"]:
        shirt_pts = [(80, 384), (105, 305), (145, 290), (160, 270), (192, 295), (224, 270), (239, 290), (279, 305), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        # Lapel accents
        d.polygon([(160, 270), (175, 320), (192, 295)], fill=collar_accent)
        d.polygon([(224, 270), (209, 320), (192, 295)], fill=collar_accent)
        d.line(shirt_pts + [shirt_pts[0]], fill=(25, 25, 30, 255), width=6)
    elif style in ["turtleneck", "ninja", "scarf"]:
        shirt_pts = [(80, 384), (110, 315), (150, 300), (150, 255), (192, 260), (234, 255), (234, 300), (274, 315), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        # Scarf folds / collar ribbing
        for y_rib in [270, 285, 300]:
            d.line([(152, y_rib), (232, y_rib)], fill=collar_accent, width=4)
        d.line(shirt_pts + [shirt_pts[0]], fill=(25, 25, 30, 255), width=6)
    else: # uniform / blazer
        shirt_pts = [(80, 384), (110, 315), (155, 305), (192, 345), (229, 305), (274, 315), (304, 384)]
        d.polygon(shirt_pts, fill=collar_color)
        d.polygon([(170, 305), (192, 345), (214, 305)], fill=(250, 250, 252, 255)) # shirt V
        d.polygon([(188, 315), (196, 315), (194, 345), (190, 345)], fill=collar_accent) # tie
        d.line(shirt_pts + [shirt_pts[0]], fill=(25, 25, 30, 255), width=6)
        
    # 3. Ears
    d.ellipse([100, 168, 126, 218], fill=skin_base, outline=(35, 25, 25, 255), width=4)
    d.ellipse([106, 178, 120, 206], fill=skin_shadow)
    d.ellipse([258, 168, 284, 218], fill=skin_base, outline=(35, 25, 25, 255), width=4)
    d.ellipse([264, 178, 278, 206], fill=skin_shadow)

    # 4. Face (clean anime contour)
    face_pts = [
        (120, 130), (116, 170), (122, 212), (148, 250), (180, 272), (192, 276),
        (204, 272), (236, 250), (262, 212), (268, 170), (264, 130), (192, 100)
    ]
    d.polygon(face_pts, fill=skin_base)
    d.line(face_pts + [face_pts[0]], fill=(35, 25, 25, 255), width=5)
    
    # Soft blush
    d.ellipse([136, 215, 162, 230], fill=(245, 140, 140, 90))
    d.ellipse([222, 215, 248, 230], fill=(245, 140, 140, 90))

    # 5. Hair Back / Volume (for longer styles)
    if style in ["twin_tails", "drill_curls", "long_flow"]:
        # Twin tail clumps
        left_tail = [(110, 140), (70, 180), (60, 260), (80, 290), (95, 230), (115, 180)]
        right_tail = [(274, 140), (314, 180), (324, 260), (304, 290), (289, 230), (269, 180)]
        d.polygon(left_tail, fill=hair_shadow)
        d.line(left_tail + [left_tail[0]], fill=(25, 20, 25, 255), width=5)
        d.polygon(right_tail, fill=hair_shadow)
        d.line(right_tail + [right_tail[0]], fill=(25, 20, 25, 255), width=5)

    # 6. Hair Front & Bangs (varies by archetype)
    if "spiky" in style or style in ["shonen", "fighter", "brawler"]:
        hair_pts = [
            (192, 35), (160, 65), (135, 45), (120, 90), (80, 85), (92, 135), (65, 145),
            (85, 195), (105, 225), (122, 175), (142, 162), (168, 178), (192, 155),
            (216, 178), (242, 162), (262, 175), (279, 225), (299, 195), (319, 145),
            (292, 135), (304, 85), (264, 90), (249, 45), (224, 65)
        ]
    elif style in ["side_swept", "strategist", "serious"]:
        hair_pts = [
            (192, 45), (150, 55), (115, 75), (90, 115), (75, 160), (85, 215), (105, 235),
            (118, 185), (135, 172), (155, 185), (175, 150), (192, 162), (220, 145),
            (250, 165), (275, 210), (295, 175), (305, 130), (290, 85), (250, 55), (220, 48)
        ]
    elif style in ["bob", "hacker", "friendly"]:
        hair_pts = [
            (192, 48), (145, 52), (110, 75), (85, 115), (75, 170), (80, 230), (102, 245),
            (115, 195), (130, 165), (155, 172), (180, 162), (192, 168), (210, 162),
            (235, 172), (255, 165), (270, 195), (282, 245), (304, 230), (309, 170),
            (299, 115), (274, 75), (239, 52)
        ]
    elif style in ["wolf_cut", "chaotic"]:
        hair_pts = [
            (192, 38), (158, 55), (135, 38), (115, 82), (75, 95), (85, 145), (60, 160),
            (78, 205), (100, 238), (118, 185), (140, 172), (165, 188), (192, 158),
            (218, 188), (245, 172), (268, 185), (284, 238), (306, 205), (324, 160),
            (299, 145), (309, 95), (269, 82), (249, 38), (226, 55)
        ]
    else: # curtain_bangs / quiet
        hair_pts = [
            (192, 45), (150, 55), (115, 78), (92, 120), (80, 170), (90, 225), (108, 240),
            (122, 190), (145, 165), (170, 158), (188, 178), (196, 178), (214, 158),
            (239, 165), (262, 190), (276, 240), (294, 225), (304, 170), (292, 120),
            (269, 78), (234, 55)
        ]

    # Draw hair body
    d.polygon(hair_pts, fill=hair_base)
    # Hair highlight shine band
    hi_pts = [(140, 95), (192, 85), (244, 95), (240, 110), (192, 100), (144, 110)]
    d.polygon(hi_pts, fill=hair_hi)
    # Hair outline
    d.line(hair_pts + [hair_pts[0]], fill=(25, 20, 25, 255), width=6)
    
    # Downsample
    small = im.resize((96, 96), Image.Resampling.LANCZOS)
    return small

test1 = create_base(
    0, "Calm Strategist",
    (245, 220, 200, 255), (220, 185, 165, 255),
    (40, 55, 80, 255), (25, 35, 55, 255), (80, 110, 150, 200),
    "side_swept", (30, 40, 60, 255), (210, 170, 60, 255)
)
test1.save("/home/shaber/skribbl.io/scripts/sample_archetype_0.png")
print("Sample archetype 0 generated!")
