// Core game state and logic

// Dev mode flag — toggled from menu, used by map-ui.js
var MAP_DEBUG = false;

const GAME_MODES = { AI: 'ai', PVP: 'pvp' };
const GAME_PHASES = {
  MENU: 'menu',
  ELEMENT_SELECT: 'element_select',
  MAP: 'map',
  BATTLE: 'battle',
  CARD_REWARD: 'card_reward',
  SHOP: 'shop',
  REST: 'rest',
  NPC: 'npc',
  EVENT: 'event',
  CARD_UPGRADE: 'card_upgrade',
  PASS_DEVICE: 'pass_device',
  PVP_RESOLVE: 'pvp_resolve',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
};

const MAX_ENERGY = 3;
const DRAW_COUNT = 4;
const STARTING_HP = 55;
const PVP_STARTING_HP = 45;

function createPlayerState(element, hp) {
  const deck = shuffleArray(createDeck(element));
  return {
    element,
    hp,
    maxHp: hp,
    block: 0,
    energy: MAX_ENERGY,
    deck,
    hand: [],
    discard: [],
    statuses: [], // { type, value, duration }
  };
}

function createGameState() {
  return {
    mode: null,
    phase: GAME_PHASES.MENU,
    player: null,
    enemy: null,          // AI enemy or player 2
    currentTurn: 'player', // 'player' or 'enemy'
    battleIndex: 0,       // which fight (0-2) in AI mode
    selectedCardIndex: null,
    animating: false,
    log: [],
    // PVP simultaneous resolution
    pvpPending: {
      player: { damage: 0, effects: [] },  // queued offensive actions by player 1
      enemy: { damage: 0, effects: [] },   // queued offensive actions by player 2
    },
    pvpRoundLog: { player: [], enemy: [] }, // log messages per player for resolution screen
  };
}

let gameState = createGameState();

function startAIGame(element) {
  gameState = createGameState();
  gameState.mode = GAME_MODES.AI;
  gameState.player = createPlayerState(element, STARTING_HP);
  gameState.campaign = createCampaignState();
  gameState.phase = GAME_PHASES.MAP;
  renderGame();
  requestAnimationFrame(() => {
    renderWorldPaths();
    scrollToCurrentLocation();
    initDragListeners();
  });
}

function startNodeBattle(enemyId, goldReward) {
  // _battleLocationId is already set by enterLocation() in map-ui.js
  gameState._battleGoldReward = goldReward || 0;
  gameState._battleIsElite = false;
  setupAIBattleByEnemy(enemyId);
  prepareBattle();
}

function startEliteBattle(enemyId, goldReward) {
  // _battleLocationId is already set by enterLocation() in map-ui.js
  gameState._battleGoldReward = goldReward || 0;
  gameState._battleIsElite = true;
  setupAIBattleByEnemy(enemyId);
  prepareBattle();
}

function prepareBattle() {
  gameState.phase = GAME_PHASES.BATTLE;
  gameState.player.deck = shuffleArray([
    ...gameState.player.deck,
    ...gameState.player.discard,
    ...gameState.player.hand,
  ]);
  gameState.player.discard = [];
  gameState.player.hand = [];
  gameState.player.block = 0;
  gameState.player.statuses = [];
  startTurn('player');
}

function setupAIBattleByEnemy(enemyId) {
  const enemy = createAIEnemy(enemyId);
  gameState.enemy = enemy;
  gameState.enemy.nextIntent = pickIntent(enemy);
}

function returnToMap() {
  gameState.phase = GAME_PHASES.MAP;
  gameState.selectedCardIndex = null;
  // Consolidate all cards back into deck (hand may have leftovers from battle)
  if (gameState.player) {
    gameState.player.deck = [
      ...gameState.player.deck,
      ...gameState.player.hand,
      ...gameState.player.discard,
    ];
    gameState.player.hand = [];
    gameState.player.discard = [];
  }
  renderGame();
  requestAnimationFrame(() => {
    renderWorldPaths();
    scrollToCurrentLocation();
    initDragListeners();
  });
}

