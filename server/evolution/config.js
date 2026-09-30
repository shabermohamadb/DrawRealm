/**
 * Evolution Mode Configuration & Constants
 */

const EVOLUTION_LEVELS = [
  { level: 0, title: "Human", xpRequired: 0, maxPowers: 3, hasUltimate: false },
  { level: 1, title: "Scout", xpRequired: 50, maxPowers: 3, hasUltimate: false },
  { level: 2, title: "Swift", xpRequired: 120, maxPowers: 3, hasUltimate: false },
  { level: 3, title: "Creator", xpRequired: 220, maxPowers: 3, hasUltimate: false },
  { level: 4, title: "Mind Reader", xpRequired: 350, maxPowers: 3, hasUltimate: false },
  { level: 5, title: "Guardian", xpRequired: 520, maxPowers: 3, hasUltimate: false },
  { level: 6, title: "Berserker", xpRequired: 720, maxPowers: 3, hasUltimate: false },
  { level: 7, title: "Manipulator", xpRequired: 950, maxPowers: 3, hasUltimate: false },
  { level: 8, title: "Elite", xpRequired: 1220, maxPowers: 3, hasUltimate: false },
  { level: 9, title: "Master", xpRequired: 1550, maxPowers: 3, hasUltimate: false },
  { level: 10, title: "Evolution", xpRequired: 2000, maxPowers: 3, hasUltimate: true }
];

const POWER_THRESHOLD_INTERVAL = 5;

const EVOLUTION_XP = {
  CORRECT: 10,
  FAST: 5,         // Correct guess within first 20% of draw timer
  DRAW: 10,        // Awarded to drawer when at least one person guesses
  ROUND_WIN: 20,   // Highest delta score in the round
  MATCH_WIN: 50,   // 1st place in the final match podium
  STREAK_2: 2,
  STREAK_3: 5,
  STREAK_5: 10,
  STREAK_10: 25
};

/**
 * Power Points (PP) Economy: Earned through active gameplay actions
 */
const POWER_POINTS_REWARDS = {
  CORRECT: 1,      // Correct guess (+1 PP)
  FAST: 1,         // Fast guess bonus (+1 PP) -> total 2 PP on fast correct guess
  DRAW: 1,         // Drawing completed and guessed by at least one player (+1 PP)
  ROUND_WIN: 2,    // Highest score in the round (+2 PP)
  MATCH_WIN: 3,    // 1st place in final podium (+3 PP)
  STREAK_3: 1,     // Guess streak >= 3 (+1 PP)
  STREAK_5: 2,     // Guess streak >= 5 (+2 PP)
  ACHIEVEMENT: 2,  // Per achievement unlocked (+2 PP)
  LEVEL_UP: 3      // Milestone bonus on reaching a new level (+3 PP)
};

/**
 * Power Points (PP) Unlock Costs by Rarity Tier
 */
const POWER_COSTS = {
  COMMON: 5,
  UNCOMMON: 8,
  RARE: 12,
  EPIC: 18,
  LEGENDARY: 25,
  ULTIMATE: 50     // Special condition: Level 10 + 50 PP
};

const BRANCHES = {
  ATTACK: "attack",
  INTELLIGENCE: "intelligence",
  CREATOR: "creator",
  DEFENSE: "defense",
  CHAOS: "chaos"
};

const RARITIES = {
  COMMON: { name: "Common", color: "#808080", weight: 45, cost: POWER_COSTS.COMMON },
  UNCOMMON: { name: "Uncommon", color: "#22c55e", weight: 30, cost: POWER_COSTS.UNCOMMON },
  RARE: { name: "Rare", color: "#3b82f6", weight: 15, cost: POWER_COSTS.RARE },
  EPIC: { name: "Epic", color: "#a855f7", weight: 7, cost: POWER_COSTS.EPIC },
  LEGENDARY: { name: "Legendary", color: "#f59e0b", weight: 3, cost: POWER_COSTS.LEGENDARY },
  ULTIMATE: { name: "Ultimate", color: "#ef4444", weight: 0, cost: POWER_COSTS.ULTIMATE }
};

module.exports = {
  EVOLUTION_LEVELS,
  EVOLUTION_XP,
  POWER_POINTS_REWARDS,
  POWER_COSTS,
  POWER_THRESHOLD_INTERVAL,
  BRANCHES,
  RARITIES
};
