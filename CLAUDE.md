# Dragon Cards — Claude Instructions

## Project Overview

Dragon Cards is a mobile-first card game combining **Zelda-style world exploration** with **Slay the Spire deck-building combat**. Deployed on GitHub Pages at https://arthurbikard.github.io/Dragon/

The game is built with **vanilla HTML/CSS/JS** — no frameworks, no build system. Files are loaded directly by the browser.

## Key Documents

- **GAME_VISION.md** — Creative direction: story, biomes, world map design, ability gating, full scope
- **DESIGN_PRINCIPLES.md** — Game design research: meaningful choices, deck dilution, flow theory, enemy variety, ablation testing methodology
- **TODO.md** — Current priorities and known issues

## Architecture

### File Structure
```
index.html          — Entry point, loads all scripts
styles.css          — All styling (dark fantasy grimoire theme)
js/cards.js         — Card templates, starter decks, upgrade system, reward generation
js/ai.js            — Enemy definitions (7 types + 2 coast-specific), AI intent system
js/map.js           — World data (biomes, locations, paths), campaign state, navigation, fog of war, shop/rare cards
js/quests.js        — Quest system stubs (simplified — quests replaced by map exploration)
js/game.js          — Core game loop: phases, turns, damage/block, status effects, energy, PVP
js/ui.js            — Battle UI, card rendering, menu, element select, reward screen, PVP screens
js/map-ui.js        — World map renderer, location panel, shop/rest/event/NPC screens
simulate.js         — Headless game simulator with 3 AI agents + ablation testing
generate_art.py     — HuggingFace API image generation script
audit.html          — Visual art audit page
images/             — All generated art assets (~50 images)
manifest.json       — PWA manifest for home screen install
```

### Script Loading Order (critical)
Scripts depend on each other's globals. Order in index.html must be:
1. `cards.js` (defines ELEMENTS, CARD_TYPES, CARD_TEMPLATES)
2. `ai.js` (uses ELEMENTS)
3. `map.js` (uses CARD_TYPES, creates cards)
4. `quests.js` (uses QUEST_STATUS)
5. `game.js` (uses everything above)
6. `ui.js` (uses game state and rendering)
7. `map-ui.js` (uses WORLD, LOC_TYPES, and ui.js rendering)

### Key Globals
- `gameState` — The entire game state (mutable, single source of truth)
- `WORLD` — World map data (locations, biomes, paths)
- `CARD_TEMPLATES` — All card definitions
- `AI_ENEMIES` — All enemy definitions
- `renderGame()` — Main render dispatcher (called after every state change)

### Game Phases
`GAME_PHASES` in game.js: MENU, ELEMENT_SELECT, MAP, BATTLE, CARD_REWARD, SHOP, REST, NPC, EVENT, CARD_UPGRADE, PASS_DEVICE, PVP_RESOLVE, GAME_OVER, VICTORY

### Campaign State
```javascript
gameState.campaign = {
  explored: Set,      // location IDs visible on map
  visited: Set,       // locations player has been to
  cleared: Set,       // battles/events completed
  currentLocation: string,
  gold: number,
  blessings: {},      // elemental abilities that unlock paths
}
```

## Development Practices

### Version System
- Version in `index.html` as `GAME_VERSION` constant and `?v=X.Y.Z` query strings on all assets
- Bump version on every push to bust browser cache
- Menu screen shows version + "Update" button for hard reload

### Balance Testing
Run `node simulate.js` to test game balance with AI agents:
```bash
node simulate.js                     # default: 100 runs × 3 agents × 4 elements
node simulate.js --runs=500          # more runs
node simulate.js --agent=optimal     # specific agent
node simulate.js --ablation=all      # ablation tests (remove each mechanic)
node simulate.js --json              # machine-readable output
node simulate.js --verbose           # print each run
```

**Target win rates:**
- Random agent: <3% (game is hard enough)
- Greedy agent: 5-15% (simple strategy isn't enough)
- Optimal agent: 25-50% (skill is rewarded)

**Ablation rule:** Removing any mechanic should drop win rate by >3pp. If removing a mechanic INCREASES win rate, that mechanic is a trap and needs fixing.

### Art Generation
```bash
python3 generate_art.py                          # generate all missing images
python3 generate_art.py image1.png image2.png    # regenerate specific images
python3 generate_art.py --all                    # force regenerate everything
```
Requires `HF_TOKEN` in `.env` file. Uses HuggingFace Stable Diffusion XL.

### Art Audit
Use the `/project:audit-art` command or open `audit.html` in browser. The audit checks for: grids/collages, frames/borders, white space, style mismatches, low quality.

## Code Conventions

- **No frameworks** — vanilla JS only. Keep it simple for GitHub Pages.
- **Globals are OK** — this is a small game, not a enterprise app. Game state is a mutable global.
- **Mobile-first** — every UI decision prioritizes phone screens. Max-width 480px.
- **Dark fantasy theme** — Cinzel (display) + Cormorant Garamond (body) fonts. Gold accent on dark backgrounds.
- **Cards are art-dominant** — card art fills the entire card face, text overlays the bottom.
- **Emoji for icons** — game uses emoji for location types, card badges, status effects. No icon library.

## Common Tasks

### Adding a new enemy
1. Add entry to `AI_ENEMIES` array in `js/ai.js` with unique `id`
2. Add to appropriate pool in `WORLD.biomes[biome].enemyPool` in `js/map.js`
3. Generate portrait: add to `generate_art.py` IMAGES dict, run script
4. Test: `node simulate.js --runs=200`

### Adding a new location
1. Add entry to `WORLD.locations` in `js/map.js` with x, y, type, paths, etc.
2. Update adjacent locations' `paths` arrays to include the new location
3. Generate location vignette image if desired
4. Test manually on mobile

### Adding a new biome
1. Add biome definition to `WORLD.biomes` in `js/map.js`
2. Add all locations for the biome with correct x, y positions
3. Add biome-specific enemies to `js/ai.js`
4. Add biome-specific events to `EVENTS` in `js/map.js`
5. Generate all art assets
6. Connect to existing biomes via paths (with blessing requirements)
7. Test with simulator

### Adding a new card
1. Add template to `CARD_TEMPLATES` in `js/cards.js`
2. Generate card art, add `image` field
3. Add to relevant pools (starter deck, biome cardPool, shop, rewards)
4. Test balance with simulator
