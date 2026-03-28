# Dragon Cards — Game Vision Document

## The Concept

**Zelda exploration meets Slay the Spire card combat.**

A large, scrollable world map with distinct biomes, each with its own lore, enemies, NPCs, and atmosphere. The player explores freely along paths, discovering locations, fighting enemies with a deck-building card combat system, and uncovering the story of an ancient dragon's awakening.

The game should feel like an **adventure** — not a sequence of menus. You're on a journey through a world, and the card battles are how you overcome the challenges in your path.

## Story: The Dragon Awakening

An ancient dragon has awakened deep within the volcanic heart of the Dragon Isles. Its corruption spreads outward from the center — forests twist, shores fog over, mountains crack. Each biome shows a different stage of corruption.

The player begins at the **Whispering Coast**, the farthest point from the corruption. As they travel inland, the world grows darker, the enemies fiercer, and the lore reveals the dragon's history: it was sealed away centuries ago by four elemental guardians, and the seals are breaking.

**The player's journey:**
1. **Whispering Coast** — Learn the basics. Locals speak of strange fog and dead fish. A village elder sets you on your path.
2. **Thornwood Forest** — The corruption is visible. Trees are twisted, animals mutated. A hermit scholar tells you about the ancient seals.
3. **Stormbreak Mountains** — Above the treeline, the sky itself is wrong. Lightning strikes without clouds. An abandoned temple holds clues to the sealing ritual.
4. **Ember Wastes** — The volcanic region near the dragon's lair. Lava flows where rivers once ran. The final guardians fell here.
5. **Dragon's Sanctum** — The lair itself. The ancient dragon waits at the center of its corruption.

## World Map Design

### Scale
- **~10 screens wide, ~3 screens tall** (scrollable in both directions)
- Portrait orientation on mobile — the map scrolls horizontally as the primary axis
- Each biome is ~2 screens wide with 6-10 locations within it
- **Total: ~40-50 locations** across the full map

### Visual Style
- **Illustrated parchment map** — hand-drawn cartography aesthetic
- Each biome has its own color palette and terrain style
- Paths between locations are visible trails/roads on the map
- Fog of war: unexplored areas are darkened/covered, revealed as you explore
- Key landmarks visible even when fogged (mountains, rivers, coastline)

### Movement
- **Tap to move along paths** between connected locations
- Paths are clear, tap-friendly routes drawn on the map
- The player character is shown as a marker on the current location
- The map auto-scrolls to follow the player
- Visited locations are marked; key locations show their icon

### Biome Details

#### 1. Whispering Coast (Tutorial/Act 1)
- **Palette:** Blue-grey, sea foam, driftwood
- **Terrain:** Rocky beaches, fishing villages, sea caves, lighthouse
- **Enemies:** Young Drake, Coastal Serpent (easy)
- **Locations (~8):** Starting Village, Fisherman's Cove, Sea Cave, Lighthouse, Cliff Path, Tide Pools (event), Shore Market (shop), Driftwood Camp (rest)
- **Lore:** The fog arrived a month ago. Fish are dying. The elder remembers old stories about the dragon.

#### 2. Thornwood Forest (Act 2)
- **Palette:** Dark green, purple, bioluminescent blue
- **Terrain:** Twisted trees, mushroom groves, overgrown ruins, a creek
- **Enemies:** Thornback, Fungal Crawler (medium)
- **Locations (~10):** Forest Edge, Mushroom Grove (event), Hermit's Hut (NPC), Ruined Bridge, Deep Woods, Spider's Nest (elite), Ancient Stump (rest), Woodcutter's Camp (shop), Corrupted Shrine (event), Forest Heart (mini-boss)
- **Lore:** The forest is alive and hostile. A hermit scholar has been studying the corruption. The first seal was here — it's broken.

#### 3. Stormbreak Mountains (Act 3)
- **Palette:** Grey, white, electric blue, snow
- **Terrain:** Mountain paths, rope bridges, caves, abandoned mines, temple
- **Enemies:** Storm Caller, Iron Golem (hard)
- **Locations (~10):** Mountain Pass, Rope Bridge (event), Abandoned Mine, Echo Cave (event), Storm Peak, Eagle's Nest (rest), Mountain Shrine (NPC), Crystal Cavern (treasure), Skyfall Temple (mini-boss), Summit Camp (shop)
- **Lore:** The second seal was at the temple. Lightning elementals guard the ruins. The storms are getting worse.

#### 4. Ember Wastes (Act 4)
- **Palette:** Red, orange, black, molten gold
- **Terrain:** Lava fields, obsidian formations, dead forests, volcanic vents
- **Enemies:** Ember Titan, Shadow Wyrm (very hard)
- **Locations (~8):** Lava Bridge, Obsidian Field, Ash Village (ruins), Volcanic Vent (event), Flame Forge (shop/upgrade), Magma Pool (rest), Guardian's Tomb (elite), Caldera Gate (mini-boss)
- **Lore:** The third and fourth seals broke here. The dragon's influence is overwhelming. Few have survived.

