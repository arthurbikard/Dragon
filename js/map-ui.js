// Map screen, shop, rest, NPC, and event UI rendering

// === MAP SCREEN ===
function renderMap() {
  const campaign = gameState.campaign;
  const currentLoc = LOCATIONS[campaign.currentLocation];
  const itemIcons = campaign.inventory.map(id => ITEMS[id].icon).join(' ') || '—';

  return `
    <div class="screen map-screen">
      <div class="map-topbar">
        <span class="map-gold">💰 ${campaign.gold}</span>
        <span class="map-items">${itemIcons}</span>
        <span class="map-hp">❤️ ${gameState.player.hp}/${gameState.player.maxHp}</span>
      </div>
      <div class="map-container">
        <div class="map-canvas">
          ${renderMapPaths()}
          ${renderMapNodes()}
          ${renderPlayerMarker()}
        </div>
      </div>
      ${renderLocationPanel()}
    </div>
  `;
}

function renderMapNodes() {
  return Object.entries(LOCATIONS).map(([id, loc]) => {
    if (loc.hidden) return '';
    const state = gameState.campaign.locationStates[id];
    const isCurrent = gameState.campaign.currentLocation === id;
    const canAccess = canAccessLocation(id) && isConnected(gameState.campaign.currentLocation, id);
    const isLocked = loc.requires && !hasItem(loc.requires);

    let statusClass = 'node-unknown';
    if (state.cleared) statusClass = 'node-cleared';
    else if (state.visited) statusClass = 'node-visited';
    else if (state.unlocked && !isLocked) statusClass = 'node-available';
    else if (state.unlocked && isLocked) statusClass = 'node-locked';

    const nodeStyle = loc.image
      ? `background-image: url('${loc.image}')`
      : '';

    return `
      <div class="map-node ${statusClass} ${isCurrent ? 'node-current' : ''} ${canAccess ? 'node-tappable' : ''}"
           style="left: ${loc.mapPos.x}%; top: ${loc.mapPos.y}%"
           onclick="${canAccess || isCurrent ? `onMapNodeTap('${id}')` : ''}">
        <span class="node-icon" style="${nodeStyle}"></span>
        <span class="node-label">${loc.name}</span>
        ${isLocked ? '<span class="node-lock">🔒</span>' : ''}
      </div>
    `;
  }).join('');
}

function renderMapPaths() {
  // SVG lines connecting locations
  const drawn = new Set();
  let paths = '';

  for (const [id, loc] of Object.entries(LOCATIONS)) {
    if (loc.hidden || !loc.mapPos) continue;
    for (const connId of loc.connections) {
      const conn = LOCATIONS[connId];
      if (!conn || conn.hidden || !conn.mapPos) continue;
      const key = [id, connId].sort().join('-');
      if (drawn.has(key)) continue;
      drawn.add(key);

      const fromState = gameState.campaign.locationStates[id];
      const toState = gameState.campaign.locationStates[connId];
      const bothUnlocked = fromState.unlocked && toState.unlocked;

      paths += `<line
        x1="${loc.mapPos.x}%" y1="${loc.mapPos.y}%"
        x2="${conn.mapPos.x}%" y2="${conn.mapPos.y}%"
        class="map-path ${bothUnlocked ? 'path-unlocked' : 'path-locked'}"
      />`;
    }
  }

  return `<svg class="map-paths">${paths}</svg>`;
}

function renderPlayerMarker() {
  const loc = LOCATIONS[gameState.campaign.currentLocation];
  if (!loc || !loc.mapPos) return '';
  return `<div class="player-marker" style="left: ${loc.mapPos.x}%; top: ${loc.mapPos.y}%">▼</div>`;
}

function renderLocationPanel() {
  const locId = gameState._selectedLocation || gameState.campaign.currentLocation;
  const loc = LOCATIONS[locId];
  if (!loc || loc.hidden) return '<div class="location-panel"></div>';

  const state = gameState.campaign.locationStates[locId];
  const isCurrent = gameState.campaign.currentLocation === locId;
  const isLocked = loc.requires && !hasItem(loc.requires);
  const canTravel = !isCurrent && canAccessLocation(locId) && isConnected(gameState.campaign.currentLocation, locId);

  let actions = '';
  if (canTravel) {
    actions += `<button class="btn btn-primary" onclick="doTravel('${locId}')">Travel</button>`;
  } else if (isCurrent) {
    if (loc.type === LOCATION_TYPES.BATTLE || loc.type === LOCATION_TYPES.BOSS) {
      if (!state.cleared) {
        actions += `<button class="btn btn-primary" onclick="startLocationBattle('${locId}')">Fight</button>`;
      } else {
        actions += `<span class="panel-cleared">Cleared ✓</span>`;
      }
    }
    if (loc.features) {
      if (loc.features.includes('shop')) {
        actions += `<button class="btn btn-secondary" onclick="openShop()">Shop</button>`;
      }
      if (loc.features.includes('rest')) {
        actions += `<button class="btn btn-secondary" onclick="openRest()">Rest</button>`;
      }
      if (loc.features.includes('npc')) {
        actions += `<button class="btn btn-secondary" onclick="openNpc('${locId}')">Talk</button>`;
      }
    }
    if (loc.event && !state.cleared) {
      actions += `<button class="btn btn-secondary" onclick="openEvent('${loc.event}')">Explore</button>`;
    }
    if (loc.type === LOCATION_TYPES.TREASURE && !state.cleared) {
      actions += `<button class="btn btn-primary" onclick="openTreasure('${locId}')">Open</button>`;
    }
  } else if (isLocked) {
    const item = ITEMS[loc.requires];
    actions += `<span class="panel-locked">Requires ${item.icon} ${item.name}</span>`;
  }

  return `
    <div class="location-panel">
      <div class="panel-name">${loc.name}</div>
      <div class="panel-desc">${loc.description}</div>
      <div class="panel-actions">${actions}</div>
    </div>
  `;
}

