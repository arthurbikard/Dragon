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
const AGENT_FILTER = args.agent || 'all';
const FORCE_ELEMENT = args.element || null;
const VERBOSE = !!args.verbose;
const JSON_OUTPUT = !!args.json;

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
      // Buy best value
      let best = affordable[0];
      affordable.forEach(i => { if (i.card.damage > best.card.damage) best = i; });
      return items.indexOf(best);
    },
    shouldRest(player) {
      return player.hp < player.maxHp * 0.5;
    },
  },
};

// === Headless Simulation Engine ===

/**
 * Simulates a single complete campaign run.
 * Returns detailed stats about the run.
 */
function simulateGame(agent, element) {
  const stats = {
    agent: agent.name,
    element,
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

  try {
    // Init game
    gameState = createGameState();
    gameState.mode = GAME_MODES.AI;
    gameState.player = createPlayerState(element, STARTING_HP);
    gameState.campaign = createCampaignState();
    gameState.phase = GAME_PHASES.MAP;

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
        simulateBattleTurn(agent, stats);
        continue;
      }

      if (gameState.phase === GAME_PHASES.CARD_REWARD) {
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
        const items = gameState._shopCards || [];
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
        if (agent.shouldRest(gameState.player)) {
          doRest();
        } else {
          returnToMap();
        }
        continue;
      }

      if (gameState.phase === GAME_PHASES.NPC) {
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
function simulateMapTurn(agent, stats) {
  const campaign = gameState.campaign;
  const currentId = campaign.currentLocation;
  const currentLoc = LOCATIONS[currentId];

  // If current location has things to do, do them
  if (currentLoc.type === LOCATION_TYPES.BATTLE || currentLoc.type === LOCATION_TYPES.BOSS) {
    if (!campaign.locationStates[currentId].cleared) {
      startLocationBattle(currentId);
      stats.battlesFought++;
      return;
    }
  }

  if (currentLoc.features && currentLoc.features.includes('npc')) {
    const quests = getAvailableQuestsAtLocation(currentId);
    const actionable = quests.filter(q => q.action === 'offer' || q.action === 'turnin');
    if (actionable.length > 0) {
      openNpc(currentId);
      return;
    }
  }

  if (currentLoc.features && currentLoc.features.includes('rest') && agent.shouldRest(gameState.player)) {
    openRest();
    return;
  }

  if (currentLoc.features && currentLoc.features.includes('shop')) {
    const items = getAvailableShopCards();
    if (agent.pickShopCard(items.map((i, idx) => ({ ...i, idx })), campaign.gold) >= 0) {
      openShop();
      return;
    }
  }

  if (currentLoc.event && !campaign.locationStates[currentId].cleared) {
    openEvent(currentLoc.event);
    return;
  }

  if (currentLoc.type === LOCATION_TYPES.TREASURE && !campaign.locationStates[currentId].cleared) {
    openTreasure(currentId);
    return;
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

  if (agent.pickMapAction() === 'progress') {
    // Prefer uncleared locations, then unvisited
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
  const agentNames = AGENT_FILTER === 'all' ? Object.keys(AGENTS) : [AGENT_FILTER];

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
        const result = simulateGame(agent, element);
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

runSimulations();
