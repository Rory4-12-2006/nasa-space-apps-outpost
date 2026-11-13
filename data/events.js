// Quick Mission events, one per Sol (Mars) or Day (Moon), taken from real NASA records.
// Owner: data person. The game reads window.MISSION_EVENTS.mars and window.MISSION_EVENTS.moon.
//
// STATUS: placeholder values written from memory, NOT yet checked.
// Every field marked "verify" must be checked against the source (DONKI, NASA news,
// JPL Horizons, papers) before submission. When a value is checked, set verified: true.
//
// Fields the game uses:
//   type: "quiet" | "flare" | "sep" | "dust" | "night"
//   dangerTier: 1-5 (sets the radiation hit for flare/sep)
//   warningMinutes: how early forecasters could warn the crew
//   lightDelayMinutes: one-way light time to Earth on that date (Moon: 1.3 s = 0.022 min)
//   blackout: true locks Ask Earth for this event
//   sunlight: solar output factor that night (1 clear, 0.2 big dust storm, 0 lunar night)
//   earthAdvice: the choice Mission Control would recommend, and why

(function () {
  const RAD_MARS = { text: "Hassler et al. 2014, Science (Curiosity RAD)", url: "https://doi.org/10.1126/science.1244797" };
  const RAD_MOON = { text: "Zhang et al. 2020, Science Advances (Chang'e-4 LND)", url: "https://doi.org/10.1126/sciadv.aaz1334" };
  const DONKI = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/search/";

  const flare2014 = (site) => ({
    id: "2014-10-24-FLR",
    type: "flare",
    icon: "🌞",
    title: "Giant sunspot flare",
    next: "BIG FLARE",
    headline: "A huge sunspot just made a big X-class flare!",
    why: "Flares are bright flashes from the Sun. Sometimes a particle storm follows... and sometimes it doesn't.",
    realScience: "In October 2014, sunspot region AR 2192, the biggest in 24 years, fired off several X-class flares. Surprisingly, it launched almost no fast particle storms. A crew that hid would have lost a work day for nothing. Forecasting is hard!",
    dangerTier: 1,
    warningMinutes: 8,
    lightDelayMinutes: site === "moon" ? 0.022 : 13, // verify Mars value with JPL Horizons for 2014-10-24
    // VALIDITY NOTE (team to decide): flare "radio blackouts" mainly hit HF radio on Earth's
    // day side. Deep-space radio links are not usually knocked out by a flare.
    blackout: true,
    blackoutText: "The flare's burst of radio noise is drowning out the signal. You must decide alone.",
    sunlight: 1,
    realNumber: "Flare class X3.1 on 24 Oct 2014, with no big particle storm after it.", // verify in DONKI
    citation: { text: "NASA DONKI – Solar Flare, 24 Oct 2014", url: DONKI },
    earthAdvice: null,
    mode: "ARCHIVE",
    verified: false
  });

  window.MISSION_EVENTS = {
    mars: [
      {
        id: "quiet-sol",
        type: "quiet",
        icon: "☀️",
        title: "A calm day on Mars",
        next: "CALM",
        headline: "The Sun is quiet today. A perfect day to build!",
        why: "Most days on Mars are calm. Use them to get ready for the bad days.",
        realScience: "Space weather comes in bursts. NASA's DONKI database shows many weeks with no big solar storms. Calm days are when real crews do maintenance and science.",
        dangerTier: 0,
        warningMinutes: 1440,
        lightDelayMinutes: 12,
        blackout: false,
        sunlight: 1,
        realNumber: "Normal radiation on the Mars surface is about 0.67 mSv per day (Curiosity RAD).",
        citation: RAD_MARS,
        earthAdvice: { choice: "tend", text: "Grow food while it's calm. Storms will come later." },
        mode: "ARCHIVE",
        verified: false
      },
      flare2014("mars"),
      {
        id: "2017-09-10-SEP",
        type: "sep",
        icon: "☢️",
        title: "Solar particle storm!",
        next: "PARTICLE STORM",
        headline: "The Sun just threw a burst of tiny fast particles at Mars!",
        why: "These particles can hurt the crew. Thick walls or a shelter keep them out.",
        realScience: "On 10 September 2017 an X8.2 flare and a very fast coronal mass ejection sent a solar particle storm toward Mars. Curiosity's RAD instrument on the surface measured a big jump in radiation. Mars was on the far side of the Sun, so a message to Earth and back took about 40 minutes.",
        dangerTier: 5,
        warningMinutes: 30,
        lightDelayMinutes: 20, // verify with JPL Horizons for 2017-09-10
        blackout: false,
        sunlight: 1,
        realNumber: "X8.2 flare on 10 Sep 2017. Curiosity RAD saw radiation on the surface more than double.", // verify
        citation: { text: "NASA DONKI – SEP, 10 Sep 2017; NASA/JPL news", url: DONKI },
        earthAdvice: { choice: "shelter", text: "This one is real and strong. Get the crew into the shelter!" },
        mode: "ARCHIVE",
        verified: false
      },
      {
        id: "2018-06-MARS-DUST",
        type: "dust",
        icon: "🌪️",
        title: "Planet-wide dust storm",
        next: "DUSTY",
        headline: "A giant dust storm is covering the whole planet!",
        why: "Dust blocks the sunlight, so solar panels make almost no power.",
        realScience: "In June 2018 a dust storm grew until it covered all of Mars. The sky went so dark that NASA's Opportunity rover could not charge its solar-powered batteries. It never woke up again.",
        dangerTier: 0,
        warningMinutes: 4320,
        lightDelayMinutes: 4, // verify: Mars was close to Earth in mid-2018
        blackout: false,
        sunlight: 0.2,
        realNumber: "Opportunity's last message was on 10 June 2018.",
        citation: { text: "NASA – Opportunity and the 2018 dust storm", url: "https://science.nasa.gov/mission/mer-opportunity/" },
        earthAdvice: { choice: "powerdown", text: "Save your battery. Turn the greenhouse down until the sky clears." },
        mode: "ARCHIVE",
        verified: false
      },
      {
        id: "2024-05-20-SEP",
        type: "sep",
        icon: "☢️",
        title: "The big one!",
        next: "HUGE STORM",
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
    ],

    moon: [
      {
        id: "quiet-moon",
        type: "quiet",
        icon: "☀️",
        title: "A calm lunar day",
        next: "CALM",
        headline: "The Sun is quiet. Time to build your Moon base!",
        why: "The Moon has no air to block radiation, so even calm days give the crew a small dose.",
        realScience: "China's Chang'e-4 lander measured radiation on the far side of the Moon: about 1.37 mSv per day, roughly twice as much as on the surface of Mars, because the Moon has no atmosphere at all.",
        dangerTier: 0,
        warningMinutes: 1440,
        lightDelayMinutes: 0.022,
        blackout: false,
        sunlight: 1,
        realNumber: "Moon surface radiation is about 1.37 mSv per day (Chang'e-4).", // verify
        citation: RAD_MOON,
        earthAdvice: { choice: "tend", text: "Grow food while it's calm. A long night is coming." },
        mode: "ARCHIVE",
        verified: false
      },
      flare2014("moon"),
      {
        id: "lunar-night",
        type: "night",
        icon: "🌑",
        title: "Lunar night falls",
        next: "NIGHT",
        headline: "The Sun is setting. The long lunar night is here!",
        why: "No sunlight means solar panels make nothing. You must live on stored power.",
        realScience: "At most places on the Moon, night lasts about 14 Earth days and the ground gets colder than −170 °C. Artemis plans to land near the south pole partly because some high ridges there get sunlight most of the time. The game shortens the night to one day.",
        dangerTier: 0,
        warningMinutes: 20160,
        lightDelayMinutes: 0.022,
        blackout: false,
        sunlight: 0,
        realNumber: "A full lunar day-and-night cycle lasts about 29.5 Earth days.",
        citation: { text: "NASA – Moon facts and the Artemis south pole region", url: "https://science.nasa.gov/moon/" },
        earthAdvice: { choice: "powerdown", text: "Turn the greenhouse down and save power until sunrise." },
        mode: "ARCHIVE",
        verified: false
      },
      {
        id: "2017-09-10-SEP-moon",
        type: "sep",
        icon: "☢️",
        title: "Solar particle storm!",
        next: "PARTICLE STORM",
        headline: "The Sun just threw a burst of tiny fast particles at the Earth and Moon!",
        why: "These particles can hurt the crew. Thick walls or a shelter keep them out.",
        realScience: "On 10 September 2017 an X8.2 flare sent a particle storm toward Earth and the Moon. It was so strong that detectors on the ground on Earth noticed it. On the Moon there is no air and no magnetic field to slow it down.",
        dangerTier: 5,
        warningMinutes: 30,
        lightDelayMinutes: 0.022,
        blackout: false,
        sunlight: 1,
        realNumber: "X8.2 flare on 10 Sep 2017, with particles strong enough to be measured at ground level on Earth.", // verify
        citation: { text: "NASA DONKI – SEP, 10 Sep 2017", url: DONKI },
        earthAdvice: { choice: "shelter", text: "Strong particle storm on the way. Get into the shelter now!" },
        mode: "ARCHIVE",
        verified: false
      },
      {
        id: "1972-08-SEP",
        type: "sep",
        icon: "☢️",
        title: "The storm between Apollo missions",
        next: "HUGE STORM",
        headline: "One of the biggest particle storms ever recorded is coming!",
        why: "This storm really happened, between two Apollo Moon landings. Luckily no one was on the Moon.",
        realScience: "In August 1972, between Apollo 16 (April) and Apollo 17 (December), the Sun unleashed one of the strongest particle storms ever recorded. Scientists later worked out that astronauts on the Moon would have needed good shelter. It is a big reason NASA plans storm shelters for Artemis.",
        dangerTier: 5,
        warningMinutes: 60,
        lightDelayMinutes: 0.022,
        blackout: false,
        sunlight: 1,
        realNumber: "The August 1972 solar particle storm happened between Apollo 16 and Apollo 17.", // verify
        citation: { text: "NASA – Space radiation and the August 1972 solar storm", url: "https://www.nasa.gov/" },
        earthAdvice: { choice: "shelter", text: "Huge storm. Everyone into the shelter!" },
        mode: "ARCHIVE",
        verified: false
      }
    ]
  };
})();