function startPVPGame(element1, element2) {
  gameState = createGameState();
  gameState.mode = GAME_MODES.PVP;
  gameState.player = createPlayerState(element1, PVP_STARTING_HP);
  gameState.enemy = createPVPOpponent(element2);
  gameState.phase = GAME_PHASES.BATTLE;
  gameState.currentTurn = 'player';
  resetPvpPending();
  startTurn('player');
}

function resetPvpPending() {
  gameState.pvpPending = {
    player: { damage: 0, effects: [] },
    enemy: { damage: 0, effects: [] },
  };
  gameState.pvpRoundLog = { player: [], enemy: [] };
}

function createPVPOpponent(element) {
  return createPlayerState(element, PVP_STARTING_HP);
}

function setupAIBattle(index) {
  const enemy = createAIEnemy(index);
  gameState.enemy = enemy;
  gameState.enemy.nextIntent = pickIntent(enemy);
}

function startTurn(who) {
  const actor = who === 'player' ? gameState.player : gameState.enemy;
  actor.block = 0;
  actor.energy = MAX_ENERGY;

  // In AI mode, apply statuses at start of each turn
  // In PVP, statuses are applied during resolution phase
  if (gameState.mode === GAME_MODES.AI) {
    applyStartOfTurnStatuses(actor, who);
  }

  // Draw cards
  drawCards(actor, DRAW_COUNT);

  gameState.currentTurn = who;
  gameState.selectedCardIndex = null;

  // In AI mode, if it's enemy turn, execute AI
  if (gameState.mode === GAME_MODES.AI && who === 'enemy') {
    executeAITurn();
  }

  renderGame();
}

function drawCards(actor, count) {
  for (let i = 0; i < count; i++) {
    if (actor.deck.length === 0) {
      if (actor.discard.length === 0) return;
      actor.deck = shuffleArray(actor.discard);
      actor.discard = [];
      addLog('Deck reshuffled.');
    }
    actor.hand.push(actor.deck.pop());
  }
}

function selectCard(index) {
  if (gameState.animating) return;
  const actor = getCurrentActor();
  const card = actor.hand[index];
  if (!card) return;

  if (gameState.selectedCardIndex === index) {
    // Tap again = play the card
    playCard(index);
  } else {
    // Update selection without full re-render to avoid blink
    const prevIndex = gameState.selectedCardIndex;
    gameState.selectedCardIndex = index;

    const hand = document.querySelector('.hand');
    if (hand) {
      const cards = hand.querySelectorAll('.card');
      if (prevIndex !== null && cards[prevIndex]) {
        cards[prevIndex].classList.remove('card-selected');
      }
      if (cards[index]) {
        cards[index].classList.add('card-selected');
      }
    } else {
      renderGame();
    }
  }
}

function playCard(index) {
  const actor = getCurrentActor();
  const card = actor.hand[index];
  if (!card || card.cost > actor.energy) return;

  actor.energy -= card.cost;

  const attacker = actor;
  const defender = getOpponent();
  const isPVP = gameState.mode === GAME_MODES.PVP;
  const who = gameState.currentTurn;

  // Calculate damage
  if (card.damage > 0) {
    let dmg = card.damage;

    if (card.element && defender.element && ELEMENT_STRENGTH[card.element] === defender.element) {
      dmg = Math.floor(dmg * 1.5);
      addLog(`Elemental advantage! ${ELEMENT_ICONS[card.element]} > ${ELEMENT_ICONS[defender.element]}`);
    }

    // Weak reduces YOUR attack damage
    const weak = attacker.statuses ? attacker.statuses.find(s => s.type === 'weak') : null;
    if (weak) dmg = Math.floor(dmg * 0.75);

    // Vulnerable only checked at resolution for PVP, immediately for AI
    if (!isPVP) {
      const vuln = defender.statuses.find(s => s.type === 'vulnerable');
      if (vuln) dmg = Math.floor(dmg * 1.5);
    }

    if (isPVP) {
      gameState.pvpPending[who].damage += dmg;
      gameState.pvpRoundLog[who].push(`${card.name} queues ${dmg} damage.`);
      addLog(`${card.name} → ${dmg} damage (pending)`);
    } else {
      applyDamage(defender, dmg);
      addLog(`${card.name} deals ${dmg} damage.`);
    }
  }

  // Block always applies immediately (self-targeting)
  if (card.block > 0) {
    attacker.block += card.block;
    addLog(`${card.name} grants ${card.block} Block.`);
  }

  // Apply effects — split by offensive vs self-targeting
  for (const effect of card.effects) {
    if (isPVP && isOffensiveEffect(effect)) {
      gameState.pvpPending[who].effects.push({ ...effect });
      const desc = describeEffect(effect);
      gameState.pvpRoundLog[who].push(`${card.name} queues ${desc}.`);
      addLog(`${card.name} → ${desc} (pending)`);
    } else {
      applyEffect(effect, attacker, defender);
    }
  }

  // Remove card from hand, add to discard
  actor.hand.splice(index, 1);
  actor.discard.push(card);
  gameState.selectedCardIndex = null;

  // In AI mode, check for death immediately
  if (!isPVP && defender.hp <= 0) {
    handleDeath();
    return;
  }

  renderGame();
}

