// Core game state and logic

const GAME_MODES = { AI: 'ai', PVP: 'pvp' };
const GAME_PHASES = {
  MENU: 'menu',
  ELEMENT_SELECT: 'element_select',
  BATTLE: 'battle',
  CARD_REWARD: 'card_reward',
  PASS_DEVICE: 'pass_device',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
};

const MAX_ENERGY = 3;
const DRAW_COUNT = 5;
const STARTING_HP = 60;
const PVP_STARTING_HP = 50;

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
  };
}

let gameState = createGameState();

function startAIGame(element) {
  gameState = createGameState();
  gameState.mode = GAME_MODES.AI;
  gameState.player = createPlayerState(element, STARTING_HP);
  gameState.battleIndex = 0;
  setupAIBattle(gameState.battleIndex);
  gameState.phase = GAME_PHASES.BATTLE;
  startTurn('player');
}

function startPVPGame(element1, element2) {
  gameState = createGameState();
  gameState.mode = GAME_MODES.PVP;
  gameState.player = createPlayerState(element1, PVP_STARTING_HP);
  gameState.enemy = createPVPOpponent(element2);
  gameState.phase = GAME_PHASES.BATTLE;
  gameState.currentTurn = 'player';
  startTurn('player');
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

  // Apply start-of-turn status effects
  applyStartOfTurnStatuses(actor, who);

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

  // Apply damage
  if (card.damage > 0) {
    let dmg = card.damage;

    // Elemental strength bonus
    if (card.element && defender.element && ELEMENT_STRENGTH[card.element] === defender.element) {
      dmg = Math.floor(dmg * 1.5);
      addLog(`Elemental advantage! ${ELEMENT_ICONS[card.element]} > ${ELEMENT_ICONS[defender.element]}`);
    }

    // Vulnerable check
    const vuln = defender.statuses.find(s => s.type === 'vulnerable');
    if (vuln) {
      dmg = Math.floor(dmg * 1.5);
    }

    applyDamage(defender, dmg);
    addLog(`${card.name} deals ${dmg} damage.`);
  }

  // Apply block
  if (card.block > 0) {
    attacker.block += card.block;
    addLog(`${card.name} grants ${card.block} Block.`);
  }

  // Apply effects
  for (const effect of card.effects) {
    applyEffect(effect, attacker, defender);
  }

  // Remove card from hand, add to discard
  actor.hand.splice(index, 1);
  actor.discard.push(card);
  gameState.selectedCardIndex = null;

  // Check for death
  if (defender.hp <= 0) {
    handleDeath();
    return;
  }

  renderGame();
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
    // PVP mode
    if (gameState.currentTurn === 'player') {
      gameState.phase = GAME_PHASES.PASS_DEVICE;
      gameState._nextTurn = 'enemy';
      renderGame();
    } else {
      gameState.phase = GAME_PHASES.PASS_DEVICE;
      gameState._nextTurn = 'player';
      renderGame();
    }
  }
}

function confirmPassDevice() {
  const next = gameState._nextTurn;
  gameState.phase = GAME_PHASES.BATTLE;
  startTurn(next);
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
      if (gameState.battleIndex < 2) {
        // Offer card reward
        gameState.phase = GAME_PHASES.CARD_REWARD;
        gameState._rewardCards = getRewardCards(3);
        renderGame();
      } else {
        gameState.phase = GAME_PHASES.VICTORY;
        renderGame();
      }
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

  // Consolidate all cards back into deck, plus the new reward card
  gameState.player.deck = shuffleArray([
    ...gameState.player.deck,
    ...gameState.player.discard,
    ...gameState.player.hand,
    card,
  ]);
  gameState.player.discard = [];
  gameState.player.hand = [];

  // Next battle
  gameState.battleIndex++;
  setupAIBattle(gameState.battleIndex);
  gameState.phase = GAME_PHASES.BATTLE;
  startTurn('player');
}

function skipReward() {
  // Consolidate all cards back into deck
  gameState.player.deck = shuffleArray([
    ...gameState.player.deck,
    ...gameState.player.discard,
    ...gameState.player.hand,
  ]);
  gameState.player.discard = [];
  gameState.player.hand = [];

  // Next battle
  gameState.battleIndex++;
  setupAIBattle(gameState.battleIndex);
  gameState.phase = GAME_PHASES.BATTLE;
  startTurn('player');
}

function addLog(msg) {
  gameState.log.push(msg);
  if (gameState.log.length > 50) gameState.log.shift();
}

function returnToMenu() {
  gameState = createGameState();
  renderGame();
}
