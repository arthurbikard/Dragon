// World map renderer + location screens (shop, rest, event, NPC)

// === WORLD MAP SCREEN ===

// Dev mode: MAP_DEBUG is declared in game.js (loads before this file)

function renderMap() {
  const campaign = gameState.campaign;
  const currentLoc = WORLD.locations[campaign.currentLocation];
  const biome = currentLoc ? WORLD.biomes[currentLoc.biome] : null;

  return `
    <div class="screen map-screen">
      <div class="map-topbar">
        <span class="map-gold">💰 ${campaign.gold}</span>
        <span class="map-deck">📚 ${gameState.player.deck.length + gameState.player.hand.length + gameState.player.discard.length}</span>
        <span class="map-hp">❤️ ${gameState.player.hp}/${gameState.player.maxHp}</span>
        ${MAP_DEBUG ? '<button class="map-debug-btn" onclick="exportNodePositions()">📋 Export</button>' : ''}
      </div>
      <div class="world-viewport" id="worldViewport">
        <div class="world-canvas" id="worldCanvas">
          <svg class="world-paths" id="worldPaths"></svg>
          ${renderWorldLocations()}
          ${renderPlayerMarker()}
        </div>
      </div>
      ${MAP_DEBUG ? '<div class="map-debug-coords" id="debugCoords">Drag nodes to position them</div>' : ''}
      <div class="map-location-panel">
        ${renderLocationPanel()}
      </div>
    </div>
  `;
}

// === DEBUG: Draggable nodes ===
let _dragTarget = null;
let _dragOffset = { x: 0, y: 0 };
let _didDrag = false;

function initDragListeners() {
  if (!MAP_DEBUG) return;
  const canvas = document.getElementById('worldCanvas');
  const viewport = document.getElementById('worldViewport');
  if (!canvas) return;

  // Remove old listeners by replacing the canvas event handling
  canvas._dragInit = true;

  function getCanvasPos(e) {
    const canvasRect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - canvasRect.left + viewport.scrollLeft,
      y: e.clientY - canvasRect.top + viewport.scrollTop,
    };
  }

  // Use document-level listeners so drag continues even outside the canvas
  canvas.addEventListener('mousedown', (e) => {
    const node = e.target.closest('.world-location');
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    _dragTarget = node;
    _didDrag = false;
    const pos = getCanvasPos(e);
    const nodeLeft = parseFloat(node.style.left) || 0;
    const nodeTop = parseFloat(node.style.top) || 0;
    _dragOffset.x = pos.x - nodeLeft;
    _dragOffset.y = pos.y - nodeTop;
    node.style.zIndex = '100';
    viewport.style.overflow = 'hidden';
  });

  document.addEventListener('mousemove', (e) => {
    if (!_dragTarget) return;
    e.preventDefault();
    _didDrag = true;
    const canvasRect = canvas.getBoundingClientRect();
    const x = e.clientX - canvasRect.left + viewport.scrollLeft - _dragOffset.x;
    const y = e.clientY - canvasRect.top + viewport.scrollTop - _dragOffset.y;

    _dragTarget.style.left = x + 'px';
    _dragTarget.style.top = y + 'px';

    const locId = _dragTarget.dataset.locId;
    const gridX = (x / TILE_SIZE).toFixed(1);
    const gridY = (y / TILE_SIZE).toFixed(1);
    const debugEl = document.getElementById('debugCoords');
    if (debugEl) {
      debugEl.textContent = `${locId}: x=${gridX}, y=${gridY}`;
    }

    // Also update SVG paths live
    renderWorldPaths();
  });

  document.addEventListener('mouseup', () => {
    if (_dragTarget) {
      _dragTarget.style.zIndex = '';
      _dragTarget = null;
      viewport.style.overflow = 'scroll';
    }
  });

  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    const node = e.target.closest('.world-location');
    if (!node) return;
    e.preventDefault();
    _dragTarget = node;
    _didDrag = false;
    const touch = e.touches[0];
    const pos = getCanvasPos(touch);
    const nodeLeft = parseFloat(node.style.left) || 0;
    const nodeTop = parseFloat(node.style.top) || 0;
    _dragOffset.x = pos.x - nodeLeft;
    _dragOffset.y = pos.y - nodeTop;
    node.style.zIndex = '100';
    viewport.style.overflow = 'hidden';
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!_dragTarget) return;
    e.preventDefault();
    _didDrag = true;
    const touch = e.touches[0];
    const canvasRect = canvas.getBoundingClientRect();
    const x = touch.clientX - canvasRect.left + viewport.scrollLeft - _dragOffset.x;
    const y = touch.clientY - canvasRect.top + viewport.scrollTop - _dragOffset.y;

    _dragTarget.style.left = x + 'px';
    _dragTarget.style.top = y + 'px';

    const locId = _dragTarget.dataset.locId;
    const gridX = (x / TILE_SIZE).toFixed(1);
    const gridY = (y / TILE_SIZE).toFixed(1);
    const debugEl = document.getElementById('debugCoords');
    if (debugEl) {
      debugEl.textContent = `${locId}: x=${gridX}, y=${gridY}`;
    }
    renderWorldPaths();
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (_dragTarget) {
      _dragTarget.style.zIndex = '';
      _dragTarget = null;
      viewport.style.overflow = 'scroll';
    }
  });
}

