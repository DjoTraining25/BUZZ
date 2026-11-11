// ════════════════════════════════════════════════════════════════
//  BUZZ — profil de fonctionnement (v2)
//  Pas de cases « type de TDAH » : depuis le DSM-5 on parle de
//  « présentations » qui changent au fil de la vie, et beaucoup
//  d'adultes fluctuent. Chaque trait se répond en fréquence
//  (rarement / ça dépend / souvent). On peut donc avoir besoin à la fois
//  de repères (côté TSA) et de nouveauté (côté TDAH) : l'app sait
//  combiner les deux, et la personne choisit chaque jour.
//  Les étiquettes (TDAH, TSA, dys) ne font que pré-remplir : ce sont
//  les réponses aux traits qui règlent l'app.
// ════════════════════════════════════════════════════════════════
import { LEVELS } from "./data.js";
import { ANCHORS, newRoutine } from "./routine.js";

export const FREQ = [{ v: 0, label: "Rarement" }, { v: 1, label: "Ça dépend" }, { v: 2, label: "Souvent" }];

export const TRAITS = [
  { id: "attention", group: "tete", label: "Ma tête part ailleurs, je décroche vite" },
  { id: "agitation", group: "tete", label: "J'ai besoin de bouger, je tiens mal en place" },
  { id: "impulsion", group: "tete", label: "J'agis ou je réagis avant de réfléchir" },
  { id: "emotions", group: "tete", label: "Mes émotions montent vite et fort" },
  { id: "demarrage", group: "tete", label: "Le plus dur, c'est de m'y mettre" },
  { id: "yoyo", group: "tete", label: "Mon énergie fait des montagnes russes : à fond, puis à plat" },
  { id: "reperes", group: "cadre", label: "J'ai besoin de savoir ce qui m'attend, les imprévus me coûtent" },
  { id: "nouveaute", group: "cadre", label: "Je me lasse vite, il me faut du nouveau" },
  { id: "sensoriel", group: "cadre", label: "Sons, lumières ou vibrations me saturent vite" },
  { id: "coordination", group: "cadre", label: "Coordination et équilibre me demandent un effort" },
  { id: "sommeil", group: "cadre", label: "Le soir, ma tête ne s'éteint pas" },
];

export const QUIZ = [
  { id: "level", kind: "one", title: "Ton rapport au sport", options: LEVELS.map((l) => ({ v: l.v, label: l.label, sub: l.sub })) },
  {
    id: "labels", kind: "multi", title: "Ce qui te correspond",
    sub: "Facultatif, diagnostiqué ou non. Ça pré-remplit la suite ; ce sont tes réponses suivantes qui comptent.",
    options: [
      { v: "tdah", label: "TDAH", sub: "Diagnostiqué, en cours, ou je m'y reconnais" },
      { v: "tsa", label: "Autisme (TSA)", sub: "Diagnostiqué, en cours, ou je m'y reconnais" },
      { v: "dys", label: "Dyspraxie, TDC", sub: "Coordination, gestes, équilibre" },
      { v: "autre", label: "Autre chose, ou je préfère ne pas dire", sub: "Aucun souci" },
    ],
  },
  { id: "tete", kind: "scale", title: "Dans ta tête, au quotidien", sub: "Ça varie ? Choisis « Ça dépend ». C'est souvent la vraie réponse." },
  { id: "cadre", kind: "scale", title: "Ton corps et ce qui t'entoure", sub: "Les deux du haut peuvent être vrais en même temps. Buzz sait faire avec." },
  {
    id: "place", kind: "one", title: "Tu bougeras surtout…",
    options: [
      { v: "maison", label: "Chez moi, tranquille", sub: "Sauts et passage au sol possibles" },
      { v: "appart", label: "Chez moi, avec des voisins", sub: "Sans sauts" },
      { v: "bureau", label: "Au travail", sub: "Sans sauts et sans passage au sol" },
    ],
  },
  {
    id: "goal", kind: "one", title: "Ton objectif",
    sub: "Buzz te fait avancer par paliers, à ton rythme.",
    options: [
      { v: "bouger", label: "Bouger un peu, régulièrement", sub: "Partir de presque rien, sans pression" },
      { v: "reprendre", label: "Reprendre le sport pour de bon", sub: "Arriver à une pratique régulière" },
      { v: "tenir", label: "Je fais déjà du sport", sub: "Le garder dans le temps et mieux gérer mon énergie" },
    ],
  },
  {
    id: "anchor", kind: "one", title: "Ton moment pour bouger",
    sub: "Accrocher le mouvement à un moment qui existe déjà aide à passer à l'acte.",
    options: Object.entries(ANCHORS).map(([v, a]) => ({ v, label: a.label, sub: a.time ? `Rappel possible vers ${a.time.replace(":", " h ")}` : "On choisira plus tard" })),
  },
  { id: "name", kind: "text", title: "Ton prénom ?", sub: "Facultatif. Juste pour te dire bonjour." },
];

// Profil v1 (cases à cocher) → traits v2, pour ne rien perdre.
export function traitsOf(profile) {
  if (profile.traits) return profile.traits;
  const q = profile.q || {}, t = {};
  if (q.adhd === "inattentif" || q.adhd === "mixte") t.attention = 2;
  if (q.adhd === "hyper" || q.adhd === "mixte") t.agitation = 2;
  const map = { start: "demarrage", bored: "nouveaute", emotions: "emotions", focus: "attention", sitting: "agitation", sleep: "sommeil" };
  for (const h of q.hard || []) t[map[h]] = 2;
  for (const n of q.neuro || []) t[{ tsa: "reperes", dys: "coordination", senso: "sensoriel" }[n]] = 2;
  return t;
}

