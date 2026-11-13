// ════════════════════════════════════════════════════════════════
//  BUZZ — coach : la personne écrit quelques mots, on en tire une séance.
//  1) coach IA (fonction serveur /api/coach) quand il répond ;
//  2) sinon lecture locale par mots-clés + moteur de règles.
//  L'app ne dépend donc jamais du réseau pour proposer quelque chose.
// ════════════════════════════════════════════════════════════════
import { EX_BY_ID, STATE_BY_ID } from "./data.js";
import { READY_SEC } from "./engine.js";

// En cas d'échec, l'erreur porte une raison lisible : on l'affiche pour pouvoir diagnostiquer.
export async function askCoach(payload) {
  let res;
  try {
    res = await fetch("api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    throw new Error(e?.name === "TimeoutError" ? "pas de réponse en 45 s" : navigator.onLine === false ? "pas de connexion" : "serveur injoignable");
  }
  let data = null;
  try { data = await res.json(); } catch { /* page d'erreur non JSON */ }
  if (!res.ok) {
    const why = data?.error || (res.status === 404 ? "fonction /api/coach introuvable" : res.status === 504 ? "délai dépassé côté serveur" : "erreur serveur");
    throw new Error(`${why} (HTTP ${res.status})`);
  }
  if (!data) throw new Error("réponse illisible");
  return data;
}

// Réponse du serveur → séance jouable (même forme que celles du moteur de règles).
export function sessionFromCoach(data, ready = READY_SEC) {
  const st = STATE_BY_ID[data?.stateId];
  const exs = (data?.exerciseIds || []).map((id) => EX_BY_ID[id]).filter(Boolean);
  if (!st || exs.length < 3) return null;
  const energy = Math.min(5, Math.max(1, Math.round(data.energy) || 3));
  const minutes = Math.min(20, Math.max(2, Number(data.minutes) || 5));
  const sec = Math.min(60, Math.max(20, Math.round((minutes * 60) / exs.length) - ready));
  const steps = exs.map((ex) => ({ ex, sec }));
  return {
    kind: "gen", ai: true, stateId: st.id, energy,
    cap: Math.max(...exs.map((e) => e.intensity)),
    title: st.title, emoji: st.emoji,
    why: String(data.message || st.why),
    steps, ready, totalSec: steps.reduce((a, s) => a + s.sec + ready, 0),
  };
}

// Secours hors ligne : deviner l'état à partir de mots courants.
const WORDS = {
  tendu: ["stress", "angoiss", "anxi", "tendu", "colere", "enerve", "pression", "submerg", "debord", "panique", "trop de choses", "pleure", "sature"],
  aplat: ["fatigu", "epuis", "creve", "a plat", "vide", "flemme", "pas envie", "lessiv", "ko", "hs", "mal dormi", "endormi", "mou"],
  agite: ["agit", "nerveu", "bouillonn", "surexcit", "trop d'energie", "trop d energie", "tiens pas en place", "impatien", "bougeotte", "excit", "pile electrique"],
  brouillard: ["brouillard", "concentr", "focus", "dispers", "procrastin", "bloqu", "n'arrive pas", "distrait", "embrouill", "tete pleine", "reunion", "ecran"],
};
const ENERGY_FOR = { tendu: 3, aplat: 2, agite: 4, brouillard: 3, ok: 4 };

export function guessFromText(text) {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let best = "ok", score = 0;
  for (const [id, words] of Object.entries(WORDS)) {
    const n = words.filter((w) => t.includes(w)).length;
    if (n > score) { best = id; score = n; }
  }
  const drained = best === "aplat" && /epuis|vide|creve|ko\b|hs\b/.test(t);
  const m = t.match(/(\d{1,2})\s*(min|mn|minutes?)/);
  return { stateId: best, energy: drained ? 1 : ENERGY_FOR[best], minutes: m ? Math.min(20, Math.max(2, +m[1])) : undefined };
}
