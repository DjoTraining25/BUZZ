// ════════════════════════════════════════════════════════════════
//  BUZZ — rappels du quotidien
//  Pourquoi : chez l'adulte TDAH, l'oubli vient surtout de la mémoire
//  « prospective » (se souvenir d'agir au bon moment), en particulier
//  quand il faut surveiller l'heure. Les signaux du corps (soif, faim,
//  envie d'aller aux toilettes) passent aussi plus facilement à la
//  trappe, surtout en hyperfocus, et certains traitements coupent
//  l'appétit. Un rappel extérieur fait ce travail à la place du cerveau.
//
//  Livraison : une web-app ne peut pas notifier quand elle est fermée
//  sans serveur de push. Donc 1) rappels de calendrier (.ics, avec alarme)
//  qui sonnent toujours, 2) carte « Petits besoins » quand Buzz est ouvert.
// ════════════════════════════════════════════════════════════════
import { icsCalendar, rruleDays } from "./routine.js";

const WEEKDAYS = [0, 1, 2, 3, 4];
const ALLDAYS = [0, 1, 2, 3, 4, 5, 6];

export const REMINDERS = {
  water: {
    emoji: "💧", name: "Boire de l'eau", kind: "interval", done: "J'ai bu",
    why: "La soif passe facilement inaperçue quand on est absorbé·e.",
    def: { on: true, every: 120, from: "09:00", to: "19:00" },
    msgs: [
      "💧 Un verre d'eau ?", "💧 Gorgée check : bois un coup", "💧 La fatigue, c'est parfois juste la soif",
      "💧 Pause eau, 10 secondes", "💧 Remplis ta gourde", "💧 Encore un verre, tu gères",
      "💧 Soif ou pas, bois un peu", "💧 Dernier verre avant ce soir",
    ],
  },
  meals: {
    emoji: "🍽️", name: "Manger", kind: "times", done: "J'ai mangé",
    why: "La faim se fait oublier, et certains traitements coupent l'appétit.",
    options: ["08:00", "10:30", "12:30", "16:30", "19:30"],
    def: { on: true, times: ["12:30", "19:30"] },
    msgs: { "08:00": "🍳 Petit-déj ? Même un petit truc", "10:30": "🍎 Une collation ?", "12:30": "🍽️ Midi : tu as mangé ? Le corps en a besoin, même sans faim", "16:30": "🍌 Goûter : un fruit, quelques noix ?", "19:30": "🍽️ Dîner : ton corps attend de l'essence" },
  },
  breaks: {
    emoji: "🧍", name: "Pause corps", kind: "interval", done: "Fait",
    why: "En hyperfocus, on oublie de bouger, de lever les yeux… et d'aller aux toilettes.",
    def: { on: false, every: 90, from: "10:00", to: "17:00", weekdays: true },
    msgs: [
      "🧍 Lève-toi 1 minute, étire-toi", "🚻 Pause toilettes ? Ton corps n'ose pas toujours le dire",
      "👀 Lève les yeux de l'écran, regarde au loin", "🪑 Tu es là depuis un moment : 2 min de « Dérouiller » sur Buzz",
      "🫁 Trois grandes respirations, épaules relâchées", "💧 Pause : un verre d'eau et un étirement",
    ],
  },
  meds: {
    emoji: "💊", name: "Traitement", kind: "times", done: "Pris",
    why: "Seulement si tu as un traitement. Buzz ne donne aucun conseil médical.",
    options: ["07:30", "08:00", "09:00", "12:00", "13:00", "18:00", "20:00"],
    def: { on: false, times: ["08:00"] },
    msgs: { default: "💊 Ton traitement" },
  },
  out: {
    emoji: "🔑", name: "Avant de sortir", kind: "time", done: "Paré·e",
    why: "Le check rapide avant de passer la porte.",
    def: { on: false, time: "08:15", weekdays: true },
    msgs: ["🔑 Avant de sortir : clés, téléphone, portefeuille, gourde ?"],
  },
  bed: {
    emoji: "🌙", name: "Se préparer à dormir", kind: "time", done: "J'y vais",
    why: "Le soir, la tête ne s'éteint pas toute seule et l'heure file.",
    def: { on: false, time: "22:30" },
    msgs: ["🌙 Dans 30 min, au lit : écrans de côté, et « Avant de dormir » sur Buzz"],
  },
};

export const ORDER = ["water", "meals", "breaks", "meds", "out", "bed"];
export const EVERY = [60, 90, 120, 180];

// Réglages par défaut, ajustés au profil : pause corps si attention ou agitation,
// coucher si la tête ne s'éteint pas le soir.
export function defaultsFor(traits = {}) {
  const r = Object.fromEntries(ORDER.map((k) => [k, structuredClone(REMINDERS[k].def)]));
  if ((traits.attention ?? 0) >= 1 || (traits.agitation ?? 0) >= 1) r.breaks.on = true;
  if ((traits.sommeil ?? 0) >= 1) r.bed.on = true;
  return r;
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Toutes les heures de rappel d'un type, avec le message et les jours.
export function slotsFor(key, cfg) {
  const R = REMINDERS[key];
  if (!cfg?.on) return [];
  const days = cfg.weekdays ? WEEKDAYS : ALLDAYS;
  let times = [];
  if (R.kind === "interval") {
    for (let t = toMin(cfg.from); t <= toMin(cfg.to) && times.length < 10; t += cfg.every) times.push(toHHMM(t));
  } else if (R.kind === "times") times = [...cfg.times].sort();
  else times = [cfg.time];
  return times.filter(Boolean).map((time, i) => ({
    key, time, days,
    msg: Array.isArray(R.msgs) ? (key === "water" && i === times.length - 1 && times.length > 2 ? R.msgs.at(-1) : R.msgs[i % (R.msgs.length - (key === "water" ? 1 : 0))]) : R.msgs[time] || R.msgs.default,
  }));
}

export const allSlots = (cfg) => ORDER.flatMap((k) => slotsFor(k, cfg[k]));

// Rappels « dus » maintenant : heure passée depuis moins de 2 h, pas encore fait, pas reporté.
export function dueNow(cfg, needs, snoozed = {}, now = new Date()) {
  const wd = (now.getDay() + 6) % 7, nowMin = now.getHours() * 60 + now.getMinutes();
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const out = [];
  for (const k of ORDER) {
    const slots = slotsFor(k, cfg[k]).filter((s) => s.days.includes(wd) && toMin(s.time) <= nowMin);
    const last = slots.at(-1);
    if (!last || nowMin - toMin(last.time) > 120) continue;
    const at = midnight + toMin(last.time) * 6e4;
    if (needs.some((n) => n.kind === k && n.t >= at)) continue;
    if ((snoozed[k] || 0) > now.getTime()) continue;
    out.push({ ...last, at });
  }
  return out;
}

export const countToday = (needs, kind, now = new Date()) =>
  needs.filter((n) => n.kind === kind && new Date(n.t).toDateString() === now.toDateString()).length;

export function remindersIcs(cfg, url, now = new Date()) {
  const today = new Date(now);
  const events = allSlots(cfg).map((s, i) => {
    const start = new Date(today);
    const [h, m] = s.time.split(":").map(Number);
    start.setHours(h, m, 0, 0);
    return {
      id: `${s.key}-${i}`, start, minutes: 5, summary: s.msg,
      rrule: s.days.length === 7 ? "FREQ=DAILY" : rruleDays(s.days),
      description: `Rappel Buzz. Ouvre l'appli pour cocher « ${REMINDERS[s.key].done} ».\n${url}`, url,
    };
  });
  return icsCalendar(events, now);
}
