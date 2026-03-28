// Map screen, shop, rest, NPC, and event UI rendering

// === MAP SCREEN — Vertical branching map ===
function renderMap() {
  const campaign = gameState.campaign;
  const map = campaign.map;
  const available = getAvailableNodes();
  const itemIcons = campaign.inventory.length > 0
    ? campaign.inventory.map(id => ITEMS[id] ? ITEMS[id].icon : '').join(' ')
    : '';

  return `
    <div class="screen map-screen">
      <div class="map-topbar">
        <span class="map-gold">💰 ${campaign.gold}</span>
        <span class="map-deck">📚 ${gameState.player.deck.length + gameState.player.hand.length + gameState.player.discard.length}</span>
        <span class="map-hp">❤️ ${gameState.player.hp}/${gameState.player.maxHp}</span>
      </div>
      <div class="map-container">
        ${renderVerticalMap(map, campaign, available)}
      </div>
    </div>
  `;
}

function renderVerticalMap(map, campaign, available) {
  let html = '';

  // Boss node at top
  const bossAvail = available.includes(map.boss);
  html += `
    <div class="map-row map-row-boss">
      <div class="map-node ${bossAvail ? 'node-available' : 'node-locked'} ${map.boss.visited ? 'node-visited' : ''}"
           onclick="${bossAvail ? `onNodeSelect(${MAP_CONFIG.acts}, 0)` : ''}">
        <span class="node-icon">${NODE_ICONS[NODE_TYPES.BOSS]}</span>
        <span class="node-label">Dragon's Lair</span>
      </div>
    </div>
  `;

  // Acts in reverse (top = later acts)
  for (let act = MAP_CONFIG.acts - 1; act >= 0; act--) {
    const actNodes = map.acts[act];
    html += `<div class="map-row">`;
    html += `<span class="map-act-label">Act ${act + 1}</span>`;
    html += `<div class="map-row-nodes">`;
    for (let i = 0; i < actNodes.length; i++) {
      const node = actNodes[i];
      const isAvail = available.includes(node);
      const isCurrent = campaign.currentAct === act && campaign.currentNode === i;
      const isPast = act < campaign.currentAct || (act === campaign.currentAct && node.visited);

      let stateClass = 'node-locked';
      if (isCurrent) stateClass = 'node-current';
      else if (isPast) stateClass = 'node-past';
      else if (isAvail) stateClass = 'node-available';

      html += `
        <div class="map-node ${stateClass}"
             onclick="${isAvail ? `onNodeSelect(${act}, ${i})` : ''}">
          <span class="node-icon">${NODE_ICONS[node.type]}</span>
          <span class="node-label">${nodeTypeName(node.type)}</span>
        </div>
      `;
    }
    html += `</div></div>`;
  }

  return html;
}

function nodeTypeName(type) {
  const names = {
    [NODE_TYPES.BATTLE]: 'Battle',
    [NODE_TYPES.ELITE]: 'Elite',
    [NODE_TYPES.REST]: 'Rest',
    [NODE_TYPES.SHOP]: 'Shop',
    [NODE_TYPES.EVENT]: 'Event',
    [NODE_TYPES.BOSS]: 'Boss',
  };
  return names[type] || '?';
}

function onNodeSelect(act, index) {
  const node = selectMapNode(act, index);

  switch (node.type) {
    case NODE_TYPES.BATTLE:
      startNodeBattle(node.enemy, node.goldReward);
      break;
    case NODE_TYPES.ELITE:
      startEliteBattle(node.enemy, node.goldReward);
      break;
    case NODE_TYPES.REST:
      gameState.phase = GAME_PHASES.REST;
      renderGame();
      break;
    case NODE_TYPES.SHOP:
      gameState._shopCards = getAvailableShopCards();
      gameState.phase = GAME_PHASES.SHOP;
      renderGame();
      break;
    case NODE_TYPES.EVENT:
      gameState._currentEvent = node.eventKey;
      gameState.phase = GAME_PHASES.EVENT;
      renderGame();
      break;
    case NODE_TYPES.BOSS:
      startNodeBattle(node.enemy, 0);
      break;
  }
}

