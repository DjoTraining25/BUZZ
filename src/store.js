// ════════════════════════════════════════════════════════════════
//  BUZZ — stockage local (localStorage). Tout reste sur l'appareil.
//  Même forme de données qu'on enverra plus tard vers Supabase.
// ════════════════════════════════════════════════════════════════
const KEY = "buzz.v1";

const fresh = () => ({
  profile: { name: "", level: 2, ai: true, voice: true, sound: true, quiet: false, noFloor: false, calm: false, onboarded: false, quizLater: false, q: null },
  honey: 0,
  checks: [], // { t, energy, mood } : énergie notée sans séance
  logs: [],   // { t, kind, stateId, title, sec, completed, energyBefore, energyAfter, feel, honey, comeback, exIds }
  badges: {}, // { id: timestamp }
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw), f = fresh();
    return { ...f, ...s, profile: { ...f.profile, ...s.profile } };
  } catch {
    return fresh();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible (navigation privée) : l'app marche quand même */
  }
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  return fresh();
}
