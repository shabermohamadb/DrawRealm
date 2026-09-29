from PIL import Image, ImageDraw

def render_archetype_and_face():
    # 384x384 canvas
    base = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    
    skin_base = (248, 224, 204, 255)
    skin_shadow = (226, 192, 170, 255)
    
    # 1. Neck
    d.polygon([(165, 230), (160, 320), (224, 320), (219, 230)], fill=skin_base)
    d.polygon([(165, 230), (162, 270), (192, 280), (222, 270), (219, 230)], fill=skin_shadow)
    
    # 2. Shoulders / Jacket (popped collar)
    jacket_pts = [(80, 384), (105, 305), (145, 290), (160, 260), (192, 295), (224, 260), (239, 290), (279, 305), (304, 384)]
    d.polygon(jacket_pts, fill=(24, 32, 48, 255))
    d.polygon([(160, 260), (175, 315), (192, 295)], fill=(220, 40, 60, 255))
    d.polygon([(224, 260), (209, 315), (192, 295)], fill=(220, 40, 60, 255))
    d.line(jacket_pts + [jacket_pts[0]], fill=(15, 18, 24, 255), width=6)
    
    # 3. Ears
    d.ellipse([102, 100, 126, 145], fill=skin_base, outline=(30, 25, 25, 255), width=4)
    d.ellipse([108, 110, 120, 135], fill=skin_shadow)
    d.ellipse([258, 100, 282, 145], fill=skin_base, outline=(30, 25, 25, 255), width=4)
    d.ellipse([264, 110, 276, 135], fill=skin_shadow)

    # 4. Face Contour (jawline & chin)
    face_pts = [
        (120, 70), (116, 110), (122, 160), (148, 220), (180, 255), (192, 260),
        (204, 255), (236, 220), (262, 160), (268, 110), (264, 70), (192, 50)
    ]
    d.polygon(face_pts, fill=skin_base)
    d.line(face_pts + [face_pts[0]], fill=(30, 25, 25, 255), width=5)
    
    # Soft blush
    d.ellipse([136, 155, 164, 175], fill=(245, 130, 130, 90))
    d.ellipse([220, 155, 248, 175], fill=(245, 130, 130, 90))
    # Nose dot
    d.ellipse([190, 160, 194, 165], fill=(210, 160, 140, 255))

    # 5. Hair (Spiky Shonen)
    hair_base = (220, 38, 38, 255) # Crimson
    hair_shadow = (153, 27, 27, 255)
    hair_hi = (248, 113, 113, 200)
    
    hair_pts = [
        (192, 20), (165, 45), (140, 28), (125, 65), (90, 60), (98, 105), (75, 115),
        (88, 165), (105, 185), (120, 145), (140, 125), (165, 135), (192, 115),
        (219, 135), (244, 125), (264, 145), (279, 185), (296, 165), (309, 115),
        (286, 105), (294, 60), (259, 65), (244, 28), (219, 45)
    ]
    d.polygon(hair_pts, fill=hair_base)
    d.polygon([(145, 65), (192, 55), (239, 65), (235, 78), (192, 68), (149, 78)], fill=hair_hi)
    d.line(hair_pts + [hair_pts[0]], fill=(25, 15, 15, 255), width=6)
    
    # 6. Eyes Layer
    eyes = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    de = ImageDraw.Draw(eyes)
    
    # Eyebrows
    de.line([(135, 105), (150, 100), (170, 105)], fill=(30, 20, 20, 255), width=5)
    de.line([(214, 105), (234, 100), (249, 105)], fill=(30, 20, 20, 255), width=5)

    # Left eye
    de.polygon([(138, 125), (148, 114), (166, 114), (172, 125), (166, 144), (148, 144)], fill=(255, 255, 255, 255))
    de.ellipse([146, 114, 166, 144], fill=(37, 99, 235, 255)) # Sapphire blue
    de.ellipse([150, 121, 162, 137], fill=(15, 23, 42, 255)) # pupil
    de.ellipse([148, 117, 154, 124], fill=(255, 255, 255, 255)) # catchlight
    de.line([(134, 122), (148, 111), (168, 111), (175, 120)], fill=(15, 15, 20, 255), width=7) # top lash
    de.line([(145, 144), (162, 144)], fill=(15, 15, 20, 255), width=4) # bottom lash
    
    # Right eye
    de.polygon([(212, 125), (218, 114), (236, 114), (246, 125), (236, 144), (218, 144)], fill=(255, 255, 255, 255))
    de.ellipse([218, 114, 238, 144], fill=(37, 99, 235, 255))
    de.ellipse([222, 121, 234, 137], fill=(15, 23, 42, 255))
    de.ellipse([220, 117, 226, 124], fill=(255, 255, 255, 255))
    de.line([(209, 120), (216, 111), (236, 111), (250, 122)], fill=(15, 15, 20, 255), width=7)
    de.line([(222, 144), (239, 144)], fill=(15, 15, 20, 255), width=4)
    
    # 7. Mouth Layer
    mouth = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    dm = ImageDraw.Draw(mouth)
    # Confident open anime smile
    dm.polygon([(178, 195), (206, 195), (192, 218)], fill=(159, 18, 57, 255)) # mouth interior
    dm.polygon([(182, 205), (202, 205), (192, 218)], fill=(244, 63, 94, 255)) # tongue
    dm.line([(175, 195), (209, 195)], fill=(25, 20, 20, 255), width=5) # top lip
    dm.line([(175, 195), (192, 218), (209, 195)], fill=(25, 20, 20, 255), width=5) # bottom outline
    
    # Downsample all
    b_small = base.resize((96, 96), Image.Resampling.LANCZOS)
    e_small = eyes.resize((96, 96), Image.Resampling.LANCZOS)
    m_small = mouth.resize((96, 96), Image.Resampling.LANCZOS)
    
    comp = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    comp.paste(b_small, (0, 0), b_small)
    comp.paste(e_small, (0, 0), e_small)
    comp.paste(m_small, (0, 0), m_small)
    
    comp.save("/home/shaber/skribbl.io/scripts/test_aligned_comp.png")
    print("Aligned composition saved!")

render_archetype_and_face()
