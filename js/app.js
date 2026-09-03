/* Tiny Quest — app.js
   Main controller: onboarding, dashboard, check-in loop,
   reward sequencing (combo → perfect day → level up → badges). */

import { $, $all, el, clamp, todayOffset, formatOffset, randomEmoji } from "./util.js";
import * as S from "./store.js";
import * as FX from "./fx.js";
import * as SND from "./sound.js";
import * as B from "./badges.js";

let state = null;
const ui = {};
let combo = 0; // consecutive check-ins in this session (pitch-rising chimes)
let nextGoalId = 1;

// ================= init =================
function init() {
  state = S.readState();
  nextGoalId = state.goals.reduce((m, g) => Math.max(m, g.id), 0) + 1;
  bindUi();
  FX.init();

  if (state.goals.length === 0) {
    showOnboarding();
  } else {
    const ret = S.processReturn(state);
    S.saveState(state);
    showDashboard(ret);
  }
}

function bindUi() {
  // onboarding
  ui.ob = $("#onboarding");
  ui.goalInput = $("#goal-input");
  ui.obList = $("#ob-goal-list");
  ui.startBtn = $("#start-adventure");

  ui.goalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addOnboardingGoal();
  });
  $("#add-goal").addEventListener("click", addOnboardingGoal);
  ui.startBtn.addEventListener("click", startAdventure);
  $all(".ob-suggestions .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      ui.goalInput.value = chip.textContent.trim().replace(/^[^\s]+\s/, "");
      addOnboardingGoal();
    });
  });

  // dashboard
  ui.dash = $("#dashboard");
  ui.streakCount = $("#streak-count");
  ui.streakWrap = $(".streak-wrap");
  ui.ringProgress = $(".ring-progress");
  ui.levelCount = $("#level-count");
  ui.rankName = $("#rank-name");
  ui.questDate = $("#quest-date");
  ui.questList = $("#quest-list");
  ui.momentumFill = $("#momentum-fill");
  ui.momentumPct = $("#momentum-pct");
  ui.momentumMsg = $("#momentum-msg");
  ui.trophyCount = $("#trophy-count");

  // inline "add a new quest" row on the dashboard
  ui.newQuestBtn = $("#btn-new-quest");
  ui.newQuestForm = $("#new-quest-form");
  ui.newQuestInput = $("#new-quest-input");
  ui.newQuestSubmit = $("#new-quest-submit");
  ui.newQuestCancel = $("#new-quest-cancel");

  ui.newQuestBtn.addEventListener("click", () => {
    ui.newQuestBtn.classList.add("hidden");
    ui.newQuestForm.classList.remove("hidden");
    ui.newQuestInput.focus();
  });
  ui.newQuestCancel.addEventListener("click", closeNewQuestForm);
  ui.newQuestInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDashboardGoal();
    if (e.key === "Escape") closeNewQuestForm();
  });
  ui.newQuestSubmit.addEventListener("click", addDashboardGoal);

  $("#btn-trophies").addEventListener("click", () => openModal("trophies"));
  $("#btn-stats").addEventListener("click", () => openModal("stats"));

  // modals
  $all(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
  $all(".modal").forEach((m) => {
    m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); });
  });

  // reward overlay
  ui.rewardOverlay = $("#reward-overlay");
  $("#reward-continue").addEventListener("click", closeReward);
}

function closeNewQuestForm() {
  ui.newQuestInput.value = "";
  ui.newQuestForm.classList.add("hidden");
  ui.newQuestBtn.classList.remove("hidden");
}

// ================= onboarding =================
function showOnboarding() {
  ui.ob.classList.remove("hidden");
  renderOnboardingGoals();
  setTimeout(() => ui.goalInput.focus(), 100);
}

function addOnboardingGoal() {
  const text = ui.goalInput.value.trim();
  if (!text) { shake(ui.goalInput); return; }
  state.goals.push({ id: nextGoalId++, text, icon: pickIcon(text) });
  ui.goalInput.value = "";
  renderOnboardingGoals();
  SND.combo(0);
}

function renderOnboardingGoals() {
  ui.obList.innerHTML = "";
  const tip = $(".ob-tip");
  ui.startBtn.disabled = state.goals.length === 0;

  state.goals.forEach((g) => {
    const item = el("div", "ob-goal-item");
    item.appendChild(el("span", null, g.icon + "  " + g.text));
    const del = el("button", "del", "✕");
    del.addEventListener("click", () => {
      state.goals = state.goals.filter((x) => x.id !== g.id);
      renderOnboardingGoals();
    });
    item.appendChild(del);
    ui.obList.appendChild(item);
  });

  if (tip) tip.textContent = state.goals.length === 0
    ? "Tip: 3–5 quests is the sweet spot."
    : state.goals.length + (state.goals.length === 1 ? " quest" : " quests") + " locked in. Good luck, hero.";
}

