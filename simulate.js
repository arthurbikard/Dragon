#!/usr/bin/env node
/**
 * Dragon Cards — Headless Game Simulator
 *
 * Usage:
 *   node simulate.js                          # 100 runs, all agents, random element
 *   node simulate.js --runs=500               # 500 runs per agent
 *   node simulate.js --agent=greedy           # only greedy agent
 *   node simulate.js --element=fire           # force fire element
 *   node simulate.js --verbose                # print each game's outcome
 */

const fs = require('fs');
const path = require('path');

// === Stub browser globals ===
global.document = { addEventListener: () => {}, querySelector: () => null, getElementById: () => ({ innerHTML: '' }), createElement: () => ({ className: '', style: {}, textContent: '', remove() {} }), body: { appendChild() {} } };
global.window = { addEventListener: () => {}, location: { reload: () => {} } };
global.setTimeout = (fn) => fn(); // execute immediately
global.requestAnimationFrame = (fn) => fn(); // execute immediately
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.GAME_VERSION = '0.0.0';

// Stub renderGame so UI code doesn't crash
global.renderGame = () => {};
global.showNotification = () => {};

// === Load game source files in order ===
// Use vm.runInThisContext so top-level const/let become globals
const vm = require('vm');
const SRC_DIR = path.join(__dirname, 'js');
const GAME_FILES = ['icons.js', 'cards.js', 'ai.js', 'map.js', 'quests.js', 'game.js'];
const UI_FILES = ['ui.js', 'map-ui.js'];

for (const file of GAME_FILES) {
  const code = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
  try {
    vm.runInThisContext(code, { filename: file });
  } catch (e) {
    console.error(`Error loading ${file}:`, e.message);
    process.exit(1);
  }
}

// Load UI files with error tolerance (they reference DOM)
for (const file of UI_FILES) {
  const code = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
  try {
    vm.runInThisContext(code, { filename: file });
  } catch (e) {
    // Expected — UI files reference DOM elements
  }
}

// Ensure renderGame is a no-op for simulation
renderGame = () => {};

// === Parse CLI args ===
const args = {};
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    args[key] = val || true;
  }
});

const NUM_RUNS = parseInt(args.runs) || 100;
const AGENT_FILTER = args.agent || 'default';
const FORCE_ELEMENT = args.element || null;
const VERBOSE = !!args.verbose;
const JSON_OUTPUT = !!args.json;
const ABLATION_MODE = args.ablation || null;
const TRACE_OUTPUT = args.trace ? (args.trace === true ? 'sim-traces.json' : args.trace) : null;
const HISTORY_OUTPUT = args.history ? (args.history === true ? 'sim-history.json' : args.history) : null;
const SAVE_STATES = args['save-states'] ? (args['save-states'] === true ? 'saved-states.json' : args['save-states']) : null;
const LOAD_STATE = args['load-state'] || null;
const _savedStates = [];
let _loadedStates = null;

// === Ablation Definitions ===
const ABLATIONS = {
  none:          { name: 'Baseline (no ablation)', apply() {} },
  no_gold:       { name: 'No gold (shop disabled)', apply() { gameState.campaign.gold = -9999; } },
  no_rest:       { name: 'No resting', apply() { /* handled in simulateMapTurn */ } },
  no_rewards:    { name: 'No card rewards', apply() { /* handled in card reward phase */ } },
  no_quests:     { name: 'No NPCs/quests', apply() { /* handled in simulateMapTurn */ } },
  no_events:     { name: 'No events', apply() { /* handled in simulateMapTurn */ } },
  no_block:      { name: 'No block cards in deck', apply() {
    gameState.player.deck = gameState.player.deck.filter(c => c.block === 0);
  }},
  no_statuses:   { name: 'No status effects', apply() {
    // Monkey-patch applyEffect to no-op for offensive statuses
    const orig = applyEffect;
    applyEffect = (effect, caster, target) => {
      if (['burn', 'vulnerable', 'thorns'].includes(effect.type)) return;
      orig(effect, caster, target);
    };
  }},
  no_elites:     { name: 'No elites (skip elite nodes)', apply() { /* handled in node picker */ } },
  direct_path:   { name: 'Battles only (skip non-combat nodes)', apply() { /* handled in node picker */ } },
  double_enemy:  { name: 'Double enemy HP', apply() { /* handled before battle */ } },
};

// === Agent Strategies ===

