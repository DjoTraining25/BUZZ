// ════════════════════════════════════════════════════════════════
//  BUZZ — questionnaire d'accueil et réglages qui en découlent.
//  Principe : chaque réponse change quelque chose de concret dans l'app,
//  et la personne voit quoi. Aucune réponse n'est obligatoire, rien n'est
//  un diagnostic : on demande ce qui lui ressemble.
// ════════════════════════════════════════════════════════════════
import { LEVELS, QUICK } from "./data.js";

export const QUIZ = [
  {
    id: "level", kind: "one", title: "Ton rapport au sport",
    options: LEVELS.map((l) => ({ v: l.v, label: l.label, sub: l.sub })),
  },
  {
    id: "adhd", kind: "one", title: "Ton TDAH ressemble plutôt à…",
    sub: "Pas besoin de diagnostic. Choisis ce qui te parle.",
    options: [
      { v: "inattentif", label: "Inattentif", sub: "Tête ailleurs, oublis, du mal à rester sur une chose" },
      { v: "hyper", label: "Hyperactif, impulsif", sub: "Besoin de bouger, impatience, ça déborde" },
      { v: "mixte", label: "Les deux", sub: "Selon les jours, ou tout en même temps" },
      { v: "nsp", label: "Je ne sais pas", sub: "Aucun souci, on fera sans" },
    ],
  },
  {
    id: "hard", kind: "multi", title: "Le plus dur pour toi, au quotidien",
    sub: "Plusieurs choix possibles.",
    options: [
      { v: "start", label: "M'y mettre", sub: "Démarrer une tâche, même quand je veux la faire" },
      { v: "bored", label: "Tenir dans la durée", sub: "Je me lasse vite, il me faut du nouveau" },
      { v: "emotions", label: "Mes émotions", sub: "Ça monte vite et fort" },
      { v: "focus", label: "Me concentrer", sub: "Rester sur une chose à la fois" },
      { v: "sitting", label: "Rester en place", sub: "Réunions, bureau, transports" },
      { v: "sleep", label: "M'endormir", sub: "Le cerveau ne s'éteint pas le soir" },
    ],
  },
  {
    id: "neuro", kind: "multi", title: "Autre chose sur ton fonctionnement ?",
    sub: "Plusieurs choix possibles. Si rien ne te correspond, continue.",
    options: [
      { v: "tsa", label: "Autisme (TSA)", sub: "J'aime savoir à l'avance ce qui m'attend, peu de surprises" },
      { v: "dys", label: "Dyspraxie, TDC", sub: "La coordination et l'équilibre me demandent plus d'effort" },
      { v: "senso", label: "Hypersensibilité sensorielle", sub: "Sons, vibrations et effets visuels me gênent vite" },
    ],
  },
  {
    id: "place", kind: "one", title: "Tu bougeras surtout…",
    options: [
      { v: "maison", label: "Chez moi, tranquille", sub: "Sauts et passage au sol possibles" },
      { v: "appart", label: "Chez moi, avec des voisins", sub: "Sans sauts" },
      { v: "bureau", label: "Au travail", sub: "Sans sauts et sans passage au sol" },
    ],
  },
  { id: "name", kind: "text", title: "Ton prénom ?", sub: "Facultatif. Juste pour te dire bonjour." },
];

export function draftFrom(profile) {
  const q = profile.q || {};
  return { level: profile.level, adhd: q.adhd ?? null, hard: [...(q.hard || [])], neuro: [...(q.neuro || [])], place: q.place ?? null, name: profile.name || "" };
}

// Réponses → profil enregistré. Les interrupteurs restent modifiables dans les Réglages.
export function applyQuiz(profile, a) {
  profile.level = a.level || profile.level;
  profile.name = (a.name || "").trim();
  profile.q = { adhd: a.adhd, hard: a.hard, neuro: a.neuro, place: a.place, done: true };
  if (a.place) {
    profile.quiet = a.place !== "maison";
    profile.noFloor = a.place === "bureau";
  }
  if (a.neuro.includes("senso")) {
    profile.calm = true;
    profile.sound = false;
  }
  return profile;
}

const TILE_FOR = { emotions: "sos", focus: "focus", sitting: "pause", sleep: "dodo" };

// Profil → réglages lus par le moteur, le lecteur et le coach.
export function tuneFor(profile) {
  const q = profile.q || {}, hard = q.hard || [], neuro = q.neuro || [];
  const inatt = q.adhd === "inattentif" || q.adhd === "mixte";
  const hyper = q.adhd === "hyper" || q.adhd === "mixte";
  const familiar = neuro.includes("tsa");
  const simple = neuro.includes("dys");
  const first = hard.map((h) => TILE_FOR[h]).filter(Boolean);
  return {
    shortSteps: inatt || hard.includes("bored"), // exercices de 30 s : ça change plus souvent
    coordBoost: inatt,                           // plus de coordination : elle réclame de l'attention
    burst: hyper,                                // une décharge cardio en ouverture
    familiar,                                    // reprendre des exercices connus
    novelty: !familiar && hard.includes("bored"),// éviter davantage ce qui vient d'être fait
    simple,                                      // pas de coordination complexe
    ready: simple ? 8 : 5,                       // secondes pour se mettre en place
    listOpen: familiar,                          // liste des exercices toujours visible
    startHard: hard.includes("start"),           // « Juste 2 min » en bouton principal
    tiles: [...first, ...QUICK.map((k) => k.id).filter((id) => !first.includes(id))],
  };
}

// Ce qu'on envoie au coach IA : des préférences de séance, jamais les étiquettes cochées.
export const prefsFor = (t) => ["shortSteps", "coordBoost", "burst", "familiar", "novelty", "simple", "startHard"].filter((k) => t[k]);

// La même chose en phrases, pour que la personne voie ce que ses réponses ont changé.
export function adaptations(profile) {
  const q = profile.q || {}, t = tuneFor(profile), hard = q.hard || [], out = [];
  if (t.coordBoost) out.push("Des exercices de 30 s qui changent souvent, avec plus de coordination pour accrocher l'attention.");
  else if (t.shortSteps) out.push("Des exercices de 30 s : ça change plus souvent.");
  if (t.burst) out.push("Une décharge cardio en début de séance, quand l'énergie le permet.");
  if (t.startHard) out.push("« Juste 2 min » devient ton bouton principal.");
  if (t.novelty) out.push("Plus de variété : j'évite ce que tu as fait aux dernières séances.");
  if (t.familiar) out.push("Des séances prévisibles : la liste des exercices est toujours affichée et je reprends ceux que tu connais.");
  if (t.simple) out.push("Coordination simple uniquement, et 8 secondes pour te mettre en place.");
  if ((q.neuro || []).includes("senso")) out.push("Mode calme : pas de bips, de vibrations ni de confettis.");
  const names = { emotions: "SOS", focus: "Avant de me concentrer", sitting: "Dérouiller", sleep: "Avant de dormir" };
  const top = hard.map((h) => names[h]).filter(Boolean);
  if (top.length) out.push(`En tête de tes coups de pouce : ${top.join(", ")}.`);
  if (q.place === "appart") out.push("Séances sans sauts.");
  if (q.place === "bureau") out.push("Séances sans sauts et sans passage au sol.");
  return out;
}
