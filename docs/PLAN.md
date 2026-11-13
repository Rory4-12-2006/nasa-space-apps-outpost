# Plan – deadline 2026-11-13 at midnight

## Timeline (local time)
| Time | Goal |
|---|---|
| 12:30–13:30 | Setup: repo and GitHub. Agree on the game design in CLAUDE.md. |
| 13:30–17:00 | Core game loop works: resources, power split, turns, win/lose. |
| 13:30–17:00 | (in parallel) Collect real NASA data: DONKI flare snapshot and facts. Write DATA_SOURCES.md. |
| 17:00–20:00 | Connect real data to events. Add facts after each choice. Make it look clean. |
| 20:00–21:30 | Playtest. Fix balance so every choice costs something. Test on a phone. |
| 21:30–23:00 | Submission: GitHub Pages link, description, demo video or slides. |
| 23:00–24:00 | Buffer. **Submit before 23:30.** Don't start new features after 21:30. |

## Task split (edit as needed)
**Person A – game (`index.html`, `css/`, `js/`)**
- [ ] Game state and turn loop
- [ ] Power-split controls
- [ ] Win/lose screens
- [ ] Event system that reads from `data/`

**Person B – data and submission (`data/`, `docs/`, project page)**
- [ ] Pull a DONKI flare / solar energetic particle snapshot into `data/` (with source URL and date)
- [ ] 10–15 short, kid-friendly real facts (OSDR, Artemis), each with its source
- [ ] `docs/DATA_SOURCES.md`
- [ ] Submission text and demo video or slides

## Status
- [x] Repo created locally
- [ ] Pushed to GitHub
- [ ] GitHub Pages on
