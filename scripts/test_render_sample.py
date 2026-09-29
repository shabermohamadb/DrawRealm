import os
from PIL import Image, ImageDraw

# Create 384x384 (4x of 96x96)
img = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Proportions at 4x (96x96 -> 384x384):
# Center X = 192, Center Y = 192
# Head center: (192, 192)

# Neck & Collar
neck_pts = [(160, 250), (160, 340), (224, 340), (224, 250)]
d.polygon(neck_pts, fill=(230, 195, 175, 255))
d.polygon([(160, 250), (160, 280), (224, 280), (224, 250)], fill=(210, 170, 150, 255)) # neck shadow

# Shoulders / Clothes
shirt_pts = [(100, 384), (130, 310), (160, 310), (192, 340), (224, 310), (254, 310), (284, 384)]
d.polygon(shirt_pts, fill=(35, 45, 65, 255))
d.line(shirt_pts + [shirt_pts[0]], fill=(20, 25, 35, 255), width=6)

# Ears
d.ellipse([100, 180, 130, 230], fill=(245, 215, 195, 255), outline=(30, 30, 30, 255), width=4)
d.ellipse([254, 180, 284, 230], fill=(245, 215, 195, 255), outline=(30, 30, 30, 255), width=4)

# Face shape (anime tapered chin)
face_pts = [
    (118, 140), (114, 180), (120, 220), (150, 260), (180, 280), (192, 284), (204, 280), (234, 260), (264, 220), (270, 180), (266, 140), (192, 110)
]
d.polygon(face_pts, fill=(245, 215, 195, 255))
d.line(face_pts + [face_pts[0]], fill=(35, 25, 25, 255), width=5)

# Blush
d.ellipse([135, 225, 160, 240], fill=(240, 150, 150, 80))
d.ellipse([224, 225, 249, 240], fill=(240, 150, 150, 80))

# Spiky Anime Hair
hair_color = (40, 150, 220, 255)
hair_shadow = (25, 110, 175, 255)
hair_pts = [
    (192, 40), (160, 70), (130, 50), (120, 95), (85, 90), (95, 140), (70, 150), (90, 200), (110, 230),
    (125, 180), (145, 170), (170, 185), (192, 160), (214, 185), (239, 170), (259, 180), (274, 230),
    (294, 200), (314, 150), (289, 140), (299, 90), (264, 95), (254, 50), (224, 70)
]
d.polygon(hair_pts, fill=hair_color)
d.line(hair_pts + [hair_pts[0]], fill=(15, 20, 30, 255), width=6)

# Resize to 96x96
final = img.resize((96, 96), Image.Resampling.LANCZOS)
final.save("/home/shaber/skribbl.io/scripts/test_sample.png")
print("Rendered test sample:", final.size)
