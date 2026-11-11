// ════════════════════════════════════════════════════════════════
//  BUZZ — retours sensoriels : bips, voix, vibration, confettis
//  Tout est facultatif : si le navigateur refuse, on continue sans.
// ════════════════════════════════════════════════════════════════
let ctx;

export function beep(freq = 660, dur = 0.12, vol = 0.15) {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {}
}

export function chime() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, 0.12), i * 110));
}

export function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {}
}

export function hush() {
  try {
    speechSynthesis.cancel();
  } catch {}
}

export function buzz(pattern = 40) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

let lock;
export async function keepAwake(on) {
  try {
    if (on) lock = await navigator.wakeLock?.request("screen");
    else { await lock?.release(); lock = null; }
  } catch {}
}

export function confetti(host) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#F2A900", "#5E8C6A", "#E4572E", "#FFE9B0", "#2B2118"];
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < 36; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.4 + "s";
    p.style.animationDuration = 1.4 + Math.random() * 1.2 + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  host.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}