function exportNodePositions() {
  const canvas = document.getElementById('worldCanvas');
  if (!canvas) return;
  const nodes = canvas.querySelectorAll('.world-location');
  const positions = {};

  nodes.forEach(node => {
    const locId = node.dataset.locId;
    const left = parseFloat(node.style.left) || 0;
    const top = parseFloat(node.style.top) || 0;
    positions[locId] = {
      x: parseFloat((left / TILE_SIZE).toFixed(1)),
      y: parseFloat((top / TILE_SIZE).toFixed(1)),
    };
  });

  const text = Object.entries(positions)
    .map(([id, pos]) => `${id}: x=${pos.x}, y=${pos.y}`)
    .join('\n');

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    alert('Positions copied to clipboard!\n\n' + text);
  }).catch(() => {
    alert('Positions:\n\n' + text);
  });
}

function renderWorldLocations() {
  const campaign = gameState.campaign;
  let html = '';

  for (const [id, loc] of Object.entries(WORLD.locations)) {
    const explored = campaign.explored.has(id);
    const visited = campaign.visited.has(id);
    const cleared = campaign.cleared.has(id);
    const isCurrent = campaign.currentLocation === id;
    const canTravel = canTravelTo(id);

    if (!MAP_DEBUG && !explored && !isCurrent) continue; // hidden in fog (debug shows all)

    let stateClass = 'loc-fog';
    if (MAP_DEBUG) stateClass = 'loc-debug';
    else if (isCurrent) stateClass = 'loc-current';
    else if (cleared) stateClass = 'loc-cleared';
    else if (visited) stateClass = 'loc-visited';
    else if (explored) stateClass = 'loc-explored';

    const pos = getLocationPixelPos(loc);
    const icon = LOC_ICONS[loc.type] || '❓';
    const imgStyle = loc.image ? `background-image: url('${loc.image}')` : '';

    html += `
      <div class="world-location ${stateClass} ${canTravel ? 'loc-tappable' : ''}"
           style="left: ${pos.x}px; top: ${pos.y}px"
           data-loc-id="${id}"
           onclick="${canTravel || isCurrent ? `onLocationTap('${id}')` : ''}">
        <div class="loc-node" style="${imgStyle}">
          ${!loc.image ? `<span class="loc-icon">${icon}</span>` : ''}
        </div>
        <span class="loc-name">${MAP_DEBUG || visited || isCurrent ? loc.name : '???'}</span>
      </div>
    `;
  }

  return html;
}

function renderPlayerMarker() {
  const loc = WORLD.locations[gameState.campaign.currentLocation];
  if (!loc) return '';
  const pos = getLocationPixelPos(loc);
  return `<div class="player-marker" style="left: ${pos.x}px; top: ${pos.y}px">▼</div>`;
}

function renderWorldPaths() {
  // Called after DOM render to draw SVG paths
  const svg = document.getElementById('worldPaths');
  if (!svg) return;

  const campaign = gameState.campaign;
  const drawn = new Set();
  let paths = '';

  for (const [id, loc] of Object.entries(WORLD.locations)) {
    if (!MAP_DEBUG && !campaign.explored.has(id)) continue;

    for (const connId of (loc.paths || [])) {
      if (!MAP_DEBUG && !campaign.explored.has(connId)) continue;

      const key = [id, connId].sort().join('-');
      if (drawn.has(key)) continue;
      drawn.add(key);

      const fromPos = getLocationPixelPos(loc);
      const toPos = getLocationPixelPos(WORLD.locations[connId]);
      const biome = WORLD.biomes[loc.biome];
      const pathColor = biome ? biome.palette.path : 'rgba(255,255,255,0.15)';

      paths += `<line
        x1="${fromPos.x + 22}" y1="${fromPos.y + 22}"
        x2="${toPos.x + 22}" y2="${toPos.y + 22}"
        stroke="${pathColor}" stroke-width="2" stroke-linecap="round"
      />`;
    }
  }

  svg.innerHTML = paths;
}

