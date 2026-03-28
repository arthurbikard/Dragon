// World map data, locations, fog of war, and navigation

const LOC_TYPES = {
  BATTLE: 'battle',
  ELITE: 'elite',
  MINI_BOSS: 'mini_boss',
  BOSS: 'boss',
  REST: 'rest',
  SHOP: 'shop',
  EVENT: 'event',
  NPC: 'npc',
  TREASURE: 'treasure',
};

const LOC_ICONS = {
  [LOC_TYPES.BATTLE]: '⚔️',
  [LOC_TYPES.ELITE]: '💀',
  [LOC_TYPES.MINI_BOSS]: '🐲',
  [LOC_TYPES.BOSS]: '🐉',
  [LOC_TYPES.REST]: '🔥',
  [LOC_TYPES.SHOP]: '🛒',
  [LOC_TYPES.EVENT]: '❓',
  [LOC_TYPES.NPC]: '💬',
  [LOC_TYPES.TREASURE]: '💎',
};

// Tile size for positioning (pixels per grid unit)
const TILE_SIZE = 80;

// === WORLD DEFINITION ===

const WORLD = {
  biomes: {
    coast: {
      name: 'Whispering Coast',
      description: 'Fog rolls across rocky shores. The corruption has not yet reached here — but the signs are growing.',
      cardPool: ['water_bolt', 'tidal_wave', 'ice_barrier', 'healing_rain', 'cleanse', 'dragon_claw', 'dragon_scales', 'flame_shield'],
      enemyPool: ['young_drake', 'coastal_serpent'],
      elitePool: ['coastal_serpent'],
      palette: { bg: '#0d1b2a', path: 'rgba(74, 122, 154, 0.4)', accent: '#4a7a9a' },
    },
  },

  locations: {
    // === WHISPERING COAST ===
    starting_village: {
      name: 'Starting Village',
      biome: 'coast',
      type: LOC_TYPES.NPC,
      x: 2, y: 8,
      paths: ['fishermans_cove'],
      description: 'A quiet fishing village at the edge of the world. The elder waits by the fire.',
      image: 'images/loc_village.png',
      npc: {
        name: 'Village Elder',
        image: 'images/npc_elder.png',
        icon: '👴',
        dialogue: [
          'Welcome, traveler. Strange things stir in the east.',
          'An ancient dragon has awakened deep in the volcanic heart of our islands.',
          'Its corruption spreads — the fog, the dead fish, the twisted creatures.',
          'You must journey inland. Seek the old temples. Find a way to stop it.',
          'Take this advice: build your strength before facing the darkness.',
        ],
      },
    },
    fishermans_cove: {
      name: "Fisherman's Cove",
      biome: 'coast',
      type: LOC_TYPES.BATTLE,
      x: 4, y: 6,
      paths: ['starting_village', 'sea_cave', 'shore_market'],
      description: 'Nets lie torn on the rocks. Something lurks in the shallows.',
      image: 'images/loc_misty_shore.png',
      enemy: 'young_drake',
      goldReward: 10,
    },
    sea_cave: {
      name: 'Sea Cave',
      biome: 'coast',
      type: LOC_TYPES.EVENT,
      x: 3, y: 4,
      paths: ['fishermans_cove', 'lighthouse'],
      description: 'A dark cave mouth gapes in the cliff face. Strange sounds echo from within.',
      image: 'images/loc_crystal_cave.png',
      eventKey: 'sea_cave_event',
    },
    shore_market: {
      name: 'Shore Market',
      biome: 'coast',
      type: LOC_TYPES.SHOP,
      x: 6, y: 7,
      paths: ['fishermans_cove', 'tide_pools', 'driftwood_camp'],
      description: 'A few merchants still trade here, despite the dangers.',
      image: 'images/loc_village.png',
    },
    lighthouse: {
      name: 'Lighthouse',
      biome: 'coast',
      type: LOC_TYPES.ELITE,
      x: 2, y: 2,
      paths: ['sea_cave', 'tide_pools'],
      description: 'The light has gone dark. A powerful creature has claimed the tower.',
      image: 'images/loc_dragons_lair.png',
      enemy: 'coastal_serpent',
      goldReward: 20,
    },
    tide_pools: {
      name: 'Tide Pools',
      biome: 'coast',
      type: LOC_TYPES.REST,
      x: 5, y: 3,
      paths: ['lighthouse', 'shore_market', 'coast_end'],
      description: 'Warm pools among the rocks. A good place to rest and prepare.',
      image: 'images/loc_wanderers_camp.png',
    },
    driftwood_camp: {
      name: 'Driftwood Camp',
      biome: 'coast',
      type: LOC_TYPES.BATTLE,
      x: 8, y: 6,
      paths: ['shore_market', 'coast_end'],
      description: 'Wreckage from ships piles high. Creatures nest among the debris.',
      image: 'images/loc_misty_shore.png',
      enemy: 'young_drake',
      goldReward: 12,
    },
    coast_end: {
      name: 'Storm Bluff',
      biome: 'coast',
      type: LOC_TYPES.MINI_BOSS,
      x: 8, y: 3,
      paths: ['tide_pools', 'driftwood_camp'],
      description: 'The path ends at a windswept cliff. A powerful drake guards the passage to the forest beyond.',
      image: 'images/loc_volcano_peak.png',
      enemy: 'storm_drake',
      goldReward: 25,
      blessing: 'tide_walker',
    },
  },
};

