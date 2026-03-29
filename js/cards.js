// Card definitions and deck management

const ELEMENTS = {
  FIRE: 'fire',
  WATER: 'water',
  EARTH: 'earth',
  AIR: 'air',
};

const CARD_TYPES = {
  ATTACK: 'attack',
  BLOCK: 'block',
  SKILL: 'skill',
};

// Element strength: key beats value (1.5x damage)
const ELEMENT_STRENGTH = {
  [ELEMENTS.FIRE]: ELEMENTS.EARTH,
  [ELEMENTS.EARTH]: ELEMENTS.AIR,
  [ELEMENTS.AIR]: ELEMENTS.WATER,
  [ELEMENTS.WATER]: ELEMENTS.FIRE,
};

const ELEMENT_ICONS = {
  [ELEMENTS.FIRE]: '🔥',
  [ELEMENTS.WATER]: '🌊',
  [ELEMENTS.EARTH]: '🪨',
  [ELEMENTS.AIR]: '💨',
};

const ELEMENT_COLORS = {
  [ELEMENTS.FIRE]: { primary: '#dc2626', secondary: '#f97316', bg: 'linear-gradient(135deg, #dc2626, #f97316)' },
  [ELEMENTS.WATER]: { primary: '#2563eb', secondary: '#06b6d4', bg: 'linear-gradient(135deg, #2563eb, #06b6d4)' },
  [ELEMENTS.EARTH]: { primary: '#65a30d', secondary: '#a16207', bg: 'linear-gradient(135deg, #65a30d, #a16207)' },
  [ELEMENTS.AIR]: { primary: '#8b5cf6', secondary: '#06b6d4', bg: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' },
};

// All card templates (used to create card instances with unique IDs)
const CARD_TEMPLATES = {
  // === FIRE CARDS ===
  fire_strike: {
    name: 'Fire Strike',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.FIRE,
    cost: 1,
    damage: 5,
    block: 0,
    effects: [],
    description: 'Deal 5 damage.',
    image: 'images/card_fire_strike.png',
  },
  fire_blast: {
    name: 'Fire Blast',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.FIRE,
    cost: 2,
    damage: 12,
    block: 0,
    effects: [],
    description: 'Deal 12 damage.',
    image: 'images/card_fire_blast.png',
  },
  ember: {
    name: 'Ember',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.FIRE,
    cost: 1,
    damage: 4,
    block: 0,
    effects: [{ type: 'burn', value: 3, duration: 2 }],
    description: 'Deal 4 damage. Apply 3 Burn for 2 turns.',
    image: 'images/card_ember.png',
  },
  flame_shield: {
    name: 'Flame Shield',
    type: CARD_TYPES.BLOCK,
    element: ELEMENTS.FIRE,
    cost: 1,
    damage: 0,
    block: 4,
    effects: [],
    description: 'Gain 4 Block.',
    image: 'images/card_flame_shield.png',
  },
  inferno: {
    name: 'Inferno',
    type: CARD_TYPES.SKILL,
    element: ELEMENTS.FIRE,
    cost: 2,
    damage: 0,
    block: 0,
    effects: [{ type: 'burn', value: 4, duration: 3 }],
    description: 'Apply 4 Burn for 3 turns.',
    image: 'images/card_inferno.png',
  },

  // === WATER CARDS ===
  water_bolt: {
    name: 'Water Bolt',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.WATER,
    cost: 1,
    damage: 5,
    block: 0,
    effects: [],
    description: 'Deal 5 damage.',
    image: 'images/card_water_bolt.png',
  },
  tidal_wave: {
    name: 'Tidal Wave',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.WATER,
    cost: 2,
    damage: 12,
    block: 3,
    effects: [],
    description: 'Deal 12 damage. Gain 3 Block.',
    image: 'images/card_tidal_wave.png',
  },
  ice_barrier: {
    name: 'Ice Barrier',
    type: CARD_TYPES.BLOCK,
    element: ELEMENTS.WATER,
    cost: 1,
    damage: 0,
    block: 6,
    effects: [],
    description: 'Gain 6 Block.',
    image: 'images/card_ice_barrier.png',
  },
  healing_rain: {
    name: 'Healing Rain',
    type: CARD_TYPES.SKILL,
    element: ELEMENTS.WATER,
    cost: 1,
    damage: 0,
    block: 0,
    effects: [{ type: 'heal', value: 5 }],
    description: 'Heal 5 HP.',
    image: 'images/card_healing_rain.png',
  },
  cleanse: {
    name: 'Cleanse',
    type: CARD_TYPES.SKILL,
    element: ELEMENTS.WATER,
    cost: 1,
    damage: 0,
    block: 0,
    effects: [{ type: 'cleanse' }, { type: 'heal', value: 2 }],
    description: 'Remove all debuffs. Heal 2 HP.',
    image: 'images/card_cleanse.png',
  },

  // === EARTH CARDS ===
  rock_throw: {
    name: 'Rock Throw',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.EARTH,
    cost: 1,
    damage: 5,
    block: 0,
    effects: [],
    description: 'Deal 5 damage.',
    image: 'images/card_rock_throw.png',
  },
  earthquake: {
    name: 'Earthquake',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.EARTH,
    cost: 2,
    damage: 11,
    block: 0,
    effects: [{ type: 'vulnerable', value: 1, duration: 2 }],
    description: 'Deal 11 damage. Apply 1 Vulnerable for 2 turns.',
    image: 'images/card_earthquake.png',
  },
  stone_wall: {
    name: 'Stone Wall',
    type: CARD_TYPES.BLOCK,
    element: ELEMENTS.EARTH,
    cost: 1,
    damage: 0,
    block: 6,
    effects: [],
    description: 'Gain 6 Block.',
    image: 'images/card_stone_wall.png',
  },
  fortify: {
    name: 'Fortify',
    type: CARD_TYPES.BLOCK,
    element: ELEMENTS.EARTH,
    cost: 2,
    damage: 0,
    block: 10,
    effects: [],
    description: 'Gain 10 Block.',
    image: 'images/card_fortify.png',
  },
  thorns: {
    name: 'Thorns',
    type: CARD_TYPES.SKILL,
    element: ELEMENTS.EARTH,
    cost: 1,
    damage: 0,
    block: 0,
    effects: [{ type: 'thorns', value: 3, duration: 3 }],
    description: 'Gain 3 Thorns for 3 turns.',
    image: 'images/card_thorns.png',
  },

  // === AIR CARDS ===
  gust: {
    name: 'Gust',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.AIR,
    cost: 1,
    damage: 3,
    block: 0,
    effects: [{ type: 'draw', value: 1 }],
    description: 'Deal 3 damage. Draw 1 card.',
    image: 'images/card_gust.png',
  },
  lightning: {
    name: 'Lightning',
    type: CARD_TYPES.ATTACK,
    element: ELEMENTS.AIR,
    cost: 2,
    damage: 14,
    block: 0,
    effects: [],
    description: 'Deal 14 damage.',
    image: 'images/card_lightning.png',
  },
  wind_shield: {
    name: 'Wind Shield',
    type: CARD_TYPES.BLOCK,
    element: ELEMENTS.AIR,
    cost: 1,
    damage: 0,
    block: 5,
    effects: [{ type: 'draw', value: 1 }],
    description: 'Gain 5 Block. Draw 1 card.',
    image: 'images/card_wind_shield.png',
  },
  tailwind: {
    name: 'Tailwind',
    type: CARD_TYPES.SKILL,
    element: ELEMENTS.AIR,
    cost: 0,
    damage: 0,
    block: 0,
    effects: [{ type: 'draw', value: 2 }],
    description: 'Draw 2 cards.',
    image: 'images/card_tailwind.png',
  },
  second_wind: {
    name: 'Second Wind',
    type: CARD_TYPES.SKILL,
    element: ELEMENTS.AIR,
    cost: 1,
    damage: 0,
    block: 0,
    effects: [{ type: 'gainEnergy', value: 2 }],
    description: 'Gain 2 Energy.',
    image: 'images/card_second_wind.png',
  },

  // === NEUTRAL CARDS (reward pool) ===
  // === FILLER (weak starter cards — good remove targets) ===
  stumble: {
    name: 'Stumble',
    type: CARD_TYPES.ATTACK,
    element: null,
    cost: 1,
    damage: 3,
    block: 0,
    effects: [],
    description: 'Deal 3 damage. Clumsy.',
    image: 'images/card_dragon_claw.png',
  },
  brace: {
    name: 'Brace',
    type: CARD_TYPES.BLOCK,
    element: null,
    cost: 1,
    damage: 0,
    block: 3,
    effects: [],
    description: 'Gain 3 Block. Barely.',
    image: 'images/card_dragon_scales.png',
  },

  // === NEUTRAL DRAGON CARDS ===
  dragon_claw: {
    name: 'Dragon Claw',
    type: CARD_TYPES.ATTACK,
    element: null,
    cost: 1,
    damage: 5,
    block: 0,
    effects: [],
    description: 'Deal 5 damage.',
    image: 'images/card_dragon_claw.png',
  },
  dragon_scales: {
    name: 'Dragon Scales',
    type: CARD_TYPES.BLOCK,
    element: null,
    cost: 1,
    damage: 0,
    block: 7,
    effects: [],
    description: 'Gain 7 Block.',
    image: 'images/card_dragon_scales.png',
  },
  dragon_breath: {
    name: 'Dragon Breath',
    type: CARD_TYPES.ATTACK,
    element: null,
    cost: 2,
    damage: 10,
    block: 0,
    effects: [{ type: 'burn', value: 2, duration: 2 }],
    description: 'Deal 10 damage. Apply 2 Burn for 2 turns.',
    image: 'images/card_dragon_breath.png',
  },
};

// Starter deck compositions per element
const STARTER_DECKS = {
  [ELEMENTS.FIRE]: ['fire_strike', 'fire_strike', 'fire_blast', 'ember', 'ember', 'flame_shield', 'flame_shield', 'inferno', 'dragon_claw', 'dragon_scales', 'stumble', 'stumble', 'brace', 'brace'],
  [ELEMENTS.WATER]: ['water_bolt', 'water_bolt', 'tidal_wave', 'ice_barrier', 'ice_barrier', 'healing_rain', 'healing_rain', 'cleanse', 'dragon_claw', 'dragon_scales', 'stumble', 'stumble', 'brace', 'brace'],
  [ELEMENTS.EARTH]: ['rock_throw', 'rock_throw', 'earthquake', 'stone_wall', 'stone_wall', 'fortify', 'thorns', 'thorns', 'dragon_claw', 'dragon_scales', 'stumble', 'stumble', 'brace', 'brace'],
  [ELEMENTS.AIR]: ['gust', 'gust', 'lightning', 'wind_shield', 'wind_shield', 'tailwind', 'tailwind', 'second_wind', 'dragon_claw', 'dragon_scales', 'stumble', 'stumble', 'brace', 'brace'],
};

let _cardId = 0;

function createCard(templateKey) {
  const template = CARD_TEMPLATES[templateKey];
  if (!template) throw new Error(`Unknown card template: ${templateKey}`);
  return {
    ...template,
    templateKey,
    id: _cardId++,
    upgraded: false,
    effects: template.effects.map(e => ({ ...e })),
  };
}

// Upgrade a card in-place: +3 damage or +3 block or -1 cost (min 0)
function upgradeCard(card) {
  if (card.upgraded) return false;
  card.upgraded = true;
  card.name = card.name + '+';

  if (card.damage > 0) {
    card.damage += 3;
    card.description = card.description.replace(/Deal \d+/, `Deal ${card.damage}`);
  } else if (card.block > 0) {
    card.block += 3;
    card.description = card.description.replace(/Gain \d+ Block/, `Gain ${card.block} Block`);
  } else if (card.cost > 0) {
    card.cost -= 1;
  }

  // Buff effects slightly
  for (const fx of card.effects) {
    if (fx.value) fx.value += 1;
  }

  return true;
}

function createDeck(element) {
  const templateKeys = STARTER_DECKS[element];
  return templateKeys.map(key => createCard(key));
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRewardCards(count = 3, excludeElement = null) {
  const allKeys = Object.keys(CARD_TEMPLATES);
  const pool = allKeys.filter(key => {
    const t = CARD_TEMPLATES[key];
    return t.element !== excludeElement || t.element === null;
  });
  const picked = shuffleArray(pool).slice(0, count);
  return picked.map(key => createCard(key));
}
