from PIL import Image, ImageDraw

# Create Eyes
eyes = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
d = ImageDraw.Draw(eyes)
# Left eye
d.polygon([(135, 185), (145, 172), (165, 172), (170, 185), (165, 205), (145, 205)], fill=(255, 255, 255, 255))
d.ellipse([145, 172, 165, 205], fill=(30, 100, 230, 255))
d.ellipse([150, 180, 160, 198], fill=(10, 20, 50, 255))
d.ellipse([147, 175, 153, 183], fill=(255, 255, 255, 255)) # highlight
d.line([(130, 180), (145, 168), (168, 168), (175, 178)], fill=(20, 20, 20, 255), width=7) # lash
d.line([(135, 155), (150, 150), (170, 155)], fill=(30, 30, 30, 255), width=5) # brow

# Right eye
d.polygon([(214, 185), (219, 172), (239, 172), (249, 185), (239, 205), (219, 205)], fill=(255, 255, 255, 255))
d.ellipse([219, 172, 239, 205], fill=(30, 100, 230, 255))
d.ellipse([224, 180, 234, 198], fill=(10, 20, 50, 255))
d.ellipse([221, 175, 227, 183], fill=(255, 255, 255, 255)) # highlight
d.line([(209, 178), (216, 168), (239, 168), (254, 180)], fill=(20, 20, 20, 255), width=7) # lash
d.line([(214, 155), (234, 150), (249, 155)], fill=(30, 30, 30, 255), width=5) # brow

eyes_small = eyes.resize((96, 96), Image.Resampling.LANCZOS)
eyes_small.save("/home/shaber/skribbl.io/scripts/test_eyes.png")

# Create Mouth
mouth = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
dm = ImageDraw.Draw(mouth)
# Smirk
dm.line([(180, 245), (192, 248), (208, 242)], fill=(30, 20, 20, 255), width=6)
dm.line([(208, 242), (212, 238)], fill=(30, 20, 20, 255), width=5)
mouth_small = mouth.resize((96, 96), Image.Resampling.LANCZOS)
mouth_small.save("/home/shaber/skribbl.io/scripts/test_mouth.png")

# Composite together
base = Image.open("/home/shaber/skribbl.io/scripts/test_sample.png")
base.paste(eyes_small, (0, 0), eyes_small)
base.paste(mouth_small, (0, 0), mouth_small)
base.save("/home/shaber/skribbl.io/scripts/test_composite.png")
print("Composite saved successfully!")