function startAdventure() {
  if (state.goals.length === 0) { shake(ui.startBtn); return; }
  B.evaluate(state, {}); // may grant "first-quest"
  S.saveState(state);
  ui.ob.classList.add("hidden");
  showDashboard({ firstEver: true });
}

// ================= dashboard =================
function showDashboard(returnInfo) {
  ui.dash.classList.remove("hidden");
  renderAll();

  if (returnInfo && returnInfo.firstEver) {
    toast("Your quest log awaits. Check off your first win!", "🗺️");
  } else if (returnInfo && returnInfo.returned) {
    welcomeBack(returnInfo);
  }
}

function welcomeBack(ret) {
  if (ret.shieldsUsed > 0 && !ret.broke) {
    toast("A shield protected your streak while you were away!", "🛡️");
  } else if (ret.shieldsUsed > 0 && ret.broke) {
    toast("Shields covered " + ret.shieldsUsed + " day(s), but the streak ended after that.", "💔");
  } else if (ret.broke) {
    toast("Your streak reset. A fresh start is a power move.", "🌱");
  }
}

function renderAll() {
  renderStreak();
  renderQuests();
  renderMomentum();
  renderSubStats();
  renderAura();
  updateTrophyCount();
}

// ---- streak ring ----
function renderStreak() {
  const streak = S.currentStreak(state);
  ui.streakCount.textContent = streak;

  // ring fills toward the next streak milestone
  const milestone = nextMilestone(streak);
  const pct = clamp(streak / milestone, 0, 1);
  const C = 2 * Math.PI * 104;
  ui.ringProgress.style.strokeDasharray = C;
  ui.ringProgress.style.strokeDashoffset = C * (1 - pct);
}

function nextMilestone(streak) {
  if (streak < 3) return 3;
  if (streak < 7) return 7;
  if (streak < 14) return 14;
  if (streak < 21) return 21;
  if (streak < 30) return 30;
  return Math.ceil((streak + 1) / 30) * 30;
}

// ---- sub stats ----
function renderSubStats() {
  const lv = S.levelFromXp(state.xp);
  $("#level-count").textContent = "Level " + lv.level;
  $("#rank-name").textContent = S.rankFor(lv.level);
  $("#shield-count").textContent = state.shields + (state.shields === 1 ? " shield" : " shields");
  $("#perfect-count").textContent = state.perfect + (state.perfect === 1 ? " perfect day" : " perfect days");
  $("#level-orb").textContent = lv.level >= 10 ? "🌠" : lv.level >= 5 ? "⭐" : "🌟";
  $("#shield-orb").textContent = state.shields > 0 ? "🛡️" : "🧊";
}

function renderAura() {
  document.body.setAttribute("data-aura", S.auraFor(S.currentStreak(state)));
}

// ---- quests ----
function renderQuests() {
  ui.questList.innerHTML = "";
  const today = todayOffset();
  const doneIds = S.doneIdsFor(state, today);
  ui.questDate.textContent = "· " + formatOffset(today, { short: true });

  state.goals.forEach((g) => {
    const done = doneIds.includes(g.id);
    const row = el("div", "quest" + (done ? " done" : ""));
    row.appendChild(el("div", "quest-check", done ? "✓" : ""));
    row.appendChild(el("div", "quest-text", g.icon + "  " + g.text));
    const meta = el("div", "quest-meta");
    meta.appendChild(el("div", "quest-xp", "+10 XP"));
    row.appendChild(meta);
    row.addEventListener("click", () => toggleGoal(g, row));
    ui.questList.appendChild(row);
  });

  if (state.goals.length === 0) {
    const empty = el("div", "momentum-msg");
    empty.style.textAlign = "center";
    empty.textContent = "No quests yet — add one to start your streak.";
    ui.questList.appendChild(empty);
  }
}

// ---- momentum ----
function renderMomentum() {
  const today = todayOffset();
  const done = S.doneIdsFor(state, today).length;
  const total = state.goals.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  ui.momentumFill.style.width = pct + "%";
  ui.momentumPct.textContent = pct + "%";
  ui.momentumMsg.textContent = momentumMsg(done, total);
}

function momentumMsg(done, total) {
  if (total === 0) return "Add a quest to begin.";
  if (done === 0) return "Your quests await…";
  if (done < total) return total - done === 1
    ? "So close! One quest left for a PERFECT DAY ✨"
    : (total - done) + " quests left. Keep the fire alive!";
  return "PERFECT DAY COMPLETE! You absolute legend. 🏆";
}

function updateTrophyCount() {
  ui.trophyCount.textContent = state.badges.length;
}

