// UI rendering and interaction

function renderGame() {
  const app = document.getElementById('app');
  switch (gameState.phase) {
    case GAME_PHASES.MENU:
      app.innerHTML = renderMenu();
      break;
    case GAME_PHASES.ELEMENT_SELECT:
      app.innerHTML = renderElementSelect();
      break;
    case GAME_PHASES.MAP:
      app.innerHTML = renderMap();
      break;
    case GAME_PHASES.BATTLE:
      app.innerHTML = renderBattle();
      break;
    case GAME_PHASES.CARD_REWARD:
      app.innerHTML = renderCardReward();
      break;
    case GAME_PHASES.SHOP:
      app.innerHTML = renderShop();
      break;
    case GAME_PHASES.REST:
      app.innerHTML = renderRest();
      break;
    case GAME_PHASES.NPC:
      app.innerHTML = renderNpc();
      break;
    case GAME_PHASES.EVENT:
      app.innerHTML = renderEvent();
      break;
    case GAME_PHASES.CARD_UPGRADE:
      app.innerHTML = renderCardUpgrade();
      break;
    case GAME_PHASES.PASS_DEVICE:
      app.innerHTML = renderPassDevice();
      break;
    case GAME_PHASES.PVP_RESOLVE:
      app.innerHTML = renderPvpResolve();
      break;
    case GAME_PHASES.GAME_OVER:
      app.innerHTML = renderGameOver();
      break;
    case GAME_PHASES.VICTORY:
      app.innerHTML = renderVictory();
      break;
  }
}

