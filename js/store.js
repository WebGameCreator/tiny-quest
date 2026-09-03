/* Tiny Quest — store.js
   State lives entirely in cookies (no backend, no localStorage).
   Cookies cap at ~4KB, so check-in history is trimmed to the last
   HISTORY_KEEP days (a live streak longer than that is practically
   impossible; `best` preserves the all-time record). */

import { todayOffset } from "./util.js";

const COOKIE = "tq_state";
const MAX_AGE_DAYS = 3650; // 10 years
const HISTORY_KEEP = 180;  // days of history kept in the cookie

// ---------- state shape ----------
// {
//   v: 2,
//   goals: [{ id, text, icon }],
//   days: { "182": [0, 2] },        // day offset -> completed goal ids
//   shielded: { "180": 1 },         // day offset -> shield used (value unused)
//   perfectAwarded: { "182": 1 },   // anti-farm ledger
//   awarded: { "182:0": 10 },       // exact XP per check-in (for refunds)
//   shields: 1, best: 7, xp: 340, perfect: 3,
//   lastVisit: 182, badges: ["first-quest"]
// }

export function defaultState() {
  return {
    v: 2,
    goals: [],
    days: {},
    shielded: {},
    perfectAwarded: {},
    awarded: {},
    shields: 0,
    best: 0,
    xp: 0,
    perfect: 0,
    lastVisit: todayOffset(),
    badges: []
  };
}

const LEGACY_FIELDS = ["total", "sound", "motion", "lastRemind"]; // v1 leftovers

export function readState() {
  try {
    const raw = getCookie(COOKIE);
    if (!raw) return defaultState();
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || (parsed.v !== 1 && parsed.v !== 2)) return defaultState();
    const state = Object.assign(defaultState(), parsed);
    state.v = 2;
    LEGACY_FIELDS.forEach((f) => delete state[f]);
    return state;
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  trimHistory(state);
  setCookie(COOKIE, encodeURIComponent(JSON.stringify(state)), MAX_AGE_DAYS);
}

function trimHistory(state) {
  const cutoff = todayOffset() - HISTORY_KEEP;
  Object.keys(state.days).forEach((key) => {
    if (Number(key) < cutoff) delete state.days[key];
  });
  Object.keys(state.shielded).forEach((key) => {
    if (Number(key) < cutoff) delete state.shielded[key];
  });
}

// ---------- cookie helpers ----------
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
}

function getCookie(name) {
  const key = name + "=";
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const p = part.trim();
    if (p.startsWith(key)) return p.slice(key.length);
  }
  return "";
}

// ---------- level math ----------
// XP needed to clear level n: 60 * n  (fast early levels, slowing climb)
export function levelFromXp(xp) {
  let level = 1, remaining = xp;
  while (remaining >= 60 * level && level < 500) {
    remaining -= 60 * level;
    level++;
  }
  return { level, into: remaining, need: 60 * level };
}

const RANKS = [
  [1, "Seedling"], [3, "Spark"], [5, "Kindler"], [8, "Firefly"],
  [12, "Blazer"], [16, "Firebrand"], [21, "Inferno"], [30, "Supernova"],
  [50, "Eternal Flame"]
];

export function rankFor(level) {
  let name = RANKS[0][1];
  for (const [at, rank] of RANKS) {
    if (level >= at) name = rank;
  }
  return name;
}

// ---------- day / streak math ----------
export function doneIdsFor(state, offset) {
  const done = state.days[String(offset)] || [];
  return done.filter((id) => state.goals.some((g) => g.id === id));
}

// Track XP awarded per check-in so an uncheck refunds exactly what the
// check granted (prevents farming XP by toggling). Keyed "offset:goalId".
export function recordAwarded(state, offset, goalId, xp) {
  state.awarded[offset + ":" + goalId] = xp;
}

export function refundAwarded(state, offset, goalId) {
  const key = offset + ":" + goalId;
  const xp = state.awarded[key] || 0;
  delete state.awarded[key];
  state.xp = Math.max(0, state.xp - xp);
  return xp;
}

// "Perfect day" = every active quest completed.
// A day with no check-ins at all is NOT perfect (no quests done).
export function isPerfect(state, offset) {
  return state.goals.length > 0 && doneIdsFor(state, offset).length >= state.goals.length;
}

// Streak = consecutive perfect days ending today (if today is already
// perfect) or yesterday (today is still in progress). Shielded days
// keep the chain alive.
export function currentStreak(state) {
  const today = todayOffset();
  const start = isPerfect(state, today) ? today : today - 1;
  let streak = 0, offset = start, guard = 0;
  while (offset >= 0 && guard++ < 400) {
    if (isPerfect(state, offset) || state.shielded[String(offset)]) {
      streak++;
      offset--;
    } else {
      break;
    }
  }
  return streak;
}

// Called once on load. Bridges missed days with shields, oldest first,
// stopping at the first unprotected gap (the chain is broken there).
// Returns summary info for the "welcome back" UX.
export function processReturn(state) {
  const today = todayOffset();
  const last = (typeof state.lastVisit === "number") ? state.lastVisit : today;
  const result = { firstEver: Object.keys(state.days).length === 0 && state.goals.length === 0,
                   returned: false, shieldsUsed: 0, broke: false };

  if (last < today) {
    result.returned = true;
    // Walk from the last visited day up to yesterday. A non-perfect
    // day (partial or fully missed) burns one shield if available.
    for (let d = last; d < today; d++) {
      if (!isPerfect(state, d)) {
        if (state.shields > 0) {
          state.shields--;
          state.shielded[String(d)] = 1;
          result.shieldsUsed++;
        } else {
          result.broke = true;
          break;
        }
      }
    }
  }
  state.lastVisit = today;
  return result;
}

// ---------- integrity helpers ----------
// A day's "perfect" reward (perfect++/shield) is granted at most once, ever.
// Guard for the check-all → uncheck-one → recheck exploit.
export function markPerfectAwarded(state, offset) {
  if (state.perfectAwarded[String(offset)]) return false;
  state.perfectAwarded[String(offset)] = 1;
  return true;
}

// Aura tier (visual theme) by live streak
export function auraFor(streak) {
  if (streak >= 21) return "supernova";
  if (streak >= 10) return "inferno";
  if (streak >= 5) return "blaze";
  return "ember";
}