// ================= add quest from the dashboard =================
function addDashboardGoal() {
  const text = ui.newQuestInput.value.trim();
  if (!text) { shake(ui.newQuestInput); return; }
  state.goals.push({ id: nextGoalId++, text, icon: pickIcon(text) });
  closeNewQuestForm();
  B.evaluate(state, {});
  S.saveState(state);
  renderQuests();
  renderMomentum();
  updateTrophyCount();
  toast("Quest added: " + text, "⚔️");
}

// ================= check-in loop =================
function toggleGoal(goal, row) {
  const today = todayOffset();
  const doneIds = S.doneIdsFor(state, today);

  if (doneIds.includes(goal.id)) {
    uncheck(goal, today, doneIds, row);
  } else {
    check(goal, today, doneIds, row);
  }
}

function uncheck(goal, today, doneIds, row) {
  const wasPerfect = S.isPerfect(state, today);

  doneIds.splice(doneIds.indexOf(goal.id), 1);
  state.days[String(today)] = doneIds;

  // Reverse exactly what the check-in granted: XP. Perfect-day awards
  // (perfect++/shield) are granted at most once per day via
  // markPerfectAwarded, so they intentionally stay granted after an uncheck.
  const refunded = S.refundAwarded(state, today, goal.id);

  combo = 0;
  SND.undo();
  S.saveState(state);

  row.classList.remove("done", "flash");
  row.querySelector(".quest-check").textContent = "";
  renderMomentum();
  renderStreak();
  renderSubStats();
  if (refunded > 0) toast("Unchecked. " + refunded + " XP returned to the void.", "↩️");
}

function check(goal, today, doneIds, row) {
  const wasPerfect = S.isPerfect(state, today);
  const prevLevel = S.levelFromXp(state.xp).level;
  const prevStreak = S.currentStreak(state);

  doneIds.push(goal.id);
  state.days[String(today)] = doneIds;
  combo++;

  const xpGain = 10 + Math.min(combo - 1, 4) * 2; // combo bonus caps at +8
  state.xp += xpGain;
  S.recordAwarded(state, today, goal.id, xpGain);

  // instant feedback at the click point
  const rect = row.getBoundingClientRect();
  SND.combo(Math.min(combo - 1, 5));
  FX.burst(rect.right - 50, rect.top + rect.height / 2, { count: 15, power: 5 });
  FX.xpFly(row, xpGain, ui.streakWrap);
  row.classList.add("done", "flash");
  row.querySelector(".quest-check").textContent = "✓";
  renderMomentum();

  const nowPerfect = S.isPerfect(state, today);

  // shield economy: a newly-perfect day earns a shield (cap 3), once per day ever
  let shieldEarned = false;
  let freshPerfect = false;
  if (nowPerfect && !wasPerfect) {
    if (S.markPerfectAwarded(state, today)) {
      state.perfect++;
      if (state.shields < 3) { state.shields++; shieldEarned = true; }
      freshPerfect = true;
    }
  }

  const curStreak = S.currentStreak(state);
  if (curStreak > state.best) state.best = curStreak;

  const newBadges = B.evaluate(state, { shieldEarned });
  const finalLevel = S.levelFromXp(state.xp).level;

  S.saveState(state);
  renderStreak();
  renderSubStats();
  renderAura();
  updateTrophyCount();

  // ---- reward sequencing: biggest event wins the overlay ----
  if (freshPerfect) {
    perfectDaySequence(curStreak, finalLevel > prevLevel, newBadges);
  } else if (finalLevel > prevLevel) {
    levelUpSequence(finalLevel, newBadges);
  } else if (newBadges.length > 0) {
    newBadges.forEach((b, i) => {
      setTimeout(() => badgeToast(b), 300 + i * 350);
    });
  } else if (curStreak > prevStreak) {
    toast(curStreak + "-day streak! The fire grows.", "🔥");
  } else if (nowPerfect) {
    // re-completing a day whose award was already granted
    toast("Perfect day restored. The calendar remembers. 🏆", "✅");
  }
}

function perfectDaySequence(streak, leveledUp, newBadges) {
  SND.perfect();
  FX.rain();
  openReward({
    emblem: "🏆",
    title: "PERFECT DAY!",
    sub: streak > 1
      ? streak + "-day streak alive! Streak Shield earned 🛡️"
      : "Day one of your legend starts now. Streak Shield earned 🛡️"
  });
  setTimeout(SND.fanfare, 450);
  setTimeout(() => {
    if (leveledUp) levelUpToast(S.levelFromXp(state.xp).level);
    newBadges.forEach((b, i) => {
      setTimeout(() => badgeToast(b), i * 400);
    });
  }, 900);
}