#### 5. Dragon's Sanctum (Final)
- **Palette:** Deep purple, gold, corruption-black
- **Terrain:** Corrupted crystal formations, dragon bone architecture, the lair
- **Locations (~4):** Sanctum Entrance, Hall of Bones, Corruption Core (event), Dragon's Throne (final boss)
- **Lore:** The dragon awaits. Its corruption is the world's corruption. Defeating it restores balance.

## Location Types

| Type | Icon | What Happens | Design Purpose |
|------|------|-------------|----------------|
| **Battle** | ⚔️ | Card combat with area-appropriate enemy | Core gameplay |
| **Elite** | 💀 | Hard battle, rare card + bonus gold reward | Risk/reward choice |
| **Mini-boss** | 🐲 | Boss fight that gates access to next biome | Progression check |
| **Rest** | 🔥 | Heal (30% HP) OR Upgrade card OR Remove card | Core tradeoff |
| **Shop** | 🛒 | Buy cards, heal potions, card removal | Gold economy |
| **Event** | ❓ | Narrative choice with gameplay consequences | Story + risk/reward |
| **NPC** | 💬 | Dialogue, lore, quest hints, sometimes rewards | Story + guidance |
| **Treasure** | 💎 | Rare card or item, sometimes guarded | Exploration reward |

## Ability Gating (Zelda-style)

Instead of keys, the player earns **elemental blessings** from mini-bosses that unlock terrain:

| Blessing | From | Unlocks |
|----------|------|---------|
| **Tide Walker** | Forest Heart mini-boss | Cross water paths (access Mountain river routes) |
| **Storm Shield** | Skyfall Temple mini-boss | Survive lightning paths (access Ember Wastes upper route) |
| **Flame Ward** | Caldera Gate mini-boss | Walk on lava paths (access Dragon's Sanctum) |

This means you MUST progress through the biomes in rough order, but within each biome you can explore freely. Some paths within a biome are also gated — encouraging return trips ("I saw a water crossing in the forest, I need Tide Walker to get there").

## Card Combat Integration

Combat uses the existing Slay the Spire-inspired system:
- 10-card starter deck, draw 5 per turn, 3 energy
- Enemy intent system (shows next action)
- Deck building through rewards, shop, events
- Card upgrade and removal at rest sites

**Biome-specific card pools:** Each biome's battle rewards draw from a themed card pool. Coast gives water/defensive cards. Forest gives earth/thorn cards. Mountains give air/energy cards. Volcano gives fire/damage cards. This creates natural deck evolution as you progress.

**Enemy evolution:** The same enemy type gets stronger in later biomes. A Thornback in the Forest is medium difficulty; a Corrupted Thornback in the Ember Wastes is much harder.

## Implementation Approach

### Phase 1: World Map Engine
- Scrollable map renderer (horizontal primary, vertical secondary)
- Location nodes on the map with paths between them
- Fog of war system
- Player movement along paths
- Auto-scroll to follow player
- Biome background art (generated per biome)

### Phase 2: First Biome (Whispering Coast)
- 8 locations with full content
- Tutorial flow
- Coast-specific enemies, events, NPCs
- Mini-boss at the end

### Phase 3: Second Biome (Thornwood Forest)
- 10 locations
- Ability gating (Tide Walker unlocks later content)
- Forest-specific content
- Hermit NPC storyline

### Phase 4-6: Remaining biomes
- Build out one biome at a time
- Each adds ~8-10 locations, 2-3 enemy types, events, lore
- Test with simulator after each biome

### Art Requirements Per Biome
- 1 large map background tile (the biome's terrain)
- 6-10 location vignette images (circular node art)
- 2-3 enemy portraits
- 1-2 NPC portraits
- 1 mini-boss portrait

**Total art budget: ~60-80 images for the full game**

## Success Criteria

Measured by ablation testing:
- Random agent: <3% win rate
- Optimal agent: 25-40% win rate
- Every biome's mechanics matter (>3pp drop when ablated)
- No mechanic is a trap (no positive pp when ablated)
- Player must visit all 5 biomes to win (ability gating enforced)

## What Makes This Different

This isn't Slay the Spire with a Zelda skin. The key differences:

1. **Persistent world** — locations stay explored, NPCs remember you, the map fills in as you play
2. **Non-linear exploration** — within each biome, you choose your path. Between biomes, ability gating provides structure.
3. **Lore-driven motivation** — you explore because the world is interesting, not just for card rewards
4. **Visual journey** — watching the map go from fogged to explored, from coast to volcano, gives a sense of real progress
5. **Biome-themed deck building** — your deck naturally evolves to reflect the terrain you've traveled through
