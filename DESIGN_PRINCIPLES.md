# Dragon Cards — Game Design Principles

Reference document for game design decisions. Based on research from Slay the Spire GDC talks, flow theory, and our own ablation testing data.

## The 7 Pillars of Great Card Game Design

### 1. Meaningful Choices (No Dominant Strategy)

Every decision must have **no obvious best answer**. If one option is always better, it's not a real choice.

**How to test:** If a random agent and a smart agent make the same decision, the choice is fake.

**Examples in Slay the Spire:**
- Card reward: take a strong card (power) vs. skip (deck consistency)
- Campfire: heal (survive now) vs. upgrade (invest in future)
- Map path: safe fights vs. elite (risk for better rewards)

**Our ablation finding:** Skipping all side content gives +30pp win rate. Side content is not a meaningful choice — it's a trap. Every node on the map must present a genuine tradeoff.

### 2. Deck Dilution as a Core Tension

Adding a card to your deck is **both a reward and a cost**. Every card added dilutes draw consistency. Smaller decks draw key cards more often.

**The math:** Removing 5 weak cards from a 20-card deck raises your "good card" draw rate from 25% to 33%.

**Design implications:**
- Starter cards should be intentionally mediocre (problems to solve)
- Skipping rewards should sometimes be the smart play
- Card removal should be available but costly
- Deck size should be visible to the player

### 3. HP as a Spendable Resource

Health is not just "don't reach zero." It's a currency you spend to gain advantages.

**Examples:**
- Taking damage to kill faster (skip blocking, play more attacks)
- Event choices that cost HP for powerful cards
- Elite fights that cost HP but give rare rewards

**Design rule:** If the player is always at full HP, the game is too easy. If they're always near death, it's too hard. The ideal is constant pressure where every HP point feels valuable.

### 4. Information Design (Show Enough to Plan, Hide Enough to Surprise)

**Show:** Enemy intent (what they'll do next turn), deck composition, discard pile contents.
**Hide:** Draw order, future enemy intents, exact event outcomes.

This creates a sweet spot: **deck composition is strategic** (long-term planning) while **each hand is a tactical puzzle** (short-term adaptation).

### 5. Enemy Variety Forces Adaptation

Every enemy should **punish a specific playstyle** and be **countered by a different one**. This prevents any single deck from dominating.

| Enemy Type | Punishes | Countered By |
|------------|----------|-------------|
| Thorns enemy | Multi-hit attacks | Single big hits, burn |
| Burn enemy | Slow play | Fast kills, cleanse |
| Scaling enemy (buffs itself) | Blocking/stalling | Aggressive play |
| Tank (high block) | Normal damage | Burn (bypasses block), vulnerable |
| Debuffer (applies weak) | Attack-heavy play | Block-heavy play, cleanse |

**Design rule:** If you can beat every enemy with the same strategy, the enemies are too similar.

### 6. Emergent Gameplay from Simple Rules

Individual card mechanics should be simple. Complexity emerges from **combinations**.

**Simple rules that create depth:**
- Vulnerable: take 50% more damage → combines with ANY damage source
- Exhaust: card removed after use → combines with "when you exhaust" triggers
- Retain: card stays in hand → enables saving block for heavy attacks
- Combo: bonus if another attack played this turn → rewards card draw

**Design rule:** Add mechanics that multiply each other, not mechanics that add to each other.

### 7. Oscillating Tension (Flow Theory)

Alternate between **tension** (hard fights, resource pressure) and **release** (rest sites, shops, easy fights, power fantasy moments).

```
Tension:   ████░░░░████░░████████░░░░████████████
Release:   ░░░░████░░░░██░░░░░░░░████░░░░░░░░░░░░
           Start → Easy fights → Elite → Rest → Hard → Shop → Boss
```

**Design rule:** After every hard fight, give the player a recovery opportunity. After every power boost, present a new challenge.

---

## Validation: How to Know If the Game is Good

### Ablation Testing

Remove each mechanic one at a time and measure win rate change:
- **>3pp drop = mechanic matters** (good design)
- **<1pp change = mechanic is decoration** (bad — remove or redesign)
- **Win rate goes UP = mechanic is a trap** (very bad — redesign immediately)

### Agent Win Rate Targets

| Agent | Target Win Rate | What It Means |
|-------|----------------|---------------|
| Random | <2% | Game has real difficulty |
| Greedy | 5-15% | Simple strategies aren't enough |
| Optimal | 25-40% | Skill is rewarded but game isn't trivial |

### Per-Mechanic Targets

Every mechanic should show >3pp win rate drop when ablated:
- Card rewards, shop, rest/upgrade, events, elite fights, deck thinning

---

## Current Game Issues (from Ablation Data, v0.5.1)

| Mechanic | Ablation Impact | Status |
|----------|----------------|--------|
| Block cards | -8.9pp | Critical (good) |
| Gold/shop | -0.4pp | Negligible (broken) |
| Rest | +0.0pp | Irrelevant (broken) |
| Card rewards | +0.4pp | Trap (broken) |
| NPCs/quests | +0.0pp | Irrelevant (broken) |
| Events | +0.2pp | Irrelevant (broken) |
| Status effects | +28.5pp | Major trap (broken) |
| Side content | +30.7pp | Major trap (broken) |

**Root cause:** The game has no meaningful choices. The optimal strategy (rush boss) requires no engagement with any system except block cards.
