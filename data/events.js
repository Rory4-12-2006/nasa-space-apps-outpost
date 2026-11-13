// Quick Mission events, one per Sol, taken from real NASA records.
// Owner: data person. The game reads window.MISSION_EVENTS.
//
// STATUS: placeholder values written from memory, NOT yet checked.
// Every field marked "verify" must be checked against the source URL
// (DONKI, NASA news, JPL Horizons) before submission. When a value is checked,
// set verified: true and write the date in pulledOn.
//
// Fields the game uses:
//   type: "quiet" | "flare" | "sep" | "dust"
//   dangerTier: 1-5 (sets the radiation hit for flare/sep)
//   warningMinutes: how early forecasters could warn the crew
//   lightDelayMinutes: one-way Earth-Mars light time on that date (JPL Horizons)
//   blackout: true if a flare knocks out radio, so Ask Earth is locked
//   sunlight: solar panel output factor for that night (1 = clear, 0.2 = big dust storm)
//   earthAdvice: the choice id Mission Control would recommend, and why

window.MISSION_EVENTS = [
  {
    id: "quiet-sol",
    type: "quiet",
    icon: "☀️",
    title: "A calm day on Mars",
    headline: "The Sun is quiet today. A perfect day to build!",
    why: "Most days on Mars are calm. Use them to get ready for the bad days.",
    realScience: "Space weather comes in bursts. NASA's DONKI database shows many weeks with no big solar storms. Calm days are when real crews do maintenance and science.",
    dangerTier: 0,
    warningMinutes: 1440,
    lightDelayMinutes: 12,
    blackout: false,
    sunlight: 1,
    realNumber: "Normal Mars surface radiation is about 0.67 mSv per day (Curiosity RAD).",
    citation: { text: "Hassler et al. 2014, Science (Curiosity RAD)", url: "https://doi.org/10.1126/science.1244797" },
    earthAdvice: { choice: "tend", text: "Grow food while it's calm. Storms will come later." },
    mode: "ARCHIVE",
    verified: false
  },
  {
    id: "2014-10-24-FLR",
    type: "flare",
    icon: "🌞",
    title: "Giant sunspot flare",
    headline: "A huge sunspot just made a big X-class flare!",
    why: "Flares are bright flashes of light. They can block radio for hours. Sometimes a particle storm follows... and sometimes it doesn't.",
    realScience: "In October 2014, sunspot region AR 2192, the biggest in 24 years, fired off several X-class flares. Surprisingly, it launched almost no fast particle storms. Crews who hid would have lost a work day for nothing. Forecasting is hard!",
    dangerTier: 1,
    warningMinutes: 8,
    lightDelayMinutes: 13, // verify with JPL Horizons for 2014-10-24
    blackout: true,
    sunlight: 1,
    realNumber: "Flare class X3.1 on 24 Oct 2014, with no big particle storm after it.", // verify in DONKI FLR
    citation: { text: "NASA DONKI – Solar Flare, 24 Oct 2014", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/search/" },
    earthAdvice: null,
    mode: "ARCHIVE",
    verified: false
  },
  {
    id: "2017-09-10-SEP",
    type: "sep",
    icon: "☢️",
    title: "Solar particle storm!",
    headline: "The Sun just threw a burst of tiny fast particles at Mars!",
    why: "These particles can hurt the crew. Thick walls or a shelter keep them out.",
    realScience: "On 10 September 2017 an X8.2 flare and a very fast coronal mass ejection sent a solar particle storm toward Mars. Curiosity's RAD instrument on the surface measured a big jump in radiation. Mars was on the far side of the Sun, so a message to Earth and back took about 40 minutes.",
    dangerTier: 5,
    warningMinutes: 30,
    lightDelayMinutes: 20, // verify with JPL Horizons for 2017-09-10
    blackout: false,
    sunlight: 1,
    realNumber: "X8.2 flare on 10 Sep 2017. Curiosity RAD saw radiation on the surface more than double.", // verify
    citation: { text: "NASA DONKI – SEP, 10 Sep 2017; NASA/JPL news", url: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/search/" },
    earthAdvice: { choice: "shelter", text: "This one is real and strong. Get the crew into the shelter!" },
    mode: "ARCHIVE",
    verified: false
  },
  {
    id: "2018-06-MARS-DUST",
    type: "dust",
    icon: "🌪️",
    title: "Planet-wide dust storm",
    headline: "A giant dust storm is covering the whole planet!",
    why: "Dust blocks the sunlight, so solar panels make almost no power.",
    realScience: "In June 2018 a dust storm grew until it covered all of Mars. The sky went so dark that NASA's Opportunity rover could not charge its solar-powered batteries. It never woke up again.",
    dangerTier: 0,
    warningMinutes: 4320,
    lightDelayMinutes: 4, // verify: Mars was close to Earth in mid-2018
    blackout: false,
    sunlight: 0.2,
    realNumber: "Opportunity's last message was on 10 June 2018.",
    citation: { text: "NASA JPL – Opportunity and the 2018 dust storm", url: "https://science.nasa.gov/mission/mer-opportunity/" },
    earthAdvice: { choice: "powerdown", text: "Save your battery. Turn the greenhouse down until the sky clears." },
    mode: "ARCHIVE",
    verified: false
  },
  {
    id: "2024-05-20-SEP",
    type: "sep",
    icon: "☢️",
    title: "The big one!",
    headline: "The strongest particle storm of this solar cycle is heading for Mars!",
    why: "Everything you built is tested now: walls, shelter and power.",
    realScience: "On 20 May 2024 a huge flare on the far side of the Sun sent particles to Mars. Curiosity's RAD measured 8,100 micrograys, like about 30 chest X-rays at once. An astronaut standing outside would have taken the biggest dose since the mission landed.",
    dangerTier: 5,
    warningMinutes: 20,
    lightDelayMinutes: 18, // verify with JPL Horizons for 2024-05-20
    blackout: false,
    sunlight: 1,
    realNumber: "Curiosity RAD measured 8,100 micrograys (8.1 mGy) on 20 May 2024.", // verify
    citation: { text: "NASA – 'NASA Watches Mars Light Up During Epic Solar Storm' (2024)", url: "https://science.nasa.gov/" },
    earthAdvice: { choice: "shelter", text: "Huge storm. Shelter now, work tomorrow." },
    mode: "ARCHIVE",
    verified: false
  }
];