function scrollToCurrentLocation() {
  const viewport = document.getElementById('worldViewport');
  const loc = WORLD.locations[gameState.campaign.currentLocation];
  if (!viewport || !loc) return;

  const pos = getLocationPixelPos(loc);
  const viewW = viewport.clientWidth;
  const viewH = viewport.clientHeight;

  viewport.scrollLeft = Math.max(0, pos.x - viewW / 2 + 22);
  viewport.scrollTop = Math.max(0, pos.y - viewH / 2 + 22);
}

function renderLocationPanel() {
  const locId = gameState.campaign.currentLocation;
  const loc = WORLD.locations[locId];
  if (!loc) return '';

  const cleared = gameState.campaign.cleared.has(locId);
  const biome = WORLD.biomes[loc.biome];

  let actions = '';
  const isCombat = [LOC_TYPES.BATTLE, LOC_TYPES.ELITE, LOC_TYPES.MINI_BOSS, LOC_TYPES.BOSS].includes(loc.type);

  if (!cleared) {
    switch (loc.type) {
      case LOC_TYPES.BATTLE:
      case LOC_TYPES.ELITE:
      case LOC_TYPES.MINI_BOSS:
      case LOC_TYPES.BOSS:
        actions = `<button class="btn btn-primary" onclick="enterLocation()">Fight</button>`;
        if (isCombat) {
          actions += `<span class="panel-blocked">⚠ Must fight to proceed</span>`;
        }
        break;
      case LOC_TYPES.SHOP:
        actions = `<button class="btn btn-primary" onclick="enterLocation()">Enter Shop</button>`;
        break;
      case LOC_TYPES.REST:
        actions = `<button class="btn btn-primary" onclick="enterLocation()">Rest</button>`;
        break;
      case LOC_TYPES.EVENT:
        actions = `<button class="btn btn-primary" onclick="enterLocation()">Explore</button>`;
        break;
      case LOC_TYPES.NPC:
        actions = `<button class="btn btn-primary" onclick="enterLocation()">Talk</button>`;
        if (loc.hasShop) {
          actions += `<button class="btn btn-secondary" onclick="openVillageShop()">Shop</button>`;
        }
        break;
      case LOC_TYPES.TREASURE:
        actions = `<button class="btn btn-primary" onclick="enterLocation()">Open</button>`;
        break;
    }
  } else {
    actions = `<span class="panel-cleared">Cleared ✓</span>`;
    // Shops and rest sites can be revisited
    if (loc.type === LOC_TYPES.SHOP) {
      actions += ` <button class="btn btn-secondary" onclick="enterLocation()">Shop Again</button>`;
    }
    if (loc.type === LOC_TYPES.REST) {
      actions += ` <button class="btn btn-secondary" onclick="enterLocation()">Rest Again</button>`;
    }
    if (loc.type === LOC_TYPES.NPC) {
      actions += ` <button class="btn btn-secondary" onclick="enterLocation()">Talk Again</button>`;
      if (loc.hasShop) {
        actions += ` <button class="btn btn-secondary" onclick="openVillageShop()">Shop</button>`;
      }
    }
  }

  // Show connected locations for travel
  const connections = getConnectedLocations();
  const travelButtons = connections
    .filter(c => canTravelTo(c.id))
    .map(c => {
      const cCleared = gameState.campaign.cleared.has(c.id);
      const icon = LOC_ICONS[c.type] || '?';
      return `<button class="travel-btn ${cCleared ? 'travel-cleared' : ''}" onclick="doTravel('${c.id}')">
        ${icon} ${gameState.campaign.visited.has(c.id) ? c.name : '???'}
      </button>`;
    }).join('');

  return `
    <div class="panel-header">
      <span class="panel-name">${loc.name}</span>
      ${biome ? `<span class="panel-biome">${biome.name}</span>` : ''}
    </div>
    <p class="panel-desc">${loc.description}</p>
    <div class="panel-actions">${actions}</div>
    ${travelButtons ? `<div class="panel-travel"><span class="travel-label">Travel to:</span>${travelButtons}</div>` : ''}
  `;
}

