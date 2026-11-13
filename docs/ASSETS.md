# Art assets – what to generate

The game loads these files from the `assets/` folder. Until a file exists, the game shows an emoji instead, so you can add them one at a time, in any order.

## Rules for every image
- **Same style as the mockups.** Make them in the same chat or with the same tool, so Astro-Cat and the buildings match.
- **No text inside the images.** The game draws all text itself.
- **Background:** transparent PNG if your tool can do it. Otherwise use a plain white background, and remove it with remove.bg or Canva (free).
- **Exact file names:** lowercase, as listed below. Save them in `assets/`.
- **Disclose AI use:** these are AI-generated. That's already noted on the Data Sources screen.

Style prompt to start every request with:
> Cute cartoon mobile-game asset, same style as the orange Astro-Cat Mars game, thick clean outlines, bright warm colors, soft shading, centered, plain white background, no text, no UI.

## Priority 1 – needed for the main screen
| File | What to ask for | Size |
|---|---|---|
| `cat.png` | Astro-Cat (orange tabby in a white spacesuit with a glass helmet), full body, waving | about 800×800 |
| `bg-mars.png` | Mars landscape: orange ground, small craters and rocks, hazy purple-orange sky. Empty, with no base, no UI and no text. | 1920×1080 |
| `habitat.png` | Grey-silver dome habitat with a door and two antennas, isometric 3/4 view | about 600×600 |
| `solar.png` | Small field of blue solar panels on stands, isometric 3/4 view | about 600×600 |
| `greenhouse.png` | Glass dome greenhouse with green plants inside, isometric 3/4 view | about 600×600 |
| `wall.png` | Short curved wall of red-brown Mars soil bricks (regolith), isometric 3/4 view | about 600×600 |
| `shelter.png` | Small half-buried bunker with thick walls and a round door, isometric 3/4 view | about 600×600 |

## Priority 2 – menus
| File | What to ask for | Size |
|---|---|---|
| `bg-moon.png` | Moon south pole: grey dusty ground, craters, black sky with stars, Earth small in the sky. Empty. | 1920×1080 |
| `site-mars.png` | Round picture: a small glass-dome base with a rover on Mars | 600×600 |
| `site-moon.png` | Round picture: a small dome base with a rover on the grey Moon | 600×600 |
| `card-quick.png` | A rocket launching from Mars, for a "Quick Mission" card (no text) | 800×500 |
| `card-endless.png` | Several dome habitats on Mars, for an "Endless Base" card (no text) | 800×500 |
| `card-live.png` | A bright Sun throwing a flare, with radio waves, for "Today's Space Weather" (no text) | 800×500 |
| `card-family.png` | Four different cartoon cats in spacesuits waving, for "Family / Class Mode" (no text) | 800×500 |

## Priority 3 – nice to have
| File | What to ask for |
|---|---|
| `rover.png` | Tiny cartoon rover, side view, for the loading bar |
| `cat-point.png` | Astro-Cat pointing to the side |

**How to add them:** put the files in `assets/`, then commit and push. Or send them to Claude and ask for them to be added.
