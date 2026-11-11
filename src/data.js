// ════════════════════════════════════════════════════════════════
//  BUZZ — données : exercices, états, coups de pouce, badges
//  type      : cardio | force | coord | mobilite | calme
//  intensity : 1 doux · 2 moyen · 3 fort
//  jump      : fait du bruit / saute (exclu en mode discret)
//  floor     : passage au sol (exclu si "sans sol")
//  complex   : coordination ou équilibre exigeants (exclu si profil dyspraxie)
// ════════════════════════════════════════════════════════════════

const ex = (id, name, emoji, type, intensity, cue, flags = {}) => ({ id, name, emoji, type, intensity, cue, ...flags });

export const EXERCISES = [
  // ── Cardio : décharger, monter le rythme
  ex("jacks", "Jumping jacks", "⭐", "cardio", 3, "Bras et jambes s'écartent en même temps. Trouve ton rythme.", { jump: true }),
  ex("genoux", "Montées de genoux", "🦵", "cardio", 3, "Genoux à hauteur de hanches, bras qui pompent.", { jump: true }),
  ex("talons", "Talons-fesses", "🏃", "cardio", 2, "Trottine sur place, les talons touchent les fesses.", { jump: true }),
  ex("boxe", "Boxe dans le vide", "🥊", "cardio", 2, "Direct, direct, crochet. Frappe vite, reste léger sur tes pieds."),
  ex("skater", "Pas du patineur", "⛸️", "cardio", 3, "Grand pas sur le côté, la jambe arrière croise derrière.", { jump: true, complex: true }),
  ex("marche", "Marche active sur place", "🚶", "cardio", 1, "Lève bien les genoux, balance les bras."),
  ex("corde", "Corde à sauter imaginaire", "🪢", "cardio", 2, "Petits sauts, poignets qui tournent.", { jump: true }),
  ex("climbers", "Mountain climbers", "⛰️", "cardio", 3, "En planche, ramène les genoux vers la poitrine l'un après l'autre.", { floor: true }),
  ex("danse", "Danse libre", "💃", "cardio", 2, "Aucune règle. Bouge comme tu veux, le plus possible."),
  ex("chasses", "Pas chassés", "↔️", "cardio", 2, "Trois pas d'un côté, touche le sol, repars de l'autre."),
  ex("squatboxe", "Squat + uppercut", "💥", "cardio", 3, "Descends en squat, remonte en frappant vers le haut.", { complex: true }),

  // ── Force : sentir ses muscles, s'ancrer
  ex("squat", "Squats", "🏋️", "force", 2, "Pieds largeur d'épaules, fesses en arrière, dos droit."),
  ex("fentes", "Fentes alternées", "🚀", "force", 2, "Un grand pas en avant, genou arrière vers le sol, puis change."),
  ex("pompes", "Pompes", "💪", "force", 3, "Corps aligné, descends la poitrine, repousse le sol.", { floor: true }),
  ex("pompesmur", "Pompes contre le mur", "🧱", "force", 1, "Mains au mur, corps incliné, plie et repousse."),
  ex("planche", "Planche", "📏", "force", 2, "Sur les avant-bras, corps droit comme une planche. Respire.", { floor: true }),
  ex("chaise", "Chaise contre le mur", "🪑", "force", 2, "Dos au mur, cuisses à l'horizontale. Tiens bon."),
  ex("pont", "Pont fessier", "🌉", "force", 1, "Allongé sur le dos, pousse dans les talons, monte le bassin.", { floor: true }),
  ex("superman", "Superman", "🦸", "force", 1, "À plat ventre, décolle bras et jambes, tiens 2 secondes.", { floor: true }),
  ex("dips", "Dips sur chaise", "🔻", "force", 2, "Mains sur le bord d'une chaise, plie les coudes, remonte."),
  ex("squatsaut", "Squats sautés", "🐸", "force", 3, "Descends en squat puis explose vers le haut.", { jump: true }),
  ex("mollets", "Montées sur pointes", "🩰", "force", 1, "Monte sur la pointe des pieds, redescends lentement."),
  ex("deadbug", "Dead bug", "🪲", "force", 1, "Sur le dos, tends bras et jambe opposés sans creuser le dos.", { floor: true }),

  // ── Coordination : réveiller le cerveau (les deux hémisphères bossent)
  ex("croise", "Genou-coude croisé", "🔀", "coord", 1, "Debout : coude droit vers genou gauche, puis l'inverse."),
  ex("equilibre", "Équilibre sur une jambe", "🦩", "coord", 1, "Fixe un point devant toi. Change de jambe à mi-temps."),
  ex("talonpointe", "Marche du funambule", "🎪", "coord", 1, "Avance un pied juste devant l'autre, talon contre pointe."),
  ex("touchearriere", "Main-pied croisé derrière", "🔁", "coord", 2, "Main droite touche le pied gauche derrière toi. Alterne vite.", { complex: true }),
  ex("lancer", "Lancer-rattraper", "🤹", "coord", 1, "Prends un objet (balle, chaussette). Lance d'une main, rattrape de l'autre.", { complex: true }),
  ex("ours", "Marche de l'ours", "🐻", "coord", 3, "À quatre pattes, genoux décollés. Avance et recule.", { floor: true }),
  ex("croix", "Pas en croix", "✚", "coord", 2, "Avant, centre, droite, centre, arrière, centre, gauche. Accélère.", { complex: true }),
  ex("huit", "Huit couchés avec les bras", "♾️", "coord", 1, "Dessine un grand 8 couché devant toi, suis ta main des yeux."),
  ex("yeuxfermes", "Équilibre yeux fermés", "🙈", "coord", 2, "Sur une jambe, ferme les yeux. Plus dur qu'il n'y paraît.", { complex: true }),
  ex("birddog", "Bird-dog", "🐕", "coord", 1, "À quatre pattes, tends bras droit et jambe gauche. Alterne.", { floor: true }),
  ex("rythme", "Tape le rythme", "🥁", "coord", 2, "Cuisses, mains, cuisses, claque des doigts. Accélère sans te tromper.", { complex: true }),

  // ── Mobilité : dérouiller, sortir de l'immobilité
  ex("chatvache", "Chat-vache", "🐈", "mobilite", 1, "À quatre pattes, arrondis le dos, puis creuse-le doucement.", { floor: true }),
  ex("rotations", "Rotations du buste", "🌀", "mobilite", 1, "Pieds ancrés, laisse les bras fouetter d'un côté à l'autre."),
  ex("cerclesbras", "Grands cercles de bras", "🌬️", "mobilite", 1, "Cercles amples vers l'avant, puis vers l'arrière."),
  ex("coureur", "Fente basse du coureur", "🧎", "mobilite", 1, "Grande fente, mains au sol, ouvre un bras vers le ciel.", { floor: true }),
  ex("enroule", "Enroulé de colonne", "🐚", "mobilite", 1, "Debout, déroule le dos vertèbre par vertèbre vers le sol. Remonte lentement."),
  ex("hanches", "Cercles de hanches", "⭕", "mobilite", 1, "Mains sur les hanches, dessine de grands cercles."),
  ex("cou", "Étirement du cou", "🦒", "mobilite", 1, "Oreille vers l'épaule, sans forcer. Change de côté."),
  ex("enfant", "Posture de l'enfant", "🙇", "mobilite", 1, "À genoux, front au sol, bras devant. Laisse-toi fondre.", { floor: true }),
  ex("chien", "Chien tête en bas", "🔺", "mobilite", 1, "Mains et pieds au sol, fesses vers le ciel. Pédale doucement.", { floor: true }),
  ex("poitrine", "Ouverture de poitrine", "🫶", "mobilite", 1, "Croise les mains dans le dos, ouvre les épaules, regarde devant."),
  ex("epaules", "Haussements d'épaules", "🤷", "mobilite", 1, "Monte les épaules aux oreilles, relâche d'un coup."),

  // ── Calme : faire redescendre le système nerveux
  ex("secouer", "Secoue tout", "🫨", "calme", 1, "Mains, bras, jambes, tête. Secoue tout ce qui peut l'être."),
  ex("mur", "Pousse le mur", "🧱", "calme", 2, "Mains au mur, pousse de toutes tes forces. Comme pour le déplacer."),
  ex("soupir", "Double inspiration", "😮‍💨", "calme", 1, "Inspire par le nez, re-inspire un petit coup, puis souffle très lentement par la bouche."),
  ex("longue", "Expiration longue", "🌊", "calme", 1, "Inspire sur 4 temps, souffle sur 6. Laisse les épaules tomber."),
  ex("carree", "Respiration carrée", "🔲", "calme", 1, "Inspire 4 · bloque 4 · souffle 4 · bloque 4."),
  ex("papillon", "Câlin papillon", "🦋", "calme", 1, "Bras croisés sur la poitrine, tapote tes épaules en alternance, lentement."),
  ex("pieds", "Ancrage des pieds", "🌳", "calme", 1, "Debout, sens tes pieds dans le sol. Orteils, talons, bords. Rien d'autre."),
  ex("serrer", "Serre et relâche", "✊", "calme", 1, "Serre les poings et tout le corps 5 secondes, puis relâche tout."),
];