export function draftFrom(profile) {
  return {
    level: profile.level, labels: [...(profile.labels || [])], traits: { ...traitsOf(profile) },
    place: profile.q?.place ?? null, goal: profile.routine?.goal ?? null, anchor: profile.routine?.anchor ?? null,
    name: profile.name || "",
  };
}

// À la sortie de l'écran « étiquettes » : pré-remplissage doux, jamais d'écrasement.
export function prefill(a) {
  const set = (k, v) => { if (a.traits[k] == null) a.traits[k] = v; };
  if (a.labels.includes("tsa")) { set("reperes", 1); set("sensoriel", 1); }
  if (a.labels.includes("dys")) set("coordination", 1);
}

export function applyQuiz(profile, a, now = Date.now()) {
  profile.level = a.level || profile.level;
  profile.name = (a.name || "").trim();
  profile.labels = a.labels;
  profile.traits = { ...a.traits };
  profile.q = { v: 2, done: true, place: a.place };
  if (a.place) {
    profile.quiet = a.place !== "maison";
    profile.noFloor = a.place === "bureau";
  }
  if ((a.traits.sensoriel ?? 0) >= 2) { profile.calm = true; profile.sound = false; }
  const goal = a.goal || profile.routine?.goal || "bouger";
  if (!profile.routine || profile.routine.goal !== goal) {
    profile.routine = newRoutine(goal, profile.level, a.anchor, now);
  } else if (a.anchor && a.anchor !== profile.routine.anchor) {
    profile.routine.anchor = a.anchor;
    profile.routine.time = ANCHORS[a.anchor].time;
  }
  return profile;
}

// Profil → réglages lus par le moteur, le lecteur et le coach.
export function tuneFor(profile) {
  const T = traitsOf(profile), v = (k) => T[k] ?? 0;
  const mode = v("reperes") > v("nouveaute") ? "reperes" : v("nouveaute") > v("reperes") ? "nouveaute" : v("reperes") >= 1 ? "mix" : "normal";
  const score = { sos: v("emotions") + v("impulsion"), focus: v("attention"), pause: v("agitation"), dodo: v("sommeil") };
  return {
    shortSteps: v("attention") >= 2 || v("nouveaute") >= 2,   // exercices de 30 s
    coordBoost: v("attention") >= 1 && v("coordination") < 2, // la coordination réclame de l'attention
    burst: v("agitation") >= 2 || v("agitation") + v("impulsion") >= 3,
    simple: v("coordination") >= 2,
    ready: v("coordination") >= 2 || v("reperes") >= 2 ? 8 : 5,
    listOpen: v("reperes") >= 1,
    startHard: v("demarrage") >= 2,
    pacing: v("yoyo") >= 1,
    mode,
    showMode: v("reperes") >= 1 || v("nouveaute") >= 1,
    tiles: Object.keys(score).sort((a, b) => score[b] - score[a]), // tri stable : ordre d'origine à égalité
  };
}

// Ce qu'on envoie au coach IA : des préférences de séance, jamais les étiquettes ni les traits bruts.
export function prefsFor(t, mode) {
  const keys = ["shortSteps", "coordBoost", "burst", "simple", "startHard", "pacing"].filter((k) => t[k]);
  if (mode && mode !== "normal") keys.push(`mode_${mode}`);
  return keys;
}

// La même chose en phrases, pour que la personne voie ce que ses réponses changent.
export function adaptations(profile) {
  const t = tuneFor(profile), T = traitsOf(profile), out = [];
  if (t.coordBoost && t.shortSteps) out.push("Exercices de 30 s qui changent souvent, avec plus de coordination pour accrocher l'attention.");
  else if (t.shortSteps) out.push("Exercices de 30 s : ça change plus souvent.");
  else if (t.coordBoost) out.push("Un peu plus de coordination : elle réclame de l'attention, donc elle aide à la rallumer.");
  if (t.burst) out.push("Une décharge cardio en début de séance, quand l'énergie le permet.");
  if (t.mode === "mix") out.push("Tu as besoin de repères ET de nouveauté : la séance garde la même structure (même début, même fin, même rythme) et les exercices du milieu changent. Chaque jour, tu peux pencher d'un côté.");
  if (t.mode === "reperes") out.push("Des séances prévisibles : liste des exercices affichée, et je reprends ce que tu as fait la dernière fois dans le même état.");
  if (t.mode === "nouveaute") out.push("Plus de variété : j'évite ce que tu as fait aux dernières séances.");
  if (t.startHard) out.push("« Juste 2 min » devient ton bouton principal.");
  if (t.pacing) out.push("Montagnes russes : les jours « à fond », la séance est plafonnée à 12 min pour garder de la réserve pour le lendemain.");
  if (t.simple) out.push("Coordination simple uniquement, et 8 secondes pour te mettre en place.");
  else if (t.ready === 8) out.push("8 secondes entre deux exercices pour te mettre en place.");
  if ((T.sensoriel ?? 0) >= 2) out.push("Mode calme : pas de bips, de vibrations ni de confettis.");
  const names = { sos: "SOS", focus: "Avant de me concentrer", pause: "Dérouiller", dodo: "Avant de dormir" };
  const top = t.tiles.filter((k) => ({ sos: (T.emotions ?? 0) + (T.impulsion ?? 0), focus: T.attention ?? 0, pause: T.agitation ?? 0, dodo: T.sommeil ?? 0 })[k] >= 2).slice(0, 2);
  if (top.length) out.push(`En tête de tes coups de pouce : ${top.map((k) => names[k]).join(", ")}.`);
  if (profile.q?.place === "appart") out.push("Séances sans sauts.");
  if (profile.q?.place === "bureau") out.push("Séances sans sauts et sans passage au sol.");
  return out;
}