const AGENTS = {
  /**
   * Random agent: picks random cards, random map movement
   */
  random: {
    name: 'Random',
    pickCard(hand, energy, actor, opponent) {
      const playable = hand.filter(c => c.cost <= energy);
      if (playable.length === 0) return null;
      return playable[Math.floor(Math.random() * playable.length)];
    },
    pickMapAction(campaign, player) {
      return 'random';
    },
    pickReward(cards) {
      // 50% pick random, 50% skip
      if (Math.random() < 0.5) return Math.floor(Math.random() * cards.length);
      return -1; // skip
    },
    pickEventChoice(choices) {
      return Math.floor(Math.random() * choices.length);
    },
    pickShopCard(items, gold) {
      return -1; // never buy
    },
    shouldRest(player) {
      return Math.random() < 0.5;
    },
  },

  /**
   * Greedy agent: plays highest damage first, blocks when low HP
   */
  greedy: {
    name: 'Greedy',
    pickCard(hand, energy, actor, opponent) {
      const playable = hand.filter(c => c.cost <= energy);
      if (playable.length === 0) return null;

      const hpRatio = actor.hp / actor.maxHp;

      // If low HP, prioritize block/heal
      if (hpRatio < 0.4) {
        const defensive = playable.filter(c => c.block > 0 || c.effects.some(e => e.type === 'heal'));
        if (defensive.length > 0) {
          return defensive.reduce((a, b) => (a.block + (a.effects.find(e => e.type === 'heal')?.value || 0)) >
            (b.block + (b.effects.find(e => e.type === 'heal')?.value || 0)) ? a : b);
        }
      }

      // Play highest damage card
      const attacks = playable.filter(c => c.damage > 0);
      if (attacks.length > 0) {
        return attacks.reduce((a, b) => a.damage > b.damage ? a : b);
      }

      // Play any card
      return playable[0];
    },
    pickMapAction() { return 'progress'; },
    pickReward(cards) {
      // Pick highest damage card
      let best = 0;
      cards.forEach((c, i) => {
        if (c.damage > cards[best].damage) best = i;
      });
      return best;
    },
    pickEventChoice(choices) {
      // Take the risky choice if it has a reward
      const rewarded = choices.findIndex(c => c.reward);
      return rewarded >= 0 ? rewarded : 0;
    },
    pickShopCard(items, gold) {
      // Buy cheapest attack card we can afford
      const affordable = items.filter(i => i.price <= gold && i.card.damage > 0);
      if (affordable.length > 0) return items.indexOf(affordable[0]);
      return -1;
    },
    shouldRest(player) {
      return player.hp < player.maxHp * 0.6;
    },
  },

  /**
   * Optimal agent: follows a scripted route through the map with smart combat
   *
   * Route: cliffs → shop (buy/remove) → lighthouse → shop (remove weak) →
   *        north bay (rest/upgrade) → storm drake → village (elder reward) → forest
   */
  optimal: {
    name: 'Optimal',

    // Scripted route through the coast, then into the forest
    _route: [
      'whispering_cliffs',        // 1. Easy battle for card reward + gold
      'misthaven_village',        // 2. Talk to elder for lore
      'shore_market',             // 3. Buy a good card or remove a weak one
      'veiled_sea',               // 4. Event for potential rare card
      'windward_lighthouse',      // 5. Elite fight for lighthouse flame
      'veiled_sea',               // 6. Back through
      'foggy_ambush',             // 7. Battle on the way
      'reef_shallows',            // 8. Rest / upgrade / remove
      'the_wild_shore',           // 9. Another battle
      'thornwood_gate',           // 10. Mini-boss: storm drake
      'misthaven_village',        // 11. Get elder spirit reward
      'thornwood_gate',           // 12. Back through (cleared)
      'spring_of_tides',          // 13. Enter forest, rest
      'forest_edge',              // 14. Forest battle
      'hermits_hut',              // 15. NPC lore
      'woodcutters_camp',         // 16. Shop (mushroom grove path)
      'mushroom_grove',           // 17. Event
      'woodcutters_camp',         // 18. Back
      'ruined_bridge',            // 19. Battle
      'ancient_stump',            // 20. Rest
      'elder_tree',               // 21. Event (offer card)
      'ancient_stump',            // 22. Back
      'corrupted_shrine',         // 23. Event
      'forest_heart',             // 24. Mini-boss: corrupted treant
    ],
    _routeIndex: 0,

    pickCard(hand, energy, actor, opponent) {
      const playable = hand.filter(c => c.cost <= energy);
      if (playable.length === 0) return null;

      const hpRatio = actor.hp / actor.maxHp;
      const intent = opponent.nextIntent;
      const enemyAttacking = intent && (intent.type === 'attack' || intent.type === 'heavy_attack');
      const incomingDamage = enemyAttacking ? (intent.damage || 0) : 0;
      const needsBlock = incomingDamage > actor.block;

      // Priority 1: Block heavy attacks
      if (needsBlock && incomingDamage > 10) {
        const blockers = playable.filter(c => c.block > 0);
        if (blockers.length > 0) {
          return blockers.reduce((a, b) => a.block > b.block ? a : b);
        }
      }

      // Priority 2: Heal when low
      if (hpRatio < 0.35) {
        const healers = playable.filter(c => c.effects.some(e => e.type === 'heal'));
        if (healers.length > 0) return healers[0];
      }

      // Priority 3: Free cards (cost 0) first for efficiency
      const free = playable.filter(c => c.cost === 0);
      if (free.length > 0) return free[0];

      // Priority 4: Energy gain cards when we have cards to play after
      if (playable.length > 2) {
        const energyGain = playable.filter(c => c.effects.some(e => e.type === 'gainEnergy'));
        if (energyGain.length > 0) return energyGain[0];
      }

      // Priority 5: Best damage-per-energy card
      const attacks = playable.filter(c => c.damage > 0);
      if (attacks.length > 0) {
        return attacks.reduce((a, b) => (a.damage / a.cost) > (b.damage / b.cost) ? a : b);
      }

      // Priority 6: Block when enemy is attacking
      if (needsBlock) {
        const blockers = playable.filter(c => c.block > 0);
        if (blockers.length > 0) return blockers.reduce((a, b) => a.block > b.block ? a : b);
      }

      // Priority 7: Draw cards
      const drawers = playable.filter(c => c.effects.some(e => e.type === 'draw'));
      if (drawers.length > 0) return drawers[0];

      return playable[0];
    },
    pickMapAction() { return 'scripted'; },
    pickReward(cards) {
      // Pick best card by a composite score
      let best = 0;
      let bestScore = -1;
      cards.forEach((c, i) => {
        const score = c.damage * 1.5 + c.block + c.effects.reduce((s, e) => {
          if (e.type === 'burn') return s + e.value * 2;
          if (e.type === 'heal') return s + e.value * 1.5;
          if (e.type === 'draw') return s + e.value * 3;
          if (e.type === 'gainEnergy') return s + e.value * 4;
          return s + 2;
        }, 0);
        if (score > bestScore) { bestScore = score; best = i; }
      });
      return best;
    },
    pickEventChoice(choices) {
      return choices.findIndex(c => c.reward) >= 0 ? choices.findIndex(c => c.reward) : 0;
    },
    pickShopCard(items, gold) {
      const affordable = items.filter(i => i.price <= gold);
      if (affordable.length === 0) return -1;
      // Buy strongest card we can afford
      let best = affordable[0];
      let bestVal = 0;
      affordable.forEach(i => {
        const val = i.card.damage * 2 + i.card.block + i.card.effects.length * 5;
        if (val > bestVal) { bestVal = val; best = i; }
      });
      return items.indexOf(best);
    },
    shouldRest(player) {
      return player.hp < player.maxHp * 0.7;
    },
  },

  /**
   * Explorer agent: optimal combat but random map navigation biased toward unvisited locations
   */
  explorer: {
    name: 'Explorer',
    // Reuse optimal agent's combat logic
    pickCard: null, // filled below
    pickMapAction() { return 'explore'; },
    pickReward(cards) {
      let best = 0;
      let bestScore = -1;
      cards.forEach((c, i) => {
        const score = c.damage * 1.5 + c.block + c.effects.reduce((s, e) => {
          if (e.type === 'burn') return s + e.value * 2;
          if (e.type === 'heal') return s + e.value * 1.5;
          if (e.type === 'draw') return s + e.value * 3;
          if (e.type === 'gainEnergy') return s + e.value * 4;
          return s + 2;
        }, 0);
        if (score > bestScore) { bestScore = score; best = i; }
      });
      return best;
    },
    pickEventChoice(choices) {
      return choices.findIndex(c => c.reward) >= 0 ? choices.findIndex(c => c.reward) : 0;
    },
    pickShopCard(items, gold) {
      const affordable = items.filter(i => i.price <= gold);
      if (affordable.length === 0) return -1;
      let best = affordable[0];
      let bestVal = 0;
      affordable.forEach(i => {
        const val = i.card.damage * 2 + i.card.block + i.card.effects.length * 5;
        if (val > bestVal) { bestVal = val; best = i; }
      });
      return items.indexOf(best);
    },
    shouldRest(player) {
      return player.hp < player.maxHp * 0.6;
    },
  },

  /**
   * Lookahead agent: for each playable card, simulates random playouts of the
   * rest of the turn + enemy response, picks the card with best average outcome.
   * Uses scripted route for navigation (same as optimal).
   */
  lookahead: {
    name: 'Lookahead',
    _route: null, // copied from optimal after AGENTS is defined
    _routeIndex: 0,
    _PLAYOUTS: 3,

    pickCard(hand, energy, actor, opponent) {
      const playable = hand.filter(c => c.cost <= energy);
      if (playable.length === 0) return null;
      if (playable.length === 1) return playable[0];

      const intent = opponent.nextIntent;
      const enemyAttacking = intent && (intent.type === 'attack' || intent.type === 'heavy_attack');
      const incomingDamage = enemyAttacking ? (intent.damage || 0) : 0;

      const hpRatio = actor.hp / actor.maxHp;

      // Heuristic pre-score: context-aware card selection
      function heuristicBonus(card) {
        let bonus = 0;

        // Survival priority: heal when HP is low, regardless of enemy intent
        if (hpRatio < 0.4) {
          for (const e of card.effects) {
            if (e.type === 'heal') bonus += e.value * 4;
          }
          if (card.block > 0) bonus += card.block * 1.5;
        }

        if (enemyAttacking) {
          // Prefer block/heal when enemy is attacking
          if (card.block > 0) bonus += Math.min(card.block, incomingDamage) * 1.5;
          for (const e of card.effects) {
            if (e.type === 'heal') bonus += e.value * 2;
          }
        } else {
          // Prefer damage/burn when enemy is buffing/defending
          if (card.damage > 0) bonus += card.damage * 1.2;
          if (card.effects.some(e => e.type === 'burn')) bonus += 6;
          if (card.effects.some(e => e.type === 'vulnerable')) bonus += 5;
        }
        // Always prioritize card draw and energy gain — they amplify everything
        for (const e of card.effects) {
          if (e.type === 'draw') bonus += e.value * 6;
          if (e.type === 'gainEnergy') bonus += e.value * 8;
        }
        if (card.cost === 0) bonus += 6;
        return bonus;
      }

      // Prune dominated cards: if two cards are same type (attack/block/skill),
      // skip the strictly weaker one (e.g., block 3 when block 4 exists at same cost)
      const dominated = new Set();
      for (let i = 0; i < playable.length; i++) {
        for (let j = 0; j < playable.length; j++) {
          if (i === j) continue;
          const a = playable[i], b = playable[j];
          if (a.cost === b.cost && a.type === b.type &&
              a.damage <= b.damage && a.block <= b.block &&
              a.effects.length <= b.effects.length &&
              (a.damage < b.damage || a.block < b.block)) {
            dominated.add(a.id);
          }
        }
      }
      const candidates = playable.filter(c => !dominated.has(c.id));
      if (candidates.length === 1) return candidates[0];

      const candidateIds = candidates.map(c => c.id);
      const savedState = _deepCopyState(gameState);
      let bestId = candidateIds[0];
      let bestScore = -Infinity;

      for (let ci = 0; ci < candidateIds.length; ci++) {
        const cardId = candidateIds[ci];
        const card = candidates[ci];
        let totalScore = heuristicBonus(card); // start with heuristic bias

        for (let p = 0; p < this._PLAYOUTS; p++) {
          _restoreState(savedState);

          const idx = gameState.player.hand.findIndex(c => c.id === cardId);
          if (idx < 0) continue;
          playCard(idx);

          if (gameState.phase !== GAME_PHASES.BATTLE) {
            totalScore += _evaluateState();
            continue;
          }

          // Play rest of turn with heuristic bias (not purely random)
          let safety = 15;
          while (gameState.phase === GAME_PHASES.BATTLE &&
                 gameState.currentTurn === 'player' && safety-- > 0) {
            const remaining = gameState.player.hand.filter(c => c.cost <= gameState.player.energy);
            if (remaining.length === 0) break;
            // Pick weighted by heuristic
            let bestR = remaining[0], bestRScore = -Infinity;
            for (const r of remaining) {
              const s = heuristicBonus(r) + Math.random() * 5;
              if (s > bestRScore) { bestRScore = s; bestR = r; }
            }
            const pi = gameState.player.hand.findIndex(c => c.id === bestR.id);
            if (pi < 0) break;
            playCard(pi);
            if (gameState.phase !== GAME_PHASES.BATTLE) break;
          }

          if (gameState.phase === GAME_PHASES.BATTLE && gameState.currentTurn === 'player') endTurn();
          if (gameState.phase === GAME_PHASES.BATTLE && gameState.currentTurn === 'enemy') endTurn();

          totalScore += _evaluateState();
        }

        const avgScore = totalScore / this._PLAYOUTS;
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestId = cardId;
        }
      }

      _restoreState(savedState);
      return gameState.player.hand.find(c => c.id === bestId) || hand.find(c => c.cost <= energy);
    },

    pickMapAction() { return 'scripted'; },
    pickReward(cards) {
      // Same as optimal
      let best = 0;
      let bestScore = -1;
      cards.forEach((c, i) => {
        const score = c.damage * 1.5 + c.block + c.effects.reduce((s, e) => {
          if (e.type === 'burn') return s + e.value * 2;
          if (e.type === 'heal') return s + e.value * 1.5;
          if (e.type === 'draw') return s + e.value * 3;
          if (e.type === 'gainEnergy') return s + e.value * 4;
          return s + 2;
        }, 0);
        if (score > bestScore) { bestScore = score; best = i; }
      });
      return best;
    },
    pickEventChoice(choices) {
      return choices.findIndex(c => c.reward) >= 0 ? choices.findIndex(c => c.reward) : 0;
    },
    pickShopCard(items, gold) {
      const affordable = items.filter(i => i.price <= gold);
      if (affordable.length === 0) return -1;
      let best = affordable[0];
      let bestVal = 0;
      affordable.forEach(i => {
        const val = i.card.damage * 2 + i.card.block + i.card.effects.length * 5;
        if (val > bestVal) { bestVal = val; best = i; }
      });
      return items.indexOf(best);
    },
    shouldRest(player) {
      return player.hp < player.maxHp * 0.7;
    },
  },

  /**
   * Expert agent: deep strategy with burn/thorns awareness, deck management,
   * smart map routing, adaptive blocking, and deck thinning.
   */
  expert: {
    name: 'Expert',

    // --- Helper: score a card's total value in current battle context ---
    _scoreCard(card, energy, actor, opponent) {
      const intent = opponent.nextIntent;
      const enemyAttacking = intent && (intent.type === 'attack' || intent.type === 'heavy_attack');
      const incomingDamage = enemyAttacking ? (intent.damage || 0) : 0;
      const unblockedDamage = Math.max(0, incomingDamage - actor.block);
      const hpRatio = actor.hp / actor.maxHp;
      const enemyHpRatio = opponent.hp / opponent.maxHp;
      const vulnerable = opponent.statuses && opponent.statuses.find(s => s.type === 'vulnerable');

      let score = 0;

      // --- Damage value ---
      if (card.damage > 0) {
        let dmg = card.damage;
        // Account for elemental advantage
        if (card.element && opponent.element && ELEMENT_STRENGTH[card.element] === opponent.element) {
          dmg = Math.floor(dmg * 1.5);
        }
        if (vulnerable) dmg = Math.floor(dmg * 1.5);
        score += dmg * 2;
        // Bonus for lethal damage
        if (dmg >= opponent.hp) score += 50;
      }

      // --- Block value: scales with how much damage we'd actually take ---
      if (card.block > 0) {
        if (unblockedDamage > 0) {
          // Block is worth more the more unblocked damage is incoming
          const usefulBlock = Math.min(card.block, unblockedDamage);
          score += usefulBlock * 3;
          // Extra value at low HP — every point matters
          if (hpRatio < 0.4) score += usefulBlock * 2;
        } else {
          // Enemy not attacking — block has minimal value
          score += card.block * 0.3;
        }
      }

      // --- Effect values ---
      for (const fx of card.effects) {
        switch (fx.type) {
          case 'burn':
            // Burn is free damage over time: value * duration
            score += fx.value * fx.duration * 1.8;
            // More valuable against high-HP enemies (boss fights)
            if (opponent.hp > 40) score += fx.value * 2;
            break;
          case 'heal':
            // Heal value scales inversely with HP
            const missingHp = actor.maxHp - actor.hp;
            const actualHeal = Math.min(fx.value, missingHp);
            score += actualHeal * (hpRatio < 0.4 ? 3 : 1.5);
            if (missingHp === 0) score -= 5; // worthless at full HP
            break;
          case 'draw':
            // Drawing is always good — more options
            score += fx.value * 4;
            break;
          case 'gainEnergy':
            // Energy is worth more when we have more cards to play
            score += fx.value * 5;
            break;
          case 'thorns':
            // Thorns: value depends on how many turns the fight will last
            // Great against enemies with frequent attacks
            const estimatedTurnsLeft = Math.ceil(opponent.hp / 8);
            score += fx.value * Math.min(fx.duration, estimatedTurnsLeft) * 1.5;
            break;
          case 'vulnerable':
            // Making enemy vulnerable amplifies all future damage by 50%
            score += fx.duration * 6;
            if (enemyHpRatio > 0.5) score += 4; // more valuable early in fight
            break;
          case 'cleanse':
            // Value depends on how bad our debuffs are
            const hasBurn = actor.statuses && actor.statuses.find(s => s.type === 'burn');
            const hasVuln = actor.statuses && actor.statuses.find(s => s.type === 'vulnerable');
            if (hasBurn) score += hasBurn.value * hasBurn.duration * 2;
            if (hasVuln) score += 8;
            if (!hasBurn && !hasVuln) score -= 3; // no debuffs = worthless
            break;
        }
      }

      // --- Energy efficiency: prefer cheaper cards when score is similar ---
      if (card.cost > 0) {
        score = score / card.cost;
      } else {
        score += 3; // free cards get a flat bonus
      }

      return score;
    },

    pickCard(hand, energy, actor, opponent) {
      const playable = hand.filter(c => c.cost <= energy);
      if (playable.length === 0) return null;

      // Always play energy-gain cards first to unlock more plays this turn
      const energyGain = playable.filter(c => c.effects.some(e => e.type === 'gainEnergy'));
      if (energyGain.length > 0) return energyGain[0];

      // Always play free draw cards first (expand options)
      const freeDraw = playable.filter(c => c.cost === 0 && c.effects.some(e => e.type === 'draw'));
      if (freeDraw.length > 0) return freeDraw[0];

      // Score all playable cards and pick the best
      let bestCard = playable[0];
      let bestScore = -Infinity;
      for (const card of playable) {
        const score = this._scoreCard(card, energy, actor, opponent);
        if (score > bestScore) {
          bestScore = score;
          bestCard = card;
        }
      }
      return bestCard;
    },

    pickMapAction() { return 'smart'; },

    pickReward(cards) {
      // Score each card considering what the deck needs
      const deck = gameState.player.deck;
      const totalDamage = deck.reduce((s, c) => s + c.damage, 0);
      const totalBlock = deck.reduce((s, c) => s + c.block, 0);
      const needsBlock = totalDamage > totalBlock * 2;
      const needsDamage = totalBlock > totalDamage * 1.5;

      let best = 0;
      let bestScore = -1;
      cards.forEach((c, i) => {
        let score = c.damage * 1.5 + c.block * 1.2;

        // Adjust for deck balance
        if (needsBlock && c.block > 0) score += c.block * 2;
        if (needsDamage && c.damage > 0) score += c.damage * 2;

        // Value effects
        score += c.effects.reduce((s, e) => {
          if (e.type === 'burn') return s + e.value * e.duration * 2;
          if (e.type === 'heal') return s + e.value * 1.5;
          if (e.type === 'draw') return s + e.value * 4;
          if (e.type === 'gainEnergy') return s + e.value * 5;
          if (e.type === 'thorns') return s + e.value * e.duration * 1.5;
          if (e.type === 'vulnerable') return s + e.duration * 5;
          return s + 2;
        }, 0);

        // Penalize high-cost cards in a small deck (harder to play)
        if (deck.length < 12 && c.cost >= 2) score *= 0.8;

        if (score > bestScore) { bestScore = score; best = i; }
      });
      return best;
    },

    pickEventChoice(choices) {
      const hpRatio = gameState.player.hp / gameState.player.maxHp;

      // Score each choice
      let bestIdx = choices.length - 1; // default: last (safe) option
      let bestScore = 0;
      choices.forEach((c, i) => {
        let score = 0;
        if (!c.reward) return; // skip no-reward options unless nothing else
        // Value rewards
        if (c.reward.heal) score += c.reward.heal * (1.5 - hpRatio);
        if (c.reward.rareCard) score += 15;
        if (c.reward.cardReward) score += 10 + (c.reward.cardCount || 3) * 3;
        if (c.reward.removeCard) score += 12;
        // Subtract costs
        if (c.cost && c.cost.hp) {
          if (hpRatio < 0.4) score -= c.cost.hp * 3; // too risky when low
          else score -= c.cost.hp;
        }
        if (c.cost && c.cost.gold) score -= c.cost.gold * 0.5;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      });
      return bestIdx;
    },

    pickShopCard(items, gold) {
      if (gold < 10) return -1; // save gold for card removal

      const deck = gameState.player.deck;
      const totalDamage = deck.reduce((s, c) => s + c.damage, 0);
      const totalBlock = deck.reduce((s, c) => s + c.block, 0);
      const needsBlock = totalDamage > totalBlock * 2;

      const affordable = items.filter(i => i.price <= gold);
      if (affordable.length === 0) return -1;

      let best = null;
      let bestScore = 0;
      for (const item of affordable) {
        let score = item.card.damage * 1.5 + item.card.block * 1.2;
        if (needsBlock && item.card.block > 0) score += item.card.block * 2;
        score += item.card.effects.reduce((s, e) => {
          if (e.type === 'burn') return s + e.value * 3;
          if (e.type === 'heal') return s + e.value * 1.5;
          return s + 2;
        }, 0);
        // Value per gold
        score = score / item.price * 10;
        if (score > bestScore) { bestScore = score; best = item; }
      }
      return best ? items.indexOf(best) : -1;
    },

    shouldRest(player) {
      // Rest if below 50%, or below 70% if about to face a tough battle
      const hpRatio = player.hp / player.maxHp;
      if (hpRatio < 0.5) return true;
      // Check if near boss (few uncleared locations left)
      if (gameState.campaign) {
        const totalLocs = Object.keys(WORLD.locations).length;
        const clearedCount = gameState.campaign.cleared.size;
        if (clearedCount > totalLocs * 0.7 && hpRatio < 0.8) return true;
      }
      return false;
    },

    // Card removal: remove weakest card from deck
    shouldRemoveCard(deck, gold) {
      if (gold < CARD_REMOVE_PRICE) return false;
      // Remove if deck has >10 cards and has weak starter cards
      if (deck.length > 10) {
        const weakest = deck.reduce((a, b) => {
          const aScore = a.damage + a.block + a.effects.length * 3;
          const bScore = b.damage + b.block + b.effects.length * 3;
          return aScore < bScore ? a : b;
        });
        const weakScore = weakest.damage + weakest.block + weakest.effects.length * 3;
        return weakScore < 8; // remove if the weakest card is really weak
      }
      return false;
    },
  },
};