export const EX_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

// États "dans ta tête" → forme de la séance.
// start / end : exercice imposé (id) ou type ; cycle : rotation de types au milieu.
export const STATES = [
  {
    id: "agite", label: "Agité·e", emoji: "⚡", title: "Décharge",
    why: "Trop d'énergie dans le corps : on la sort fort, puis on atterrit en douceur.",
    start: "secouer", cycle: ["cardio", "force", "cardio", "coord"], end: "longue",
    minCap: 2, maxCap: 3, prefer: "high", maxMin: 16,
  },
  {
    id: "brouillard", label: "Dans le brouillard", emoji: "🌫️", title: "Réveil cerveau",
    why: "Des mouvements croisés et de l'équilibre : ça demande de l'attention, donc ça la rallume.",
    start: "cerclesbras", cycle: ["coord", "cardio", "coord", "force"], end: "equilibre",
    minCap: 1, maxCap: 3, prefer: "mid", maxMin: 12,
  },
  {
    id: "aplat", label: "À plat", emoji: "🪫", title: "Allumage doux",
    why: "Zéro pression. On dérouille, on monte tout doucement. Ça suffit pour relancer la machine.",
    start: "epaules", cycle: ["mobilite", "coord", "mobilite", "force"], end: "poitrine",
    minCap: 1, maxCap: 2, prefer: "low", maxMin: 8,
  },
  {
    id: "tendu", label: "Tendu·e", emoji: "🌋", title: "Relâche",
    why: "On vide la tension dans les muscles, puis on ralentit le souffle. Le corps calme la tête.",
    start: "mur", cycle: ["mobilite", "calme", "mobilite"], end: "carree",
    minCap: 1, maxCap: 1, prefer: "low", maxMin: 10,
  },
  {
    id: "ok", label: "Plutôt bien", emoji: "🙂", title: "Séance complète",
    why: "Bon créneau : on en profite pour une vraie séance, force et cardio mélangés.",
    start: "rotations", cycle: ["force", "cardio", "force", "coord"], end: "enroule",
    minCap: 1, maxCap: 3, prefer: "high", maxMin: 20,
  },
];

