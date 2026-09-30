/**
 * Script to generate all 31 high-resolution anime vector SVG accessories
 * Designed for DrawRealm's 160x160 accessory tile coordinate system.
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "../img/accessories");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const SVGS = {
  // 1. Gaming Headset
  "headphones_gaming.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <linearGradient id="hg_band" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="hg_glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <filter id="hg_neon" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Headband Arch -->
  <path d="M 52 75 C 50 42 60 25 80 25 C 100 25 110 42 108 75" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
  <path d="M 52 75 C 50 42 60 25 80 25 C 100 25 110 42 108 75" fill="none" stroke="url(#hg_band)" stroke-width="5" stroke-linecap="round"/>
  <path d="M 58 60 C 60 32 68 28 80 28 C 92 28 100 32 102 60" fill="none" stroke="url(#hg_glow)" stroke-width="1.8" filter="url(#hg_neon)"/>
  <!-- Left Earcup -->
  <g transform="translate(43, 62)">
    <rect x="0" y="0" width="16" height="26" rx="8" fill="#0f172a"/>
    <rect x="2" y="2" width="12" height="22" rx="6" fill="#1e293b"/>
    <rect x="4" y="4" width="8" height="18" rx="4" fill="#0f172a"/>
    <rect x="5" y="6" width="6" height="14" rx="3" fill="none" stroke="#06b6d4" stroke-width="1.5" filter="url(#hg_neon)"/>
    <circle cx="8" cy="13" r="2" fill="#38bdf8"/>
  </g>
  <!-- Right Earcup -->
  <g transform="translate(101, 62)">
    <rect x="0" y="0" width="16" height="26" rx="8" fill="#0f172a"/>
    <rect x="2" y="2" width="12" height="22" rx="6" fill="#1e293b"/>
    <rect x="4" y="4" width="8" height="18" rx="4" fill="#0f172a"/>
    <rect x="5" y="6" width="6" height="14" rx="3" fill="none" stroke="#06b6d4" stroke-width="1.5" filter="url(#hg_neon)"/>
    <circle cx="8" cy="13" r="2" fill="#38bdf8"/>
  </g>
  <!-- Mic Boom -->
  <path d="M 48 82 Q 52 94 68 95" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
  <path d="M 48 82 Q 52 94 68 95" fill="none" stroke="#475569" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="67" y="93" width="7" height="4" rx="2" fill="#0f172a"/>
  <circle cx="73" cy="95" r="1.5" fill="#06b6d4" filter="url(#hg_neon)"/>
</svg>`,

  // 2. Wireless Headphones
  "headphones_wireless.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <linearGradient id="hw_white" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
  </defs>
  <!-- Clean White Headband -->
  <path d="M 53 74 C 50 40 62 26 80 26 C 98 26 110 40 107 74" fill="none" stroke="#64748b" stroke-width="6" stroke-linecap="round"/>
  <path d="M 53 74 C 50 40 62 26 80 26 C 98 26 110 40 107 74" fill="none" stroke="url(#hw_white)" stroke-width="4.5" stroke-linecap="round"/>
  <!-- Left Cup -->
  <g transform="translate(44, 63)">
    <rect x="0" y="0" width="15" height="24" rx="7.5" fill="#475569"/>
    <rect x="1.5" y="1.5" width="12" height="21" rx="6" fill="url(#hw_white)"/>
    <ellipse cx="7.5" cy="12" rx="4" ry="7" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
  </g>
  <!-- Right Cup -->
  <g transform="translate(101, 63)">
    <rect x="0" y="0" width="15" height="24" rx="7.5" fill="#475569"/>
    <rect x="1.5" y="1.5" width="12" height="21" rx="6" fill="url(#hw_white)"/>
    <ellipse cx="7.5" cy="12" rx="4" ry="7" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
  </g>
</svg>`,

  // 3. Studio Monitor Headphones
  "headphones_studio.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Chunky Leather Headband with double rail -->
  <path d="M 51 74 C 48 38 60 23 80 23 C 100 23 112 38 109 74" fill="none" stroke="#18181b" stroke-width="8" stroke-linecap="round"/>
  <path d="M 51 74 C 48 38 60 23 80 23 C 100 23 112 38 109 74" fill="none" stroke="#3f3f46" stroke-width="5.5" stroke-linecap="round"/>
  <!-- Stitching dots -->
  <path d="M 58 50 C 62 33 70 27 80 27 C 90 27 98 33 102 50" fill="none" stroke="#71717a" stroke-width="1" stroke-dasharray="2 3"/>
  <!-- Left Heavy Cup -->
  <g transform="translate(42, 60)">
    <rect x="0" y="0" width="17" height="28" rx="8.5" fill="#18181b"/>
    <rect x="2" y="2" width="13" height="24" rx="6.5" fill="#27272a"/>
    <circle cx="8.5" cy="14" r="5" fill="#09090b" stroke="#a1a1aa" stroke-width="1.5"/>
    <rect x="1" y="9" width="3" height="10" rx="1" fill="#a1a1aa"/>
  </g>
  <!-- Right Heavy Cup -->
  <g transform="translate(101, 60)">
    <rect x="0" y="0" width="17" height="28" rx="8.5" fill="#18181b"/>
    <rect x="2" y="2" width="13" height="24" rx="6.5" fill="#27272a"/>
    <circle cx="8.5" cy="14" r="5" fill="#09090b" stroke="#a1a1aa" stroke-width="1.5"/>
    <rect x="13" y="9" width="3" height="10" rx="1" fill="#a1a1aa"/>
  </g>
  <!-- Coiled Wire -->
  <path d="M 46 88 Q 43 96 46 102 Q 49 108 47 114" fill="none" stroke="#27272a" stroke-width="2"/>
</svg>`,

  // 4. Simple Retro Headphones
  "headphones_simple.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Thin Steel Band -->
  <path d="M 53 74 C 51 44 62 29 80 29 C 98 29 109 44 107 74" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round"/>
  <path d="M 53 74 C 51 44 62 29 80 29 C 98 29 109 44 107 74" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
  <!-- Left Orange Foam -->
  <ellipse cx="50" cy="74" rx="7.5" ry="11" fill="#ea580c" stroke="#9a3412" stroke-width="2"/>
  <ellipse cx="50" cy="74" rx="5" ry="8" fill="#f97316"/>
  <!-- Right Orange Foam -->
  <ellipse cx="110" cy="74" rx="7.5" ry="11" fill="#ea580c" stroke="#9a3412" stroke-width="2"/>
  <ellipse cx="110" cy="74" rx="5" ry="8" fill="#f97316"/>
</svg>`,

  // 5. Snapback Cap
  "cap.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Dome Crown -->
  <path d="M 52 50 C 50 30 62 21 80 21 C 98 21 110 30 108 50 Z" fill="#1e1b4b" stroke="#0f172a" stroke-width="2.5"/>
  <path d="M 55 48 C 54 32 64 24 80 24 C 96 24 106 32 105 48 Z" fill="#312e81"/>
  <!-- Crown Seams -->
  <path d="M 80 21 L 80 50" stroke="#1e1b4b" stroke-width="1.5"/>
  <path d="M 80 21 Q 65 32 58 50" stroke="#1e1b4b" stroke-width="1.2"/>
  <path d="M 80 21 Q 95 32 102 50" stroke="#1e1b4b" stroke-width="1.2"/>
  <!-- Top Button -->
  <circle cx="80" cy="21" r="3" fill="#f43f5e" stroke="#0f172a" stroke-width="1"/>
  <!-- Visor Brim -->
  <path d="M 45 49 C 48 45 70 43 80 43 C 90 43 112 45 115 49 L 118 56 C 104 59 80 60 42 56 Z" fill="#0f172a"/>
  <path d="M 47 50 C 55 47 72 45 80 45 C 88 45 105 47 113 50 L 115 54 C 102 57 80 58 45 54 Z" fill="#4338ca"/>
  <!-- Front Logo Patch -->
  <polygon points="76,34 84,34 82,42 78,42" fill="#f43f5e"/>
  <circle cx="80" cy="38" r="1.5" fill="#ffffff"/>
</svg>`,

  // 6. Ribbed Beanie
  "beanie.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Slouchy Dome -->
  <path d="M 53 48 C 50 25 60 16 80 16 C 100 16 110 25 107 48 Z" fill="#0f766e" stroke="#134e4a" stroke-width="2.5"/>
  <path d="M 56 46 C 54 28 63 20 80 20 C 97 20 106 28 104 46 Z" fill="#14b8a6"/>
  <!-- Slouch folds -->
  <path d="M 68 28 Q 80 32 92 28" fill="none" stroke="#0f766e" stroke-width="2"/>
  <!-- Thick Folded Cuff Rib -->
  <rect x="50" y="44" width="60" height="13" rx="4" fill="#0f766e" stroke="#134e4a" stroke-width="2"/>
  <!-- Rib Lines -->
  <line x1="56" y1="46" x2="56" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="62" y1="46" x2="62" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="68" y1="46" x2="68" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="74" y1="46" x2="74" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="80" y1="46" x2="80" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="86" y1="46" x2="86" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="92" y1="46" x2="92" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="98" y1="46" x2="98" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <line x1="104" y1="46" x2="104" y2="55" stroke="#14b8a6" stroke-width="1.5"/>
  <!-- Small Fabric Badge -->
  <rect x="94" y="47" width="6" height="7" rx="1" fill="#f59e0b"/>
</svg>`,

  // 7. Royal Crown
  "crown.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <linearGradient id="cr_gold" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#a16207"/>
    </linearGradient>
  </defs>
  <!-- Crown Base & Peaks -->
  <polygon points="58,49 54,34 66,41 80,24 94,41 106,34 102,49" fill="url(#cr_gold)" stroke="#713f12" stroke-width="2.2" stroke-linejoin="round"/>
  <!-- Peak Orbs -->
  <circle cx="54" cy="33" r="2.5" fill="#fef08a" stroke="#713f12" stroke-width="1"/>
  <circle cx="80" cy="23" r="3.2" fill="#fef08a" stroke="#713f12" stroke-width="1.2"/>
  <circle cx="106" cy="33" r="2.5" fill="#fef08a" stroke="#713f12" stroke-width="1"/>
  <!-- Circlet Band -->
  <path d="M 58 46 Q 80 50 102 46 L 101 51 Q 80 55 59 51 Z" fill="#ca8a04" stroke="#713f12" stroke-width="1.5"/>
  <!-- Center Jewel -->
  <polygon points="80,38 83,43 80,48 77,43" fill="#dc2626" stroke="#991b1b" stroke-width="1"/>
  <circle cx="79" cy="41" r="1" fill="#ffffff"/>
  <!-- Side Emeralds -->
  <circle cx="68" cy="46" r="1.5" fill="#16a34a"/>
  <circle cx="92" cy="46" r="1.5" fill="#16a34a"/>
</svg>`,

  // 8. Ninja Headband
  "headband.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Cloth Band Across Forehead -->
  <path d="M 52 53 Q 80 50 108 53 L 108 61 Q 80 58 52 61 Z" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
  <!-- Metal Forehead Plate -->
  <rect x="67" y="50" width="26" height="11" rx="2" fill="#cbd5e1" stroke="#334155" stroke-width="1.8"/>
  <rect x="69" y="52" width="22" height="7" rx="1" fill="#f8fafc"/>
  <!-- Rivets -->
  <circle cx="69.5" cy="52.5" r="0.8" fill="#475569"/>
  <circle cx="90.5" cy="52.5" r="0.8" fill="#475569"/>
  <circle cx="69.5" cy="58.5" r="0.8" fill="#475569"/>
  <circle cx="90.5" cy="58.5" r="0.8" fill="#475569"/>
  <!-- Plate Inscribed Crest -->
  <path d="M 77 56 Q 80 53 83 56 Q 80 59 77 56" fill="none" stroke="#475569" stroke-width="1.2"/>
  <!-- Trailing Ribbon Tails (Side Knot on Right) -->
  <circle cx="109" cy="57" r="3" fill="#0f172a"/>
  <path d="M 109 57 C 118 64 125 76 122 88 C 120 84 116 75 110 68 Z" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
  <path d="M 108 59 C 114 70 120 85 116 95 C 113 90 110 80 107 68 Z" fill="#334155" stroke="#0f172a" stroke-width="1.5"/>
</svg>`,

  // 9. Star Hair Clips
  "hair_clip.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Left Side Star Pin -->
  <g transform="translate(58, 54)">
    <!-- Bobby Pin Base -->
    <line x1="-6" y1="4" x2="6" y2="-4" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>
    <polygon points="0,-8 2,-2 8,0 2,2 0,8 -2,2 -8,0 -2,-2" fill="#fbbf24" stroke="#b45309" stroke-width="1.2"/>
    <polygon points="0,-4 1,-1 4,0 1,1 0,4 -1,1 -4,0 -1,-1" fill="#fef08a"/>
    <circle cx="0" cy="0" r="1" fill="#ffffff"/>
  </g>
  <!-- Right Side Crossed Bobby Pins -->
  <g transform="translate(98, 52)">
    <line x1="-8" y1="-5" x2="8" y2="5" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="-8" y1="5" x2="8" y2="-5" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="1.5" fill="#ffffff"/>
  </g>
</svg>`,

  // 10. Bow Headband
  "hair_band.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Velvet Alice Band -->
  <path d="M 54 68 C 52 42 62 28 80 28 C 98 28 108 42 106 68" fill="none" stroke="#831843" stroke-width="5" stroke-linecap="round"/>
  <path d="M 54 68 C 52 42 62 28 80 28 C 98 28 108 42 106 68" fill="none" stroke="#be185d" stroke-width="3" stroke-linecap="round"/>
  <!-- Perky Side Bow on Right -->
  <g transform="translate(98, 36) rotate(15)">
    <!-- Left Loop -->
    <path d="M 0 0 C -10 -8 -12 8 0 2 Z" fill="#db2777" stroke="#831843" stroke-width="1.8"/>
    <!-- Right Loop -->
    <path d="M 0 0 C 10 -8 12 8 0 2 Z" fill="#db2777" stroke="#831843" stroke-width="1.8"/>
    <!-- Knot Center -->
    <circle cx="0" cy="1" r="3.2" fill="#9d174d" stroke="#831843" stroke-width="1.2"/>
    <!-- Ribbon Tails -->
    <path d="M -1 3 L -5 14 L 0 11 L 3 13 L 1 3" fill="#be185d" stroke="#831843" stroke-width="1.2"/>
  </g>
</svg>`,

  // 11. Classic Fedora
  "hat.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Crown with Indentation -->
  <path d="M 58 46 C 56 30 65 24 74 27 C 80 29 86 29 92 27 C 101 24 104 30 102 46 Z" fill="#27272a" stroke="#09090b" stroke-width="2.5"/>
  <path d="M 61 44 C 59 32 66 27 74 30 C 80 32 86 32 92 30 C 99 27 101 32 99 44 Z" fill="#3f3f46"/>
  <!-- Silk Ribbon Band -->
  <path d="M 58 43 Q 80 47 102 43 L 102 48 Q 80 52 58 48 Z" fill="#dc2626" stroke="#991b1b" stroke-width="1"/>
  <!-- Curved Brim -->
  <path d="M 42 47 C 44 42 70 41 80 41 C 90 41 116 42 118 47 C 120 53 105 57 80 57 C 55 57 40 53 42 47 Z" fill="#18181b" stroke="#09090b" stroke-width="2"/>
  <path d="M 45 47 C 55 44 72 43 80 43 C 88 43 105 44 115 47 C 114 51 98 54 80 54 C 62 54 46 51 45 47 Z" fill="#27272a"/>
</svg>`,

  // 12. Cowboy Hat
  "cowboy_hat.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Creased Cattleman Crown -->
  <path d="M 58 42 C 55 24 64 16 73 20 C 80 23 87 23 94 20 C 103 16 105 24 102 42 Z" fill="#78350f" stroke="#451a03" stroke-width="2.5"/>
  <path d="M 61 40 C 59 26 66 19 74 22 C 80 25 86 25 92 22 C 99 19 101 26 99 40 Z" fill="#92400e"/>
  <!-- Leather Band with Star -->
  <path d="M 58 39 Q 80 44 102 39 L 102 43 Q 80 48 58 43 Z" fill="#451a03"/>
  <polygon points="80,41 81.5,43.5 84,43.5 82,45 83,47.5 80,46 77,47.5 78,45 76,43.5 78.5,43.5" fill="#fef08a"/>
  <!-- Sweeping Upturned Brim -->
  <path d="M 32 38 C 30 46 45 50 80 50 C 115 50 130 46 128 38 C 132 46 115 56 80 56 C 45 56 28 46 32 38 Z" fill="#451a03"/>
  <path d="M 34 39 C 33 44 48 48 80 48 C 112 48 127 44 126 39 C 124 45 110 53 80 53 C 50 53 36 45 34 39 Z" fill="#b45309"/>
</svg>`,

  // 13. Wizard Hat
  "wizard_hat.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Pointed Cone Bending Back -->
  <path d="M 54 44 C 58 30 75 18 88 14 C 98 11 106 8 110 12 C 112 15 108 19 100 22 C 92 25 98 35 104 44 Z" fill="#312e81" stroke="#1e1b4b" stroke-width="2.5"/>
  <path d="M 58 42 C 62 30 76 21 88 17 C 96 14 103 12 106 14 C 104 17 98 20 94 24 C 88 28 94 36 100 42 Z" fill="#4338ca"/>
  <!-- Arcane Stars on Hat -->
  <polygon points="84,24 85,26 88,26 86,28 87,30 84,29 82,30 83,28 81,26 83,26" fill="#fde047"/>
  <polygon points="72,32 73,33.5 75,33.5 73.5,35 74,36.5 72,35.5 70.5,36.5 71,35 69.5,33.5 71,33.5" fill="#fde047"/>
  <!-- Gold Buckle Hatband -->
  <path d="M 53 42 Q 79 48 105 42 L 105 47 Q 79 53 53 47 Z" fill="#f59e0b" stroke="#78350f" stroke-width="1.5"/>
  <rect x="74" y="42" width="10" height="7" rx="1.5" fill="none" stroke="#fef08a" stroke-width="2"/>
  <!-- Wide Curved Brim -->
  <path d="M 38 46 C 42 41 70 41 80 41 C 90 41 118 41 122 46 C 124 53 106 58 80 58 C 54 58 36 53 38 46 Z" fill="#1e1b4b" stroke="#0f172a" stroke-width="2"/>
  <path d="M 42 46 C 50 43 72 43 80 43 C 88 43 110 43 118 46 C 115 51 98 55 80 55 C 62 55 45 51 42 46 Z" fill="#3730a3"/>
</svg>`,

  // 14. Cyber Helmet
  "helmet.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Top Angular Armor Plate -->
  <polygon points="56,48 52,32 68,18 92,18 108,32 104,48 80,44" fill="#0f172a" stroke="#0284c7" stroke-width="2.5"/>
  <polygon points="58,45 55,33 69,21 91,21 105,33 102,45 80,42" fill="#1e293b"/>
  <!-- Center Crest Ridge -->
  <polygon points="76,17 84,17 82,38 78,38" fill="#0284c7"/>
  <line x1="80" y1="18" x2="80" y2="36" stroke="#38bdf8" stroke-width="1.5"/>
  <!-- Left Ear Node -->
  <rect x="46" y="44" width="10" height="18" rx="3" fill="#0f172a" stroke="#0284c7" stroke-width="1.8"/>
  <circle cx="51" cy="53" r="2.5" fill="#38bdf8"/>
  <!-- Right Ear Node -->
  <rect x="104" y="44" width="10" height="18" rx="3" fill="#0f172a" stroke="#0284c7" stroke-width="1.8"/>
  <circle cx="109" cy="53" r="2.5" fill="#38bdf8"/>
  <!-- Brow Visor Segment -->
  <polygon points="54,48 106,48 102,56 80,59 58,56" fill="#0369a1" stroke="#0284c7" stroke-width="2"/>
  <line x1="62" y1="52" x2="98" y2="52" stroke="#38bdf8" stroke-width="1.8"/>
</svg>`,

  // 15. Classic Glasses
  "glasses.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Left Frame -->
  <rect x="58" y="66" width="20" height="15" rx="3.5" fill="rgba(241, 245, 249, 0.25)" stroke="#0f172a" stroke-width="2.6"/>
  <!-- Right Frame -->
  <rect x="82" y="66" width="20" height="15" rx="3.5" fill="rgba(241, 245, 249, 0.25)" stroke="#0f172a" stroke-width="2.6"/>
  <!-- Nose Bridge -->
  <path d="M 78 72 Q 80 69 82 72" fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round"/>
  <!-- Temples extending to ears -->
  <line x1="58" y1="71" x2="52" y2="73" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/>
  <line x1="102" y1="71" x2="108" y2="73" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round"/>
  <!-- Glass Reflection Glints -->
  <line x1="60" y1="77" x2="68" y2="69" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
  <line x1="84" y1="77" x2="92" y2="69" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
</svg>`,

  // 16. Aviator Sunglasses
  "sunglasses.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <linearGradient id="sg_tint" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="60%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#334155"/>
    </linearGradient>
  </defs>
  <!-- Brow Bar -->
  <line x1="56" y1="67" x2="104" y2="67" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Nose Bridge -->
  <path d="M 77 71 Q 80 68 83 71" fill="none" stroke="#0f172a" stroke-width="2.5"/>
  <!-- Left Teardrop Lens -->
  <path d="M 57 69 C 68 69 77 70 77 73 C 77 81 72 85 66 85 C 60 85 57 80 57 69 Z" fill="url(#sg_tint)" stroke="#0f172a" stroke-width="2.2"/>
  <!-- Right Teardrop Lens -->
  <path d="M 83 73 C 83 70 92 69 103 69 C 103 80 100 85 94 85 C 88 85 83 81 83 73 Z" fill="url(#sg_tint)" stroke="#0f172a" stroke-width="2.2"/>
  <!-- Glossy White Diagonal Highlights -->
  <polygon points="60,78 68,69 71,69 63,78" fill="#ffffff" opacity="0.6"/>
  <polygon points="86,78 94,69 97,69 89,78" fill="#ffffff" opacity="0.6"/>
  <!-- Temple arms -->
  <line x1="57" y1="69" x2="51" y2="72" stroke="#0f172a" stroke-width="2"/>
  <line x1="103" y1="69" x2="109" y2="72" stroke="#0f172a" stroke-width="2"/>
</svg>`,

  // 17. Round Glasses
  "round_glasses.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Left Wire Circle -->
  <circle cx="68" cy="74" r="9.5" fill="rgba(240, 249, 255, 0.25)" stroke="#ca8a04" stroke-width="2"/>
  <!-- Right Wire Circle -->
  <circle cx="92" cy="74" r="9.5" fill="rgba(240, 249, 255, 0.25)" stroke="#ca8a04" stroke-width="2"/>
  <!-- Arched Nose Bridge -->
  <path d="M 77.5 73 Q 80 69 82.5 73" fill="none" stroke="#ca8a04" stroke-width="2" stroke-linecap="round"/>
  <!-- Wire Temples -->
  <line x1="58.5" y1="73" x2="52" y2="74" stroke="#ca8a04" stroke-width="1.8"/>
  <line x1="101.5" y1="73" x2="108" y2="74" stroke="#ca8a04" stroke-width="1.8"/>
  <!-- Highlights -->
  <path d="M 62 70 A 7 7 0 0 1 72 68" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
  <path d="M 86 70 A 7 7 0 0 1 96 68" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.8"/>
</svg>`,

  // 18. Cyber Visor Glasses
  "cyber_glasses.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <filter id="cg_glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Cyber Visor Plate -->
  <polygon points="54,68 106,68 102,80 84,81 80,78 76,81 58,80" fill="rgba(6, 182, 212, 0.35)" stroke="#06b6d4" stroke-width="2" filter="url(#cg_glow)"/>
  <!-- HUD Lines & Targeting -->
  <line x1="56" y1="71" x2="104" y2="71" stroke="#38bdf8" stroke-width="1.2"/>
  <line x1="57" y1="76" x2="74" y2="76" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="2 1"/>
  <line x1="86" y1="76" x2="103" y2="76" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="2 1"/>
  <!-- Target Reticle Left -->
  <circle cx="68" cy="74" r="4" fill="none" stroke="#f43f5e" stroke-width="1.2"/>
  <line x1="68" y1="68" x2="68" y2="80" stroke="#f43f5e" stroke-width="0.8"/>
  <!-- Battery / Readout Right -->
  <rect x="88" y="73" width="7" height="3" fill="none" stroke="#22c55e" stroke-width="0.8"/>
  <rect x="89" y="74" width="4" height="1.5" fill="#22c55e"/>
</svg>`,

  // 19. Sports Visor
  "visor.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Band wrapping around head -->
  <path d="M 52 57 Q 80 53 108 57 L 107 63 Q 80 59 53 63 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <!-- Translucent Visor Brim Angled Down -->
  <path d="M 46 59 C 48 54 70 52 80 52 C 90 52 112 54 114 59 C 117 68 98 73 80 73 C 62 73 43 68 46 59 Z" fill="rgba(249, 115, 22, 0.45)" stroke="#ea580c" stroke-width="2"/>
  <!-- Specular Reflection -->
  <path d="M 50 60 C 60 56 75 55 80 55 C 85 55 100 56 110 60" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.8"/>
</svg>`,

  // 20. Tech Mask
  "mask.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Ear Straps -->
  <path d="M 64 85 C 56 81 54 75 54 75" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 96 85 C 104 81 106 75 106 75" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Main Mask Body -->
  <polygon points="73,81 87,81 99,88 95,102 80,105 65,102 61,88" fill="#18181b" stroke="#09090b" stroke-width="2.5" stroke-linejoin="round"/>
  <polygon points="74,83 86,83 97,89 93,100 80,103 67,100 63,89" fill="#27272a"/>
  <!-- Center Seam & Air Filter Valve -->
  <line x1="80" y1="83" x2="80" y2="103" stroke="#09090b" stroke-width="2"/>
  <!-- Circular Valve Left -->
  <circle cx="70" cy="93" r="3.5" fill="#09090b" stroke="#3b82f6" stroke-width="1.2"/>
  <line x1="68" y1="93" x2="72" y2="93" stroke="#3b82f6" stroke-width="1"/>
</svg>`,

  // 21. Kitsune Half Mask
  "half_mask.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Porcelain Mask Plate on Left Cheek -->
  <g transform="translate(52, 68)">
    <path d="M 12 0 C 22 2 28 10 28 20 C 28 28 18 34 8 32 C 0 30 -2 18 2 10 Z" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
    <!-- Fox Eye Slit -->
    <path d="M 6 12 Q 14 10 20 15 Q 14 14 6 12" fill="#0f172a"/>
    <!-- Crimson Markings -->
    <path d="M 4 8 Q 10 4 18 6" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>
    <path d="M 2 16 Q 8 20 14 18" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="16" cy="24" r="1.5" fill="#dc2626"/>
    <!-- Red Hanging Cord & Bell -->
    <path d="M 2 26 Q 4 36 0 44" fill="none" stroke="#dc2626" stroke-width="1.5"/>
    <circle cx="0" cy="45" r="2.5" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>
  </g>
</svg>`,

  // 22. Face Bandage
  "face_bandage.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Diagonal Strip 1 -->
  <rect x="73" y="82" width="14" height="6" rx="1.5" transform="rotate(-20 80 85)" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
  <rect x="76" y="83" width="8" height="4" rx="1" transform="rotate(-20 80 85)" fill="#ffffff" opacity="0.6"/>
  <!-- Diagonal Strip 2 (Crossed) -->
  <rect x="73" y="82" width="14" height="6" rx="1.5" transform="rotate(25 80 85)" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/>
  <rect x="76" y="83" width="8" height="4" rx="1" transform="rotate(25 80 85)" fill="#ffffff" opacity="0.6"/>
  <!-- Micro Gauze Dots -->
  <circle cx="80" cy="85" r="0.8" fill="#b45309"/>
</svg>`,

  // 23. Cat Ears
  "cat_ears.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Left Cat Ear -->
  <polygon points="55,42 43,14 69,32" fill="#1e293b" stroke="#0f172a" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Left Pink Inner -->
  <polygon points="54,39 46,18 65,33" fill="#f472b6"/>
  <!-- Left White Tuft -->
  <path d="M 52 38 L 57 28 L 59 36" fill="#f8fafc"/>
  <!-- Right Cat Ear -->
  <polygon points="105,42 117,14 91,32" fill="#1e293b" stroke="#0f172a" stroke-width="2.5" stroke-linejoin="round"/>
  <!-- Right Pink Inner -->
  <polygon points="106,39 114,18 95,33" fill="#f472b6"/>
  <!-- Right White Tuft -->
  <path d="M 108 38 L 103 28 L 101 36" fill="#f8fafc"/>
  <!-- Cute Mini Ribbon on Right Ear -->
  <g transform="translate(105, 38) rotate(-15)">
    <polygon points="0,0 -4,-3 -4,3" fill="#f43f5e"/>
    <polygon points="0,0 4,-3 4,3" fill="#f43f5e"/>
    <circle cx="0" cy="0" r="1.5" fill="#fde047"/>
  </g>
</svg>`,

  // 24. Wolf Ears
  "wolf_ears.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Left Wild Wolf Ear -->
  <polygon points="54,42 39,12 68,30" fill="#475569" stroke="#1e293b" stroke-width="2.5" stroke-linejoin="round"/>
  <polygon points="43,15 39,12 48,22" fill="#0f172a"/>
  <polygon points="53,40 43,18 64,32" fill="#94a3b8"/>
  <path d="M 50 38 L 55 26 L 58 36" fill="#f1f5f9"/>
  <!-- Right Wild Wolf Ear -->
  <polygon points="106,42 121,12 92,30" fill="#475569" stroke="#1e293b" stroke-width="2.5" stroke-linejoin="round"/>
  <polygon points="117,15 121,12 112,22" fill="#0f172a"/>
  <polygon points="107,40 117,18 96,32" fill="#94a3b8"/>
  <path d="M 110 38 L 105 26 L 102 36" fill="#f1f5f9"/>
</svg>`,

  // 25. Demon Horns
  "demon_horns.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <linearGradient id="dh_grad_l" x1="100%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="50%" stop-color="#991b1b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
    <linearGradient id="dh_grad_r" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="50%" stop-color="#991b1b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <!-- Left Curved Horn -->
  <path d="M 60 40 C 52 36 40 26 34 14 C 44 20 54 28 66 34 Z" fill="url(#dh_grad_l)" stroke="#09090b" stroke-width="2.2" stroke-linejoin="round"/>
  <!-- Ridges -->
  <line x1="54" y1="34" x2="58" y2="28" stroke="#fca5a5" stroke-width="1.2" opacity="0.8"/>
  <line x1="44" y1="24" x2="48" y2="18" stroke="#fca5a5" stroke-width="1.2" opacity="0.8"/>
  <!-- Right Curved Horn -->
  <path d="M 100 40 C 108 36 120 26 126 14 C 116 20 106 28 94 34 Z" fill="url(#dh_grad_r)" stroke="#09090b" stroke-width="2.2" stroke-linejoin="round"/>
  <!-- Ridges -->
  <line x1="106" y1="34" x2="102" y2="28" stroke="#fca5a5" stroke-width="1.2" opacity="0.8"/>
  <line x1="116" y1="24" x2="112" y2="18" stroke="#fca5a5" stroke-width="1.2" opacity="0.8"/>
</svg>`,

  // 26. Angel Halo
  "angel_halo.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <filter id="ah_glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Glowing Horizontal Ring -->
  <ellipse cx="80" cy="18" rx="26" ry="6.5" fill="none" stroke="#fef08a" stroke-width="5" opacity="0.4" filter="url(#ah_glow)"/>
  <ellipse cx="80" cy="18" rx="26" ry="6.5" fill="none" stroke="#eab308" stroke-width="3"/>
  <ellipse cx="80" cy="18" rx="25" ry="5.5" fill="none" stroke="#ffffff" stroke-width="1.8"/>
  <!-- Divine Sparkles -->
  <circle cx="56" cy="16" r="1.5" fill="#ffffff" filter="url(#ah_glow)"/>
  <circle cx="104" cy="20" r="1.5" fill="#ffffff" filter="url(#ah_glow)"/>
  <circle cx="80" cy="12" r="1" fill="#fef08a"/>
</svg>`,

  // 27. Small Wings (Layer: BACK)
  "small_wings.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <linearGradient id="sw_feather" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="80%" stop-color="#e0f2fe"/>
      <stop offset="100%" stop-color="#bae6fd"/>
    </linearGradient>
  </defs>
  <!-- Left Wing -->
  <g>
    <path d="M 68 88 C 55 75 35 50 18 52 C 16 65 24 80 32 92 C 40 102 55 106 66 100 Z" fill="url(#sw_feather)" stroke="#0284c7" stroke-width="2.2" stroke-linejoin="round"/>
    <!-- Feathers layering -->
    <path d="M 28 65 C 22 75 25 86 35 94" fill="none" stroke="#38bdf8" stroke-width="1.8"/>
    <path d="M 38 60 C 32 72 37 84 46 94" fill="none" stroke="#38bdf8" stroke-width="1.8"/>
    <!-- Gold Trim Base -->
    <path d="M 60 84 C 55 80 48 78 44 80" fill="none" stroke="#f59e0b" stroke-width="2"/>
  </g>
  <!-- Right Wing -->
  <g>
    <path d="M 92 88 C 105 75 125 50 142 52 C 144 65 136 80 128 92 C 120 102 105 106 94 100 Z" fill="url(#sw_feather)" stroke="#0284c7" stroke-width="2.2" stroke-linejoin="round"/>
    <!-- Feathers layering -->
    <path d="M 132 65 C 138 75 135 86 125 94" fill="none" stroke="#38bdf8" stroke-width="1.8"/>
    <path d="M 122 60 C 128 72 123 84 114 94" fill="none" stroke="#38bdf8" stroke-width="1.8"/>
    <!-- Gold Trim Base -->
    <path d="M 100 84 C 105 80 112 78 116 80" fill="none" stroke="#f59e0b" stroke-width="2"/>
  </g>
</svg>`,

  // 28. Shoulder Pet Slime
  "shoulder_pet.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Perched on Left Shoulder: around (52, 106) -->
  <g transform="translate(42, 94)">
    <!-- Slime Drop Shadow -->
    <ellipse cx="12" cy="22" rx="10" ry="3" fill="rgba(15, 23, 42, 0.3)"/>
    <!-- Jelly Body -->
    <path d="M 4 20 C 0 16 2 8 12 7 C 22 8 24 16 20 20 C 18 23 6 23 4 20 Z" fill="#06b6d4" stroke="#0891b2" stroke-width="1.8"/>
    <path d="M 6 18 C 3 15 5 10 12 9 C 19 10 21 15 18 18 Z" fill="#22d3ee"/>
    <!-- Specular Bubble Highlight -->
    <ellipse cx="8" cy="11" rx="2.5" ry="1.5" fill="#ffffff" opacity="0.8"/>
    <!-- Cute Eyes: (・ω・) -->
    <circle cx="9" cy="14" r="1.2" fill="#0f172a"/>
    <circle cx="15" cy="14" r="1.2" fill="#0f172a"/>
    <!-- Mouth -->
    <path d="M 11 16 Q 12 17.5 13 16" fill="none" stroke="#0f172a" stroke-width="0.8"/>
    <!-- Blush -->
    <circle cx="7" cy="16" r="1" fill="#f43f5e" opacity="0.6"/>
    <circle cx="17" cy="16" r="1" fill="#f43f5e" opacity="0.6"/>
    <!-- Head Sprout Leaf -->
    <path d="M 12 7 Q 14 2 17 4 Q 14 6 12 7" fill="#4ade80" stroke="#16a34a" stroke-width="0.8"/>
  </g>
</svg>`,

  // 29. Floating Arcane Orb
  "floating_orb.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <defs>
    <radialGradient id="fo_core" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#d8b4fe"/>
      <stop offset="70%" stop-color="#9333ea"/>
      <stop offset="100%" stop-color="#581c87"/>
    </radialGradient>
    <filter id="fo_glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Floating near right side at (116, 75) -->
  <g transform="translate(108, 66)">
    <!-- Outer Arcane Ring -->
    <ellipse cx="9" cy="9" rx="14" ry="5" transform="rotate(-25 9 9)" fill="none" stroke="#c084fc" stroke-width="1.8" filter="url(#fo_glow)"/>
    <!-- Glowing Sphere -->
    <circle cx="9" cy="9" r="8.5" fill="url(#fo_core)" stroke="#581c87" stroke-width="1.5" filter="url(#fo_glow)"/>
    <!-- Inner Spark -->
    <circle cx="7" cy="7" r="2" fill="#ffffff" opacity="0.9"/>
    <!-- Orbiting Energy Dust -->
    <circle cx="-1" cy="4" r="1" fill="#f0abfc"/>
    <circle cx="19" cy="14" r="1.2" fill="#f0abfc"/>
    <circle cx="9" cy="20" r="0.8" fill="#e9d5ff"/>
  </g>
</svg>`,

  // 30. Mini Backpack (Layer: BACK)
  "small_backpack.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Backpack body peaking behind shoulders: centered at (80, 105) -->
  <g>
    <!-- Top Carry Handle -->
    <path d="M 72 82 C 72 75 88 75 88 82" fill="none" stroke="#1c1917" stroke-width="3" stroke-linecap="round"/>
    <!-- Rolled Bedroll on Top -->
    <rect x="62" y="78" width="36" height="8" rx="4" fill="#a16207" stroke="#451a03" stroke-width="2"/>
    <line x1="70" y1="78" x2="70" y2="86" stroke="#451a03" stroke-width="1.5"/>
    <line x1="90" y1="78" x2="90" y2="86" stroke="#451a03" stroke-width="1.5"/>
    <!-- Main Pack Body -->
    <rect x="58" y="84" width="44" height="42" rx="7" fill="#3f3f46" stroke="#18181b" stroke-width="2.5"/>
    <rect x="60" y="86" width="40" height="38" rx="5" fill="#52525b"/>
    <!-- Padded Straps peaking past shoulders -->
    <path d="M 54 94 C 50 100 50 114 54 122" fill="none" stroke="#27272a" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M 106 94 C 110 100 110 114 106 122" fill="none" stroke="#27272a" stroke-width="4.5" stroke-linecap="round"/>
    <!-- Outer Side Pouches -->
    <rect x="54" y="96" width="6" height="18" rx="2" fill="#27272a" stroke="#18181b" stroke-width="1.5"/>
    <rect x="100" y="96" width="6" height="18" rx="2" fill="#27272a" stroke="#18181b" stroke-width="1.5"/>
  </g>
</svg>`,

  // 31. Winter Scarf
  "scarf.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%">
  <!-- Chunky Neck Wrap -->
  <g>
    <!-- Back Wrap -->
    <path d="M 64 96 Q 80 92 96 96 L 98 106 Q 80 102 62 106 Z" fill="#991b1b" stroke="#450a0a" stroke-width="2"/>
    <!-- Front Bulky Wrap -->
    <path d="M 60 100 C 60 96 72 95 80 95 C 88 95 100 96 100 100 C 102 110 88 116 80 116 C 72 116 58 110 60 100 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2.5"/>
    <!-- Knit Weave Lines -->
    <path d="M 66 102 Q 80 106 94 102" fill="none" stroke="#ef4444" stroke-width="2"/>
    <path d="M 68 108 Q 80 112 92 108" fill="none" stroke="#b91c1c" stroke-width="1.8"/>
    <!-- Trailing Wind-blown Tail on Left -->
    <path d="M 62 106 C 58 114 55 128 58 140 C 63 140 68 140 70 138 C 66 126 68 116 72 110 Z" fill="#b91c1c" stroke="#7f1d1d" stroke-width="2"/>
    <path d="M 64 108 C 60 116 58 126 60 136" fill="none" stroke="#ef4444" stroke-width="1.5"/>
    <!-- Fringe ends -->
    <line x1="58" y1="140" x2="57" y2="145" stroke="#ef4444" stroke-width="1.5"/>
    <line x1="61" y1="140" x2="61" y2="146" stroke="#ef4444" stroke-width="1.5"/>
    <line x1="64" y1="140" x2="65" y2="146" stroke="#ef4444" stroke-width="1.5"/>
    <line x1="67" y1="139" x2="68" y2="145" stroke="#ef4444" stroke-width="1.5"/>
    <line x1="70" y1="138" x2="71" y2="144" stroke="#ef4444" stroke-width="1.5"/>
  </g>
</svg>`
};

console.log("Generating 31 high-resolution anime vector SVG accessories...");
let count = 0;
for (const [filename, content] of Object.entries(SVGS)) {
  const filePath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filePath, content.trim(), "utf8");
  count++;
}
console.log(`Successfully generated ${count} SVG accessories in ${OUT_DIR}`);
