from PIL import Image, ImageDraw

# Create 160x160 special tile (rendered at 4x -> 640x640)
spec = Image.new("RGBA", (640, 640), (0, 0, 0, 0))
d = ImageDraw.Draw(spec)

# Scale: 160x160 -> 640x640. Head center is at (320, 320).
# Head X is (128..512), Head Y is (128..512).
# Let's draw modern Gaming Headset!
# Headband arch over top of head: from (220, 240) arching up to (320, 100) and down to (420, 240)
# Outer band
d.arc([190, 80, 450, 400], start=185, end=355, fill=(30, 40, 55, 255), width=24)
# Inner cyan glow strip
d.arc([200, 90, 440, 390], start=190, end=350, fill=(6, 182, 212, 255), width=8)

# Ear cups over ears: Left cup at (180..240, 230..330), Right cup at (400..460, 230..330)
d.rounded_rectangle([180, 230, 235, 330], radius=16, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=8)
d.rounded_rectangle([405, 230, 460, 330], radius=16, fill=(20, 25, 35, 255), outline=(6, 182, 212, 255), width=8)
# Cup cushion
d.rounded_rectangle([195, 245, 220, 315], radius=8, fill=(15, 23, 42, 255))
d.rounded_rectangle([420, 245, 445, 315], radius=8, fill=(15, 23, 42, 255))

# Mic boom on left cup
d.line([(205, 310), (220, 360), (280, 380)], fill=(30, 40, 55, 255), width=10)
d.ellipse([275, 372, 292, 388], fill=(6, 182, 212, 255))

spec_small = spec.resize((160, 160), Image.Resampling.LANCZOS)
spec_small.save("/home/shaber/skribbl.io/scripts/test_spec.png")

# Now composite as CSS does:
# .avatar container is 96x96
# .special is at left: -32, top: -32, size 160x160
full = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
base_comp = Image.open("/home/shaber/skribbl.io/scripts/test_aligned_comp.png")
# Paste base_comp at (32, 32)
full.paste(base_comp, (32, 32), base_comp)
# Paste spec on top
full.paste(spec_small, (0, 0), spec_small)
full.save("/home/shaber/skribbl.io/scripts/test_full_avatar.png")
print("Full avatar with accessory rendered successfully!")
