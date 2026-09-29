import os
import math
from PIL import Image, ImageDraw, ImageFilter
from generate_all_28_anime_styles import ARCHETYPES, render_back_hair, render_face_and_clothing
from anime_hairstyles import render_front_hair_for_archetype
from build_premium_semi_realistic_atlases import render_eyes_tile, render_mouth_tile

SCALE = 4
W_96 = 96 * SCALE    # 384
H_96 = 96 * SCALE    # 384

def render_full_character(idx):
    arch = ARCHETYPES[idx]
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))

    # 1. Back hair
    render_back_hair(im, arch)

    # 2. Face, neck & clothing
    render_face_and_clothing(im, arch)

    # 3. Eyes & Mouth
    eyes_img = render_eyes_tile(idx) # 96x96
    eyes_scaled = eyes_img.resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(eyes_scaled)

    mouth_img = render_mouth_tile(idx % 10) # 96x96
    mouth_scaled = mouth_img.resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(mouth_scaled)

    # 4. Front hair & bangs
    render_front_hair_for_archetype(im, arch)

    # Downsample to 96x96 using high-quality Lanczos filter
    return im.resize((96, 96), Image.Resampling.LANCZOS)

# Build 7 cols x 4 rows matrix (28 characters)
cols = 7
rows = 4
sheet = Image.new("RGBA", (cols * 128, rows * 148), (14, 20, 48, 255))
sd = ImageDraw.Draw(sheet)

for idx in range(28):
    c = idx % cols
    r = idx // cols
    x = c * 128 + 16
    y = r * 148 + 12

    # Tile background card
    sd.rounded_rectangle([x - 6, y - 6, x + 96 + 6, y + 96 + 32], radius=10, fill=(24, 32, 68, 255), outline=(99, 102, 241, 160), width=2)

    tile = render_full_character(idx)
    sheet.paste(tile, (x, y), tile)

    # Label
    name = ARCHETYPES[idx]["name"]
    sd.text((x + 48, y + 104), f"#{idx} {name}", fill=(240, 245, 255, 255), anchor="mt")

out_path = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/test_avatar_sheet_28.png"
sheet.save(out_path)
print(f"Generated test avatar sheet at {out_path} ({os.path.getsize(out_path)} bytes)")
