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
    rewards: { gold: 8, cardReward: true },
    mapPos: { x: 50, y: 88 }, // percent position on map
  },
  village: {
    name: 'Village',
    type: LOCATION_TYPES.HUB,
    description: 'A weathered hamlet at the crossroads. Merchants trade and elders share wisdom.',
    connections: ['misty_shore', 'dark_forest', 'ancient_temple', 'wanderers_camp'],
    features: ['shop', 'rest', 'npc'],
    npcs: ['elder', 'merchant'],
    mapPos: { x: 35, y: 70 },
  },
  dark_forest: {
    name: 'Dark Forest',
    type: LOCATION_TYPES.BATTLE,
    description: 'Twisted trees block the sun. Something powerful stirs in the shadows.',
    connections: ['village', 'lava_bridge'],
    enemy: 'forest_wyrm',
    rewards: { gold: 12, item: 'fire_rune', cardReward: true },
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
    mapPos: { x: 70, y: 50 },
  },
  wanderers_camp: {
    name: "Wanderer's Camp",
    type: LOCATION_TYPES.CAMP,
    description: 'A lone traveler sits by a crackling fire, offering rest — or a gamble.',
    connections: ['village'],
    features: ['rest', 'event'],
    event: 'wanderers_gamble',
    mapPos: { x: 65, y: 75 },
  },
  lava_bridge: {
    name: 'Lava Bridge',
    type: LOCATION_TYPES.GATE,
    description: 'A narrow stone bridge spans a river of molten lava. Ancient fire runes glow on the archway.',
    connections: ['dark_forest', 'volcano_peak'],
    requires: 'fire_rune',
    mapPos: { x: 20, y: 33 },
  },
  crystal_cave: {
    name: 'Crystal Cave',
    type: LOCATION_TYPES.TREASURE,
    description: 'Prismatic crystals line the walls. A healing spring bubbles at the center.',
    connections: ['ancient_temple'],
    requires: 'crystal_key',
    rewards: { rareCard: true, healFull: true },
    mapPos: { x: 75, y: 30 },
  },
  volcano_peak: {
    name: 'Volcano Peak',
    type: LOCATION_TYPES.BATTLE,
    description: 'The summit burns. An ancient ember titan guards the path to the dragon.',
    connections: ['lava_bridge', 'dragons_lair'],
    enemy: 'ember_titan',
    rewards: { gold: 20, item: 'dragon_crown', cardReward: true },
    mapPos: { x: 40, y: 18 },
  },
  dragons_lair: {
    name: "Dragon's Lair",
    type: LOCATION_TYPES.BOSS,
    description: 'The final challenge. The Ancient Dragon awaits in its mountain throne.',
    connections: ['volcano_peak'],
    requires: 'dragon_crown',
    enemy: 'ancient_dragon',
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
    description: 'An ancient altar glows with faint energy. A sacrifice might yield power.',
    choices: [
      { text: 'Offer 8 HP to the altar', cost: { hp: 8 }, reward: { rareCard: true }, result: 'The altar flares with light. Power surges into a card.' },
      { text: 'Walk away', cost: null, reward: null, result: 'You leave the altar undisturbed.' },
    ],
  },
  wanderers_gamble: {
    title: "The Wanderer's Gamble",
    description: '"Care to test your luck, traveler?" The wanderer grins, shuffling strange cards.',
    choices: [
      { text: 'Pay 10 HP to gamble', cost: { hp: 10 }, reward: { cardReward: true, cardCount: 2 }, result: 'Pain courses through you, but new power materializes.' },
      { text: 'Decline politely', cost: null, reward: null, result: 'The wanderer shrugs and stokes the fire.' },
    ],
  },
};

// Shop card pool with prices
const SHOP_CARDS = [
  { templateKey: 'fire_blast', price: 15 },
  { templateKey: 'tidal_wave', price: 15 },
  { templateKey: 'earthquake', price: 15 },
  { templateKey: 'lightning', price: 15 },
  { templateKey: 'dragon_breath', price: 20 },
  { templateKey: 'inferno', price: 12 },
  { templateKey: 'ice_barrier', price: 10 },
  { templateKey: 'fortify', price: 12 },
  { templateKey: 'second_wind', price: 12 },
  { templateKey: 'healing_rain', price: 10 },
];

const CARD_REMOVE_PRICE = 10;

// Rare cards (for treasure/events)
const RARE_CARD_TEMPLATES = {
  dragon_fury: {
    name: 'Dragon Fury',
    type: CARD_TYPES.ATTACK,
    element: null,
    cost: 2,
    damage: 16,
    block: 0,
    effects: [{ type: 'burn', value: 3, duration: 2 }],
    description: 'Deal 16 damage. Apply 3 Burn for 2 turns.',
    image: 'images/card_dragon_breath.png', // reuse existing for now
  },
  ancient_ward: {
    name: 'Ancient Ward',
    type: CARD_TYPES.BLOCK,
    element: null,
    cost: 2,
    damage: 0,
    block: 16,
    effects: [{ type: 'thorns', value: 4, duration: 3 }],
    description: 'Gain 16 Block. Gain 4 Thorns for 3 turns.',
    image: 'images/card_dragon_scales.png',
  },
  elemental_surge: {
    name: 'Elemental Surge',
    type: CARD_TYPES.SKILL,
    element: null,
    cost: 1,
    damage: 0,
    block: 0,
    effects: [{ type: 'gainEnergy', value: 2 }, { type: 'draw', value: 2 }],
    description: 'Gain 2 Energy. Draw 2 cards.',
    image: 'images/card_second_wind.png',
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
