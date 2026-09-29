from generate_all_28_anime_styles import ARCHETYPES

html_file = "/home/shaber/skribbl.io/test/anime_avatar_showcase.html"

cards_js = "[\n"
for i, a in enumerate(ARCHETYPES):
    name = a["name"]
    style_label = a["style"].replace("_", " ").title()
    clothing = a["clothing_type"].replace("_", " ").title()
    # assign sample accessories and eye styles for display
    tuple_str = f"[{i}, {i % 9}, {i % 10}, {(i * 3) % 20}]"
    cards_js += f'      {{ id: {i}, name: "{name}", tag: "{style_label}", cloth: "{clothing}", tuple: {tuple_str} }},\n'
cards_js += "    ];"

html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DrawRealm 28 Anime Character Roster Showcase</title>
  <link rel="stylesheet" href="../css/style.css">
  <style>
    body {{
      background: #0b1130 url(../img/drawrealm_fantasy_bg.webp) no-repeat center center fixed;
      background-size: cover;
      font-family: 'Nunito', sans-serif;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 20px;
      margin: 0;
      min-height: 100vh;
    }}
    h1 {{
      font-size: 28px;
      margin-bottom: 6px;
      text-shadow: 0 0 16px rgba(99, 102, 241, 0.6), 0 2px 4px rgba(0,0,0,0.8);
      letter-spacing: 0.5px;
    }}
    p.subtitle {{
      color: #cbd5e1;
      margin-bottom: 25px;
      font-size: 15px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.7);
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 16px;
      max-width: 1380px;
      width: 100%;
    }}
    @media (max-width: 1200px) {{
      .grid {{ grid-template-columns: repeat(4, 1fr); }}
    }}
    @media (max-width: 768px) {{
      .grid {{ grid-template-columns: repeat(2, 1fr); }}
    }}
    .card {{
      background: rgba(13, 20, 54, 0.88);
      border: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 10px;
      padding: 14px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      transition: transform 0.2s, border-color 0.2s;
    }}
    .card:hover {{
      transform: translateY(-4px);
      border-color: #38bdf8;
    }}
    .avatar-wrapper {{
      width: 96px;
      height: 96px;
      margin-bottom: 10px;
      position: relative;
    }}
    .name {{
      font-weight: 800;
      font-size: 14px;
      color: #f8fafc;
      margin-bottom: 4px;
      text-align: center;
      white-space: nowrap;
    }}
    .tag {{
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(99, 102, 241, 0.25);
      border: 1px solid rgba(139, 92, 246, 0.4);
      padding: 2px 6px;
      border-radius: 4px;
      color: #93c5fd;
      margin-bottom: 4px;
      text-align: center;
      white-space: nowrap;
    }}
    .tuple {{
      font-size: 11px;
      font-family: monospace;
      color: #94a3b8;
    }}
  </style>
</head>
<body>
  <h1>DRAWREALM ORIGINAL ANIME AVATAR ROSTER</h1>
  <p class="subtitle">28 Bespoke Character Hairstyles &bull; Natural Skull Volume &bull; 3-Tier Layered Shading &bull; 10-Column Atlas</p>

  <div class="grid" id="avatarGrid"></div>

  <script>
    const P = 28, Y = 57, z = 51;
    function renderAvatar(tuple) {{
      const col = tuple[0] % P;
      const eyes = tuple[1] % Y;
      const mouth = tuple[2] % z;
      const special = tuple[3];

      const wrap = document.createElement("div");
      wrap.className = "avatar";

      const c = document.createElement("div");
      c.className = "color";
      c.style.backgroundPosition = `${{-(col % 10) * 100}}% ${{ -Math.floor(col / 10) * 100}}%`;

      const e = document.createElement("div");
      e.className = "eyes";
      e.style.backgroundPosition = `${{-(eyes % 10) * 100}}% ${{ -Math.floor(eyes / 10) * 100}}%`;

      const m = document.createElement("div");
      m.className = "mouth";
      m.style.backgroundPosition = `${{-(mouth % 10) * 100}}% ${{ -Math.floor(mouth / 10) * 100}}%`;

      wrap.appendChild(c);
      wrap.appendChild(e);
      wrap.appendChild(m);

      if (special >= 0) {{
        const s = document.createElement("div");
        s.className = "special";
        s.style.backgroundPosition = `${{-(special % 10) * 100}}% ${{ -Math.floor(special / 10) * 100}}%`;
        wrap.appendChild(s);
      }}
      return wrap;
    }}

    const SHOWCASE = {cards_js}

    const container = document.getElementById("avatarGrid");
    SHOWCASE.forEach(item => {{
      const card = document.createElement("div");
      card.className = "card";

      const avWrap = document.createElement("div");
      avWrap.className = "avatar-wrapper";
      avWrap.appendChild(renderAvatar(item.tuple));

      const nameEl = document.createElement("div");
      nameEl.className = "name";
      nameEl.textContent = `#${{item.id}} ${{item.name}}`;

      const tagEl = document.createElement("div");
      tagEl.className = "tag";
      tagEl.textContent = item.tag;

      const tupleEl = document.createElement("div");
      tupleEl.className = "tuple";
      tupleEl.textContent = `[${{item.tuple.join(", ")}}]`;

      card.appendChild(avWrap);
      card.appendChild(nameEl);
      card.appendChild(tagEl);
      card.appendChild(tupleEl);

      container.appendChild(card);
    }});
  </script>
</body>
</html>
'''

with open(html_file, "w") as f:
    f.write(html_content)

print(f"Updated {html_file} with all 28 character showcase cards!")
