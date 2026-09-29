import os
import math
from PIL import Image, ImageDraw, ImageFilter
from generate_all_28_anime_styles import ARCHETYPES, render_back_hair, render_face_and_clothing
from anime_hair_engine import render_seamless_front_hair
from build_premium_semi_realistic_atlases import render_eyes_tile, render_mouth_tile

SCALE = 4
W_96 = 96 * SCALE    # 384
H_96 = 96 * SCALE    # 384

def render_archetype_character(idx):
    arch = ARCHETYPES[idx]
    im = Image.new("RGBA", (W_96, H_96), (0, 0, 0, 0))

    # 1. Back hair
    render_back_hair(im, arch)

    # 2. Face, neck & clothing
    render_face_and_clothing(im, arch)

    # 3. Eyes & Mouth
    eyes = render_eyes_tile(idx).resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(eyes)

    mouth = render_mouth_tile(idx % 10).resize((W_96, H_96), Image.Resampling.NEAREST)
    im.alpha_composite(mouth)

    # 4. Seamless front hair
    render_seamless_front_hair(im, arch)

    return im.resize((96, 96), Image.Resampling.LANCZOS)

# 7 cols x 4 rows matrix
cols = 7
rows = 4
sheet = Image.new("RGBA", (cols * 128, rows * 148), (14, 20, 48, 255))
sd = ImageDraw.Draw(sheet)

for idx in range(28):
    c = idx % cols
    r = idx // cols
    x = c * 128 + 16
    y = r * 148 + 12

    sd.rounded_rectangle([x - 6, y - 6, x + 96 + 6, y + 96 + 32], radius=10, fill=(24, 32, 68, 255), outline=(99, 102, 241, 160), width=2)
    tile = render_archetype_character(idx)
    sheet.paste(tile, (x, y), tile)

    name = ARCHETYPES[idx]["name"]
    sd.text((x + 48, y + 104), f"#{idx} {name}", fill=(240, 245, 255, 255), anchor="mt")

out_path = "/home/shaber/.gemini/antigravity/brain/b014560c-ddf5-44ac-a525-5d2533dae9fa/avatar_sheet_all_28_seamless.png"
sheet.save(out_path)
print(f"Generated complete 28-character showcase at {out_path} ({os.path.getsize(out_path)} bytes)")
