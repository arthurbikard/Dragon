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
global.document = { addEventListener: () => {}, querySelector: () => null, getElementById: () => ({ innerHTML: '' }) };
global.window = { addEventListener: () => {}, location: { reload: () => {} } };
global.setTimeout = (fn) => fn(); // execute immediately
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.GAME_VERSION = '0.0.0';

// Stub renderGame so UI code doesn't crash
global.renderGame = () => {};

// === Load game source files in order ===
// Use vm.runInThisContext so top-level const/let become globals
const vm = require('vm');
const SRC_DIR = path.join(__dirname, 'js');
const GAME_FILES = ['cards.js', 'ai.js', 'map.js', 'quests.js', 'game.js'];
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
  no_crystal:    { name: 'No Crystal Cave', apply() {
    LOCATIONS.crystal_cave.requires = '__impossible__';
  }},
  direct_path:   { name: 'Direct path only (no side content)', apply() { /* handled in map */ } },
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
   * Optimal agent: considers enemy intent, energy efficiency
   */
  optimal: {
    name: 'Optimal',
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
    pickMapAction() { return 'progress'; },
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
      // Take risky choice only if HP is high enough
      const hpRatio = gameState.player.hp / gameState.player.maxHp;
      const rewarded = choices.findIndex(c => c.reward);
      if (rewarded >= 0 && choices[rewarded].cost) {
        const hpCost = choices[rewarded].cost.hp || 0;
        if (hpCost > 0 && hpRatio < 0.5) return choices.length - 1; // decline if low HP
      }
      return rewarded >= 0 ? rewarded : 0;
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
      // Check if next reachable battle is hard
      if (gameState.campaign) {
        const currentId = gameState.campaign.currentLocation;
        const loc = LOCATIONS[currentId];
        const nextBattles = loc.connections.filter(id => {
          const l = LOCATIONS[id];
          return l && (l.type === LOCATION_TYPES.BATTLE || l.type === LOCATION_TYPES.BOSS) &&
            !gameState.campaign.locationStates[id].cleared;
        });
        if (nextBattles.some(id => LOCATIONS[id].type === LOCATION_TYPES.BOSS) && hpRatio < 0.8) return true;
        if (nextBattles.length > 0 && hpRatio < 0.65) return true;
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

// === Headless Simulation Engine ===

/**
 * Simulates a single complete campaign run.
 * Returns detailed stats about the run.
 */
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
  };

  const MAX_ACTIONS = 2000; // safety limit
  const abl = ablation ? ablation.name : null;

  try {
    // Init game
    gameState = createGameState();
    gameState.mode = GAME_MODES.AI;
    gameState.player = createPlayerState(element, STARTING_HP);
    gameState.campaign = createCampaignState();
    gameState.phase = GAME_PHASES.MAP;
    _mapVisitCount = {};
    _mapStateKey = '';

    // Apply ablation
    _activeAblation = ablation ? ablation.name : null;
    if (ablation && ablation.apply) ablation.apply();

    let actions = 0;

    while (actions < MAX_ACTIONS) {
      actions++;
      stats.totalActions = actions;

      if (gameState.phase === GAME_PHASES.VICTORY) {
        stats.won = true;
        stats.finalHp = gameState.player.hp;
        break;
      }

      if (gameState.phase === GAME_PHASES.GAME_OVER) {
        stats.diedAt = gameState._battleLocationId || 'unknown';
        stats.finalHp = 0;
        break;
      }

      if (gameState.phase === GAME_PHASES.MAP) {
        simulateMapTurn(agent, stats);
        continue;
      }

      if (gameState.phase === GAME_PHASES.BATTLE) {
        // Double enemy HP ablation
        if (abl === 'Double enemy HP' && gameState.enemy && !gameState.enemy._doubled) {
          gameState.enemy.hp *= 2;
          gameState.enemy.maxHp *= 2;
          gameState.enemy._doubled = true;
        }
        simulateBattleTurn(agent, stats);
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
            pickRewardCard(pick);
          } else {
            skipReward();
          }
        } else {
          skipReward();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.SHOP) {
        if (abl === 'No gold (shop disabled)') { returnToMap(); continue; }
        const items = gameState._shopCards || [];
        // Expert: consider card removal first
        if (agent.shouldRemoveCard && agent.shouldRemoveCard(gameState.player.deck, gameState.campaign.gold)) {
          openCardRemove();
          continue;
        }
        const pick = agent.pickShopCard(items, gameState.campaign.gold);
        if (pick >= 0) {
          const before = gameState.campaign.gold;
          buyCard(pick);
          stats.goldSpent += before - gameState.campaign.gold;
        } else {
          returnToMap();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.REST) {
        if (abl === 'No resting') { returnToMap(); continue; }
        if (agent.shouldRest(gameState.player)) {
          doRest();
        } else {
          returnToMap();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.NPC) {
        if (abl === 'No NPCs/quests') { returnToMap(); continue; }
        const quests = gameState._npcQuests || [];
        const qi = gameState._npcQuestIndex || 0;
        if (qi >= quests.length) {
          returnToMap();
          continue;
        }
        const current = quests[qi];
        if (current.action === 'offer') {
          doAcceptQuest(current.questId);
        } else if (current.action === 'turnin') {
          doTurnInQuest(current.questId);
          stats.questsCompleted++;
        } else {
          nextNpc();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.EVENT) {
        if (abl === 'No events') { returnToMap(); continue; }
        const eventId = gameState._currentEvent;
        const event = EVENTS[eventId];
        if (event) {
          const choice = agent.pickEventChoice(event.choices);
          doEventChoice(choice);
        } else {
          returnToMap();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.CARD_UPGRADE) {
        // Just pick first card or cancel
        if (gameState.player.deck.length > 0) {
          doCardAction(0);
        } else {
          returnToMap();
        }
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
    stats.itemsCollected = gameState.campaign ? gameState.campaign.inventory.length : 0;
    stats.locationsVisited = gameState.campaign
      ? Object.values(gameState.campaign.locationStates).filter(s => s.visited).length
      : 0;

  } catch (e) {
    stats.error = `${e.message} (at action ${stats.totalActions})`;
  }

  return stats;
}

/**
 * Simulate one map navigation step
 */
// Track what we've done to prevent infinite loops
let _mapVisitCount = {};
let _mapStateKey = '';
let _activeAblation = null;

function simulateMapTurn(agent, stats) {
  const abl = _activeAblation;
  const campaign = gameState.campaign;
  const currentId = campaign.currentLocation;
  const currentLoc = LOCATIONS[currentId];

  // Track visits; reset when game state changes (new items/clears open new routes)
  const stateKey = campaign.inventory.length + '-' + Object.values(campaign.locationStates).filter(s => s.cleared).length;
  if (_mapStateKey !== stateKey) {
    _mapVisitCount = {};
    _mapStateKey = stateKey;
  }
  _mapVisitCount[currentId] = (_mapVisitCount[currentId] || 0) + 1;
  const visitCount = _mapVisitCount[currentId];

  // If we've been here too many times, just navigate away
  if (visitCount > 3) {
    // Force navigation, skip all features
  } else {
    // If current location has things to do, do them
    if ((currentLoc.type === LOCATION_TYPES.BATTLE || currentLoc.type === LOCATION_TYPES.BOSS) &&
        !campaign.locationStates[currentId].cleared) {
      startLocationBattle(currentId);
      stats.battlesFought++;
      return;
    }

    if (abl !== 'No NPCs/quests' && abl !== 'Direct path only (no side content)' &&
        currentLoc.features && currentLoc.features.includes('npc') && visitCount <= 1) {
      const quests = getAvailableQuestsAtLocation(currentId);
      const actionable = quests.filter(q => q.action === 'offer' || q.action === 'turnin');
      if (actionable.length > 0) {
        openNpc(currentId);
        return;
      }
    }

    if (abl !== 'No resting' && abl !== 'Direct path only (no side content)' &&
        currentLoc.features && currentLoc.features.includes('rest') && visitCount <= 1 &&
        agent.shouldRest(gameState.player)) {
      openRest();
      return;
    }

    if (abl !== 'No gold (shop disabled)' && abl !== 'Direct path only (no side content)' &&
        currentLoc.features && currentLoc.features.includes('shop') && visitCount <= 1) {
      const items = getAvailableShopCards();
      if (agent.pickShopCard(items.map((i, idx) => ({ ...i, idx })), campaign.gold) >= 0) {
        openShop();
        return;
      }
    }

    if (abl !== 'No events' && abl !== 'Direct path only (no side content)' &&
        currentLoc.event && !campaign.locationStates[currentId].cleared && visitCount <= 1) {
      openEvent(currentLoc.event);
      return;
    }

    if (currentLoc.type === LOCATION_TYPES.TREASURE && !campaign.locationStates[currentId].cleared) {
      openTreasure(currentId);
      return;
    }
  }

  // Navigate to next location
  const connections = currentLoc.connections.filter(id => {
    const loc = LOCATIONS[id];
    if (!loc || loc.hidden) return false;
    return canAccessLocation(id);
  });

  if (connections.length === 0) {
    // Stuck — try to go back
    const allConnected = currentLoc.connections.filter(id => {
      const s = campaign.locationStates[id];
      return s && s.unlocked;
    });
    if (allConnected.length > 0) {
      travelTo(allConnected[Math.floor(Math.random() * allConnected.length)]);
    } else {
      stats.error = `Stuck at ${currentId} with no accessible connections`;
    }
    return;
  }

  const mapMode = agent.pickMapAction();

  if (mapMode === 'smart') {
    // Expert: prioritize by strategic value
    const hpRatio = gameState.player.hp / gameState.player.maxHp;

    // If low HP, go to rest locations first
    if (hpRatio < 0.5) {
      const restLocs = connections.filter(id => {
        const l = LOCATIONS[id];
        return l && l.features && l.features.includes('rest');
      });
      if (restLocs.length > 0) { travelTo(restLocs[0]); return; }
    }

    // Prioritize: quest turn-ins > uncleared non-boss battles > NPCs > boss
    const scored = connections.map(id => {
      const l = LOCATIONS[id];
      const s = campaign.locationStates[id];
      let score = 0;

      // Quest NPCs with turn-ins are high priority
      if (l.features && l.features.includes('npc')) {
        const quests = getAvailableQuestsAtLocation(id);
        if (quests.some(q => q.action === 'turnin')) score += 100;
        if (quests.some(q => q.action === 'offer')) score += 20;
      }

      // Uncleared battles
      if (!s.cleared && (l.type === LOCATION_TYPES.BATTLE)) score += 50;

      // Treasure
      if (!s.cleared && l.type === LOCATION_TYPES.TREASURE) score += 60;

      // Events
      if (!s.cleared && l.event) score += 15;

      // Hub with shop (if we have gold)
      if (l.features && l.features.includes('shop') && campaign.gold >= 10) score += 10;

      // Boss only when ready (high HP, have items)
      if (l.type === LOCATION_TYPES.BOSS && !s.cleared) {
        if (hpRatio > 0.7) score += 40;
        else score += 5; // avoid boss when weak
      }

      // Unvisited locations get a small bonus
      if (!s.visited) score += 8;

      // Cleared locations: only worth visiting as a waypoint
      if (s.cleared && s.visited) score -= 50;

      return { id, score };
    });

    scored.sort((a, b) => b.score - a.score);
    travelTo(scored[0].id);
  } else if (mapMode === 'progress') {
    // Simple forward progress
    const uncleared = connections.filter(id => !campaign.locationStates[id].cleared);
    const unvisited = connections.filter(id => !campaign.locationStates[id].visited);
    const target = unvisited.length > 0 ? unvisited[0]
      : uncleared.length > 0 ? uncleared[0]
      : connections[Math.floor(Math.random() * connections.length)];
    travelTo(target);
  } else {
    // Random
    travelTo(connections[Math.floor(Math.random() * connections.length)]);
  }
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
        const actor = gameState.player;
        const opponent = gameState.enemy;
        const card = agent.pickCard(actor.hand, actor.energy, actor, opponent);
        if (!card) break;

        const index = actor.hand.indexOf(card);
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
  const defaultAgents = ['random', 'greedy', 'optimal'];
  const agentNames = AGENT_FILTER === 'all' ? Object.keys(AGENTS)
    : AGENT_FILTER === 'default' ? defaultAgents
    : [AGENT_FILTER];

  console.log(`\n🐉 Dragon Cards Simulator`);
  console.log(`   Runs: ${NUM_RUNS} per agent × ${elements.length} elements`);
  console.log(`   Agents: ${agentNames.join(', ')}\n`);

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
      assessment = winRate < 5 ? '✅ Good (hard enough)' : winRate < 15 ? '⚠️ Slightly easy' : '❌ Too easy';
    } else if (agentName === 'greedy') {
      assessment = winRate < 10 ? '❌ Too hard' : winRate < 50 ? '✅ Good balance' : '⚠️ Slightly easy';
    } else if (agentName === 'optimal') {
      assessment = winRate < 30 ? '❌ Too hard' : winRate < 80 ? '✅ Good balance' : '⚠️ Slightly easy';
    } else if (agentName === 'expert') {
      assessment = winRate < 40 ? '❌ Too hard' : winRate < 85 ? '✅ Good balance' : '⚠️ Slightly easy';
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

if (ABLATION_MODE) {
  runAblations();
} else {
  runSimulations();
}
