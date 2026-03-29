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
    forest: {
      name: 'Thornwood Forest',
      description: 'Twisted trees claw at a bruised sky. Bioluminescent fungi pulse in the undergrowth. The corruption runs deep here.',
      cardPool: ['rock_throw', 'earthquake', 'stone_wall', 'fortify', 'thorns', 'dragon_claw', 'dragon_scales', 'healing_rain'],
      enemyPool: ['thornback', 'fungal_crawler'],
      elitePool: ['giant_spider'],
      palette: { bg: '#0a1a0a', path: 'rgba(80, 160, 80, 0.3)', accent: '#4a8a4a' },
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
      paths: ['misthaven_village', 'the_wild_shore', 'spring_of_tides'],
      description: 'The coast gives way to twisted trees. A powerful storm drake guards the passage into the Thornwood Forest.',
      image: 'images/loc_volcano_peak.png',
      enemy: 'storm_drake',
      goldReward: 25,
      blessing: 'tide_walker',
    },

    // === THORNWOOD FOREST ===
    spring_of_tides: {
      name: 'Spring of Tides',
      biome: 'forest',
      type: LOC_TYPES.REST,
      x: 17.5, y: 3.3,
      paths: ['thornwood_gate', 'forest_edge'],
      requiresBlessing: 'tide_walker',
      description: 'A crystal-clear spring bubbles up from the earth where coast meets forest. The Tide Walker blessing hums in resonance. A place to recover before the journey ahead.',
      image: 'images/loc_wanderers_camp.png',
    },
    forest_edge: {
      name: 'Forest Edge',
      biome: 'forest',
      type: LOC_TYPES.BATTLE,
      x: 18.5, y: 3.3,
      paths: ['spring_of_tides', 'hermits_hut', 'mushroom_grove'],
      description: 'The treeline looms ahead, dark and unwelcoming. Twisted branches form an archway. Something watches from the shadows.',
      image: 'images/loc_misty_shore.png',
      enemy: 'thornback',
      goldReward: 15,
    },
    // --- EASY PATH (south): Forest Edge → Hermit → Shop → Shrine → Boss ---
    hermits_hut: {
      name: "Hermit's Hut",
      biome: 'forest',
      type: LOC_TYPES.NPC,
      x: 20, y: 4.5,
      paths: ['forest_edge', 'woodcutters_camp', 'mushroom_grove'],
      description: 'A ramshackle hut covered in moss and wards. Smoke curls from a crooked chimney. Books are stacked in every window.',
      image: 'images/loc_village.png',
      npc: {
        name: 'Hermit Scholar',
        image: 'images/npc_elder.png',
        icon: '📖',
        dialogue: [
          'Ah, a traveler. You survived the Storm Drake — impressive.',
          'I have spent decades studying the corruption. It began here, in this forest, when the first seal broke.',
          'The ancient guardians bound the dragon with four elemental seals. This forest held the Seal of Earth.',
          'Something shattered it from within. The trees twisted overnight. The animals... changed.',
          'Deep in the forest, a great treant has been corrupted. It guards the path to the mountains.',
          'Beware the Spider\'s Nest to the north. A terrible creature lairs there — but it guards something valuable.',
          'You will need every advantage you can find to face what lies ahead.',
        ],
      },
    },
    // --- HARD PATH (north): Forest Edge → Mushroom Grove → Ruined Bridge → Spider/Deep Woods → Stump ---
    mushroom_grove: {
      name: 'Mushroom Grove',
      biome: 'forest',
      type: LOC_TYPES.EVENT,
      x: 19.5, y: 1.8,
      paths: ['forest_edge', 'hermits_hut', 'ruined_bridge'],
      description: 'Giant luminescent mushrooms tower overhead, casting an eerie blue-purple glow. Spores drift lazily in the still air.',
      image: 'images/loc_crystal_cave.png',
      eventKey: 'mushroom_grove_event',
    },
    ruined_bridge: {
      name: 'Ruined Bridge',
      biome: 'forest',
      type: LOC_TYPES.BATTLE,
      x: 21, y: 2,
      paths: ['mushroom_grove', 'spiders_nest', 'elder_tree'],
      description: 'A stone bridge spans a dark ravine. Half the stones have crumbled away. Something lurks beneath.',
      image: 'images/loc_misty_shore.png',
      enemy: 'fungal_crawler',
      goldReward: 15,
    },
    deep_woods: {
      name: 'Deep Woods',
      biome: 'forest',
      type: LOC_TYPES.BATTLE,
      x: 23, y: 3,
      paths: ['woodcutters_camp', 'ancient_stump'],
      description: 'The canopy is so thick no light reaches the forest floor. Bioluminescent fungi are the only guide.',
      image: 'images/loc_misty_shore.png',
      enemy: 'thornback',
      goldReward: 18,
    },
    spiders_nest: {
      name: "Spider's Nest",
      biome: 'forest',
      type: LOC_TYPES.ELITE,
      x: 22.5, y: 1,
      paths: ['ruined_bridge'],
      description: 'Webs thick as rope span between the dead trees. Bones of previous victims hang suspended in silk cocoons.',
      image: 'images/loc_dragons_lair.png',
      enemy: 'giant_spider',
      goldReward: 25,
      specialReward: 'ancient_ward',
    },
    ancient_stump: {
      name: 'Ancient Stump',
      biome: 'forest',
      type: LOC_TYPES.REST,
      x: 24.5, y: 2,
      paths: ['deep_woods', 'forest_heart'],
      description: 'A massive stump, wide as a house, from a tree felled centuries ago. Warm moss makes a natural bed. The corruption cannot reach here.',
      image: 'images/loc_wanderers_camp.png',
    },
    woodcutters_camp: {
      name: "Woodcutter's Camp",
      biome: 'forest',
      type: LOC_TYPES.SHOP,
      x: 21.5, y: 5,
      paths: ['hermits_hut', 'corrupted_shrine', 'deep_woods'],
      description: 'Abandoned axes and saws lie rusting. A few traders have set up here, dealing in salvage from the old forest roads.',
      image: 'images/loc_village.png',
    },
    corrupted_shrine: {
      name: 'Corrupted Shrine',
      biome: 'forest',
      type: LOC_TYPES.EVENT,
      x: 24, y: 4.5,
      paths: ['woodcutters_camp', 'forest_heart'],
      description: 'A stone shrine to the old earth guardian, now cracked and oozing dark sap. The seal glyph on its face is shattered.',
      image: 'images/loc_crystal_cave.png',
      eventKey: 'corrupted_shrine_event',
    },
    elder_tree: {
      name: 'Elder Magic Tree',
      biome: 'forest',
      type: LOC_TYPES.EVENT,
      x: 23, y: 1,
      paths: ['ruined_bridge', 'ancient_stump', 'deep_woods'],
      description: 'An enormous oak, untouched by corruption, pulses with ancient magic. Its roots reach deep into the earth. It offers to trade wisdom for wisdom.',
      image: 'images/loc_crystal_cave.png',
      eventKey: 'elder_tree_event',
    },
    forest_heart: {
      name: 'Forest Heart',
      biome: 'forest',
      type: LOC_TYPES.MINI_BOSS,
      x: 26, y: 3,
      paths: ['ancient_stump', 'corrupted_shrine'],
      description: 'At the center of the forest stands a massive corrupted treant, its roots choking the land. The path to the mountains lies beyond.',
      image: 'images/loc_volcano_peak.png',
      enemy: 'corrupted_treant',
      goldReward: 30,
      blessing: 'storm_shield',
    },
  },
};