function onMapNodeTap(locId) {
  const isCurrent = gameState.campaign.currentLocation === locId;
  if (isCurrent) {
    gameState._selectedLocation = locId;
    renderGame();
    return;
  }
  if (canAccessLocation(locId) && isConnected(gameState.campaign.currentLocation, locId)) {
    doTravel(locId);
  }
}

function doTravel(locId) {
  travelTo(locId);
  gameState._selectedLocation = locId;
  renderGame();
}

// === SHOP ===
function openShop() {
  gameState._shopCards = getAvailableShopCards();
  gameState.phase = GAME_PHASES.SHOP;
  renderGame();
}

function renderShop() {
  const items = gameState._shopCards || [];
  const gold = gameState.campaign.gold;

  return `
    <div class="screen shop-screen">
      <h2 class="screen-title">Shop</h2>
      <div class="shop-gold">💰 ${gold} gold</div>
      <div class="shop-cards">
        ${items.map((item, i) => `
          <div class="shop-item ${gold >= item.price ? '' : 'shop-item-expensive'}" onclick="${gold >= item.price ? `buyCard(${i})` : ''}">
            ${renderCard(item.card, -1, false)}
            <div class="shop-price">💰 ${item.price}</div>
          </div>
        `).join('')}
      </div>
      <div class="shop-remove" onclick="${gold >= CARD_REMOVE_PRICE ? 'openCardRemove()' : ''}">
        <span class="${gold >= CARD_REMOVE_PRICE ? '' : 'shop-item-expensive'}">Remove a card — 💰 ${CARD_REMOVE_PRICE}</span>
      </div>
      <button class="btn btn-skip" onclick="returnToMap()">Leave</button>
    </div>
  `;
}

function buyCard(index) {
  const item = gameState._shopCards[index];
  if (!item || gameState.campaign.gold < item.price) return;
  gameState.campaign.gold -= item.price;
  gameState.player.deck.push(item.card);
  gameState._shopCards.splice(index, 1);
  addLog(`Bought ${item.card.name} for ${item.price} gold.`);
  renderGame();
}

function openCardRemove() {
  gameState.phase = GAME_PHASES.CARD_UPGRADE; // reuse for removal
  gameState._upgradeMode = 'remove';
  renderGame();
}

// === REST ===
function openRest() {
  gameState.phase = GAME_PHASES.REST;
  renderGame();
}

function renderRest() {
  const healAmount = Math.min(15, gameState.player.maxHp - gameState.player.hp);
  return `
    <div class="screen rest-screen">
      <h2 class="screen-title">Rest</h2>
      <p class="rest-desc">The fire crackles warmly. You can recover your strength.</p>
      <div class="rest-hp">❤️ ${gameState.player.hp} / ${gameState.player.maxHp}</div>
      ${healAmount > 0 ? `
        <button class="btn btn-primary" onclick="doRest()">Rest (+${healAmount} HP)</button>
      ` : `
        <p class="rest-full">You are at full health.</p>
      `}
      <button class="btn btn-skip" onclick="returnToMap()">Leave</button>
    </div>
  `;
}

function doRest() {
  const healAmount = Math.min(15, gameState.player.maxHp - gameState.player.hp);
  gameState.player.hp += healAmount;
  addLog(`Rested and healed ${healAmount} HP.`);
  returnToMap();
}

// === NPC DIALOGUE ===
function openNpc(locId) {
  const questInfo = getAvailableQuestsAtLocation(locId);
  gameState._npcQuests = questInfo;
  gameState._npcQuestIndex = 0;
  gameState.phase = GAME_PHASES.NPC;
  renderGame();
}

