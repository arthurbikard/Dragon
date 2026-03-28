// Procedural branching map — Slay the Spire style

const NODE_TYPES = {
  BATTLE: 'battle',
  ELITE: 'elite',
  REST: 'rest',
  SHOP: 'shop',
  EVENT: 'event',
  BOSS: 'boss',
};

const NODE_ICONS = {
  [NODE_TYPES.BATTLE]: '⚔️',
  [NODE_TYPES.ELITE]: '💀',
  [NODE_TYPES.REST]: '🔥',
  [NODE_TYPES.SHOP]: '🛒',
  [NODE_TYPES.EVENT]: '❓',
  [NODE_TYPES.BOSS]: '🐉',
};

// Map generation config
const MAP_CONFIG = {
  acts: 4,            // 4 rows of choices before the boss
  nodesPerAct: 3,     // 3 nodes per row
  connectionsMin: 1,  // each node connects to at least 1 in next act
  connectionsMax: 2,  // and at most 2
};

// Act templates — what types of nodes appear at each act level
const ACT_TEMPLATES = [
  // Act 1: Must fight (at least one battle guaranteed by variety check)
  [
    { type: NODE_TYPES.BATTLE, weight: 5 },
    { type: NODE_TYPES.EVENT, weight: 1 },
  ],
  // Act 2: Mix with first elite opportunity
  [
    { type: NODE_TYPES.BATTLE, weight: 2 },
    { type: NODE_TYPES.ELITE, weight: 1 },
    { type: NODE_TYPES.SHOP, weight: 2 },
    { type: NODE_TYPES.EVENT, weight: 1 },
  ],
  // Act 3: Tougher, rest available
  [
    { type: NODE_TYPES.BATTLE, weight: 2 },
    { type: NODE_TYPES.ELITE, weight: 2 },
    { type: NODE_TYPES.REST, weight: 2 },
  ],
  // Act 4: Final prep before boss
  [
    { type: NODE_TYPES.REST, weight: 2 },
    { type: NODE_TYPES.SHOP, weight: 2 },
    { type: NODE_TYPES.ELITE, weight: 1 },
  ],
];

// Enemy pools per difficulty tier
const ENEMY_POOLS = {
  easy: ['young_drake', 'flame_serpent'],
  medium: ['thornback', 'storm_caller'],
  elite: ['iron_golem', 'shadow_wyrm'],
  boss: ['ancient_dragon'],
};

// Event definitions
const EVENTS = {
  ancient_shrine: {
    title: 'Ancient Shrine',
    description: 'A weathered shrine hums with power. An offering might yield something extraordinary.',
    choices: [
      { text: 'Offer 6 HP', cost: { hp: 6 }, reward: { rareCard: true }, result: 'Power surges into a new card.' },
      { text: 'Pray for healing', cost: null, reward: { heal: 10 }, result: 'Warm light washes over you.' },
      { text: 'Walk away', cost: null, reward: null, result: 'You leave the shrine undisturbed.' },
    ],
  },
  wandering_merchant: {
    title: 'Wandering Merchant',
    description: '"I have rare wares, traveler — but they come at a price."',
    choices: [
      { text: 'Buy a rare card (15 gold)', cost: { gold: 15 }, reward: { rareCard: true }, result: 'An extraordinary card changes hands.' },
      { text: 'Remove a card for free', cost: null, reward: { removeCard: true }, result: '"A wise choice. Lighter decks, faster draws."' },
      { text: 'Decline', cost: null, reward: null, result: 'The merchant nods and disappears into the mist.' },
    ],
  },
  dragon_egg: {
    title: 'Dragon Egg',
    description: 'A pulsing dragon egg sits in a nest of embers. It radiates heat.',
    choices: [
      { text: 'Take the egg (gain a rare card)', cost: null, reward: { rareCard: true }, result: 'The egg hatches into a burst of flame. New power courses through you.' },
      { text: 'Warm yourself (heal 8 HP)', cost: null, reward: { heal: 8 }, result: 'The warmth soothes your wounds.' },
    ],
  },
  cursed_chest: {
    title: 'Cursed Chest',
    description: 'A chest wrapped in dark chains. Great power lies within — but at what cost?',
    choices: [
      { text: 'Open it (rare card + lose 10 HP)', cost: { hp: 10 }, reward: { rareCard: true }, result: 'Agony and power, intertwined.' },
      { text: 'Leave it sealed', cost: null, reward: null, result: 'Wisdom over greed.' },
    ],
  },
};

const EVENT_KEYS = Object.keys(EVENTS);