// Wire explorer's combat to optimal's
AGENTS.explorer.pickCard = AGENTS.optimal.pickCard;

// Wire lookahead's route to optimal's
AGENTS.lookahead._route = AGENTS.optimal._route.slice();

// Deep copy/restore helpers for lookahead simulations
function _deepCopyState(state) {
  return JSON.parse(JSON.stringify(state, (key, value) => {
    if (value instanceof Set) return { __set: [...value] };
    return value;
  }));
}

function _restoreState(snapshot) {
  const restored = JSON.parse(JSON.stringify(snapshot), (key, value) => {
    if (value && value.__set) return new Set(value.__set);
    return value;
  });
  // Copy all properties onto gameState
  for (const key of Object.keys(gameState)) {
    if (!(key in restored)) delete gameState[key];
  }
  Object.assign(gameState, restored);
}

function _evaluateState() {
  // Score the game state from the player's perspective
  const p = gameState.player;
  const e = gameState.enemy;

  if (!p || p.hp <= 0) return -100; // player dead
  if (!e || e.hp <= 0) return 100;  // enemy dead

  // Weighted score: player HP matters most, enemy damage dealt is good
  const playerHpPct = p.hp / p.maxHp;
  const enemyHpPct = e.hp / e.maxHp;
  const blockValue = Math.min(p.block, 15) / 15; // block is valuable up to ~15

  return (playerHpPct * 40) - (enemyHpPct * 30) + (blockValue * 10);
}