function renderNpc() {
  const quests = gameState._npcQuests || [];
  if (quests.length === 0) {
    return `
      <div class="screen npc-screen">
        <p class="npc-text">No one has anything to say right now.</p>
        <button class="btn btn-skip" onclick="returnToMap()">Leave</button>
      </div>
    `;
  }

  const qi = gameState._npcQuestIndex || 0;
  const current = quests[qi];
  const { questId, quest, npc, action } = current;
  const dialogue = quest.dialogue;

  let text = '';
  let buttons = '';

  switch (action) {
    case 'offer':
      text = dialogue.offer;
      buttons = `
        <button class="btn btn-primary" onclick="doAcceptQuest('${questId}')">Accept</button>
        <button class="btn btn-skip" onclick="nextNpc()">Decline</button>
      `;
      break;
    case 'active':
      text = dialogue.active;
      buttons = `<button class="btn btn-skip" onclick="nextNpc()">Continue</button>`;
      break;
    case 'turnin':
      text = dialogue.turnin;
      buttons = `<button class="btn btn-primary" onclick="doTurnInQuest('${questId}')">Claim Reward</button>`;
      break;
    case 'done':
      text = dialogue.done;
      buttons = `<button class="btn btn-skip" onclick="nextNpc()">Continue</button>`;
      break;
  }

  return `
    <div class="screen npc-screen">
      <div class="npc-portrait" style="${npc.image ? `background-image: url('${npc.image}')` : ''}">${npc.image ? '' : npc.icon}</div>
      <div class="npc-name">${npc.name}</div>
      <div class="npc-quest-name">${quest.name}</div>
      <div class="npc-text">${text}</div>
      <div class="npc-buttons">${buttons}</div>
    </div>
  `;
}

function doAcceptQuest(questId) {
  acceptQuest(questId);
  nextNpc();
}

function doTurnInQuest(questId) {
  turnInQuest(questId);
  nextNpc();
}

function nextNpc() {
  const quests = gameState._npcQuests || [];
  gameState._npcQuestIndex = (gameState._npcQuestIndex || 0) + 1;
  if (gameState._npcQuestIndex >= quests.length) {
    returnToMap();
  } else {
    renderGame();
  }
}

// === EVENTS ===
function openEvent(eventId) {
  gameState._currentEvent = eventId;
  gameState.phase = GAME_PHASES.EVENT;
  renderGame();
}

function renderEvent() {
  const eventId = gameState._currentEvent;
  const event = EVENTS[eventId];
  if (!event) return '<div class="screen"><p>Unknown event</p></div>';

  return `
    <div class="screen event-screen">
      <h2 class="screen-title">${event.title}</h2>
      <p class="event-desc">${event.description}</p>
      <div class="event-choices">
        ${event.choices.map((choice, i) => `
          <button class="btn ${choice.cost ? 'btn-primary' : 'btn-secondary'}" onclick="doEventChoice(${i})">
            ${choice.text}
          </button>
        `).join('')}
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
    if (choice.reward.cardReward) {
      gameState._rewardCards = getRewardCards(choice.reward.cardCount || 3);
      gameState.phase = GAME_PHASES.CARD_REWARD;
      renderGame();
      return;
    }
  }

  addLog(choice.result);

  // Mark event location as cleared
  const locId = gameState.campaign.currentLocation;
  clearLocation(locId);

  returnToMap();
}

// === TREASURE ===
function openTreasure(locId) {
  const loc = LOCATIONS[locId];
  clearLocation(locId);

  if (loc.rewards && loc.rewards.healFull) {
    gameState.player.hp = gameState.player.maxHp;
    addLog('The healing spring restores you fully!');
  }

  if (loc.rewards && loc.rewards.rareCard) {
    const card = getRareCard();
    gameState.player.deck.push(card);
    addLog(`Found rare card: ${card.name}!`);
  }

  returnToMap();
}

// === CARD UPGRADE / REMOVE ===
function renderCardUpgrade() {
  const mode = gameState._upgradeMode || 'upgrade';
  const title = mode === 'remove' ? 'Remove a Card' : 'Upgrade a Card';
  const deck = gameState.player.deck;

  return `
    <div class="screen upgrade-screen">
      <h2 class="screen-title">${title}</h2>
      <p class="upgrade-hint">Select a card from your deck</p>
      <div class="upgrade-cards">
        ${deck.map((card, i) => `
          <div class="upgrade-card-item" onclick="doCardAction(${i})">
            ${renderCard(card, -1, false)}
          </div>
        `).join('')}
      </div>
      <button class="btn btn-skip" onclick="returnToMap()">Cancel</button>
    </div>
  `;
}

function doCardAction(index) {
  const mode = gameState._upgradeMode || 'upgrade';
  if (mode === 'remove') {
    const removed = gameState.player.deck.splice(index, 1)[0];
    gameState.campaign.gold -= CARD_REMOVE_PRICE;
    addLog(`Removed ${removed.name} from deck.`);
  } else {
    // Upgrade: +2 damage or +2 block
    const card = gameState.player.deck[index];
    if (card.damage > 0) {
      card.damage += 2;
      card.description = card.description.replace(/\d+/, card.damage);
      addLog(`Upgraded ${card.name}: +2 damage!`);
    } else if (card.block > 0) {
      card.block += 2;
      card.description = card.description.replace(/\d+/, card.block);
      addLog(`Upgraded ${card.name}: +2 block!`);
    }
    gameState._pendingCardUpgrade = false;
  }
  returnToMap();
}
