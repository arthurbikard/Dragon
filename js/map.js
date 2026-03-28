// World map data and state management

const LOCATION_TYPES = {
  BATTLE: 'battle',
  HUB: 'hub',
  GATE: 'gate',
  TEMPLE: 'temple',
  TREASURE: 'treasure',
  CAMP: 'camp',
  BOSS: 'boss',
};

const LOCATIONS = {
  start: {
    name: 'Start',
    type: null,
    description: 'Your journey begins here.',
    connections: ['misty_shore'],
    hidden: true, // not shown on map, just a starting node
  },
  misty_shore: {
    name: 'Misty Shore',
    type: LOCATION_TYPES.BATTLE,
    description: 'Fog rolls over the rocky coast. A young drake lurks in the mist.',
    connections: ['start', 'village'],
    enemy: 'young_drake',
    rewards: { gold: 12, cardReward: true },
    image: 'images/loc_misty_shore.png',
    mapPos: { x: 50, y: 88 },
  },
  village: {
    name: 'Village',
    type: LOCATION_TYPES.HUB,
    description: 'A weathered hamlet at the crossroads. Merchants trade and elders share wisdom.',
    connections: ['misty_shore', 'dark_forest', 'ancient_temple', 'wanderers_camp'],
    features: ['shop', 'rest', 'npc'],
    npcs: ['elder', 'merchant'],
    image: 'images/loc_village.png',
    mapPos: { x: 35, y: 70 },
  },
  dark_forest: {
    name: 'Dark Forest',
    type: LOCATION_TYPES.BATTLE,
    description: 'Twisted trees block the sun. Something powerful stirs in the shadows.',
    connections: ['village', 'lava_bridge'],
    enemy: 'forest_wyrm',
    rewards: { gold: 18, item: 'fire_rune', cardReward: true },
    image: 'images/loc_dark_forest.png',
    mapPos: { x: 25, y: 50 },
  },
  ancient_temple: {
    name: 'Ancient Temple',
    type: LOCATION_TYPES.TEMPLE,
    description: 'Crumbling pillars frame a sacred altar. A priestess tends the eternal flame.',
    connections: ['village', 'crystal_cave'],
    features: ['npc', 'event'],
    npcs: ['priestess'],
    event: 'temple_altar',
    image: 'images/loc_ancient_temple.png',
    mapPos: { x: 70, y: 50 },
  },
  wanderers_camp: {
    name: "Wanderer's Camp",
    type: LOCATION_TYPES.CAMP,
    description: 'A lone traveler sits by a crackling fire, offering rest — or a gamble.',
    connections: ['village'],
    features: ['rest', 'event'],
    event: 'wanderers_gamble',
    image: 'images/loc_wanderers_camp.png',
    mapPos: { x: 65, y: 75 },
  },
  lava_bridge: {
    name: 'Lava Bridge',
    type: LOCATION_TYPES.GATE,
    description: 'A narrow stone bridge spans a river of molten lava. Ancient fire runes glow on the archway.',
    connections: ['dark_forest', 'volcano_peak'],
    requires: 'fire_rune',
    image: 'images/loc_lava_bridge.png',
    mapPos: { x: 20, y: 33 },
  },
  crystal_cave: {
    name: 'Crystal Cave',
    type: LOCATION_TYPES.TREASURE,
    description: 'Prismatic crystals line the walls. A healing spring bubbles at the center.',
    connections: ['ancient_temple'],
    requires: 'crystal_key',
    rewards: { rareCard: true, healFull: true },
    image: 'images/loc_crystal_cave.png',
    mapPos: { x: 75, y: 30 },
  },
  volcano_peak: {
    name: 'Volcano Peak',
    type: LOCATION_TYPES.BATTLE,
    description: 'The summit burns. An ancient ember titan guards the path to the dragon.',
    connections: ['lava_bridge', 'dragons_lair'],
    enemy: 'ember_titan',
    rewards: { gold: 25, item: 'dragon_crown', cardReward: true },
    image: 'images/loc_volcano_peak.png',
    mapPos: { x: 40, y: 18 },
  },
  dragons_lair: {
    name: "Dragon's Lair",
    type: LOCATION_TYPES.BOSS,
    description: 'The final challenge. The Ancient Dragon awaits in its mountain throne.',
    connections: ['volcano_peak'],
    requires: 'dragon_crown',
    enemy: 'ancient_dragon',
    image: 'images/loc_dragons_lair.png',
    mapPos: { x: 50, y: 5 },
  },
};

