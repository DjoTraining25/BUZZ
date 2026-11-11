// ════════════════════════════════════════════════════════════════
//  BUZZ — routine : un chemin par paliers vers une pratique régulière.
//  Appuis :
//   · une habitude se forme en semaines (moyenne ~66 jours, très variable) ;
//     rater un jour ne change presque rien, rater des semaines entières oui ;
//   · un plan « si… alors » accroché à un moment existant aide à passer à l'acte ;
//   · repère final : OMS, 150 min d'activité modérée par semaine.
//  Règles Buzz : on monte quand l'objectif tient 2 semaines, on propose
//  d'alléger après 2 semaines difficiles, on ne retire jamais rien.
// ════════════════════════════════════════════════════════════════
const DAY = 864e5;

export const STAGES = [
  { n: 1, name: "Allumer", days: 3, min: 0, long: 0, longMin: 0, session: 2,
    goal: "Bouger 3 jours par semaine, même 2 minutes.",
    why: "Le but n'est pas l'effort : c'est que bouger devienne normal." },
  { n: 2, name: "Ancrer", days: 4, min: 20, long: 0, longMin: 0, session: 5,
    goal: "4 jours par semaine, 20 min au total.",
    why: "Le geste s'accroche à ton moment de la journée." },
  { n: 3, name: "Construire", days: 4, min: 45, long: 1, longMin: 10, session: 8,
    goal: "4 jours, 45 min au total, dont 1 séance de 10 min ou plus.",
    why: "On allonge une séance, pas toutes." },
  { n: 4, name: "Pratiquer", days: 4, min: 90, long: 2, longMin: 20, session: 12,
    goal: "4 jours, 1 h 30 au total, dont 2 séances de 20 min ou plus.",
    why: "Place à une vraie activité : course, salle, vélo, sport co… Le sport hors appli compte." },
  { n: 5, name: "Régulier", days: 5, min: 150, long: 2, longMin: 20, session: 15,
    goal: "5 jours, 2 h 30 au total, dont 2 séances de 20 min ou plus.",
    why: "C'est le repère de l'OMS pour la santé. Arrivé ici, on garde, on ne pousse plus." },
];

export const ANCHORS = {
  reveil: { label: "Au réveil, après le café", plan: "Après mon café du matin", time: "08:00" },
  midi: { label: "À la pause de midi", plan: "À ma pause de midi", time: "12:30" },
  retour: { label: "En rentrant du travail ou des cours", plan: "En rentrant chez moi", time: "18:30" },
  soir: { label: "Le soir, avant de me poser", plan: "Avant de me poser le soir", time: "21:00" },
  libre: { label: "Je ne sais pas encore", plan: "Quand j'y pense", time: null },
};

export const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
export const UP_AFTER = 2; // semaines réussies pour proposer le palier suivant

export const defaultDays = (n) => ({ 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] }[n] || [0, 2, 4]);
export const stageOf = (routine) => STAGES[(routine?.stage || 1) - 1];

export function newRoutine(goal, level, anchor, now = Date.now()) {
  const stage = goal === "tenir" ? (level >= 3 ? 4 : 3) : goal === "reprendre" && level >= 3 ? 2 : 1;
  const a = ANCHORS[anchor] ? anchor : "libre";
  return { goal, stage, stageSince: now, since: now, anchor: a, time: ANCHORS[a].time, days: defaultDays(STAGES[stage - 1].days), snooze: 0 };
}

export function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function addWeeks(t, k) {
  const d = new Date(t);
  d.setDate(d.getDate() + 7 * k); // par le calendrier : pas de décalage aux changements d'heure
  return d.getTime();
}

export function weekStats(logs, start, stage) {
  const end = addWeeks(start, 1);
  const L = logs.filter((l) => l.t >= start && l.t < end);
  const days = new Set(L.map((l) => new Date(l.t).toDateString())).size;
  const minutes = Math.round(L.reduce((a, l) => a + l.sec, 0) / 60);
  const long = stage.long ? L.filter((l) => l.sec >= stage.longMin * 60 - 30).length : 0;
  return {
    days, minutes, long,
    ok: days >= stage.days && minutes >= stage.min && long >= stage.long,
    low: days < Math.ceil(stage.days / 2),
  };
}