// === REST SCREEN — Heal / Upgrade / Remove ===
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
  advanceAfterNode();
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

// === CARD UPGRADE / REMOVE SCREEN ===
function renderCardUpgrade() {
  const mode = gameState._upgradeMode || 'upgrade';
  const title = mode === 'remove' ? 'Remove a Card' : 'Upgrade a Card';
  const hint = mode === 'remove' ? 'Select a card to remove from your deck' : 'Select a card to upgrade';
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
      <button class="btn btn-skip" onclick="returnToRestScreen()">Cancel</button>
    </div>
  `;
}

function returnToRestScreen() {
  gameState.phase = GAME_PHASES.REST;
  renderGame();
}

function doCardAction(index) {
  const mode = gameState._upgradeMode || 'upgrade';
  const allCards = [...gameState.player.deck, ...gameState.player.discard];
  const cards = mode === 'upgrade' ? allCards.filter(c => !c.upgraded) : allCards;
  const card = cards[index];
  if (!card) return;

  if (mode === 'remove') {
    // Find and remove from whichever pile it's in
    let idx = gameState.player.deck.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      gameState.player.deck.splice(idx, 1);
    } else {
      idx = gameState.player.discard.findIndex(c => c.id === card.id);
      if (idx >= 0) gameState.player.discard.splice(idx, 1);
    }
    addLog(`Removed ${card.name} from deck.`);
  } else {
    // Find the actual card object in deck/discard and upgrade it
    const actual = gameState.player.deck.find(c => c.id === card.id)
      || gameState.player.discard.find(c => c.id === card.id);
    if (actual) {
      upgradeCard(actual);
      addLog(`Upgraded ${actual.name}!`);
    }
  }
  advanceAfterNode();
}

// === SHOP ===
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
      <div class="shop-remove ${gold >= CARD_REMOVE_PRICE ? '' : 'shop-item-expensive'}"
           onclick="${gold >= CARD_REMOVE_PRICE ? 'openShopRemove()' : ''}">
        Remove a card — 💰 ${CARD_REMOVE_PRICE}
      </div>
      <button class="btn btn-skip" onclick="advanceAfterNode()">Leave</button>
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

function openShopRemove() {
  gameState._upgradeMode = 'remove';
  gameState._returnToShop = true;
  gameState.phase = GAME_PHASES.CARD_UPGRADE;
  renderGame();
}

function openCardRemove() {
  openShopRemove();
}

// === EVENTS ===
function renderEvent() {
  const eventId = gameState._currentEvent;
  const event = EVENTS[eventId];
  if (!event) return '<div class="screen"><p>Unknown event</p></div>';

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
      renderGame();
      return;
    }
    if (choice.reward.specificCard) {
      const card = createCard(choice.reward.specificCard);
      if (card) {
        gameState.player.deck.push(card);
        addLog(`Gained ${card.name}!`);
      }
    }
    if (choice.reward.cardReward) {
      gameState._rewardCards = getRewardCards(choice.reward.cardCount || 3);
      gameState.phase = GAME_PHASES.CARD_REWARD;
      renderGame();
      return;
    }
  }

  addLog(choice.result);
  advanceAfterNode();
}

// === NPC (kept for compatibility but simplified) ===
function renderNpc() {
  return `
    <div class="screen npc-screen">
      <p class="npc-text">No one has anything to say right now.</p>
      <button class="btn btn-skip" onclick="returnToMap()">Leave</button>
    </div>
  `;
}

function openNpc() { returnToMap(); }
function doAcceptQuest() {}
function doTurnInQuest() {}
function nextNpc() { returnToMap(); }
function getAvailableQuestsAtLocation() { return []; }

// === TREASURE (used by events) ===
function openTreasure() { returnToMap(); }