// === Deck Strength Scoring ===

/**
 * Compute a composite deck strength score (roughly 0-100).
 * Considers all cards the player owns (deck + discard + hand).
 */
function scoreDeck(player) {
  const allCards = [...player.deck, ...player.discard, ...player.hand];
  if (allCards.length === 0) return 0;

  let totalValue = 0;

  for (const card of allCards) {
    let cardValue = 0;

    // Raw damage and block
    cardValue += (card.damage || 0) * 1.0;
    cardValue += (card.block || 0) * 0.8;

    // Effect values
    for (const fx of (card.effects || [])) {
      const dur = fx.duration || 1;
      switch (fx.type) {
        case 'burn':       cardValue += fx.value * dur * 1.5; break;
        case 'heal':       cardValue += fx.value * 1.8; break;
        case 'draw':       cardValue += fx.value * 3.0; break;
        case 'gainEnergy': cardValue += fx.value * 4.0; break;
        case 'thorns':     cardValue += fx.value * dur * 1.2; break;
        case 'vulnerable': cardValue += dur * 3.0; break;
        case 'weak':       cardValue += dur * 2.5; break;
        case 'cleanse':    cardValue += 3.0; break;
        default:           cardValue += 1.5; break;
      }
    }

    // Energy efficiency bonus: high damage-per-cost is valuable
    const cost = card.cost || 1;
    if (cost > 0 && card.damage > 0) {
      cardValue += (card.damage / cost) * 0.5;
    }

    // Upgraded bonus
    if (card.upgraded) cardValue *= 1.25;

    // Rarity bonus
    const rarity = card.rarity || 'common';
    if (rarity === 'uncommon') cardValue *= 1.1;
    else if (rarity === 'rare') cardValue *= 1.3;
    else if (rarity === 'legendary') cardValue *= 1.5;

    totalValue += cardValue;
  }

  // Average card quality
  const avgQuality = totalValue / allCards.length;

  // Ideal deck size is around 10-12 cards. Penalize dilution.
  const idealSize = 11;
  const sizePenalty = Math.max(0, (allCards.length - idealSize) * 0.8);

  // Score: base from average quality, scaled, minus dilution penalty
  // avgQuality of ~8-10 for a good card, so multiply to reach 0-100 range
  let score = avgQuality * 7 - sizePenalty;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

// === Headless Simulation Engine ===

/**
 * Simulates a single complete campaign run.
 * Returns detailed stats about the run.
 */
function _hlog(stats, type, data) {
  if (HISTORY_OUTPUT) stats.history.push({ type, ...data });
}

function simulateGame(agent, element, ablation) {
  const stats = {
    agent: agent.name,
    element,
    ablation: ablation ? ablation.name : 'none',
    won: false,
    diedAt: null,
    locationsVisited: 0,
    battlesWon: 0,
    battlesFought: 0,
    totalTurns: 0,
    totalCardsPlayed: 0,
    finalHp: 0,
    goldEarned: 0,
    goldSpent: 0,
    itemsCollected: 0,
    questsCompleted: 0,
    error: null,
    totalActions: 0,
    trace: [],
    history: [], // detailed event log
  };

  const MAX_ACTIONS = 5000; // safety limit
  const abl = ablation ? ablation.name : null;

  try {
    // Init game — from saved state or fresh
    if (_loadedStates && _loadedStates.length > 0) {
      const snapshot = _loadedStates[Math.floor(Math.random() * _loadedStates.length)];
      _restoreState(snapshot);
      // Handle the mini-boss victory screen we saved at
      if (gameState.phase === 'mini_boss_victory') {
        continueAfterMiniBoss();
      }
    } else {
      gameState = createGameState();
      gameState.mode = GAME_MODES.AI;
      gameState.player = createPlayerState(element, STARTING_HP);
      gameState.campaign = createCampaignState();
      gameState.phase = GAME_PHASES.MAP;
    }
    _mapVisitCount = {};
    _mapStateKey = '';

    // Apply ablation
    _activeAblation = ablation ? ablation.name : null;
    _simVisited = new Set();
    // Reset scripted routes
    if (AGENTS.optimal._route) { AGENTS.optimal._routeIndex = 0; AGENTS.optimal._lastShopVisited = null; }
    if (AGENTS.lookahead._route) { AGENTS.lookahead._routeIndex = 0; AGENTS.lookahead._lastShopVisited = null; }
    if (ablation && ablation.apply) ablation.apply();

    // Snapshot helper for history log
    function _snap() {
      return { hp: gameState.player.hp, maxHp: gameState.player.maxHp, gold: gameState.campaign.gold, deck: gameState.player.deck.length + gameState.player.discard.length + gameState.player.hand.length, loc: gameState.campaign.currentLocation };
    }

    let actions = 0;

    while (actions < MAX_ACTIONS) {
      actions++;
      stats.totalActions = actions;

      if (gameState.phase === GAME_PHASES.VICTORY) {
        stats.won = true;
        stats.finalHp = gameState.player.hp;
        _hlog(stats, 'victory', { hp: gameState.player.hp });
        break;
      }

      if (gameState.phase === GAME_PHASES.GAME_OVER) {
        stats.diedAt = gameState._battleLocationId || 'unknown';
        stats.finalHp = 0;
        _hlog(stats, 'death', { location: stats.diedAt, hp: 0 });
        break;
      }

      if (gameState.phase === GAME_PHASES.MAP) {
        try {
          simulateMapTurn(agent, stats);
        } catch(e) {
          stats.error = `Map error: ${e.message} (act ${gameState.campaign.currentAct})`;
          break;
        }
        // Record trace point after map turn
        stats.trace.push({
          hp: gameState.player.hp,
          maxHp: gameState.player.maxHp,
          deckScore: scoreDeck(gameState.player),
          nodesExplored: gameState.campaign ? gameState.campaign.explored.size : 0,
          location: gameState.campaign.currentLocation,
          action: actions,
        });
        continue;
      }

      if (gameState.phase === GAME_PHASES.BATTLE) {
        // Double enemy HP ablation
        if (abl === 'Double enemy HP' && gameState.enemy && !gameState.enemy._doubled) {
          gameState.enemy.hp *= 2;
          gameState.enemy.maxHp *= 2;
          gameState.enemy._doubled = true;
        }
        const _preHp = gameState.player.hp;
        const _enemyName = gameState.enemy ? gameState.enemy.name : '?';
        const _enemyHp = gameState.enemy ? gameState.enemy.maxHp : 0;
        simulateBattleTurn(agent, stats);
        const won = gameState.enemy && gameState.enemy.hp <= 0;
        _hlog(stats, 'battle', { ..._snap(), enemy: _enemyName, enemyHp: _enemyHp, hpLost: _preHp - gameState.player.hp, won });
        // Record trace point after battle
        stats.trace.push({
          hp: gameState.player.hp,
          maxHp: gameState.player.maxHp,
          deckScore: scoreDeck(gameState.player),
          nodesExplored: gameState.campaign ? gameState.campaign.explored.size : 0,
          location: gameState.campaign ? gameState.campaign.currentLocation : 'unknown',
          action: actions,
        });
        continue;
      }

      if (gameState.phase === GAME_PHASES.CARD_REWARD) {
        if (abl === 'No card rewards') {
          skipReward();
          continue;
        }
        const cards = gameState._rewardCards || [];
        if (cards.length > 0) {
          const pick = agent.pickReward(cards);
          if (pick >= 0 && pick < cards.length) {
            const picked = cards[pick];
            _hlog(stats, 'reward', { ..._snap(), card: picked.name, options: cards.map(c => c.name) });
            pickRewardCard(pick);
          } else {
            _hlog(stats, 'reward', { ..._snap(), card: 'SKIP', options: cards.map(c => c.name) });
            skipReward();
          }
        } else {
          skipReward();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.SHOP) {
        if (abl === 'No gold (shop disabled)') { leaveShop(); continue; }
        const gold = gameState.campaign.gold;

        // Buy heal potion if low HP
        if (gameState.player.hp < gameState.player.maxHp * 0.6 && gold >= SHOP_HEAL_PRICE) {
          _hlog(stats, 'shop', { ..._snap(), action: 'heal' });
          buyHeal();
          continue;
        }

        // Remove filler cards if affordable
        const allCards = [...gameState.player.deck, ...gameState.player.discard, ...gameState.player.hand];
        const hasFiller = allCards.some(c => c.templateKey === 'stumble' || c.templateKey === 'brace');
        if (hasFiller && gold >= CARD_REMOVE_PRICE) {
          _hlog(stats, 'shop', { ..._snap(), action: 'remove' });
          openShopRemove();
          continue;
        }

        // Try to buy a card
        const items = gameState._shopCards || [];
        const pick = agent.pickShopCard(items, gold);
        if (pick >= 0) {
          const before = gameState.campaign.gold;
          _hlog(stats, 'shop', { ..._snap(), action: 'buy', card: items[pick].card.name });
          buyCard(pick);
          stats.goldSpent += before - gameState.campaign.gold;
          continue;
        }

        // Done shopping — leave
        _hlog(stats, 'shop', { ..._snap(), action: 'leave' });
        leaveShop();
        continue;
      }

      if (gameState.phase === GAME_PHASES.REST) {
        if (abl === 'No resting' || !canRest()) {
          clearLocation(gameState.campaign.currentLocation);
          returnToMap();
          continue;
        }
        const hpRatio = gameState.player.hp / gameState.player.maxHp;
        const hasUpgradeable = gameState.player.deck.some(c => !c.upgraded);
        const deckSize = gameState.player.deck.length + gameState.player.discard.length;

        if (hpRatio < 0.5) {
          _hlog(stats, 'rest', { ..._snap(), action: 'heal' });
          doRest();
        } else if (deckSize > 10 && hpRatio > 0.5) {
          _hlog(stats, 'rest', { ..._snap(), action: 'remove' });
          gameState._upgradeMode = 'remove';
          gameState.phase = GAME_PHASES.CARD_UPGRADE;
        } else if (hasUpgradeable && hpRatio > 0.7) {
          _hlog(stats, 'rest', { ..._snap(), action: 'upgrade' });
          gameState._upgradeMode = 'upgrade';
          gameState.phase = GAME_PHASES.CARD_UPGRADE;
        } else {
          _hlog(stats, 'rest', { ..._snap(), action: 'heal' });
          doRest();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.NPC) {
        leaveNpc();
        continue;
      }

      if (gameState.phase === GAME_PHASES.EVENT) {
        if (abl === 'No events') { advanceAfterNode(); continue; }
        const eventId = gameState._currentEvent;
        const event = EVENTS[eventId];
        if (event) {
          const choice = agent.pickEventChoice(event.choices);
          doEventChoice(choice);
          // Chest animation writes to DOM without changing phase — skip to card reward
          if (gameState.phase === GAME_PHASES.EVENT && gameState._rewardCards) {
            gameState.phase = GAME_PHASES.CARD_REWARD;
          }
        } else {
          advanceAfterNode();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.CARD_UPGRADE) {
        // Handle upgrade preview confirmation
        if (gameState._upgradePreviewCardId) {
          confirmUpgrade();
          continue;
        }

        const mode = gameState._upgradeMode || 'upgrade';
        const allCards = [...gameState.player.deck, ...gameState.player.discard, ...gameState.player.hand];
        const cards = mode === 'upgrade' ? allCards.filter(c => !c.upgraded) : allCards;

        if (cards.length === 0) {
          returnFromUpgrade();
          continue;
        }

        // Check gold for upgrade/remove at rest sites — go to map if can't afford
        if (mode === 'upgrade' && !gameState._returnToShop && gameState.campaign.gold < CARD_UPGRADE_PRICE) {
          clearLocation(gameState.campaign.currentLocation);
          returnToMap();
          continue;
        }
        if (mode === 'remove' && !gameState._returnToShop && gameState.campaign.gold < CARD_REMOVE_PRICE) {
          clearLocation(gameState.campaign.currentLocation);
          returnToMap();
          continue;
        }

        if (mode === 'remove') {
          // Remove the weakest card (lowest damage + block)
          let weakIdx = 0;
          let weakScore = Infinity;
          cards.forEach((c, i) => {
            const s = c.damage + c.block + c.effects.length * 3;
            if (s < weakScore) { weakScore = s; weakIdx = i; }
          });
          doCardAction(weakIdx);
        } else {
          // Upgrade the strongest card
          let bestIdx = 0;
          let bestScore = -1;
          cards.forEach((c, i) => {
            const s = c.damage * 2 + c.block * 1.5 + c.effects.length * 3;
            if (s > bestScore) { bestScore = s; bestIdx = i; }
          });
          doCardAction(bestIdx);
        }
        continue;
      }

      // Mini-boss victory screen — continue to card reward
      if (gameState.phase === 'mini_boss_victory') {
        // Save state snapshot after first mini-boss
        if (SAVE_STATES && gameState._miniBossVictory) {
          _savedStates.push(_deepCopyState(gameState));
        }
        continueAfterMiniBoss();
        continue;
      }

      // Tree offering — skip the animation, just grant a rare card
      if (gameState._treeOffering) {
        delete gameState._treeOffering;
        delete gameState._treeResult;
        const rareCard = getRareCard();
        gameState.player.deck.push(rareCard);
        clearLocation(gameState.campaign.currentLocation);
        returnToMap();
        continue;
      }

      // Unknown/new phase — try to return to map, or bail
      if (typeof returnToMap === 'function') {
        try { returnToMap(); } catch (e) {
          stats.error = `Unhandled phase: ${gameState.phase} (${e.message})`;
          break;
        }
      } else {
        stats.error = `Stuck in unknown phase: ${gameState.phase}`;
        break;
      }
    }

    if (actions >= MAX_ACTIONS) {
      stats.error = `Hit action limit (${MAX_ACTIONS})`;
    }

    stats.goldEarned = gameState.campaign ? gameState.campaign.gold + stats.goldSpent : 0;
    stats.itemsCollected = gameState.campaign ? (gameState.campaign.blessings ? Object.keys(gameState.campaign.blessings).length : 0) : 0;
    stats.locationsVisited = gameState.campaign ? gameState.campaign.visited.size : 0;

  } catch (e) {
    stats.error = `${e.message} (at action ${stats.totalActions})`;
  }

  return stats;
}

/**
 * Simulate one map navigation step
 */
let _activeAblation = null;
let _simVisited = new Set();

/**
 * Simulate one world map turn — navigate + enter locations
 */
function simulateMapTurn(agent, stats) {
  try {
    const campaign = gameState.campaign;
    const currentId = campaign.currentLocation;
    const currentLoc = WORLD.locations[currentId];
    if (!currentLoc) { stats.error = 'Invalid location: ' + currentId; return; }

    const isCleared = campaign.cleared.has(currentId);

    // If at an uncleared location, enter it
    if (!isCleared) {
      const type = currentLoc.type;

      if ([LOC_TYPES.BATTLE, LOC_TYPES.ELITE, LOC_TYPES.MINI_BOSS, LOC_TYPES.BOSS].includes(type)) {
        gameState._battleLocationId = currentId;
        if (currentLoc.blessing) gameState._miniBossBlessing = currentLoc.blessing;
        if (type === LOC_TYPES.ELITE) {
          startEliteBattle(currentLoc.enemy, currentLoc.goldReward || 0);
        } else {
          startNodeBattle(currentLoc.enemy, currentLoc.goldReward || 0);
        }
        stats.battlesFought++;
        return;
      }

      if (type === LOC_TYPES.REST && _activeAblation !== 'No resting') {
        if (!canRest()) {
          // Can't rest yet — just clear and move on
          clearLocation(currentId);
          return;
        }
        const hpRatio = gameState.player.hp / gameState.player.maxHp;
        const allCards = [...gameState.player.deck, ...gameState.player.discard, ...gameState.player.hand];
        const hasFiller = allCards.some(c => c.templateKey === 'stumble' || c.templateKey === 'brace');
        if (hpRatio < 0.5) {
          doRest(); // heal when critically low
        } else if (hasFiller) {
          // Remove filler cards first — deck quality > upgrades
          gameState._upgradeMode = 'remove';
          gameState.phase = GAME_PHASES.CARD_UPGRADE;
        } else if (hpRatio < 0.7) {
          doRest();
        } else {
          const hasUpgradeable = allCards.some(c => !c.upgraded);
          if (hasUpgradeable) {
            gameState._upgradeMode = 'upgrade';
            gameState.phase = GAME_PHASES.CARD_UPGRADE;
          } else {
            doRest();
          }
        }
        return;
      }

      if (type === LOC_TYPES.SHOP && _activeAblation !== 'No gold (shop disabled)') {
        gameState._shopCards = getAvailableShopCards();
        gameState.phase = GAME_PHASES.SHOP;
        return;
      }

      if (type === LOC_TYPES.EVENT && _activeAblation !== 'No events') {
        if (currentLoc.eventKey && EVENTS[currentLoc.eventKey]) {
          gameState._currentEvent = currentLoc.eventKey;
          gameState.phase = GAME_PHASES.EVENT;
        } else {
          clearLocation(currentId);
        }
        return;
      }

      if (type === LOC_TYPES.NPC) {
        clearLocation(currentId);
        return;
      }

      if (type === LOC_TYPES.TREASURE) {
        openTreasure(currentId);
        return;
      }

      // Unknown type — clear and continue
      clearLocation(currentId);
      return;
    }

    // Re-enter cleared rest/shop if HP is critical (once per location)
    const _hpRatio = gameState.player.hp / gameState.player.maxHp;
    if (!gameState._healRetried) gameState._healRetried = new Set();
    if (_hpRatio < 0.4 && !gameState._healRetried.has(currentId)) {
      gameState._healRetried.add(currentId);
      if (currentLoc.type === LOC_TYPES.REST && canRest() && _activeAblation !== 'No resting') {
        _hlog(stats, 'rest', { ..._snap(), action: 'heal' });
        doRest();
        return;
      }
      if (currentLoc.type === LOC_TYPES.SHOP && gameState.campaign.gold >= SHOP_HEAL_PRICE && _activeAblation !== 'No gold (shop disabled)') {
        gameState._shopCards = getAvailableShopCards();
        gameState.phase = GAME_PHASES.SHOP;
        return;
      }
    }

    // Location is cleared — navigate to next
    const connections = (currentLoc.paths || []).filter(id => canTravelTo(id));

    if (connections.length === 0) {
      stats.error = 'Stuck at ' + currentId + ' (no travelable connections)';
      return;
    }

    const dest = pickDestination(agent, connections);
    if (!dest) { stats.error = 'No destination from ' + currentId; return; }

    travelTo(dest);
  } catch (e) {
    stats.error = e.message + ' (map at ' + gameState.campaign.currentLocation + ')';
  }
}

function pickDestination(agent, connections) {
  if (connections.length === 0) return null;
  if (connections.length === 1) return connections[0];

  const campaign = gameState.campaign;
  const hpRatio = gameState.player.hp / gameState.player.maxHp;

  if (agent.name === 'Random') {
    return connections[Math.floor(Math.random() * connections.length)];
  }

  // Explorer: prefer unvisited, then uncleared, with randomness
  if (agent.name === 'Explorer') {
    const unvisited = connections.filter(id => !campaign.visited.has(id));
    if (unvisited.length > 0) return unvisited[Math.floor(Math.random() * unvisited.length)];
    const uncleared = connections.filter(id => !campaign.cleared.has(id));
    if (uncleared.length > 0) return uncleared[Math.floor(Math.random() * uncleared.length)];
    return connections[Math.floor(Math.random() * connections.length)];
  }

  // Survival priority: when HP is low, seek rest sites or shops for healing
  const hpCritical = hpRatio < 0.4;
  const hasHealGold = campaign.gold >= SHOP_HEAL_PRICE;
  if (agent._route && hpCritical) {
    // Prefer adjacent rest site we can use
    const restSites = connections.filter(id => {
      const loc = WORLD.locations[id];
      return loc && loc.type === LOC_TYPES.REST && canRest();
    });
    if (restSites.length > 0) return restSites[0];
    // Or a shop where we can buy a heal
    if (hasHealGold) {
      const shops = connections.filter(id => {
        const loc = WORLD.locations[id];
        return loc && loc.type === LOC_TYPES.SHOP;
      });
      if (shops.length > 0) return shops[0];
    }
  }

  // Shop-seeking: when gold >= 15 and healthy enough, divert to adjacent shop
  if (agent._route && campaign.gold >= 15 && !hpCritical) {
    const shops = connections.filter(id => {
      const loc = WORLD.locations[id];
      return loc && loc.type === LOC_TYPES.SHOP && id !== agent._lastShopVisited;
    });
    if (shops.length > 0) {
      agent._lastShopVisited = shops[0];
      return shops[0];
    }
  }

  // Scripted route agents
  if (agent._route) {
    // Find the next destination in the route that we can travel to
    while (agent._routeIndex < agent._route.length) {
      const target = agent._route[agent._routeIndex];
      if (connections.includes(target)) {
        agent._routeIndex++;
        return target;
      }
      // Target not directly reachable — try to pathfind toward it
      // Pick the connection closest to the target in the route
      const targetLoc = WORLD.locations[target];
      if (targetLoc) {
        let bestConn = null;
        let bestDist = Infinity;
        for (const connId of connections) {
          const connLoc = WORLD.locations[connId];
          if (!connLoc) continue;
          const dx = connLoc.x - targetLoc.x;
          const dy = connLoc.y - targetLoc.y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) { bestDist = dist; bestConn = connId; }
        }
        if (bestConn) return bestConn;
      }
      // Can't reach this target at all, skip it
      agent._routeIndex++;
    }
    // Route exhausted — fall through to scored navigation
  }

  // Fallback: score-based navigation
  const scored = connections.map(id => {
    const loc = WORLD.locations[id];
    if (!loc) return { id, score: -100 };
    let score = 0;
    const cleared = campaign.cleared.has(id);

    if (!cleared) score += 20;
    else score -= 10;

    if (loc.type === LOC_TYPES.REST && hpRatio < 0.6 && canRest()) score += 15;
    if (loc.type === LOC_TYPES.REST && !canRest()) score -= 5;
    if (loc.type === LOC_TYPES.SHOP && campaign.gold >= 8) score += 10;
    if (loc.type === LOC_TYPES.ELITE && !cleared && hpRatio > 0.5) score += 25;
    if (loc.type === LOC_TYPES.ELITE && hpRatio < 0.4) score -= 10;
    if (loc.type === LOC_TYPES.MINI_BOSS || loc.type === LOC_TYPES.BOSS) {
      const eliteCleared = Object.entries(WORLD.locations).some(([eid, l]) => l.type === LOC_TYPES.ELITE && campaign.cleared.has(eid));
      if (eliteCleared && hpRatio > 0.5) score += 15;
      else if (!eliteCleared) score -= 20;
      else score -= 5;
    }
    if (loc.type === LOC_TYPES.EVENT && !cleared) score += 8;
    if (id === 'elder_tree' && !cleared) score += 20;
    if (_simVisited.has(id)) score -= 15;

    return { id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  _simVisited.add(scored[0].id);
  return scored[0].id;
}

/**
 * Simulate one complete battle (all turns until someone dies)
 */
function simulateBattleTurn(agent, stats) {
  const MAX_BATTLE_TURNS = 100;
  let turns = 0;

  while (gameState.phase === GAME_PHASES.BATTLE && turns < MAX_BATTLE_TURNS) {
    if (gameState.currentTurn === 'player') {
      turns++;
      stats.totalTurns++;

      // Play cards until we can't or don't want to
      let cardsThisTurn = 0;
      const MAX_CARDS_PER_TURN = 20;
      while (cardsThisTurn < MAX_CARDS_PER_TURN && gameState.phase === GAME_PHASES.BATTLE) {
        const card = agent.pickCard(gameState.player.hand, gameState.player.energy, gameState.player, gameState.enemy);
        if (!card) break;

        // Re-read hand after pickCard (lookahead agent may restore state)
        const index = gameState.player.hand.findIndex(c => c.id === card.id);
        if (index < 0) break;

        gameState.selectedCardIndex = index;
        playCard(index);
        cardsThisTurn++;
        stats.totalCardsPlayed++;

        // Check if battle ended
        if (gameState.phase !== GAME_PHASES.BATTLE) return;
      }

      // End player turn
      if (gameState.phase === GAME_PHASES.BATTLE) {
        endTurn();
      }
    } else {
      // AI turn is handled automatically by executeAITurn via startTurn
      // But since setTimeout is immediate in our stub, it should auto-resolve
      // If we're still on enemy turn, something is stuck
      if (gameState.currentTurn === 'enemy' && gameState.phase === GAME_PHASES.BATTLE) {
        endTurn();
      }
    }
  }

  if (turns >= MAX_BATTLE_TURNS) {
    stats.error = `Battle exceeded ${MAX_BATTLE_TURNS} turns`;
  }

  if (gameState.phase === GAME_PHASES.BATTLE) {
    // Shouldn't happen
    stats.error = stats.error || 'Battle did not resolve';
  }

  if (gameState.enemy && gameState.enemy.hp <= 0) {
    stats.battlesWon++;
  }
}

// === Run Simulations ===

function runSimulations() {
  const elements = FORCE_ELEMENT ? [FORCE_ELEMENT] : ['fire', 'water', 'earth', 'air'];
  const defaultAgents = ['random', 'explorer', 'optimal', 'lookahead'];
  const agentNames = AGENT_FILTER === 'all' ? Object.keys(AGENTS)
    : AGENT_FILTER === 'default' ? defaultAgents
    : [AGENT_FILTER];

  // Load saved states if requested
  if (LOAD_STATE) {
    try {
      const raw = fs.readFileSync(LOAD_STATE, 'utf8');
      _loadedStates = JSON.parse(raw);
      console.log(`\nLoaded ${_loadedStates.length} saved states from ${LOAD_STATE}`);
    } catch (e) {
      console.error(`Failed to load states from ${LOAD_STATE}: ${e.message}`);
      return;
    }
  }

  console.log(`\n🐉 Dragon Cards Simulator`);
  console.log(`   Runs: ${NUM_RUNS} per agent × ${elements.length} elements`);
  console.log(`   Agents: ${agentNames.join(', ')}`);
  if (_loadedStates) console.log(`   Starting from: ${LOAD_STATE} (${_loadedStates.length} states)`);
  console.log('');

  const allResults = {};

  for (const agentName of agentNames) {
    const agent = AGENTS[agentName];
    if (!agent) {
      console.error(`Unknown agent: ${agentName}`);
      continue;
    }

    const results = [];

    for (const element of elements) {
      for (let i = 0; i < NUM_RUNS; i++) {
        const result = simulateGame(agent, element, null);
        results.push(result);

        if (VERBOSE) {
          const status = result.won ? '✅ WIN' : result.error ? `❌ ERR: ${result.error}` : `💀 DIED at ${result.diedAt}`;
          console.log(`  [${agent.name}/${element}] ${status} — ${result.totalActions} actions, ${result.battlesWon} battles, HP:${result.finalHp}`);
        }
      }
    }

    allResults[agentName] = results;

    // Print summary
    const total = results.length;
    const wins = results.filter(r => r.won).length;
    const errors = results.filter(r => r.error).length;
    const deaths = results.filter(r => !r.won && !r.error).length;
    const avgActions = (results.reduce((s, r) => s + r.totalActions, 0) / total).toFixed(1);
    const avgBattles = (results.reduce((s, r) => s + r.battlesWon, 0) / total).toFixed(1);
    const avgTurns = (results.reduce((s, r) => s + r.totalTurns, 0) / total).toFixed(1);
    const avgCards = (results.reduce((s, r) => s + r.totalCardsPlayed, 0) / total).toFixed(1);
    const avgHpWins = wins > 0
      ? (results.filter(r => r.won).reduce((s, r) => s + r.finalHp, 0) / wins).toFixed(1)
      : 'N/A';

    // Death location distribution
    const deathLocs = {};
    results.filter(r => r.diedAt).forEach(r => {
      deathLocs[r.diedAt] = (deathLocs[r.diedAt] || 0) + 1;
    });

    console.log(`━━━ ${agent.name} Agent ━━━`);
    console.log(`  Win rate:     ${wins}/${total} (${(wins/total*100).toFixed(1)}%)`);
    console.log(`  Deaths:       ${deaths}  |  Errors: ${errors}`);
    console.log(`  Avg actions:  ${avgActions}`);
    console.log(`  Avg battles:  ${avgBattles}  |  Avg turns: ${avgTurns}  |  Avg cards: ${avgCards}`);
    console.log(`  Avg HP (wins): ${avgHpWins}`);
    if (Object.keys(deathLocs).length > 0) {
      console.log(`  Deaths by location:`);
      Object.entries(deathLocs).sort((a, b) => b[1] - a[1]).forEach(([loc, count]) => {
        console.log(`    ${loc}: ${count} (${(count/total*100).toFixed(1)}%)`);
      });
    }
    if (errors > 0) {
      const errorTypes = {};
      results.filter(r => r.error).forEach(r => {
        errorTypes[r.error] = (errorTypes[r.error] || 0) + 1;
      });
      console.log(`  Error breakdown:`);
      Object.entries(errorTypes).sort((a, b) => b[1] - a[1]).forEach(([err, count]) => {
        console.log(`    ${err}: ${count}`);
      });
    }
    console.log('');
  }

  // Balance check
  const balanceSummary = {};
  if (!JSON_OUTPUT) console.log('━━━ Balance Assessment ━━━');
  for (const agentName of agentNames) {
    const results = allResults[agentName];
    const winRate = results.filter(r => r.won).length / results.length * 100;
    let assessment;
    if (agentName === 'random') {
      assessment = winRate < 3 ? '✅ Good (hard enough)' : winRate < 10 ? '⚠️ Slightly easy' : '❌ Too easy';
    } else if (agentName === 'greedy') {
      assessment = winRate < 5 ? '❌ Too hard' : winRate < 30 ? '✅ Good balance' : '⚠️ Slightly easy';
    } else if (agentName === 'optimal') {
      assessment = winRate < 15 ? '❌ Too hard' : winRate < 60 ? '✅ Good balance' : '⚠️ Slightly easy';
    } else if (agentName === 'lookahead') {
      assessment = winRate < 20 ? '❌ Too hard' : winRate < 65 ? '✅ Good balance' : '⚠️ Slightly easy';
    } else if (agentName === 'expert') {
      assessment = winRate < 30 ? '❌ Too hard' : winRate < 75 ? '✅ Good balance' : '⚠️ Slightly easy';
    } else {
      assessment = `${winRate.toFixed(1)}% win rate`;
    }
    balanceSummary[agentName] = { winRate, assessment };
    if (!JSON_OUTPUT) console.log(`  ${AGENTS[agentName].name}: ${winRate.toFixed(1)}% win rate — ${assessment}`);
  }
  if (!JSON_OUTPUT) console.log('');

  // JSON output for programmatic use
  if (JSON_OUTPUT) {
    const jsonOutput = {};
    for (const agentName of agentNames) {
      const results = allResults[agentName];
      const total = results.length;
      jsonOutput[agentName] = {
        total,
        wins: results.filter(r => r.won).length,
        deaths: results.filter(r => !r.won && !r.error).length,
        errors: results.filter(r => r.error).length,
        winRate: balanceSummary[agentName].winRate,
        assessment: balanceSummary[agentName].assessment,
        avgActions: results.reduce((s, r) => s + r.totalActions, 0) / total,
        avgBattlesWon: results.reduce((s, r) => s + r.battlesWon, 0) / total,
        avgTurns: results.reduce((s, r) => s + r.totalTurns, 0) / total,
        avgCardsPlayed: results.reduce((s, r) => s + r.totalCardsPlayed, 0) / total,
        errorTypes: results.filter(r => r.error).reduce((acc, r) => {
          acc[r.error] = (acc[r.error] || 0) + 1;
          return acc;
        }, {}),
      };
    }
    console.log(JSON.stringify(jsonOutput, null, 2));
  }

  // Save game histories for inspection
  if (HISTORY_OUTPUT) {
    const histories = [];
    for (const agentName of agentNames) {
      for (const r of allResults[agentName]) {
        if (r.history && r.history.length > 0) {
          histories.push({
            agent: agentName, element: r.element,
            outcome: r.won ? 'victory' : (r.error ? 'error' : 'death'),
            diedAt: r.diedAt, finalHp: r.finalHp,
            history: r.history,
          });
        }
      }
    }
    fs.writeFileSync(HISTORY_OUTPUT, JSON.stringify(histories, null, 2));
    console.log(`History saved to ${HISTORY_OUTPUT} (${histories.length} runs)`);
  }

  // Save game states after first mini-boss
  if (SAVE_STATES && _savedStates.length > 0) {
    fs.writeFileSync(SAVE_STATES, JSON.stringify(_savedStates));
    console.log(`Saved ${_savedStates.length} post-mini-boss states to ${SAVE_STATES}`);
  }

  // Trace output for live-sim.html visualization
  if (TRACE_OUTPUT) {
    const agentColors = { random: '#888888', explorer: '#4488dd', optimal: '#c8a96e', lookahead: '#cc55cc', expert: '#44cccc' };
    // Load existing traces to append
    let traces = [];
    try {
      const existing = fs.readFileSync(TRACE_OUTPUT, 'utf8');
      traces = JSON.parse(existing);
    } catch (e) { /* no existing file */ }
    for (const agentName of agentNames) {
      const results = allResults[agentName];
      for (const r of results) {
        traces.push({
          agent: agentName,
          color: agentColors[agentName] || '#888888',
          outcome: r.won ? 'victory' : (r.error ? 'error' : 'death'),
          points: r.trace || [],
        });
      }
    }
    fs.writeFileSync(TRACE_OUTPUT, JSON.stringify(traces));
    console.log(`Traces saved to ${TRACE_OUTPUT} (${traces.length} total, appended)`);
  }
}

function runAblations() {
  const elements = FORCE_ELEMENT ? [FORCE_ELEMENT] : ['fire', 'water', 'earth', 'air'];
  const agent = AGENTS.optimal; // always test with optimal
  const ablationKeys = ABLATION_MODE === 'all'
    ? Object.keys(ABLATIONS)
    : [ABLATION_MODE];

  console.log(`\n🔬 Ablation Tests (${agent.name} agent)`);
  console.log(`   Runs: ${NUM_RUNS} per ablation × ${elements.length} elements\n`);

  const rows = [];

  for (const ablKey of ablationKeys) {
    const abl = ABLATIONS[ablKey];
    if (!abl) { console.error(`Unknown ablation: ${ablKey}`); continue; }

    const results = [];
    for (const element of elements) {
      for (let i = 0; i < NUM_RUNS; i++) {
        results.push(simulateGame(agent, element, abl));
      }
    }

    const total = results.length;
    const wins = results.filter(r => r.won).length;
    const errors = results.filter(r => r.error).length;
    const winRate = (wins / total * 100).toFixed(1);
    const avgHp = wins > 0 ? (results.filter(r => r.won).reduce((s, r) => s + r.finalHp, 0) / wins).toFixed(1) : '-';

    rows.push({ name: abl.name, winRate: parseFloat(winRate), wins, total, avgHp, errors });
    console.log(`  ${abl.name.padEnd(40)} Win: ${winRate}% (${wins}/${total})  AvgHP: ${avgHp}  Err: ${errors}`);
  }

  // Summary table
  console.log('\n━━━ Ablation Summary ━━━');
  const baseline = rows.find(r => r.name.includes('Baseline'));
  const baselineWr = baseline ? baseline.winRate : 0;
  for (const row of rows) {
    const delta = (row.winRate - baselineWr).toFixed(1);
    const sign = parseFloat(delta) >= 0 ? '+' : '';
    const impact = Math.abs(parseFloat(delta)) < 1 ? '🟡 Negligible'
      : parseFloat(delta) < -5 ? '🔴 Critical mechanic'
      : parseFloat(delta) < 0 ? '🟠 Important'
      : parseFloat(delta) > 5 ? '🟢 Mechanic is a trap (helps to skip)'
      : '⚪ Minor';
    console.log(`  ${row.name.padEnd(40)} ${String(row.winRate + '%').padEnd(8)} ${sign}${delta}pp  ${impact}`);
  }
  console.log('');
}

// Rush test: go straight to boss with starter deck
function runRushTest() {
  const elements = FORCE_ELEMENT ? [FORCE_ELEMENT] : ['fire', 'water', 'earth', 'air'];
  const N = NUM_RUNS;
  let wins = 0, totalHp = 0, total = 0;

  for (const elem of elements) {
    for (let i = 0; i < N; i++) {
      total++;
      gameState = createGameState();
      gameState.mode = GAME_MODES.AI;
      gameState.player = createPlayerState(elem, STARTING_HP);
      gameState.campaign = createCampaignState();
      gameState.phase = GAME_PHASES.MAP;
      travelTo('thornwood_gate');
      gameState._battleLocationId = 'thornwood_gate';
      startNodeBattle('storm_drake', 25);
      const stats = { totalTurns: 0, totalCardsPlayed: 0 };
      simulateBattleTurn(AGENTS.optimal, stats);
      if (gameState.enemy && gameState.enemy.hp <= 0) {
        wins++;
        totalHp += gameState.player.hp;
      }
    }
  }

  console.log(`\nRush boss test (optimal agent, starter deck, ${total} runs):`);
  console.log(`  Win rate: ${wins}/${total} (${(wins/total*100).toFixed(1)}%)`);
  if (wins > 0) console.log(`  Avg HP remaining: ${(totalHp/wins).toFixed(1)}`);
}

// From-location test: run full games, collect states that reach a location, then continue from there
function runFromTest(fromLoc) {
  const elements = FORCE_ELEMENT ? [FORCE_ELEMENT] : ['fire', 'water', 'earth', 'air'];
  const N = NUM_RUNS;
  const agent = AGENTS.optimal;

  // Phase 1: run many games, save states of those that reach fromLoc alive
  const savedStates = [];
  console.log(`\nPhase 1: Running ${N * elements.length} games to collect states at "${fromLoc}"...`);

  for (const elem of elements) {
    for (let i = 0; i < N; i++) {
      const stats = { battlesFought: 0, totalTurns: 0, totalCardsPlayed: 0, error: null };
      gameState = createGameState();
      gameState.mode = GAME_MODES.AI;
      gameState.player = createPlayerState(elem, STARTING_HP);
      gameState.campaign = createCampaignState();
      gameState.phase = GAME_PHASES.MAP;
      _mapVisitCount = {};
      _mapStateKey = '';
      _simVisited = new Set();

      let actions = 0;
      while (actions < 5000) {
        actions++;
        if (gameState.phase === GAME_PHASES.VICTORY || gameState.phase === GAME_PHASES.GAME_OVER) break;

        // Check if we reached the target location
        if (gameState.phase === GAME_PHASES.MAP && gameState.campaign.currentLocation === fromLoc) {
          // Save a deep copy
          savedStates.push(JSON.parse(JSON.stringify(gameState, (k, v) => v instanceof Set ? { __set: [...v] } : v)));
          break;
        }

        if (gameState.phase === GAME_PHASES.MAP) { simulateMapTurn(agent, stats); }
        else if (gameState.phase === GAME_PHASES.BATTLE) { simulateBattleTurn(agent, stats); }
        else if (gameState.phase === GAME_PHASES.CARD_REWARD) {
          const cards = gameState._rewardCards || [];
          if (cards.length > 0) pickRewardCard(agent.pickReward(cards));
          else skipReward();
        }
        else if (gameState.phase === GAME_PHASES.REST) {
          if (!canRest()) { clearLocation(gameState.campaign.currentLocation); returnToMap(); }
          else {
            const hr = gameState.player.hp / gameState.player.maxHp;
            const allC = [...gameState.player.deck, ...gameState.player.discard, ...gameState.player.hand];
            const hasFiller = allC.some(c => c.templateKey === 'stumble' || c.templateKey === 'brace');
            if (hr < 0.5) doRest();
            else if (hasFiller) { gameState._upgradeMode = 'remove'; gameState.phase = GAME_PHASES.CARD_UPGRADE; }
            else if (hr < 0.7) doRest();
            else { gameState._upgradeMode = 'upgrade'; gameState.phase = GAME_PHASES.CARD_UPGRADE; }
          }
        }
        else if (gameState.phase === GAME_PHASES.CARD_UPGRADE) {
          const mode = gameState._upgradeMode || 'upgrade';
          const allC = [...gameState.player.deck, ...gameState.player.discard];
          const cards = mode === 'upgrade' ? allC.filter(c => !c.upgraded) : allC;
          if (cards.length === 0) { advanceAfterNode(); continue; }
          if (mode === 'remove') { let w=0,ws=Infinity; cards.forEach((c,i)=>{const s=c.damage+c.block+c.effects.length*3; if(s<ws){ws=s;w=i;}}); doCardAction(w); }
          else { let b=0,bs=-1; cards.forEach((c,i)=>{const s=c.damage*2+c.block*1.5+c.effects.length*3; if(s>bs){bs=s;b=i;}}); doCardAction(b); }
        }
        else if (gameState.phase === GAME_PHASES.SHOP) { leaveShop(); }
        else if (gameState.phase === GAME_PHASES.NPC) { advanceAfterNode(); }
        else if (gameState.phase === GAME_PHASES.EVENT) {
          const ev = EVENTS[gameState._currentEvent];
          if (ev) doEventChoice(0);
          else advanceAfterNode();
        }
        else break;
      }
    }
  }

  if (savedStates.length === 0) { console.log('  No games reached this location. Aborting.'); return; }
  const avgHp = savedStates.reduce((s, st) => s + st.player.hp, 0) / savedStates.length;
  const avgDeck = savedStates.reduce((s, st) => s + st.player.deck.length + (st.player.hand ? st.player.hand.length : 0) + (st.player.discard ? st.player.discard.length : 0), 0) / savedStates.length;
  console.log(`  Collected ${savedStates.length} states at "${fromLoc}"`);
  console.log(`  Avg HP: ${avgHp.toFixed(1)}/${savedStates[0].player.maxHp}  |  Avg deck: ${avgDeck.toFixed(1)} cards`);

  // Phase 2: continue each saved state through the rest of the game
  let wins = 0, deaths = 0, totalHp = 0;
  const deathLocs = {};

  for (const saved of savedStates) {
    gameState = JSON.parse(JSON.stringify(saved), (k, v) => v && v.__set ? new Set(v.__set) : v);
    _mapVisitCount = {};
    _mapStateKey = '';
    _simVisited = new Set();
    const stats = { battlesFought: 0, totalTurns: 0, totalCardsPlayed: 0, error: null };

    let actions = 0;
    while (actions < 5000) {
      actions++;
      if (gameState.phase === GAME_PHASES.VICTORY) { wins++; totalHp += gameState.player.hp; break; }
      if (gameState.phase === GAME_PHASES.GAME_OVER) {
        deaths++;
        const dLoc = gameState._battleLocationId || 'unknown';
        deathLocs[dLoc] = (deathLocs[dLoc] || 0) + 1;
        break;
      }
      if (gameState.phase === GAME_PHASES.MAP) { simulateMapTurn(agent, stats); }
      else if (gameState.phase === GAME_PHASES.BATTLE) { simulateBattleTurn(agent, stats); }
      else if (gameState.phase === GAME_PHASES.CARD_REWARD) {
        const cards = gameState._rewardCards || [];
        if (cards.length > 0) pickRewardCard(agent.pickReward(cards));
        else skipReward();
      }
      else if (gameState.phase === GAME_PHASES.REST) {
        if (!canRest()) { clearLocation(gameState.campaign.currentLocation); returnToMap(); }
        else { const hr = gameState.player.hp / gameState.player.maxHp; if (hr < 0.5) doRest(); else { gameState._upgradeMode = 'upgrade'; gameState.phase = GAME_PHASES.CARD_UPGRADE; } }
      }
      else if (gameState.phase === GAME_PHASES.CARD_UPGRADE) {
        const mode = gameState._upgradeMode || 'upgrade';
        const allC = [...gameState.player.deck, ...gameState.player.discard];
        const cards = mode === 'upgrade' ? allC.filter(c => !c.upgraded) : allC;
        if (cards.length === 0) { advanceAfterNode(); continue; }
        if (mode === 'remove') { let w=0,ws=Infinity; cards.forEach((c,i)=>{const s=c.damage+c.block+c.effects.length*3; if(s<ws){ws=s;w=i;}}); doCardAction(w); }
        else { let b=0,bs=-1; cards.forEach((c,i)=>{const s=c.damage*2+c.block*1.5+c.effects.length*3; if(s>bs){bs=s;b=i;}}); doCardAction(b); }
      }
      else if (gameState.phase === GAME_PHASES.SHOP) { leaveShop(); }
      else if (gameState.phase === GAME_PHASES.NPC) { advanceAfterNode(); }
      else if (gameState.phase === GAME_PHASES.EVENT) {
        const ev = EVENTS[gameState._currentEvent];
        if (ev) doEventChoice(0);
        else advanceAfterNode();
      }
      else break;
    }
  }

  console.log(`\nPhase 2: Continuing from "${fromLoc}" (${savedStates.length} runs):`);
  console.log(`  Win rate: ${wins}/${savedStates.length} (${(wins/savedStates.length*100).toFixed(1)}%)`);
  console.log(`  Deaths: ${deaths}`);
  if (wins > 0) console.log(`  Avg HP (wins): ${(totalHp/wins).toFixed(1)}`);
  if (Object.keys(deathLocs).length > 0) {
    console.log(`  Deaths by location:`);
    Object.entries(deathLocs).sort((a, b) => b[1] - a[1]).forEach(([loc, count]) => {
      console.log(`    ${loc}: ${count} (${(count/savedStates.length*100).toFixed(1)}%)`);
    });
  }
}

if (args.from) {
  runFromTest(args.from);
} else if (args.rush) {
  runRushTest();
} else if (ABLATION_MODE) {
  runAblations();
} else {
  runSimulations();
}
