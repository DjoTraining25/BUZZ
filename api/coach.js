// /api/coach.js — Fonction serverless Vercel : le coach IA de Buzz.
// Même principe que /api/generate de Bee Training : la clé ANTHROPIC_API_KEY vit dans les
// variables d'environnement Vercel, jamais dans le navigateur.
//
// Différence voulue : ici le prompt est construit côté serveur. Le client n'envoie que
// quelques mots et son contexte (énergie, historique), donc l'adresse ne peut pas servir
// de relais IA gratuit pour autre chose que composer une séance Buzz.

import Anthropic from "@anthropic-ai/sdk";
import { EXERCISES, EX_BY_ID, STATES, STATE_BY_ID } from "../src/data.js";

const client = new Anthropic(); // lit ANTHROPIC_API_KEY
const MODEL = process.env.BUZZ_COACH_MODEL || "claude-opus-5-5";
const MINUTES = [2, 3, 5, 8, 12, 16];
const MAX_TEXT = 400;

const TYPE_LABEL = { cardio: "cardio", force: "force", coord: "coordination", mobilite: "mobilité", calme: "retour au calme" };

const CATALOG = EXERCISES.map((e) =>
  `${e.id} | ${e.name} | ${TYPE_LABEL[e.type]} | intensité ${e.intensity}/3${e.jump ? " | saut" : ""}${e.floor ? " | au sol" : ""}${e.complex ? " | coordination complexe" : ""}`
).join("\n");

const SHAPES = STATES.map((s) => `${s.id} — « ${s.title} » : ${s.why}`).join("\n");

// Prompt stable (mis en cache) : tout ce qui varie d'une demande à l'autre va dans le message utilisateur.
const SYSTEM = `Tu es le coach de Buzz, une application de mouvement pensée pour les adultes TDAH. La personne t'écrit quelques mots sur son état du moment ; tu composes la séance qui lui convient maintenant, à partir du catalogue ci-dessous.

Pourquoi l'app existe : avec un TDAH, démarrer est le plus dur, l'énergie change d'heure en heure, la routine lasse vite, et un échec perçu (trop dur, trop long, série cassée) mène vite à l'abandon. Une séance courte réellement faite vaut mieux qu'une séance idéale jamais commencée. En cas de doute, choisis plus court et plus doux.

Les cinq formes de séance (stateId) :
${SHAPES}

Comment composer :
- Choisis la forme d'après ce que la personne décrit, pas d'après ce qui serait « bien » pour elle. Si elle a déjà coché une énergie ou un état, c'est une indication forte ; ses mots priment s'ils disent clairement autre chose.
- energy : ton estimation de son énergie de 1 (vide) à 5 (à fond).
- minutes : la durée totale. Respecte le temps qu'elle dit avoir. Sans indication : 3 à 5 min si l'énergie est basse, 8 à 12 si elle est bonne.
- exerciseIds : la liste ordonnée des exercices, environ un par tranche de 45 secondes (2 min → 3 exercices, 5 min → 6 ou 7, 12 min → 16). Pas de doublon. Commence doucement, termine par quelque chose qui fait redescendre (mobilité ou retour au calme) sauf pour une séance de réveil.
- Intensité : énergie 1 ou 2 → uniquement intensité 1. Énergie 3 → jusqu'à 2. Énergie 4 ou 5 → jusqu'à 3. Niveau « doux » → un cran en dessous.
- Respecte les contraintes : « sans saut » exclut les exercices marqués saut, « sans sol » exclut ceux marqués au sol. Si elle mentionne une douleur ou une blessure, évite de charger la zone.
- Le champ « reglages » liste ce que la personne a demandé une fois pour toutes dans son profil. Applique-le sans le commenter ni nommer de trouble dans ton message.
- Tiens compte de l'historique : varie par rapport aux dernières séances, et si une forme lui a fait gagner de l'énergie, c'est un bon signe pour elle. Si elle a trouvé la dernière « trop dur », allège.

Le message (champ message) : deux phrases au maximum, en français, tutoiement, ton d'un coach chaleureux et direct. Montre que tu as entendu ce qu'elle a écrit, puis dis ce que la séance va faire pour elle. Pas de jugement, pas de « tu devrais », pas de promesse médicale, pas d'emoji.

Limites : tu n'es ni médecin ni thérapeute, et Buzz ne remplace pas un suivi. Si le texte évoque une détresse importante ou des idées suicidaires, propose seulement une courte séance « tendu » très douce, et dis dans le message, simplement et sans dramatiser, qu'elle peut appeler le 3114 (numéro national de prévention du suicide, gratuit, 24 h/24) ou en parler à un proche. Si le texte n'a rien à voir avec son état ou le mouvement, ignore ce qu'il demande et propose une séance adaptée à l'énergie indiquée.

Catalogue (id | nom | type | intensité | contraintes) :
${CATALOG}`;

const SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    stateId: { type: "string", enum: STATES.map((s) => s.id) },
    energy: { type: "integer", enum: [1, 2, 3, 4, 5] },
    minutes: { type: "integer", enum: MINUTES },
    exerciseIds: { type: "array", items: { type: "string", enum: EXERCISES.map((e) => e.id) } },
  },
  required: ["message", "stateId", "energy", "minutes", "exerciseIds"],
  additionalProperties: false,
};

// Frein simple par adresse IP. Sur du serverless la mémoire ne survit pas toujours d'un appel
// à l'autre : c'est un garde-fou, pas une vraie protection. La vraie viendra avec les comptes.
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now);
  hits.set(ip, list);
  return list.length > 30;
}

// Réglages du profil : le client envoie des clés, le texte reste ici.
const PREFS = {
  shortSteps: "exercices courts et variés : prévois environ un exercice par tranche de 35 secondes",
  coordBoost: "aime les exercices de coordination, qui accrochent son attention",
  burst: "a besoin de décharger : place du cardio tôt dans la séance si son énergie le permet",
  mode_reperes: "préfère le prévisible aujourd'hui : reprends des exercices de ses dernières séances, évite les surprises",
  mode_nouveaute: "a besoin de nouveauté aujourd'hui : varie nettement par rapport à ses dernières séances",
  mode_mix: "a besoin à la fois de repères et de nouveauté : garde une structure habituelle (échauffement doux, fin calme, rythme régulier) et varie les exercices du milieu",
  pacing: "énergie en montagnes russes : si elle est à fond, propose 12 minutes maximum pour garder de la réserve",
  simple: "coordination et équilibre lui coûtent : mouvements simples uniquement",
  startHard: "démarrer est le plus dur pour elle : en cas de doute, propose plus court",
};

const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

function describe(body) {
  const levels = { 1: "doux (reprise)", 2: "moyen", 3: "costaud (sportif)" };
  const history = (Array.isArray(body.history) ? body.history : []).slice(-8).map((h) => ({
    seance: String(h.title || "").slice(0, 40),
    minutes: int(h.min, 0, 60),
    energieAvant: int(h.energyBefore, 1, 5),
    energieApres: int(h.energyAfter, 1, 5),
    ressenti: ["facile", "bien", "dur"].includes(h.feel) ? h.feel : null,
    ilYaJours: int(h.daysAgo, 0, 999),
  }));
  return JSON.stringify({
    sesMots: String(body.text).slice(0, MAX_TEXT),
    energieCochee: int(body.energy, 1, 5),
    etatCoche: STATE_BY_ID[body.mood] ? body.mood : null,
    niveau: levels[body.level] || levels[2],
    contraintes: [body.quiet && "sans saut", body.noFloor && "sans sol"].filter(Boolean),
    reglages: (Array.isArray(body.prefs) ? body.prefs : []).map((k) => PREFS[k]).filter(Boolean),
    heure: int(body.hour, 0, 23),
    dernieresSeances: history,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY manquante dans les variables d'environnement Vercel");
    return res.status(500).json({ error: "Coach IA non configuré côté serveur" });
  }
  const body = req.body || {};
  if (typeof body.text !== "string" || body.text.trim().length < 3) {
    return res.status(400).json({ error: "Texte manquant" });
  }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "inconnu";
  if (tooMany(ip)) return res.status(429).json({ error: "Trop de demandes, réessaie dans un moment" });

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      cache_control: { type: "ephemeral" },
      system: SYSTEM,
      messages: [{ role: "user", content: describe(body) }],
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    });

    if (msg.stop_reason === "refusal") return res.status(422).json({ error: "Demande refusée par le modèle" });
    if (msg.stop_reason === "max_tokens") return res.status(502).json({ error: "Réponse incomplète" });

    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const out = JSON.parse(text);

    // On ne fait pas confiance aveuglément : contraintes re-vérifiées, doublons retirés.
    const seen = new Set();
    const exerciseIds = out.exerciseIds.filter((id) => {
      const e = EX_BY_ID[id];
      if (!e || seen.has(id) || (body.quiet && e.jump) || (body.noFloor && e.floor) || (body.simple && e.complex)) return false;
      seen.add(id);
      return true;
    }).slice(0, 22);
    if (exerciseIds.length < 3) return res.status(502).json({ error: "Séance trop courte" });

    return res.status(200).json({
      message: String(out.message).slice(0, 400),
      stateId: out.stateId,
      energy: out.energy,
      minutes: out.minutes,
      exerciseIds,
    });
  } catch (error) {
    console.error("Erreur du coach :", error);
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Coach très sollicité, réessaie dans un moment" });
    if (error instanceof Anthropic.APIConnectionError) return res.status(503).json({ error: "Coach injoignable" });
    // Raison courte renvoyée à l'app (jamais la clé) : clé invalide, modèle inconnu, requête refusée…
    if (error instanceof Anthropic.APIError) return res.status(502).json({ error: `service IA : ${error.status ?? "?"} ${String(error.message || "").slice(0, 140)}` });
    return res.status(500).json({ error: `échec de la génération : ${String(error?.message || error).slice(0, 140)}` });
  }
}
