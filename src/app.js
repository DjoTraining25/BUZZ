// ════════════════════════════════════════════════════════════════
//  BUZZ — interface
//  Règles de conception TDAH appliquées partout :
//   · une seule action principale par écran, 2 taps pour démarrer
//   · le temps est toujours visible (anneau, total restant)
//   · une consigne à la fois, dite à voix haute
//   · tout effort compte, rien ne se remet jamais à zéro
//   · le but long terme est visible : la routine, par paliers
// ════════════════════════════════════════════════════════════════
import { STATES, ENERGY, QUICK, LEVELS, BADGES } from "./data.js";
import { buildSession, quickSession, swapStep, reward, hive, insights, weekDays, fmtDur, fmtClock, READY_SEC, CELLS_PER_COMB, HONEY_PER_CELL } from "./engine.js";
import { askCoach, sessionFromCoach, guessFromText } from "./coach.js";
import { QUIZ, TRAITS, FREQ, draftFrom, prefill, applyQuiz, tuneFor, prefsFor, adaptations, traitsOf } from "./profile.js";
import { STAGES, ANCHORS, DAY_LABELS, UP_AFTER, stageOf, newRoutine, evaluate, weekStart, planText, icsFor, energyInsights, SLOT_LABEL } from "./routine.js";
import * as store from "./store.js";
import * as fx from "./fx.js";

const root = document.getElementById("root");
let S = store.load();
const ui = {
  screen: S.profile.onboarded ? "main" : "onboard",
  tab: "home", energy: null, mood: null, session: null, result: null,
  quiz: null, quizStep: 0, coachText: "", coachBusy: false, modeToday: null,
  ext: null,
};
let P = null; // lecteur de séance en cours

const EXT = [
  ["marche", "🚶", "Marche"], ["course", "🏃", "Course"], ["velo", "🚴", "Vélo"], ["salle", "🏋️", "Salle, muscu"],
  ["natation", "🏊", "Natation"], ["collectif", "⚽", "Sport co"], ["danse", "💃", "Danse"], ["yoga", "🧘", "Yoga, pilates"],
  ["combat", "🥊", "Combat"], ["autre", "✨", "Autre"],
];
const EXT_MIN = [10, 20, 30, 45, 60, 90];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tune = () => tuneFor(S.profile);
const mode = () => ui.modeToday ?? tune().mode;
const opts = () => ({ quiet: S.profile.quiet, noFloor: S.profile.noFloor, ...tune(), mode: mode() });
const vib = (pattern) => { if (!S.profile.calm) fx.buzz(pattern); };
const recent = () => S.logs.slice(-3).flatMap((l) => l.exIds || []);
const previousFor = (stateId) => [...S.logs].reverse().find((l) => l.kind === "gen" && l.stateId === stateId)?.exIds || [];
const persist = () => store.save(S);
const num = (x) => x.toFixed(1).replace(".", ",");
const DAY = 864e5;

function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── Rendu ───────────────────────────────────────────────────────
function render() {
  const views = { onboard: viewOnboard, quiz: viewQuiz, player: viewPlayer, done: viewDone, ext: viewExt, main: viewMain };
  root.innerHTML = views[ui.screen]();
  if (ui.screen === "player") paintStep();
}

function viewOnboard() {
  return `
  <main class="page onboard">
    <div class="logo" aria-hidden="true">${logoSvg()}</div>
    <h1>Buzz</h1>
    <p class="lead">Bouge selon ton énergie du moment. Ton cerveau suit.</p>
    <ul class="promises">
      <li><b>2 taps</b> et ta séance est prête. Rien à planifier.</li>
      <li><b>Une routine par paliers</b>, de 2 minutes à une vraie pratique du sport.</li>
      <li><b>Jamais de série à perdre.</b> Ce que tu as gagné reste gagné.</li>
    </ul>
    <button class="btn primary big" data-action="quiz-open">Régler Buzz pour moi <small>8 questions, 2 min</small></button>
    <button class="btn ghost" data-action="ob-skip">Passer, je verrai plus tard</button>
    <p class="fine">Buzz n'est pas un dispositif médical, ne pose pas de diagnostic et ne remplace ni un suivi, ni un traitement. En cas de douleur, on arrête.</p>
  </main>`;
}

