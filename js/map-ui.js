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
        <span class="map-gold">${icon('coins', 16, '#c8a96e')} ${campaign.gold}</span>
        <span class="map-deck" onclick="openDeckViewer()" style="cursor:pointer">${icon('card-deck', 16, '#c8a96e')} ${gameState.player.deck.length + gameState.player.hand.length + gameState.player.discard.length}</span>
        <span class="map-hp">${icon('heart', 16, '#e05555')} ${gameState.player.hp}/${gameState.player.maxHp}</span>
        <span class="map-menu-btn" onclick="openGameMenu()">${icon('gear', 18, '#c8a96e')}</span>
        ${MAP_DEBUG ? `<button class="map-debug-btn" onclick="exportNodePositions()">${icon('clipboard', 14)} Export</button>
        <button class="map-debug-btn" onclick="toggleMoveMode()" style="${_moveMode ? 'background:#48a' : ''}">${icon('arrow-up', 14)} ${_moveMode ? 'Move ON' : 'Move'}</button>
        <button class="map-debug-btn" onclick="toggleLinkMode()" id="linkModeBtn" style="${_linkMode ? 'background:#c44' : ''}">${icon('link', 14)} ${_linkMode ? 'Link ON' : 'Link'}</button>
        <button class="map-debug-btn" onclick="exportConnections()">${icon('clipboard', 14)} Paths</button>` : ''}
      </div>
      <div class="world-viewport" id="worldViewport">
        <div class="world-canvas" id="worldCanvas">
          <svg class="world-paths" id="worldPaths"></svg>
          ${renderWorldLocations()}
          ${renderPlayerMarker()}
        </div>
      </div>
      ${MAP_DEBUG ? `<div class="map-debug-coords" id="debugCoords">Drag nodes to position them</div>
      <div class="map-debug-coords" id="debugState" style="font-size:0.5rem;max-height:60px;overflow:auto">${renderDebugState()}</div>` : ''}
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
    if (!_moveMode) return; // only drag in move mode
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
    if (!_moveMode) return;
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

