/* Tiny Quest — badges.js
   Trophy definitions + evaluation. Each badge is checked after any
   state change; earning one fires a toast and adds XP. */

import { levelFromXp, currentStreak } from "./store.js";

const BADGES = [
  { id: "first-quest", icon: "🌱", name: "First Steps", desc: "Add your first quest" },
  { id: "first-checkin", icon: "✅", name: "First Blood", desc: "Complete your first quest" },
  { id: "perfect-1", icon: "🏅", name: "Flawless", desc: "Your first perfect day" },
  { id: "perfect-5", icon: "🌟", name: "Consistency Machine", desc: "5 perfect days" },
  { id: "perfect-15", icon: "💎", name: "Diamond Discipline", desc: "15 perfect days" },
  { id: "perfect-30", icon: "👑", name: "Royal Regime", desc: "30 perfect days" },
  { id: "perfect-100", icon: "🫶", name: "Century of Days", desc: "100 perfect days" },
  { id: "streak-3", icon: "🔥", name: "Warming Up", desc: "3-day streak" },
  { id: "streak-7", icon: "☄️", name: "Week Warrior", desc: "7-day streak" },
  { id: "streak-14", icon: "🌈", name: "Fortnight Force", desc: "14-day streak" },
  { id: "streak-30", icon: "🌋", name: "Unstoppable", desc: "30-day streak" },
  { id: "streak-100", icon: "👽", name: "Not Human", desc: "100-day streak" },
  { id: "level-5", icon: "⭐", name: "Rising Star", desc: "Reach level 5" },
  { id: "level-10", icon: "🌠", name: "Celestial", desc: "Reach level 10" },
  { id: "shield-1", icon: "🛡️", name: "Streak Insurance", desc: "Earn your first shield" }
];

const XP_REWARD = 15;

export function evaluate(state, extra = {}) {
  const earnedNow = [];
  const level = levelFromXp(state.xp).level;
  const streak = currentStreak(state);

  const conditions = {
    "first-quest": state.goals.length > 0,
    "first-checkin": doneIdsTotal(state) >= 1,
    "perfect-1": state.perfect >= 1,
    "perfect-5": state.perfect >= 5,
    "perfect-15": state.perfect >= 15,
    "perfect-30": state.perfect >= 30,
    "perfect-100": state.perfect >= 100,
    "streak-3": streak >= 3,
    "streak-7": streak >= 7,
    "streak-14": streak >= 14,
    "streak-30": streak >= 30,
    "streak-100": streak >= 100,
    "level-5": level >= 5,
    "level-10": level >= 10,
    "shield-1": state.shields >= 1 || extra.shieldEarned
  };

  for (const b of BADGES) {
    if (!state.badges.includes(b.id) && conditions[b.id]) {
      state.badges.push(b.id);
      state.xp += XP_REWARD; // badge XP baked in directly
      earnedNow.push(b);
    }
  }
  return earnedNow;
}

// Total quest check-ins across all history (for the "first blood" badge
// only — no persistent counter is kept anymore).
function doneIdsTotal(state) {
  return Object.keys(state.days).reduce((sum, key) => {
    const ids = state.days[key];
    return sum + ids.filter((id) => state.goals.some((g) => g.id === id)).length;
  }, 0);
}

export function all() { return BADGES; }
