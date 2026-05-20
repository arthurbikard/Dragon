---
name: new-card
description: Create a new card for the game. Use when the user asks to "add a card", "create a card", "new card", or discusses designing a card. The user may provide an image from images/manual_generations/ to use as card art.
---

# New Card Skill

Create a new card for Dragon Cards. Walk the user through design, then implement it.

## Step 1 — Gather card design

Ask the user for any details they haven't already provided. Use sensible defaults based on similar cards.

**Required fields:**
- **name** — Display name (e.g. "Vine Lash")
- **template_key** — Snake_case identifier derived from name (e.g. `vine_lash`)
- **type** — `attack`, `block`, or `skill`
- **element** — `fire`, `water`, `earth`, `air`, or `null` (neutral)
- **cost** — Energy cost (0-3)
- **damage** — Base damage (0 if non-attack)
- **block** — Base block (0 if non-block)
- **effects** — Array of effects (see available effects below)
- **description** — Short in-game text
- **rarity** — `common` (no rarity field), `rare`, or `legendary`
- **image** — Path to card art

**Available effects:**
| Effect | Target | Fields | Description |
|--------|--------|--------|-------------|
| `burn` | enemy | `value`, `duration` | Damage over time, stacks value |
| `heal` | self | `value` | Restore HP |
| `draw` | self | `value` | Draw extra cards |
| `gainEnergy` | self | `value` | Gain energy this turn |
| `thorns` | self | `value`, `duration` | Reflect damage when hit |
| `vulnerable` | enemy | `value`, `duration` | Target takes 1.5x damage |
| `weak` | enemy | `value`, `duration` | Target deals 0.75x damage |
| `strength` | self | `value`, `duration` | Add flat damage to attacks |
| `cleanse` | self | — | Remove all debuffs |

## Step 2 — Image handling

If the user provided an image from `images/manual_generations/`, copy it to `images/card_<template_key>.png` and use that path.

If no image is provided, note which placeholder image to use temporarily (pick one matching the element/type from existing cards).

## Step 3 — Determine where the card lives

Ask the user (if not already clear) where the card should be available. Options:

| Location | File | What to edit |
|----------|------|-------------|
| **Starter deck** | `js/cards.js` | Add to `STARTER_DECKS[element]` array |
| **Biome reward pool** | `js/cards.js` | Add to `CARD_TEMPLATES` (auto-included in biome rewards via `cardPool`) |
| **Biome card pool** | `js/map.js` | Add key to `WORLD.biomes[biome].cardPool` array |
| **Shop (regular)** | `js/map.js` | Add `{ templateKey, price }` to `SHOP_CARDS` |
| **Shop (rare)** | `js/map.js` | Add `{ rareKey, price }` to `SHOP_RARE_CARDS` |
| **Special/event reward** | `js/map.js` | Add to `RARE_CARD_TEMPLATES` and wire to event/NPC/boss `specialReward` |
| **Boss/elite drop** | `js/map.js` | Set `specialReward: 'template_key'` on the location |

## Step 4 — Implement

1. **Add the card template** to either `CARD_TEMPLATES` in `js/cards.js` (for standard cards) or `RARE_CARD_TEMPLATES` in `js/map.js` (for special/rare/legendary cards).
2. **Add to pools** based on Step 3.
3. **If the card has a new effect type** not in the list above, add a `case` in `applyEffect()` in `js/game.js`, add damage/block integration in `playCard()` if needed, and add an icon in `renderStatuses()` in `js/ui.js`.
4. **If the card has special mechanics** (like once-per-battle), add the logic in `playCard()` and `prepareBattle()` in `js/game.js` following the `root_of_power` pattern.

## Step 5 — Verify

Run `node simulate.js --runs=50` to confirm the card doesn't break the simulator.

Present a summary of what was added and where.

$ARGUMENTS