// Shop card pool
// Shop offers BOTH regular cards AND rare cards (for more gold)
const SHOP_CARDS = [
  { templateKey: 'fire_blast', price: 8 },
  { templateKey: 'tidal_wave', price: 8 },
  { templateKey: 'earthquake', price: 8 },
  { templateKey: 'lightning', price: 8 },
  { templateKey: 'dragon_breath', price: 10 },
  { templateKey: 'inferno', price: 8 },
  { templateKey: 'fortify', price: 8 },
  { templateKey: 'second_wind', price: 8 },
  { templateKey: 'healing_rain', price: 6 },
];

const SHOP_RARE_CARDS = [
  { rareKey: 'dragon_fury', price: 20 },
  { rareKey: 'ancient_ward', price: 20 },
  { rareKey: 'elemental_surge', price: 18 },
  { rareKey: 'dragons_bane', price: 18 },
];

const CARD_REMOVE_PRICE = 6;
const SHOP_HEAL_PRICE = 5;
const SHOP_HEAL_AMOUNT = 10;

// Rare cards (from elites, events, treasure)
const RARE_CARD_TEMPLATES = {
  dragon_fury: {
    name: 'Dragon Fury',
    type: CARD_TYPES.ATTACK,
    element: null,
    cost: 2,
    damage: 20,
    block: 0,
    effects: [{ type: 'vulnerable', value: 1, duration: 2 }],
    description: 'Deal 20 damage. Apply Vulnerable 2t.',
    image: 'images/card_dragon_breath.png',
    rarity: 'rare',
  },
  ancient_ward: {
    name: 'Ancient Ward',
    type: CARD_TYPES.BLOCK,
    element: null,
    cost: 1,
    damage: 0,
    block: 14,
    effects: [{ type: 'thorns', value: 3, duration: 3 }],
    description: 'Gain 14 Block. Gain 3 Thorns 3t.',
    image: 'images/card_dragon_scales.png',
    rarity: 'rare',
  },
  elemental_surge: {
    name: 'Elemental Surge',
    type: CARD_TYPES.SKILL,
    element: null,
    cost: 0,
    damage: 0,
    block: 0,
    effects: [{ type: 'gainEnergy', value: 2 }, { type: 'draw', value: 2 }],
    description: 'Gain 2 Energy. Draw 2 cards.',
    image: 'images/card_second_wind.png',
    rarity: 'rare',
  },
  dragons_bane: {
    name: "Dragon's Bane",
    type: CARD_TYPES.ATTACK,
    element: null,
    cost: 1,
    damage: 12,
    block: 4,
    effects: [],
    description: 'Deal 12 damage. Gain 4 Block.',
    image: 'images/card_dragon_claw.png',
    rarity: 'rare',
  },
};

// Items (kept for quest compatibility but simplified)
const ITEMS = {};

// === PROCEDURAL MAP GENERATION ===

function generateMap() {
  const map = {
    acts: [],   // acts[actIndex] = array of nodes
    boss: null, // final boss node
  };

  for (let act = 0; act < MAP_CONFIG.acts; act++) {
    const actNodes = [];
    const template = ACT_TEMPLATES[act];

    for (let i = 0; i < MAP_CONFIG.nodesPerAct; i++) {
      const type = weightedPick(template);
      const node = createMapNode(type, act, i);
      actNodes.push(node);
    }

    // Ensure variety — no act has all the same type
    const types = new Set(actNodes.map(n => n.type));
    if (types.size === 1 && actNodes.length > 1) {
      const altType = template.find(t => t.type !== actNodes[0].type);
      if (altType) actNodes[1].type = altType.type;
    }

    map.acts.push(actNodes);
  }

  // Generate connections (each node connects to 1-2 nodes in next act)
  for (let act = 0; act < MAP_CONFIG.acts - 1; act++) {
    const currentAct = map.acts[act];
    const nextAct = map.acts[act + 1];

    // Ensure every node in next act is reachable
    const reached = new Set();
    for (const node of currentAct) {
      const numConn = 1 + Math.floor(Math.random() * MAP_CONFIG.connectionsMax);
      node.connections = [];
      for (let c = 0; c < numConn && c < nextAct.length; c++) {
        const targetIdx = (currentAct.indexOf(node) + c) % nextAct.length;
        node.connections.push(targetIdx);
        reached.add(targetIdx);
      }
    }
    // Ensure unreached nodes get at least one connection
    for (let i = 0; i < nextAct.length; i++) {
      if (!reached.has(i)) {
        const randomParent = currentAct[Math.floor(Math.random() * currentAct.length)];
        randomParent.connections.push(i);
      }
    }
  }

  // Last act connects to boss
  map.boss = {
    type: NODE_TYPES.BOSS,
    enemy: 'ancient_dragon',
    act: MAP_CONFIG.acts,
    index: 0,
    visited: false,
  };
  for (const node of map.acts[MAP_CONFIG.acts - 1]) {
    node.connections = [0]; // all connect to boss
  }

  return map;
}

