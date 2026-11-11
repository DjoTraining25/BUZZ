// ════════════════════════════════════════════════════════════════
//  BUZZ — moteur d'adaptation (pur, sans DOM : réutilisable tel quel
//  dans une version React / Supabase)
//  énergie (1-5) + état de tête + niveau → une séance sur mesure
// ════════════════════════════════════════════════════════════════
import { EXERCISES, EX_BY_ID, STATE_BY_ID } from "./data.js";

const DEFAULT_MIN = [3, 5, 8, 12, 16]; // durée proposée selon l'énergie
export const READY_SEC = 5;            // transition entre deux exercices

// Intensité maximale autorisée pour cette séance.
export function capFor(energy, level, st) {
  let cap = energy <= 2 ? 1 : energy === 3 ? 2 : 3;
  if (level === 1) cap = Math.max(1, cap - 1);
  if (level === 3 && energy >= 2) cap = Math.min(3, cap + 1);
  if (energy > 1) cap = Math.max(cap, st.minCap); // énergie à 1 : on ne force jamais
  return Math.min(cap, st.maxCap);
}

const allowed = (e, opts) => !(opts.quiet && e.jump) && !(opts.noFloor && e.floor) && !(opts.simple && e.complex);

function weightedPick(pool, weight) {
  const ws = pool.map(weight);
  let r = Math.random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function pick(type, cap, used, opts, prefer, recent) {
  let pool = EXERCISES.filter((e) => e.type === type && e.intensity <= cap && allowed(e, opts) && !used.has(e.id));
  if (!pool.length) pool = EXERCISES.filter((e) => e.type === type && e.intensity <= cap && allowed(e, opts));
  if (!pool.length) pool = EXERCISES.filter((e) => e.intensity <= cap && allowed(e, opts) && !used.has(e.id));
  return weightedPick(pool, (e) => {
    let w = 1;
    if (prefer === "high" && e.intensity === cap) w = 3;
    if (prefer === "low" && e.intensity === 1) w = 2;
    // Par défaut on évite ce qui vient d'être fait ; profil "prévisible" : au contraire, on le reprend.
    // Mode « repères » : on reprend ; « nouveauté » : on évite fort ; « mix » : on varie le milieu.
    if (recent.includes(e.id)) w *= { reperes: 2, nouveaute: 0.1, mix: 0.2 }[opts.mode] ?? 0.3;
    return w;
  });
}

function fixedOrPick(id, cap, used, opts, prefer, recent) {
  const e = EX_BY_ID[id];
  return allowed(e, opts) ? e : pick(e.type, cap, used, opts, prefer, recent);
}

const totalSec = (steps, ready) => steps.reduce((a, s) => a + s.sec + ready, 0);

export function buildSession({ energy, stateId, level, minutes, opts = {}, recent = [], previous = [] }) {
  const st = STATE_BY_ID[stateId];
  const cap = capFor(energy, level, st);
  let min = minutes ?? Math.min(DEFAULT_MIN[energy - 1], st.maxMin);
  let note = null;
  // Énergie en montagnes russes : un jour « à fond » ne doit pas préparer un jour à plat.
  if (opts.pacing && energy === 5 && minutes == null && min > 12) {
    min = 12;
    note = "Jour à fond : je plafonne à 12 min pour te garder de la réserve pour demain.";
  }
  const ready = opts.ready || READY_SEC;
  const stepSec = min <= 3 || opts.shortSteps ? 30 : 40;
  const n = Math.max(3, Math.round((min * 60) / (stepSec + ready)));

  // Réglages du profil (voir profile.js)
  let cycle = st.cycle;
  if (opts.coordBoost) cycle = cycle.map((t, i) => (t === "force" && i >= 2 ? "coord" : t));
  if (opts.burst && (st.id === "ok" || st.id === "brouillard") && energy >= 3) cycle = ["cardio", ...cycle];

  const used = new Set();
  const add = (e) => (used.add(e.id), { ex: e, sec: stepSec });
  const steps = [add(fixedOrPick(st.start, cap, used, opts, st.prefer, recent))];
  // Mode « repères » : on reprend le milieu de la dernière séance faite dans cet état.
  if (opts.mode === "reperes") {
    for (const id of previous.slice(1, -1)) {
      const e = EX_BY_ID[id];
      if (steps.length - 1 < n - 2 && e && allowed(e, opts) && e.intensity <= cap && !used.has(id)) steps.push(add(e));
    }
    if (steps.length > 1) note ??= "Même séance que la dernière fois dans cet état : tu sais ce qui t'attend.";
  }
  for (let i = steps.length - 1; i < n - 2; i++) {
    steps.push(add(pick(cycle[i % cycle.length], cap, used, opts, st.prefer, recent)));
  }
  steps.push(add(fixedOrPick(st.end, cap, used, opts, st.prefer, recent)));

  return { kind: "gen", stateId, energy, cap, title: st.title, why: st.why, emoji: st.emoji, steps, ready, note, mode: opts.mode, totalSec: totalSec(steps, ready) };
}

export function quickSession(q, level, opts, recent) {
  if (q.gen) {
    const s = buildSession({ energy: q.gen.energy, stateId: q.gen.state, level, minutes: q.gen.minutes, opts, recent });
    return { ...s, kind: q.id, stateId: null, energy: null, title: q.title, why: q.why, emoji: q.emoji };
  }
  const steps = q.fixed.map(([id, sec]) => ({ ex: EX_BY_ID[id], sec }));
  const ready = opts.ready || READY_SEC;
  return { kind: q.id, stateId: null, energy: null, cap: 2, title: q.title, why: q.why, emoji: q.emoji, steps, ready, totalSec: totalSec(steps, ready) };
}

// Remplace un exercice par un autre du même type (bouton "Changer").
export function swapStep(steps, idx, cap, opts) {
  const cur = steps[idx].ex;
  const used = new Set(steps.map((s) => s.ex.id));
  const pool = EXERCISES.filter((e) => e.type === cur.type && e.intensity <= Math.max(cap, cur.intensity) && allowed(e, opts) && !used.has(e.id));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Récompenses : tout effort compte, rien ne se perd ───────────
export const HONEY_PER_CELL = 30;
export const CELLS_PER_COMB = 19;

export function reward({ sec, completed, comeback, firstToday }) {
  const lines = [{ label: `${fmtDur(sec)} de mouvement`, v: Math.max(5, Math.round((sec / 60) * 10)) }];
  if (completed) lines.push({ label: "Séance terminée", v: 10 });
  if (firstToday) lines.push({ label: "Première de la journée", v: 5 });
  if (comeback) lines.push({ label: "Content de te revoir", v: 20 });
  if (Math.random() < 0.3) lines.push({ label: "Pépite surprise", v: 15, surprise: true });
  return { lines, total: lines.reduce((a, l) => a + l.v, 0) };
}

export function hive(honey) {
  const cells = Math.floor(honey / HONEY_PER_CELL);
  return {
    comb: Math.floor(cells / CELLS_PER_COMB) + 1,
    filled: cells % CELLS_PER_COMB,
    toNext: HONEY_PER_CELL - (honey % HONEY_PER_CELL),
  };
}

// ── Ce que les données racontent ────────────────────────────────
export function insights(logs) {
  const rated = logs.filter((l) => l.energyBefore && l.energyAfter);
  if (rated.length < 2) return null;
  const avg = (arr) => arr.reduce((a, l) => a + (l.energyAfter - l.energyBefore), 0) / arr.length;
  const byTitle = {};
  for (const l of rated) (byTitle[l.title] ||= []).push(l);
  const best = Object.entries(byTitle)
    .filter(([, arr]) => arr.length >= 2)
    .map(([title, arr]) => ({ title, delta: avg(arr) }))
    .sort((a, b) => b.delta - a.delta)[0];
  return { delta: avg(rated), count: rated.length, best: best && best.delta > 0 ? best : null };
}

export function weekDays(logs, now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const active = new Set(logs.map((l) => new Date(l.t).toDateString()));
  const today = new Date(now).toDateString();
  return ["L", "M", "M", "J", "V", "S", "D"].map((label, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return { label, on: active.has(day.toDateString()), today: day.toDateString() === today };
  });
}

export function fmtDur(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r >= 10 && m < 10 ? `${m} min ${r}` : `${Math.round(s / 60)} min`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