function isOffensiveEffect(effect) {
  return ['burn', 'vulnerable', 'weak'].includes(effect.type);
}

function describeEffect(effect) {
  switch (effect.type) {
    case 'burn': return `${effect.value} Burn (${effect.duration}t)`;
    case 'vulnerable': return `Vulnerable (${effect.duration}t)`;
    default: return effect.type;
  }
}

function applyDamage(target, amount) {
  let remaining = amount;
  if (target.block > 0) {
    if (target.block >= remaining) {
      target.block -= remaining;
      remaining = 0;
    } else {
      remaining -= target.block;
      target.block = 0;
    }
  }
  target.hp = Math.max(0, target.hp - remaining);

  // Thorns
  const thorns = target.statuses.find(s => s.type === 'thorns');
  if (thorns && remaining < amount) {
    // Only trigger thorns if actually attacked (not just block)
  }
  if (thorns && amount > 0) {
    const attacker = target === gameState.player ? gameState.enemy : gameState.player;
    const thornDmg = thorns.value;
    attacker.hp = Math.max(0, attacker.hp - thornDmg);
    addLog(`Thorns deal ${thornDmg} damage back!`);
  }
}

function applyEffect(effect, caster, target) {
  switch (effect.type) {
    case 'burn': {
      const existing = target.statuses.find(s => s.type === 'burn');
      if (existing) {
        existing.value += effect.value;
        existing.duration = Math.max(existing.duration, effect.duration);
      } else {
        target.statuses.push({ type: 'burn', value: effect.value, duration: effect.duration });
      }
      addLog(`Applied ${effect.value} Burn for ${effect.duration} turns.`);
      break;
    }
    case 'heal': {
      const healed = Math.min(effect.value, caster.maxHp - caster.hp);
      caster.hp += healed;
      addLog(`Healed ${healed} HP.`);
      break;
    }
    case 'draw': {
      drawCards(caster, effect.value);
      addLog(`Drew ${effect.value} card(s).`);
      break;
    }
    case 'gainEnergy': {
      caster.energy += effect.value;
      addLog(`Gained ${effect.value} Energy.`);
      break;
    }
    case 'thorns': {
      const existing = caster.statuses.find(s => s.type === 'thorns');
      if (existing) {
        existing.value += effect.value;
        existing.duration = Math.max(existing.duration, effect.duration);
      } else {
        caster.statuses.push({ type: 'thorns', value: effect.value, duration: effect.duration });
      }
      addLog(`Gained ${effect.value} Thorns for ${effect.duration} turns.`);
      break;
    }
    case 'vulnerable': {
      const existing = target.statuses.find(s => s.type === 'vulnerable');
      if (existing) {
        existing.duration += effect.duration;
      } else {
        target.statuses.push({ type: 'vulnerable', value: effect.value, duration: effect.duration });
      }
      addLog(`Applied Vulnerable for ${effect.duration} turns.`);
      break;
    }
    case 'weak': {
      const existing = target.statuses.find(s => s.type === 'weak');
      if (existing) {
        existing.duration += effect.duration;
      } else {
        target.statuses.push({ type: 'weak', value: effect.value || 1, duration: effect.duration });
      }
      addLog(`Applied Weak for ${effect.duration} turns.`);
      break;
    }
    case 'cleanse': {
      target.statuses = target.statuses.filter(s => ['thorns'].includes(s.type));
      addLog('Debuffs cleansed!');
      break;
    }
  }
}

