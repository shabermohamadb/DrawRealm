/**
 * Evolution Mode Configuration & Constants
 */

const EVOLUTION_LEVELS = [
  { level: 0, title: "Human", xpRequired: 0, maxPowers: 0, hasUltimate: false },
  { level: 1, title: "Scout", xpRequired: 50, maxPowers: 1, hasUltimate: false },
  { level: 2, title: "Swift", xpRequired: 120, maxPowers: 2, hasUltimate: false },
  { level: 3, title: "Creator", xpRequired: 220, maxPowers: 3, hasUltimate: false },
  { level: 4, title: "Mind Reader", xpRequired: 350, maxPowers: 3, hasUltimate: false },
  { level: 5, title: "Guardian", xpRequired: 520, maxPowers: 3, hasUltimate: false },
  { level: 6, title: "Berserker", xpRequired: 720, maxPowers: 3, hasUltimate: false },
  { level: 7, title: "Manipulator", xpRequired: 950, maxPowers: 3, hasUltimate: true },
  { level: 8, title: "Elite", xpRequired: 1220, maxPowers: 3, hasUltimate: true },
  { level: 9, title: "Master", xpRequired: 1550, maxPowers: 3, hasUltimate: true },
  { level: 10, title: "Evolution", xpRequired: 2000, maxPowers: 3, hasUltimate: true }
];

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

const BRANCHES = {
  ATTACK: "attack",
  INTELLIGENCE: "intelligence",
  CREATOR: "creator",
  DEFENSE: "defense",
  CHAOS: "chaos"
};

const RARITIES = {
  COMMON: { name: "Common", color: "#808080", weight: 45 },
  UNCOMMON: { name: "Uncommon", color: "#22c55e", weight: 30 },
  RARE: { name: "Rare", color: "#3b82f6", weight: 15 },
  EPIC: { name: "Epic", color: "#a855f7", weight: 7 },
  LEGENDARY: { name: "Legendary", color: "#f59e0b", weight: 3 },
  ULTIMATE: { name: "Ultimate", color: "#ef4444", weight: 0 }
};

module.exports = {
  EVOLUTION_LEVELS,
  EVOLUTION_XP,
  BRANCHES,
  RARITIES
};