function viewQuiz() {
  const a = ui.quiz, i = ui.quizStep;
  const top = `
    <div class="p-top">
      <button class="icon" data-action="q-back" aria-label="Retour">←</button>
      <div class="segs">${QUIZ.map((_, k) => `<i class="${k < i ? "past" : k === i ? "cur" : ""}"></i>`).join("")}</div>
      ${i < QUIZ.length ? `<button class="skip" data-action="q-next">Passer</button>` : ""}
    </div>`;

  if (i >= QUIZ.length) {
    const preview = applyQuiz(structuredClone(S.profile), a), lines = adaptations(preview);
    return `
    <main class="page quiz">${top}
      <h1>C'est réglé${a.name.trim() ? ", " + esc(a.name.trim()) : ""}</h1>
      <p class="sub">Tu démarres au palier ${preview.routine.stage} · <b>${stageOf(preview.routine).name}</b> : ${stageOf(preview.routine).goal}</p>
      ${lines.length ? `<p class="sub">Ce que tes réponses changent :</p><ul class="adapt">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="sub">Réglages standards pour commencer. Buzz s'ajustera avec tes retours après chaque séance.</p>`}
      <button class="btn primary big" data-action="q-done">C'est parti</button>
      <p class="fine">Tes réponses restent sur cet appareil. Tu peux refaire le questionnaire dans les Réglages : ton fonctionnement bouge, tes réglages aussi.</p>
    </main>`;
  }

  const q = QUIZ[i];
  let body;
  if (q.kind === "text") {
    body = `<input id="q-name" class="q-input" type="text" autocomplete="given-name" maxlength="24" value="${esc(a.name)}" placeholder="Comme tu veux" aria-label="${q.title}" />`;
  } else if (q.kind === "scale") {
    body = `<div class="scale">${TRAITS.filter((t) => t.group === q.id).map((t) => `
      <div class="trait" role="group" aria-label="${esc(t.label)}">
        <p>${t.label}</p>
        <div class="seg3 tight">${FREQ.map((f) => `
          <button class="opt ${a.traits[t.id] === f.v ? "on" : ""}" data-action="q-scale" data-v="${t.id}:${f.v}" aria-pressed="${a.traits[t.id] === f.v}"><b>${f.label}</b></button>`).join("")}
        </div>
      </div>`).join("")}</div>`;
  } else {
    const picked = (v) => (q.kind === "multi" ? a[q.id].includes(v) : String(a[q.id]) === String(v));
    body = `<div class="qopts">${q.options.map((o) => `
      <button class="qopt ${picked(o.v) ? "on" : ""}" data-action="q-pick" data-v="${o.v}" aria-pressed="${picked(o.v)}">
        <b>${o.label}</b><small>${o.sub}</small></button>`).join("")}</div>`;
  }
  return `
  <main class="page quiz">${top}
    <h1>${q.title}</h1>
    ${q.sub ? `<p class="sub">${q.sub}</p>` : ""}
    ${body}
    ${q.kind !== "one" ? `<button class="btn primary big" data-action="q-next">Continuer</button>` : ""}
  </main>`;
}

function viewMain() {
  const body = { home: viewHome, routine: viewRoutine, hive: viewHive, settings: viewSettings }[ui.tab]();
  const tabs = [["home", "🏃", "Bouger"], ["routine", "🗓️", "Routine"], ["hive", "🍯", "Ruche"], ["settings", "⚙️", "Réglages"]];
  return `
  <main class="page">${body}</main>
  <nav class="nav">${tabs.map(([id, ic, label]) => `
    <button class="${ui.tab === id ? "on" : ""}" data-action="tab" data-v="${id}" aria-current="${ui.tab === id ? "page" : "false"}">
      <span aria-hidden="true">${ic}</span>${label}</button>`).join("")}
  </nav>`;
}

function viewHome() {
  const last = S.logs.at(-1);
  const back = last && Date.now() - last.t >= 3 * DAY;
  const s = ui.session, t = tune(), m = mode();
  const askQuiz = S.profile.q?.v !== 2 && !S.profile.quizLater2;
  const ev = evaluate(S.profile.routine, S.logs);
  return `
  <header class="top">
    <div><h1>Salut${S.profile.name ? " " + esc(S.profile.name) : ""} 👋</h1><p class="sub">Deux taps, et je m'occupe du reste.</p></div>
    <button class="pill" data-action="tab" data-v="hive" aria-label="${S.honey} miel, voir la ruche">🍯 ${S.honey}</button>
  </header>
  ${back ? `<p class="banner">Content de te revoir. Aucun retard à rattraper : on reprend là, maintenant.</p>` : ""}

  ${askQuiz ? `<section class="card nudge">
    <p><b>${S.profile.q?.done ? "Le questionnaire a changé." : "Règle Buzz sur ton fonctionnement."}</b> Un profil nuancé (on peut être « entre deux ») et une routine par paliers vers le sport régulier. 2 minutes.</p>
    <div class="row2"><button class="btn primary" data-action="quiz-open">Répondre</button><button class="btn ghost" data-action="quiz-later">Plus tard</button></div>
  </section>` : ""}

  ${ev ? `<button class="card strip" data-action="tab" data-v="routine">
    <span class="strip-l"><small>Palier ${ev.stage.n} · ${ev.stage.name}</small><b>${esc(planText(S.profile.routine))}</b></span>
    <span class="strip-r"><b>${ev.week.days}/${ev.stage.days}</b><small>jours</small></span>
  </button>` : ""}

  <section class="card">
    <h2><span class="num">1</span>Ton énergie, là, maintenant</h2>
    <div class="row5">${ENERGY.map((e) => `
      <button class="opt ${ui.energy === e.v ? "on" : ""}" data-action="energy" data-v="${e.v}" aria-pressed="${ui.energy === e.v}">
        <span class="em" aria-hidden="true">${e.emoji}</span><small>${e.label}</small></button>`).join("")}
    </div>
  </section>

  <section class="card">
    <h2><span class="num">2</span>Et dans ta tête ?</h2>
    <div class="chips">${STATES.map((st) => `
      <button class="chip ${ui.mood === st.id ? "on" : ""}" data-action="mood" data-v="${st.id}" aria-pressed="${ui.mood === st.id}">
        <span aria-hidden="true">${st.emoji}</span> ${st.label}</button>`).join("")}
    </div>
    ${ui.energy && !s?.ai ? `<button class="link" data-action="note-check">📝 Juste noter mon état, sans bouger</button>` : ""}
  </section>

  <section class="card coach">
    <label for="coach-text"><b>💬 Ou dis-le avec tes mots</b><small>En vrac, ça marche. Tu peux préciser le temps que tu as.</small></label>
    <textarea id="coach-text" rows="2" maxlength="400" placeholder="Ex : la tête pleine après les réunions, 5 min devant moi">${esc(ui.coachText)}</textarea>
    <button class="btn ghost" data-action="coach" ${ui.coachBusy ? "disabled" : ""}>${ui.coachBusy ? "Le coach réfléchit…" : "Demander au coach"}</button>
  </section>

  ${s ? `
  <section class="card prop" id="prop">
    <div class="tag">Ta séance${s.ai ? " · coach IA" : ""}</div>
    <h2 class="prop-title"><span aria-hidden="true">${s.emoji}</span> ${s.title}<span class="dur">${fmtDur(s.totalSec)}</span></h2>
    <p class="why">${esc(s.why)}</p>
    ${s.note ? `<p class="note good">${esc(s.note)}</p>` : ""}
    ${t.showMode && !s.ai ? `
    <div class="modes">
      <span>Aujourd'hui, plutôt :</span>
      <button class="chip sm ${m === "reperes" ? "on" : ""}" data-action="mode" data-v="reperes" aria-pressed="${m === "reperes"}">🔁 Repères</button>
      <button class="chip sm ${m === "nouveaute" ? "on" : ""}" data-action="mode" data-v="nouveaute" aria-pressed="${m === "nouveaute"}">🎲 Nouveauté</button>
    </div>
    ${m === "mix" ? `<small>Entre les deux : même structure que d'habitude, exercices du milieu variés.</small>` : ""}` : ""}
    <details ${t.listOpen ? "open" : ""}><summary>Voir les ${s.steps.length} exercices</summary>
      <ol class="steps">${s.steps.map((st) => `<li><span aria-hidden="true">${st.ex.emoji}</span> ${st.ex.name} <small>${st.sec} s</small></li>`).join("")}</ol>
    </details>
    ${t.startHard ? `
    <button class="btn primary big" data-action="short">Juste 2 min</button>
    <div class="row2">
      <button class="btn ghost" data-action="go">Toute la séance</button>
      <button class="btn ghost" data-action="reroll">🎲 Autre chose</button>
    </div>` : `
    <button class="btn primary big" data-action="go">C'est parti</button>
    <div class="row2">
      <button class="btn ghost" data-action="short">Juste 2 min</button>
      <button class="btn ghost" data-action="reroll">🎲 Autre chose</button>
    </div>`}
  </section>` : ""}

  <h3 class="sec">Coups de pouce <span>sans réfléchir</span></h3>
  <div class="quick">${t.tiles.map((id) => QUICK.find((k) => k.id === id)).map((q) => `
    <button class="tile" data-action="quick" data-v="${q.id}">
      <span class="em" aria-hidden="true">${q.emoji}</span><b>${q.label}</b><small>${q.sub}</small></button>`).join("")}
  </div>
  <button class="btn ghost" data-action="ext-open">➕ J'ai fait du sport ailleurs</button>`;
}

function bar(label, v, goal, unit = "") {
  const pct = goal ? Math.min(100, (v / goal) * 100) : 100;
  return `<div class="goalbar ${v >= goal ? "met" : ""}"><div><span>${label}</span><b>${v}${unit} / ${goal}${unit}${v >= goal ? " ✓" : ""}</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
}

function viewRoutine() {
  const r = S.profile.routine;
  if (!r) {
    return `
    <header class="top"><div><h1>Ta routine</h1><p class="sub">De 2 minutes à une vraie pratique du sport.</p></div></header>
    <section class="card">
      <p>Buzz te fait avancer par <b>5 paliers</b>. On monte quand l'objectif tient 2 semaines. On n'est jamais puni : une semaine ratée ne retire rien.</p>
      <button class="btn primary big" data-action="r-start">Commencer au palier 1</button>
      <button class="btn ghost" data-action="quiz-open">Régler avec le questionnaire</button>
    </section>
    ${stagesList(0)}`;
  }
  const ev = evaluate(r, S.logs), st = ev.stage, w = ev.week, days = weekDays(S.logs);
  return `
  <header class="top"><div><h1>Ta routine</h1><p class="sub">Palier ${st.n} sur ${STAGES.length} · ${st.name}</p></div></header>

  ${ev.canUp ? `<section class="card nudge">
    <p><b>Tu as tenu ton objectif ${ev.okCount} semaines.</b> On passe au palier ${st.n + 1}, ${STAGES[st.n].name} ? ${esc(STAGES[st.n].goal)}</p>
    <div class="row2"><button class="btn primary" data-action="r-up">On monte</button><button class="btn ghost" data-action="r-snooze">Je reste ici</button></div>
  </section>` : ""}
  ${ev.canDown ? `<section class="card nudge soft">
    <p><b>Ces deux dernières semaines ont été plus dures.</b> C'est normal, ça arrive. On allège au palier ${st.n - 1} sans rien perdre de ton miel ni de tes badges ?</p>
    <div class="row2"><button class="btn primary" data-action="r-down">On allège</button><button class="btn ghost" data-action="r-snooze">Je garde</button></div>
  </section>` : ""}

  <section class="card">
    <h2>Cette semaine</h2>
    <p class="sub">${esc(st.goal)}</p>
    ${bar("Jours actifs", w.days, st.days)}
    ${st.min ? bar("Minutes", w.minutes, st.min, " min") : ""}
    ${st.long ? bar(`Séances de ${st.longMin} min ou plus`, w.long, st.long) : ""}
    <div class="week">${days.map((d) => `<div class="day ${d.on ? "on" : ""} ${d.today ? "today" : ""}"><i>${d.on ? "🍯" : ""}</i><small>${d.label}</small></div>`).join("")}</div>
    <p class="sub">${w.days >= st.days && w.minutes >= st.min && w.long >= st.long
      ? "Objectif tenu cette semaine. Tout ce qui vient en plus est du bonus."
      : `Semaines réussies à ce palier : ${ev.okCount}/${UP_AFTER} pour proposer le suivant.`}</p>
  </section>

  <section class="card">
    <h2>Ton plan</h2>
    <p class="plan">« ${esc(planText(r))} »</p>
    <div class="field">Ton moment
      <div class="chips">${Object.entries(ANCHORS).map(([k, a]) => `<button class="chip sm ${r.anchor === k ? "on" : ""}" data-action="r-anchor" data-v="${k}" aria-pressed="${r.anchor === k}">${a.label}</button>`).join("")}</div>
    </div>
    <div class="field">Tes jours <span>(${r.days.length} choisis, objectif ${st.days})</span>
      <div class="days">${DAY_LABELS.map((l, k) => `<button class="opt ${r.days.includes(k) ? "on" : ""}" data-action="r-day" data-v="${k}" aria-pressed="${r.days.includes(k)}" aria-label="${["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][k]}"><b>${l}</b></button>`).join("")}</div>
    </div>
    <label class="field">Heure du rappel
      <input id="r-time" type="time" value="${r.time || ""}" /></label>
    <button class="btn primary" data-action="r-ics" ${r.time && r.days.length ? "" : "disabled"}>📅 Ajouter le rappel à mon calendrier</button>
    <p class="fine">Un rappel dans ton calendrier est un repère extérieur : il fait le travail de mémoire à ta place. Si tu changes ton plan, ajoute-le à nouveau et supprime l'ancien.</p>
  </section>

  <button class="btn ghost big" data-action="ext-open">➕ J'ai fait du sport ailleurs</button>

  ${stagesList(st.n)}

  <section class="card about">
    <h2>Comment ça marche</h2>
    <ul>
      <li><b>Une habitude se construit en semaines,</b> souvent deux mois, parfois bien plus. C'est normal que ce soit long.</li>
      <li><b>Rater un jour ne change presque rien.</b> Ce qui compte, c'est de ne pas laisser filer des semaines entières.</li>
      <li><b>Accrocher le mouvement à un moment qui existe déjà</b> (« après mon café… ») aide à passer à l'acte sans y penser.</li>
      <li><b>Le sport hors de l'appli compte.</b> Le but final, c'est une pratique à toi : course, salle, vélo, sport co…</li>
    </ul>
  </section>`;
}

function stagesList(current) {
  return `<section class="card"><h2>Le chemin</h2><ol class="stages">${STAGES.map((s) => `
    <li class="${s.n < current ? "past" : s.n === current ? "cur" : ""}">
      <span class="sn">${s.n < current ? "✓" : s.n}</span>
      <div><b>${s.name}</b><small>${esc(s.goal)}</small>${s.n === current ? `<small class="why">${esc(s.why)}</small>` : ""}</div>
    </li>`).join("")}</ol></section>`;
}

function viewExt() {
  const x = ui.ext;
  return `
  <main class="page quiz">
    <div class="p-top"><button class="icon" data-action="ext-cancel" aria-label="Retour">←</button></div>
    <h1>Du sport ailleurs</h1>
    <p class="sub">Ça compte dans ta semaine, comme une séance Buzz.</p>
    <section class="card">
      <h2>Quoi ?</h2>
      <div class="chips">${EXT.map(([k, e, l]) => `<button class="chip ${x.act === k ? "on" : ""}" data-action="ext-act" data-v="${k}" aria-pressed="${x.act === k}"><span aria-hidden="true">${e}</span> ${l}</button>`).join("")}</div>
    </section>
    <section class="card">
      <h2>Combien de temps ?</h2>
      <div class="chips">${EXT_MIN.map((m) => `<button class="chip ${x.min === m ? "on" : ""}" data-action="ext-min" data-v="${m}" aria-pressed="${x.min === m}">${m < 60 ? m + " min" : m / 60 + " h" + (m % 60 ? " 30" : "")}</button>`).join("")}</div>
    </section>
    <section class="card">
      <h2>Ton énergie maintenant ? <small>facultatif</small></h2>
      <div class="row5">${ENERGY.map((e) => `
        <button class="opt ${x.after === e.v ? "on" : ""}" data-action="ext-after" data-v="${e.v}" aria-pressed="${x.after === e.v}">
          <span class="em" aria-hidden="true">${e.emoji}</span><small>${e.label}</small></button>`).join("")}
      </div>
    </section>
    <button class="btn primary big" data-action="ext-save" ${x.act && x.min ? "" : "disabled"}>Ajouter à ma semaine</button>
  </main>`;
}

function viewPlayer() {
  return `
  <main class="player">
    <div class="p-top">
      <button class="icon" data-action="p-quit" aria-label="Arrêter la séance">✕</button>
      <div class="segs" id="p-segs"></div>
      <div class="p-count" id="p-count"></div>
    </div>
    <div class="p-main">
      <div class="p-phase" id="p-phase"></div>
      <div class="ring">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle class="track" cx="100" cy="100" r="88" />
          <circle class="prog" id="p-ring" cx="100" cy="100" r="88" transform="rotate(-90 100 100)" />
        </svg>
        <div class="ring-in"><div class="p-emoji" id="p-emoji" aria-hidden="true"></div><div class="p-time" id="p-time"></div></div>
      </div>
      <h1 class="p-name" id="p-name" aria-live="polite"></h1>
      <p class="p-cue" id="p-cue"></p>
      <p class="p-next" id="p-next"></p>
    </div>
    <div class="p-ctrl">
      <button class="btn ghost" data-action="p-swap">🔄 Changer</button>
      <button class="btn primary" data-action="p-pause" id="p-pause">Pause</button>
      <button class="btn ghost" data-action="p-skip">Passer ⏭</button>
    </div>
  </main>`;
}

function viewDone() {
  const { r, log, newBadges, completed, session, newCells } = ui.result;
  const delta = log.energyAfter && log.energyBefore ? log.energyAfter - log.energyBefore : null;
  const ev = evaluate(S.profile.routine, S.logs);
  return `
  <main class="page done">
    <div class="done-emoji" aria-hidden="true">${completed ? "🎉" : "👍"}</div>
    <h1>${completed ? "Bien joué" : "Ça compte quand même"}</h1>
    <p class="sub">${fmtDur(log.sec)} · ${session.title}</p>

    <section class="card honey-card">
      <div class="big-honey">+${r.total} 🍯</div>
      <ul class="lines">${r.lines.map((l) => `<li class="${l.surprise ? "surprise" : ""}"><span>${l.surprise ? "✨ " : ""}${l.label}</span><b>+${l.v}</b></li>`).join("")}</ul>
      ${newCells > 0 ? `<p class="cells">${newCells} nouvelle${newCells > 1 ? "s" : ""} alvéole${newCells > 1 ? "s" : ""} dans ta ruche</p>` : ""}
      ${ev ? `<p class="cells">Routine : ${ev.week.days}/${ev.stage.days} jours cette semaine${ev.stage.min ? ` · ${ev.week.minutes}/${ev.stage.min} min` : ""}</p>` : ""}
    </section>

    ${newBadges.length ? `<section class="card newbadges">${newBadges.map((b) => `
      <div class="nb"><span class="em" aria-hidden="true">${b.emoji}</span><div><b>Badge : ${b.name}</b><small>${b.desc}</small></div></div>`).join("")}</section>` : ""}

    <section class="card">
      <h2>Ton énergie maintenant ?</h2>
      <div class="row5">${ENERGY.map((e) => `
        <button class="opt ${log.energyAfter === e.v ? "on" : ""}" data-action="after" data-v="${e.v}" aria-pressed="${log.energyAfter === e.v}">
          <span class="em" aria-hidden="true">${e.emoji}</span><small>${e.label}</small></button>`).join("")}
      </div>
      ${delta === null ? "" : delta > 0
        ? `<p class="note good">Avant : ${log.energyBefore}/5 → maintenant : ${log.energyAfter}/5. C'est ton corps qui vient de produire ça.</p>`
        : `<p class="note">Noté. Ça m'aide à mieux viser la prochaine fois.</p>`}
    </section>

    <section class="card">
      <h2>C'était…</h2>
      <div class="seg3">${[["facile", "Trop facile"], ["bien", "Pile bien"], ["dur", "Trop dur"]].map(([v, label]) => `
        <button class="opt ${log.feel === v ? "on" : ""}" data-action="feel" data-v="${v}" aria-pressed="${log.feel === v}"><b>${label}</b></button>`).join("")}
      </div>
    </section>

    <p class="tip">💧 Bois un verre d'eau maintenant.</p>
    ${session.stateId ? `<button class="btn ghost big" data-action="more">Encore 3 min</button>` : ""}
    <button class="btn primary big" data-action="finish">Terminé</button>
  </main>`;
}

function viewHive() {
  const h = hive(S.honey);
  const minutes = Math.round(S.logs.reduce((a, l) => a + l.sec, 0) / 60);
  const ins = insights(S.logs);
  const met = energyInsights(S.logs, S.checks);
  const hist = S.logs.slice(-5).reverse();
  return `
  <header class="top"><div><h1>Ta ruche</h1><p class="sub">Rayon ${h.comb} · ${h.filled}/${CELLS_PER_COMB} alvéoles</p></div>
    <span class="pill">🍯 ${S.honey}</span></header>

  <section class="card hive-card">
    ${hexGrid(h.filled)}
    <div class="bar" role="img" aria-label="Encore ${h.toNext} miel avant la prochaine alvéole"><i style="width:${((HONEY_PER_CELL - h.toNext) / HONEY_PER_CELL) * 100}%"></i></div>
    <p class="sub center">Encore ${h.toNext} 🍯 pour la prochaine alvéole. Rien ne se vide, jamais.</p>
  </section>

  <div class="stats">
    <div class="stat"><b>${S.logs.length}</b><small>séance${S.logs.length > 1 ? "s" : ""}</small></div>
    <div class="stat"><b>${minutes}</b><small>min bougées</small></div>
    <div class="stat"><b>${Object.keys(S.badges).length}</b><small>badge${Object.keys(S.badges).length > 1 ? "s" : ""}</small></div>
  </div>

  <section class="card">
    <h2>Ta météo intérieure</h2>
    ${met.slots ? `
      <div class="slots">${met.slots.map((s) => `<div class="slot ${met.best?.k === s.k ? "best" : ""}"><div class="vbar"><i style="height:${s.a ? (s.a / 5) * 100 : 0}%"></i></div><b>${s.a ? num(s.a) : "–"}</b><small>${SLOT_LABEL[s.k]}</small></div>`).join("")}</div>
      <p class="sub">${met.best ? `Ton énergie est souvent meilleure <b>${SLOT_LABEL[met.best.k]}</b> : bon créneau pour tes séances plus longues.` : "Pas encore de moment qui se détache. Continue de noter."} <small>(${met.count} relevés)</small></p>
      ${met.swings >= 2 ? `<p class="note">Montagnes russes repérées : ${met.swings} fois, un jour à fond a été suivi d'un jour à plat dans les 48 h. Les jours à fond, garde de la marge.</p>` : ""}`
      : `<p class="sub">Note ton énergie quelques fois (avant une séance, ou avec « Juste noter mon état ») et je te montre tes moments forts de la journée. ${met.count}/5 relevés.</p>`}
  </section>

  <section class="card">
    <h2>Ce que ton corps t'apprend</h2>
    ${ins ? `
      <p class="insight"><b>${ins.delta >= 0 ? "+" : ""}${num(ins.delta)}</b> point d'énergie en moyenne après avoir bougé <small>(${ins.count} séances notées)</small></p>
      ${ins.best ? `<p class="sub">Ce qui te réussit le mieux : <b>${esc(ins.best.title)}</b> (+${num(ins.best.delta)}).</p>` : ""}`
      : `<p class="sub">Note ton énergie après 2 séances et je te montre ce que le mouvement change vraiment chez toi.</p>`}
  </section>

  <section class="card">
    <h2>Badges <small>${Object.keys(S.badges).length}/${BADGES.length}</small></h2>
    <div class="badges">${BADGES.map((b) => `
      <div class="badge ${S.badges[b.id] ? "on" : ""}"><span class="em" aria-hidden="true">${S.badges[b.id] ? b.emoji : "🔒"}</span><b>${b.name}</b><small>${b.desc}</small></div>`).join("")}
    </div>
  </section>

  ${hist.length ? `<section class="card"><h2>Dernières séances</h2><ul class="hist">${hist.map((l) => `
    <li><span>${esc(l.title)}<small>${new Date(l.t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · ${fmtDur(l.sec)}</small></span><b>+${l.honey} 🍯</b></li>`).join("")}</ul></section>` : ""}`;
}

function viewSettings() {
  const p = S.profile;
  const sw = (key, label, sub) => `
    <button class="switch" role="switch" aria-checked="${p[key]}" data-action="toggle" data-v="${key}">
      <span><b>${label}</b><small>${sub}</small></span><i></i></button>`;
  const lines = adaptations(p), T = traitsOf(p);
  const often = TRAITS.filter((t) => T[t.id] >= 1);
  return `
  <header class="top"><div><h1>Réglages</h1><p class="sub">Tout est modifiable, rien n'est obligatoire.</p></div></header>

  <section class="card">
    <label class="field">Ton prénom
      <input id="set-name" type="text" maxlength="24" autocomplete="given-name" value="${esc(p.name)}" /></label>
    <div class="field">Niveau des séances
      <div class="seg3">${LEVELS.map((l) => `
        <button class="opt ${p.level === l.v ? "on" : ""}" data-action="level" data-v="${l.v}" aria-pressed="${p.level === l.v}"><b>${l.label}</b><small>${l.sub}</small></button>`).join("")}
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Ton fonctionnement</h2>
    ${often.length ? `<ul class="traits-sum">${often.map((t) => `<li><span>${t.label}</span><b>${T[t.id] === 2 ? "Souvent" : "Ça dépend"}</b></li>`).join("")}</ul>` : ""}
    ${lines.length ? `<p class="sub">Ce que ça change :</p><ul class="adapt">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="sub">Réglages standards. Le questionnaire (2 min) adapte les séances à ton fonctionnement.</p>`}
    <button class="btn ghost" data-action="quiz-open">${p.q?.done ? "Refaire le questionnaire" : "Répondre au questionnaire"}</button>
  </section>

  <section class="card switches">
    ${sw("ai", "Coach IA", "Les mots que tu écris au coach sont envoyés à Claude (Anthropic) pour composer la séance. Désactivé : rien ne quitte l'appareil.")}
    ${sw("voice", "Voix", "Annonce chaque exercice : pas besoin de regarder l'écran")}
    ${sw("sound", "Bips", "3, 2, 1 avant chaque changement")}
    ${sw("calm", "Mode calme", "Sans confettis ni vibrations")}
    ${sw("quiet", "Mode discret", "Sans sauts : bureau, voisins, nuit")}
    ${sw("noFloor", "Sans passage au sol", "Tout se fait debout")}
  </section>

  <section class="card about">
    <h2>Pourquoi Buzz est fait comme ça</h2>
    <ul>
      <li><b>Démarrer est le plus dur.</b> Donc 2 taps, aucune planification, et une option « juste 2 min ».</li>
      <li><b>L'énergie change tout le temps.</b> Donc la séance se construit sur ton état du moment, pas sur un programme.</li>
      <li><b>Le fonctionnement aussi change.</b> Beaucoup de personnes TDAH fluctuent, et TDAH et autisme vont souvent ensemble. Donc pas de case unique : des traits en « ça dépend », et un choix chaque jour entre repères et nouveauté.</li>
      <li><b>Le temps est flou.</b> Donc il est toujours visible : anneau, durée restante, durée totale annoncée.</li>
      <li><b>Les séries cassées font abandonner.</b> Donc rien ne se remet à zéro, et la routine avance par paliers, jamais par punition.</li>
    </ul>
    <p class="fine">Buzz n'est pas un dispositif médical et ne pose pas de diagnostic. Si tu te poses des questions sur un TDAH ou un TSA, un médecin (généraliste, psychiatre) peut t'orienter vers une évaluation. Ton historique reste sur cet appareil ; seul ce que tu écris au coach IA est envoyé pour composer la séance.</p>
  </section>

  <button class="btn danger" data-action="reset">Effacer toutes mes données</button>`;
}

// ── Petits dessins ──────────────────────────────────────────────
function hexPts(cx, cy, r) {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k + 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function hexGrid(filled) {
  const size = 24, cells = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) cells.push({ q, r, d: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) });
  cells.sort((a, b) => a.d - b.d || Math.atan2(a.r, a.q) - Math.atan2(b.r, b.q));
  return `<svg class="hex" viewBox="-115 -100 230 200" role="img" aria-label="${filled} alvéoles remplies sur ${CELLS_PER_COMB}">${cells.map((c, i) => {
    const x = size * Math.sqrt(3) * (c.q + c.r / 2), y = size * 1.5 * c.r;
    return `<polygon class="${i < filled ? "full" : ""}" points="${hexPts(x, y, size - 2.5)}" />`;
  }).join("")}</svg>`;
}

function logoSvg() {
  return `<svg viewBox="0 0 100 100"><polygon points="50,6 88,28 88,72 50,94 12,72 12,28" fill="var(--honey)"/><path d="M34 60 L46 36 L54 56 L66 32" fill="none" stroke="var(--ink-fixed)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ── Lecteur de séance ───────────────────────────────────────────
function startPlayer(session) {
  P = {
    session, steps: session.steps.map((s) => ({ ...s })),
    i: 0, phase: "ready", ready: session.ready || READY_SEC, left: session.ready || READY_SEC, paused: false, done: 0,
    last: performance.now(), lastWhole: null, timer: null,
  };
  ui.screen = "player";
  render();
  fx.keepAwake(true);
  announce();
  P.timer = setInterval(tick, 100);
  window.scrollTo(0, 0);
}

function announce() {
  if (S.profile.voice) fx.speak(P.steps[P.i].ex.name);
}

function tick() {
  const now = performance.now(), dt = (now - P.last) / 1000;
  P.last = now;
  if (P.paused) return;
  P.left -= dt;
  if (P.phase === "work") P.done += dt;
  const whole = Math.ceil(P.left);
  if (whole !== P.lastWhole) {
    P.lastWhole = whole;
    if (S.profile.sound && whole > 0 && whole <= 3) fx.beep(P.phase === "ready" ? 520 : 660, 0.1);
  }
  if (P.left <= 0) return advance();
  paintTime();
}

function advance() {
  if (P.phase === "ready") {
    P.phase = "work";
    P.left = P.steps[P.i].sec;
    if (S.profile.sound) fx.beep(880, 0.3);
    vib(60);
    paintStep();
  } else nextStep();
}

function nextStep() {
  if (P.i + 1 >= P.steps.length) return finish(true);
  P.i++;
  P.phase = "ready";
  P.left = P.ready;
  vib([40, 60, 40]);
  announce();
  paintStep();
}

function paintStep() {
  const st = P.steps[P.i], next = P.steps[P.i + 1], $ = (id) => document.getElementById(id);
  $("p-segs").innerHTML = P.steps.map((_, k) => `<i class="${k < P.i ? "past" : k === P.i ? "cur" : ""}"></i>`).join("");
  $("p-count").textContent = `${P.i + 1}/${P.steps.length}`;
  $("p-phase").textContent = P.phase === "ready" ? "Prépare-toi" : "Vas-y";
  $("p-emoji").textContent = st.ex.emoji;
  $("p-name").textContent = st.ex.name;
  $("p-cue").textContent = st.ex.cue;
  $("p-next").textContent = next ? `Ensuite : ${next.ex.name}` : "Dernier exercice";
  document.querySelector(".player").dataset.phase = P.phase;
  paintTime();
}

function paintTime() {
  const st = P.steps[P.i], full = P.phase === "ready" ? P.ready : st.sec;
  const C = 2 * Math.PI * 88, ring = document.getElementById("p-ring");
  if (!ring) return;
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C * (1 - Math.max(0, P.left) / full);
  document.getElementById("p-time").textContent = P.phase === "ready" ? Math.max(1, Math.ceil(P.left)) : fmtClock(P.left);
  // Temps total restant : toujours visible, pour ne pas avoir à le deviner.
  let rest = Math.max(0, P.left) + (P.phase === "ready" ? st.sec : 0);
  for (let k = P.i + 1; k < P.steps.length; k++) rest += P.steps[k].sec + P.ready;
  const next = P.steps[P.i + 1];
  document.getElementById("p-next").textContent = `${next ? `Ensuite : ${next.ex.name}` : "Dernier exercice"} · reste ${fmtClock(rest)}`;
}

function finish(completed) {
  clearInterval(P.timer);
  fx.keepAwake(false);
  fx.hush();
  const sec = Math.round(P.done), session = P.session;
  const exIds = P.steps.slice(0, P.i + 1).map((s) => s.ex.id);
  // "Terminée" = au moins la moitié du temps prévu réellement bougé (passer tous les exercices ne suffit pas).
  completed = completed && sec >= 0.5 * P.steps.reduce((a, s) => a + s.sec, 0);
  P = null;
  if (!completed && sec < 10) {
    ui.screen = "main";
    render();
    return toast("Pas grave. Reviens quand tu veux.");
  }
  const { log, r, newBadges, newCells } = addLog({ kind: session.kind, stateId: session.stateId, title: session.title, sec, completed, energyBefore: session.energy, exIds, ai: !!session.ai });
  ui.result = { r, log, newBadges, completed, session, newCells };
  ui.screen = "done";
  render();
  window.scrollTo(0, 0);
  if (!S.profile.calm) fx.confetti(document.body);
  if (S.profile.sound) fx.chime();
  vib([60, 40, 120]);
}

// Une entrée d'historique (séance Buzz ou sport ailleurs) : miel, badges, sauvegarde.
function addLog(entry, rewardSec = entry.sec) {
  const now = Date.now(), last = S.logs.at(-1);
  const comeback = !!last && now - last.t >= 3 * DAY;
  const firstToday = !S.logs.some((l) => new Date(l.t).toDateString() === new Date(now).toDateString());
  const r = reward({ sec: rewardSec, completed: entry.completed, comeback, firstToday });
  const log = { t: now, energyAfter: null, feel: null, exIds: [], ...entry, honey: r.total, comeback };
  const cellsBefore = Math.floor(S.honey / HONEY_PER_CELL);
  S.honey += r.total;
  S.logs.push(log);
  const newBadges = grantBadges();
  persist();
  return { log, r, newBadges, newCells: Math.floor(S.honey / HONEY_PER_CELL) - cellsBefore };
}

function grantBadges() {
  const now = Date.now();
  const got = BADGES.filter((b) => !S.badges[b.id] && b.test(S));
  got.forEach((b) => (S.badges[b.id] = now));
  return got;
}

// ── Actions ─────────────────────────────────────────────────────
function propose(minutes) {
  if (!ui.energy || !ui.mood) return;
  ui.session = buildSession({ energy: ui.energy, stateId: ui.mood, level: S.profile.level, minutes, opts: opts(), recent: recent(), previous: previousFor(ui.mood) });
}

function showProp() {
  render();
  document.getElementById("prop")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function setStage(n) {
  const r = S.profile.routine;
  r.stage = n;
  r.stageSince = Date.now();
  const target = stageOf(r).days;
  if (r.days.length < target) r.days = [...new Set([...r.days, ...[0, 2, 4, 1, 3, 5, 6]])].slice(0, target).sort((a, b) => a - b);
  const got = grantBadges();
  persist();
  render();
  window.scrollTo(0, 0);
  if (got.length) toast(`Badge : ${got.map((b) => b.name).join(", ")}`);
}

const actions = {
  "ob-skip": () => { S.profile.onboarded = true; persist(); ui.screen = "main"; render(); },
  "quiz-open": () => { Object.assign(ui, { screen: "quiz", quiz: draftFrom(S.profile), quizStep: 0 }); render(); window.scrollTo(0, 0); },
  "quiz-later": () => { S.profile.quizLater2 = true; persist(); render(); },
  "q-back": () => {
    if (ui.quizStep > 0) ui.quizStep--;
    else ui.screen = S.profile.onboarded ? "main" : "onboard"; // rien n'est enregistré avant la fin
    render();
  },
  "q-next": () => {
    if (QUIZ[ui.quizStep]?.id === "labels") prefill(ui.quiz);
    ui.quizStep++;
    render();
    window.scrollTo(0, 0);
  },
  "q-pick": (v) => {
    const q = QUIZ[ui.quizStep], a = ui.quiz;
    if (q.kind === "multi") {
      a[q.id] = a[q.id].includes(v) ? a[q.id].filter((x) => x !== v) : [...a[q.id], v];
      return render();
    }
    a[q.id] = q.id === "level" ? +v : v;
    ui.quizStep++; // un seul choix : on avance tout seul, un tap de moins
    render();
    window.scrollTo(0, 0);
  },
  "q-scale": (v) => {
    const [id, val] = v.split(":"), t = ui.quiz.traits;
    t[id] = t[id] === +val ? null : +val; // re-taper efface
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  },
  "q-done": () => {
    applyQuiz(S.profile, ui.quiz);
    S.profile.onboarded = true;
    grantBadges();
    persist();
    Object.assign(ui, { screen: "main", tab: "home", quiz: null, modeToday: null });
    if (ui.session && !ui.session.ai) propose();
    render();
    window.scrollTo(0, 0);
  },
  tab: (v) => { ui.tab = v; render(); window.scrollTo(0, 0); },
  energy: (v) => { ui.energy = +v; ui.inferred = false; propose(); showProp(); },
  mood: (v) => { ui.mood = v; ui.inferred = false; propose(); showProp(); },
  reroll: () => { propose(); showProp(); },
  mode: (v) => {
    ui.modeToday = ui.modeToday === v ? null : v;
    propose();
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  },
  "note-check": () => {
    S.checks.push({ t: Date.now(), energy: ui.energy, mood: ui.mood });
    persist();
    Object.assign(ui, { energy: null, mood: null, session: null });
    render();
    toast("Noté. Ça nourrit ta météo intérieure.");
  },
  coach: async () => {
    const text = ui.coachText.trim();
    if (ui.coachBusy) return;
    if (text.length < 3) return toast("Écris quelques mots, même en vrac.");
    ui.coachBusy = true;
    render();
    let s = null;
    if (S.profile.ai) {
      try {
        const now = Date.now(), t = tune();
        s = sessionFromCoach(await askCoach({
          text, energy: ui.inferred ? null : ui.energy, mood: ui.inferred ? null : ui.mood, level: S.profile.level,
          quiet: S.profile.quiet, noFloor: S.profile.noFloor, simple: t.simple, prefs: prefsFor(t, mode()), hour: new Date().getHours(),
          history: S.logs.slice(-8).map((l) => ({ title: l.title, min: Math.round(l.sec / 60), energyBefore: l.energyBefore, energyAfter: l.energyAfter, feel: l.feel, daysAgo: Math.floor((now - l.t) / DAY) })),
        }), t.ready);
      } catch { /* hors ligne, serveur absent ou refus : on passe aux règles locales */ }
    }
    if (!s) {
      const g = guessFromText(text);
      const mine = !ui.inferred; // ce que la personne a coché elle-même passe avant la devinette
      const stateId = (mine && ui.mood) || g.stateId;
      s = buildSession({ energy: (mine && ui.energy) || g.energy, stateId, level: S.profile.level, minutes: g.minutes, opts: opts(), recent: recent(), previous: previousFor(stateId) });
      if (S.profile.ai) toast("Coach IA injoignable : séance préparée sans lui.");
    }
    ui.coachBusy = false;
    if (ui.screen !== "main") return; // la personne est déjà partie bouger : on ne touche à rien
    Object.assign(ui, { energy: s.energy, mood: s.stateId, session: s, inferred: true });
    if (ui.tab === "home") showProp(); else render();
  },
  go: () => startPlayer(ui.session),
  short: () => { propose(2); startPlayer(ui.session); },
  quick: (v) => startPlayer(quickSession(QUICK.find((q) => q.id === v), S.profile.level, opts(), recent())),
  "p-pause": () => {
    P.paused = !P.paused;
    document.getElementById("p-pause").textContent = P.paused ? "Reprendre" : "Pause";
    document.querySelector(".player").classList.toggle("paused", P.paused);
  },
  "p-skip": () => nextStep(),
  "p-swap": () => {
    const e = swapStep(P.steps, P.i, P.session.cap, opts());
    if (!e) return toast("Pas d'autre option pour celui-ci.");
    P.steps[P.i] = { ...P.steps[P.i], ex: e };
    P.phase = "ready";
    P.left = P.ready;
    announce();
    paintStep();
  },
  "p-quit": () => finish(false),
  after: (v) => {
    const { log } = ui.result;
    log.energyAfter = +v;
    ui.result.newBadges.push(...grantBadges());
    persist();
    render();
  },
  feel: (v) => {
    const { log } = ui.result, p = S.profile, prev = log.feel;
    log.feel = v;
    if (prev !== v) {
      if (v === "dur" && p.level > 1) { p.level--; toast("Noté. La prochaine sera plus douce."); }
      if (v === "facile" && p.level < 3) { p.level++; toast("Noté. La prochaine montera d'un cran."); }
    }
    persist();
    render();
  },
  more: () => {
    const s = ui.result.session;
    startPlayer(buildSession({ energy: s.energy, stateId: s.stateId, level: S.profile.level, minutes: 3, opts: opts(), recent: recent() }));
  },
  finish: () => {
    Object.assign(ui, { screen: "main", tab: S.profile.routine ? "routine" : "hive", energy: null, mood: null, session: null, result: null, modeToday: null });
    render();
    window.scrollTo(0, 0);
  },
  // Routine
  "r-start": () => { S.profile.routine = newRoutine("bouger", S.profile.level, "libre"); persist(); render(); },
  "r-up": () => setStage(S.profile.routine.stage + 1),
  "r-down": () => setStage(S.profile.routine.stage - 1),
  "r-snooze": () => { S.profile.routine.snooze = weekStart(Date.now()); persist(); render(); },
  "r-anchor": (v) => { const r = S.profile.routine; r.anchor = v; r.time = ANCHORS[v].time ?? r.time; persist(); render(); },
  "r-day": (v) => {
    const r = S.profile.routine, d = +v;
    r.days = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort((a, b) => a - b);
    persist();
    render();
  },
  "r-ics": () => {
    const r = S.profile.routine;
    if (!r.time || !r.days.length) return;
    const url = location.origin + location.pathname;
    const blob = new Blob([icsFor(r, url)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "buzz-routine.ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("Ouvre le fichier pour l'ajouter à ton calendrier.");
  },
  // Sport ailleurs
  "ext-open": () => { Object.assign(ui, { screen: "ext", ext: { act: null, min: null, after: null }, from: ui.tab }); render(); window.scrollTo(0, 0); },
  "ext-cancel": () => { ui.screen = "main"; render(); },
  "ext-act": (v) => { ui.ext.act = v; render(); },
  "ext-min": (v) => { ui.ext.min = +v; render(); },
  "ext-after": (v) => { ui.ext.after = ui.ext.after === +v ? null : +v; render(); },
  "ext-save": () => {
    const x = ui.ext, [, emoji, label] = EXT.find(([k]) => k === x.act);
    const { r, newBadges } = addLog({ kind: "ext", stateId: null, title: `${emoji} ${label}`, sec: x.min * 60, completed: true, energyBefore: null, energyAfter: x.after }, Math.min(x.min, 45) * 60);
    Object.assign(ui, { screen: "main", tab: S.profile.routine ? "routine" : "hive", ext: null });
    render();
    window.scrollTo(0, 0);
    toast(`+${r.total} 🍯, ajouté à ta semaine${newBadges.length ? ` · Badge : ${newBadges.map((b) => b.name).join(", ")}` : ""}`);
    if (!S.profile.calm) fx.confetti(document.body);
  },
  level: (v) => { S.profile.level = +v; persist(); if (ui.session && !ui.session.ai) propose(); render(); },
  toggle: (v) => { S.profile[v] = !S.profile[v]; persist(); if (ui.session && !ui.session.ai) propose(); render(); },
  reset: () => {
    if (!confirm("Effacer ton miel, tes badges, ta routine et ton historique ? C'est définitif.")) return;
    S = store.reset();
    Object.assign(ui, { screen: "onboard", tab: "home", energy: null, mood: null, session: null, result: null, quiz: null, quizStep: 0, modeToday: null });
    render();
  },
};

root.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b && !b.disabled) actions[b.dataset.action]?.(b.dataset.v);
});

root.addEventListener("input", (e) => {
  if (e.target.id === "q-name") ui.quiz.name = e.target.value;
  if (e.target.id === "coach-text") ui.coachText = e.target.value;
  if (e.target.id === "set-name") { S.profile.name = e.target.value.trim(); persist(); }
});

root.addEventListener("change", (e) => {
  if (e.target.id === "r-time") { S.profile.routine.time = e.target.value || null; persist(); render(); }
});

// Écran verrouillé ou onglet caché pendant une séance : on met en pause plutôt que de laisser filer le temps.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && P && !P.paused) actions["p-pause"]();
  if (P) P.last = performance.now();
});

render();