// === EVENTS ===

const EVENTS = {
  sea_cave_event: {
    title: 'The Sea Cave',
    description: 'Phosphorescent algae casts an eerie blue glow. Deep inside, you find a shrine and a sealed chest.',
    choices: [
      { text: 'Open the chest (risk)', cost: { hp: 5 }, reward: { rareCard: true }, result: 'The chest\'s guardian spirit lashes out — but you claim the power within.' },
      { text: 'Pray at the shrine', cost: null, reward: { heal: 12 }, result: 'The shrine\'s warmth washes over you, mending your wounds.' },
      { text: 'Leave carefully', cost: null, reward: null, result: 'You retreat from the cave. Some treasures aren\'t worth the risk.' },
    ],
  },
};

// === SHOP ===

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

// === RARE CARDS ===

const RARE_CARD_TEMPLATES = {
  dragon_fury: {
    name: 'Dragon Fury', type: CARD_TYPES.ATTACK, element: null,
    cost: 2, damage: 20, block: 0,
    effects: [{ type: 'vulnerable', value: 1, duration: 2 }],
    description: 'Deal 20 damage. Apply Vulnerable 2t.',
    image: 'images/card_dragon_breath.png', rarity: 'rare',
  },
  ancient_ward: {
    name: 'Ancient Ward', type: CARD_TYPES.BLOCK, element: null,
    cost: 1, damage: 0, block: 14,
    effects: [{ type: 'thorns', value: 3, duration: 3 }],
    description: 'Gain 14 Block. Gain 3 Thorns 3t.',
    image: 'images/card_dragon_scales.png', rarity: 'rare',
  },
  elemental_surge: {
    name: 'Elemental Surge', type: CARD_TYPES.SKILL, element: null,
    cost: 0, damage: 0, block: 0,
    effects: [{ type: 'gainEnergy', value: 2 }, { type: 'draw', value: 2 }],
    description: 'Gain 2 Energy. Draw 2 cards.',
    image: 'images/card_second_wind.png', rarity: 'rare',
  },
  dragons_bane: {
    name: "Dragon's Bane", type: CARD_TYPES.ATTACK, element: null,
    cost: 1, damage: 12, block: 4, effects: [],
    description: 'Deal 12 damage. Gain 4 Block.',
    image: 'images/card_dragon_claw.png', rarity: 'rare',
  },
};

// === ITEMS (for compatibility) ===
const ITEMS = {};

// === CAMPAIGN STATE ===

