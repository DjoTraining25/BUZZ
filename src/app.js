// ════════════════════════════════════════════════════════════════
//  BUZZ — interface
//  Règles de conception TDAH appliquées partout :
//   · une seule action principale par écran, 2 taps pour démarrer
//   · le temps est toujours visible (anneau, total restant)
//   · une consigne à la fois, dite à voix haute
//   · tout effort compte, rien ne se remet jamais à zéro
// ════════════════════════════════════════════════════════════════
import { STATES, ENERGY, QUICK, LEVELS, BADGES } from "./data.js";
import { buildSession, quickSession, swapStep, reward, hive, insights, weekDays, fmtDur, fmtClock, READY_SEC, CELLS_PER_COMB, HONEY_PER_CELL } from "./engine.js";
import { askCoach, sessionFromCoach, guessFromText } from "./coach.js";
import { QUIZ, draftFrom, applyQuiz, tuneFor, prefsFor, adaptations } from "./profile.js";
import * as store from "./store.js";
import * as fx from "./fx.js";

const root = document.getElementById("root");
let S = store.load();
const ui = {
  screen: S.profile.onboarded ? "main" : "onboard",
  tab: "home", energy: null, mood: null, session: null, result: null,
  quiz: null, quizStep: 0, coachText: "", coachBusy: false,
};
let P = null; // lecteur de séance en cours

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tune = () => tuneFor(S.profile);
const opts = () => ({ quiet: S.profile.quiet, noFloor: S.profile.noFloor, ...tune() });
const vib = (pattern) => { if (!S.profile.calm) vib(pattern); };
const recent = () => S.logs.slice(-3).flatMap((l) => l.exIds || []);
const persist = () => store.save(S);
const DAY = 864e5;

