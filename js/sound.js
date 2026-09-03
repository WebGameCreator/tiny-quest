/* Tiny Quest — sound.js
   WebAudio bleeps, no audio files. Combo chimes rise in pitch with
   consecutive check-ins — the Doppler-style feedback loop that makes
   slot machines feel "hot". */

let ctx = null;

export function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, when, dur, type, gainPeak) {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, c.currentTime + when);
  gain.gain.setValueAtTime(0.0001, c.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(gainPeak || 0.16, c.currentTime + when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  // Unlock: browsers require a user gesture; every play call follows one.
  osc.start(c.currentTime + when);
  osc.stop(c.currentTime + when + dur + 0.05);
}

// C major arpeggio climbing with combo count
export function combo(n) {
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const i = Math.min(n, scale.length - 1);
  tone(scale[i], 0, 0.16, "triangle", 0.2);
  tone(scale[i] * 2, 0.02, 0.1, "sine", 0.08);
}

export function undo() {
  tone(220, 0, 0.09, "sine", 0.1);
  tone(165, 0.06, 0.12, "sine", 0.1);
}

// Rising triad fanfare
export function perfect() {
  tone(523.25, 0, 0.22, "triangle", 0.2);
  tone(659.25, 0.1, 0.22, "triangle", 0.2);
  tone(783.99, 0.2, 0.3, "triangle", 0.16);
}

// Level up / big win
export function fanfare() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(f, i * 0.09, 0.25, "triangle", 0.22);
  });
  tone(1318.5, 0.36, 0.5, "triangle", 0.18);
  tone(1567.98, 0.42, 0.5, "sine", 0.2);
}
