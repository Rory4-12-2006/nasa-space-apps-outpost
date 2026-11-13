// Mars: Sols of Survival – game logic (Quick Mission, Mars only)
// Plain JS, no build step. Events come from data/events.js (window.MISSION_EVENTS).
(function () {
  "use strict";

  // ---------- tuning numbers (change these during playtests) ----------
  const START = { power: 70, life: 70, health: 100 };
  const UPKEEP = { power: 12, life: 10, health: 1 }; // lost every night
  const AP_PER_SOL = 2;
  const MAX_SLOTS = 8; // habitat + 7 modules
  // Crew Health lost if the crew stays fully outside, by danger tier.
  // Game simplification: scaled for visibility, not real mSv.
  // Tier 5 is set so that working outside with no walls through both big storms is fatal.
  const TIER_BASE = { 0: 0, 1: 2, 2: 6, 3: 15, 4: 30, 5: 50 };
  const WIN_BONUS = 10; // surviving the whole mission must beat collecting stars recklessly
  const SHIELD_CUT = 0.25;     // each wall level blocks 25% of solar particles
  const SHELTER_FACTOR = 0.15; // shelter blocks 85%
  const REINFORCE_FACTOR = 0.6; // building walls during the storm: partly exposed

  const MODULES = {
    solar: {
      name: "Solar Panel", icon: "☀️", max: 3, unlockSol: 1,
      cost: "1 action",
      effect: "⚡ +10 per Sol in sunlight",
      lesson: "Panels only work when sunlight reaches them."
    },
    greenhouse: {
      name: "Greenhouse", icon: "🌱", max: 2, unlockSol: 1,
      cost: "1 action · ⚡ −6 per Sol",
      effect: "💨 +9 per Sol (air, water, food)",
      lesson: "Growing food takes a lot of power."
    },
    wall: {
      name: "Regolith Wall", icon: "🧱", max: 3, unlockSol: 2,
      cost: "1 action · ⚡ −5 once",
      effect: "🛡️ +1 Shield (blocks 25% of particles)",
      lesson: "Walls of Mars soil block solar particles."
    },
    shelter: {
      name: "Storm Shelter", icon: "🏠", max: 1, unlockSol: 2,
      cost: "1 action · ⚡ −2 per Sol",
      effect: "Unlocks the Shelter choice (blocks 85%)",
      lesson: "Safe, but nobody works while hiding."
    }
  };

  const WORK = {
    science: {
      name: "Science Walk", icon: "🔭",
      cost: "1 action · 🧑‍🚀 −2 (outside)",
      effect: "⭐ +1",
      can: () => true
    },
    tend: {
      name: "Tend Crops", icon: "🧑‍🌾",
      cost: "1 action",
      effect: "💨 +4 per greenhouse",
      can: (s) => s.modules.greenhouse > 0
    },
    clean: {
      name: "Clean Panels", icon: "🧽",
      cost: "1 action · 🧑‍🚀 −1 (outside)",
      effect: "More sunlight tonight if it's dusty",
      can: (s) => s.modules.solar > 0 && !s.cleaned
    }
  };

  const EVENTS = window.MISSION_EVENTS || [];
  const TOTAL_SOLS = EVENTS.length;

  // ---------- state ----------
  let S = null;

  function newGame() {
    S = {
      sol: 1,
      power: START.power, life: START.life, health: START.health,
      shield: 0, stars: 0, ap: AP_PER_SOL,
      modules: { solar: 0, greenhouse: 0, wall: 0, shelter: 0 },
      cleaned: false,
      askedEarth: null, // null | "intime" | "late" | "blackout"
      history: [],
      ended: false
    };
  }

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const currentEvent = () => EVENTS[S.sol - 1];

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
    $("#screen-" + id).classList.add("active");
    window.scrollTo(0, 0);
  }

  function fmtMinutes(m) {
    if (m < 60) return m + (m === 1 ? " minute" : " minutes");
    if (m < 1440) { const h = Math.round(m / 60); return h + (h === 1 ? " hour" : " hours"); }
    const d = Math.round(m / 1440); return d + (d === 1 ? " day" : " days");
  }

  function dangerMeter(tier) {
    return "🔴".repeat(tier) + "⚪".repeat(5 - tier);
  }

  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(Math.round(n)); }

  function say(text) { $("#cat-say").textContent = text; }

  // What happens tonight with the current base, before any event choice.
  function overnightPreview(sunlight, greenhouseOn) {
    const m = S.modules;
    const sun = Math.min(1, sunlight + (S.cleaned && sunlight < 1 ? 0.3 : 0));
    const ghOn = greenhouseOn !== false;
    return {
      power: m.solar * 10 * sun - UPKEEP.power - (ghOn ? m.greenhouse * 6 : 0) - m.shelter * 2,
      life: (ghOn ? m.greenhouse * 9 : 0) - UPKEEP.life,
      health: -UPKEEP.health,
      sun
    };
  }

  // ---------- rendering ----------
  function renderBars() {
    [["power", S.power], ["life", S.life], ["health", S.health]].forEach(([k, v]) => {
      const el = $("#bar-" + k);
      el.querySelector(".fill").style.width = Math.max(0, Math.min(100, v)) + "%";
      el.querySelector(".num").textContent = Math.round(v) + "/100";
      el.classList.toggle("low", v <= 25);
    });
    $("#sol-label").textContent = "SOL " + S.sol;
    $("#shield-num").textContent = S.shield;
    $("#stars-num").textContent = S.stars;
  }

  function renderAP() {
    const ap = $("#ap");
    ap.innerHTML = "AP ";
    for (let i = 0; i < AP_PER_SOL; i++) {
      const d = document.createElement("span");
      d.className = "dot" + (i < S.ap ? " on" : "");
      ap.appendChild(d);
    }
    ap.setAttribute("aria-label", S.ap + " action points left");
  }

  function renderSlots() {
    const box = $("#slots");
    box.innerHTML = "";
    const add = (cls, ico, name, eff) => {
      const d = document.createElement("div");
      d.className = "slot " + cls;
      d.innerHTML = `<div class="big-ico">${ico}</div><div class="name">${name}</div><div class="eff">${eff}</div>`;
      box.appendChild(d);
    };
    add("habitat", "🛖", "Habitat", "Crew lives here");
    let used = 1;
    Object.keys(MODULES).forEach((k) => {
      for (let i = 0; i < S.modules[k]; i++) {
        add("", MODULES[k].icon, MODULES[k].name, MODULES[k].effect);
        used++;
      }
    });
    for (; used < MAX_SLOTS; used++) {
      const d = document.createElement("div");
      d.className = "slot empty";
      d.textContent = "+ empty";
      box.appendChild(d);
    }

    const ev = currentEvent();
    const p = overnightPreview(ev ? ev.sunlight : 1);
    const cls = (n) => (n >= 0 ? "pos" : "neg");
    $("#net-line").innerHTML =
      `Tonight${ev && ev.sunlight < 1 ? " (dusty sky)" : ""}: ` +
      `<span class="${cls(p.power)}">⚡ ${signed(p.power)}</span> · ` +
      `<span class="${cls(p.life)}">💨 ${signed(p.life)}</span> · ` +
      `<span class="neg">🧑‍🚀 ${signed(p.health)}</span>`;
  }

  function trayButton(id, kind, ico, name, cost, effect, enabled, why) {
    const b = document.createElement("button");
    b.className = "tray-btn";
    b.dataset.action = kind;
    b.dataset.id = id;
    b.disabled = !enabled;
    b.innerHTML = `<span class="big-ico">${ico}</span><span><span class="name">${name}</span>` +
      `<span class="cost">${effect}</span><span class="cost">Cost: ${cost}</span>` +
      (why ? `<span class="cost"><i>${why}</i></span>` : "") + `</span>`;
    return b;
  }

  function renderTray() {
    const t = $("#tray-buttons");
    t.innerHTML = "";
    const sub = (txt) => { const d = document.createElement("div"); d.className = "tray-sub"; d.textContent = txt; t.appendChild(d); };
    sub("Build");
    Object.keys(MODULES).forEach((k) => {
      const m = MODULES[k];
      if (S.sol < m.unlockSol) return; // unlock one at a time
      const full = S.modules[k] >= m.max || (k === "wall" && S.shield >= 3);
      const ok = S.ap > 0 && !full;
      t.appendChild(trayButton(k, "build", m.icon, m.name, m.cost, m.effect, ok, full ? "Maximum built" : ""));
    });
    sub("Work");
    Object.keys(WORK).forEach((k) => {
      const w = WORK[k];
      const ok = S.ap > 0 && w.can(S);
      t.appendChild(trayButton(k, "work", w.icon, w.name, w.cost, w.effect, ok, ""));
    });
  }

  function renderForecast() {
    const ev = currentEvent();
    const f = $("#forecast");
    if (!ev) { f.innerHTML = ""; return; }
    const danger = ev.type === "dust"
      ? "Power danger: " + dangerMeter(4)
      : ev.type === "quiet" ? "Danger: none ✅" : "Radiation danger: " + dangerMeter(ev.dangerTier);
    f.innerHTML =
      `<div class="big-ico">${ev.icon}</div>` +
      `<div><h3>FORECAST · SOL ${S.sol}</h3>` +
      `<div class="fc-title">${ev.title}</div>` +
      `<div class="meta danger">${danger}</div>` +
      `<div class="meta">Arrives in: <b>${fmtMinutes(ev.warningMinutes)}</b> after the warning</div>` +
      `<div class="meta">Source: ${ev.citation.text} <span class="badge archive">${ev.mode}</span></div></div>`;
  }

  function prepareHint() {
    const ev = currentEvent();
    if (S.sol === 1) return "Solar panels make power. The greenhouse makes air and food, but it eats power. Can you keep both going?";
    if (S.power <= 25) return "Power is low! More solar panels, or fewer greenhouses?";
    if (S.life <= 25) return "Air and food are low! A greenhouse or tending crops will help.";
    if (ev.type === "sep") return "A solar particle storm is coming! Walls and a shelter protect the crew, but they cost power and time.";
    if (ev.type === "flare") return "A flare means a radio blackout. You can't ask Earth for help. Will you hide or keep working?";
    if (ev.type === "dust") return "A dust storm is coming. Panels will barely work. Clean them, or plan to save power!";
    return "Use your 2 actions, then press Ready.";
  }

  function renderGame() {
    renderBars();
    renderAP();
    renderSlots();
    renderTray();
    renderForecast();
  }

  // ---------- prepare phase actions ----------
  function doBuild(id) {
    if (S.ap <= 0) return;
    const m = MODULES[id];
    if (S.modules[id] >= m.max) return;
    S.ap--;
    S.modules[id]++;
    if (id === "wall") { S.shield = Math.min(3, S.shield + 1); S.power = clamp(S.power - 5); }
    say(m.icon + " " + m.name + " built! " + m.lesson);
    renderGame();
    checkLose();
  }

  function doWork(id) {
    if (S.ap <= 0) return;
    S.ap--;
    if (id === "science") { S.stars += 1; S.health = clamp(S.health - 2); say("🔭 Great find! +1 Science Star. Being outside gave the crew a little radiation."); }
    if (id === "tend") { S.life = clamp(S.life + 4 * S.modules.greenhouse); say("🧑‍🌾 The plants look happy. More air and food!"); }
    if (id === "clean") { S.cleaned = true; say("🧽 Clean panels catch more light when the sky is dusty."); }
    renderGame();
    checkLose();
  }

  // ---------- event phase ----------
  function choicesFor(ev) {
    const hasShelter = S.modules.shelter > 0;
    if (ev.type === "flare" || ev.type === "sep") {
      return [
        { id: "shelter", icon: "🏠", name: "Shelter", cost: hasShelter ? "Crew is safe · 💨 −6 (no one tends plants) · ⚡ −3 · ⭐ 0" : "Build a Storm Shelter first!", enabled: hasShelter },
        { id: "work", icon: "⛏️", name: "Keep working", cost: "Full radiation hit (walls help) · ⭐ +2", enabled: true },
        { id: "reinforce", icon: "🧱", name: "Reinforce now", cost: S.ap > 0 && S.shield < 3 ? "Uses 1 action · ⚡ −5 · some radiation · ⭐ +1" : (S.shield >= 3 ? "Walls are already maxed" : "Needs 1 saved action"), enabled: S.ap > 0 && S.shield < 3 }
      ];
    }
    if (ev.type === "dust") {
      return [
        { id: "powerdown", icon: "🔌", name: "Turn greenhouse down", cost: "Saves power tonight · 💨 no new air or food tonight", enabled: true },
        { id: "keepon", icon: "💡", name: "Keep everything on", cost: "Normal air and food · ⚡ uses lots of power with little sun", enabled: true }
      ];
    }
    // quiet
    return [
      { id: "tend", icon: "🌱", name: "Garden day", cost: "💨 +6 · ⚡ −2", enabled: true },
      { id: "science", icon: "🔭", name: "Big science day", cost: "⭐ +2 · ⚡ −3 · 🧑‍🚀 −2 (outside)", enabled: true }
    ];
  }

  function openEvent() {
    const ev = currentEvent();
    S.askedEarth = null;
    const ov = $("#overlay");
    ov.classList.remove("hidden", "flash", "redsky");
    void ov.offsetWidth; // restart animation
    if (ev.type === "flare" || ev.type === "sep") ov.classList.add("flash");
    if (ev.type === "dust") ov.classList.add("redsky");

    const choices = choicesFor(ev);
    const earthBtn = ev.blackout
      ? `<button class="btn" disabled>📡 Ask Earth</button><p>📵 <b>Radio blackout!</b> The flare knocked out the radio. You must decide alone.</p>`
      : `<button class="btn" data-action="ask-earth">📡 Ask Earth</button><p id="earth-reply">Message time to Earth today: <b>${ev.lightDelayMinutes} min</b> each way.</p>`;

    $("#modal").innerHTML =
      `<div class="ev-head"><div class="big-ico">${ev.icon}</div><div><h2>Sol ${S.sol}: ${ev.title}</h2>` +
      `<div class="citation">${ev.citation.text} <span class="badge archive">${ev.mode}</span></div></div></div>` +
      `<p class="cat-line"><span class="cat" aria-hidden="true">🐱</span><span><b>${ev.headline}</b><br><span class="why">${ev.why}</span></span></p>` +
      `<details class="real"><summary>🔬 Real Science</summary><p>${ev.realScience}</p>` +
      `<p class="citation">Source: <a href="${ev.citation.url}" target="_blank" rel="noopener">${ev.citation.text}</a></p></details>` +
      `<h3>What will you do?</h3>` +
      `<div class="choices">` +
      choices.map((c) => `<button class="choice" data-action="choose" data-id="${c.id}" ${c.enabled ? "" : "disabled"}>` +
        `<span class="name">${c.icon} ${c.name}</span><span class="cost">${c.cost}</span></button>`).join("") +
      `</div>` +
      `<div class="earth">${earthBtn}</div>`;
    $("#modal").querySelector(".choice:not([disabled])")?.focus();
  }

  function askEarth() {
    const ev = currentEvent();
    const roundTrip = ev.lightDelayMinutes * 2;
    const reply = $("#earth-reply");
    const btn = $('[data-action="ask-earth"]');
    if (btn) btn.disabled = true;
    if (!ev.earthAdvice) { reply.textContent = "Mission Control has no advice for this one."; return; }
    if (roundTrip <= ev.warningMinutes) {
      S.askedEarth = "intime";
      reply.innerHTML = `✅ Reply arrived in ${roundTrip} minutes, in time! Mission Control says: <b>"${ev.earthAdvice.text}"</b>`;
      const rec = $(`.choice[data-id="${ev.earthAdvice.choice}"]`);
      if (rec) rec.style.borderColor = "#3cc35a";
    } else {
      S.askedEarth = "late";
      reply.innerHTML = `⏳ Your message needs <b>${roundTrip} minutes</b> to reach Earth and come back, but the storm arrives in <b>${ev.warningMinutes} minutes</b>. ` +
        `Earth's reply will be too late. <b>Real Mars crews have to decide on their own!</b>`;
    }
  }

  // ---------- resolve a choice ----------
  function resolve(choiceId) {
    const ev = currentEvent();
    const before = { power: S.power, life: S.life, health: S.health, stars: S.stars, shield: S.shield };
    let because = "";
    let greenhouseOn = true;
    let hit = 0;

    if (ev.type === "flare" || ev.type === "sep") {
      if (choiceId === "reinforce") {
        S.ap--; S.shield = Math.min(3, S.shield + 1); S.modules.wall++;
        S.power -= 5; S.stars += 1;
      }
      const base = TIER_BASE[ev.dangerTier] || 0;
      const afterWalls = base * (1 - SHIELD_CUT * S.shield);
      const factor = choiceId === "shelter" ? SHELTER_FACTOR : choiceId === "reinforce" ? REINFORCE_FACTOR : 1;
      hit = Math.round(afterWalls * factor);
      S.health -= hit;
      if (choiceId === "shelter") { S.life -= 6; S.power -= 3; }
      if (choiceId === "work") { S.stars += 2; }

      if (ev.dangerTier <= 1) {
        because = choiceId === "shelter"
          ? "This flare made no big particle storm, so hiding cost air and work for almost nothing. Forecasting is hard!"
          : "This flare blocked the radio but made no big particle storm. Working was the right call this time.";
      } else if (choiceId === "shelter") {
        because = `The shelter blocked most of the particles, so the crew lost only ${hit} health. But nobody tended the plants, so air dropped.`;
      } else if (choiceId === "reinforce") {
        because = `New walls blocked some particles while the crew built them. The crew lost ${hit} health.`;
      } else {
        because = S.shield > 0
          ? `Your walls blocked ${S.shield * 25}% of the particles, but working outside still cost ${hit} health.`
          : `With no walls and no shelter, the crew soaked up the whole storm: −${hit} health.`;
      }
    } else if (ev.type === "dust") {
      greenhouseOn = choiceId !== "powerdown";
      because = greenhouseOn
        ? "The greenhouse kept making air and food, but the dusty panels could not pay for its power."
        : "Turning the greenhouse down saved power, but the crew made no new air or food tonight.";
    } else {
      if (choiceId === "tend") { S.life += 6; S.power -= 2; because = "A calm day is a great day to grow food. It still costs a little power."; }
      if (choiceId === "science") { S.stars += 2; S.power -= 3; S.health -= 2; because = "Great science! But time outside means a little extra radiation."; }
    }

    // overnight
    const night = overnightPreview(ev.sunlight, greenhouseOn);
    S.power += night.power;
    S.life += night.life;
    S.health += night.health;
    S.power = clamp(S.power); S.life = clamp(S.life); S.health = clamp(S.health);

    const choiceName = (choicesFor(ev).find((c) => c.id === choiceId) || { name: choiceId }).name;
    S.history.push({ sol: S.sol, title: ev.title, icon: ev.icon, choice: choiceName, power: S.power, life: S.life, health: S.health, night });

    showReveal(ev, before, because, night);
  }

  function showReveal(ev, before, because, night) {
    const d = (k, ico, name) => {
      const diff = Math.round(S[k] - before[k]);
      const cls = diff < 0 ? "down" : diff > 0 ? "up" : "";
      return `<div class="delta ${cls}"><span class="ico">${ico}</span>${name}<br>${Math.round(before[k])} → ${Math.round(S[k])} (${signed(diff)})</div>`;
    };
    let earthLine = "";
    if (S.askedEarth === "late" && ev.earthAdvice) {
      const lateBy = ev.lightDelayMinutes * 2 - ev.warningMinutes;
      earthLine = `<p class="realnum">📡 Earth's reply arrived <b>${lateBy} minutes after</b> the storm hit: <i>"${ev.earthAdvice.text}"</i></p>`;
    }
    const sunTxt = night.sun < 1 ? ` Sunlight was only ${Math.round(night.sun * 100)}%, so panels made less power.` : "";
    $("#modal").innerHTML =
      `<h2>${ev.icon} What happened</h2>` +
      `<div class="deltas">${d("power", "⚡", "Power")}${d("life", "💨", "Life Support")}${d("health", "🧑‍🚀", "Crew Health")}</div>` +
      `<p class="because"><b>Because…</b> ${because}</p>` +
      `<p class="realnum">🔬 <b>Real life:</b> ${ev.realNumber} <span class="badge archive">${ev.mode}</span></p>` +
      earthLine +
      `<p class="overnight">🌙 Overnight the base used its daily power, air and food, and background cosmic rays cost 1 health.${sunTxt}</p>` +
      (S.stars > before.stars ? `<p>⭐ +${S.stars - before.stars} Science Star${S.stars - before.stars > 1 ? "s" : ""}!</p>` : "") +
      `<div class="modal-actions"><button class="btn btn-go" data-action="next">${S.sol >= TOTAL_SOLS ? "Finish mission ▶" : "Next Sol ▶"}</button></div>`;
    $('[data-action="next"]').focus();
  }

  function nextSol() {
    $("#overlay").classList.add("hidden");
    if (checkLose()) return;
    if (S.sol >= TOTAL_SOLS) { showDebrief(true); return; }
    S.sol++;
    S.ap = AP_PER_SOL;
    S.cleaned = false;
    renderGame();
    say(prepareHint());
  }

  function checkLose() {
    if (S.ended) return true;
    if (S.power <= 0 || S.life <= 0 || S.health <= 0) {
      $("#overlay").classList.add("hidden");
      showDebrief(false);
      return true;
    }
    return false;
  }

  // ---------- debrief ----------
  function rootCause() {
    if (S.power <= 0) {
      const gh = S.modules.greenhouse, so = S.modules.solar;
      return {
        head: `the base ran out of power on Sol ${S.sol}`,
        why: gh * 6 > so * 10 ? `Your greenhouses used more power (${gh * 6} per Sol) than your panels could make (${so * 10} on a sunny day).` : "The base used more power than the panels could make, especially when dust blocked the Sun.",
        tip: "Build another solar panel early, and turn the greenhouse down during dust storms."
      };
    }
    if (S.life <= 0) {
      return {
        head: `the crew ran out of air and food on Sol ${S.sol}`,
        why: S.modules.greenhouse === 0 ? "There was no greenhouse to make new air and food." : "The greenhouse could not keep up, especially on days the crew hid or turned it down.",
        tip: "Build a greenhouse on Sol 1, and back it up with enough solar panels."
      };
    }
    return {
      head: `the crew got too much radiation on Sol ${S.sol}`,
      why: S.shield === 0 ? "The base had no walls, so particle storms hit the crew at full strength." : "Working outside during a strong particle storm gave the crew a big dose.",
      tip: "Build a Storm Shelter and walls before the big storms, and hide when the forecast is dangerous."
    };
  }

  function showDebrief(won) {
    S.ended = true;
    $("#overlay").classList.add("hidden");
    const solsSurvived = won ? TOTAL_SOLS : S.sol - 1;
    const bonus = won ? WIN_BONUS : 0;
    const score = solsSurvived + S.stars + bonus;
    const rows = S.history.map((h) =>
      `<tr><td>${h.sol}</td><td>${h.icon} ${h.title}</td><td>${h.choice}</td><td>${h.power}</td><td>${h.life}</td><td>${h.health}</td></tr>`).join("");
    const table = rows ? `<table class="timeline"><tr><th>Sol</th><th>Event</th><th>Your choice</th><th>⚡</th><th>💨</th><th>🧑‍🚀</th></tr>${rows}</table>` : "";
    let body;
    if (won) {
      body =
        `<h2>🏆 Mission complete!</h2>` +
        `<p class="headline">Your crew survived ${TOTAL_SOLS} real NASA events on Mars.</p>` +
        table +
        `<h3>Which real events did you survive?</h3><ul class="events-survived">` +
        EVENTS.map((e) => `<li>${e.icon} ${e.title} – <a href="${e.citation.url}" target="_blank" rel="noopener">${e.citation.text}</a></li>`).join("") +
        `</ul>` +
        `<p class="tip">🐱 Astro-Cat: "Real mission planners make these same trade-offs every day: power, air, and safety from radiation. You're a natural!"</p>`;
    } else {
      const rc = rootCause();
      body =
        `<h2>📋 Mission debrief</h2>` +
        `<p class="headline">Mission paused: ${rc.head}.</p>` +
        table +
        `<p><b>What went wrong:</b> ${rc.why}</p>` +
        `<p class="tip">💡 <b>What a real mission planner would try:</b> ${rc.tip}</p>` +
        `<p>🐱 Astro-Cat: "Nice try, commander! Every real mission learns from the last one."</p>`;
    }
    $("#debrief").innerHTML = body +
      `<p class="score">Score: ${solsSurvived} Sols + ${S.stars} ⭐${bonus ? " + " + bonus + " crew-home bonus" : ""} = ${score}</p>` +
      `<div class="row"><button class="btn btn-play" data-action="begin">↻ Try again</button>` +
      `<button class="btn btn-blue" data-action="home">🏠 Home</button></div>`;
    showScreen("debrief");
  }

  // ---------- data sources screen ----------
  function renderSources() {
    const fixed = [
      { name: "NASA DONKI (Space Weather Database)", what: "Real solar flares and solar particle storms: dates, classes, speeds.", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/", badge: "ARCHIVE" },
      { name: "Curiosity RAD (Radiation Assessment Detector)", what: "Real radiation measured on the surface of Mars, about 0.67 mSv per day.", url: "https://doi.org/10.1126/science.1244797", badge: "ARCHIVE" },
      { name: "JPL Horizons", what: "Earth–Mars distance on each event date, which sets the message delay for Ask Earth.", url: "https://ssd.jpl.nasa.gov/horizons/", badge: "ARCHIVE" },
      { name: "NASA Opportunity mission", what: "The 2018 global dust storm that ended the rover's mission.", url: "https://science.nasa.gov/mission/mer-opportunity/", badge: "ARCHIVE" }
    ];
    $("#sources-list").innerHTML = fixed.map((s) =>
      `<div class="src"><div class="name">${s.name} <span class="badge archive">${s.badge}</span></div>` +
      `<div>${s.what}</div><div class="citation"><a href="${s.url}" target="_blank" rel="noopener">${s.url}</a></div></div>`).join("");
  }

  // ---------- wiring ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a === "start") showScreen("brief");
    else if (a === "begin") { newGame(); showScreen("game"); renderGame(); say(prepareHint()); }
    else if (a === "sources") { renderSources(); showScreen("sources"); }
    else if (a === "home") showScreen("title");
    else if (a === "build") doBuild(el.dataset.id);
    else if (a === "work") doWork(el.dataset.id);
    else if (a === "ready") openEvent();
    else if (a === "ask-earth") askEarth();
    else if (a === "choose") resolve(el.dataset.id);
    else if (a === "next") nextSol();
  });

  if (!EVENTS.length) console.error("No events loaded: check data/events.js");
})();