function onLocationTap(locId) {
  // Suppress click if we just finished dragging (debug mode)
  if (MAP_DEBUG && _didDrag) {
    _didDrag = false;
    return;
  }
  if (locId === gameState.campaign.currentLocation) {
    // Already here — no need to re-render
    return;
  }
  doTravel(locId);
}

function doTravel(locId) {
  if (!travelTo(locId)) return;
  renderGame();
  requestAnimationFrame(() => {
    renderWorldPaths();
    scrollToCurrentLocation();
    initDragListeners();
  });
}

function enterLocation() {
  const locId = gameState.campaign.currentLocation;
  const loc = WORLD.locations[locId];
  if (!loc) return;

  switch (loc.type) {
    case LOC_TYPES.BATTLE:
      gameState._battleLocationId = locId;
      startNodeBattle(loc.enemy, loc.goldReward || 0);
      break;
    case LOC_TYPES.ELITE:
      gameState._battleLocationId = locId;
      startEliteBattle(loc.enemy, loc.goldReward || 0);
      break;
    case LOC_TYPES.MINI_BOSS:
      gameState._battleLocationId = locId;
      gameState._miniBossBlessing = loc.blessing;
      startNodeBattle(loc.enemy, loc.goldReward || 0);
      break;
    case LOC_TYPES.BOSS:
      gameState._battleLocationId = locId;
      startNodeBattle(loc.enemy, 0);
      break;
    case LOC_TYPES.REST:
      gameState.phase = GAME_PHASES.REST;
      renderGame();
      break;
    case LOC_TYPES.SHOP:
      gameState._shopCards = getAvailableShopCards();
      gameState.phase = GAME_PHASES.SHOP;
      renderGame();
      break;
    case LOC_TYPES.EVENT:
      gameState._currentEvent = loc.eventKey;
      gameState.phase = GAME_PHASES.EVENT;
      renderGame();
      break;
    case LOC_TYPES.NPC:
      gameState._currentNpc = loc.npc;
      gameState._npcDialogueIndex = 0;
      gameState.phase = GAME_PHASES.NPC;
      renderGame();
      break;
    case LOC_TYPES.TREASURE:
      openTreasure(locId);
      break;
  }
}

// === REST SCREEN ===

function renderRest() {
  const healAmount = Math.min(Math.floor(gameState.player.maxHp * 0.3), gameState.player.maxHp - gameState.player.hp);
  return `
    <div class="screen rest-screen">
      <h2 class="screen-title">Campfire</h2>
      <p class="rest-desc">The fire crackles. Choose wisely.</p>
      <div class="rest-choices">
        ${healAmount > 0 ? `
          <button class="rest-choice" onclick="doRest()">
            <span class="rest-choice-icon">❤️</span>
            <span class="rest-choice-label">Rest</span>
            <span class="rest-choice-desc">Heal ${healAmount} HP</span>
          </button>
        ` : ''}
        <button class="rest-choice" onclick="openUpgradeSelect()">
          <span class="rest-choice-icon">⬆️</span>
          <span class="rest-choice-label">Upgrade</span>
          <span class="rest-choice-desc">Enhance a card</span>
        </button>
        <button class="rest-choice" onclick="openRemoveSelect()">
          <span class="rest-choice-icon">🗑️</span>
          <span class="rest-choice-label">Remove</span>
          <span class="rest-choice-desc">Thin your deck</span>
        </button>
      </div>
    </div>
  `;
}

