# Dragon Cards — TODO

## Current Version: v0.8.0

## Priorities

### P0 — Critical (blocks playtesting)
- None currently

### P1 — High (next sprint)
- [ ] **Biome 2: Thornwood Forest** — ~10 locations, forest-themed enemies, hermit NPC, Tide Walker blessing gate
- [ ] **Biome 3: Stormbreak Mountains** — ~10 locations, mountain enemies, temple ruins
- [ ] **Generate coast art** — Location vignettes, Coastal Serpent portrait, Storm Drake portrait, coast map background
- [ ] **Map visual polish** — Background image per biome, better path drawing, location images on nodes

### P2 — Medium
- [ ] **Biome 4: Ember Wastes** — ~8 locations, volcanic enemies, final guardians
- [ ] **Biome 5: Dragon's Sanctum** — ~4 locations, final boss
- [ ] **Card synergies** — Exhaust, Retain, Combo keywords (from DESIGN_PRINCIPLES.md Fix 4)
- [ ] **Biome-specific card pools** — Coast rewards water/defensive, forest rewards earth/thorns, etc.
- [ ] **Enemy variety per biome** — 2-3 unique enemy types per biome

### P3 — Low (polish)
- [ ] **Sound effects** — Battle hits, card play, victory/defeat
- [ ] **Map fog of war visual** — Actual fog/darkness overlay instead of opacity
- [ ] **Transition animations** — Fade between map and battle screens
- [ ] **Card art for new cards** — Generate images for rare/synergy cards
- [ ] **Save/load game** — localStorage persistence
- [ ] **Multiple save slots** — Different runs with different elements
- [ ] **Achievement system** — Track milestones across runs

## Known Bugs
- [ ] `diedAt` shows enemy ID instead of location name in simulator
- [ ] Shop can be revisited infinitely (by design? or should restock cost gold?)
- [ ] NPC dialogue replays every visit (should show shorter text on revisit)
- [ ] Card upgrade description text replacement is fragile (regex on description string)
- [ ] PVP mode hasn't been tested since v0.6.0 overhaul — may be broken

## Balance Status (v0.8.0)

### Win Rates (n=800)
| Agent | Rate | Target | Status |
|-------|------|--------|--------|
| Random | ~1% | <3% | Good |
| Greedy | ~3% | 5-15% | Slightly hard |
| Optimal | ~32% | 25-50% | Good |
| Rush (starter only) | ~3.5% | <5% | Good |

### Recent Balance Changes
- Starter deck: 14 cards (10 real + 2 Stumble + 2 Brace filler)
- Draw count: 4 per turn (was 5)
- Rest cooldown: must fight 2 battles between rests
- Ambush system: 15% on non-combat, 30% on cleared combat locations
- Strength is now duration-based (3 turns, no longer permanent)
- Storm Drake: 200 HP, 14/24 damage — near-impossible to rush
- Water/Earth starter cards buffed for element balance
- Lighthouse Flame legendary card reward for beating elite

## Completed (recent)

- [x] v0.8.0 — Rest cooldown (2 battles between rests)
- [x] v0.8.0 — Ambush system (random encounters when traveling)
- [x] v0.8.0 — Deck viewer on map (tap card count)
- [x] v0.8.0 — Floating notifications for HP/gold/card changes
- [x] v0.8.0 — Filler cards (Stumble/Brace) to dilute starter deck
- [x] v0.8.0 — Strength now expires after 3 turns
- [x] v0.8.0 — Lighthouse Flame legendary reward + elder NPC hint
- [x] v0.8.0 — Storm Drake buffed to 200 HP (punishes rushing)
- [x] v0.8.0 — Water/Earth element balance (buffed starter damage)
- [x] v0.8.0 — Map rework: new connections, renamed veiled_sea
- [x] v0.8.0 — Debug ?phase= URL param for testing screens
- [x] v0.8.0 — Fixed upgrade screen (cards not visible due to CSS)
- [x] v0.8.0 — Fixed card consolidation on map return
- [x] v0.8.0 — Minimum font size 0.6rem across all gameplay text
- [x] v0.7.0 — World map engine + Whispering Coast (8 locations)
- [x] v0.7.0 — Fog of war, path navigation, location panel
- [x] v0.7.0 — NPC dialogue system (multi-line with portrait)
- [x] v0.7.0 — Battle gates (must fight to pass through combat locations)
- [x] v0.7.0 — Mini-boss blessing system (Tide Walker from Storm Drake)
- [x] v0.6.1 — Gold/shop matters (ablation: -5.6pp)
- [x] v0.6.0 — Branching map with rest/upgrade/remove tradeoff
- [x] v0.6.0 — Card upgrade system (Fire Strike → Fire Strike+)
- [x] v0.6.0 — 7 unique enemy types with different mechanics
- [x] v0.6.0 — Weak + Strength status effects
- [x] v0.5.1 — Ablation testing framework
- [x] v0.5.0 — Simulation-driven balance overhaul
- [x] v0.4.0 — Original world map + quest system (replaced in v0.6.0)
- [x] v0.3.0 — Dark fantasy UI overhaul (Cinzel + Cormorant Garamond)
- [x] v0.2.0 — Art-dominant card design with stat badges
- [x] v0.1.0 — Core game engine, 4 elements, AI + PVP modes

## Reference Documents
- `GAME_VISION.md` — Full creative vision (5 biomes, story, ability gating)
- `DESIGN_PRINCIPLES.md` — Game design research + ablation methodology
- `CLAUDE.md` — Technical architecture + development practices
