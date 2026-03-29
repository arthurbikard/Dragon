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
const TILE_SIZE = 70;

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
    // Positions calibrated to coast_map_bg.png (1200x500 canvas, TILE_SIZE=70)
    // Map layout left→right: Lighthouse, Veering, Whispering Cliffs, Misthaven, Reef Shallows, Wild Shore
    misthaven_village: {
      name: 'Misthaven Village',
      biome: 'coast',
      type: LOC_TYPES.NPC,
      hasShop: true,
      x: 13.2, y: 4.3,
      paths: ['whispering_cliffs', 'shore_market', 'thornwood_gate'],
      description: 'A weathered fishing village nestled in a sheltered cove. The elder keeps watch from his hearth.',
      image: 'images/loc_village.png',
      npc: {
        name: 'Village Elder',
        image: 'images/npc_elder.png',
        icon: '👴',
        dialogue: [
          'Welcome to Misthaven, traveler. Strange things stir beyond our shores.',
          'An ancient dragon has awakened deep in the volcanic heart of our islands.',
          'Its corruption spreads — the fog, the dead fish, the twisted creatures on the cliffs.',
          'You must journey inland. Seek the old temples. Find a way to stop it.',
          'Start by heading west along the Whispering Cliffs. But beware what lurks there.',
          'Do not rush to face the Storm Drake at the gate. Many brave souls have tried and perished. Build your strength first — fight, trade, explore.',
          'One more thing — the old lighthouse beyond the Veiled Sea holds a flame of great power. A serpent guards it now, but if you can best the creature... that flame could turn the tide against the drake.',
        ],
      },
    },
    whispering_cliffs: {
      name: 'Whispering Cliffs',
      biome: 'coast',
      type: LOC_TYPES.BATTLE,
      x: 12.5, y: 3.3,
      paths: ['misthaven_village', 'the_wild_shore'],
      description: 'The wind howls through narrow passages in the rock. Claw marks scar the cliff face.',
      image: 'images/loc_misty_shore.png',
      enemy: 'young_drake',
      goldReward: 10,
    },
    veiled_sea: {
      name: 'The Veiled Sea',
      biome: 'coast',
      type: LOC_TYPES.EVENT,
      x: 8, y: 2.2,
      paths: ['shore_market', 'windward_lighthouse', 'reef_shallows'],
      description: 'A fisherman offers passage across the fog-shrouded waters. An ancient shrine lies on a rocky islet beyond the veil.',
      image: 'images/loc_crystal_cave.png',
      eventKey: 'sea_cave_event',
    },
    windward_lighthouse: {
      name: 'Windward Lighthouse',
      biome: 'coast',
      type: LOC_TYPES.ELITE,
      x: 4.8, y: 4,
      paths: ['veiled_sea'],
      description: 'The great lighthouse stands dark. A powerful serpent has coiled around its base, snuffing the flame.',
      image: 'images/loc_dragons_lair.png',
      enemy: 'coastal_serpent',
      goldReward: 20,
      specialReward: 'lighthouse_flame',
    },
    shore_market: {
      name: 'Shore Market',
      biome: 'coast',
      type: LOC_TYPES.SHOP,
      x: 11.7, y: 5.1,
      paths: ['misthaven_village', 'veiled_sea'],
      description: 'Merchants have set up stalls along the coast road. A good place to prepare for what lies ahead.',
      image: 'images/loc_village.png',
    },
    reef_shallows: {
      name: 'Great North Bay',
      biome: 'coast',
      type: LOC_TYPES.REST,
      x: 13.1, y: 1.8,
      paths: ['veiled_sea', 'the_wild_shore'],
      description: 'Sheltered tidal pools steam gently in the afternoon sun. A safe place to rest and mend.',
      image: 'images/loc_wanderers_camp.png',
    },
    the_wild_shore: {
      name: 'The Wild Shore',
      biome: 'coast',
      type: LOC_TYPES.BATTLE,
      x: 14.5, y: 3.1,
      paths: ['whispering_cliffs', 'reef_shallows', 'thornwood_gate'],
      description: 'Driftwood and wreckage litter the untamed beach. Creatures nest among the debris.',
      image: 'images/loc_misty_shore.png',
      enemy: 'young_drake',
      goldReward: 12,
    },
    thornwood_gate: {
      name: 'Thornwood Gate',
      biome: 'coast',
      type: LOC_TYPES.MINI_BOSS,
      x: 16.3, y: 3.3,
      paths: ['misthaven_village', 'the_wild_shore'],
      description: 'The coast gives way to twisted trees. A powerful storm drake guards the passage into the Thornwood Forest.',
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
  lighthouse_flame: {
    name: 'Lighthouse Flame', type: CARD_TYPES.SKILL, element: null,
    cost: 1, damage: 0, block: 0,
    effects: [{ type: 'burn', value: 5, duration: 4 }, { type: 'gainEnergy', value: 1 }],
    description: 'Apply 5 Burn for 4 turns. Gain 1 Energy. A flame that never dies.',
    image: 'images/card_inferno.png', rarity: 'legendary',
  },
};

// === ITEMS (for compatibility) ===
const ITEMS = {};

// === CAMPAIGN STATE ===

function createCampaignState() {
  const explored = new Set();
  const visited = new Set();

  // Start at starting_village, explore it and its connections
  const startId = 'misthaven_village';
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
    battlesSinceRest: REST_COOLDOWN_BATTLES, // start able to rest; resets to 0 after each rest
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
  // Re-explore connections from this location (in case they weren't revealed)
  const loc = WORLD.locations[locId];
  if (loc && loc.paths) {
    loc.paths.forEach(id => gameState.campaign.explored.add(id));
  }
}

function getConnectedLocations() {
  const currentLoc = WORLD.locations[gameState.campaign.currentLocation];
  if (!currentLoc) return [];
  return currentLoc.paths
    .filter(id => WORLD.locations[id])
    .map(id => ({ id, ...WORLD.locations[id] }));
}

const REST_COOLDOWN_BATTLES = 2; // must fight at least 2 battles between rests

function canRest() {
  return gameState.campaign.battlesSinceRest >= REST_COOLDOWN_BATTLES;
}

// Ambush: chance of random combat when traveling
const AMBUSH_CHANCE = 0.15; // 15% for non-combat locations
const AMBUSH_CHANCE_CLEARED = 0.30; // 30% for cleared combat locations

function rollAmbush(locId) {
  const loc = WORLD.locations[locId];
  if (!loc) return null;
  if (gameState.campaign.visited.size <= 3) return null; // safe early game

  const isCombat = [LOC_TYPES.BATTLE, LOC_TYPES.ELITE, LOC_TYPES.MINI_BOSS, LOC_TYPES.BOSS].includes(loc.type);
  // No ambush on uncleared combat locations (already fighting there)
  if (isCombat && !gameState.campaign.cleared.has(locId)) return null;

  const chance = isCombat ? AMBUSH_CHANCE_CLEARED : AMBUSH_CHANCE;

  if (Math.random() < chance) {
    const biome = WORLD.biomes[loc.biome];
    if (!biome || !biome.enemyPool || biome.enemyPool.length === 0) return null;
    return biome.enemyPool[Math.floor(Math.random() * biome.enemyPool.length)];
  }
  return null;
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