function createCampaignState() {
  const explored = new Set();
  const visited = new Set();

  // Start at starting_village, explore it and its connections
  const startId = 'starting_village';
  explored.add(startId);
  visited.add(startId);
  const startLoc = WORLD.locations[startId];
  if (startLoc && startLoc.paths) {
    startLoc.paths.forEach(id => explored.add(id));
  }

  return {
    explored,     // visible on map
    visited,      // player has been here
    cleared: new Set(), // battle/event completed
    currentLocation: startId,
    gold: 0,
    blessings: {},
  };
}

// === NAVIGATION ===

function isExplored(locId) {
  return gameState.campaign.explored.has(locId);
}

function isVisited(locId) {
  return gameState.campaign.visited.has(locId);
}

function isCleared(locId) {
  return gameState.campaign.cleared.has(locId);
}

function canTravelTo(locId) {
  const campaign = gameState.campaign;
  const currentLocId = campaign.currentLocation;
  const currentLoc = WORLD.locations[currentLocId];
  if (!currentLoc) return false;

  // Must be connected to current location
  if (!currentLoc.paths.includes(locId)) return false;

  // Must be explored
  if (!campaign.explored.has(locId)) return false;

  // If current location is an uncleared combat node, you can only
  // go BACK (to a visited location) — you must fight to go forward
  const isCombatType = [LOC_TYPES.BATTLE, LOC_TYPES.ELITE, LOC_TYPES.MINI_BOSS, LOC_TYPES.BOSS].includes(currentLoc.type);
  if (isCombatType && !campaign.cleared.has(currentLocId)) {
    // Can only retreat to a previously visited location
    if (!campaign.visited.has(locId)) return false;
  }

  // Check blessing requirements
  const targetLoc = WORLD.locations[locId];
  if (targetLoc && targetLoc.requiresBlessing) {
    if (!campaign.blessings[targetLoc.requiresBlessing]) return false;
  }

  return true;
}

function travelTo(locId) {
  if (!canTravelTo(locId)) return false;

  const campaign = gameState.campaign;
  campaign.currentLocation = locId;
  campaign.visited.add(locId);

  // Reveal connected locations
  const loc = WORLD.locations[locId];
  if (loc && loc.paths) {
    loc.paths.forEach(id => campaign.explored.add(id));
  }

  return true;
}

function clearLocation(locId) {
  gameState.campaign.cleared.add(locId);
}

function getConnectedLocations() {
  const currentLoc = WORLD.locations[gameState.campaign.currentLocation];
  if (!currentLoc) return [];
  return currentLoc.paths
    .filter(id => WORLD.locations[id])
    .map(id => ({ id, ...WORLD.locations[id] }));
}

function getLocationPixelPos(loc) {
  return {
    x: loc.x * TILE_SIZE,
    y: loc.y * TILE_SIZE,
  };
}

// === REWARD HELPERS ===

function getBiomeCardPool(biomeId) {
  const biome = WORLD.biomes[biomeId];
  if (!biome || !biome.cardPool) return Object.keys(CARD_TEMPLATES);
  return biome.cardPool;
}

function getBiomeRewardCards(biomeId, count) {
  const pool = getBiomeCardPool(biomeId);
  const picked = shuffleArray(pool).slice(0, count || 3);
  return picked.map(key => {
    try { return createCard(key); } catch (e) { return null; }
  }).filter(c => c !== null);
}

function getAvailableShopCards() {
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

function getRareCard() {
  const keys = Object.keys(RARE_CARD_TEMPLATES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return getRareCardByKey(key);
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

// Kept for simulator compatibility
function getAvailableNodes() {
  return getConnectedLocations().filter(loc => canTravelTo(loc.id));
}

function getCurrentMapNode() {
  const locId = gameState.campaign.currentLocation;
  return WORLD.locations[locId] || null;
}

function advanceToNextAct() {
  // No-op in world map (kept for compatibility)
}

function advanceAfterNode() {
  returnToMap();
}