function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ── Rendu ───────────────────────────────────────────────────────
function render() {
  const views = { onboard: viewOnboard, quiz: viewQuiz, player: viewPlayer, done: viewDone, main: viewMain };
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
      <li><b>Jamais de série à perdre.</b> Ce que tu as gagné reste gagné.</li>
      <li><b>2 minutes comptent.</b> Vraiment.</li>
    </ul>
    <button class="btn primary big" data-action="quiz-open">Régler Buzz pour moi <small>6 questions, 1 min</small></button>
    <button class="btn ghost" data-action="ob-skip">Passer, je verrai plus tard</button>
    <p class="fine">Buzz n'est pas un dispositif médical et ne remplace ni un suivi, ni un traitement. En cas de douleur, on arrête.</p>
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
    const preview = applyQuiz({ ...S.profile }, a), lines = adaptations(preview);
    return `
    <main class="page quiz">${top}
      <h1>C'est réglé${a.name.trim() ? ", " + esc(a.name.trim()) : ""}</h1>
      <p class="sub">${lines.length ? "Voilà ce que tes réponses changent :" : "Réglages standards pour commencer. Buzz s'ajustera avec tes retours après chaque séance."}</p>
      ${lines.length ? `<ul class="adapt">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      <button class="btn primary big" data-action="q-done">C'est parti</button>
      <p class="fine">Tes réponses restent sur cet appareil. Tu peux refaire le questionnaire dans les Réglages.</p>
    </main>`;
  }

  const q = QUIZ[i];
  const picked = (v) => (q.kind === "multi" ? a[q.id].includes(v) : a[q.id] === v);
  return `
  <main class="page quiz">${top}
    <h1>${q.title}</h1>
    ${q.sub ? `<p class="sub">${q.sub}</p>` : ""}
    ${q.kind === "text"
      ? `<input id="q-name" class="q-input" type="text" autocomplete="given-name" maxlength="24" value="${esc(a.name)}" placeholder="Comme tu veux" aria-label="${q.title}" />`
      : `<div class="qopts">${q.options.map((o) => `
          <button class="qopt ${picked(o.v) ? "on" : ""}" data-action="q-pick" data-v="${o.v}" aria-pressed="${picked(o.v)}">
            <b>${o.label}</b><small>${o.sub}</small></button>`).join("")}</div>`}
    ${q.kind !== "one" ? `<button class="btn primary big" data-action="q-next">Continuer</button>` : ""}
  </main>`;
}

function viewMain() {
  const body = { home: viewHome, hive: viewHive, settings: viewSettings }[ui.tab]();
  const tabs = [["home", "🏃", "Bouger"], ["hive", "🍯", "Ruche"], ["settings", "⚙️", "Réglages"]];
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
  const s = ui.session, t = tune();
  const askQuiz = !S.profile.q?.done && !S.profile.quizLater;
  return `
  <header class="top">
    <div><h1>Salut${S.profile.name ? " " + esc(S.profile.name) : ""} 👋</h1><p class="sub">Deux taps, et je m'occupe du reste.</p></div>
    <button class="pill" data-action="tab" data-v="hive" aria-label="${S.honey} miel, voir la ruche">🍯 ${S.honey}</button>
  </header>
  ${back ? `<p class="banner">Content de te revoir. Aucun retard à rattraper : on reprend là, maintenant.</p>` : ""}

  ${askQuiz ? `<section class="card nudge">
    <p><b>Nouveau : règle Buzz sur ton fonctionnement.</b> 6 questions, 1 minute, et les séances s'adaptent à ton type de TDAH.</p>
    <div class="row2"><button class="btn primary" data-action="quiz-open">Répondre</button><button class="btn ghost" data-action="quiz-later">Plus tard</button></div>
  </section>` : ""}

  <section class="card">
    <h2><span class="num">1</span>Ton énergie, là, maintenant</h2>
    <div class="row5">${ENERGY.map((e) => `
      <button class="opt ${ui.energy === e.v ? "on" : ""}" data-action="energy" data-v="${e.v}" aria-pressed="${ui.energy === e.v}">
        <span class="em" aria-hidden="true">${e.emoji}</span><small>${e.label}</small></button>`).join("")}
    </div>
  </section>

  <section class="card">
    <h2><span class="num">2</span>Et dans ta tête ?</h2>
    <div class="chips">${STATES.map((m) => `
      <button class="chip ${ui.mood === m.id ? "on" : ""}" data-action="mood" data-v="${m.id}" aria-pressed="${ui.mood === m.id}">
        <span aria-hidden="true">${m.emoji}</span> ${m.label}</button>`).join("")}
    </div>
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
  </div>`;
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
  return `
  <main class="page done">
    <div class="done-emoji" aria-hidden="true">${completed ? "🎉" : "👍"}</div>
    <h1>${completed ? "Bien joué" : "Ça compte quand même"}</h1>
    <p class="sub">${fmtDur(log.sec)} · ${session.title}</p>

    <section class="card honey-card">
      <div class="big-honey">+${r.total} 🍯</div>
      <ul class="lines">${r.lines.map((l) => `<li class="${l.surprise ? "surprise" : ""}"><span>${l.surprise ? "✨ " : ""}${l.label}</span><b>+${l.v}</b></li>`).join("")}</ul>
      ${newCells > 0 ? `<p class="cells">${newCells} nouvelle${newCells > 1 ? "s" : ""} alvéole${newCells > 1 ? "s" : ""} dans ta ruche</p>` : ""}
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
  const days = weekDays(S.logs);
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
    <div class="stat"><b>${days.filter((d) => d.on).length}</b><small>jour${days.filter((d) => d.on).length > 1 ? "s" : ""} cette semaine</small></div>
  </div>

  <section class="card">
    <h2>Cette semaine</h2>
    <div class="week">${days.map((d) => `<div class="day ${d.on ? "on" : ""} ${d.today ? "today" : ""}"><i>${d.on ? "🍯" : ""}</i><small>${d.label}</small></div>`).join("")}</div>
    <p class="sub">Pas de série à tenir. Chaque jour bougé est un bonus.</p>
  </section>

  <section class="card">
    <h2>Ce que ton corps t'apprend</h2>
    ${ins ? `
      <p class="insight"><b>${ins.delta >= 0 ? "+" : ""}${ins.delta.toFixed(1).replace(".", ",")}</b> point d'énergie en moyenne après avoir bougé <small>(${ins.count} séances notées)</small></p>
      ${ins.best ? `<p class="sub">Ce qui te réussit le mieux : <b>${ins.best.title}</b> (+${ins.best.delta.toFixed(1).replace(".", ",")}).</p>` : ""}`
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
    <h2>Ton profil</h2>
    ${S.profile.q?.done
      ? (adaptations(S.profile).length ? `<ul class="adapt">${adaptations(S.profile).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="sub">Réglages standards.</p>`)
      : `<p class="sub">6 questions pour adapter les séances à ton type de TDAH et à ton fonctionnement.</p>`}
    <button class="btn ghost" data-action="quiz-open">${S.profile.q?.done ? "Refaire le questionnaire" : "Répondre au questionnaire"}</button>
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
      <li><b>Le temps est flou.</b> Donc il est toujours visible : anneau, durée restante, durée totale annoncée.</li>
      <li><b>La routine lasse vite.</b> Donc les exercices tournent, et tu peux en changer d'un tap.</li>
      <li><b>Les séries cassées font abandonner.</b> Donc rien ne se remet à zéro, et revenir après une pause est récompensé.</li>
    </ul>
    <p class="fine">Buzz n'est pas un dispositif médical et ne remplace ni un suivi, ni un traitement. Ton historique reste sur cet appareil ; seul ce que tu écris au coach IA est envoyé pour composer la séance.</p>
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
  const now = Date.now(), last = S.logs.at(-1);
  const comeback = !!last && now - last.t >= 3 * DAY;
  const firstToday = !S.logs.some((l) => new Date(l.t).toDateString() === new Date(now).toDateString());
  const r = reward({ sec, completed, comeback, firstToday });
  const log = { t: now, kind: session.kind, stateId: session.stateId, title: session.title, sec, completed, energyBefore: session.energy, energyAfter: null, feel: null, honey: r.total, comeback, exIds, ai: !!session.ai };
  const cellsBefore = Math.floor(S.honey / HONEY_PER_CELL);
  S.honey += r.total;
  S.logs.push(log);
  const newBadges = grantBadges();
  persist();
  ui.result = { r, log, newBadges, completed, session, newCells: Math.floor(S.honey / HONEY_PER_CELL) - cellsBefore };
  ui.screen = "done";
  render();
  window.scrollTo(0, 0);
  if (!S.profile.calm) fx.confetti(document.body);
  if (S.profile.sound) fx.chime();
  vib([60, 40, 120]);
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
  ui.session = buildSession({ energy: ui.energy, stateId: ui.mood, level: S.profile.level, minutes, opts: opts(), recent: recent() });
}

function showProp() {
  render();
  document.getElementById("prop")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

const actions = {
  "ob-skip": () => { S.profile.onboarded = true; persist(); ui.screen = "main"; render(); },
  "quiz-open": () => { Object.assign(ui, { screen: "quiz", quiz: draftFrom(S.profile), quizStep: 0 }); render(); window.scrollTo(0, 0); },
  "quiz-later": () => { S.profile.quizLater = true; persist(); render(); },
  "q-back": () => {
    if (ui.quizStep > 0) ui.quizStep--;
    else ui.screen = S.profile.onboarded ? "main" : "onboard"; // rien n'est enregistré avant la fin
    render();
  },
  "q-next": () => { ui.quizStep++; render(); window.scrollTo(0, 0); },
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
  "q-done": () => {
    applyQuiz(S.profile, ui.quiz);
    S.profile.onboarded = true;
    persist();
    Object.assign(ui, { screen: "main", tab: "home", quiz: null });
    if (ui.session) propose();
    render();
    window.scrollTo(0, 0);
  },
  tab: (v) => { ui.tab = v; render(); window.scrollTo(0, 0); },
  energy: (v) => { ui.energy = +v; ui.inferred = false; propose(); showProp(); },
  mood: (v) => { ui.mood = v; ui.inferred = false; propose(); showProp(); },
  reroll: () => { propose(); showProp(); },
  coach: async () => {
    const text = ui.coachText.trim();
    if (ui.coachBusy) return;
    if (text.length < 3) return toast("Écris quelques mots, même en vrac.");
    ui.coachBusy = true;
    render();
    let s = null;
    if (S.profile.ai) {
      try {
        const now = Date.now();
        s = sessionFromCoach(await askCoach({
          text, energy: ui.inferred ? null : ui.energy, mood: ui.inferred ? null : ui.mood, level: S.profile.level,
          quiet: S.profile.quiet, noFloor: S.profile.noFloor, simple: tune().simple, prefs: prefsFor(tune()), hour: new Date().getHours(),
          history: S.logs.slice(-8).map((l) => ({ title: l.title, min: Math.round(l.sec / 60), energyBefore: l.energyBefore, energyAfter: l.energyAfter, feel: l.feel, daysAgo: Math.floor((now - l.t) / DAY) })),
        }), tune().ready);
      } catch { /* hors ligne, serveur absent ou refus : on passe aux règles locales */ }
    }
    if (!s) {
      const g = guessFromText(text);
      const mine = !ui.inferred; // ce que la personne a coché elle-même passe avant la devinette
      s = buildSession({ energy: (mine && ui.energy) || g.energy, stateId: (mine && ui.mood) || g.stateId, level: S.profile.level, minutes: g.minutes, opts: opts(), recent: recent() });
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
    Object.assign(ui, { screen: "main", tab: "hive", energy: null, mood: null, session: null, result: null });
    render();
    window.scrollTo(0, 0);
  },
  level: (v) => { S.profile.level = +v; persist(); if (ui.session) propose(); render(); },
  toggle: (v) => { S.profile[v] = !S.profile[v]; persist(); if (ui.session) propose(); render(); },
  reset: () => {
    if (!confirm("Effacer ton miel, tes badges et ton historique ? C'est définitif.")) return;
    S = store.reset();
    Object.assign(ui, { screen: "onboard", tab: "home", energy: null, mood: null, session: null, result: null, quiz: null, quizStep: 0 });
    render();
  },
};

root.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b) actions[b.dataset.action]?.(b.dataset.v);
});

root.addEventListener("input", (e) => {
  if (e.target.id === "q-name") ui.quiz.name = e.target.value;
  if (e.target.id === "coach-text") ui.coachText = e.target.value;
  if (e.target.id === "set-name") { S.profile.name = e.target.value.trim(); persist(); }
});

// Écran verrouillé ou onglet caché pendant une séance : on met en pause plutôt que de laisser filer le temps.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && P && !P.paused) actions["p-pause"]();
  if (P) P.last = performance.now();
});

render();
