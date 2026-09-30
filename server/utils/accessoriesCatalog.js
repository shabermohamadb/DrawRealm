/**
 * Authoritative DrawRealm Avatar Accessory Catalog
 * Categorized into 'head', 'face', and 'special'.
 * Layers: 'front' (on top of hair/face/eyes/mouth) or 'back' (behind character body).
 */

const ACCESSORIES = [
  // --- HEAD ACCESSORIES (14) ---
  {
    id: "headphones_gaming",
    name: "Gaming Headset",
    category: "head",
    layer: "front",
    file: "headphones_gaming.svg",
    description: "High-end gaming headset with cyan LED glow and mic boom"
  },
  {
    id: "headphones_wireless",
    name: "Wireless Headphones",
    category: "head",
    layer: "front",
    file: "headphones_wireless.svg",
    description: "Sleek minimalist wireless over-ear headphones"
  },
  {
    id: "headphones_studio",
    name: "Studio Headphones",
    category: "head",
    layer: "front",
    file: "headphones_studio.svg",
    description: "Chunky professional studio monitor headphones"
  },
  {
    id: "headphones_simple",
    name: "Simple Headphones",
    category: "head",
    layer: "front",
    file: "headphones_simple.svg",
    description: "Retro thin-wire on-ear headphones with orange foam pads"
  },
  {
    id: "cap",
    name: "Snapback Cap",
    category: "head",
    layer: "front",
    file: "cap.svg",
    description: "Urban streetwear snapback baseball cap"
  },
  {
    id: "beanie",
    name: "Ribbed Beanie",
    category: "head",
    layer: "front",
    file: "beanie.svg",
    description: "Cozy folded knit beanie hugging the crown"
  },
  {
    id: "crown",
    name: "Royal Crown",
    category: "head",
    layer: "front",
    file: "crown.svg",
    description: "Gleaming golden royal circlet with a crimson jewel"
  },
  {
    id: "headband",
    name: "Ninja Headband",
    category: "head",
    layer: "front",
    file: "headband.svg",
    description: "Martial arts headband with metal plate and trailing ties"
  },
  {
    id: "hair_clip",
    name: "Star Hair Clips",
    category: "head",
    layer: "front",
    file: "hair_clip.svg",
    description: "Glittering golden star and cross bobby clips"
  },
  {
    id: "hair_band",
    name: "Bow Headband",
    category: "head",
    layer: "front",
    file: "hair_band.svg",
    description: "Velvet alice hairband topped with a side ribbon bow"
  },
  {
    id: "hat",
    name: "Classic Fedora",
    category: "head",
    layer: "front",
    file: "hat.svg",
    description: "Crisp stylish fedora with dark silk ribbon"
  },
  {
    id: "cowboy_hat",
    name: "Cowboy Hat",
    category: "head",
    layer: "front",
    file: "cowboy_hat.svg",
    description: "Rugged western leather cowboy hat with curved brim"
  },
  {
    id: "wizard_hat",
    name: "Wizard Hat",
    category: "head",
    layer: "front",
    file: "wizard_hat.svg",
    description: "Mystic pointed arcane wizard hat with golden star buckle"
  },
  {
    id: "helmet",
    name: "Cyber Helmet",
    category: "head",
    layer: "front",
    file: "helmet.svg",
    description: "Futuristic tactical helmet with cybernetic visor plate"
  },

  // --- FACE ACCESSORIES (8) ---
  {
    id: "glasses",
    name: "Classic Glasses",
    category: "face",
    layer: "front",
    file: "glasses.svg",
    description: "Modern black acetate rectangular frame glasses"
  },
  {
    id: "sunglasses",
    name: "Sunglasses",
    category: "face",
    layer: "front",
    file: "sunglasses.svg",
    description: "Cool dark tinted aviator shades with specular sheen"
  },
  {
    id: "round_glasses",
    name: "Round Glasses",
    category: "face",
    layer: "front",
    file: "round_glasses.svg",
    description: "Vintage gold-wire circular spectacles"
  },
  {
    id: "cyber_glasses",
    name: "Cyber Glasses",
    category: "face",
    layer: "front",
    file: "cyber_glasses.svg",
    description: "Glowing neon cyan cyberpunk HUD visor glasses"
  },
  {
    id: "visor",
    name: "Sports Visor",
    category: "face",
    layer: "front",
    file: "visor.svg",
    description: "Translucent tinted sports visor angled over forehead"
  },
  {
    id: "mask",
    name: "Tech Mask",
    category: "face",
    layer: "front",
    file: "mask.svg",
    description: "Streetwear black tech mask covering nose and mouth"
  },
  {
    id: "half_mask",
    name: "Half Mask",
    category: "face",
    layer: "front",
    file: "half_mask.svg",
    description: "Handcrafted kitsune porcelain half-mask on cheek"
  },
  {
    id: "face_bandage",
    name: "Face Bandage",
    category: "face",
    layer: "front",
    file: "face_bandage.svg",
    description: "Anime crossed adhesive medical bandage over nose bridge"
  },

  // --- SPECIAL ACCESSORIES (9) ---
  {
    id: "cat_ears",
    name: "Cat Ears",
    category: "special",
    layer: "front",
    file: "cat_ears.svg",
    description: "Fluffy anime nekomimi cat ears with soft pink interior"
  },
  {
    id: "wolf_ears",
    name: "Wolf Ears",
    category: "special",
    layer: "front",
    file: "wolf_ears.svg",
    description: "Sharp wild grey wolf ears with dark tips"
  },
  {
    id: "demon_horns",
    name: "Demon Horns",
    category: "special",
    layer: "front",
    file: "demon_horns.svg",
    description: "Symmetrical curving crimson demon horns"
  },
  {
    id: "angel_halo",
    name: "Angel Halo",
    category: "special",
    layer: "front",
    file: "angel_halo.svg",
    description: "Luminous gold ring hovering peacefully above head"
  },
  {
    id: "small_wings",
    name: "Small Wings",
    category: "special",
    layer: "back",
    file: "small_wings.svg",
    description: "Graceful feathered angelic wings spreading behind shoulders"
  },
  {
    id: "shoulder_pet",
    name: "Shoulder Pet",
    category: "special",
    layer: "front",
    file: "shoulder_pet.svg",
    description: "Adorable cheerful cyan slime sitting on the shoulder"
  },
  {
    id: "floating_orb",
    name: "Floating Orb",
    category: "special",
    layer: "front",
    file: "floating_orb.svg",
    description: "Swirling violet arcane energy orb orbiting beside player"
  },
  {
    id: "small_backpack",
    name: "Small Backpack",
    category: "special",
    layer: "back",
    file: "small_backpack.svg",
    description: "Compact canvas adventurer backpack strapped behind torso"
  },
  {
    id: "scarf",
    name: "Scarf",
    category: "special",
    layer: "front",
    file: "scarf.svg",
    description: "Wind-swept ruby red winter scarf wrapped around neck"
  }
];

const ACCESSORIES_BY_ID = new Map(ACCESSORIES.map(acc => [acc.id, acc]));

const VALID_ACCESSORY_IDS = new Set(ACCESSORIES.map(acc => acc.id));

function getAccessory(id) {
  if (!id || typeof id !== "string") return null;
  return ACCESSORIES_BY_ID.get(id) || null;
}

function isValidAccessoryId(id) {
  return VALID_ACCESSORY_IDS.has(id);
}

function getAccessoriesByCategory(category) {
  if (!category || category === "all") return ACCESSORIES;
  return ACCESSORIES.filter(acc => acc.category === category);
}

module.exports = {
  ACCESSORIES,
  ACCESSORIES_BY_ID,
  VALID_ACCESSORY_IDS,
  getAccessory,
  isValidAccessoryId,
  getAccessoriesByCategory
};