function renderDebugState() {
  const c = gameState.campaign;
  if (!c) return 'No campaign';
  const loc = WORLD.locations[c.currentLocation];
  const connections = loc ? loc.paths : [];
  const travelable = connections.filter(id => canTravelTo(id));
  const explored = [...c.explored].join(', ');
  const cleared = [...c.cleared].join(', ');
  return `loc:${c.currentLocation} | explored:[${explored}] | cleared:[${cleared}] | connections:[${connections.join(',')}] | canTravel:[${travelable.join(',')}]`;
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

// === DEBUG: Link mode (edit connections) ===
var _linkMode = false;
var _linkSource = null;
var _moveMode = false;

function toggleMoveMode() {
  _moveMode = !_moveMode;
  if (_moveMode) _linkMode = false;
  renderGame();
}

function toggleLinkMode() {
  _linkMode = !_linkMode;
  _linkSource = null;
  if (_linkMode) _moveMode = false;
  renderGame();
}

function onDebugNodeClick(locId) {
  if (!_linkMode) return false;
  if (!_linkSource) {
    _linkSource = locId;
    const debugEl = document.getElementById('debugCoords');
    if (debugEl) debugEl.textContent = `Link from: ${locId} → click another node (or same to cancel)`;
    // Highlight source node
    const node = document.querySelector(`[data-loc-id="${locId}"]`);
    if (node) node.style.outline = '3px solid #f44';
    return true;
  }
  // Second click
  const source = _linkSource;
  _linkSource = null;
  // Remove highlight
  const oldNode = document.querySelector(`[data-loc-id="${source}"]`);
  if (oldNode) oldNode.style.outline = '';

  if (source === locId) {
    const debugEl = document.getElementById('debugCoords');
    if (debugEl) debugEl.textContent = 'Link cancelled';
    return true;
  }

  // Toggle connection
  const srcLoc = WORLD.locations[source];
  const dstLoc = WORLD.locations[locId];
  const hasLink = srcLoc.paths.includes(locId);

  if (hasLink) {
    srcLoc.paths = srcLoc.paths.filter(p => p !== locId);
    dstLoc.paths = dstLoc.paths.filter(p => p !== source);
    const debugEl = document.getElementById('debugCoords');
    if (debugEl) debugEl.textContent = `Removed: ${source} ↔ ${locId}`;
  } else {
    srcLoc.paths.push(locId);
    dstLoc.paths.push(source);
    const debugEl = document.getElementById('debugCoords');
    if (debugEl) debugEl.textContent = `Added: ${source} ↔ ${locId}`;
  }
  renderWorldPaths();
  return true;
}

function debugEnterLocation(locId) {
  if (_dragTarget || _didDrag) { _didDrag = false; return; }
  // Teleport to location and enter it
  gameState.campaign.currentLocation = locId;
  gameState.campaign.explored.add(locId);
  gameState.campaign.visited.add(locId);
  // Unmark cleared so we can re-enter
  gameState.campaign.cleared.delete(locId);
  enterLocation();
}

function exportConnections() {
  const lines = [];
  for (const [id, loc] of Object.entries(WORLD.locations)) {
    lines.push(`${id}: [${loc.paths.map(p => `'${p}'`).join(', ')}]`);
  }
  const text = lines.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    alert('Paths copied to clipboard!\n\n' + text);
  }).catch(() => {
    alert('Paths:\n\n' + text);
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
    const locIcon = LOC_ICONS[loc.type] || icon('question', 20, '#8888cc');
    const imgStyle = loc.image ? `background-image: url('${loc.image}')` : '';

    html += `
      <div class="world-location ${stateClass} ${canTravel ? 'loc-tappable' : ''}"
           style="left: ${pos.x}px; top: ${pos.y}px"
           data-loc-id="${id}"
           onclick="${MAP_DEBUG ? (_linkMode ? `onDebugNodeClick('${id}')` : (_moveMode ? '' : `debugEnterLocation('${id}')`)) : (canTravel || isCurrent ? `onLocationTap('${id}')` : '')}">
        <div class="loc-node" style="${imgStyle}">
          ${!loc.image ? `<span class="loc-icon">${locIcon}</span>` : ''}
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

      // Lines connect to center of nodes (nodes use translate(-50%,-50%))
      paths += `<line
        x1="${fromPos.x}" y1="${fromPos.y}"
        x2="${toPos.x}" y2="${toPos.y}"
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
          actions += `<span class="panel-blocked">${icon('crossed-swords', 14, '#e05555')} Must fight to proceed</span>`;
        }
        break;
      case LOC_TYPES.SHOP:
        actions = `<button class="btn btn-primary" onclick="enterLocation()">Enter Shop</button>`;
        break;
      case LOC_TYPES.REST:
        if (canRest()) {
          actions = `<button class="btn btn-primary" onclick="enterLocation()">Rest</button>`;
        } else {
          const remaining = REST_COOLDOWN_BATTLES - (gameState.campaign.battlesSinceRest || 0);
          actions = `<button class="btn btn-primary" disabled>Rest</button>
            <span class="panel-blocked">Too soon — fight ${remaining} more battle${remaining !== 1 ? 's' : ''} first</span>`;
        }
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
      if (canRest()) {
        actions += ` <button class="btn btn-secondary" onclick="enterLocation()">Rest Again</button>`;
      } else {
        const remaining = REST_COOLDOWN_BATTLES - (gameState.campaign.battlesSinceRest || 0);
        actions += ` <button class="btn btn-secondary" disabled>Rest Again</button>
          <span class="panel-blocked">Fight ${remaining} more battle${remaining !== 1 ? 's' : ''} first</span>`;
      }
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
      const locIcon = LOC_ICONS[c.type] || icon('question', 16, '#8888cc');
      return `<button class="travel-btn ${cCleared ? 'travel-cleared' : ''}" onclick="doTravel('${c.id}')">
        ${locIcon} ${gameState.campaign.visited.has(c.id) ? c.name : '???'}
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

  // Check for ambush
  const ambushEnemy = rollAmbush(locId);
  if (ambushEnemy) {
    gameState._battleLocationId = null; // ambush doesn't clear a location
    gameState._battleGoldReward = 5; // small gold reward for surviving
    gameState._battleIsElite = false;
    gameState._isAmbush = true;
    setupAIBattleByEnemy(ambushEnemy);
    addLog(`Ambush! A ${gameState.enemy.name} attacks!`);
    showNotification('Ambush!', 'damage');
    prepareBattle();
    return;
  }

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
    case LOC_TYPES.NPC: {
      const npc = loc.npc;
      // Check for post-condition dialogue and reward
      const hasReward = npc.npcRewardCondition
        && gameState.campaign.cleared.has(npc.npcRewardCondition)
        && !gameState.campaign.npcRewardsCollected?.has(locId);
      gameState._currentNpc = {
        ...npc,
        dialogue: hasReward && npc.rewardDialogue ? npc.rewardDialogue : npc.dialogue,
        _grantReward: hasReward ? npc.npcReward : null,
      };
      gameState._npcDialogueIndex = 0;
      gameState.phase = GAME_PHASES.NPC;
      renderGame();
      break;
    }
    case LOC_TYPES.TREASURE:
      openTreasure(locId);
      break;
  }
}

// === REST SCREEN ===

function renderRest() {
  const healAmount = Math.min(Math.floor(gameState.player.maxHp * REST_HEAL_FRACTION), gameState.player.maxHp - gameState.player.hp);
  const gold = gameState.campaign.gold;
  const canUpgrade = gold >= CARD_UPGRADE_PRICE;
  const canRemove = gold >= CARD_REMOVE_PRICE;
  const loc = WORLD.locations[gameState.campaign.currentLocation];
  const npc = loc && loc.npc;
  const cleared = gameState.campaign.cleared.has(gameState.campaign.currentLocation);
  return `
    <div class="screen rest-screen">
      <h2 class="screen-title">Campfire</h2>
      <p class="rest-desc">The fire crackles. Choose wisely.</p>
      <div class="rest-choices">
        ${healAmount > 0 ? `
          <button class="rest-choice" onclick="doRest()">
            <span class="rest-choice-icon">${icon('heart', 28, '#e05555')}</span>
            <span class="rest-choice-label">Rest</span>
            <span class="rest-choice-desc">Heal ${healAmount} HP</span>
          </button>
        ` : ''}
        <button class="rest-choice ${canUpgrade ? '' : 'rest-choice-disabled'}" onclick="${canUpgrade ? 'openUpgradeSelect()' : ''}">
          <span class="rest-choice-icon">${icon('arrow-up', 28, '#55cc55')}</span>
          <span class="rest-choice-label">Upgrade</span>
          <span class="rest-choice-desc">Enhance a card — ${icon('coins', 12, '#c8a96e')} ${CARD_UPGRADE_PRICE}</span>
        </button>
        <button class="rest-choice ${canRemove ? '' : 'rest-choice-disabled'}" onclick="${canRemove ? 'openRemoveSelect()' : ''}">
          <span class="rest-choice-icon">${icon('trash', 28, '#aa6666')}</span>
          <span class="rest-choice-label">Remove</span>
          <span class="rest-choice-desc">Thin your deck — ${icon('coins', 12, '#c8a96e')} ${CARD_REMOVE_PRICE}</span>
        </button>
      </div>
      ${npc && !cleared ? `<button class="btn btn-secondary" onclick="enterRestNpc()" style="margin-top:8px">Talk to ${npc.name}</button>` : ''}
    </div>
  `;
}

function doRest() {
  const healAmount = Math.min(Math.floor(gameState.player.maxHp * REST_HEAL_FRACTION), gameState.player.maxHp - gameState.player.hp);
  gameState.player.hp += healAmount;
  addLog(`Rested and healed ${healAmount} HP.`);
  if (healAmount > 0) showNotification(`+${healAmount} HP`, 'heal');
  gameState.campaign.battlesSinceRest = 0; // reset rest cooldown
  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

function enterRestNpc() {
  const loc = WORLD.locations[gameState.campaign.currentLocation];
  if (!loc || !loc.npc) return;
  gameState._currentNpc = { ...loc.npc, dialogue: loc.npc.dialogue };
  gameState._npcDialogueIndex = 0;
  gameState._returnToRest = true;
  gameState.phase = GAME_PHASES.NPC;
  renderGame();
}

function openUpgradeSelect() {
  if (gameState.campaign.gold < CARD_UPGRADE_PRICE) return;
  gameState._upgradeMode = 'upgrade';
  gameState.phase = GAME_PHASES.CARD_UPGRADE;
  renderGame();
}

function openRemoveSelect() {
  if (!gameState._returnToShop && gameState.campaign.gold < CARD_REMOVE_PRICE) return;
  gameState._upgradeMode = 'remove';
  gameState.phase = GAME_PHASES.CARD_UPGRADE;
  renderGame();
}

// === GAME MENU ===

function openGameMenu() {
  const overlay = document.createElement('div');
  overlay.className = 'game-menu-overlay';
  overlay.id = 'gameMenu';
  overlay.innerHTML = `
    <div class="game-menu">
      <h2 class="screen-title">Menu</h2>
      <button class="btn btn-primary" onclick="closeGameMenu()">Resume</button>
      <button class="btn btn-secondary" onclick="confirmQuit()">Quit to Title</button>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGameMenu();
  });
  document.getElementById('app').appendChild(overlay);
}

