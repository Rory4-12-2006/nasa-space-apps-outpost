// Mars: Sols of Survival – game logic, design v2 (GDD v2 sections 4-12)
// Plain JS, no build step. Archive events: data/events.js (window.MISSION_EVENTS) and
// data/events-infinite.js (window.INFINITE_EVENTS). Art: assets/*.png when present, else emoji.
(function () {
  "use strict";

  // ===================== tuning numbers (GDD v2 section 11) =====================
  const START = { power: 70, life: 70, health: 100 };
  const UPKEEP = { power: 12, life: 10 };
  const HEALTH_UPKEEP = { mars: 1, moon: 2 };
  const ACTIONS_PER_SOL = 2;
  const CARGO_LIMIT = 7;
  const TIER_BASE = { 0: 0, 1: 2, 2: 6, 3: 15, 4: 30, 5: 50 }; // storm dose in Crew Health points (game scale)
  const SHIELD_CUT = 0.25, SHIELD_MAX = 3;
  const SHELTER_FACTOR = 0.15, REINFORCE_FACTOR = 0.6;
  const GOOD_FACTOR = 0.75;
  const CREDITS = { great: 20, good: 10, labGreat: 40, labGood: 20, survive: 10, keepWorking: 20, reinforce: 10, complete: 50 };
  const LIVE_TIMEOUT_MS = 4000;
  const NASA_KEY = "DEMO_KEY"; // public demo key; never put a personal key in client code
  const QUICK_SOLS = 5, LIVE_SOLS = 3;

  // ===================== modules (GDD v2 section 7) =====================
  const MODULES = {
    power: { name: "Power Station", emoji: "🔆", art: "station-power", inv: { mars: 3, moon: 3 },
      daily: "⚡ +7 × sunlight", info: { mars: "Mars gets only about 43% of the sunlight Earth gets and has dust storms.", moon: "The Moon has full sunlight but a night that lasts about 14 Earth days." },
      talk: "Power runs everything! But fixing panels means going outside, where there's more radiation." },
    greenhouse: { name: "Greenhouse", emoji: "🌱", art: "station-greenhouse", inv: { mars: 3, moon: 1 },
      daily: "💨 +3 · ⚡ −2", info: { mars: "Mars is months from Earth, so the crew must grow more of its own food.", moon: "The Moon can be resupplied in about 3 days." },
      talk: "Plants give us food and fresh air! But they drink our water and need power for their lights." },
    water: { name: "Water Station", emoji: "💧", art: "station-water", inv: { mars: 2, moon: 2 },
      daily: "💨 +2 · ⚡ −2", info: { mars: "Mars has ice buried under the ground in many mid-latitude places.", moon: "Moon water is rare and hidden in dark polar craters." },
      talk: "There's ice under the ground! Melting it gives us water, but heaters use lots of power." },
    shield: { name: "Radiation Shield", emoji: "🛡️", art: "station-shield", inv: { mars: 2, moon: 3 },
      daily: "🛡️ +1 · ⚡ −1", info: { mars: "Mars' thin air blocks a little radiation.", moon: "The Moon has no air at all, so it needs more shielding." },
      talk: "Thick walls keep space radiation out. But building them means working outside, and the brick press uses power." },
    lab: { name: "Research Lab", emoji: "🔬", art: "station-lab", inv: { mars: 1, moon: 1 },
      daily: "❤️ +1 · ⚡ −2 · forecast", info: { mars: "One lab to study rocks and the Sun.", moon: "One lab to study rocks and the Sun." },
      talk: "Science helps us find water and predict storms! But the lab uses power, and it doesn't give us food or air today." }
  };
  const MOD_ORDER = ["power", "greenhouse", "water", "shield", "lab"];

  // ===================== kittens (GDD v2 section 5) =====================
  const KITTENS = {
    nova: { name: "Nova", img: 1, color: "#3fbf6a", perk: "🌱 Botanist: Greenhouse missions +25%", hi: "Hi! I'm Nova. Let's grow a garden on another world!" },
    cosmo: { name: "Cosmo", img: 2, color: "#3f8fe0", perk: "🔬 Scientist: Lab missions give +10 extra Credits", hi: "Hi! I'm Cosmo. Let's find out how the Sun works!" },
    rocket: { name: "Rocket", img: 3, color: "#e0503f", perk: "⚡ Engineer: Power missions +25%", hi: "Hi! I'm Rocket. Let's keep the lights on!" },
    luna: { name: "Luna", img: 4, color: "#e06fb0", perk: "❤️ Medic: health lost working outside is halved", hi: "Hi! I'm Luna. Let's keep the crew healthy!" }
  };
  const KITTEN_REF = ["", "kitten-1-green", "kitten-2-blue", "kitten-3-red", "kitten-4-pink"];

  // ===================== missions (GDD v2 section 9) =====================
  // gain/cost: bar deltas. fx: special effects. outside: health cost counts as outside work (Luna perk).
  const MISSIONS = {
    dust: { station: "power", name: { mars: "Dust Off the Panels", moon: "Turn to the Sun" }, emoji: { mars: "🧽", moon: "🧭" }, engine: { mars: "E5 Wipe", moon: "E2 Dial" },
      gainTxt: (s) => "⚡ +" + (s.site === "mars" && dusty() ? 16 : 10) + (dusty() && s.site === "mars" ? " (dusty Sol)" : ""), costTxt: "❤️ −2 (outside)",
      real: "NASA's InSight lander lost power as dust covered its panels, and its mission ended in December 2022. Spirit and Opportunity were sometimes saved by lucky gusts of wind that blew their panels clean. At the lunar south pole the Sun stays low, so NASA is testing tall vertical solar arrays (VSAT).",
      src: { text: "NASA – InSight mission; VSAT", url: "https://science.nasa.gov/mission/insight/" } },
    battery: { station: "power", name: "Charge the Battery", emoji: "🔋", engine: "E3 Wires", gainTxt: () => "⚡ +12", costTxt: "💨 −4 (lights off while rewiring)",
      real: "A base stores the Sun's energy in batteries for the night and for dust storms. Because sunlight on Mars is weak and dusty, NASA's Curiosity and Perseverance rovers use a nuclear power source instead of solar panels.",
      src: { text: "NASA – Mars rover power", url: "https://science.nasa.gov/planetary-science/programs/radioisotope-power-systems/" } },
    plant: { station: "greenhouse", name: "Plant & Water", emoji: "🌱", engine: "E1 Drag + E2 Slider", gainTxt: () => "Big harvest tomorrow · ❤️ +1", costTxt: "💨 −3 (plants drink water)",
      real: "Martian soil contains perchlorate salts that are harmful, so space farms grow plants in water with nutrients (hydroponics). ISS astronauts first ate lettuce grown in space in August 2015, using NASA's Veggie system. Seed facts: Canadian Space Agency, Food Production in Space toolkit.",
      src: { text: "NASA – Veggie; CSA Food Production toolkit", url: "https://www.nasa.gov/missions/station/growing-plants-in-space/" } },
    harvest: { station: "greenhouse", name: "Harvest", emoji: "🥬", engine: "E1 Drag", gainTxt: (s) => s.crop === "big" ? "💨 +16 · ❤️ +3 (big)" : "💨 +8 · ❤️ +2", costTxt: "⚡ −3 (washing and cooling)",
      real: "Plants make oxygen and clean the air while they grow. Fresh food also helps astronauts feel better on long missions.",
      src: { text: "CSA Food Production toolkit; NASA OSDR plant studies", url: "https://osdr.nasa.gov/" } },
    melt: { station: "water", name: "Melt the Ice", emoji: "🧊", engine: "E1 Drag + E2 Slider", gainTxt: (s) => "💨 +" + (s.iceFound ? 18 : 12) + (s.iceFound ? " (ice-rich spot!)" : ""), costTxt: "⚡ −8 (melting needs lots of energy)",
      real: "NASA's Phoenix lander dug up water ice on Mars in 2008, and NASA's SWIM project maps ice buried under the surface. On the Moon, NASA's LCROSS found water ice in the dark Cabeus crater in 2009. Melting 1 kg of ice takes about 334,000 joules.",
      src: { text: "NASA – Phoenix; SWIM; LCROSS", url: "https://science.nasa.gov/mission/phoenix/" } },
    recycle: { station: "water", name: "Recycle the Water", emoji: "♻️", engine: "E4 Order", gainTxt: () => "💨 +6 · ❤️ +2", costTxt: "⚡ −3",
      real: "The International Space Station recycles about 98% of its water, including the crew's sweat and urine, a goal NASA reached in 2023. Every drop matters in space.",
      src: { text: "NASA – ISS water recovery reaches 98% (2023)", url: "https://www.nasa.gov/" } },
    bricks: { station: "shield", name: "Stack Regolith Bricks", emoji: "🧱", engine: "E1 Drag", gainTxt: () => "🛡️ +1 (stays)", costTxt: "❤️ −2 (outside) · ⚡ −4 (brick press)",
      real: "Building with local soil (regolith) saves bringing heavy materials from Earth. NASA ran a 3D-Printed Habitat Challenge to find ways to build Mars homes from local materials. A thick layer of soil blocks much of the radiation from solar storms.",
      src: { text: "NASA – 3D-Printed Habitat Challenge", url: "https://www.nasa.gov/" } },
    wall: { station: "shield", name: "Fill the Water Wall", emoji: "🚰", engine: "E2 Slider", gainTxt: () => "🛡️ +1 tonight", costTxt: "💨 −6 (that water can't be drunk today)",
      real: "Water is full of hydrogen, which is very good at stopping space particles. During a solar storm, NASA's plan is for Artemis astronauts to build a shelter inside Orion from supply bags and water.",
      src: { text: "NASA – Artemis radiation protection", url: "https://www.nasa.gov/" } },
    scan: { station: "lab", name: "Scan Rock Samples", emoji: "🪨", engine: "E1 Drag + match", gainTxt: () => "🪙 40 · ice → next melt +50%", costTxt: "⚡ −3",
      real: "Perseverance's SHERLOC and PIXL instruments find out what rocks are made of by reading the light they give back. Moon rocks are about 40-45% oxygen by weight, and future bases may pull oxygen out of them.",
      src: { text: "NASA – Perseverance SHERLOC and PIXL", url: "https://science.nasa.gov/mission/mars-2020-perseverance/" } },
    sun: { station: "lab", name: "Watch the Sun", emoji: "🔭", engine: "E2 Dials", gainTxt: () => "🪙 40 · full forecast", costTxt: "⚡ −3",
      real: "NASA's Moon to Mars Space Weather Analysis Office watches the Sun to warn astronauts before storms. All its past alerts are stored in a public database called DONKI - the same data this game uses.",
      src: { text: "NASA DONKI", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" } }
  };
  const STATION_MISSIONS = { power: ["dust", "battery"], greenhouse: ["plant", "harvest"], water: ["melt", "recycle"], shield: ["bricks", "wall"], lab: ["scan", "sun"] };

  const ART = ["logo", "rover", "bg-mars", "bg-moon", "habitat", "station-power", "station-greenhouse", "station-water", "station-shield", "station-lab",
    "site-mars", "site-moon", "card-quick", "card-endless", "card-live", "card-family",
    "kitten-nova", "kitten-cosmo", "kitten-rocket", "kitten-luna"];
  const ARTOK = new Set();
  const RADIATION_TYPES = ["flare", "sep", "cme"];
  const POWER_TYPES = ["dust", "night"];

  // ===================== state =====================
  let S = null;
  let mission = "quick";
  let site = "mars";
  let kitten = null;
  let liveEvents = null, livePromise = null, liveState = "idle";

  const $ = (sel) => document.querySelector(sel);
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(Math.round(n));
  const isRad = (ev) => RADIATION_TYPES.includes(ev.type);
  const isPowerEvent = (ev) => POWER_TYPES.includes(ev.type);
  const isQuiet = (ev) => !ev || ev.type === "quiet" || ev.type === "conjunction";
  const badge = (mode) => `<span class="badge ${mode === "LIVE" ? "live" : mode === "OFFLINE" ? "offline" : "archive"}">${mode === "OFFLINE" ? "OFFLINE – ARCHIVE" : mode}</span>`;
  const currentEvent = () => S.events[S.sol - 1];
  const dusty = () => { const ev = S && currentEvent(); return !!ev && ev.sunlight > 0 && ev.sunlight < 1; };
  const count = (id) => Object.values(S.tiles).filter((m) => m === id).length;
  const kName = () => (kitten ? KITTENS[kitten].name : "Kitten");
  const mName = (id) => { const n = MISSIONS[id].name; return typeof n === "string" ? n : n[S.site]; };
  const mEmoji = (id) => { const e = MISSIONS[id].emoji; return typeof e === "string" ? e : e[S.site]; };
  const shieldLevel = () => Math.min(SHIELD_MAX, count("shield") + S.bricks + S.shieldTonight);
  const totalSols = () => (S.mode === "infinite" ? Infinity : S.events.length);

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
  const flames = (tier) => "🔥".repeat(tier) + "<span class='dim'>" + "🔥".repeat(5 - tier) + "</span>";

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
  function artHTML(name, emoji) {
    return ARTOK.has(name) ? `<img src="assets/${name}.png" alt="">` : `<span class="emoji">${emoji}</span>`;
  }
  function kittenSrc(id) {
    return ARTOK.has("kitten-" + id) ? "assets/kitten-" + id + ".png" : "assets/" + KITTEN_REF[KITTENS[id].img] + ".webp";
  }
  function kittenImg(id, cls) { return `<img class="kimg ${cls || ""}" src="${kittenSrc(id || "nova")}" alt="${KITTENS[id || "nova"].name}">`; }
  function fillArt(root) {
    (root || document).querySelectorAll(".art-slot").forEach((el) => {
      if (el.dataset.kitten) { el.innerHTML = kittenImg(el.dataset.kitten === "me" ? (kitten || "nova") : el.dataset.kitten); return; }
      el.innerHTML = artHTML(el.dataset.art, el.dataset.emoji || "");
    });
    document.body.classList.toggle("has-bg-mars", ARTOK.has("bg-mars"));
    document.body.classList.toggle("has-bg-moon", ARTOK.has("bg-moon"));
  }

  // ===================== settings =====================
  const SETTINGS_KEY = "sols-settings-v1";
  const settings = { sound: true, readAloud: false, textSize: 18, calm: false, reminder: 0 };
  let reminderTimer = null;
  function loadSettings() { try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (e) { /* defaults */ } }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
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
        if (!$("#screen-game").classList.contains("active")) alert(kName() + ": Crew shift over! Great work today. Come back tomorrow?");
      }, settings.reminder * 60000);
    }
    if (!settings.readAloud && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  // ===================== sound =====================
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
    bad: () => { beep(300, 0.2, "triangle"); setTimeout(() => beep(220, 0.3, "triangle"), 180); },
    coin: () => { beep(988, 0.07); setTimeout(() => beep(1319, 0.14), 70); },
    pop: () => beep(880, 0.05, "triangle"),
    spark: () => beep(180, 0.12, "sawtooth")
  };
  function speak(text) {
    if (!settings.readAloud || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s.,!?'’:;-]/gu, ""));
      u.lang = "en-US"; u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  function say(text, pose) {
    const el = $("#cat-say");
    if (el) el.innerHTML = text;
    const pic = $("#dock-kitten");
    if (pic) { pic.className = "dock-kitten pose-" + (pose || "talk"); }
    speak(text);
  }

  // ===================== NASA API helpers (DONKI, APOD, Rover Photos) =====================
  function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }
  async function getJSON(url) {
    const r = await withTimeout(fetch(url), LIVE_TIMEOUT_MS);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  // cache each answer for 1 day so repeat visits don't call again (GDD v2 10.4)
  async function cachedJSON(key, url) {
    const today = new Date().toISOString().slice(0, 10);
    try { const c = JSON.parse(localStorage.getItem("nasa-" + key) || "null"); if (c && c.day === today) return c.data; } catch (e) { /* ignore */ }
    const data = await getJSON(url);
    try { localStorage.setItem("nasa-" + key, JSON.stringify({ day: today, data })); } catch (e) { /* ignore */ }
    return data;
  }

  function marsLightMinutesToday() {
    const d = (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000;
    const rad = Math.PI / 180;
    const le = (100.46 + 0.9856474 * d) * rad, lm = (355.45 + 0.5240208 * d) * rad;
    const ex = Math.cos(le), ey = Math.sin(le), mx = 1.5237 * Math.cos(lm), my = 1.5237 * Math.sin(lm);
    return Math.round(Math.hypot(mx - ex, my - ey) * 499 / 60);
  }
  function flareTier(cls) { const k = (cls || "").charAt(0).toUpperCase(); return k === "X" ? 2 : 1; }
  function cmeTier(speed) { return speed > 1000 ? 4 : speed >= 500 ? 3 : speed >= 300 ? 2 : 1; }
  const day = (iso) => (iso || "").slice(0, 10);

  async function fetchLiveEvents(forSite) {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const q = `startDate=${start}&endDate=${end}&api_key=${NASA_KEY}`;
    const base = "https://api.nasa.gov/DONKI/";
    const [sepR, cmeR, flrR] = await Promise.allSettled([
      cachedJSON("sep", base + "SEP?" + q), cachedJSON("cme", base + "CMEAnalysis?" + q + "&mostAccurateOnly=true"), cachedJSON("flr", base + "FLR?" + q)
    ]);
    if (sepR.status === "rejected" && cmeR.status === "rejected" && flrR.status === "rejected") throw new Error("all live calls failed");
    const delay = forSite === "moon" ? 0.022 : marsLightMinutesToday();
    const placeName = forSite === "moon" ? "the Moon" : "Mars";
    const evs = [];
    const seps = sepR.status === "fulfilled" && Array.isArray(sepR.value) ? sepR.value : [];
    if (seps.length) {
      const s = seps[seps.length - 1];
      evs.push({ id: s.sepID, type: "sep", icon: "☢️", title: "Particle storm this week!", next: "PARTICLE STORM",
        headline: `NASA recorded a real solar particle storm on ${day(s.eventTime)}!`,
        why: "Fast particles from the Sun can hurt the crew. Shields or a shelter keep them out.",
        realScience: `This event comes from NASA's DONKI database today. A solar energetic particle (SEP) event was recorded on ${day(s.eventTime)}.`,
        dangerTier: 4, warningMinutes: 30, lightDelayMinutes: delay, sunlight: 1, realNumber: `DONKI event ${s.sepID}.`,
        citation: { text: `NASA DONKI – SEP ${day(s.eventTime)}`, url: s.link || "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: { choice: "shelter", text: "A real particle storm. Shelter is the safe choice." }, mode: "LIVE" });
    }
    const cmes = cmeR.status === "fulfilled" && Array.isArray(cmeR.value) ? cmeR.value.filter((c) => c.speed) : [];
    if (cmes.length) {
      const c = cmes.slice().sort((a, b) => b.speed - a.speed)[0];
      const tier = cmeTier(c.speed);
      evs.push({ id: c.associatedCMEID, type: "cme", icon: "🌀", title: "Coronal mass ejection", next: "SOLAR CLOUD",
        headline: `The Sun threw out a giant cloud of gas at ${Math.round(c.speed)} km/s!`,
        why: "The cloud itself isn't radiation, but fast clouds can push particles ahead of them.",
        realScience: `A coronal mass ejection (CME) is a huge cloud of charged gas thrown off by the Sun. NASA measured this one on ${day(c.time21_5 || c.associatedCMEstartTime)} moving at ${Math.round(c.speed)} km/s.`,
        dangerTier: Math.max(1, tier - 1), warningMinutes: Math.round(1.5e8 / c.speed / 60), lightDelayMinutes: delay, sunlight: 1,
        realNumber: `Fastest CME this week: ${Math.round(c.speed)} km/s (DONKI CME Analysis).`,
        citation: { text: `NASA DONKI – CME ${day(c.associatedCMEstartTime)}`, url: c.associatedCMELink || "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: tier >= 3 ? { choice: "reinforce", text: "A fast CME. Strengthen the shields just in case." } : { choice: "work", text: "A slow CME. Keep working, but watch the forecast." }, mode: "LIVE" });
    }
    const flrs = flrR.status === "fulfilled" && Array.isArray(flrR.value) ? flrR.value : [];
    if (flrs.length) {
      const order = (f) => ({ X: 3, M: 2, C: 1 }[(f.classType || "").charAt(0)] || 0) * 100 + parseFloat((f.classType || "0").slice(1) || 0);
      const f = flrs.slice().sort((a, b) => order(b) - order(a))[0];
      evs.push({ id: f.flrID, type: "flare", icon: "🌞", title: `${f.classType} solar flare`, next: "FLARE",
        headline: `The Sun made a ${f.classType} flare on ${day(f.peakTime)}!`,
        why: "Flares are bright flashes from the Sun. Sometimes a particle storm follows.",
        realScience: `NASA's DONKI database recorded a class ${f.classType} flare this week. Flare classes go A, B, C, M, X, and each letter is 10 times stronger than the one before.`,
        dangerTier: flareTier(f.classType), warningMinutes: 8, lightDelayMinutes: delay, sunlight: 1, realNumber: `Flare class ${f.classType}, peak ${f.peakTime}.`,
        citation: { text: `NASA DONKI – Flare ${day(f.peakTime)}`, url: f.link || "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: { choice: "work", text: "Flares alone are mostly light, not particles. Keep working unless particles follow." }, mode: "LIVE" });
    }
    evs.sort((a, b) => a.dangerTier - b.dangerTier);
    while (evs.length < LIVE_SOLS) {
      evs.unshift({ id: "calm-live-" + evs.length, type: "quiet", icon: "☀️", title: "Calm Sun this week!", next: "CALM",
        headline: "NASA's live data shows the Sun has been calm. Good news!",
        why: `Most days really are calm. Use them to build up your base on ${placeName}.`,
        realScience: "We asked NASA's DONKI space-weather database about the last 7 days and found no more big events.",
        dangerTier: 0, warningMinutes: 1440, lightDelayMinutes: delay, sunlight: 1, realNumber: `Live check of NASA DONKI for ${start} to ${end}.`,
        citation: { text: "NASA DONKI – last 7 days", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
        earthAdvice: { choice: "work", text: "Calm skies. Get ready." }, mode: "LIVE" });
    }
    return evs.slice(0, LIVE_SOLS);
  }
  function startLiveFetch(forSite) {
    liveState = "loading"; liveEvents = null;
    livePromise = fetchLiveEvents(forSite).then((evs) => { liveEvents = evs; liveState = "live"; }).catch(() => { liveEvents = null; liveState = "offline"; });
    return livePromise;
  }

  // APOD on the Title screen (hides quietly on failure)
  function loadApod() {
    cachedJSON("apod", "https://api.nasa.gov/planetary/apod?api_key=" + NASA_KEY).then((a) => {
      if (!a || !a.title) return;
      const box = $("#apod");
      const pic = a.media_type === "image" ? `<img src="${a.url}" alt="${a.title}">` : `<div class="apod-fallback">🌌</div>`;
      box.innerHTML = `${pic}<div><div class="apod-label">Today's real space picture ${badge("LIVE")}</div><b>${a.title}</b>` +
        `<div class="small">${a.copyright ? "© " + a.copyright.trim() + " · " : ""}NASA APOD, ${a.date}</div></div>`;
      box.classList.remove("hidden");
    }).catch(() => { /* hide quietly */ });
  }
  // Mars Rover Photos on Mars Reveal cards (hides quietly on failure)
  let roverPhotos = null;
  function loadRoverPhotos() {
    cachedJSON("rover", "https://api.nasa.gov/mars-photos/api/v1/rovers/curiosity/latest_photos?api_key=" + NASA_KEY)
      .then((d) => { roverPhotos = d && Array.isArray(d.latest_photos) && d.latest_photos.length ? d.latest_photos : null; })
      .catch(() => { roverPhotos = null; });
  }
  function roverPhotoHTML() {
    if (!roverPhotos || S.site !== "mars") return "";
    const p = roverPhotos[(S.sol * 7) % roverPhotos.length];
    return `<figure class="rover-photo"><img src="${p.img_src.replace("http://", "https://")}" alt="Photo from Curiosity"><figcaption>A real photo from Curiosity · ${p.camera.full_name} · Sol ${p.sol} ${badge("LIVE")}</figcaption></figure>`;
  }

  // ===================== new game =====================
  function buildEvents() {
    if (mission === "live") return liveEvents || window.MISSION_EVENTS[site].slice(1, 4).map((e) => Object.assign({}, e, { mode: "OFFLINE" }));
    if (mission === "infinite") return [];
    return window.MISSION_EVENTS[site].slice(0, QUICK_SOLS);
  }
  // Infinite: random order of a larger pool, danger rising every 3 Sols, about half the Sols quiet
  function nextInfiniteEvent(sol) {
    const pool = window.MISSION_EVENTS[site].concat((window.INFINITE_EVENTS || {})[site] || []);
    const maxTier = 1 + Math.floor((sol - 1) / 3);
    const fix = (e) => Object.assign({}, e, site === "moon" ? { lightDelayMinutes: 0.022 } : {});
    if (sol === 1 || Math.random() < 0.5) return fix(pool.find((e) => e.type === "quiet"));
    const ok = pool.filter((e) => e.type !== "quiet" && (isRad(e) ? e.dangerTier <= maxTier : true) && !S.events.slice(-3).some((p) => p.id === e.id));
    return fix(ok[Math.floor(Math.random() * ok.length)] || pool[0]);
  }

  function newGame() {
    S = {
      site, mode: mission, kitten, events: buildEvents(),
      unit: site === "moon" ? "Day" : "Sol",
      sol: 1, phase: "build",
      power: START.power, life: START.life, health: START.health,
      bricks: 0, shieldTonight: 0, credits: 0,
      actionsUsed: 0, done: {},
      crop: "small", plantedSol: 0, iceFound: false, fullForecast: false,
      tiles: {}, cargo: {}, cargoLimit: CARGO_LIMIT, placing: null, selectedTile: null,
      askedEarth: null, history: [], ended: false, resupply: false
    };
    MOD_ORDER.forEach((k) => (S.cargo[k] = MODULES[k].inv[site]));
    for (let r = 3; r <= 4; r++) for (let c = 3; c <= 4; c++) S.tiles[r + "," + c] = "habitat";
    if (S.mode === "infinite") S.events.push(nextInfiniteEvent(1));
    S.history.push({ sol: 0, power: S.power, life: S.life, health: S.health });
  }

  // ===================== isometric grid 8×8 =====================
  const SVGNS = "http://www.w3.org/2000/svg";
  const N = 8, TW = 84, TH = 42, X0 = 360, Y0 = 30;
  const tileTop = (r, c) => ({ x: X0 + (c - r) * TW / 2, y: Y0 + (c + r) * TH / 2 });
  function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function spriteNode(name, emoji, cx, baseY, size, cls) {
    let n;
    if (ARTOK.has(name)) n = svgEl("image", { href: "assets/" + name + ".png", x: cx - size / 2, y: baseY - size, width: size, height: size, class: "sprite " + (cls || "") });
    else { n = svgEl("text", { x: cx, y: baseY, class: "sprite emoji-sprite " + (cls || ""), "font-size": Math.round(size * 0.6) }); n.textContent = emoji; }
    return n;
  }
  const placedCount = () => Object.values(S.tiles).filter((m) => m !== "habitat").length;
  const freeTiles = () => { const out = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!S.tiles[r + "," + c]) out.push(r + "," + c); return out; };

  function renderGrid() {
    const svg = $("#grid");
    svg.innerHTML = "";
    const g = svgEl("g", {});
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = tileTop(r, c), key = r + "," + c, mod = S.tiles[key];
      const can = S.phase === "build" && S.placing && !mod;
      const station = S.phase === "sol" && mod && mod !== "habitat";
      const poly = svgEl("polygon", {
        points: `${t.x},${t.y} ${t.x + TW / 2},${t.y + TH / 2} ${t.x},${t.y + TH} ${t.x - TW / 2},${t.y + TH / 2}`,
        class: "tile" + (mod ? " taken" : "") + (can ? " can-place" : "") + (station ? " station-tile" : "") + (S.selectedTile === key ? " selected" : ""),
        "data-key": key
      });
      if (can || (S.phase === "build" && mod && mod !== "habitat") || station) {
        poly.setAttribute("tabindex", "0"); poly.setAttribute("role", "button");
        poly.setAttribute("aria-label", can ? `Place ${MODULES[S.placing].name} here` : MODULES[mod].name);
      }
      g.appendChild(poly);
    }
    svg.appendChild(g);
    renderWallRing(svg);
    const sprites = [];
    const hc = tileTop(3, 3);
    sprites.push({ order: 7, node: () => spriteNode("habitat", "🛖", hc.x, hc.y + TH * 2 + 6, 150, "") });
    Object.keys(S.tiles).forEach((key) => {
      const id = S.tiles[key];
      if (id === "habitat") return;
      const [r, c] = key.split(",").map(Number);
      const t = tileTop(r, c), m = MODULES[id];
      const doneAll = S.phase === "sol" && STATION_MISSIONS[id].every((mid) => S.done[mid]);
      sprites.push({ order: r + c, node: () => {
        const grp = svgEl("g", { class: "station " + (S.phase === "sol" ? (doneAll ? "done" : "pulse") : ""), "data-key": key });
        grp.appendChild(spriteNode(m.art, m.emoji, t.x, t.y + TH / 2 + 14, 78, ""));
        if (S.phase === "sol") {
          const b = svgEl("text", { x: t.x + 22, y: t.y - 10, class: "st-badge" });
          b.textContent = doneAll ? "✅" : STATION_MISSIONS[id].map((mid) => mEmoji(mid)).join("");
          grp.appendChild(b);
        }
        return grp;
      } });
    });
    sprites.sort((a, b) => a.order - b.order).forEach((s) => svg.appendChild(s.node()));
    renderCrew(svg);
  }
  // Shield ring: level 1 = one side, 2 = three sides, 3 = full ring (GDD v2 7.3)
  function renderWallRing(svg) {
    const lvl = shieldLevel();
    if (!lvl) return;
    const top = tileTop(0, 0), right = tileTop(0, N), bottom = tileTop(N, N), left = tileTop(N, 0);
    const sides = [[left, bottom], [bottom, right], [right, top], [top, left]].slice(0, lvl === 1 ? 1 : lvl === 2 ? 3 : 4);
    sides.forEach(([a, b]) => svg.appendChild(svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "wall-ring" })));
  }
  // tiny crew: the 3 other kittens walk around the base
  function renderCrew(svg) {
    if (S.phase !== "sol") return;
    const others = Object.keys(KITTENS).filter((k) => k !== S.kitten);
    const free = freeTiles();
    others.forEach((k, i) => {
      const key = free[(S.sol * 5 + i * 11 + crewStep) % free.length];
      if (!key) return;
      const [r, c] = key.split(",").map(Number);
      const t = tileTop(r, c);
      svg.appendChild(svgEl("image", { href: kittenSrc(k), x: t.x - 14, y: t.y - 6, width: 28, height: 28, class: "crew" }));
    });
  }
  let crewStep = 0;
  setInterval(() => { if (S && S.phase === "sol" && $("#screen-game").classList.contains("active") && $("#overlay").classList.contains("hidden")) { crewStep++; const svg = $("#grid"); svg.querySelectorAll(".crew").forEach((n) => n.remove()); renderCrew(svg); } }, 2500);

  // ===================== passive effects + overnight =====================
  function overnight(sunlight, powerDown) {
    const n = (k) => count(k);
    const sun = sunlight == null ? 1 : sunlight;
    return {
      power: n("power") * 7 * sun - UPKEEP.power - (powerDown ? 0 : n("greenhouse") * 2 + n("lab") * 2) - n("water") * 2 - n("shield") * 1,
      life: (powerDown ? 0 : n("greenhouse") * 3) + n("water") * 2 - UPKEEP.life,
      health: (powerDown ? 0 : n("lab") * 1) - HEALTH_UPKEEP[S.site],
      sun
    };
  }
  function dailyBalance() {
    const o = overnight(1, false);
    return o;
  }

  // ===================== HUD =====================
  function renderBars(preview) {
    [["power", S.power], ["life", S.life], ["health", S.health]].forEach(([k, v]) => {
      const el = $("#bar-" + k);
      el.querySelector(".fill").style.width = Math.max(0, Math.min(100, v)) + "%";
      el.querySelector(".num").textContent = Math.round(v);
      el.classList.toggle("low", v <= 25);
      const gh = el.querySelector(".ghost");
      const d = preview ? Math.round(preview[k]) : 0;
      if (d < 0) { gh.className = "ghost loss"; gh.style.left = Math.max(0, v + d) + "%"; gh.style.width = Math.min(v, -d) + "%"; }
      else if (d > 0) { gh.className = "ghost gain"; gh.style.left = Math.min(100, v) + "%"; gh.style.width = Math.min(100 - v, d) + "%"; }
      else gh.style.width = "0";
      el.querySelector(".arrow").textContent = d ? signed(d) : "";
    });
    $("#sol-label").textContent = S.phase === "build" ? "BUILD YOUR BASE" : S.unit.toUpperCase() + " " + S.sol + (S.mode === "infinite" ? "" : " / " + totalSols());
    const lvl = shieldLevel();
    $("#shield-segs").innerHTML = [0, 1, 2].map((i) => `<span class="seg ${i < lvl ? "on" : ""}"></span>`).join("");
    $("#shield-segs").setAttribute("aria-label", "Shield level " + lvl + " of 3");
    $("#credits-num").textContent = S.credits;
    const left = ACTIONS_PER_SOL - S.actionsUsed;
    $("#actions").innerHTML = [0, 1].map((i) => `<span class="aseg ${i < S.actionsUsed ? "used" : ""}"></span>`).join("") + `<b>${S.actionsUsed}/${ACTIONS_PER_SOL}</b>`;
    $("#actions").classList.toggle("full", left <= 0);
  }
  function addCredits(n, why) {
    if (!n) return;
    S.credits += n;
    sfx.coin();
    const pop = document.createElement("div");
    pop.className = "credit-pop";
    pop.textContent = "+" + n + " 🪙" + (why ? " " + why : "");
    $("#credits").appendChild(pop);
    setTimeout(() => pop.remove(), 1600);
    $("#credits-num").textContent = S.credits;
  }

  function renderForecast() {
    const f = $("#forecast");
    if (S.phase !== "sol") { f.innerHTML = `<div class="fc-text"><b>PHASE 1 – CREATE YOUR BASE</b><div class="meta">Choose ${S.cargoLimit} crates for the rocket, then launch ${S.unit} 1.</div></div>`; f.className = "forecast"; return; }
    const ev = currentEvent();
    const hasLab = count("lab") > 0;
    if (isQuiet(ev) && ev.type !== "conjunction") {
      f.className = "forecast calm";
      f.innerHTML = `<div class="big-ico">☀️</div><div class="fc-text"><div class="fc-label">SPACE WEATHER NEWS</div><b>CALM SUN – no space weather today</b><div class="meta">${ev.citation.text} ${badge(ev.mode)}</div></div>`;
      return;
    }
    let danger;
    if (isPowerEvent(ev)) danger = "Power danger: " + flames(ev.type === "night" ? 5 : 4);
    else if (ev.type === "conjunction") danger = "No radio contact with Earth";
    else danger = "Danger: " + (hasLab || S.fullForecast ? flames(Math.max(1, ev.dangerTier)) + " " + Math.max(1, ev.dangerTier) : "<b>?</b> <span class='small'>(build a Lab to measure it)</span>");
    let full = "";
    if (S.fullForecast && isRad(ev)) full = `<div class="meta full-fc">🔭 Full forecast: ${ev.dangerTier >= 2 ? "<b>a particle storm WILL reach us.</b>" : "<b>no big particle storm will follow.</b> Sheltering isn't needed."}</div>`;
    f.className = "forecast danger";
    f.innerHTML = `<div class="big-ico">${ev.icon}</div><div class="fc-text"><div class="fc-label">SPACE WEATHER NEWS</div>` +
      `<b>${(ev.next || ev.title).toUpperCase()} COMING</b><div class="meta">${danger} · Warning: <b>${fmtMinutes(ev.warningMinutes)}</b></div>${full}` +
      `<div class="meta">${ev.citation.text} ${badge(ev.mode)}</div></div>`;
  }

  // ===================== Phase 1: Create Your Base =====================
  function renderDock() {
    const dock = $("#dock");
    if (S.phase !== "build") { dock.classList.add("hidden"); return; }
    dock.classList.remove("hidden");
    const placed = placedCount();
    const o = dailyBalance();
    const cls = (n) => (n >= 0 ? "pos" : "neg");
    $("#balance").innerHTML = `Daily balance (sunny ${S.unit}): <span class="${cls(o.power)}">⚡ ${signed(o.power)}</span> · <span class="${cls(o.life)}">💨 ${signed(o.life)}</span> · <span class="${cls(o.health)}">❤️ ${signed(o.health)}</span> · 🛡️ ${shieldLevel()}` +
      ` <span class="cargo">📦 ${placed - S.basePlaced}/${S.cargoLimit}</span>`;
    const crates = $("#crates");
    crates.innerHTML = "";
    MOD_ORDER.forEach((k) => {
      const m = MODULES[k];
      const left = S.cargo[k];
      const b = document.createElement("button");
      b.className = "crate" + (S.placing === k ? " selected" : "");
      b.dataset.action = "crate"; b.dataset.id = k;
      b.disabled = left <= 0 || placed - S.basePlaced >= S.cargoLimit;
      b.innerHTML = `<span class="cr-count">×${left}</span><span class="cr-pic">${artHTML(m.art, m.emoji)}</span><span class="cr-name">${m.name}</span><span class="cr-eff">${m.daily}</span>` +
        `<span class="cr-info" title="${m.info[S.site]}">ℹ️ ${m.info[S.site]}</span>`;
      crates.appendChild(b);
    });
    const invEmpty = MOD_ORDER.every((k) => S.cargo[k] <= 0);
    const ready = placed - S.basePlaced >= S.cargoLimit || invEmpty;
    const btn = $("#btn-launch");
    btn.disabled = !ready;
    btn.textContent = S.resupply ? "BACK TO THE BASE ▶" : "LAUNCH " + S.unit.toUpperCase() + " 1 ▶";
    btn.classList.toggle("pulse", ready);
  }
  function buildWarnings() {
    const w = [];
    if (!count("power")) w.push("No Power Station? Everything here needs electricity!");
    if (!count("shield")) w.push("No Shield? The crew will have nowhere to hide from storms.");
    if (!count("lab")) w.push("No Lab? Our forecasts will be guesses.");
    return w;
  }
  function selectCrate(id) {
    S.placing = S.placing === id ? null : id;
    S.selectedTile = null;
    if (S.placing) say(`Tap a glowing tile for the ${MODULES[id].name}. ${MODULES[id].info[S.site]}`, "point");
    renderGame();
  }
  function placeOn(key) {
    const id = S.placing;
    if (!id || S.tiles[key] || S.cargo[id] <= 0) return;
    if (placedCount() - S.basePlaced >= S.cargoLimit) return;
    S.tiles[key] = id; S.cargo[id]--; S.placing = null;
    sfx.build();
    const w = buildWarnings();
    say(`${MODULES[id].name} placed! It gives ${MODULES[id].daily} every ${S.unit}.` + (w.length ? " " + w[0] : " Great base!"), w.length ? "worried" : "happy");
    renderGame();
  }
  function tileMenu(key) {
    if (S.resupply && S.resupplyKeys && !S.resupplyKeys.includes(key)) { say("That one is already built. Place the new crate!"); return; }
    S.selectedTile = key; S.placing = null;
    const id = S.tiles[key];
    say(`${MODULES[id].name}: <button class="btn mini" data-action="move-mod" data-key="${key}">↔ Move</button> <button class="btn mini" data-action="send-back" data-key="${key}">↩ Send back</button>`, "point");
    renderGrid();
  }
  function sendBack(key) {
    const id = S.tiles[key];
    delete S.tiles[key]; S.cargo[id]++; S.selectedTile = null;
    if (S.resupplyKeys) S.resupplyKeys = S.resupplyKeys.filter((k) => k !== key);
    say(MODULES[id].name + " is back in the crate.");
    renderGame();
  }
  function moveMod(key) { const id = S.tiles[key]; sendBack(key); S.placing = id; say("Tap a glowing tile to move the " + MODULES[id].name + "."); renderGame(); }

  function launch() {
    const w = buildWarnings();
    S.placing = null; S.selectedTile = null;
    if (S.resupply) { S.resupply = false; S.resupplyKeys = null; S.phase = "sol"; renderGame(); say(prepareHint()); return; }
    S.phase = "sol";
    sfx.good();
    renderGame();
    say((w.length ? w.join(" ") + " " : "") + "We launched! " + (S.site === "mars" ? "Sol – that's one Mars day. " : "") + prepareHint(), w.length ? "worried" : "happy");
  }

  // ===================== Phase 2: stations =====================
  function prepareHint() {
    const ev = currentEvent();
    if (S.power <= 25) return "Power is low! A Power Station mission will help.";
    if (S.life <= 25) return "Air, water and food are low! Try the Greenhouse or Water Station.";
    if (S.health <= 30) return "The crew needs care. Recycle the Water or Harvest gives Crew Health.";
    if (isQuiet(ev) && ev.type !== "conjunction") return `Calm Sun today! Tap a glowing station to do a mission. You have ${ACTIONS_PER_SOL - S.actionsUsed} actions.`;
    if (ev.type === "conjunction") return "The Sun is between us and Earth. No help from home for now. We decide alone!";
    if (ev.type === "dust") return "A dust storm is coming! Panels will barely work. Dust Off the Panels gives extra power today.";
    if (ev.type === "night") return "Night is coming: no sun for the panels. Charge the Battery and save power!";
    if (isRad(ev)) return "A storm is in the forecast! Shields help. Save an action to Reinforce, or watch the Sun to see if particles will really come.";
    return "Tap a glowing station to start a mission.";
  }
  function openStation(key) {
    const id = S.tiles[key];
    const m = MODULES[id];
    sfx.click();
    say(`<b>${m.name}:</b> "${m.talk}" <button class="btn mini btn-go" data-action="enter-station" data-id="${id}">ENTER</button> <button class="btn mini" data-action="not-now">Not now</button>`, "talk");
  }
  function missionBlock(mid) {
    if (S.done[mid]) return "Done today ✅";
    if (S.actionsUsed >= ACTIONS_PER_SOL) return "No actions left";
    if (mid === "harvest" && !S.crop) return "Trays are empty – plant first";
    if (mid === "harvest" && S.plantedSol === S.sol) return "Still growing – harvest tomorrow";
    if (mid === "bricks" && shieldLevel() >= SHIELD_MAX) return "Shield is already at 3";
    if (mid === "wall" && shieldLevel() >= SHIELD_MAX) return "Shield is already at 3";
    return "";
  }
  function enterStation(id) {
    const m = MODULES[id];
    openOverlay("station");
    $("#modal").innerHTML = `<div class="interior int-${id}"><h2>${m.emoji} ${m.name}</h2>` +
      `<p class="cat-line">${kittenImg(S.kitten, "mini")}<span>"${m.talk}"</span></p><div class="mcards">` +
      STATION_MISSIONS[id].map((mid) => {
        const mi = MISSIONS[mid], block = missionBlock(mid);
        return `<button class="mcard2" data-action="start-mission" data-id="${mid}" ${block ? "disabled" : ""}>` +
          `<span class="mc2-ico">${mEmoji(mid)}</span><span class="mc2-name">${mName(mid)}</span>` +
          `<span class="gain">${mi.gainTxt(S)}</span><span class="cost">${mi.costTxt}</span>` +
          `<span class="small">1 action · ${typeof mi.engine === "string" ? mi.engine : mi.engine[S.site]}</span>${block ? `<span class="blocked">${block}</span>` : ""}</button>`;
      }).join("") + `</div><div class="modal-actions"><button class="btn btn-blue" data-action="close-overlay">◀ Back to the base</button></div></div>`;
  }

  // ===================== mini-game engines E1–E5 =====================
  let mg = null; // { mid, mistakes, finish(quality) }
  function startMission(mid) {
    if (missionBlock(mid)) return;
    const box = document.createElement("div");
    $("#modal").innerHTML = `<div class="mg-head"><h2>${mEmoji(mid)} ${mName(mid)}</h2><div class="mg-help" id="mg-help"></div></div><div class="mg ${S.site}" id="mg"></div>` +
      `<div class="modal-actions"><button class="btn hidden" id="mg-giveup" data-action="mg-done">I'm done ✋</button></div>`;
    mg = { mid, mistakes: 0, over: false };
    mg.finish = (q) => { if (mg.over) return; mg.over = true; setTimeout(() => missionResult(mid, q), 700); };
    setTimeout(() => { const g = $("#mg-giveup"); if (g && mg && !mg.over) g.classList.remove("hidden"); }, 25000);
    GAMES[mid === "dust" && S.site === "moon" ? "turn" : mid]($("#mg"));
    void box;
  }
  const help = (t) => { const h = $("#mg-help"); if (h) h.innerHTML = t; };
  const mistake = (t) => { mg.mistakes++; if (t) help(t); };
  const q = () => (mg.mistakes ? "good" : "great");

  // E1: drag (or tap-then-tap) items into slots. onDrop(item, slot) returns true if accepted.
  function dragToSlot(root, onDrop) {
    let sel = null, ghost = null, src = null;
    const clear = () => { if (ghost) ghost.remove(); ghost = null; if (src) src.classList.remove("dragging"); src = null; };
    root.addEventListener("pointerdown", (e) => {
      const it = e.target.closest(".drag");
      if (!it || it.classList.contains("used")) return;
      e.preventDefault();
      src = it; it.classList.add("dragging");
      ghost = it.cloneNode(true); ghost.classList.add("ghost-drag");
      document.body.appendChild(ghost);
      const move = (ev) => { ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px"; };
      move(e);
      const moved = { d: 0, x: e.clientX, y: e.clientY };
      const mv = (ev) => { moved.d = Math.max(moved.d, Math.hypot(ev.clientX - moved.x, ev.clientY - moved.y)); move(ev); };
      const up = (ev) => {
        document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up);
        ghost.style.display = "none";
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const slot = under && under.closest(".slot");
        const item = src;
        clear();
        if (moved.d < 8) { // a tap: select, then tap a slot
          root.querySelectorAll(".drag.sel").forEach((x) => x.classList.remove("sel"));
          sel = item; item.classList.add("sel"); return;
        }
        if (slot && root.contains(slot)) onDrop(item, slot);
      };
      const cancel = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", cancel); clear(); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", cancel);
    });
    root.addEventListener("click", (e) => {
      const slot = e.target.closest(".slot");
      if (slot && sel && !sel.classList.contains("used")) { const it = sel; sel.classList.remove("sel"); sel = null; onDrop(it, slot); }
    });
  }
  // E2: zone slider. Calls onGreen() after holdMs inside [lo,hi]; onRed() when above red.
  function zoneSlider(el, opts) {
    const id = "zs" + Math.random().toString(36).slice(2, 7);
    el.innerHTML = `<div class="zone-wrap"><div class="zone-label">${opts.label}</div><div class="zone-track">` +
      `<div class="zone low" style="width:${opts.lo}%"></div><div class="zone green" style="left:${opts.lo}%;width:${opts.hi - opts.lo}%"></div>` +
      (opts.red ? `<div class="zone red" style="left:${opts.red}%;width:${100 - opts.red}%"></div>` : "") +
      `<div class="needle" id="${id}-n"></div></div><input type="range" min="0" max="100" value="${opts.start || 0}" id="${id}" aria-label="${opts.label}">` +
      `<div class="hold-bar"><div id="${id}-h"></div></div></div>`;
    const inp = el.querySelector("input"), needle = el.querySelector(".needle"), hold = el.querySelector("#" + id + "-h");
    let t0 = null, done = false, raf = null;
    const tick = () => {
      if (done) return;
      const v = Number(inp.value);
      needle.style.left = v + "%";
      if (opts.onValue) opts.onValue(v);
      if (opts.red && v >= opts.red) { if (!el._red) { el._red = true; opts.onRed && opts.onRed(); } }
      if (v >= opts.lo && v <= opts.hi) {
        t0 = t0 || performance.now();
        const p = Math.min(1, (performance.now() - t0) / (opts.holdMs || 1000));
        hold.style.width = p * 100 + "%";
        if (p >= 1) { done = true; opts.onGreen(); return; }
      } else { t0 = null; hold.style.width = "0"; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return { input: inp, stop: () => { done = true; cancelAnimationFrame(raf); } };
  }
  // E3: connect wires (colour to colour). Wrong socket sparks and bounces back.
  function wires(el, colors, onAll) {
    const order = colors.slice().sort(() => Math.random() - 0.5);
    el.innerHTML = `<svg class="wires" viewBox="0 0 400 220"><g class="links"></g>` +
      colors.map((c, i) => `<circle class="plug" data-c="${c}" cx="40" cy="${40 + i * 70}" r="16" fill="${c}"/>`).join("") +
      order.map((c, i) => `<rect class="socket" data-c="${c}" x="346" y="${24 + i * 70}" width="32" height="32" rx="6" fill="${c}"/>`).join("") +
      `<line class="drag-line hidden" x1="0" y1="0" x2="0" y2="0"/></svg><div class="battery"><div class="bat-fill" id="bat-fill"></div></div>`;
    const svg = el.querySelector("svg"), line = el.querySelector(".drag-line"), links = el.querySelector(".links");
    const done = {};
    const pt = (e) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) * 400 / r.width, y: (e.clientY - r.top) * 220 / r.height }; };
    const linkCross = (y1, y2) => Object.values(done).some((l) => (l.y1 - y1) * (l.y2 - y2) < 0);
    svg.addEventListener("pointerdown", (e) => {
      const p = e.target.closest(".plug");
      if (!p || done[p.dataset.c]) return;
      e.preventDefault();
      const c = p.dataset.c, y1 = Number(p.getAttribute("cy"));
      line.classList.remove("hidden"); line.setAttribute("stroke", c);
      line.setAttribute("x1", 40); line.setAttribute("y1", y1);
      const mv = (ev) => { const q2 = pt(ev); line.setAttribute("x2", q2.x); line.setAttribute("y2", q2.y); };
      mv(e);
      const up = (ev) => {
        document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up);
        line.classList.add("hidden");
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const s = under && under.closest && under.closest(".socket");
        if (!s) return;
        const y2 = Number(s.getAttribute("y")) + 16;
        if (s.dataset.c !== c || linkCross(y1, y2)) {
          sfx.spark(); s.classList.add("spark"); setTimeout(() => s.classList.remove("spark"), 500);
          mistake(s.dataset.c !== c ? "Bzzt! Match the colours." : "Bzzt! Wires must not cross. Try another order.");
          return;
        }
        done[c] = { y1, y2 };
        links.appendChild(svgEl("path", { d: `M40 ${y1} C 200 ${y1}, 200 ${y2}, 346 ${y2}`, stroke: c, class: "wire" }));
        sfx.pop();
        $("#bat-fill").style.height = (Object.keys(done).length / colors.length) * 100 + "%";
        if (Object.keys(done).length === colors.length) onAll();
      };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    });
  }
  // E5: wipe a surface clean; % meter.
  function wipe(el, panels, onPct) {
    el.innerHTML = `<div class="wipe-row">` + Array.from({ length: panels }, (_, i) => `<div class="panel-pv"><canvas width="160" height="110" data-i="${i}"></canvas></div>`).join("") +
      `</div><div class="pct-meter"><div id="pct-fill"></div><span id="pct-num">0%</span></div>`;
    const cvs = [...el.querySelectorAll("canvas")];
    cvs.forEach((c) => {
      const x = c.getContext("2d");
      x.fillStyle = S.site === "moon" ? "#8d8d8d" : "#c4703b"; x.fillRect(0, 0, 160, 110);
      for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${S.site === "moon" ? "120,120,120" : "150,80,40"},0.5)`; x.beginPath(); x.arc(Math.random() * 160, Math.random() * 110, Math.random() * 6, 0, 7); x.fill(); }
      x.globalCompositeOperation = "destination-out";
    });
    let down = false;
    const measure = () => {
      let clear = 0, tot = 0;
      cvs.forEach((c) => { const d = c.getContext("2d").getImageData(0, 0, 160, 110).data; for (let i = 3; i < d.length; i += 64) { tot++; if (d[i] < 40) clear++; } });
      const p = Math.round(clear / tot * 100);
      $("#pct-fill").style.width = p + "%"; $("#pct-num").textContent = p + "%";
      onPct(p);
    };
    let lastM = 0;
    const rub = (e) => {
      if (!down) return;
      const c = document.elementFromPoint(e.clientX, e.clientY);
      if (!c || c.tagName !== "CANVAS" || !cvs.includes(c)) return;
      const r = c.getBoundingClientRect(), x = c.getContext("2d");
      x.beginPath(); x.arc((e.clientX - r.left) * 160 / r.width, (e.clientY - r.top) * 110 / r.height, 16, 0, 7); x.fill();
      if (performance.now() - lastM > 120) { lastM = performance.now(); measure(); }
    };
    el.addEventListener("pointerdown", (e) => { down = true; e.preventDefault(); rub(e); });
    document.addEventListener("pointermove", rub);
    document.addEventListener("pointerup", () => { if (down) { down = false; measure(); } });
  }

  // ===================== the 10 missions =====================
  const GAMES = {
    // P1 Mars: Dust Off the Panels (E5)
    dust(el) {
      help("Rub the dust off all 3 panels! Over 90% clean is Great.");
      let finished = false;
      wipe(el, 3, (p) => { if (!finished && p >= 90) { finished = true; help("Shiny! ✨"); mg.finish("great"); } else if (p >= 60) $("#mg-giveup").classList.remove("hidden"); });
      mg.onGiveUp = () => "good";
    },
    // P1 Moon: Turn to the Sun (E2 dial)
    turn(el) {
      help("Turn the dial so the tall panel faces the low Sun. Hold it in the green zone.");
      el.innerHTML = `<div class="sun-row"><div class="low-sun">☀️</div><div class="vpanel" id="vpanel"></div></div><div id="z"></div>`;
      zoneSlider(el.querySelector("#z"), { label: "Panel angle", lo: 62, hi: 78, start: 10, onValue: (v) => { $("#vpanel").style.transform = `rotate(${(v - 70) * 0.9}deg)`; }, onGreen: () => { help("The beam lights up the panel! ⚡"); mg.finish(q()); } });
    },
    // P2 Charge the Battery (E3)
    battery(el) {
      help("Drag each wire to the socket of the same colour. Don't cross the wires!");
      wires(el, ["#f5c518", "#3f8fe0", "#3fbf6a"], () => { help("Battery charged! 🔋"); mg.finish(q()); });
    },
    // G1 Plant & Water (E1 then E2)
    plant(el) {
      help("1) Drag a seed into each of the 4 trays.");
      const seeds = [["🥬", "lettuce"], ["🥔", "potato"], ["🍅", "tomato"]];
      el.innerHTML = `<div class="tray-row"><div class="seed-tray">${seeds.map(([e, n]) => `<div class="drag seed" data-n="${n}" title="${n}">${e}</div>`).join("")}</div>` +
        `<div class="grow-trays">${[0, 1, 2, 3].map((i) => `<div class="slot gtray" data-i="${i}"></div>`).join("")}</div></div><div id="z"></div>`;
      let planted = 0;
      dragToSlot(el, (item, slot) => {
        if (!slot.classList.contains("gtray") || slot.classList.contains("full")) return;
        slot.classList.add("full"); slot.innerHTML = `<span class="sprout">🌱</span><span class="tiny">${item.textContent}</span>`; sfx.pop(); planted++;
        if (planted === 4) {
          help("2) Hold the nozzle: raise the moisture into the green zone, then hold it there. Too much water turns it red!");
          let wet = false;
          zoneSlider(el.querySelector("#z"), { label: "💧 Moisture", lo: 45, hi: 70, red: 80, start: 0, onRed: () => { wet = true; mistake("Too much! The water drains back. Bring it down to green."); }, onGreen: () => { help("Perfectly watered! 🌱"); mg.finish(wet ? "good" : q()); } });
        }
      });
    },
    // G2 Harvest (E1)
    harvest(el) {
      help("Drag only the ripe food into the crate. Small, pale ones are not ready yet!");
      const ripe = S.crop === "big" ? ["🥬", "🍅", "🥔", "🍅", "🥬", "🥔"] : ["🥬", "🍅", "🥔"];
      const items = ripe.map((e) => ({ e, ok: true })).concat([{ e: "🌱", ok: false }, { e: "🌿", ok: false }]).sort(() => Math.random() - 0.5);
      el.innerHTML = `<div class="tray-row"><div class="plants">${items.map((it, i) => `<div class="drag produce ${it.ok ? "" : "unripe"}" data-ok="${it.ok}" data-i="${i}">${it.e}</div>`).join("")}</div>` +
        `<div class="slot crate-box">📦<div class="food">Food: <b id="food">0</b></div></div></div>`;
      let got = 0;
      dragToSlot(el, (item, slot) => {
        if (!slot.classList.contains("crate-box")) return;
        if (item.dataset.ok !== "true") { item.classList.add("wiggle"); setTimeout(() => item.classList.remove("wiggle"), 500); mistake("Not yet! That one isn't ripe."); return; }
        item.classList.add("used"); got++; $("#food").textContent = got; sfx.pop();
        if (got === ripe.length) { help("All the ripe food is in! 🥗"); mg.finish(q()); }
      });
    },
    // W1 Melt the Ice (E1 then E2)
    melt(el) {
      help("1) Drag the 3 ice blocks into the heater.");
      el.innerHTML = `<div class="tray-row"><div class="ice-tray">${[0, 1, 2].map(() => `<div class="drag ice ${S.site}">🧊</div>`).join("")}</div>` +
        `<div class="slot heater"><div class="window" id="win"></div><span>Heater</span></div></div><div id="z"></div>`;
      let n = 0;
      dragToSlot(el, (item, slot) => {
        if (!slot.classList.contains("heater")) return;
        item.classList.add("used"); n++; sfx.pop(); $("#win").textContent = "🧊".repeat(n);
        if (n === 3) {
          help("2) Raise the temperature into the green zone and hold it there until the ice melts. Red = boiling!");
          let steam = false;
          zoneSlider(el.querySelector("#z"), { label: "🌡️ Temperature", lo: 40, hi: 65, red: 75, start: 0, holdMs: 2500,
            onValue: (v) => { $("#win").textContent = v >= 75 ? "♨️" : v >= 40 ? "💧🧊" : "🧊🧊🧊"; },
            onRed: () => { steam = true; mistake("Steam is escaping! Some water is lost. Back to green!"); },
            onGreen: () => { $("#win").textContent = "💧💧💧"; help("Clean water! 💧"); mg.finish(steam ? "good" : q()); } });
        }
      });
    },
    // W2 Recycle the Water (E4)
    recycle(el) {
      help("Stack the filter layers from top to bottom, then tap Pour.");
      const layers = [["gravel", "🪨 Gravel"], ["charcoal", "⬛ Charcoal"], ["membrane", "▫️ Membrane"]].sort(() => Math.random() - 0.5);
      el.innerHTML = `<div class="tray-row"><div class="layer-tray">${layers.map(([id, t]) => `<div class="drag layer l-${id}" data-id="${id}">${t}</div>`).join("")}</div>` +
        `<div class="column"><div class="cup">🥤 cloudy water</div>${[0, 1, 2].map((i) => `<div class="slot lslot" data-i="${i}"></div>`).join("")}<div class="drops" id="drops">💧 ?</div></div></div>` +
        `<div class="row"><button class="btn btn-go" id="pour">Pour 💧</button></div>`;
      const right = ["gravel", "charcoal", "membrane"];
      dragToSlot(el, (item, slot) => {
        if (!slot.classList.contains("lslot")) return;
        const prev = slot.querySelector(".layer");
        if (prev) { el.querySelector(".layer-tray").appendChild(prev); prev.classList.remove("used"); }
        slot.appendChild(item); sfx.pop();
      });
      el.querySelector("#pour").addEventListener("click", () => {
        const got = [...el.querySelectorAll(".lslot")].map((s) => (s.querySelector(".layer") || {}).dataset ? s.querySelector(".layer").dataset.id : null);
        if (got.includes(null)) { help("Put all 3 layers in the column first."); return; }
        if (got.join() === right.join()) { $("#drops").textContent = "💧 clear!"; $("#drops").className = "drops clear"; help("Crystal clear! 💧"); mg.finish(q()); }
        else { $("#drops").textContent = "🟤 still cloudy"; mistake('"Big stuff first, tiny stuff last!" Swap the layers and try again.'); }
      });
    },
    // S1 Stack Regolith Bricks (E1)
    bricks(el) {
      help("Drag a brick onto each glowing weak spot in the dome.");
      el.innerHTML = `<div class="tray-row"><div class="press"><span>Brick press</span>${[0, 1, 2, 3, 4].map(() => `<div class="drag brick ${S.site}">🧱</div>`).join("")}</div>` +
        `<div class="dome">${[0, 1, 2, 3, 4].map((i) => `<div class="slot weak" style="--a:${i}"></div>`).join("")}<div class="streaks">✦ ✦ ✦</div></div></div>`;
      let n = 0;
      dragToSlot(el, (item, slot) => {
        if (!slot.classList.contains("weak") || slot.classList.contains("fixed")) return;
        slot.classList.add("fixed"); slot.textContent = "🧱"; item.classList.add("used"); n++; sfx.pop();
        if (n === 5) { el.querySelector(".streaks").textContent = "↩ ↩ ↩"; help("All weak spots covered! Particles bounce off. 🛡️"); mg.finish("great"); }
      });
    },
    // S2 Fill the Water Wall (E2)
    wall(el) {
      help("Fill the wall tanks up to the green band, then stop there.");
      el.innerHTML = `<div class="tray-row"><div class="wall-tank"><div class="wt-fill" id="wt"></div></div><div class="rad-meter">☢️ particles getting in: <b id="rad">many</b></div></div><div id="z"></div>`;
      let over = false;
      zoneSlider(el.querySelector("#z"), { label: "🚰 Wall water level", lo: 70, hi: 88, red: 95, start: 0,
        onValue: (v) => { $("#wt").style.height = v + "%"; $("#rad").textContent = v > 70 ? "very few" : v > 35 ? "some" : "many"; },
        onRed: () => { over = true; mistake("The tanks overflowed! Bring it back to the green band."); },
        onGreen: () => { help("The wall is full! 🛡️"); mg.finish(over ? "good" : q()); } });
    },
    // L1 Scan Rock Samples (E1 + pick a match)
    scan(el) {
      help("Drag each rock under the scanner, then tap the pattern that matches the glow.");
      const P = { Ice: ["#bfefff", "#ffffff", "#7fd3ff"], Iron: ["#b5462e", "#7a2a1a", "#d9784f"], Clay: ["#c9a26b", "#8f7a4f", "#e0c48f"], "Oxygen-rich": ["#7cf0a0", "#2fae6a", "#c8ffd8"] };
      const types = Object.keys(P);
      const rocks = [types[Math.floor(Math.random() * 4)], types[Math.floor(Math.random() * 4)], types[Math.floor(Math.random() * 4)]];
      if (Math.random() < 0.6 && !rocks.includes("Ice")) rocks[1] = "Ice";
      const bars = (k) => P[k].map((c) => `<i style="background:${c}"></i>`).join("");
      el.innerHTML = `<div class="tray-row"><div class="rocks">${rocks.map((r, i) => `<div class="drag rock" data-t="${r}" data-i="${i}">🪨</div>`).join("")}</div>` +
        `<div class="slot scanner"><div class="glow" id="glow">place a rock</div></div>` +
        `<div class="chart">${types.map((t) => `<button class="pat" data-t="${t}"><span class="pbars">${bars(t)}</span>${t}</button>`).join("")}</div></div><div id="found" class="small"></div>`;
      let cur = null, matched = 0;
      dragToSlot(el, (item, slot) => {
        if (!slot.classList.contains("scanner") || cur) return;
        cur = item; item.classList.add("used");
        $("#glow").innerHTML = `<span class="pbars big">${bars(item.dataset.t)}</span>`; sfx.pop();
      });
      el.querySelector(".chart").addEventListener("click", (e) => {
        const b = e.target.closest(".pat");
        if (!b || !cur) return;
        if (b.dataset.t !== cur.dataset.t) { mistake("Look again at the colours!"); return; }
        matched++; sfx.good();
        $("#found").innerHTML += `Rock ${matched}: <b>${cur.dataset.t}</b>${cur.dataset.t === "Ice" ? " 🧊 ice-rich spot!" : ""} · `;
        if (cur.dataset.t === "Ice") mg.ice = true;
        cur = null; $("#glow").textContent = "place a rock";
        if (matched === 3) { help("All 3 rocks identified! 🔬"); mg.finish(q()); }
      });
    },
    // L2 Watch the Sun (E2 two dials, wave matching)
    sun(el) {
      help("Turn the two dials until your blue wave lies on top of the Sun's orange wave.");
      const tA = 30 + Math.round(Math.random() * 40), tF = 30 + Math.round(Math.random() * 40);
      el.innerHTML = `<div class="scope">🌞<span class="spot">●</span></div><svg class="waves" viewBox="0 0 400 120"><path id="w-sun" class="w-sun"/><path id="w-me" class="w-me"/></svg>` +
        `<label>Size <input type="range" id="d-a" min="0" max="100" value="5"></label><label>Speed <input type="range" id="d-f" min="0" max="100" value="95"></label><div class="hold-bar"><div id="sun-h"></div></div>`;
      const path = (a, f) => { let d = ""; for (let x = 0; x <= 400; x += 5) d += (x ? "L" : "M") + x + " " + (60 + Math.sin(x / 400 * Math.PI * 2 * (1 + f / 20)) * (5 + a * 0.5)).toFixed(1) + " "; return d; };
      $("#w-sun").setAttribute("d", path(tA, tF));
      let t0 = null, done = false;
      const tick = () => {
        if (done || !document.getElementById("d-a")) return;
        const a = Number($("#d-a").value), f = Number($("#d-f").value);
        $("#w-me").setAttribute("d", path(a, f));
        if (Math.abs(a - tA) <= 6 && Math.abs(f - tF) <= 6) {
          t0 = t0 || performance.now();
          const p = Math.min(1, (performance.now() - t0) / 1000); $("#sun-h").style.width = p * 100 + "%";
          if (p >= 1) { done = true; help("Matched! The full forecast is ready. 🔭"); mg.finish(q()); return; }
        } else { t0 = null; $("#sun-h").style.width = "0"; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };

  // ===================== mission results =====================
  function applyMission(mid, quality) {
    const great = quality === "great";
    const f = great ? 1 : GOOD_FACTOR;
    const k = S.kitten;
    const perk = (st) => (k === "nova" && st === "greenhouse") || (k === "rocket" && st === "power") ? 1.25 : 1;
    const outside = (n) => (k === "luna" ? Math.round(n / 2) : n);
    const st = MISSIONS[mid].station;
    const g = (n) => Math.round(n * f * perk(st));
    let because = "";
    switch (mid) {
      case "dust": { const p = g(S.site === "mars" && dusty() ? 16 : 10); S.power += p; S.health -= outside(2); because = S.site === "moon" ? `Facing the low Sun, the tall panel made ${p} extra power.` : `Clean panels catch more light, so we got ${p} power. Working outside cost the crew a little health.`; break; }
      case "battery": { const p = g(12); S.power += p; S.life -= 4; because = `The battery stored ${p} power, but the greenhouse lights were off while we rewired.`; break; }
      case "plant": S.crop = "big"; S.plantedSol = S.sol; S.health += g(1); S.life -= 3; because = great ? "Perfect watering! Tomorrow's harvest will be BIG." : "The seeds are planted. A bit too much water drained away, but they'll grow."; break;
      case "harvest": { const big = S.crop === "big"; const l = g(big ? 16 : 8), h = g(big ? 3 : 2); S.life += l; S.health += h; S.power -= 3; S.crop = null; because = `${big ? "A big" : "A small"} harvest gave ${l} Life Support and fresh food for the crew. Now the trays are empty until we plant.`; break; }
      case "melt": { const l = g(S.iceFound ? 18 : 12); S.life += l; S.power -= 8; because = `Melting ice made ${l} Life Support, but the heaters used 8 power.` + (S.iceFound ? " The ice-rich rock helped!" : ""); S.iceFound = false; break; }
      case "recycle": S.life += g(6); S.health += g(2); S.power -= 3; because = "Recycled water is clean water: more Life Support and a healthier crew."; break;
      case "bricks": S.bricks = Math.min(SHIELD_MAX, S.bricks + 1); S.health -= outside(2); S.power -= 4; because = "The new bricks raise the Shield for the rest of the mission. Building outside cost a little health."; break;
      case "wall": S.shieldTonight = 1; S.life -= 6; because = "The water wall raises the Shield tonight. That water can't be used for drinking today."; break;
      case "scan": S.power -= 3; if (mg && mg.ice) { S.iceFound = true; because = "We found an ice-rich spot! The next Melt the Ice today gives 50% more water."; } else because = "We learned what the rocks are made of. Science pays in Credits!"; break;
      case "sun": S.power -= 3; S.fullForecast = true; because = "We matched the Sun's signal, so now we know exactly what's coming."; break;
    }
    S.power = clamp(S.power); S.life = clamp(S.life); S.health = clamp(S.health);
    const lab = st === "lab";
    let c = lab ? (great ? CREDITS.labGreat : CREDITS.labGood) : (great ? CREDITS.great : CREDITS.good);
    if (lab && k === "cosmo") c += 10;
    return { because, credits: c };
  }
  function missionResult(mid, quality) {
    const before = { power: S.power, life: S.life, health: S.health };
    S.done[mid] = true; S.actionsUsed++;
    const r = applyMission(mid, quality);
    const mi = MISSIONS[mid];
    quality === "great" ? sfx.good() : sfx.click();
    renderBars();
    addCredits(r.credits);
    $("#modal").innerHTML = `<div class="result"><h2>${quality === "great" ? "🌟 Great!" : "👍 Good!"} ${mName(mid)}</h2>` +
      `<p class="cat-line">${kittenImg(S.kitten, "mini cheer")}<span>${quality === "great" ? "Neat job, partner!" : "Good work! A neater job next time gives the full effect."}</span></p>` +
      deltasHTML(before) + `<p class="because"><b>Because…</b> ${r.because}</p><p class="small">🪙 +${r.credits} Credits</p>` +
      `<details class="real" open><summary>🔬 Real Science</summary><p>${mi.real}</p><p class="citation">Source: <a href="${mi.src.url}" target="_blank" rel="noopener">${mi.src.text}</a></p></details>` +
      `<div class="modal-actions"><button class="btn btn-blue" data-action="enter-station" data-id="${mi.station}">◀ Back to station</button><button class="btn btn-go" data-action="close-overlay">Back to the base ▶</button></div></div>`;
    mg = null;
    if (checkLose()) return;
    if (S.actionsUsed >= ACTIONS_PER_SOL) say("Both actions used! Press END " + S.unit.toUpperCase() + " when you're ready.", "happy");
  }
  function deltasHTML(before) {
    const d = (k, ico, name) => {
      const diff = Math.round(S[k] - before[k]);
      return `<div class="delta ${diff < 0 ? "down" : diff > 0 ? "up" : ""}"><span class="ico">${ico}</span>${name}<br>${Math.round(before[k])} → ${Math.round(S[k])} <b>${diff ? (diff > 0 ? "▲" : "▼") + signed(diff) : "±0"}</b></div>`;
    };
    return `<div class="deltas">${d("power", "⚡", "Power")}${d("life", "💨", "Life Support")}${d("health", "❤️", "Crew Health")}</div>`;
  }

  // ===================== event, Decide, Ask Earth =====================
  function openOverlay(kind) {
    const ov = $("#overlay");
    ov.classList.remove("hidden", "flash", "redsky", "dark");
    ov.dataset.kind = kind || "";
  }
  function endSol() {
    S.placing = null;
    const ev = currentEvent();
    if (isQuiet(ev)) { resolve(null); return; }
    S.askedEarth = null;
    openOverlay("event");
    const ov = $("#overlay");
    void ov.offsetWidth;
    if (isRad(ev)) { ov.classList.add("flash"); sfx.alarm(); }
    if (ev.type === "dust") { ov.classList.add("redsky"); sfx.alarm(); }
    if (ev.type === "night") ov.classList.add("dark");
    const choices = choicesFor(ev);
    $("#modal").innerHTML =
      `<div class="ev-head"><div class="big-ico anim-${ev.type}">${ev.icon}</div><div><h2>${S.unit} ${S.sol}: ${ev.title}</h2>` +
      `<div class="citation">${ev.citation.text} ${badge(ev.mode)}</div></div></div>` +
      `<p class="cat-line">${kittenImg(S.kitten, "mini worried")}<span><b>${ev.headline}</b><br><span class="why">${ev.why}</span></span></p>` +
      `<details class="real"><summary>🔬 Real Science</summary><p>${ev.realScience}</p><p class="citation">Source: <a href="${ev.citation.url}" target="_blank" rel="noopener">${ev.citation.text}</a></p></details>` +
      `<h3>What will you do?</h3><div class="choices">` +
      choices.map((c) => `<button class="choice" data-action="choose" data-id="${c.id}" ${c.enabled ? "" : "disabled"}><span class="name">${c.icon} ${c.name}</span><span class="cost">${c.cost}</span></button>`).join("") +
      `</div><div class="earth"><button class="btn" data-action="ask-earth">📡 Ask Earth</button><div id="earth-anim" class="earth-anim hidden"><span class="dish">📡</span><span class="msg">✉️</span><span class="planet">🌍</span><span class="clock" id="earth-clock"></span></div><p id="earth-reply">Message time to Earth today: <b>${fmtMinutes(ev.lightDelayMinutes)}</b> each way. Asking is free.</p></div>`;
    speak(ev.headline + " " + ev.why);
  }
  function choicesFor(ev) {
    const hasShelter = count("shield") > 0;
    const saved = S.actionsUsed < ACTIONS_PER_SOL;
    if (isRad(ev)) return [
      { id: "shelter", icon: "🏠", name: "Shelter", cost: hasShelter ? "Storm dose × 0.15 · 💨 −6 (nobody tends the plants) · 🪙 +10" : "Needs a Radiation Shield station", enabled: hasShelter },
      { id: "work", icon: "⛏️", name: "Keep Working", cost: `Full storm dose, cut ${shieldLevel() * 25}% by your Shield · 🪙 +10 +20 brave`, enabled: true },
      { id: "reinforce", icon: "🧱", name: "Reinforce", cost: saved ? "Uses your saved action · 🛡️ +1 tonight · ⚡ −5 · dose × 0.6 · 🪙 +10 +10" : "Needs 1 saved action", enabled: saved }
    ];
    return [
      { id: "powerdown", icon: "🔌", name: "Power Down", cost: "Greenhouses and Lab stop tonight: no power cost from them, no Life Support from greenhouses · 🪙 +10", enabled: true },
      { id: "keepon", icon: "💡", name: "Keep Everything On", cost: "Normal production and normal costs. Risky in the dark! · 🪙 +10", enabled: true }
    ];
  }
  function askEarth() {
    const ev = currentEvent();
    const btn = $('[data-action="ask-earth"]');
    if (btn) btn.disabled = true;
    const reply = $("#earth-reply");
    sfx.click();
    if (ev.conjunction) { S.askedEarth = "none"; reply.innerHTML = "☀️ <b>The Sun is between Earth and Mars.</b> Its hot gas scrambles the radio. Real crews decide alone during solar conjunction!"; return; }
    const roundTrip = ev.lightDelayMinutes * 2;
    $("#earth-anim").classList.remove("hidden");
    $("#earth-clock").textContent = "⏱ " + fmtMinutes(roundTrip) + " round trip";
    if (!ev.earthAdvice) { reply.textContent = "Mission Control has no advice for this one."; return; }
    if (roundTrip <= ev.warningMinutes) {
      S.askedEarth = "intime";
      reply.innerHTML = `✅ Reply arrived in ${fmtMinutes(roundTrip)}, in time! Mission Control says: <b>"${ev.earthAdvice.text}"</b>`;
      const rec = $(`.choice[data-id="${ev.earthAdvice.choice}"]`);
      if (rec) rec.classList.add("recommended");
      speak("Mission Control says: " + ev.earthAdvice.text);
    } else {
      S.askedEarth = "late";
      reply.innerHTML = `⏳ Your message needs <b>${fmtMinutes(roundTrip)}</b> to reach Earth and come back, but the storm arrives in <b>${fmtMinutes(ev.warningMinutes)}</b>. <b>Earth's reply is still on its way. Real crews decide alone!</b>`;
      speak("Earth's reply is still on its way! Real crews decide alone.");
    }
  }

  function resolve(choiceId) {
    const ev = currentEvent();
    const before = { power: S.power, life: S.life, health: S.health };
    const c0 = S.credits;
    let because = "", powerDown = false;
    if (isRad(ev)) {
      if (choiceId === "reinforce") { S.actionsUsed++; S.shieldTonight = Math.min(SHIELD_MAX, S.shieldTonight + 1); S.power -= 5; }
      const base = TIER_BASE[ev.dangerTier] || 0;
      const lvl = shieldLevel();
      let hit;
      if (choiceId === "shelter") hit = base * SHELTER_FACTOR;
      else if (choiceId === "reinforce") hit = base * (1 - SHIELD_CUT * lvl) * REINFORCE_FACTOR;
      else hit = base * (1 - SHIELD_CUT * lvl) * (S.kitten === "luna" ? 0.5 : 1);
      hit = Math.round(hit);
      S.health -= hit;
      if (choiceId === "shelter") S.life -= 6;
      if (ev.dangerTier <= 1) because = choiceId === "shelter" ? "No big particle storm came, so hiding cost Life Support for almost nothing. Forecasting is hard!" : "No big particle storm came this time, so working was the right call.";
      else if (choiceId === "shelter") because = `The shelter blocked most of the particles, so the crew lost only ${hit} health. But nobody tended the plants, so Life Support dropped.`;
      else if (choiceId === "reinforce") because = `Your ${lvl} shields and the extra work blocked many particles. The crew lost ${hit} health.`;
      else because = lvl > 0 ? `Because your ${lvl} shield${lvl > 1 ? "s" : ""} blocked ${lvl * 25}% of the particles, the crew only lost ${hit} health.` : `With no shields, the crew soaked up the whole storm: −${hit} health.`;
    } else if (isPowerEvent(ev)) {
      powerDown = choiceId === "powerdown";
      const what = ev.type === "night" ? "with no sunlight at all" : "under the dusty sky";
      because = powerDown ? "Powering down saved electricity, but the greenhouses made no new Life Support tonight." : `Everything kept running, but the panels could not pay for it ${what}.`;
    } else because = ev.type === "conjunction" ? "Radio silence, but the base kept working on its own. Real crews must be independent." : "A calm day. The base did its daily work and used its daily supplies.";

    const o = overnight(ev.sunlight, powerDown);
    S.power = clamp(S.power + o.power); S.life = clamp(S.life + o.life); S.health = clamp(S.health + o.health);

    if (!isQuiet(ev)) {
      addCredits(CREDITS.survive);
      if (choiceId === "work") addCredits(CREDITS.keepWorking, "brave!");
      if (choiceId === "reinforce") addCredits(CREDITS.reinforce);
    }
    const choiceName = choiceId ? (choicesFor(ev).find((c) => c.id === choiceId) || { name: choiceId }).name : "–";
    S.history.push({ sol: S.sol, title: ev.title, icon: ev.icon, choice: choiceName, power: S.power, life: S.life, health: S.health, credits: S.credits - c0 });
    renderBars();
    showReveal(ev, before, because, o, choiceId);
  }
  function showReveal(ev, before, because, night, choiceId) {
    openOverlay("reveal");
    let earthLine = "";
    if (S.askedEarth === "late" && ev.earthAdvice) earthLine = `<p class="realnum">📡 Earth's message came ${fmtMinutes(ev.lightDelayMinutes * 2)} after you asked. It said: <i>"${ev.earthAdvice.text}"</i></p>`;
    const sunTxt = night.sun < 1 ? ` Sunlight was only ${Math.round(night.sun * 100)}%, so panels made ${night.sun === 0 ? "nothing" : "less power"}.` : "";
    const lost = S.health < before.health - 10 || S.power < 20 || S.life < 20;
    lost ? sfx.bad() : sfx.good();
    const last = S.sol >= totalSols();
    const talk = S.mode === "family" ? `<div class="talk-card">💬 <b>Talk about it:</b> ${talkPrompt(ev, choiceId)}</div>` : "";
    $("#modal").innerHTML = `<h2>${ev.icon} What happened</h2>` + deltasHTML(before) +
      `<p class="because"><b>Because…</b> ${because}</p>` +
      `<p class="realnum">🔬 <b>In real life:</b> ${ev.realNumber} ${badge(ev.mode)}</p>` + earthLine + roverPhotoHTML() +
      `<p class="overnight">🌙 Overnight: daily upkeep ⚡ −${UPKEEP.power} 💨 −${UPKEEP.life} ❤️ −${HEALTH_UPKEEP[S.site]} (background cosmic rays), plus every module's daily effect.${sunTxt}</p>` + talk +
      `<div class="modal-actions"><button class="btn btn-go" data-action="next">${last ? "Finish mission ▶" : "Next " + S.unit + " ▶"}</button></div>`;
    speak("Because. " + because);
  }
  function talkPrompt(ev, choice) {
    if (isRad(ev)) return ev.dangerTier <= 1 ? "Would you hide if the forecast was only half sure?" : choice === "work" ? "Was it worth the extra radiation to keep working? Why?" : "Why do real bases build shelters before storms come?";
    if (isPowerEvent(ev)) return "What would you turn off first if the power ran low at home?";
    return "What would you do on a calm day to get ready for a storm?";
  }
  function nextSol() {
    $("#overlay").classList.add("hidden");
    if (checkLose()) return;
    if (S.sol >= totalSols()) { finishMission(); return; }
    if (S.mode === "family") { familyPass(); return; }
    advanceSol();
  }
  function advanceSol() {
    $("#overlay").classList.add("hidden");
    S.sol++;
    S.actionsUsed = 0; S.done = {}; S.shieldTonight = 0; S.fullForecast = false; S.iceFound = false; S.askedEarth = null;
    if (S.mode === "infinite") {
      S.events.push(nextInfiniteEvent(S.sol));
      if ((S.sol - 1) % 5 === 0) { resupply(); return; }
    }
    renderGame();
    say(prepareHint(), isQuiet(currentEvent()) ? "happy" : "worried");
  }
  function familyPass() {
    openOverlay("pass");
    $("#modal").innerHTML = `<h2>🔄 Pass the device!</h2><p>Next player, it's your turn to lead ${S.unit} ${S.sol + 1}.</p><div class="modal-actions"><button class="btn btn-go" data-action="family-next">I'm ready ▶</button></div>`;
  }
  // Infinite: every 5 Sols a resupply rocket lands, choose 1 new crate
  function resupply() {
    S.phase = "build"; S.resupply = true; S.basePlaced = placedCount(); S.cargoLimit = 1;
    MOD_ORDER.forEach((k) => (S.cargo[k] = Math.max(S.cargo[k], 1)));
    renderGame();
    say("🚀 A resupply rocket landed! Choose 1 new crate and place it.", "happy");
  }
  function checkLose() {
    if (S.ended) return true;
    if (S.power <= 0 || S.life <= 0 || S.health <= 0) { showDebrief(false); return true; }
    return false;
  }
  function finishMission() { addCredits(CREDITS.complete); showDebrief(true); }

  // ===================== debrief =====================
  function rootCause() {
    const u = S.unit;
    if (S.power <= 0) return { head: `the base ran out of power on ${u} ${S.sol}`,
      why: `The base used more power than ${count("power")} Power Station${count("power") === 1 ? "" : "s"} could make, especially when ${S.site === "moon" ? "night" : "dust"} blocked the Sun.`,
      tip: `Take more Power Stations in the cargo, do Charge the Battery before ${S.site === "moon" ? "the lunar night" : "a dust storm"}, and Power Down when the sky is dark.` };
    if (S.life <= 0) return { head: `the crew ran out of air, water and food on ${u} ${S.sol}`,
      why: count("greenhouse") + count("water") === 0 ? "There was no Greenhouse or Water Station to make Life Support." : "Daily use was bigger than what the Greenhouse and Water Station made.",
      tip: "Plant one day and Harvest the next, and Melt the Ice when power allows." };
    return { head: `the crew got too much radiation on ${u} ${S.sol}`,
      why: shieldLevel() === 0 ? "The base had no shields, so particle storms hit the crew at full strength." : "Working outside during a strong particle storm gave the crew a big dose.",
      tip: "Take a Radiation Shield station, Stack Bricks on calm days, and Shelter when the forecast is dangerous. Watch the Sun to know for sure." };
  }
  function chartSVG() {
    const H = S.history, W = 360, Hh = 140, n = Math.max(1, H.length - 1);
    const line = (k, cls) => `<polyline class="${cls}" points="${H.map((h, i) => `${20 + i * (W - 30) / n},${Hh - 10 - h[k] * (Hh - 20) / 100}`).join(" ")}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Bars over each ${S.unit}">` +
      `<line x1="20" y1="${Hh - 10}" x2="${W}" y2="${Hh - 10}" class="axis"/>` + line("power", "c-power") + line("life", "c-life") + line("health", "c-health") +
      H.map((h, i) => `<text x="${20 + i * (W - 30) / n}" y="${Hh}" class="tick">${i}</text>`).join("") + `</svg>` +
      `<div class="legend"><span class="c-power">⚡ Power</span><span class="c-life">💨 Life Support</span><span class="c-health">❤️ Crew Health</span></div>`;
  }
  function showDebrief(won) {
    S.ended = true;
    $("#overlay").classList.add("hidden");
    const survived = won ? S.sol : S.sol - 1;
    const rows = S.history.filter((h) => h.sol > 0).map((h) => `<tr><td>${h.sol}</td><td>${h.icon} ${h.title}</td><td>${h.choice}</td><td>${h.power}</td><td>${h.life}</td><td>${h.health}</td></tr>`).join("");
    const table = rows ? `<table class="timeline"><tr><th>${S.unit}</th><th>Event</th><th>Your choice</th><th>⚡</th><th>💨</th><th>❤️</th></tr>${rows}</table>` : "";
    const where = S.site === "moon" ? "on the Moon" : "on Mars";
    const evs = S.events.slice(0, survived + (won ? 0 : 1)).filter((e) => !isQuiet(e) || e.type === "conjunction");
    let body;
    if (won) {
      body = `<div class="certificate"><div class="cert-kitten">${kittenImg(S.kitten, "cheer")}</div><div><div class="cert-title">CERTIFICATE OF SURVIVAL</div>` +
        `<h2>🏆 Mission complete!</h2><p class="headline">Commander ${kName()} and the crew survived ${survived} ${S.unit}s of real NASA space weather ${where}.</p>` +
        `<p class="score">🪙 ${S.credits} Credits</p></div></div>` + chartSVG() + table;
    } else {
      const rc = rootCause();
      body = `<h2>📋 Mission debrief</h2><p class="cat-line">${kittenImg(S.kitten, "mini")}<span>"Nice try! Let's see what happened."</span></p>` +
        `<p class="headline">Mission paused: ${rc.head}.</p>` + chartSVG() + table +
        `<p><b>Root cause:</b> ${rc.why}</p><p class="tip">💡 <b>What to try next:</b> ${rc.tip}</p>` +
        `<p class="score">🪙 ${S.credits} Credits · ${survived} ${S.unit}${survived === 1 ? "" : "s"} survived</p>`;
    }
    if (evs.length) body += `<h3>Real events you faced</h3><ul class="events-survived">` + evs.map((e) => `<li>${e.icon} ${e.title} – <a href="${e.citation.url}" target="_blank" rel="noopener">${e.citation.text}</a> ${badge(e.mode)}</li>`).join("") + `</ul>`;
    body += `<p class="tip">${kName()}: "Real mission planners make these same trade-offs: power, air, water and safety from radiation."</p>`;
    if (S.mode === "family") body += `<div class="grownups"><h3>For grown-ups</h3><p>Keep the conversation going offline with the Canadian Space Agency's free resources: ` +
      `<a href="https://www.asc-csa.gc.ca/eng/youth-educators/" target="_blank" rel="noopener">CSA youth and educators</a> and the ` +
      `<a href="https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production-in-space/" target="_blank" rel="noopener">Food Production in Space toolkit</a>.</p></div>`;
    $("#debrief").innerHTML = body +
      `<div class="row"><button class="btn btn-play" data-action="again">↻ TRY AGAIN</button>${S.mode === "family" ? `<button class="btn btn-blue" data-action="print">🖨️ Print</button>` : ""}<button class="btn btn-blue" data-action="home">🏠 HOME</button></div>`;
    won ? sfx.good() : sfx.bad();
    showScreen("debrief");
  }

  // ===================== briefing =====================
  function showBrief() {
    const where = site === "moon" ? "the Moon" : "Mars";
    const u = site === "moon" ? "Day" : "Sol";
    const unitNote = site === "moon" ? "<b>Day</b> = one Earth day here. Messages reach Earth in about 1.3 seconds." : "<b>Sol</b> – that's one Mars day (24 hours and 40 minutes). Messages to Earth take 3 to 22 minutes!";
    const n = mission === "live" ? (liveEvents ? liveEvents.length : LIVE_SOLS) : mission === "infinite" ? "as many" : QUICK_SOLS;
    let liveNote = "";
    if (mission === "live") liveNote = liveState === "live" ? `<p>${badge("LIVE")} We just checked NASA's space-weather database. These events happened on the Sun <b>this week</b>!</p>` : `<p>${badge("OFFLINE")} We couldn't reach NASA's live data right now, so you'll play real events from the archive instead.</p>`;
    $("#brief").innerHTML = `<h2>Mission briefing</h2>` +
      `<p class="cat-line">${kittenImg(kitten, "mini")}<span>Hi, commander! I'm ${KITTENS[kitten].name}. Our crew on ${where} is counting on us. Keep these three bars above zero for <b>${n} ${u}s</b>.</span></p>` + liveNote +
      `<ul class="brief-list"><li><span class="ico">⚡</span><b>Power</b> runs lights, heaters, machines and the radio.</li>` +
      `<li><span class="ico">💨</span><b>Life Support</b> is air, water and food.</li><li><span class="ico">❤️</span><b>Crew Health</b> drops when radiation hits the crew.</li>` +
      `<li><span class="ico">🛡️</span><b>Shield Level</b> (0-3): each level blocks 25% of a storm.</li><li><span class="ico">🪙</span><b>Credits</b> are your score. You earn them, never spend them.</li></ul>` +
      `<p><b>First:</b> choose ${CARGO_LIMIT} crates for the rocket and build your base. <b>Then</b> every ${u}: read the forecast, do 2 missions in your stations, and face the space weather.</p>` +
      `<p class="small">${unitNote}</p>` +
      `<div class="row"><button class="btn btn-blue" data-action="to-location">◀ BACK</button><button class="btn btn-play" data-action="begin">LET'S GO!</button></div>`;
    showScreen("brief");
  }
  function begin() {
    newGame();
    S.basePlaced = 0;
    showScreen("game");
    renderGame();
    say(`Let's build our base! Pick a crate, then tap a glowing tile. We can take ${CARGO_LIMIT} crates – every kilogram costs fuel to launch.`, "point");
  }
  function renderGame() { renderBars(S.phase === "sol" ? overnightPreviewNow() : null); renderGrid(); renderDock(); renderForecast(); renderSolButtons(); }
  function overnightPreviewNow() { const ev = currentEvent(); const o = overnight(ev ? ev.sunlight : 1, false); return { power: o.power, life: o.life, health: o.health }; }
  function renderSolButtons() {
    const end = $("#btn-endsol");
    end.classList.toggle("hidden", S.phase !== "sol");
    end.textContent = "END " + S.unit.toUpperCase() + " ▶";
    end.classList.toggle("pulse", S.actionsUsed >= ACTIONS_PER_SOL);
  }

  // ===================== kitten select =====================
  function renderKittens() {
    $("#kitten-cards").innerHTML = Object.keys(KITTENS).map((k) => {
      const K = KITTENS[k];
      return `<button class="kcard ${kitten === k ? "selected" : ""}" data-action="pick-kitten" data-id="${k}" style="--kc:${K.color}">` +
        `<span class="spot">${kittenImg(k, kitten === k ? "cheer" : "wave")}</span><span class="kname">${K.name.toUpperCase()}</span><span class="kperk">${K.perk}</span></button>`;
    }).join("");
    $("#kitten-line").textContent = kitten ? KITTENS[kitten].hi : "Pick your partner for the mission!";
    $("#btn-kitten-go").disabled = !kitten;
  }

  // ===================== data sources =====================
  function renderSources() {
    const liveBadge = liveState === "offline" ? "OFFLINE" : "LIVE";
    const list = [
      { ico: "🛰️", name: "NASA DONKI", what: "Space weather alerts: flares, particle storms, CMEs. Live in Today's Space Weather, archive in Quick Mission.", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/", mode: liveBadge },
      { ico: "🌌", name: "NASA APOD", what: "Today's real space picture on the Title screen.", url: "https://apod.nasa.gov/", mode: "LIVE" },
      { ico: "📷", name: "MARS ROVER PHOTOS", what: "A real Curiosity photo on Mars Reveal cards, when the service answers.", url: "https://api.nasa.gov/", mode: "LIVE" },
      { ico: "🤖", name: "CURIOSITY RAD", what: "Radiation on the Mars surface: about 0.67 mSv per day; 8,100 micrograys on 20 May 2024.", url: "https://doi.org/10.1126/science.1244797", mode: "ARCHIVE" },
      { ico: "🌕", name: "CHANG'E-4 LND", what: "Radiation on the Moon's surface: about 1.37 mSv per day.", url: "https://doi.org/10.1126/sciadv.aaz1334", mode: "ARCHIVE" },
      { ico: "🪐", name: "JPL HORIZONS", what: "Earth–Mars distance on each event date, which sets the Ask Earth delay.", url: "https://ssd.jpl.nasa.gov/horizons/", mode: "ARCHIVE" },
      { ico: "🌪️", name: "OPPORTUNITY ROVER", what: "The 2018 global dust storm that ended the rover's mission.", url: "https://science.nasa.gov/mission/mer-opportunity/", mode: "ARCHIVE" },
      { ico: "🌱", name: "CSA FOOD PRODUCTION TOOLKIT", what: "Crop facts for the Greenhouse missions.", url: "https://www.asc-csa.gc.ca/eng/youth-educators/", mode: "ARCHIVE" },
      { ico: "🧬", name: "NASA OSDR", what: "Space biology studies (plants and crew health).", url: "https://osdr.nasa.gov/", mode: "ARCHIVE" },
      { ico: "🧊", name: "PHOENIX · SWIM · LCROSS", what: "Water ice on Mars and in the Moon's dark craters (Water Station missions).", url: "https://science.nasa.gov/mission/phoenix/", mode: "ARCHIVE" }
    ];
    $("#sources-list").innerHTML = list.map((s) => `<div class="src"><div class="s-ico">${s.ico}</div><div><div class="s-name">${s.name}</div><div class="s-what">${s.what}</div>` +
      `<a href="${s.url}" target="_blank" rel="noopener">${s.url}</a></div>${badge(s.mode)}</div>`).join("");
  }

  // ===================== flow + wiring =====================
  function pickMission(id) { mission = id; $("#live-status").textContent = id === "live" ? "📡 Checking NASA's live space-weather data..." : ""; showScreen("location"); }
  async function pickSite(id) {
    site = id;
    document.body.classList.toggle("site-moon", id === "moon");
    document.body.classList.toggle("site-mars", id !== "moon");
    if (mission === "live") { $("#live-status").textContent = "📡 Asking NASA about the Sun this week..."; await startLiveFetch(id); }
    showBrief();
  }

  document.addEventListener("click", (e) => {
    const tile = e.target.closest && e.target.closest("#grid .tile, #grid .station");
    if (tile && S) {
      const key = tile.getAttribute("data-key");
      if (S.phase === "build") {
        if (S.placing && !S.tiles[key]) { placeOn(key); return; }
        if (S.tiles[key] && S.tiles[key] !== "habitat") { tileMenu(key); return; }
      } else if (S.tiles[key] && S.tiles[key] !== "habitat") { openStation(key); return; }
    }
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const a = el.dataset.action;
    if (a !== "toggle") sfx.click();
    if (a === "start") { renderKittens(); showScreen("kitten"); }
    else if (a === "pick-kitten") { kitten = el.dataset.id; renderKittens(); fillArt(); }
    else if (a === "to-missions") showScreen("missions");
    else if (a === "pick-mission") pickMission(el.dataset.id);
    else if (a === "to-location") showScreen("location");
    else if (a === "pick-site") pickSite(el.dataset.id);
    else if (a === "begin" || a === "again") begin();
    else if (a === "home") { document.body.classList.remove("site-moon"); document.body.classList.add("site-mars"); showScreen("title"); }
    else if (a === "sources") { renderSources(); showScreen("sources"); }
    else if (a === "settings") $("#settings").classList.remove("hidden");
    else if (a === "close-settings") $("#settings").classList.add("hidden");
    else if (a === "toggle") { settings[el.dataset.id] = !settings[el.dataset.id]; saveSettings(); applySettings(); sfx.click(); }
    else if (a === "crate") selectCrate(el.dataset.id);
    else if (a === "send-back") sendBack(el.dataset.key);
    else if (a === "move-mod") moveMod(el.dataset.key);
    else if (a === "launch") launch();
    else if (a === "enter-station") enterStation(el.dataset.id);
    else if (a === "not-now") say(prepareHint());
    else if (a === "start-mission") startMission(el.dataset.id);
    else if (a === "mg-done") { if (mg && !mg.over) { mg.over = true; missionResult(mg.mid, "good"); } }
    else if (a === "close-overlay") { $("#overlay").classList.add("hidden"); mg = null; renderGame(); if (!S.ended) say(S.actionsUsed >= ACTIONS_PER_SOL ? "Both actions used! Press END " + S.unit.toUpperCase() + "." : prepareHint()); }
    else if (a === "endsol") endSol();
    else if (a === "ask-earth") askEarth();
    else if (a === "choose") resolve(el.dataset.id);
    else if (a === "next") nextSol();
    else if (a === "family-next") advanceSol();
    else if (a === "print") window.print();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("#grid .tile[tabindex]")) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    if (e.key === "Escape") {
      if (!$("#settings").classList.contains("hidden")) $("#settings").classList.add("hidden");
      else if (S && S.placing) { S.placing = null; renderGame(); say("Okay, cancelled."); }
    }
  });
  $("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") $("#settings").classList.add("hidden"); });
  $("#text-size").addEventListener("input", (e) => { settings.textSize = Number(e.target.value); saveSettings(); applySettings(); });
  $("#reminder").addEventListener("change", (e) => { settings.reminder = Number(e.target.value); saveSettings(); applySettings(); });

  // test hook for scripted balance play (no effect on the game)
  window.__sols = { get S() { return S; }, MISSIONS, applyMission, resolve, overnight };

  // ===================== boot =====================
  loadSettings(); applySettings();
  const t0 = Date.now();
  preloadArt((p) => { $("#loadfill").style.width = Math.round(p * 100) + "%"; $("#rover").style.left = Math.round(p * 100) + "%"; }).then(() => {
    fillArt();
    $("#loadfill").style.width = "100%"; $("#rover").style.left = "100%";
    setTimeout(() => showScreen("title"), Math.max(0, 1200 - (Date.now() - t0)));
  });
  fillArt();
  loadApod();
  loadRoverPhotos();
})();
