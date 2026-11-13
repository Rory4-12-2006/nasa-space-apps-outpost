# Plan – hackathon Fri 13 Nov, 1:00 PM → submission Sat 14 Nov, 1:00 PM (confirmed)

## Timeline (Cairo time)
| When | Goal | Checkpoint |
|---|---|---|
| Fri 12:40–13:00 | Setup (done). Read CLAUDE.md. **Write no code yet.** | Both have the repo cloned |
| Fri 13:00–17:00 | **Game:** screens, bars, modules, upkeep, Sol loop with fake events. **Data:** events.json from DONKI, verify facts. | 17:00: you can play 5 Sols with placeholder events |
| Fri 17:00–21:00 | Plug in the real events and citations, add Ask Earth, Debrief, Data Sources screen | 21:00: the full Quick Mission is playable. **Push and turn on GitHub Pages.** |
| Fri 21:00–24:00 | Playtest and balance: no choice should be free, and the game should be winnable but not trivial | Someone who isn't on the team plays it |
| Sat 00:00–08:00 | Sleep in shifts. Stretch goals only if the MVP is solid. | |
| Sat 08:00–10:30 | Polish, phone test, bug fixes. **No new features after 10:30.** | |
| Sat 10:30–12:00 | Record the 30-second video (or 7 slides). Write the summary and resources. | |
| Sat 12:00–12:30 | Team leader submits the local form, then the global NASA site. | **Submitted by 12:30** |

## Task split
**Person A – game (`index.html`, `css/`, `js/`)**
- [ ] Screen switching: title / main / debrief / data sources
- [ ] State, bars, upkeep, lose condition
- [ ] Modules and action points
- [ ] Sol loop: forecast → prepare → event → decide → reveal
- [ ] Ask Earth
- [ ] Debrief

**Person B – data and submission (`data/`, `docs/`)**
- [ ] `data/events.js`: verify the 5 placeholder events against DONKI, NASA news and JPL Horizons. Fix the values, add exact source URLs, and set `verified: true`.
- [ ] Verify the facts table in CLAUDE.md, with links
- [ ] Earth–Mars light time for each event date (JPL Horizons)
- [ ] Astro-Cat lines: headline, "why it matters", "Real Science" for each event
- [ ] `docs/DATA_SOURCES.md`, including the AI-use disclosure
- [ ] 30-second video script, or the 7 slides
- [ ] Project summary text

## Status
- [x] Repo created and pushed to GitHub
- [ ] Teammate added as a collaborator
- [x] Deadline confirmed: Sat 14 Nov, 1:00 PM
- [ ] GitHub Pages on