function applyStartOfTurnStatuses(actor, who) {
  const toRemove = [];
  for (const status of actor.statuses) {
    if (status.type === 'burn') {
      actor.hp = Math.max(0, actor.hp - status.value);
      addLog(`Burn deals ${status.value} damage.`);
    }
    status.duration--;
    if (status.duration <= 0) {
      toRemove.push(status);
    }
  }
  actor.statuses = actor.statuses.filter(s => !toRemove.includes(s));

  if (actor.hp <= 0) {
    handleDeath();
  }
}

function endTurn() {
  if (gameState.animating) return;
  const actor = getCurrentActor();

  // Discard hand
  actor.discard.push(...actor.hand);
  actor.hand = [];
  gameState.selectedCardIndex = null;

  if (gameState.mode === GAME_MODES.AI) {
    if (gameState.currentTurn === 'player') {
      startTurn('enemy');
    } else {
      // After AI turn, update intent and go back to player
      gameState.enemy.nextIntent = pickIntent(gameState.enemy);
      startTurn('player');
    }
  } else {
    // PVP mode — simultaneous resolution
    if (gameState.currentTurn === 'player') {
      // Player 1 done, pass to player 2
      gameState.phase = GAME_PHASES.PASS_DEVICE;
      gameState._nextTurn = 'enemy';
      renderGame();
    } else {
      // Player 2 done — resolve both turns simultaneously
      gameState.phase = GAME_PHASES.PVP_RESOLVE;
      renderGame();
    }
  }
}

function confirmPassDevice() {
  const next = gameState._nextTurn;
  gameState.phase = GAME_PHASES.BATTLE;
  startTurn(next);
}

function resolvePvpRound() {
  const p1pending = gameState.pvpPending.player;
  const p2pending = gameState.pvpPending.enemy;
  const p1 = gameState.player;
  const p2 = gameState.enemy;
  const resolveLog = [];

  // Apply player 1's offensive effects to player 2
  if (p1pending.damage > 0) {
    let dmg = p1pending.damage;
    const vuln = p2.statuses.find(s => s.type === 'vulnerable');
    if (vuln) dmg = Math.floor(dmg * 1.5);
    applyDamage(p2, dmg);
    resolveLog.push(`Player 1 deals ${dmg} damage to Player 2.`);
  }
  for (const effect of p1pending.effects) {
    applyEffect(effect, p1, p2);
    resolveLog.push(`Player 1 applies ${describeEffect(effect)} to Player 2.`);
  }

  // Apply player 2's offensive effects to player 1
  if (p2pending.damage > 0) {
    let dmg = p2pending.damage;
    const vuln = p1.statuses.find(s => s.type === 'vulnerable');
    if (vuln) dmg = Math.floor(dmg * 1.5);
    applyDamage(p1, dmg);
    resolveLog.push(`Player 2 deals ${dmg} damage to Player 1.`);
  }
  for (const effect of p2pending.effects) {
    applyEffect(effect, p2, p1);
    resolveLog.push(`Player 2 applies ${describeEffect(effect)} to Player 1.`);
  }

  // Store resolve log for display
  gameState._resolveLog = resolveLog;

  // Check for death — both can die (draw)
  if (p1.hp <= 0 && p2.hp <= 0) {
    gameState.phase = GAME_PHASES.GAME_OVER;
    gameState._winner = 'Draw';
    renderGame();
    return;
  }
  if (p1.hp <= 0 || p2.hp <= 0) {
    gameState.phase = GAME_PHASES.GAME_OVER;
    gameState._winner = p2.hp <= 0 ? 'Player 1' : 'Player 2';
    renderGame();
    return;
  }

  // Both alive — start new round
  resetPvpPending();
  // Apply burn at start of new round for both players
  applyStartOfTurnStatuses(p1, 'player');
  applyStartOfTurnStatuses(p2, 'enemy');

  // Check again after burn
  if (p1.hp <= 0 || p2.hp <= 0) {
    gameState.phase = GAME_PHASES.GAME_OVER;
    if (p1.hp <= 0 && p2.hp <= 0) {
      gameState._winner = 'Draw';
    } else {
      gameState._winner = p2.hp <= 0 ? 'Player 1' : 'Player 2';
    }
    renderGame();
    return;
  }

  gameState.phase = GAME_PHASES.PASS_DEVICE;
  gameState._nextTurn = 'player';
  renderGame();
}