export const STATE_BY_ID = Object.fromEntries(STATES.map((s) => [s.id, s]));

export const ENERGY = [
  { v: 1, label: "Vide", emoji: "🪫" },
  { v: 2, label: "Faible", emoji: "😮‍💨" },
  { v: 3, label: "Moyenne", emoji: "😐" },
  { v: 4, label: "Bonne", emoji: "😀" },
  { v: 5, label: "À fond", emoji: "🔥" },
];

// Coups de pouce : séances fixes ou générées, lancées en 1 tap, sans check-in.
export const QUICK = [
  {
    id: "sos", emoji: "🆘", label: "SOS", sub: "90 s · ça déborde",
    title: "SOS 90 secondes", why: "Quand l'émotion déborde : décharge, pression, souffle.",
    fixed: [["secouer", 30], ["mur", 30], ["soupir", 30]],
  },
  {
    id: "focus", emoji: "🎯", label: "Avant de me concentrer", sub: "3 min",
    title: "Amorce de concentration", why: "Quelques minutes de mouvement avant une tâche aident à s'y mettre.",
    gen: { state: "brouillard", energy: 3, minutes: 3 },
  },
  {
    id: "pause", emoji: "🪑", label: "Dérouiller", sub: "2 min · pause",
    title: "Pause dérouillage", why: "Tu es resté·e immobile trop longtemps. Deux minutes et on y retourne.",
    fixed: [["epaules", 25], ["rotations", 30], ["enroule", 35], ["hanches", 30]],
  },
  {
    id: "dodo", emoji: "🌙", label: "Avant de dormir", sub: "4 min",
    title: "Descente vers le sommeil", why: "Ralentir le corps pour aider la tête à lâcher.",
    fixed: [["cou", 40], ["enroule", 40], ["serrer", 40], ["papillon", 50], ["longue", 70]],
  },
];