function closeGameMenu() {
  const el = document.getElementById('gameMenu');
  if (el) el.remove();
}

function confirmQuit() {
  closeGameMenu();
  // Save progress before quitting
  saveGame();
  gameState = createGameState();
  currentProfile = null;
  renderGame();
}

// === DECK VIEWER ===

function openDeckViewer() {
  const allCards = [...gameState.player.deck, ...gameState.player.hand, ...gameState.player.discard];
  // Sort by cost, then name
  allCards.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  const overlay = document.createElement('div');
  overlay.className = 'deck-viewer-overlay';
  overlay.id = 'deckViewer';
  overlay.innerHTML = `
    <div class="deck-viewer">
      <div class="deck-viewer-header">
        <h2 class="screen-title">Your Deck (${allCards.length})</h2>
        <button class="btn btn-secondary" onclick="closeDeckViewer()">Close</button>
      </div>
      <div class="deck-viewer-cards">
        ${allCards.map(card => `
          <div class="deck-viewer-card">
            ${renderCard(card, -1, false)}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);
}

function closeDeckViewer() {
  const el = document.getElementById('deckViewer');
  if (el) el.remove();
}

// === CARD UPGRADE / REMOVE ===

function renderCardUpgrade() {
  const mode = gameState._upgradeMode || 'upgrade';

  // Show upgrade preview if a card is selected
  if (mode === 'upgrade' && gameState._upgradePreviewCardId) {
    const allCards = [...gameState.player.deck, ...gameState.player.discard, ...gameState.player.hand];
    const original = allCards.find(c => c.id === gameState._upgradePreviewCardId);
    if (original) {
      // Create a deep copy and upgrade it for preview
      const preview = JSON.parse(JSON.stringify(original));
      preview.effects = preview.effects.map(e => ({ ...e }));
      upgradeCard(preview);
      return `
        <div class="screen upgrade-screen">
          <h2 class="screen-title">Upgrade Preview</h2>
          <div class="upgrade-compare">
            <div class="upgrade-compare-card">
              <p class="upgrade-compare-label">Before</p>
              ${renderCard(original, -1, false)}
            </div>
            <div class="upgrade-arrow">${icon('arrow-up', 28, '#55cc55')}</div>
            <div class="upgrade-compare-card">
              <p class="upgrade-compare-label">After</p>
              ${renderCard(preview, -1, false)}
            </div>
          </div>
          <div class="upgrade-confirm-btns">
            <button class="btn btn-primary" onclick="confirmUpgrade()">Upgrade</button>
            <button class="btn btn-skip" onclick="cancelUpgradePreview()">Back</button>
          </div>
        </div>
      `;
    }
  }

  const title = mode === 'remove' ? 'Remove a Card' : 'Upgrade a Card';
  const hint = mode === 'remove' ? 'Select a card to remove' : 'Select a card to upgrade';
  const allCards = [...gameState.player.deck, ...gameState.player.discard, ...gameState.player.hand];
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
    // Tree offering: show special screen instead of charging gold
    if (gameState._treeOffering) {
      delete gameState._treeOffering;
      showTreeOfferingScreen(card);
      return;
    }
    gameState.campaign.gold -= CARD_REMOVE_PRICE;
  } else {
    // Show upgrade preview instead of immediately upgrading
    gameState._upgradePreviewCardId = card.id;
    renderGame();
    return;
  }

  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

