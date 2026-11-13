# Mars: Sols of Survival — NASA Space Apps Cairo 2026

Read this file first in every session. Both teammates use Claude, so keep it up to date and commit it with your changes.

- **Full design (the team's own document):** `docs/design/Mars-Sols-of-Survival-GDD.pdf`
- **Visual mockups (AI-generated):** `docs/mockups/`
- That document describes a 15-day build. **This file decides what we actually build in the hackathon.** When the two disagree, this file wins.

## Event facts (from the official Cairo 2026 guides)
- **Hackathon start:** Friday 13 Nov 2026, 1:00 PM Cairo time.
- **Submission:** Saturday 14 Nov 2026, 1:00 PM, per the guide's schedule ("confirm the final deadline").
  - The user mentioned "12 am", which doesn't match the guide.
  - **TODO: confirm the real deadline on Discord or the official announcements.**
  - Late submissions are not accepted.
- **Rule:** only work done during the hackathon counts. Preparing assets and plans in advance is allowed, but submitting pre-finished projects is prohibited. **Write no game code before 1:00 PM on Friday.**
- **Mentors** are available from 2:00 PM Friday through Discord. They can advise but cannot write code.
- **Ethics rules:**
  - Disclose AI use. That covers Claude-written code and the AI-generated art.
  - Credit every source.
  - The demo must not show the image, name or voice of anyone under 18.
- **Changes are not allowed after submission.** Only the team leader submits.
- **Every link must open without a password, account or access request.** That includes the GitHub repo, the game link and the video or slides.

## What we must submit
Submit to the local Cairo form first, then the same project on the official NASA Space Apps site:
1. **Demo:** a 30-second video, OR exactly 7 slides covering the challenge, the solution, why it matters and how it works. Public link. A video in Arabic needs English subtitles.
2. **Project links:** the playable game (GitHub Pages) and the GitHub repo.
3. **Project summary:** problem, solution, impact, and how it meets the challenge.
4. **Project resources:** datasets, sources, references and tools, including the AI disclosure.

## Judging criteria
- **Impact:** what problem we solve and for whom
- **Creativity:** an original approach
- **Validity:** sound science, real data, claims we can back up
- **Relevance:** fits this specific challenge
- **Presentation:** clear explanation of problem, solution, evidence and value

## The challenge
Kids ages 7–12 run a lunar or Martian outpost and learn real engineering trade-offs. The brief asks for:
- Every choice has a cost.
- Only 2–3 core resources.
- Real NASA data, credited inside the game.
- Never label static data as live.
- Plain language.
- Plays in the browser with no account.
- Replayable, with failure that doesn't feel like punishment.
- A short explanation of the datasets used.

## Tech decisions
- **Plain HTML, CSS and JavaScript.** No framework, no build step, no backend.
- **Hosting:** GitHub Pages from the root of `main`. Repo: https://github.com/Rory4-12-2006/nasa-space-apps-outpost
- **Event data:** a curated snapshot in `data/events.json`, labeled ARCHIVE in the game.
- **API keys:** any key in client-side JS on GitHub Pages is public. If we add a live DONKI call, use `DEMO_KEY` (its rate limit is per visitor IP, which is fine for a demo) and never commit a personal key.
- **Art:** simple CSS and emoji icons first, nicer art later. The mockups have UI text baked into them, so we can't use them as the game's UI. If we want the art, generate separate assets: Astro-Cat on its own, and a clean Mars background.

## MVP scope (build this first, in this order)
**Mars only, Quick Mission only: 5 Sols, about 3 minutes. One page, with the screens shown and hidden.**

1. **Title screen:** Play button, Data Sources button.
2. **Main screen:**
   - Three bars: Power ⚡, Life Support 💨, Crew Health 🧑‍🚀. Start at 70 / 70 / 100.
   - Sol counter, Shield Level (0–3), 2 Action Points, Astro-Cat speech box.
3. **Modules**, each with an icon-labeled cost. Use **slots, not a 6×6 grid** — a tile's position on the grid has no gameplay effect.
   - Solar Panel: ⚡ +10 per Sol × sunlight
   - Greenhouse: 💨 +9 per Sol, ⚡ −6 per Sol
   - Regolith Wall: +1 Shield Level, ⚡ −5 once
   - Storm Shelter: unlocks the Shelter choice, ⚡ −2 per Sol
4. **The five-beat Sol loop:** Forecast → Prepare (2 AP) → Event → Decide (Shelter / Keep working / Reinforce) → Reveal (bars move, a "Because…" line, the real number).
5. **Daily upkeep:** ⚡ −8, 💨 −8, 🧑‍🚀 −1. If any bar reaches 0, the game goes to the Debrief.
6. **Five scripted archive events** (the design doc §9), each with its citation on screen.
7. **Ask Earth:** compares light delay with the event's warning time. Locked during a flare blackout.
8. **Debrief:** what happened, the root cause, what to try next, and a Try Again button.
9. **Data Sources screen**, including "What's real vs. simplified" and the AI-use disclosure.

**Stretch goals, only after the MVP works end to end:**
- Live DONKI "Today's Space Weather" with an OFFLINE fallback
- Moon site
- Crew leads
- Predict-the-damage step
- Read-aloud and text size
- Endless mode

**Cut for the hackathon:** Family/Class mode, cosmetics, Science Journal, Battery, Science Lab, screen-time reminder.

## Design changes vs. the design doc (decided 2026-11-13)
- **Ask Earth too late:** the doc auto-resolves the event as "Keep working". Instead, the player still chooses on their own, and Earth's advice shows up in the Reveal ("Earth's reply arrived 25 minutes after the storm"). Taking the choice away from a kid feels like punishment and teaches less.
- **May 2024 event:** use the **20 May 2024** solar particle storm that NASA reported hit Mars and was measured by Curiosity RAD, not the Earth geomagnetic storm of 10–11 May. The game is on Mars. *(verify)*
- **Live data key:** DEMO_KEY, not a personal key. A personal key in public JavaScript leaks.

## Science facts — verify each before it goes in the game
| Fact | Value | Source to check |
|---|---|---|
| Mars surface dose | about 0.67 mSv/day | Hassler et al. 2014, *Science* (Curiosity RAD). Can count as the proposal's "scientific paper". |
| Moon surface dose | about 1.37 mSv/day | Zhang et al. 2020, *Science Advances* (Chang'e-4 LND) |
| Earth–Mars light delay | 3–22 minutes one way; Moon about 1.3 s | JPL Horizons |
| Sept 2017 event | X8.2 flare on 10 Sept 2017; particles reached the Mars surface (RAD) | DONKI, NASA news |
| Oct 2014 event | AR 2192: several X flares with few CMEs and no big particle storm | DONKI |
| 2018 dust storm | Global storm that ended the Opportunity rover | NASA JPL |
| NASA career dose limit | 600 mSv | NASA-STD-3001 (2022) |

## File layout
- `index.html`, `css/style.css`, `js/game.js`, `js/data.js`: the game
- `data/events.json`: archive events, each with source URL and pull date
- `docs/PLAN.md`: timeline, task split, status
- `docs/DATA_SOURCES.md`: datasets used and why (for the judges)
- `docs/design/`, `docs/mockups/`: the team's preparation material

## Team workflow
- `main` must always be playable, because GitHub Pages serves it.
- Each person works on their own branch and opens a pull request into `main`. Commit small and often, and run `git pull` before starting.
- Don't edit the same file at the same time:
  - Game person: `index.html`, `css/`, `js/`
  - Data person: `data/`, `docs/DATA_SOURCES.md`, submission material

## Decisions log
- 2026-11-13: Chose vanilla JS + GitHub Pages for speed.
- 2026-11-13: Adopted the team's "Mars: Sols of Survival" design, cut to the MVP above. Moon site is a stretch goal.
