# Dragon Cards — TODO

## Current Version: v0.7.0

## Priorities

### P0 — Critical (blocks playtesting)
- [ ] **Simulator broken** — `simulate.js` references old branching map API (`NODE_TYPES`, `MAP_CONFIG`, `onNodeSelect`). Needs rewrite for world map navigation.
- [ ] **Victory condition** — No boss in the current coast biome. Need to either add a final boss location or make Storm Bluff mini-boss trigger victory for testing.

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
- [ ] **Status effect rebalance** — Enemy thorns/strength still net-hurt the player (ablation: +14.8pp trap)
- [ ] **Elite rebalance** — Fighting elites is still a losing proposition (ablation: +15.9pp trap)

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
- [ ] Rest sites can be revisited infinitely (intentional — but should they be limited?)
- [ ] NPC dialogue replays every visit (should show shorter text on revisit)
- [ ] Card upgrade description text replacement is fragile (regex on description string)
- [ ] PVP mode hasn't been tested since v0.6.0 overhaul — may be broken

## Balance Status (from ablation testing, v0.6.1)

### Win Rates (n=2000)
| Agent | Rate | Target | Status |
|-------|------|--------|--------|
| Random | 6.4% | <3% | Slightly high |
| Greedy | 9.6% | 5-15% | Good |
| Optimal | 44.5% | 25-50% | Good |

### Mechanic Impact (ablation delta from baseline)
| Mechanic | Delta | Status |
|----------|-------|--------|
| Block cards | -21.2pp | Critical (good) |
| Card rewards | -14.1pp | Critical (good) |
| Rest/upgrade/remove | -12.8pp | Critical (good) |
| Events | -8.6pp | Critical (good) |
| Gold/shop | -5.6pp | Critical (good) |
| Double enemy HP | -40.7pp | Critical (good) |
| Status effects | +14.8pp | **Trap — needs fix** |
| Elites | +15.9pp | **Trap — needs fix** |
| Skip non-combat | +14.2pp | **Trap — needs fix** |

### Design Debt
- Status effects (burn/thorns/vulnerable from enemies) still net-hurt the player
- Elite fights cost more HP than their rare cards compensate
- Skipping all non-combat nodes still increases win rate (non-combat content needs more value)

## Completed (recent)

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