// === MENU ===
function renderMenu() {
  return `
    <div class="screen menu-screen" style="background-image: url('images/menu_bg.png')">
      <div class="menu-overlay">
        <h1 class="game-title">Dragon Cards</h1>
        <p class="game-subtitle">Enter the lair. Master the elements.</p>
        <div class="menu-buttons">
          <button class="btn btn-primary" onclick="startModeSelect('ai')">
            Solo Campaign
          </button>
          <button class="btn btn-secondary" onclick="startModeSelect('pvp')">
            Local Duel
          </button>
        </div>
        <div class="version-bar">
          <span class="version-text">v${GAME_VERSION}</span>
          <button class="version-reload" onclick="hardReload()">↻ Update</button>
          <button class="version-reload" onclick="toggleDevMode()" id="devModeBtn">
            ${MAP_DEBUG ? '🔧 Dev: ON' : '🔧 Dev'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function toggleDevMode() {
  MAP_DEBUG = !MAP_DEBUG;
  renderGame();
}

function hardReload() {
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(name => caches.delete(name)));
  }
  window.location.reload(true);
}

function startModeSelect(mode) {
  gameState.mode = mode;
  gameState.phase = GAME_PHASES.ELEMENT_SELECT;
  gameState._selectingPlayer = 1;
  renderGame();
}

// === ELEMENT SELECT ===
function renderElementSelect() {
  const playerNum = gameState.mode === GAME_MODES.PVP ? `Player ${gameState._selectingPlayer}` : 'Choose Your';
  return `
    <div class="screen element-screen">
      <h2>${playerNum} Element</h2>
      <p class="element-hint">Your deck is forged from this power</p>
      <div class="element-grid">
        ${Object.values(ELEMENTS).map(el => `
          <button class="element-card" style="background-image: url('images/menu_${el}.png')" onclick="selectElement('${el}')">
            <span class="element-name">${el.charAt(0).toUpperCase() + el.slice(1)}</span>
            <span class="element-desc">${getElementDescription(el)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function getElementDescription(el) {
  const descs = {
    [ELEMENTS.FIRE]: 'High damage & burn',
    [ELEMENTS.WATER]: 'Healing & defense',
    [ELEMENTS.EARTH]: 'Block & thorns',
    [ELEMENTS.AIR]: 'Card draw & combos',
  };
  return descs[el];
}

function selectElement(element) {
  if (gameState.mode === GAME_MODES.AI) {
    startAIGame(element);
  } else {
    if (gameState._selectingPlayer === 1) {
      gameState._pvpElement1 = element;
      gameState._selectingPlayer = 2;
      renderGame();
    } else {
      startPVPGame(gameState._pvpElement1, element);
    }
  }
}

// === BATTLE ===
function renderBattle() {
  const isPVP = gameState.mode === GAME_MODES.PVP;
  const isPlayerTurn = gameState.currentTurn === 'player';

  const topCombatant = isPlayerTurn ? gameState.enemy : gameState.player;
  const bottomCombatant = isPlayerTurn ? gameState.player : gameState.enemy;
  const actor = getCurrentActor();
  const canAct = isPVP || isPlayerTurn;

  const lastLog = gameState.log.length ? gameState.log[gameState.log.length - 1] : '';

  return `
    <div class="screen battle-screen">
      ${renderEnemyArea(topCombatant)}
      <div class="combat-log">${lastLog ? `<span class="log-entry">${lastLog}</span>` : ''}</div>
      ${renderPlayerBar(bottomCombatant, canAct)}
      ${renderHand(actor, canAct)}
      ${renderBottomBar(actor, canAct)}
    </div>
  `;
}

function getHpClass(percent) {
  if (percent > 60) return 'hp-high';
  if (percent > 30) return 'hp-mid';
  return 'hp-low';
}

function renderCombatantPortrait(image, element, size) {
  const sizeClass = size === 'lg' ? 'portrait-lg' : 'portrait-sm';
  if (image) {
    return `<div class="combatant-portrait ${sizeClass}" style="background-image: url('${image}')"></div>`;
  }
  const bg = element ? ELEMENT_COLORS[element].bg : '#333';
  return `<div class="combatant-portrait ${sizeClass}" style="background: ${bg}">
    <span class="portrait-fallback">${element ? ELEMENT_ICONS[element] : '🐉'}</span>
  </div>`;
}

function renderEnemyArea(e) {
  const hpPercent = (e.hp / e.maxHp) * 100;
  const isAI = gameState.mode === GAME_MODES.AI;

  let label;
  if (isAI) {
    label = e.name || 'Enemy';
  } else {
    label = gameState.currentTurn === 'player' ? 'Player 2' : 'Player 1';
  }

  const intentHtml = isAI && gameState.enemy.nextIntent
    ? `<div class="intent-row">
        <span class="intent-label">Next:</span>
        ${renderIntent(gameState.enemy.nextIntent)}
       </div>`
    : '';

  return `
    <div class="combatant-area enemy-area">
      ${renderCombatantPortrait(e.image, e.element, 'lg')}
      <div class="combatant-stats">
        <div class="combatant-header">
          <span class="combatant-name">${label}</span>
          ${renderStatuses(e)}
          ${e.block > 0 ? `<span class="block-badge">🛡 ${e.block}</span>` : ''}
        </div>
        <div class="hp-row">
          <div class="hp-bar-container">
            <div class="hp-bar ${getHpClass(hpPercent)}" style="width: ${hpPercent}%"></div>
          </div>
          <span class="hp-number">${e.hp}<span class="hp-max">/${e.maxHp}</span></span>
        </div>
        ${intentHtml}
      </div>
    </div>
  `;
}

function renderIntent(intent) {
  switch (intent.type) {
    case INTENT_TYPES.ATTACK:
      return `<span class="intent-badge intent-attack">${INTENT_ICONS[intent.type]} ${intent.damage}</span>`;
    case INTENT_TYPES.HEAVY_ATTACK:
      return `<span class="intent-badge intent-heavy">${INTENT_ICONS[intent.type]} ${intent.damage}</span>`;
    case INTENT_TYPES.DEFEND:
      return `<span class="intent-badge intent-defend">${INTENT_ICONS[intent.type]} ${intent.block || ''}</span>`;
    case INTENT_TYPES.BUFF:
      return `<span class="intent-badge intent-buff">${INTENT_ICONS[intent.type]}</span>`;
    default:
      return '';
  }
}

function renderPlayerBar(p, canAct) {
  const hpPercent = (p.hp / p.maxHp) * 100;
  const playerImage = `images/dragon_${p.element}.png`;

  let label;
  if (gameState.mode === GAME_MODES.AI) {
    label = 'You';
  } else {
    label = gameState.currentTurn === 'player' ? 'Player 1' : 'Player 2';
  }

  const energy = canAct ? getCurrentActor().energy : 0;

  return `
    <div class="combatant-area player-area">
      ${renderCombatantPortrait(playerImage, p.element, 'sm')}
      <div class="combatant-stats">
        <div class="combatant-header">
          <span class="combatant-name">${label}</span>
          ${renderStatuses(p)}
          ${p.block > 0 ? `<span class="block-badge">🛡 ${p.block}</span>` : ''}
        </div>
        <div class="hp-row">
          <div class="hp-bar-container">
            <div class="hp-bar ${getHpClass(hpPercent)}" style="width: ${hpPercent}%"></div>
          </div>
          <span class="hp-number">${p.hp}<span class="hp-max">/${p.maxHp}</span></span>
        </div>
      </div>
      <div class="energy-gems">
        ${renderEnergy(energy)}
      </div>
    </div>
  `;
}

function renderEnergy(energy) {
  let gems = '';
  for (let i = 0; i < MAX_ENERGY; i++) {
    gems += `<span class="energy-gem ${i < energy ? 'gem-filled' : 'gem-empty'}"></span>`;
  }
  for (let i = MAX_ENERGY; i < energy; i++) {
    gems += `<span class="energy-gem gem-filled gem-bonus"></span>`;
  }
  return gems;
}

function renderStatuses(actor) {
  if (!actor.statuses.length) return '';
  return `<div class="statuses">${actor.statuses.map(s => {
    const icons = { burn: '🔥', thorns: '🌿', vulnerable: '💔' };
    return `<span class="status-badge status-${s.type}" title="${s.type}: ${s.value} (${s.duration} turns)">${icons[s.type] || '?'} ${s.value}</span>`;
  }).join('')}</div>`;
}

function renderHand(actor, canAct) {
  if (!actor.hand.length) return '<div class="hand empty-hand">No cards in hand</div>';

  return `
    <div class="hand">
      ${actor.hand.map((card, i) => renderCard(card, i, canAct)).join('')}
    </div>
  `;
}

function renderCardBadges(card) {
  const badges = [];

  // Damage badge
  if (card.damage > 0) {
    badges.push(`<span class="card-badge badge-damage">⚔ ${card.damage}</span>`);
  }

  // Block badge
  if (card.block > 0) {
    badges.push(`<span class="card-badge badge-block">🛡 ${card.block}</span>`);
  }

  // Effect badges
  for (const fx of card.effects) {
    switch (fx.type) {
      case 'burn':
        badges.push(`<span class="card-badge badge-burn">🔥 ${fx.value}<small>${fx.duration}t</small></span>`);
        break;
      case 'heal':
        badges.push(`<span class="card-badge badge-heal">💚 ${fx.value}</span>`);
        break;
      case 'draw':
        badges.push(`<span class="card-badge badge-draw">🃏 ${fx.value}</span>`);
        break;
      case 'gainEnergy':
        badges.push(`<span class="card-badge badge-energy">⚡ ${fx.value}</span>`);
        break;
      case 'thorns':
        badges.push(`<span class="card-badge badge-thorns">🌿 ${fx.value}<small>${fx.duration}t</small></span>`);
        break;
      case 'vulnerable':
        badges.push(`<span class="card-badge badge-vuln">💔 ${fx.duration}t</span>`);
        break;
      case 'cleanse':
        badges.push(`<span class="card-badge badge-cleanse">✨</span>`);
        break;
    }
  }

  return badges.join('');
}

function renderCard(card, index, canAct) {
  const selected = gameState.selectedCardIndex === index;
  const inHand = index >= 0 && canAct;
  const affordable = !inHand || card.cost <= getCurrentActor().energy;
  const elementColor = card.element ? ELEMENT_COLORS[card.element] : { primary: '#6b7280', secondary: '#9ca3af', bg: 'linear-gradient(135deg, #6b7280, #9ca3af)' };

  return `
    <div class="card ${selected ? 'card-selected' : ''} ${!affordable ? 'card-unaffordable' : ''} card-${card.type}"
         onclick="${inHand ? `selectCard(${index})` : ''}">
      <div class="card-art" style="${card.image ? `background-image: url('${card.image}')` : `background: ${elementColor.bg}`}">
        ${card.image ? '' : `<span class="card-art-icon">${card.element ? ELEMENT_ICONS[card.element] : '🐉'}</span>`}
      </div>
      <div class="card-cost">${card.cost}</div>
      <div class="card-info">
        <span class="card-name">${card.name}</span>
        <div class="card-badges">${renderCardBadges(card)}</div>
        <p class="card-description">${card.description}</p>
      </div>
    </div>
  `;
}

function renderBottomBar(actor, canAct) {
  const deckCount = actor.deck ? actor.deck.length : 0;
  const discardCount = actor.discard ? actor.discard.length : 0;
  const battleNum = gameState.mode === GAME_MODES.AI
    ? `<span class="deck-count">${gameState.battleIndex + 1}/3</span>` : '';

  return `
    <div class="bottom-bar">
      <div class="deck-info">
        ${battleNum}
        <span class="deck-count">Deck ${deckCount}</span>
        <span class="discard-count">Discard ${discardCount}</span>
      </div>
      ${canAct ? `<button class="btn-end-turn" onclick="endTurn()">End Turn</button>` : '<div class="waiting">Enemy turn...</div>'}
    </div>
  `;
}

// Log is now rendered inside renderBattlefield()

// === CARD REWARD ===
function renderCardReward() {
  const cards = gameState._rewardCards || [];
  return `
    <div class="screen reward-screen">
      <div class="reward-header">
        <div class="reward-label">Dragon Slain</div>
        <h2>Claim Your Spoils</h2>
        <div class="battle-progress">Battle ${gameState.battleIndex + 1} of 3</div>
      </div>
      <div class="reward-cards">
        ${cards.map((card, i) => `
          <div class="reward-card" onclick="pickRewardCard(${i})">
            ${renderCard(card, -1, false)}
          </div>
        `).join('')}
      </div>
      <button class="btn btn-skip" onclick="skipReward()">Leave it</button>
    </div>
  `;
}

// === PASS DEVICE ===
function renderPassDevice() {
  const nextPlayer = gameState._nextTurn === 'player' ? 'Player 1' : 'Player 2';
  return `
    <div class="screen pass-screen">
      <div class="pass-icon">⚔</div>
      <h2>Pass the device to</h2>
      <h1 class="pass-player">${nextPlayer}</h1>
      <p>Tap when ready to fight</p>
      <button class="btn btn-primary" onclick="confirmPassDevice()">Ready</button>
    </div>
  `;
}

// === PVP RESOLVE ===
function renderPvpResolve() {
  const p1 = gameState.pvpPending.player;
  const p2 = gameState.pvpPending.enemy;

  return `
    <div class="screen resolve-screen">
      <h2 class="resolve-title">Round Resolve</h2>
      <div class="resolve-columns">
        <div class="resolve-col">
          <div class="resolve-col-header">Player 1</div>
          <div class="resolve-stat">${p1.damage > 0 ? `<span class="card-badge badge-damage">⚔ ${p1.damage}</span>` : '<span class="resolve-none">—</span>'}</div>
          ${p1.effects.map(e => `<div class="resolve-stat"><span class="card-badge badge-${e.type}">${describeEffect(e)}</span></div>`).join('')}
        </div>
        <div class="resolve-vs">VS</div>
        <div class="resolve-col">
          <div class="resolve-col-header">Player 2</div>
          <div class="resolve-stat">${p2.damage > 0 ? `<span class="card-badge badge-damage">⚔ ${p2.damage}</span>` : '<span class="resolve-none">—</span>'}</div>
          ${p2.effects.map(e => `<div class="resolve-stat"><span class="card-badge badge-${e.type}">${describeEffect(e)}</span></div>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary" onclick="resolvePvpRound()">Resolve</button>
    </div>
  `;
}

// === GAME OVER ===
function renderGameOver() {
  let msg;
  if (gameState.mode === GAME_MODES.PVP) {
    msg = gameState._winner === 'Draw' ? 'Draw!' : `${gameState._winner} wins`;
  } else {
    msg = 'Defeated';
  }

  return `
    <div class="screen gameover-screen" style="background-image: url('images/defeat.png')">
      <div class="menu-overlay">
        <h1>${msg}</h1>
        <p>Your journey ends at battle ${gameState.battleIndex + 1} of 3</p>
        <button class="btn btn-primary" onclick="returnToMenu()">Return</button>
      </div>
    </div>
  `;
}

// === VICTORY ===
function renderVictory() {
  return `
    <div class="screen victory-screen" style="background-image: url('images/victory.png')">
      <div class="menu-overlay">
        <h1>Victory</h1>
        <p>All three dragons have fallen before you</p>
        <button class="btn btn-primary" onclick="returnToMenu()">Play Again</button>
      </div>
    </div>
  `;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Debug: ?phase=rest or ?phase=upgrade or ?phase=map to jump straight there
  const debugPhase = new URLSearchParams(window.location.search).get('phase');
  if (debugPhase) {
    startAIGame('fire');
    // Fight a couple battles worth of cards to make state realistic
    if (debugPhase === 'upgrade' || debugPhase === 'card_upgrade') {
      gameState._upgradeMode = 'upgrade';
      gameState.phase = GAME_PHASES.CARD_UPGRADE;
    } else if (debugPhase === 'remove') {
      gameState._upgradeMode = 'remove';
      gameState.phase = GAME_PHASES.CARD_UPGRADE;
    } else if (debugPhase === 'rest') {
      gameState.campaign.battlesSinceRest = REST_COOLDOWN_BATTLES;
      gameState.phase = GAME_PHASES.REST;
    } else if (debugPhase === 'shop') {
      gameState.campaign.gold = 50;
      gameState._shopCards = getAvailableShopCards();
      gameState.phase = GAME_PHASES.SHOP;
    }
    renderGame();
    return;
  }
  renderGame();
});