export const LEVELS = [
  { v: 1, label: "Doux", sub: "Je reprends" },
  { v: 2, label: "Moyen", sub: "Je bouge parfois" },
  { v: 3, label: "Costaud", sub: "Je suis sportif·ve" },
];

// Badges : uniquement des choses qu'on gagne. Rien ne se perd, rien ne se remet à zéro.
export const BADGES = [
  { id: "first", emoji: "🐣", name: "Premier vol", desc: "Première séance", test: (s) => s.logs.length >= 1 },
  { id: "five", emoji: "🐝", name: "Butineuse", desc: "5 séances", test: (s) => s.logs.length >= 5 },
  { id: "twenty", emoji: "👑", name: "Reine de la ruche", desc: "20 séances", test: (s) => s.logs.length >= 20 },
  { id: "hour", emoji: "⏱️", name: "Une heure pleine", desc: "60 min de mouvement au total", test: (s) => s.logs.reduce((a, l) => a + l.sec, 0) >= 3600 },
  { id: "sos", emoji: "🧯", name: "Pompier", desc: "Un SOS utilisé au bon moment", test: (s) => s.logs.some((l) => l.kind === "sos") },
  { id: "micro", emoji: "🤏", name: "Mieux que rien", desc: "Une séance de 2 min ou moins. Ça compte.", test: (s) => s.logs.some((l) => l.sec <= 130) },
  { id: "palette", emoji: "🎨", name: "Toutes les couleurs", desc: "Bougé dans 4 états différents", test: (s) => new Set(s.logs.map((l) => l.stateId).filter(Boolean)).size >= 4 },
  { id: "low", emoji: "🌱", name: "Même à plat", desc: "Bougé avec l'énergie à 1", test: (s) => s.logs.some((l) => l.energyBefore === 1) },
  { id: "back", emoji: "🪃", name: "Retour gagnant", desc: "Revenu·e après une pause de 3 jours ou plus", test: (s) => s.logs.some((l) => l.comeback) },
  { id: "week3", emoji: "📅", name: "Trois jours", desc: "3 jours actifs dans la même semaine", test: (s) => maxDaysInAWeek(s.logs) >= 3 },
  { id: "up", emoji: "📈", name: "Preuve par le corps", desc: "Énergie plus haute après qu'avant, 3 fois", test: (s) => s.logs.filter((l) => l.energyAfter && l.energyBefore && l.energyAfter > l.energyBefore).length >= 3 },
  { id: "terrain", emoji: "🏟️", name: "Sur le terrain", desc: "Du sport noté hors de l'appli", test: (s) => s.logs.some((l) => l.kind === "ext") },
  { id: "ancre", emoji: "⚓", name: "Ancré·e", desc: "Palier 2 de la routine atteint", test: (s) => (s.profile.routine?.stage || 0) >= 2 },
  { id: "regulier", emoji: "🏅", name: "Régulier·e", desc: "Palier 5 : le repère de l'OMS", test: (s) => (s.profile.routine?.stage || 0) >= 5 },
  { id: "night", emoji: "🦉", name: "Oiseau de nuit", desc: "Une descente vers le sommeil", test: (s) => s.logs.some((l) => l.kind === "dodo") },
];

function weekKey(t) {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function maxDaysInAWeek(logs) {
  const weeks = {};
  for (const l of logs) {
    const k = weekKey(l.t);
    (weeks[k] ||= new Set()).add(new Date(l.t).toDateString());
  }
  return Math.max(0, ...Object.values(weeks).map((s) => s.size));
}