function levelUpSequence(level, newBadges) {
  SND.fanfare();
  FX.rain();
  openReward({
    emblem: level >= 10 ? "🌠" : "⭐",
    title: "LEVEL " + level + "!",
    sub: "You are now a " + S.rankFor(level) + ". Keep burning."
  });
  newBadges.forEach((b, i) => {
    setTimeout(() => badgeToast(b), 800 + i * 400);
  });
}

function levelUpToast(level) {
  toast("Level up! You're now a " + S.rankFor(level) + " (Level " + level + ")", "⭐");
}

function badgeToast(b) {
  toast("Trophy earned: " + b.name + "!", b.icon);
}

// ================= modals =================
function openModal(id) {
  $("#" + id).classList.remove("hidden");
  if (id === "trophies") renderTrophies();
  if (id === "stats") renderStats();
}

function closeModal(id) {
  $("#" + id).classList.add("hidden");
}

// ================= reward overlay =================
function openReward(opts) {
  $("#reward-emblem").textContent = opts.emblem;
  $("#reward-title").textContent = opts.title;
  $("#reward-sub").textContent = opts.sub || "";
  ui.rewardOverlay.classList.remove("hidden");
}

function closeReward() {
  ui.rewardOverlay.classList.add("hidden");
}

// ================= misc ui =================
function toast(msg, emoji) {
  const t = el("div", "toast");
  t.appendChild(el("div", "t-emoji", emoji || "✨"));
  t.appendChild(el("div", null, msg));
  $("#toast-layer").appendChild(t);
  setTimeout(() => {
    t.classList.add("leaving");
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

function shake(elm) {
  elm.classList.add("shake");
  setTimeout(() => elm.classList.remove("shake"), 400);
}

function pickIcon(text) {
  const map = [
    [/bed|sleep|early|night/i, "🛏️"],
    [/read|book|pages/i, "📚"],
    [/run|walk|move|gym|exercise|workout|stretch/i, "🏃"],
    [/water|hydrat|drink/i, "💧"],
    [/meditat|breath|calm|mind/i, "🧘"],
    [/phone|screen|scroll/i, "📵"],
    [/journal|write|diary/i, "✍️"],
    [/vitamin|supplement|pill/i, "💊"],
    [/fruit|veg|eat|food|diet|cook/i, "🥗"],
    [/sun|outside|nature/i, "🌤️"],
    [/learn|study|language|practice|code/i, "🎓"],
    [/clean|tidy|laundry|dishes/i, "🧹"]
  ];
  for (const [re, icon] of map) {
    if (re.test(text)) return icon;
  }
  return randomEmoji(["⚔️", "🎯", "🚀", "🧭", "✨"]);
}

// ================= trophy + stats modals =================
function renderTrophies() {
  const grid = $("#trophy-grid");
  grid.innerHTML = "";
  B.all().forEach((b) => {
    const earned = state.badges.includes(b.id);
    const cell = el("div", "trophy" + (earned ? " earned" : " locked"));
    cell.appendChild(el("div", "trophy-icon", earned ? b.icon : "🔒"));
    cell.appendChild(el("div", "trophy-name", b.name));
    cell.appendChild(el("div", "trophy-desc", b.desc));
    grid.appendChild(cell);
  });
}

function renderStats() {
  const today = todayOffset();
  $("#stat-best").textContent = state.best || 0;
  $("#stat-perfect").textContent = state.perfect;

  const grid = $("#week-grid");
  grid.innerHTML = "";
  for (let d = today - 6; d <= today; d++) {
    const done = S.doneIdsFor(state, d).length;
    const ratio = state.goals.length > 0 ? done / state.goals.length : 0;
    const cell = el("div", "day-cell" + (d === today ? " today" : ""));
    cell.title = formatOffset(d) + " — " + done + "/" + state.goals.length;
    cell.textContent = ratio >= 1 ? "🌟" : ratio >= 0.5 ? "🔥" : ratio > 0 ? "✨" : "·";
    grid.appendChild(cell);
  }

  const hall = $("#per-goal-stats");
  hall.innerHTML = "";
  state.goals.slice().sort((a, b) => countFor(b) - countFor(a))
    .forEach((g) => {
      const days = countFor(g);
      const row = el("div", "goal-stat-row");
      row.appendChild(el("span", null, g.icon + " " + g.text));
      const barWrap = el("div", "goal-stat-bar-wrap");
      const bar = el("div", "goal-stat-bar");
      bar.style.width = clamp((days / 30) * 100, 4, 100) + "%";
      barWrap.appendChild(bar);
      row.appendChild(barWrap);
      row.appendChild(el("div", "goal-stat-num", days + (days === 1 ? " day" : " days")));
      hall.appendChild(row);
    });
}

function countFor(goal) {
  return Object.keys(state.days).reduce((sum, key) => {
    return sum + (state.days[key].includes(goal.id) ? 1 : 0);
  }, 0);
}

document.addEventListener("DOMContentLoaded", init);