function confirmUpgrade() {
  const cardId = gameState._upgradePreviewCardId;
  delete gameState._upgradePreviewCardId;
  const actual = gameState.player.deck.find(c => c.id === cardId)
    || gameState.player.discard.find(c => c.id === cardId)
    || gameState.player.hand.find(c => c.id === cardId);
  if (actual) {
    if (!gameState._returnToShop) {
      gameState.campaign.gold -= CARD_UPGRADE_PRICE;
    }
    upgradeCard(actual);
    addLog(`Upgraded ${actual.name}!`);
  }
  clearLocation(gameState.campaign.currentLocation);
  returnToMap();
}

function cancelUpgradePreview() {
  delete gameState._upgradePreviewCardId;
  renderGame();
}

// === SHOP ===

function renderShop() {
  const items = gameState._shopCards || [];
  const gold = gameState.campaign.gold;
  const canHeal = gameState.player.hp < gameState.player.maxHp;

  return `
    <div class="screen shop-screen">
      <h2 class="screen-title">Shop</h2>
      <div class="shop-gold">${icon('coins', 16, '#c8a96e')} ${gold} gold</div>
      <div class="shop-cards">
        ${items.map((item, i) => `
          <div class="shop-item ${gold >= item.price ? '' : 'shop-item-expensive'}" onclick="${gold >= item.price ? `buyCard(${i})` : ''}">
            ${renderCard(item.card, -1, false)}
            <div class="shop-price ${item.type === 'rare' ? 'shop-price-rare' : ''}">${icon('coins', 12, '#c8a96e')} ${item.price}</div>
          </div>
        `).join('')}
      </div>
      <div class="shop-services">
        <div class="shop-service ${gold >= CARD_REMOVE_PRICE ? '' : 'shop-item-expensive'}"
             onclick="${gold >= CARD_REMOVE_PRICE ? 'openShopRemove()' : ''}">
          ${icon('trash', 14, '#aa6666')} Remove a card — ${icon('coins', 12, '#c8a96e')} ${CARD_REMOVE_PRICE}
        </div>
        ${canHeal ? `
          <div class="shop-service ${gold >= SHOP_HEAL_PRICE ? '' : 'shop-item-expensive'}"
               onclick="${gold >= SHOP_HEAL_PRICE ? 'buyHeal()' : ''}">
            ${icon('heart', 14, '#e05555')} Heal ${SHOP_HEAL_AMOUNT} HP — ${icon('coins', 12, '#c8a96e')} ${SHOP_HEAL_PRICE}
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
  showNotification(`+${healed} HP`, 'heal');
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
      showNotification(`-${choice.cost.hp} HP`, 'damage');
    }
    if (choice.cost.gold) {
      gameState.campaign.gold -= choice.cost.gold;
      showNotification(`-${choice.cost.gold} gold`, 'gold');
    }
  }

  if (choice.reward) {
    if (choice.reward.heal) {
      const healed = Math.min(choice.reward.heal, gameState.player.maxHp - gameState.player.hp);
      gameState.player.hp += healed;
      if (healed > 0) {
        addLog(`Healed ${healed} HP.`);
        showNotification(`+${healed} HP`, 'heal');
      }
    }
    if (choice.reward.rareCard) {
      const card = getRareCard();
      gameState.player.deck.push(card);
      addLog(`Gained rare card: ${card.name}!`);
      showNotification(`+ ${card.name}`, 'card');
    }
    if (choice.reward.chestReward) {
      const biome = WORLD.locations[gameState.campaign.currentLocation]?.biome;
      const rareCard = getRareCard();
      const filler = getBiomeRewardCards(biome, (choice.reward.cardCount || 3) - 1);
      gameState._rewardCards = shuffleArray([rareCard, ...filler]);
      gameState._rewardSkippable = true;
      gameState._chestResult = choice.result;
      clearLocation(gameState.campaign.currentLocation);
      showChestAnimation();
      return;
    }
    if (choice.reward.treeOffering) {
      gameState._treeOffering = true;
      gameState._treeResult = choice.result;
      gameState._upgradeMode = 'remove';
      gameState.phase = GAME_PHASES.CARD_UPGRADE;
      renderGame();
      return;
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
      gameState._rewardSkippable = true;
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

// === TREE OFFERING ===

function showTreeOfferingScreen(offeredCard) {
  const rareCard = getRareCard();
  gameState.player.deck.push(rareCard);
  gameState._treeRewardCard = rareCard;
  gameState._treeOfferedCard = offeredCard;

  clearLocation(gameState.campaign.currentLocation);

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="screen tree-offering-screen">
      <div class="tree-phase tree-phase-absorb" id="treePhase1">
        <h2 class="screen-title">The Elder Tree</h2>
        <p class="tree-narration">You hold out your card. Roots rise from the earth and wrap around it...</p>
        <div class="tree-card-offered">
          ${renderCard(offeredCard, -1, false)}
        </div>
        <p class="tree-narration">The tree shudders. The card dissolves into golden light.</p>
        <button class="btn btn-primary" onclick="showTreeReward()">...</button>
      </div>
      <div class="tree-phase tree-phase-reward tree-hidden" id="treePhase2">
        <h2 class="screen-title">The Elder Tree</h2>
        <p class="tree-narration">${gameState._treeResult || 'A glowing seed falls into your hand — a new card forms from the wood.'}</p>
        <div class="tree-card-reward">
          ${renderCard(rareCard, -1, false)}
        </div>
        <p class="tree-narration-gained">+ ${rareCard.name}</p>
        <button class="btn btn-primary" onclick="leaveTreeOffering()">Continue</button>
      </div>
    </div>
  `;
  delete gameState._treeResult;
}

function showTreeReward() {
  document.getElementById('treePhase1').classList.add('tree-hidden');
  document.getElementById('treePhase2').classList.remove('tree-hidden');
}

function leaveTreeOffering() {
  delete gameState._treeRewardCard;
  delete gameState._treeOfferedCard;
  returnToMap();
}

// === CHEST ANIMATION ===

function showChestAnimation() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="screen chest-screen">
      <div class="chest-container" onclick="openChest()">
        <div class="chest" id="chest">
          <div class="chest-base"><img src="images/chest_sea.png" alt="chest" class="chest-img"></div>
          <div class="chest-glow"></div>
        </div>
        <p class="chest-prompt">Tap to open</p>
      </div>
      ${gameState._chestResult ? `<p class="chest-result-text">${gameState._chestResult}</p>` : ''}
    </div>
  `;
}

function openChest() {
  const chest = document.getElementById('chest');
  if (!chest || chest.classList.contains('chest-opened')) return;
  chest.classList.add('chest-opened');

  // After animation, transition to card reward screen
  setTimeout(() => {
    gameState._rewardLabel = 'Chest Opened';
    gameState._rewardTitle = 'Choose Your Treasure';
    gameState.phase = GAME_PHASES.CARD_REWARD;
    renderGame();
  }, 1200);
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
      <div class="npc-portrait" style="${npc.image ? `background-image: url('${npc.image}')` : ''}">${npc.image ? '' : (npc.icon || icon('speech', 32, '#c8a96e'))}</div>
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
  const npc = gameState._currentNpc;
  const locId = gameState.campaign.currentLocation;

  // Grant NPC reward card if conditions were met
  if (npc && npc._grantReward) {
    const card = getRareCardByKey(npc._grantReward);
    if (card) {
      gameState.player.deck.push(card);
      addLog(`Received: ${card.name}!`);
      showNotification(`+ ${card.name}`, 'card');
    }
    // Track that this reward was collected so it's not given again
    if (!gameState.campaign.npcRewardsCollected) {
      gameState.campaign.npcRewardsCollected = new Set();
    }
    gameState.campaign.npcRewardsCollected.add(locId);
  }

  // Return to rest screen if NPC was at a rest site
  if (gameState._returnToRest) {
    delete gameState._returnToRest;
    clearLocation(locId);
    gameState.phase = GAME_PHASES.REST;
    renderGame();
    return;
  }

  clearLocation(locId);
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