const ITEMS = {
  fire_rune: {
    name: 'Fire Rune',
    icon: '🔥',
    description: 'A blazing rune that can withstand the heat of the Lava Bridge.',
  },
  crystal_key: {
    name: 'Crystal Key',
    icon: '🔑',
    description: 'A shimmering key that unlocks the Crystal Cave.',
  },
  dragon_crown: {
    name: 'Dragon Crown',
    icon: '👑',
    description: 'A crown of dragonbone. Opens the path to the Dragon\'s Lair.',
  },
};

const EVENTS = {
  temple_altar: {
    title: 'The Sacred Altar',
    description: 'An ancient altar glows with warm energy. It offers a blessing to those who seek it.',
    choices: [
      { text: 'Pray at the altar', cost: null, reward: { rareCard: true, heal: 8 }, result: 'The altar blazes with light. You feel renewed, and power fills a new card.' },
      { text: 'Walk away', cost: null, reward: null, result: 'You leave the altar undisturbed.' },
    ],
  },
  wanderers_gamble: {
    title: "The Wanderer's Gamble",
    description: '"I have something that might interest you, traveler." The wanderer reveals glowing cards.',
    choices: [
      { text: 'Accept the gift', cost: null, reward: { cardReward: true, cardCount: 3 }, result: 'The wanderer smiles and hands you powerful cards.' },
      { text: 'Decline politely', cost: null, reward: null, result: 'The wanderer shrugs and stokes the fire.' },
    ],
  },
};

// Shop card pool with prices
const SHOP_CARDS = [
  { templateKey: 'fire_blast', price: 12 },
  { templateKey: 'tidal_wave', price: 12 },
  { templateKey: 'earthquake', price: 12 },
  { templateKey: 'lightning', price: 12 },
  { templateKey: 'dragon_breath', price: 15 },
  { templateKey: 'inferno', price: 10 },
  { templateKey: 'ice_barrier', price: 8 },
  { templateKey: 'fortify', price: 10 },
  { templateKey: 'second_wind', price: 10 },
  { templateKey: 'healing_rain', price: 8 },
];

const CARD_REMOVE_PRICE = 10;

// Rare cards (for treasure/events)
const RARE_CARD_TEMPLATES = {
  dragon_fury: {
    name: 'Dragon Fury',
    type: CARD_TYPES.ATTACK,
    element: null,
    cost: 2,
    damage: 20,
    block: 0,
    effects: [{ type: 'vulnerable', value: 1, duration: 2 }],
    description: 'Deal 20 damage. Apply Vulnerable for 2 turns.',
    image: 'images/card_dragon_breath.png',
  },
  ancient_ward: {
    name: 'Ancient Ward',
    type: CARD_TYPES.BLOCK,
    element: null,
    cost: 1,
    damage: 0,
    block: 14,
    effects: [{ type: 'thorns', value: 3, duration: 3 }],
    description: 'Gain 14 Block. Gain 3 Thorns for 3 turns.',
    image: 'images/card_dragon_scales.png',
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
  },
};

// --- Campaign state management ---

function createCampaignState() {
  const locationStates = {};
  for (const [id, loc] of Object.entries(LOCATIONS)) {
    locationStates[id] = {
      unlocked: id === 'start' || id === 'misty_shore',
      visited: id === 'start',
      cleared: id === 'start',
    };
  }
  return {
    locationStates,
    currentLocation: 'start',
    inventory: [],
    quests: [],
    gold: 0,
  };
}

function hasItem(itemId) {
  return gameState.campaign.inventory.includes(itemId);
}

function addItem(itemId) {
  if (!hasItem(itemId)) {
    gameState.campaign.inventory.push(itemId);
    addLog(`Found ${ITEMS[itemId].icon} ${ITEMS[itemId].name}!`);
  }
}

function canAccessLocation(locId) {
  const loc = LOCATIONS[locId];
  const state = gameState.campaign.locationStates[locId];
  if (!state.unlocked) return false;
  if (loc.requires && !hasItem(loc.requires)) return false;
  return true;
}

function isConnected(fromId, toId) {
  const from = LOCATIONS[fromId];
  return from.connections.includes(toId);
}

function travelTo(locId) {
  if (!canAccessLocation(locId)) return;
  if (!isConnected(gameState.campaign.currentLocation, locId)) return;

  gameState.campaign.currentLocation = locId;
  gameState.campaign.locationStates[locId].visited = true;

  // Unlock connected locations
  const loc = LOCATIONS[locId];
  for (const connId of loc.connections) {
    gameState.campaign.locationStates[connId].unlocked = true;
  }
}

function clearLocation(locId) {
  gameState.campaign.locationStates[locId].cleared = true;
}

function getAvailableShopCards() {
  return shuffleArray(SHOP_CARDS).slice(0, 4).map(item => ({
    card: createCard(item.templateKey),
    price: item.price,
  }));
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
