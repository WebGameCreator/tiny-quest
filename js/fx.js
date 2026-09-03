/* Tiny Quest — fx.js
   Confetti physics on a single reused canvas + DOM particle helpers. */

import { $, el } from "./util.js";

let canvas, ctx, particles = [];
let running = false;

export function init() {
  canvas = $("#confetti-canvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function burst(x, y, opts = {}) {
  if (reduced() || !ctx) return;
  const count = opts.count || 36;
  const colors = opts.colors || ["#ffd166", "#6c5ce7", "#2ed573", "#ff6b81", "#a55eea", "#ffffff"];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = (opts.power || 7) * (0.5 + Math.random());
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
      decay: 0.008 + Math.random() * 0.012,
      shape: Math.random() < 0.35 ? "circle" : "rect"
    });
  }
  startLoop();
}

// full-screen celebration for perfect day
export function rain() {
  const w = window.innerWidth;
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * w,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3.5,
      size: 4 + Math.random() * 6,
      color: ["#ffd166", "#a55eea", "#2ed573", "#ff6b81", "#ffffff"][Math.floor(Math.random() * 5)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      life: 1,
      decay: 0.004,
      shape: Math.random() < 0.35 ? "circle" : "rect"
    });
  }
  startLoop();
}

function startLoop() {
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 0.12;              // gravity
    p.vx *= 0.985;             // air drag
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= p.decay;
    if (p.life <= 0 || p.y > canvas.height + 30) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    }
    ctx.restore();
  }
  if (particles.length > 0) {
    requestAnimationFrame(tick);
  } else {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Floating "+XP" chip from quest row to top of screen
export function xpFly(fromEl, amount, toEl) {
  if (reduced()) return;
  const rect = fromEl.getBoundingClientRect();
  const chip = el("div", "xp-fly");
  chip.textContent = "+" + amount + " XP";
  chip.style.left = rect.left + rect.width / 2 + "px";
  chip.style.top = rect.top + "px";
  document.body.appendChild(chip);
  // drift toward the streak/level area
  const toRect = toEl ? toEl.getBoundingClientRect() : null;
  chip.style.setProperty("--dx", toRect ? (toRect.left + toRect.width / 2 - rect.left) + "px" : "0px");
  chip.style.setProperty("--dy", toEl ? (toRect.top - rect.top - 30) + "px" : "-60px");
  setTimeout(() => chip.remove(), 950);
}

// Small star pop at click point
export function starPop(x, y, emoji) {
  if (reduced()) return;
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const s = el("div", "levelup-emoji");
      s.textContent = emoji || "✨";
      s.style.left = x + (Math.random() - 0.5) * 50 + "px";
      s.style.top = y + (Math.random() - 0.5) * 30 + "px";
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }, i * 40);
  }
}