function doRest() {
  const healAmount = Math.min(Math.floor(gameState.player.maxHp * 0.3), gameState.player.maxHp - gameState.player.hp);
  gameState.player.hp += healAmount;
  addLog(`Rested and healed ${healAmount} HP.`);
  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

function openUpgradeSelect() {
  gameState._upgradeMode = 'upgrade';
  gameState.phase = GAME_PHASES.CARD_UPGRADE;
  renderGame();
}

function openRemoveSelect() {
  gameState._upgradeMode = 'remove';
  gameState.phase = GAME_PHASES.CARD_UPGRADE;
  renderGame();
}

// === CARD UPGRADE / REMOVE ===

function renderCardUpgrade() {
  const mode = gameState._upgradeMode || 'upgrade';
  const title = mode === 'remove' ? 'Remove a Card' : 'Upgrade a Card';
  const hint = mode === 'remove' ? 'Select a card to remove' : 'Select a card to upgrade';
  const allCards = [...gameState.player.deck, ...gameState.player.discard];
  const cards = mode === 'upgrade' ? allCards.filter(c => !c.upgraded) : allCards;

  return `
    <div class="screen upgrade-screen">
      <h2 class="screen-title">${title}</h2>
      <p class="upgrade-hint">${hint}</p>
      <div class="upgrade-cards">
        ${cards.map((card, i) => `
          <div class="upgrade-card-item" onclick="doCardAction(${i})">
            ${renderCard(card, -1, false)}
          </div>
        `).join('')}
      </div>
      <button class="btn btn-skip" onclick="returnFromUpgrade()">Cancel</button>
    </div>
  `;
}

function returnFromUpgrade() {
  if (gameState._returnToShop) {
    gameState._returnToShop = false;
    gameState.phase = GAME_PHASES.SHOP;
  } else {
    gameState.phase = GAME_PHASES.REST;
  }
  renderGame();
}

function doCardAction(index) {
  const mode = gameState._upgradeMode || 'upgrade';
  const allCards = [...gameState.player.deck, ...gameState.player.discard];
  const cards = mode === 'upgrade' ? allCards.filter(c => !c.upgraded) : allCards;
  const card = cards[index];
  if (!card) return;

  if (mode === 'remove') {
    let idx = gameState.player.deck.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      gameState.player.deck.splice(idx, 1);
    } else {
      idx = gameState.player.discard.findIndex(c => c.id === card.id);
      if (idx >= 0) gameState.player.discard.splice(idx, 1);
    }
    addLog(`Removed ${card.name} from deck.`);
    if (gameState._returnToShop) {
      gameState.campaign.gold -= CARD_REMOVE_PRICE;
    }
  } else {
    const actual = gameState.player.deck.find(c => c.id === card.id)
      || gameState.player.discard.find(c => c.id === card.id);
    if (actual) {
      upgradeCard(actual);
      addLog(`Upgraded ${actual.name}!`);
    }
  }

  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

// === SHOP ===

function renderShop() {
  const items = gameState._shopCards || [];
  const gold = gameState.campaign.gold;
  const canHeal = gameState.player.hp < gameState.player.maxHp;

  return `
    <div class="screen shop-screen">
      <h2 class="screen-title">Shop</h2>
      <div class="shop-gold">💰 ${gold} gold</div>
      <div class="shop-cards">
        ${items.map((item, i) => `
          <div class="shop-item ${gold >= item.price ? '' : 'shop-item-expensive'}" onclick="${gold >= item.price ? `buyCard(${i})` : ''}">
            ${renderCard(item.card, -1, false)}
            <div class="shop-price ${item.type === 'rare' ? 'shop-price-rare' : ''}">💰 ${item.price}</div>
          </div>
        `).join('')}
      </div>
      <div class="shop-services">
        <div class="shop-service ${gold >= CARD_REMOVE_PRICE ? '' : 'shop-item-expensive'}"
             onclick="${gold >= CARD_REMOVE_PRICE ? 'openShopRemove()' : ''}">
          🗑️ Remove a card — 💰 ${CARD_REMOVE_PRICE}
        </div>
        ${canHeal ? `
          <div class="shop-service ${gold >= SHOP_HEAL_PRICE ? '' : 'shop-item-expensive'}"
               onclick="${gold >= SHOP_HEAL_PRICE ? 'buyHeal()' : ''}">
            ❤️ Heal ${SHOP_HEAL_AMOUNT} HP — 💰 ${SHOP_HEAL_PRICE}
          </div>
        ` : ''}
      </div>
      <button class="btn btn-skip" onclick="leaveShop()">Leave</button>
    </div>
  `;
}

function buyCard(index) {
  const item = gameState._shopCards[index];
  if (!item || gameState.campaign.gold < item.price) return;
  gameState.campaign.gold -= item.price;
  gameState.player.deck.push(item.card);
  gameState._shopCards.splice(index, 1);
  addLog(`Bought ${item.card.name}.`);
  renderGame();
}

function buyHeal() {
  if (gameState.campaign.gold < SHOP_HEAL_PRICE) return;
  const healed = Math.min(SHOP_HEAL_AMOUNT, gameState.player.maxHp - gameState.player.hp);
  if (healed <= 0) return;
  gameState.campaign.gold -= SHOP_HEAL_PRICE;
  gameState.player.hp += healed;
  addLog(`Healed ${healed} HP.`);
  renderGame();
}

function openShopRemove() {
  gameState._upgradeMode = 'remove';
  gameState._returnToShop = true;
  gameState.phase = GAME_PHASES.CARD_UPGRADE;
  renderGame();
}

function openCardRemove() { openShopRemove(); }

function leaveShop() {
  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

function openVillageShop() {
  gameState._shopCards = getAvailableShopCards();
  gameState.phase = GAME_PHASES.SHOP;
  renderGame();
}

// === EVENTS ===

function renderEvent() {
  const eventId = gameState._currentEvent;
  const event = EVENTS[eventId];
  if (!event) return '<div class="screen"><p>Unknown event</p><button class="btn" onclick="returnToMap()">Back</button></div>';

  return `
    <div class="screen event-screen">
      <h2 class="screen-title">${event.title}</h2>
      <p class="event-desc">${event.description}</p>
      <div class="event-choices">
        ${event.choices.map((choice, i) => {
          const canAfford = !choice.cost || (!choice.cost.gold || gameState.campaign.gold >= choice.cost.gold);
          return `
            <button class="btn ${choice.cost ? 'btn-primary' : 'btn-secondary'} ${canAfford ? '' : 'btn-disabled'}"
                    onclick="${canAfford ? `doEventChoice(${i})` : ''}">
              ${choice.text}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function doEventChoice(index) {
  const event = EVENTS[gameState._currentEvent];
  const choice = event.choices[index];

  if (choice.cost) {
    if (choice.cost.hp) {
      gameState.player.hp = Math.max(1, gameState.player.hp - choice.cost.hp);
      addLog(`Lost ${choice.cost.hp} HP.`);
    }
    if (choice.cost.gold) {
      gameState.campaign.gold -= choice.cost.gold;
    }
  }

  if (choice.reward) {
    if (choice.reward.heal) {
      const healed = Math.min(choice.reward.heal, gameState.player.maxHp - gameState.player.hp);
      gameState.player.hp += healed;
      if (healed > 0) addLog(`Healed ${healed} HP.`);
    }
    if (choice.reward.rareCard) {
      const card = getRareCard();
      gameState.player.deck.push(card);
      addLog(`Gained rare card: ${card.name}!`);
    }
    if (choice.reward.removeCard) {
      gameState._upgradeMode = 'remove';
      gameState.phase = GAME_PHASES.CARD_UPGRADE;
      clearLocation(gameState.campaign.currentLocation);
      renderGame();
      return;
    }
    if (choice.reward.cardReward) {
      const biome = WORLD.locations[gameState.campaign.currentLocation]?.biome;
      gameState._rewardCards = getBiomeRewardCards(biome, choice.reward.cardCount || 3);
      gameState.phase = GAME_PHASES.CARD_REWARD;
      clearLocation(gameState.campaign.currentLocation);
      renderGame();
      return;
    }
  }

  addLog(choice.result);
  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

// === NPC DIALOGUE ===

function renderNpc() {
  const npc = gameState._currentNpc;
  if (!npc) return '<div class="screen"><p>No one here.</p><button class="btn" onclick="returnToMap()">Back</button></div>';

  const dialogueIndex = gameState._npcDialogueIndex || 0;
  const lines = npc.dialogue || ['...'];
  const currentLine = lines[Math.min(dialogueIndex, lines.length - 1)];
  const isLast = dialogueIndex >= lines.length - 1;

  return `
    <div class="screen npc-screen">
      <div class="npc-portrait" style="${npc.image ? `background-image: url('${npc.image}')` : ''}">${npc.image ? '' : (npc.icon || '👤')}</div>
      <div class="npc-name">${npc.name}</div>
      <div class="npc-text">${currentLine}</div>
      <div class="npc-buttons">
        ${isLast
          ? `<button class="btn btn-primary" onclick="leaveNpc()">Continue</button>`
          : `<button class="btn btn-primary" onclick="advanceDialogue()">Next</button>`
        }
      </div>
    </div>
  `;
}

function advanceDialogue() {
  gameState._npcDialogueIndex = (gameState._npcDialogueIndex || 0) + 1;
  renderGame();
}

function leaveNpc() {
  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

// === TREASURE ===

function openTreasure(locId) {
  const card = getRareCard();
  gameState.player.deck.push(card);
  addLog(`Found rare card: ${card.name}!`);
  clearLocation(locId);
  returnToMap();
}

// Compatibility stubs
function openNpc() { returnToMap(); }
function doAcceptQuest() {}
function doTurnInQuest() {}
function nextNpc() { returnToMap(); }
function getAvailableQuestsAtLocation() { return []; }