function startPvpNewRound() {
  gameState.phase = GAME_PHASES.BATTLE;
  startTurn('player');
}

function getCurrentActor() {
  return gameState.currentTurn === 'player' ? gameState.player : gameState.enemy;
}

function getOpponent() {
  return gameState.currentTurn === 'player' ? gameState.enemy : gameState.player;
}

function handleDeath() {
  if (gameState.mode === GAME_MODES.AI) {
    if (gameState.enemy.hp <= 0) {
      // Enemy defeated
      const node = getCurrentMapNode();

      // Mark location cleared
      const locId = gameState._battleLocationId;
      if (locId) clearLocation(locId);

      // Track battles for rest cooldown
      gameState.campaign.battlesSinceRest = (gameState.campaign.battlesSinceRest || 0) + 1;

      // Grant gold
      const goldReward = gameState._battleGoldReward || 0;
      if (goldReward > 0) {
        gameState.campaign.gold += goldReward;
        addLog(`Earned ${goldReward} gold.`);
        if (typeof showNotification === 'function') showNotification(`+${goldReward} gold`, 'gold');
      }

      // Mini-boss: grant blessing
      if (gameState._miniBossBlessing) {
        gameState.campaign.blessings[gameState._miniBossBlessing] = true;
        addLog(`Gained blessing: ${gameState._miniBossBlessing}!`);
        gameState._miniBossBlessing = null;
      }

      // Boss or mini-boss (if no further biomes) = victory
      const loc = locId ? WORLD.locations[locId] : null;
      if (loc && (loc.type === LOC_TYPES.BOSS || loc.type === LOC_TYPES.MINI_BOSS)) {
        gameState.phase = GAME_PHASES.VICTORY;
        renderGame();
        return;
      }

      // Ambush battles: no card reward, just return to map
      if (gameState._isAmbush) {
        gameState._isAmbush = false;
        addLog('You survived the ambush!');
        returnToMap();
        return;
      }

      // Generate rewards based on biome
      const biomeId = loc ? loc.biome : null;

      if (gameState._battleIsElite) {
        gameState._rewardCards = [getRareCard(), getRareCard(), ...getBiomeRewardCards(biomeId, 1)];
        gameState.campaign.gold += 10;
        addLog('Elite defeated! Bonus gold earned.');
      } else {
        gameState._rewardCards = getBiomeRewardCards(biomeId, 3);
      }

      gameState.phase = GAME_PHASES.CARD_REWARD;
      renderGame();
    } else {
      // Player died
      gameState.phase = GAME_PHASES.GAME_OVER;
      renderGame();
    }
  } else {
    // PVP
    gameState.phase = GAME_PHASES.GAME_OVER;
    gameState._winner = gameState.enemy.hp <= 0 ? 'Player 1' : 'Player 2';
    renderGame();
  }
}

function pickRewardCard(index) {
  const card = gameState._rewardCards[index];
  if (!card) return;
  addLog(`Added ${card.name} to deck!`);
  gameState.player.deck.push(card);
  advanceAfterNode();
}

function skipReward() {
  // Skipping gives a small heal as compensation
  const healAmount = Math.min(3, gameState.player.maxHp - gameState.player.hp);
  if (healAmount > 0) {
    gameState.player.hp += healAmount;
    addLog(`Skipped reward. Healed ${healAmount} HP.`);
    if (typeof showNotification === 'function') showNotification(`+${healAmount} HP`, 'heal');
  }
  advanceAfterNode();
}

function advanceAfterNode() {
  returnToMap();
}

function addLog(msg) {
  gameState.log.push(msg);
  if (gameState.log.length > 50) gameState.log.shift();
}

function returnToMenu() {
  gameState = createGameState();
  renderGame();
}
