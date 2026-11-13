# NASA Space Apps 2026 – Outpost Trade-off Game

Read this file first in every session. Both teammates use Claude, so keep it up to date and commit it with your changes.

## The challenge (summary)
Build an interactive game or app where **kids ages 7–12** run a **lunar or Martian outpost**. They balance competing needs: life support, radiation shielding, power, food, and communication delay. They should learn **real engineering trade-offs**, not just play a fun game.

What the judges want:
- **Every choice has a cost.** No "safe" choice that costs nothing.
- **Only 2–3 core resources.** Don't overwhelm young players.
- **Real NASA data**, with the sources named inside the game. Main candidates:
  - DONKI: solar flares and radiation events
  - OSDR: astronaut health findings
  - Artemis and Mars surface mission data
- **Be honest about data.** Never present a stored snapshot as live data.
- **Plain language.** Explain terms in one line inside the game (sol, radiation dose, microgravity).
- **Plays in the browser.** No download, no account.
- **Replayable.** Events change between playthroughs, and failing should feel like learning, not punishment.
- **Short write-up** of the datasets used and why.

## Hard constraints
- **Deadline: 2026-11-13 at midnight (local time).** Setup started at 12:30 the same day. Scope must fit roughly 10 hours of work.
- **Game language: English.**
- **Team:** 2 people, each working with Claude.

## Tech decisions
- **Plain HTML, CSS and JavaScript.** No framework, no build step, no backend. This saves setup time and runs anywhere.
- **Hosting: GitHub Pages**, which serves `index.html` from the root of `main`.
- **NASA data:** a curated snapshot lives in `data/`. We may also try a live DONKI call through `api.nasa.gov`. If the live call fails, use the snapshot and label it "archived NASA data".
- **API keys:** never commit a real NASA API key. Use `DEMO_KEY` or nothing.

## Game design (proposed – confirm or change)
- **Setting:** Moon base near the lunar south pole (the Artemis region). Each turn is one Earth day. A mission lasts about 10 days.
- **Core resources:** Power, Oxygen (life support), Radiation dose. Food is a slow background stat produced by the greenhouse.
- **Each turn:** the player splits a limited amount of power between:
  - Life support
  - Shielding
  - Greenhouse
  - Science (this is the score)
- **Events:** solar flares taken from real DONKI records, plus things like a dust storm or equipment failure. Random order each game.
- **Feedback:** after each choice, a one-line "real NASA fact" explains why it mattered.

## File layout
- `index.html`, `css/`, `js/`: the game
- `data/`: NASA data snapshots, each with its source URL and the date it was pulled
- `docs/PLAN.md`: timeline, task split, status
- `docs/DATA_SOURCES.md`: datasets used and why (for the judges)

## Team workflow
- `main` must always be playable, because GitHub Pages serves it.
- Each person works on their own branch (for example `feature/game-loop` or `feature/data`) and opens a pull request into `main`.
- Commit small and often, and run `git pull` before starting work.
- Avoid editing the same file at the same time. See the task split in `docs/PLAN.md`.

## Decisions log
- 2026-11-13: Chose vanilla JS + GitHub Pages because of the same-day deadline.
