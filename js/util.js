/* Tiny Quest — util.js
   Small shared helpers. No dependencies. */

const EPOCH = { y: 2026, m: 0, d: 1 }; // day offset 0 = 2026-01-01 (local time)
const DAY_START_HOUR = 3;               // a day flips at 3AM: a 2AM check-in still counts for the day before

function epochDate() {
  return new Date(EPOCH.y, EPOCH.m, EPOCH.d);
}

function dayDiff(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

// Whole days since the epoch in local time, with the 3AM day boundary.
export function todayOffset(now = new Date()) {
  const shifted = new Date(now);
  shifted.setHours(shifted.getHours() - DAY_START_HOUR);
  return dayDiff(epochDate(), shifted);
}

export function offsetToDate(off) {
  const d = epochDate();
  d.setDate(d.getDate() + off);
  return d;
}

export function formatOffset(off, opts) {
  const d = offsetToDate(off);
  if (opts && opts.short) {
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function $(sel, root) { return (root || document).querySelector(sel); }
export function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function randomEmoji(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}
