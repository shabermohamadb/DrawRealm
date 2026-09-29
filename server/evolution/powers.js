/**
 * All 38 Powers across 7 Categories in Evolution Mode
 */

const { BRANCHES, RARITIES } = require("./config");

const POWERS = {
  // ==========================================
  // ️ ATTACK POWERS (5)
  // ==========================================
  score_surge: {
    id: "score_surge",
    name: "Score Surge",
    branch: BRANCHES.ATTACK,
    rarity: "COMMON",
    cooldown: 40,
    icon: "",
    description: "Next successful guess gives +50% bonus points.",
    isUltimate: false
  },
  point_bomb: {
    id: "point_bomb",
    name: "Point Bomb",
    branch: BRANCHES.ATTACK,
    rarity: "RARE",
    cooldown: 60,
    icon: "",
    description: "Creates a 10s bonus event: next correct guess awards +100 bonus pts.",
    isUltimate: false
  },
  score_steal: {
    id: "score_steal",
    name: "Score Steal",
    branch: BRANCHES.ATTACK,
    rarity: "EPIC",
    cooldown: 75,
    icon: "️",
    description: "Steal up to 40 points from the current 1st-place player (blocked by shields).",
    isUltimate: false
  },
  double_strike: {
    id: "double_strike",
    name: "Double Strike",
    branch: BRANCHES.ATTACK,
    rarity: "EPIC",
    cooldown: 70,
    icon: "️",
    description: "Next two successful guesses receive +30% bonus points.",
    isUltimate: false
  },
  bullseye: {
    id: "bullseye",
    name: "Bullseye",
    branch: BRANCHES.ATTACK,
    rarity: "UNCOMMON",
    cooldown: 45,
    icon: "",
    description: "Very fast correct guess (first 15s) receives +100 additional points.",
    isUltimate: false
  },

  // ==========================================
  //  GUESSING / INTELLIGENCE POWERS (6)
  // ==========================================
  letter_vision: {
    id: "letter_vision",
    name: "Letter Vision",
    branch: BRANCHES.INTELLIGENCE,
    rarity: "COMMON",
    cooldown: 40,
    icon: "️",
    description: "Reveals one random hidden letter specifically for you.",
    isUltimate: false
  },
  word_scan: {
    id: "word_scan",
    name: "Word Scan",
    branch: BRANCHES.INTELLIGENCE,
    rarity: "UNCOMMON",
    cooldown: 45,
    icon: "",
    description: "Reveals the secret word's length and semantic category.",
    isUltimate: false
  },
  pattern_sense: {
    id: "pattern_sense",
    name: "Pattern Sense",
    branch: BRANCHES.INTELLIGENCE,
    rarity: "RARE",
    cooldown: 50,
    icon: "",
    description: "Reveals the first or last letter of the secret word.",
    isUltimate: false
  },
  hint_pulse: {
    id: "hint_pulse",
    name: "Hint Pulse",
    branch: BRANCHES.INTELLIGENCE,
    rarity: "EPIC",
    cooldown: 60,
    icon: "",
    description: "Generates a contextual descriptive hint in your chat log.",
    isUltimate: false
  },
  second_thought: {
    id: "second_thought",
    name: "Second Thought",
    branch: BRANCHES.INTELLIGENCE,
    rarity: "UNCOMMON",
    cooldown: 40,
    icon: "",
    description: "Protects against one wrong-guess spam cooldown penalty.",
    isUltimate: false
  },
  ghost_guess: {
    id: "ghost_guess",
    name: "Ghost Guess",
    branch: BRANCHES.INTELLIGENCE,
    rarity: "LEGENDARY",
    cooldown: 80,
    icon: "",
    description: "Grants tolerance: accepts a guess off by up to 2 characters as correct once.",
    isUltimate: false
  },

  // ==========================================
  //  DRAWING / CREATOR POWERS (6)
  // ==========================================
  magic_brush: {
    id: "magic_brush",
    name: "Magic Brush",
    branch: BRANCHES.CREATOR,
    rarity: "COMMON",
    cooldown: 35,
    icon: "",
    description: "Drawer strokes temporarily cycle through vibrant rainbow colors.",
    isUltimate: false
  },
  shape_assist: {
    id: "shape_assist",
    name: "Shape Assist",
    branch: BRANCHES.CREATOR,
    rarity: "UNCOMMON",
    cooldown: 45,
    icon: "",
    description: "Geometric assistance: automatically straightens strokes for one turn.",
    isUltimate: false
  },
  color_burst: {
    id: "color_burst",
    name: "Color Burst",
    branch: BRANCHES.CREATOR,
    rarity: "UNCOMMON",
    cooldown: 40,
    icon: "",
    description: "Temporarily unlocks an extra palette row of bonus colors for 30s.",
    isUltimate: false
  },
  perfect_line: {
    id: "perfect_line",
    name: "Perfect Line",
    branch: BRANCHES.CREATOR,
    rarity: "RARE",
    cooldown: 30,
    icon: "",
    description: "Draws a ruler-straight line from touch down to release.",
    isUltimate: false
  },
  trail_brush: {
    id: "trail_brush",
    name: "Trail Brush",
    branch: BRANCHES.CREATOR,
    rarity: "LEGENDARY",
    cooldown: 60,
    icon: "",
    description: "Drawing strokes leave a faint shimmering particle trail.",
    isUltimate: false
  },
  instant_clean: {
    id: "instant_clean",
    name: "Instant Clean",
    branch: BRANCHES.CREATOR,
    rarity: "EPIC",
    cooldown: 45,
    icon: "",
    description: "Safely undos the last 3 drawing actions without clearing the board.",
    isUltimate: false
  },

  // ==========================================
  // ️ DEFENSE POWERS (5)
  // ==========================================
  shield: {
    id: "shield",
    name: "Shield",
    branch: BRANCHES.DEFENSE,
    rarity: "COMMON",
    cooldown: 45,
    icon: "️",
    description: "Shields you from one negative event or incoming score steal.",
    isUltimate: false
  },
  second_life: {
    id: "second_life",
    name: "Second Life",
    branch: BRANCHES.DEFENSE,
    rarity: "LEGENDARY",
    cooldown: 90,
    icon: "️",
    description: "Protects against one score loss or negative penalty once per match.",
    isUltimate: false
  },
  time_guard: {
    id: "time_guard",
    name: "Time Guard",
    branch: BRANCHES.DEFENSE,
    rarity: "UNCOMMON",
    cooldown: 45,
    icon: "",
    description: "Prevents a time penalty and grants 5 bonus seconds to your timer.",
    isUltimate: false
  },
  score_lock: {
    id: "score_lock",
    name: "Score Lock",
    branch: BRANCHES.DEFENSE,
    rarity: "RARE",
    cooldown: 60,
    icon: "",
    description: "Locks your current score from all steals and penalties for 45 seconds.",
    isUltimate: false
  },
  freeze_guard: {
    id: "freeze_guard",
    name: "Freeze Guard",
    branch: BRANCHES.DEFENSE,
    rarity: "EPIC",
    cooldown: 50,
    icon: "️",
    description: "Renders you immune to enemy modifiers (Reverse Canvas, Chaos Brush).",
    isUltimate: false
  },

  // ==========================================
  //  CHAOS POWERS (6)
  // ==========================================
  randomizer: {
    id: "randomizer",
    name: "Randomizer",
    branch: BRANCHES.CHAOS,
    rarity: "COMMON",
    cooldown: 50,
    icon: "",
    description: "Activates one random balanced modifier for the current round.",
    isUltimate: false
  },
  reverse_canvas: {
    id: "reverse_canvas",
    name: "Reverse Canvas",
    branch: BRANCHES.CHAOS,
    rarity: "RARE",
    cooldown: 60,
    icon: "",
    description: "Temporarily flips canvas horizontally for 15s for unprotected players.",
    isUltimate: false
  },
  chaos_brush: {
    id: "chaos_brush",
    name: "Chaos Brush",
    branch: BRANCHES.CHAOS,
    rarity: "EPIC",
    cooldown: 50,
    icon: "️",
    description: "Locks drawer's brush size to extra large for 8 seconds.",
    isUltimate: false
  },
  time_warp: {
    id: "time_warp",
    name: "Time Warp",
    branch: BRANCHES.CHAOS,
    rarity: "UNCOMMON",
    cooldown: 45,
    icon: "️",
    description: "Slightly adjusts the round timer by ±5 seconds (strictly bounded).",
    isUltimate: false
  },
  ghost_canvas: {
    id: "ghost_canvas",
    name: "Ghost Canvas",
    branch: BRANCHES.CHAOS,
    rarity: "LEGENDARY",
    cooldown: 70,
    icon: "️",
    description: "Shows a faint, faded preview of the previous round's drawing.",
    isUltimate: false
  },
  mystery_rule: {
    id: "mystery_rule",
    name: "Mystery Rule",
    branch: BRANCHES.CHAOS,
    rarity: "LEGENDARY",
    cooldown: 75,
    icon: "",
    description: "Activates a temporary mystery rule with bonus points announced in chat.",
    isUltimate: false
  },

  // ==========================================
  //  ADVANCED POWERS (5)
  // ==========================================
  power_chain: {
    id: "power_chain",
    name: "Power Chain",
    branch: BRANCHES.ATTACK,
    rarity: "LEGENDARY",
    cooldown: 80,
    icon: "",
    description: "Combines two compatible equipped powers for double effect.",
    isUltimate: false
  },
  mutation: {
    id: "mutation",
    name: "Mutation",
    branch: BRANCHES.CHAOS,
    rarity: "EPIC",
    cooldown: 70,
    icon: "",
    description: "Mutates an equipped power into a higher rarity tier with 20% faster cooldown.",
    isUltimate: false
  },
  evolution_choice: {
    id: "evolution_choice",
    name: "Evolution Choice",
    branch: BRANCHES.INTELLIGENCE,
    rarity: "RARE",
    cooldown: 60,
    icon: "",
    description: "Immediately offers a draft of 3 random powers to equip.",
    isUltimate: false
  },
  power_swap: {
    id: "power_swap",
    name: "Power Swap",
    branch: BRANCHES.DEFENSE,
    rarity: "RARE",
    cooldown: 50,
    icon: "",
    description: "Swaps one selected equipped power for a newly rolled power.",
    isUltimate: false
  },
  rare_drop: {
    id: "rare_drop",
    name: "Rare Drop",
    branch: BRANCHES.CREATOR,
    rarity: "LEGENDARY",
    cooldown: 90,
    icon: "",
    description: "Grants a high chance to immediately obtain an Epic or Legendary power.",
    isUltimate: false
  },

  // ==========================================
  //  ULTIMATE POWERS (5) — Level 7+
  // ==========================================
  reality_shift: {
    id: "reality_shift",
    name: "Reality Shift",
    branch: "ultimate",
    rarity: "ULTIMATE",
    cooldown: 120,
    icon: "",
    description: "Replaces current round modifier with an advantageous party modifier.",
    isUltimate: true
  },
  overdrive: {
    id: "overdrive",
    name: "Overdrive",
    branch: "ultimate",
    rarity: "ULTIMATE",
    cooldown: 120,
    icon: "",
    description: "+50% score boost and +10 bonus XP on all correct guesses this round.",
    isUltimate: true
  },
  omniscience: {
    id: "omniscience",
    name: "Omniscience",
    branch: "ultimate",
    rarity: "ULTIMATE",
    cooldown: 120,
    icon: "️",
    description: "Reveals 3 key letters and category without solving the word automatically.",
    isUltimate: true
  },
  final_form: {
    id: "final_form",
    name: "Final Form",
    branch: "ultimate",
    rarity: "ULTIMATE",
    cooldown: 120,
    icon: "",
    description: "Combines and triggers all equipped normal powers with zero cooldown.",
    isUltimate: true
  },
  apocalypse: {
    id: "apocalypse",
    name: "Apocalypse",
    branch: "ultimate",
    rarity: "ULTIMATE",
    cooldown: 120,
    icon: "️",
    description: "Global party event: +200 bonus pool, +10s clock extension, double XP for all.",
    isUltimate: true
  }
};

/**
 * Returns available normal powers filtered by branch/rarity
 */
function getNormalPowers() {
  return Object.values(POWERS).filter(p => !p.isUltimate);
}

/**
 * Returns ultimate powers
 */
function getUltimatePowers() {
  return Object.values(POWERS).filter(p => p.isUltimate);
}

/**
 * Generates 3 draft choices for a given level and optional branch preference
 */
function rollDraftChoices(level, preferredBranch = null, currentPowerIds = []) {
  const isUltimateDraft = level >= 7 && Math.random() < 0.4;
  let pool = isUltimateDraft ? getUltimatePowers() : getNormalPowers();

  // Exclude already equipped powers
  pool = pool.filter(p => !currentPowerIds.includes(p.id));

  if (pool.length <= 3) return pool;

  // Shuffle and pick 3 weighted by level
  const shuffled = pool.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

module.exports = {
  POWERS,
  getNormalPowers,
  getUltimatePowers,
  rollDraftChoices
};
