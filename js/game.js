// Mars: Sols of Survival – game logic
// Plain JS, no build step. Archive events come from data/events.js (window.MISSION_EVENTS).
// Art comes from assets/*.png when present; otherwise an emoji is shown.
(function () {
  "use strict";

  // ===================== tuning numbers (change during playtests) =====================
  const START = { power: 70, life: 70, health: 100 };
  const UPKEEP = { power: 12, life: 10 };
  const HEALTH_UPKEEP = { mars: 1, moon: 2 }; // Moon background dose is about 2x Mars (Chang'e-4 vs RAD)
  const AP_PER_SOL = 2;
  // Crew Health lost if fully outside, by danger tier. Game scale, not real mSv.
  // Tier 5 is set so working outside with no walls through both big storms is fatal.
  const TIER_BASE = { 0: 0, 1: 2, 2: 6, 3: 15, 4: 30, 5: 50 };
  const SHIELD_CUT = 0.25;      // each wall blocks 25% of solar particles
  const SHELTER_FACTOR = 0.15;  // shelter blocks 85%
  const REINFORCE_FACTOR = 0.6; // building walls during the storm: partly exposed
  const WIN_BONUS = 10;
  const LIVE_TIMEOUT_MS = 4000;
  const NASA_KEY = "DEMO_KEY"; // public demo key; never put a personal key in client code

  const MODULES = {
    solar: { name: "Solar Panel", art: "solar", emoji: "🔆", max: 4, unlock: 1, cost: "1 AP", effect: "⚡ +10 per Sol in sunlight", lesson: "Panels only work when sunlight reaches them." },
    greenhouse: { name: "Greenhouse", art: "greenhouse", emoji: "🌱", max: 3, unlock: 1, cost: "1 AP · ⚡ −6 per Sol", effect: "💨 +9 per Sol", lesson: "Growing food takes a lot of power." },
    wall: { name: "Regolith Wall", art: "wall", emoji: "🧱", max: 3, unlock: 2, cost: "1 AP · ⚡ −5 once", effect: "🛡️ +1 Shield", lesson: "Walls of soil block solar particles." },
    shelter: { name: "Storm Shelter", art: "shelter", emoji: "🏠", max: 1, unlock: 2, cost: "1 AP · ⚡ −2 per Sol", effect: "Unlocks Shelter (blocks 85%)", lesson: "Safe, but nobody works while hiding." }
  };
  const WORK = {
    science: { name: "Science Walk", emoji: "🔭", cost: "1 AP · 🧑‍🚀 −2 (outside)", effect: "⭐ +1", can: () => true },
    tend: { name: "Tend Crops", emoji: "🧑‍🌾", cost: "1 AP", effect: "💨 +4 per greenhouse", can: (s) => s.modules.greenhouse > 0 },
    clean: { name: "Clean Panels", emoji: "🧽", cost: "1 AP · 🧑‍🚀 −1 (outside)", effect: "More sun tonight if dusty", can: (s) => s.modules.solar > 0 && !s.cleaned && s.site === "mars" }
  };

  const ART = ["cat", "cat-point", "rover", "bg-mars", "bg-moon", "habitat", "solar", "greenhouse", "wall", "shelter",
    "site-mars", "site-moon", "card-quick", "card-endless", "card-live", "card-family"];
  const ARTOK = new Set();

  const RADIATION_TYPES = ["flare", "sep", "cme"];
  const POWER_TYPES = ["dust", "night"];

  // ===================== state =====================
  let S = null;
  let mission = "quick";
  let site = "mars";
  let liveEvents = null;     // events built from today's DONKI data
  let livePromise = null;
  let liveState = "idle";    // idle | loading | live | offline

  function newGame(events) {
    S = {
      site, mission, events,
      unit: site === "moon" ? "Day" : "Sol",
      sol: 1,
      power: START.power, life: START.life, health: START.health,
      shield: 0, stars: 0, ap: AP_PER_SOL,
      modules: { solar: 0, greenhouse: 0, wall: 0, shelter: 0 },
      tiles: {},          // "r,c" -> module id
      lastPlaced: null,
      placing: null,      // module id being placed
      tab: "build",
      cleaned: false,
      askedEarth: null,
      history: [],
      ended: false
    };
    for (let r = 2; r <= 3; r++) for (let c = 2; c <= 3; c++) S.tiles[r + "," + c] = "habitat";
  }

  // ===================== helpers =====================
  const $ = (sel) => document.querySelector(sel);
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const currentEvent = () => S.events[S.sol - 1];
  const totalSols = () => S.events.length;
  const isRad = (ev) => RADIATION_TYPES.includes(ev.type);
  const isPowerEvent = (ev) => POWER_TYPES.includes(ev.type);
  const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(Math.round(n));
  const badge = (mode) => `<span class="badge ${mode === "LIVE" ? "live" : mode === "OFFLINE" ? "offline" : "archive"}">${mode === "OFFLINE" ? "OFFLINE – ARCHIVE" : mode}</span>`;

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
    $("#screen-" + id).classList.add("active");
    window.scrollTo(0, 0);
  }

  function fmtMinutes(m) {
    if (m < 1) { const s = Math.round(m * 60 * 10) / 10; return s + " seconds"; }
    if (m < 60) { const r = Math.round(m); return r + (r === 1 ? " minute" : " minutes"); }
    if (m < 1440) { const h = Math.round(m / 60); return h + (h === 1 ? " hour" : " hours"); }
    const d = Math.round(m / 1440); return d + (d === 1 ? " day" : " days");
  }
  const dangerMeter = (tier) => "🔴".repeat(tier) + "⚪".repeat(5 - tier);

  // ===================== art =====================
  function preloadArt(onProgress) {
    let done = 0;
    return Promise.all(ART.map((name) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { ARTOK.add(name); resolve(); };
      img.onerror = () => resolve();
      img.src = "assets/" + name + ".png";
    }).then(() => onProgress(++done / ART.length))));
  }

  function artHTML(name, emoji, fallbackName) {
    const use = ARTOK.has(name) ? name : (fallbackName && ARTOK.has(fallbackName) ? fallbackName : null);
    return use ? `<img src="assets/${use}.png" alt="">` : `<span class="emoji">${emoji}</span>`;
  }

  function fillArt(root) {
    (root || document).querySelectorAll(".art-slot").forEach((el) => {
      el.innerHTML = artHTML(el.dataset.art, el.dataset.emoji || "", el.dataset.fallbackArt);
    });
    document.body.classList.toggle("has-bg-mars", ARTOK.has("bg-mars"));
    document.body.classList.toggle("has-bg-moon", ARTOK.has("bg-moon"));
  }

  // ===================== settings =====================
  const SETTINGS_KEY = "sols-settings-v1";
  const settings = { sound: true, readAloud: false, textSize: 18, calm: false, reminder: 0 };
  let reminderTimer = null;

  function loadSettings() {
    try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (e) { /* storage blocked: use defaults */ }
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }
  function applySettings() {
    document.documentElement.style.fontSize = settings.textSize + "px";
    document.body.classList.toggle("calm", settings.calm);
    document.querySelectorAll(".toggle").forEach((t) => t.setAttribute("aria-checked", String(!!settings[t.dataset.id])));
    $("#text-size").value = settings.textSize;
    $("#reminder").value = String(settings.reminder);
    clearTimeout(reminderTimer);
    if (settings.reminder > 0) {
      reminderTimer = setTimeout(() => {
        say("Crew shift over! Great work today. Come back tomorrow? 🌙");
        if (!$("#screen-game").classList.contains("active")) alert("Astro-Cat: Crew shift over! Great work today. Come back tomorrow?");
      }, settings.reminder * 60000);
    }
    if (!settings.readAloud && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // ===================== sound (tiny synth, no files) =====================
  let audio = null;
  function beep(freq, dur, type) {
    if (!settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur);
    } catch (e) { /* no audio */ }
  }
  const sfx = {
    click: () => beep(660, 0.08),
    build: () => { beep(520, 0.1); setTimeout(() => beep(780, 0.12), 90); },
    alarm: () => { beep(330, 0.25, "square"); setTimeout(() => beep(260, 0.3, "square"), 260); },
    good: () => { beep(660, 0.1); setTimeout(() => beep(880, 0.15), 100); },
    bad: () => { beep(300, 0.2, "triangle"); setTimeout(() => beep(220, 0.3, "triangle"), 180); }
  };

  function speak(text) {
    if (!settings.readAloud || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s.,!?'’:;-]/gu, ""));
      u.lang = "en-US"; u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  function say(text) {
    const el = $("#cat-say");
    if (el) el.textContent = text;
    speak(text);
  }

  // ===================== live NASA DONKI =====================
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }
  async function getJSON(url) {
    const r = await withTimeout(fetch(url), LIVE_TIMEOUT_MS);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  // Approximate Earth–Mars light time today from simple circular orbits (good to a minute or two).
  function marsLightMinutesToday() {
    const d = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000;
    const rad = Math.PI / 180;
    const le = (100.46 + 0.9856474 * d) * rad, lm = (355.45 + 0.5240208 * d) * rad;
    const ex = Math.cos(le), ey = Math.sin(le), mx = 1.5237 * Math.cos(lm), my = 1.5237 * Math.sin(lm);
    const au = Math.hypot(mx - ex, my - ey);
    return Math.round(au * 499 / 60);
  }

  function flareTier(cls) {
    const k = (cls || "").charAt(0).toUpperCase();
    return k === "X" ? 2 : k === "M" ? 1 : 1;
  }
  function cmeTier(speed) { return speed > 1000 ? 4 : speed >= 500 ? 3 : speed >= 300 ? 2 : 1; }
  const day = (iso) => (iso || "").slice(0, 10);

  async function fetchLiveEvents(forSite) {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const q = `startDate=${start}&endDate=${end}&api_key=${NASA_KEY}`;
    const base = "https://api.nasa.gov/DONKI/";
    const [sepR, cmeR, flrR] = await Promise.allSettled([
      getJSON(base + "SEP?" + q),
      getJSON(base + "CMEAnalysis?" + q + "&mostAccurateOnly=true"),
      getJSON(base + "FLR?" + q)
    ]);
    if (sepR.status === "rejected" && cmeR.status === "rejected" && flrR.status === "rejected") throw new Error("all live calls failed");

    const delay = forSite === "moon" ? 0.022 : marsLightMinutesToday();
    const placeName = forSite === "moon" ? "the Moon" : "Mars";
    const evs = [];

    const seps = sepR.status === "fulfilled" && Array.isArray(sepR.value) ? sepR.value : [];
    if (seps.length) {
      const s = seps[seps.length - 1];
      evs.push({
        id: s.sepID, type: "sep", icon: "☢️", title: "Particle storm this week!", next: "PARTICLE STORM",
        headline: `NASA recorded a real solar particle storm on ${day(s.eventTime)}!`,
        why: "Fast particles from the Sun can hurt the crew. Walls or a shelter keep them out.",
        realScience: `This event comes from NASA's DONKI database today. A solar energetic particle (SEP) event was recorded on ${day(s.eventTime)}. Particle storms like this are why real bases need shielding.`,
        dangerTier: 4, warningMinutes: 30, lightDelayMinutes: delay, blackout: false, sunlight: 1,
        realNumber: `DONKI event ${s.sepID}.`,
        citation: { text: `NASA DONKI – SEP ${day(s.eventTime)}`, url: s.link || "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: { choice: "shelter", text: "A real particle storm. Shelter is the safe choice." }, mode: "LIVE"
      });
    }

    const cmes = cmeR.status === "fulfilled" && Array.isArray(cmeR.value) ? cmeR.value.filter((c) => c.speed) : [];
    if (cmes.length) {
      const c = cmes.slice().sort((a, b) => b.speed - a.speed)[0];
      const tier = cmeTier(c.speed);
      const travelMin = Math.round(1.5e8 / c.speed / 60);
      evs.push({
        id: c.associatedCMEID, type: "cme", icon: "🌀", title: "Coronal mass ejection", next: "SOLAR CLOUD",
        headline: `The Sun threw out a giant cloud of gas at ${Math.round(c.speed)} km/s!`,
        why: "The cloud itself isn't radiation, but fast clouds can push particles ahead of them.",
        realScience: `A coronal mass ejection (CME) is a huge cloud of charged gas and magnetic field thrown off by the Sun. NASA measured this one on ${day(c.time21_5 || c.associatedCMEstartTime)} moving at ${Math.round(c.speed)} km/s. Faster CMEs are more likely to drive dangerous particle storms.`,
        dangerTier: Math.max(1, tier - 1), warningMinutes: travelMin, lightDelayMinutes: delay, blackout: false, sunlight: 1,
        realNumber: `Fastest CME this week: ${Math.round(c.speed)} km/s (DONKI CME Analysis).`,
        citation: { text: `NASA DONKI – CME ${day(c.associatedCMEstartTime)}`, url: c.associatedCMELink || "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: tier >= 3 ? { choice: "reinforce", text: "A fast CME. Strengthen the walls just in case." } : { choice: "work", text: "A slow CME. Keep working, but watch the forecast." },
        mode: "LIVE"
      });
    }

    const flrs = flrR.status === "fulfilled" && Array.isArray(flrR.value) ? flrR.value : [];
    if (flrs.length) {
      const order = (f) => ({ X: 3, M: 2, C: 1 }[(f.classType || "").charAt(0)] || 0) * 100 + parseFloat((f.classType || "0").slice(1) || 0);
      const f = flrs.slice().sort((a, b) => order(b) - order(a))[0];
      evs.push({
        id: f.flrID, type: "flare", icon: "🌞", title: `${f.classType} solar flare`, next: "FLARE",
        headline: `The Sun made a ${f.classType} flare on ${day(f.peakTime)}!`,
        why: "Flares are bright flashes from the Sun. Sometimes a particle storm follows.",
        realScience: `NASA's DONKI database recorded a class ${f.classType} flare this week. Flare classes go A, B, C, M, X, and each letter is 10 times stronger than the one before.`,
        dangerTier: flareTier(f.classType), warningMinutes: 8, lightDelayMinutes: delay, blackout: f.classType && f.classType[0] === "X",
        blackoutText: "The flare's burst of radio noise is drowning out the signal. You must decide alone.",
        sunlight: 1, realNumber: `Flare class ${f.classType}, peak ${f.peakTime}.`,
        citation: { text: `NASA DONKI – Flare ${day(f.peakTime)}`, url: f.link || "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: { choice: "work", text: "Flares alone are mostly light, not particles. Keep working unless particles follow." }, mode: "LIVE"
      });
    }

    evs.sort((a, b) => a.dangerTier - b.dangerTier);
    while (evs.length < 3) {
      evs.unshift({
        id: "calm-live-" + evs.length, type: "quiet", icon: "☀️", title: "Calm Sun this week!", next: "CALM",
        headline: "NASA's live data shows the Sun has been calm. Good news!",
        why: `Most days really are calm. Use them to build up your base on ${placeName}.`,
        realScience: "We asked NASA's DONKI space-weather database about the last 7 days and found no more big events. Real forecasters watch the Sun around the clock, because calm can change fast.",
        dangerTier: 0, warningMinutes: 1440, lightDelayMinutes: delay, blackout: false, sunlight: 1,
        realNumber: `Live check of NASA DONKI for ${start} to ${end}.`,
        citation: { text: "NASA DONKI – last 7 days", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: { choice: "tend", text: "Calm skies. Grow food and get ready." }, mode: "LIVE"
      });
    }
    return evs.slice(0, 3);
  }

  function startLiveFetch(forSite) {
    liveState = "loading";
    liveEvents = null;
    livePromise = fetchLiveEvents(forSite)
      .then((evs) => { liveEvents = evs; liveState = "live"; })
      .catch(() => { liveEvents = null; liveState = "offline"; });
    return livePromise;
  }

  // ===================== grid (isometric SVG) =====================
  const SVGNS = "http://www.w3.org/2000/svg";
  const N = 6, TW = 100, TH = 50, X0 = 300, Y0 = 90;
  const tileTop = (r, c) => ({ x: X0 + (c - r) * TW / 2, y: Y0 + (c + r) * TH / 2 });
  function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  function spriteNode(name, emoji, cx, baseY, size, isNew) {
    let n;
    if (ARTOK.has(name)) {
      n = svgEl("image", { href: "assets/" + name + ".png", x: cx - size / 2, y: baseY - size, width: size, height: size, class: "sprite" + (isNew ? " new" : "") });
    } else {
      n = svgEl("text", { x: cx, y: baseY, class: "sprite emoji-sprite" + (isNew ? " new" : ""), "font-size": Math.round(size * 0.62) });
      n.textContent = emoji;
    }
    return n;
  }

  function renderGrid() {
    const svg = $("#grid");
    svg.innerHTML = "";
    const tilesG = svgEl("g", {});
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = tileTop(r, c);
      const key = r + "," + c;
      const taken = !!S.tiles[key];
      const canPlace = S.placing && !taken;
      const poly = svgEl("polygon", {
        points: `${t.x},${t.y} ${t.x + TW / 2},${t.y + TH / 2} ${t.x},${t.y + TH} ${t.x - TW / 2},${t.y + TH / 2}`,
        class: "tile" + (taken ? " taken" : "") + (canPlace ? " can-place" : ""),
        "data-key": key
      });
      if (canPlace) {
        poly.setAttribute("tabindex", "0");
        poly.setAttribute("role", "button");
        poly.setAttribute("aria-label", `Place ${MODULES[S.placing].name} on row ${r + 1}, column ${c + 1}`);
      }
      tilesG.appendChild(poly);
    }
    svg.appendChild(tilesG);

    // sprites, back to front
    const sprites = [];
    sprites.push({ order: 5, node: () => spriteNode("habitat", "🛖", X0, Y0 + 150 + 38, 190, false) });
    Object.keys(S.tiles).forEach((key) => {
      const id = S.tiles[key];
      if (id === "habitat") return;
      const [r, c] = key.split(",").map(Number);
      const t = tileTop(r, c);
      const m = MODULES[id];
      sprites.push({ order: r + c, node: () => spriteNode(m.art, m.emoji, t.x, t.y + TH / 2 + 16, 96, key === S.lastPlaced) });
    });
    sprites.sort((a, b) => a.order - b.order).forEach((s) => svg.appendChild(s.node()));
  }

  function freeTiles() {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!S.tiles[r + "," + c]) out.push(r + "," + c);
    return out;
  }

  // ===================== rendering =====================
  function overnightPreview(sunlight, greenhouseOn) {
    const m = S.modules;
    const sun = Math.min(1, sunlight + (S.cleaned && sunlight > 0 && sunlight < 1 ? 0.3 : 0));
    const ghOn = greenhouseOn !== false;
    return {
      power: m.solar * 10 * sun - UPKEEP.power - (ghOn ? m.greenhouse * 6 : 0) - m.shelter * 2,
      life: (ghOn ? m.greenhouse * 9 : 0) - UPKEEP.life,
      health: -HEALTH_UPKEEP[S.site],
      sun
    };
  }

  function renderBars() {
    [["power", S.power], ["life", S.life], ["health", S.health]].forEach(([k, v]) => {
      const el = $("#bar-" + k);
      el.querySelector(".fill").style.width = Math.max(0, Math.min(100, v)) + "%";
      el.querySelector(".num").textContent = Math.round(v) + "/100";
      el.classList.toggle("low", v <= 25);
    });
    $("#sol-label").textContent = S.unit.toUpperCase() + " " + S.sol;
    $("#shield-num").textContent = S.shield;
    $("#stars-num").textContent = S.stars;
  }

  function renderAP() {
    const ap = $("#ap");
    ap.innerHTML = "";
    for (let i = 0; i < AP_PER_SOL; i++) {
      const d = document.createElement("span");
      d.className = "dot" + (i < S.ap ? " on" : "");
      ap.appendChild(d);
    }
    ap.setAttribute("aria-label", S.ap + " action points left");
  }

  function renderNet() {
    const ev = currentEvent();
    const p = overnightPreview(ev ? ev.sunlight : 1);
    const cls = (n) => (n >= 0 ? "pos" : "neg");
    const sky = ev && ev.sunlight === 0 ? " (no sun!)" : ev && ev.sunlight < 1 ? " (dusty sky)" : "";
    $("#net-line").innerHTML = `Tonight${sky}: <span class="${cls(p.power)}">⚡ ${signed(p.power)}</span> · ` +
      `<span class="${cls(p.life)}">💨 ${signed(p.life)}</span> · <span class="neg">🧑‍🚀 ${signed(p.health)}</span>`;
  }

  function renderTray() {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.id === S.tab));
    const t = $("#tray-buttons");
    t.innerHTML = "";
    if (S.tab === "build") {
      Object.keys(MODULES).forEach((k) => {
        const m = MODULES[k];
        if (S.sol < m.unlock && S.mission !== "live") return;
        const full = S.modules[k] >= m.max || (k === "wall" && S.shield >= 3);
        const b = document.createElement("button");
        b.className = "tray-btn " + k + (S.placing === k ? " selected" : "");
        b.dataset.action = "build"; b.dataset.id = k;
        b.disabled = S.ap <= 0 || full || !freeTiles().length;
        b.innerHTML = `<span class="t-name">${m.name}</span><span class="t-pic art-slot">${artHTML(m.art, m.emoji)}</span>` +
          `<span class="t-eff">${m.effect}</span><span class="t-cost">${full ? "Maximum built" : m.cost}</span>`;
        t.appendChild(b);
      });
      const locked = Object.keys(MODULES).filter((k) => S.sol < MODULES[k].unlock && S.mission !== "live");
      if (locked.length) {
        const d = document.createElement("div");
        d.className = "small"; d.style.color = "#cfe3ff"; d.style.textAlign = "center";
        d.textContent = "🔒 More buildings unlock on " + S.unit + " 2";
        t.appendChild(d);
      }
    } else {
      Object.keys(WORK).forEach((k) => {
        const w = WORK[k];
        if (k === "clean" && S.site !== "mars") return;
        const b = document.createElement("button");
        b.className = "tray-btn";
        b.dataset.action = "work"; b.dataset.id = k;
        b.disabled = S.ap <= 0 || !w.can(S);
        b.innerHTML = `<span class="t-name">${w.name}</span><span class="t-pic"><span class="emoji">${w.emoji}</span></span>` +
          `<span class="t-eff">${w.effect}</span><span class="t-cost">${w.cost}</span>`;
        t.appendChild(b);
      });
    }
  }

  function renderForecast() {
    const ev = currentEvent();
    const f = $("#forecast");
    if (!ev) { f.innerHTML = ""; return; }
    const danger = isPowerEvent(ev) ? "Power danger: " + dangerMeter(ev.type === "night" ? 5 : 4)
      : ev.type === "quiet" ? "Danger: none ✅" : "Radiation danger: " + dangerMeter(Math.max(1, ev.dangerTier));
    f.innerHTML =
      `<div class="big-ico">${ev.icon}</div>` +
      `<div><div class="fc-label">FORECAST</div>` +
      `<div class="fc-next">THIS ${S.unit.toUpperCase()}: <b>${ev.next || ev.title.toUpperCase()}</b></div>` +
      `<div class="meta">${danger}</div>` +
      `<div class="meta">Warning time: <b>${fmtMinutes(ev.warningMinutes)}</b></div>` +
      `<div class="meta">${ev.citation.text} ${badge(ev.mode)}</div></div>`;
  }

  function prepareHint() {
    const ev = currentEvent();
    const u = S.unit;
    if (S.sol === 1 && S.mission === "quick") return "Let's build a Solar Panel to make more power! The greenhouse makes air and food, but it eats power.";
    if (S.power <= 25) return "Power is low! More solar panels, or fewer greenhouses?";
    if (S.life <= 25) return "Air and food are low! A greenhouse or tending crops will help.";
    if (ev.type === "sep") return "A solar particle storm is coming! Walls and a shelter protect the crew, but they cost power and time.";
    if (ev.type === "cme") return "A giant cloud from the Sun is on its way. Fast ones can bring particles. Get ready!";
    if (ev.type === "flare") return ev.blackout ? "A big flare means you may not be able to reach Earth. Will you hide or keep working?" : "A flare is coming. Flares are mostly light. Will particles follow?";
    if (ev.type === "dust") return "A dust storm is coming. Panels will barely work. Clean them, or plan to save power!";
    if (ev.type === "night") return "Night is coming: no sun at all for your panels. Save up power now!";
    return `Use your 2 actions, then press Ready. (${u} = one day here.)`;
  }

  function renderGame() {
    renderBars(); renderAP(); renderGrid(); renderNet(); renderTray(); renderForecast();
  }

  // ===================== prepare phase =====================
  function selectBuild(id) {
    if (S.ap <= 0) return;
    S.placing = S.placing === id ? null : id;
    S.tab = "build";
    if (S.placing) say("Tap a glowing tile to place the " + MODULES[id].name + "!");
    renderGame();
    if (S.placing) { const first = document.querySelector("#grid .tile.can-place"); if (first && !matchMedia("(pointer: coarse)").matches) first.focus(); }
  }

  function placeOn(key) {
    const id = S.placing;
    if (!id || S.tiles[key] || S.ap <= 0) return;
    const m = MODULES[id];
    if (S.modules[id] >= m.max) return;
    S.ap--;
    S.modules[id]++;
    S.tiles[key] = id;
    S.lastPlaced = key;
    S.placing = null;
    if (id === "wall") { S.shield = Math.min(3, S.shield + 1); S.power = clamp(S.power - 5); }
    sfx.build();
    say(m.name + " built! " + m.lesson);
    renderGame();
    S.lastPlaced = null;
    checkLose();
  }

  function doWork(id) {
    if (S.ap <= 0) return;
    S.placing = null;
    S.ap--;
    if (id === "science") { S.stars += 1; S.health = clamp(S.health - 2); say("🔭 Great find! +1 Science Star. Being outside gave the crew a little radiation."); }
    if (id === "tend") { S.life = clamp(S.life + 4 * S.modules.greenhouse); say("🧑‍🌾 The plants look happy. More air and food!"); }
    if (id === "clean") { S.cleaned = true; say("🧽 Clean panels catch more light when the sky is dusty."); }
    sfx.click();
    renderGame();
    checkLose();
  }

  // ===================== event phase =====================
  function choicesFor(ev) {
    const hasShelter = S.modules.shelter > 0;
    if (isRad(ev)) {
      return [
        { id: "shelter", icon: "🏠", name: "Shelter", cost: hasShelter ? "Crew is safe · 💨 −6 (no one tends plants) · ⚡ −3 · ⭐ 0" : "Build a Storm Shelter first!", enabled: hasShelter },
        { id: "work", icon: "⛏️", name: "Keep working", cost: "Full radiation hit (walls help) · ⭐ +2", enabled: true },
        { id: "reinforce", icon: "🧱", name: "Reinforce now", cost: S.ap > 0 && S.shield < 3 ? "Uses 1 AP · ⚡ −5 · some radiation · ⭐ +1" : (S.shield >= 3 ? "Walls are already maxed" : "Needs 1 saved AP"), enabled: S.ap > 0 && S.shield < 3 && freeTiles().length > 0 }
      ];
    }
    if (isPowerEvent(ev)) {
      return [
        { id: "powerdown", icon: "🔌", name: "Turn greenhouse down", cost: "Saves power tonight · 💨 no new air or food tonight", enabled: true },
        { id: "keepon", icon: "💡", name: "Keep everything on", cost: "Normal air and food · ⚡ uses lots of power with no sun", enabled: true }
      ];
    }
    return [
      { id: "tend", icon: "🌱", name: "Garden day", cost: "💨 +6 · ⚡ −2", enabled: true },
      { id: "science", icon: "🔭", name: "Big science day", cost: "⭐ +2 · ⚡ −3 · 🧑‍🚀 −2 (outside)", enabled: true }
    ];
  }

  function openEvent() {
    const ev = currentEvent();
    S.placing = null;
    S.askedEarth = null;
    const ov = $("#overlay");
    ov.classList.remove("hidden", "flash", "redsky", "dark");
    void ov.offsetWidth;
    if (isRad(ev)) { ov.classList.add("flash"); sfx.alarm(); }
    if (ev.type === "dust") { ov.classList.add("redsky"); sfx.alarm(); }
    if (ev.type === "night") ov.classList.add("dark");

    const choices = choicesFor(ev);
    const earthBtn = ev.blackout
      ? `<button class="btn" disabled>📡 Ask Earth</button><p>📵 <b>No signal!</b> ${ev.blackoutText || "You must decide alone."}</p>`
      : `<button class="btn" data-action="ask-earth">📡 Ask Earth</button><p id="earth-reply">Message time to Earth today: <b>${fmtMinutes(ev.lightDelayMinutes)}</b> each way.</p>`;

    $("#modal").innerHTML =
      `<div class="ev-head"><div class="big-ico">${ev.icon}</div><div><h2>${S.unit} ${S.sol}: ${ev.title}</h2>` +
      `<div class="citation">${ev.citation.text} ${badge(ev.mode)}</div></div></div>` +
      `<p class="cat-line"><span class="mini-cat art-slot">${artHTML("cat", "🐱")}</span><span><b>${ev.headline}</b><br><span class="why">${ev.why}</span></span></p>` +
      `<details class="real"><summary>🔬 Real Science</summary><p>${ev.realScience}</p>` +
      `<p class="citation">Source: <a href="${ev.citation.url}" target="_blank" rel="noopener">${ev.citation.text}</a></p></details>` +
      `<h3>What will you do?</h3><div class="choices">` +
      choices.map((c) => `<button class="choice" data-action="choose" data-id="${c.id}" ${c.enabled ? "" : "disabled"}>` +
        `<span class="name">${c.icon} ${c.name}</span><span class="cost">${c.cost}</span></button>`).join("") +
      `</div><div class="earth">${earthBtn}</div>`;
    speak(ev.headline + " " + ev.why);
    const first = $("#modal").querySelector(".choice:not([disabled])");
    if (first) first.focus();
  }

  function askEarth() {
    const ev = currentEvent();
    const roundTrip = ev.lightDelayMinutes * 2;
    const reply = $("#earth-reply");
    const btn = $('[data-action="ask-earth"]');
    if (btn) btn.disabled = true;
    sfx.click();
    if (!ev.earthAdvice) { reply.textContent = "Mission Control has no advice for this one."; return; }
    if (roundTrip <= ev.warningMinutes) {
      S.askedEarth = "intime";
      reply.innerHTML = `✅ Reply arrived in ${fmtMinutes(roundTrip)}, in time! Mission Control says: <b>"${ev.earthAdvice.text}"</b>`;
      const rec = $(`.choice[data-id="${ev.earthAdvice.choice}"]`);
      if (rec) rec.classList.add("recommended");
      speak("Mission Control says: " + ev.earthAdvice.text);
    } else {
      S.askedEarth = "late";
      reply.innerHTML = `⏳ Your message needs <b>${fmtMinutes(roundTrip)}</b> to reach Earth and come back, but the storm arrives in <b>${fmtMinutes(ev.warningMinutes)}</b>. ` +
        `Earth's reply will be too late. <b>Real crews this far away have to decide on their own!</b>`;
      speak("Earth's reply is still on its way! Real crews decide on their own.");
    }
  }

  function resolve(choiceId) {
    const ev = currentEvent();
    const before = { power: S.power, life: S.life, health: S.health, stars: S.stars };
    let because = "";
    let greenhouseOn = true;

    if (isRad(ev)) {
      if (choiceId === "reinforce") {
        const free = freeTiles();
        const key = free[Math.floor(Math.random() * free.length)];
        S.ap--; S.shield = Math.min(3, S.shield + 1); S.modules.wall++; S.tiles[key] = "wall"; S.lastPlaced = key;
        S.power -= 5; S.stars += 1;
      }
      const base = TIER_BASE[ev.dangerTier] || 0;
      const afterWalls = base * (1 - SHIELD_CUT * S.shield);
      const factor = choiceId === "shelter" ? SHELTER_FACTOR : choiceId === "reinforce" ? REINFORCE_FACTOR : 1;
      const hit = Math.round(afterWalls * factor);
      S.health -= hit;
      if (choiceId === "shelter") { S.life -= 6; S.power -= 3; }
      if (choiceId === "work") S.stars += 2;

      if (ev.dangerTier <= 1) {
        because = choiceId === "shelter"
          ? "No big particle storm came, so hiding cost air and work for almost nothing. Forecasting is hard!"
          : "No big particle storm came this time, so working was the right call.";
      } else if (choiceId === "shelter") {
        because = `The shelter blocked most of the particles, so the crew lost only ${hit} health. But nobody tended the plants, so air dropped.`;
      } else if (choiceId === "reinforce") {
        because = `New walls blocked some particles while the crew built them. The crew lost ${hit} health.`;
      } else {
        because = S.shield > 0
          ? `Your walls blocked ${S.shield * 25}% of the particles, but working outside still cost ${hit} health.`
          : `With no walls and no shelter, the crew soaked up the whole storm: −${hit} health.`;
      }
    } else if (isPowerEvent(ev)) {
      greenhouseOn = choiceId !== "powerdown";
      const what = ev.type === "night" ? "with no sunlight at all" : "under the dusty sky";
      because = greenhouseOn
        ? `The greenhouse kept making air and food, but the panels could not pay for its power ${what}.`
        : "Turning the greenhouse down saved power, but the crew made no new air or food tonight.";
    } else {
      if (choiceId === "tend") { S.life += 6; S.power -= 2; because = "A calm day is a great day to grow food. It still costs a little power."; }
      if (choiceId === "science") { S.stars += 2; S.power -= 3; S.health -= 2; because = "Great science! But time outside means a little extra radiation."; }
    }

    const night = overnightPreview(ev.sunlight, greenhouseOn);
    S.power = clamp(S.power + night.power);
    S.life = clamp(S.life + night.life);
    S.health = clamp(S.health + night.health);

    const choiceName = (choicesFor(ev).find((c) => c.id === choiceId) || { name: choiceId }).name;
    S.history.push({ sol: S.sol, title: ev.title, icon: ev.icon, choice: choiceName, power: S.power, life: S.life, health: S.health });
    renderGame();
    S.lastPlaced = null;
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
      earthLine = `<p class="realnum">📡 Earth's reply arrived <b>${fmtMinutes(lateBy)} after</b> the storm hit: <i>"${ev.earthAdvice.text}"</i></p>`;
    }
    const sunTxt = night.sun < 1 ? ` Sunlight was only ${Math.round(night.sun * 100)}%, so panels made ${night.sun === 0 ? "nothing" : "less power"}.` : "";
    const lost = S.health < before.health - 10 || S.power < 20 || S.life < 20;
    lost ? sfx.bad() : sfx.good();
    $("#modal").innerHTML =
      `<h2>${ev.icon} What happened</h2>` +
      `<div class="deltas">${d("power", "⚡", "Power")}${d("life", "💨", "Life Support")}${d("health", "🧑‍🚀", "Crew Health")}</div>` +
      `<p class="because"><b>Because…</b> ${because}</p>` +
      `<p class="realnum">🔬 <b>Real life:</b> ${ev.realNumber} ${badge(ev.mode)}</p>` + earthLine +
      `<p class="overnight">🌙 Overnight the base used its daily power, air and food, and background cosmic rays cost ${HEALTH_UPKEEP[S.site]} health.${sunTxt}</p>` +
      (S.stars > before.stars ? `<p>⭐ +${S.stars - before.stars} Science Star${S.stars - before.stars > 1 ? "s" : ""}!</p>` : "") +
      `<div class="modal-actions"><button class="btn btn-go" data-action="next">${S.sol >= totalSols() ? "Finish mission ▶" : "Next " + S.unit + " ▶"}</button></div>`;
    speak("Because. " + because);
    $('[data-action="next"]').focus();
  }

  function nextSol() {
    $("#overlay").classList.add("hidden");
    if (checkLose()) return;
    if (S.sol >= totalSols()) { showDebrief(true); return; }
    S.sol++;
    S.ap = AP_PER_SOL;
    S.cleaned = false;
    renderGame();
    say(prepareHint());
  }

  function checkLose() {
    if (S.ended) return true;
    if (S.power <= 0 || S.life <= 0 || S.health <= 0) { showDebrief(false); return true; }
    return false;
  }

  // ===================== debrief =====================
  function rootCause() {
    const u = S.unit;
    if (S.power <= 0) {
      const gh = S.modules.greenhouse, so = S.modules.solar;
      return {
        head: `the base ran out of power on ${u} ${S.sol}`,
        why: gh * 6 > so * 10 ? `Your greenhouses used more power (${gh * 6} per ${u}) than your panels could make (${so * 10} on a sunny day).` : `The base used more power than the panels could make, especially when ${S.site === "moon" ? "night" : "dust"} blocked the Sun.`,
        tip: S.site === "moon" ? "Build extra solar panels before the lunar night, and turn the greenhouse down in the dark." : "Build another solar panel early, and turn the greenhouse down during dust storms."
      };
    }
    if (S.life <= 0) {
      return {
        head: `the crew ran out of air and food on ${u} ${S.sol}`,
        why: S.modules.greenhouse === 0 ? "There was no greenhouse to make new air and food." : "The greenhouse could not keep up, especially on days the crew hid or turned it down.",
        tip: `Build a greenhouse on ${u} 1, and back it up with enough solar panels.`
      };
    }
    return {
      head: `the crew got too much radiation on ${u} ${S.sol}`,
      why: S.shield === 0 ? "The base had no walls, so particle storms hit the crew at full strength." : "Working outside during a strong particle storm gave the crew a big dose.",
      tip: "Build a Storm Shelter and walls before the big storms, and hide when the forecast is dangerous."
    };
  }

  function showDebrief(won) {
    S.ended = true;
    $("#overlay").classList.add("hidden");
    const n = totalSols();
    const solsSurvived = won ? n : S.sol - 1;
    const bonus = won ? WIN_BONUS : 0;
    const score = solsSurvived + S.stars + bonus;
    const rows = S.history.map((h) => `<tr><td>${h.sol}</td><td>${h.icon} ${h.title}</td><td>${h.choice}</td><td>${h.power}</td><td>${h.life}</td><td>${h.health}</td></tr>`).join("");
    const table = rows ? `<table class="timeline"><tr><th>${S.unit}</th><th>Event</th><th>Your choice</th><th>⚡</th><th>💨</th><th>🧑‍🚀</th></tr>${rows}</table>` : "";
    const where = S.site === "moon" ? "on the Moon" : "on Mars";
    let body;
    if (won) {
      sfx.good();
      body = `<h2>🏆 Mission complete!</h2><p class="headline">Your crew survived ${n} real NASA events ${where}.</p>` + table +
        `<h3>Which real events did you survive?</h3><ul class="events-survived">` +
        S.events.map((e) => `<li>${e.icon} ${e.title} – <a href="${e.citation.url}" target="_blank" rel="noopener">${e.citation.text}</a> ${badge(e.mode)}</li>`).join("") + `</ul>` +
        `<p class="tip">🐱 Astro-Cat: "Real mission planners make these same trade-offs every day: power, air, and safety from radiation. You're a natural!"</p>`;
    } else {
      sfx.bad();
      const rc = rootCause();
      body = `<h2>📋 Mission debrief</h2><p class="headline">Mission paused: ${rc.head}.</p>` + table +
        `<p><b>What went wrong:</b> ${rc.why}</p><p class="tip">💡 <b>What a real mission planner would try:</b> ${rc.tip}</p>` +
        `<p>🐱 Astro-Cat: "Nice try, commander! Every real mission learns from the last one."</p>`;
    }
    $("#debrief").innerHTML = body +
      `<p class="score">Score: ${solsSurvived} ${S.unit}s + ${S.stars} ⭐${bonus ? " + " + bonus + " crew-home bonus" : ""} = ${score}</p>` +
      `<div class="row"><button class="btn btn-play" data-action="again">↻ TRY AGAIN</button><button class="btn btn-blue" data-action="home">🏠 HOME</button></div>`;
    showScreen("debrief");
  }

  // ===================== briefing =====================
  function showBrief() {
    const where = site === "moon" ? "the Moon" : "Mars";
    const u = site === "moon" ? "Day" : "Sol";
    const unitNote = site === "moon"
      ? "<b>Day</b> = one Earth day here. The Moon is close, so messages reach Earth in about 1.3 seconds."
      : "<b>Sol</b> = one day on Mars (24 hours and 40 minutes). Messages to Earth take 3 to 22 minutes!";
    const n = (mission === "live" ? (liveEvents ? liveEvents.length : 3) : window.MISSION_EVENTS[site].length);
    let liveNote = "";
    if (mission === "live") {
      liveNote = liveState === "live"
        ? `<p>${badge("LIVE")} We just checked NASA's space-weather database. These events happened on the Sun <b>this week</b>!</p>`
        : `<p>${badge("OFFLINE")} We couldn't reach NASA's live data right now, so you'll play real events from the archive instead.</p>`;
    }
    $("#brief").innerHTML =
      `<h2>Mission briefing</h2>` +
      `<p class="cat-line"><span class="mini-cat art-slot">${artHTML("cat", "🐱")}</span>Hi, commander! I'm Astro-Cat. Your crew on ${where} is counting on you. Keep these three bars above zero for <b>${n} ${u}s</b>.</p>` +
      liveNote +
      `<ul class="brief-list">` +
      `<li><span class="ico">⚡</span><b>Power</b> runs everything. It drops every ${u}.</li>` +
      `<li><span class="ico">💨</span><b>Life Support</b> is air, water and food. It drops every ${u}.</li>` +
      `<li><span class="ico">🧑‍🚀</span><b>Crew Health</b> drops when radiation hits the crew.</li></ul>` +
      `<p><i>"If any bar reaches zero, the mission ends. Every choice helps one thing and costs another."</i></p>` +
      `<p class="small">${unitNote}</p>` +
      `<div class="row"><button class="btn btn-blue" data-action="to-location">◀ BACK</button><button class="btn btn-play" data-action="begin">LET'S GO!</button></div>`;
    showScreen("brief");
  }

  function begin() {
    const events = mission === "live" ? (liveEvents || window.MISSION_EVENTS[site].slice(1, 4).map((e) => Object.assign({}, e, { mode: "OFFLINE" }))) : window.MISSION_EVENTS[site];
    newGame(events);
    showScreen("game");
    renderGame();
    say(prepareHint());
  }

  // ===================== data sources =====================
  function renderSources() {
    const liveBadge = liveState === "live" ? "LIVE" : liveState === "offline" ? "OFFLINE" : "LIVE";
    const list = [
      { ico: "🛰️", name: "NASA DONKI", what: "Space weather and solar event alerts: flares, particle storms, CMEs. Used live in Today's Space Weather and as an archive in Quick Mission.", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/", mode: liveBadge },
      { ico: "🤖", name: "CURIOSITY RAD", what: "Real radiation data from Gale Crater on Mars: about 0.67 mSv per day.", url: "https://doi.org/10.1126/science.1244797", mode: "ARCHIVE" },
      { ico: "🌕", name: "CHANG'E-4 LND", what: "Radiation measured on the Moon's surface: about 1.37 mSv per day.", url: "https://doi.org/10.1126/sciadv.aaz1334", mode: "ARCHIVE" },
      { ico: "🪐", name: "JPL HORIZONS", what: "Earth–Mars distance on each archive event date, which sets the Ask Earth delay. Today's delay is calculated from planet orbits.", url: "https://ssd.jpl.nasa.gov/horizons/", mode: "ARCHIVE" },
      { ico: "🌪️", name: "OPPORTUNITY ROVER", what: "The 2018 global dust storm on Mars that ended the rover's mission.", url: "https://science.nasa.gov/mission/mer-opportunity/", mode: "ARCHIVE" }
    ];
    $("#sources-list").innerHTML = list.map((s) =>
      `<div class="src"><div class="s-ico">${s.ico}</div><div><div class="s-name">${s.name}</div><div class="s-what">${s.what}</div>` +
      `<a href="${s.url}" target="_blank" rel="noopener">${s.url}</a></div>${badge(s.mode)}</div>`).join("");
  }

  // ===================== flow + wiring =====================
  function pickMission(id) {
    mission = id;
    $("#live-status").textContent = id === "live" ? "📡 Checking NASA's live space-weather data..." : "";
    showScreen("location");
  }

  async function pickSite(id) {
    site = id;
    document.body.classList.toggle("site-moon", id === "moon");
    document.body.classList.toggle("site-mars", id !== "moon");
    if (mission === "live") {
      $("#live-status").textContent = "📡 Asking NASA about the Sun this week...";
      await startLiveFetch(id);
    }
    showBrief();
  }

  document.addEventListener("click", (e) => {
    const tile = e.target.closest && e.target.closest("#grid .tile.can-place");
    if (tile) { placeOn(tile.getAttribute("data-key")); return; }
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a !== "toggle") sfx.click();
    if (a === "to-missions") showScreen("missions");
    else if (a === "pick-mission") pickMission(el.dataset.id);
    else if (a === "to-location") showScreen("location");
    else if (a === "pick-site") pickSite(el.dataset.id);
    else if (a === "begin" || a === "again") begin();
    else if (a === "home") { document.body.classList.remove("site-moon"); document.body.classList.add("site-mars"); showScreen("title"); }
    else if (a === "sources") { renderSources(); showScreen("sources"); }
    else if (a === "settings") $("#settings").classList.remove("hidden");
    else if (a === "close-settings") $("#settings").classList.add("hidden");
    else if (a === "toggle") { settings[el.dataset.id] = !settings[el.dataset.id]; saveSettings(); applySettings(); sfx.click(); }
    else if (a === "tab") { S.tab = el.dataset.id; S.placing = null; renderGame(); }
    else if (a === "build") selectBuild(el.dataset.id);
    else if (a === "work") doWork(el.dataset.id);
    else if (a === "ready") openEvent();
    else if (a === "ask-earth") askEarth();
    else if (a === "choose") resolve(el.dataset.id);
    else if (a === "next") nextSol();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("#grid .tile.can-place")) {
      e.preventDefault(); placeOn(e.target.getAttribute("data-key"));
    }
    if (e.key === "Escape") {
      if (!$("#settings").classList.contains("hidden")) $("#settings").classList.add("hidden");
      else if (S && S.placing) { S.placing = null; renderGame(); say("Okay, cancelled."); }
    }
  });
  $("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") $("#settings").classList.add("hidden"); });
  $("#text-size").addEventListener("input", (e) => { settings.textSize = Number(e.target.value); saveSettings(); applySettings(); });
  $("#reminder").addEventListener("change", (e) => { settings.reminder = Number(e.target.value); saveSettings(); applySettings(); });

  // ===================== boot: loading screen =====================
  loadSettings();
  applySettings();
  const t0 = Date.now();
  preloadArt((p) => {
    $("#loadfill").style.width = Math.round(p * 100) + "%";
    $("#rover").style.left = Math.round(p * 100) + "%";
  }).then(() => {
    fillArt();
    $("#loadfill").style.width = "100%"; $("#rover").style.left = "100%";
    setTimeout(() => showScreen("title"), Math.max(0, 1200 - (Date.now() - t0)));
  });
  fillArt(); // emoji fallbacks right away while images load
})();