// === EVENTS ===

const EVENTS = {
  sea_cave_event: {
    title: 'The Sea Cave',
    description: 'Phosphorescent algae casts an eerie blue glow. Deep inside, you find a shrine and a sealed chest.',
    choices: [
      { text: 'Open the chest (risk)', cost: { hp: 10 }, reward: { rareCard: true }, result: 'The chest\'s guardian spirit lashes out — but you claim the power within.' },
      { text: 'Pray at the shrine', cost: null, reward: { heal: 12 }, result: 'The shrine\'s warmth washes over you, mending your wounds.' },
      { text: 'Leave carefully', cost: null, reward: null, result: 'You retreat from the cave. Some treasures aren\'t worth the risk.' },
    ],
  },
  mushroom_grove_event: {
    title: 'The Mushroom Grove',
    description: 'Enormous glowing mushrooms surround you. Their spores smell sweet — intoxicating. A circle of smaller fungi forms a ring on the ground.',
    choices: [
      { text: 'Eat the glowing mushroom', cost: { hp: 8 }, reward: { cardReward: true, cardCount: 3 }, result: 'The spores burn your throat — but visions flood your mind. You see new paths, new possibilities.' },
      { text: 'Rest in the fairy ring', cost: null, reward: { heal: 15 }, result: 'You wake feeling restored, as if the forest itself healed you. Hours — or days — may have passed.' },
      { text: 'Harvest spores carefully', cost: null, reward: { rareCard: true }, result: 'You collect the luminous spores. Their power crystallizes into something useful.' },
    ],
  },
  elder_tree_event: {
    title: 'The Elder Tree',
    description: 'The ancient oak speaks in rustling leaves: "Give me something of yours, and I shall give you something of mine."',
    choices: [
      { text: 'Offer a card to the tree', cost: null, reward: { removeCard: true }, result: 'The tree absorbs your offering. Its branches shiver, and a glowing seed falls into your hand — a new card forms from the wood.' },
      { text: 'Ask for its blessing', cost: null, reward: { heal: 20, cardReward: true, cardCount: 2 }, result: 'Warm golden sap flows over you, healing your wounds. Leaves spiral down, carrying knowledge of forest magic.' },
      { text: 'Bow and leave', cost: null, reward: null, result: 'The tree rustles in acknowledgment. Perhaps another time.' },
    ],
  },
  corrupted_shrine_event: {
    title: 'The Corrupted Shrine',
    description: 'The shattered seal of the Earth Guardian oozes dark energy. Fragments of the old binding spell still flicker in the cracks.',
    choices: [
      { text: 'Touch the broken seal', cost: { hp: 12 }, reward: { rareCard: true }, result: 'Dark energy surges through you. It hurts — but you absorb a fragment of the guardian\'s power.' },
      { text: 'Meditate before the shrine', cost: null, reward: { heal: 10, removeCard: true }, result: 'The old magic is faint but pure. It helps you shed what you don\'t need.' },
      { text: 'Study the glyphs', cost: null, reward: { cardReward: true, cardCount: 2 }, result: 'The ancient symbols reveal forgotten techniques. You learn something new.' },
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
    image: 'images/card_lighthouse_flame.png', rarity: 'legendary',
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

// Cards with rarity 'legendary' are excluded from random rare pools (only from special rewards)
function getRareCard() {
  const keys = Object.keys(RARE_CARD_TEMPLATES).filter(k => RARE_CARD_TEMPLATES[k].rarity !== 'legendary');
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
