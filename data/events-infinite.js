// Extra real events for Infinite Base mode (GDD v2 section 12).
// Infinite mode draws a random order from these PLUS the Quick Mission events in data/events.js.
// STATUS: written from memory, NOT yet checked. Verify every value and set verified: true.
// Same fields as data/events.js. Extra field: conjunction: true locks Ask Earth (Mars solar conjunction).
(function () {
  const DONKI = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/search/";
  const ev = (o) => Object.assign({ mode: "ARCHIVE", verified: false, blackout: false, sunlight: 1 }, o);

  const shared = [
    ev({ id: "2003-10-28-SEP", type: "sep", icon: "☢️", title: "Halloween storms of 2003", next: "PARTICLE STORM",
      headline: "Giant flares around Halloween are blasting particles across space!",
      why: "Several big storms came one after another. Walls and shelters matter most now.",
      realScience: "In late October and early November 2003 the Sun produced some of the biggest flares ever measured, including one rated X28 or more. Astronauts on the International Space Station moved to the better-shielded part of the station.",
      dangerTier: 4, warningMinutes: 30, lightDelayMinutes: 5, realNumber: "Late Oct 2003: a series of X-class flares, one rated about X28.",
      citation: { text: "NASA – The 2003 Halloween solar storms", url: "https://science.nasa.gov/" },
      earthAdvice: { choice: "shelter", text: "A strong particle storm. Use the shelter." } }),
    ev({ id: "2012-07-23-CME", type: "cme", icon: "🌀", title: "The near miss of July 2012", next: "SOLAR CLOUD",
      headline: "A super-fast cloud from the Sun is racing through space!",
      why: "Fast clouds can push particles ahead of them. Is it coming our way?",
      realScience: "On 23 July 2012 the Sun launched one of the fastest CMEs ever seen, about 3,000 km per second. It missed Earth by about a week of orbit. NASA's STEREO-A spacecraft was in its path and measured it.",
      dangerTier: 3, warningMinutes: 60, lightDelayMinutes: 12, realNumber: "CME speed about 3,000 km/s, measured by NASA STEREO-A.",
      citation: { text: "NASA DONKI – CME, 23 Jul 2012", url: DONKI },
      earthAdvice: { choice: "reinforce", text: "Fast cloud. Strengthen the walls just in case." } }),
    ev({ id: "2005-01-20-SEP", type: "sep", icon: "☢️", title: "The fastest particle storm", next: "PARTICLE STORM",
      headline: "Particles are arriving super fast, almost no warning!",
      why: "Some storms arrive in minutes. Walls you built earlier are what save you.",
      realScience: "On 20 January 2005 the Sun sent particles that reached Earth within about 15 minutes of the flare. That is why space bases need protection built before a storm, not during it.",
      dangerTier: 4, warningMinutes: 15, lightDelayMinutes: 18, realNumber: "20 Jan 2005: particles arrived about 15 minutes after the flare.",
      citation: { text: "NASA DONKI – SEP, 20 Jan 2005", url: DONKI },
      earthAdvice: { choice: "shelter", text: "Very fast storm. Shelter now." } }),
    ev({ id: "quiet-infinite", type: "quiet", icon: "☀️", title: "Calm Sun", next: "CALM",
      headline: "CALM SUN - no space weather today.", why: "Calm days are for maintenance and science.",
      realScience: "NASA's DONKI records show many quiet days between storms. Real crews use them for repairs and experiments.",
      dangerTier: 0, warningMinutes: 1440, lightDelayMinutes: 12, realNumber: "Most days in DONKI have no big event.",
      citation: { text: "NASA DONKI", url: DONKI }, earthAdvice: { choice: "tend", text: "Calm skies. Get ready." } })
  ];

  window.INFINITE_EVENTS = {
    mars: shared.concat([
      ev({ id: "2001-MARS-DUST", type: "dust", icon: "🌪️", title: "The 2001 global dust storm", next: "DUSTY",
        headline: "A dust storm is spreading around the whole planet!", why: "Dust blocks the Sun. Solar panels make much less power.",
        realScience: "In 2001 a dust storm grew to cover all of Mars. NASA's Mars Global Surveyor watched it from orbit. Dust stayed in the air for months.",
        dangerTier: 0, warningMinutes: 4320, lightDelayMinutes: 4, sunlight: 0.5, realNumber: "2001: a planet-wide storm seen by Mars Global Surveyor.",
        citation: { text: "NASA – Mars Global Surveyor, 2001 dust storm", url: "https://science.nasa.gov/" },
        earthAdvice: { choice: "powerdown", text: "Save power until the sky clears." } }),
      ev({ id: "2023-11-CONJ", type: "conjunction", icon: "🌞", title: "Solar conjunction: radio silence", next: "NO SIGNAL",
        headline: "The Sun is between Earth and Mars. Radio messages can't get through!",
        why: "For about two weeks, Earth can't help. The crew is on its own.",
        realScience: "About every 26 months the Sun sits between Earth and Mars. Its hot gas can scramble radio signals, so NASA pauses commands to its Mars missions for about two weeks. One happened in November 2023.",
        dangerTier: 0, warningMinutes: 1440, lightDelayMinutes: 21, conjunction: true, realNumber: "Mars solar conjunction, November 2023: about two weeks with no commands.",
        citation: { text: "NASA – Mars solar conjunction 2023", url: "https://science.nasa.gov/" },
        earthAdvice: null })
    ]),
    moon: shared.concat([
      ev({ id: "lunar-night-2", type: "night", icon: "🌑", title: "Lunar night again", next: "NIGHT",
        headline: "The long lunar night is back!", why: "No sunlight: panels make nothing. Live on stored power.",
        realScience: "Night on most of the Moon lasts about 14 Earth days. Sunlit ridges near the south pole help, which is one reason Artemis plans to go there.",
        dangerTier: 0, warningMinutes: 20160, lightDelayMinutes: 0.022, sunlight: 0, realNumber: "A lunar day-and-night cycle lasts about 29.5 Earth days.",
        citation: { text: "NASA – Moon facts", url: "https://science.nasa.gov/moon/" },
        earthAdvice: { choice: "powerdown", text: "Power down until sunrise." } })
    ])
  };
})();