function createMapNode(type, act, index) {
  const node = {
    type,
    act,
    index,
    visited: false,
    connections: [],
  };

  // Assign enemy based on type and act
  if (type === NODE_TYPES.BATTLE) {
    const pool = act < 2 ? ENEMY_POOLS.easy : ENEMY_POOLS.medium;
    node.enemy = pool[Math.floor(Math.random() * pool.length)];
    node.goldReward = 10 + act * 5;
  } else if (type === NODE_TYPES.ELITE) {
    node.enemy = ENEMY_POOLS.elite[Math.floor(Math.random() * ENEMY_POOLS.elite.length)];
    node.goldReward = 20 + act * 5;
  } else if (type === NODE_TYPES.EVENT) {
    node.eventKey = EVENT_KEYS[Math.floor(Math.random() * EVENT_KEYS.length)];
  }

  return node;
}

function weightedPick(options) {
  const totalWeight = options.reduce((s, o) => s + o.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const opt of options) {
    roll -= opt.weight;
    if (roll <= 0) return opt.type;
  }
  return options[0].type;
}

// === CAMPAIGN STATE ===

function createCampaignState() {
  return {
    map: generateMap(),
    currentAct: 0,
    currentNode: null, // null = haven't chosen first node yet
    gold: 0,
    inventory: [],
  };
}

function getAvailableNodes() {
  const campaign = gameState.campaign;

  // Already past the boss
  if (campaign.currentAct > MAP_CONFIG.acts) return [];

  // At boss level
  if (campaign.currentAct >= MAP_CONFIG.acts) {
    return [campaign.map.boss];
  }

  // First pick of the game or after advancing
  if (campaign.currentNode === null) {
    if (campaign._lastConnections && campaign.currentAct > 0) {
      // Use connections from previous node to filter this act's nodes
      const actNodes = campaign.map.acts[campaign.currentAct];
      if (!actNodes) return [campaign.map.boss];
      return campaign._lastConnections
        .map(idx => actNodes[idx])
        .filter(n => n != null);
    }
    // Very first pick — all act 0 nodes
    return campaign.map.acts[0] || [];
  }

  // Shouldn't reach here normally (currentNode set means we're mid-node)
  return [];
}

function getCurrentMapNode() {
  const campaign = gameState.campaign;
  if (campaign.currentNode === null) return null;
  if (campaign.currentAct >= MAP_CONFIG.acts) return campaign.map.boss;
  return campaign.map.acts[campaign.currentAct][campaign.currentNode];
}

function selectMapNode(actIndex, nodeIndex) {
  const campaign = gameState.campaign;
  campaign.currentAct = actIndex;
  campaign.currentNode = nodeIndex;

  const node = actIndex >= MAP_CONFIG.acts
    ? campaign.map.boss
    : campaign.map.acts[actIndex][nodeIndex];
  node.visited = true;

  return node;
}

function advanceToNextAct() {
  // Save connections from current node before advancing
  const current = getCurrentMapNode();
  if (current && current.connections) {
    gameState.campaign._lastConnections = current.connections;
  }
  gameState.campaign.currentAct++;
  gameState.campaign.currentNode = null; // reset — will be set when next node is picked
}

function getAvailableShopCards() {
  // Mix of 3 regular + 1 rare
  const regular = shuffleArray(SHOP_CARDS).slice(0, 3).map(item => ({
    card: createCard(item.templateKey),
    price: item.price,
    type: 'card',
  }));
  const rareItem = shuffleArray(SHOP_RARE_CARDS)[0];
  const rareCard = getRareCardByKey(rareItem.rareKey);
  const rare = rareCard ? [{
    card: rareCard,
    price: rareItem.price,
    type: 'rare',
  }] : [];
  return [...regular, ...rare];
}

function getRareCardByKey(key) {
  const template = RARE_CARD_TEMPLATES[key];
  if (!template) return null;
  return {
    ...template,
    templateKey: key,
    id: _cardId++,
    effects: template.effects.map(e => ({ ...e })),
  };
}

function getRareCard() {
  const keys = Object.keys(RARE_CARD_TEMPLATES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const template = RARE_CARD_TEMPLATES[key];
  return {
    ...template,
    templateKey: key,
    id: _cardId++,
    effects: template.effects.map(e => ({ ...e })),
  };
}
