/**
 * Evolution Mode Achievements Definition and Verification
 */

const ACHIEVEMENTS = {
  first_evolution: {
    id: "first_evolution",
    title: "First Evolution",
    description: "Reach Evolution Level 1 (Scout).",
    xpReward: 25,
    check: (profile) => profile.level >= 1
  },
  speed_demon: {
    id: "speed_demon",
    title: "Speed Demon",
    description: "Make 3 very fast correct guesses under 15 seconds.",
    xpReward: 30,
    check: (profile) => (profile.stats.fastGuesses || 0) >= 3
  },
  master_creator: {
    id: "master_creator",
    title: "Master Creator",
    description: "Successfully complete 3 drawing turns where players guess your word.",
    xpReward: 35,
    check: (profile) => (profile.stats.successfulDraws || 0) >= 3
  },
  survivor: {
    id: "survivor",
    title: "Survivor",
    description: "Successfully use defensive powers to block an attack or penalty.",
    xpReward: 25,
    check: (profile) => (profile.stats.shieldsUsed || 0) >= 2
  },
  chaos_bringer: {
    id: "chaos_bringer",
    title: "Chaos Bringer",
    description: "Activate 3 Chaos powers during matches.",
    xpReward: 30,
    check: (profile) => (profile.stats.chaosUsed || 0) >= 3
  },
  final_form_ach: {
    id: "final_form_ach",
    title: "Final Form",
    description: "Unlock and activate an Ultimate power.",
    xpReward: 50,
    check: (profile) => (profile.stats.ultimatesUsed || 0) >= 1
  },
  evolution_complete: {
    id: "evolution_complete",
    title: "Evolution Complete",
    description: "Reach the maximum Evolution milestone (Level 10).",
    xpReward: 100,
    check: (profile) => profile.level >= 10
  }
};

/**
 * Checks and awards any newly unlocked achievements for a player profile
 * @param {Object} profile 
 * @returns {Array<Object>} List of newly earned achievements
 */
function checkAchievements(profile) {
  if (!profile.achievements) profile.achievements = [];
  if (!profile.stats) profile.stats = {};

  const newlyUnlocked = [];
  for (const ach of Object.values(ACHIEVEMENTS)) {
    if (!profile.achievements.includes(ach.id)) {
      if (ach.check(profile)) {
        profile.achievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    }
  }
  return newlyUnlocked;
}

module.exports = {
  ACHIEVEMENTS,
  checkAchievements
};