export function evaluate(routine, logs, now = Date.now()) {
  if (!routine) return null;
  const stage = stageOf(routine), cur = weekStart(now), first = weekStart(routine.stageSince);
  const week = weekStats(logs, cur, stage);
  const past = [];
  for (let w = first; w < cur; w = addWeeks(w, 1)) past.push({ w, ...weekStats(logs, w, stage) });
  const okCount = past.filter((p) => p.ok).length + (week.ok ? 1 : 0);
  const full = past.filter((p) => p.w > first); // la semaine de départ est souvent incomplète
  const asked = routine.snooze === cur;
  return {
    stage, week, okCount,
    canUp: stage.n < STAGES.length && okCount >= UP_AFTER && !asked,
    canDown: stage.n > 1 && full.length >= 2 && full.slice(-2).every((p) => p.low) && !week.ok && !asked,
  };
}

export const planText = (routine) =>
  `${(ANCHORS[routine.anchor] || ANCHORS.libre).plan}, je bouge ${stageOf(routine).session} min.`;

// ── Rappel calendrier (.ics) : un repère extérieur qui fait le travail de mémoire ──
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const pad = (n) => String(n).padStart(2, "0");
const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const txt = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function icsFor(routine, url, now = new Date()) {
  const [h, m] = (routine.time || "18:30").split(":").map(Number);
  const days = (routine.days?.length ? routine.days : defaultDays(3)).slice().sort((a, b) => a - b);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  for (let k = 0; k < 8 && !(days.includes((start.getDay() + 6) % 7) && start > now); k++) {
    start.setDate(start.getDate() + 1);
    start.setHours(h, m, 0, 0);
  }
  const min = stageOf(routine).session;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Buzz//Routine//FR", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:buzz-${now.getTime()}@buzz.app`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${local(start)}`,
    `DURATION:PT${Math.max(5, min)}M`,
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(",")}`,
    `SUMMARY:${txt(`🐝 Buzz : je bouge ${min} min`)}`,
    `DESCRIPTION:${txt(`${planText(routine)} Même 2 minutes, ça compte.\n${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Buzz : on bouge ?", "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

// ── Météo intérieure : énergie selon le moment, montagnes russes ──
const SLOT = { matin: "le matin", aprem: "l'après-midi", soir: "le soir" };
export const SLOT_LABEL = SLOT;

export function energyInsights(logs, checks) {
  // Seulement l'énergie « à froid » : notée seule, ou juste avant une séance (pas juste après).
  const pts = [
    ...checks.filter((c) => c.energy).map((c) => ({ t: c.t, e: c.energy })),
    ...logs.filter((l) => l.energyBefore).map((l) => ({ t: l.t - l.sec * 1000, e: l.energyBefore })),
  ].sort((a, b) => a.t - b.t);
  if (pts.length < 5) return { count: pts.length };
  const slot = (t) => { const h = new Date(t).getHours(); return h >= 5 && h < 12 ? "matin" : h >= 12 && h < 18 ? "aprem" : "soir"; };
  const by = {};
  for (const p of pts) (by[slot(p.t)] ||= []).push(p.e);
  const slots = Object.keys(SLOT).map((k) => ({ k, n: by[k]?.length || 0, a: by[k] ? by[k].reduce((x, y) => x + y, 0) / by[k].length : null }));
  const rated = slots.filter((s) => s.n >= 2).sort((x, y) => y.a - x.a);
  const best = rated.length >= 2 && rated[0].a - rated.at(-1).a >= 0.5 ? rated[0] : null;
  let swings = 0;
  pts.forEach((p, i) => { if (p.e >= 5 && pts.slice(i + 1).some((q) => q.t - p.t <= 2 * DAY && q.e <= 2)) swings++; });
  return { count: pts.length, slots, best, swings };
}
