// AI enemy definitions and behavior

const INTENT_TYPES = {
  ATTACK: 'attack',
  DEFEND: 'defend',
  BUFF: 'buff',
  HEAVY_ATTACK: 'heavy_attack',
};

const INTENT_ICONS = {
  [INTENT_TYPES.ATTACK]: '⚔️',
  [INTENT_TYPES.DEFEND]: '🛡️',
  [INTENT_TYPES.BUFF]: '✨',
  [INTENT_TYPES.HEAVY_ATTACK]: '💥',
};

const AI_ENEMIES = [
  // Misty Shore: Young Drake (easy)
  {
    id: 'young_drake',
    name: 'Young Drake',
    element: ELEMENTS.FIRE,
    hp: 35,
    maxHp: 35,
    image: 'images/enemy_young_drake.png',
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 6, weight: 3 },
      { type: INTENT_TYPES.DEFEND, block: 5, weight: 2 },
      { type: INTENT_TYPES.ATTACK, damage: 4, effects: [{ type: 'burn', value: 2, duration: 2 }], weight: 1 },
    ],
  },
  // Dark Forest: Forest Wyrm (medium)
  {
    id: 'forest_wyrm',
    name: 'Forest Wyrm',
    element: ELEMENTS.EARTH,
    hp: 45,
    maxHp: 45,
    image: 'images/enemy_storm_wyrm.png', // reuse for now
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 7, weight: 3 },
      { type: INTENT_TYPES.DEFEND, block: 8, effects: [{ type: 'thorns', value: 2, duration: 2 }], weight: 2 },
      { type: INTENT_TYPES.BUFF, effects: [{ type: 'vulnerable', value: 1, duration: 2 }], weight: 1 },
    ],
  },
  // Volcano Peak: Ember Titan (hard)
  {
    id: 'ember_titan',
    name: 'Ember Titan',
    element: ELEMENTS.FIRE,
    hp: 60,
    maxHp: 60,
    image: 'images/enemy_young_drake.png', // reuse for now
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 10, weight: 2 },
      { type: INTENT_TYPES.HEAVY_ATTACK, damage: 18, weight: 1 },
      { type: INTENT_TYPES.DEFEND, block: 10, weight: 2 },
      { type: INTENT_TYPES.BUFF, effects: [{ type: 'burn', value: 4, duration: 3 }], weight: 1 },
    ],
  },
  // Dragon's Lair: Ancient Dragon (boss)
  {
    id: 'ancient_dragon',
    name: 'Ancient Dragon',
    element: ELEMENTS.EARTH,
    hp: 80,
    maxHp: 80,
    image: 'images/enemy_ancient_dragon.png',
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 12, weight: 2 },
      { type: INTENT_TYPES.HEAVY_ATTACK, damage: 22, weight: 1 },
      { type: INTENT_TYPES.DEFEND, block: 14, effects: [{ type: 'thorns', value: 3, duration: 2 }], weight: 2 },
      { type: INTENT_TYPES.BUFF, effects: [{ type: 'burn', value: 4, duration: 3 }, { type: 'vulnerable', value: 1, duration: 2 }], weight: 1 },
    ],
  },
];

function createAIEnemy(indexOrId) {
  let template;
  if (typeof indexOrId === 'string') {
    template = AI_ENEMIES.find(e => e.id === indexOrId);
  } else {
    template = AI_ENEMIES[Math.min(indexOrId, AI_ENEMIES.length - 1)];
  }
  if (!template) template = AI_ENEMIES[0];
  return {
    name: template.name,
    element: template.element,
    hp: template.hp,
    maxHp: template.maxHp,
    image: template.image,
    block: 0,
    statuses: [],
    intents: template.intents,
    nextIntent: null,
    // AI enemies don't use cards/deck
    hand: [],
    deck: [],
    discard: [],
    energy: 0,
  };
}

function pickIntent(enemy) {
  const intents = enemy.intents;
  const totalWeight = intents.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const intent of intents) {
    roll -= intent.weight;
    if (roll <= 0) return { ...intent, effects: (intent.effects || []).map(e => ({ ...e })) };
  }
  return { ...intents[0] };
}

function executeAITurn() {
  const enemy = gameState.enemy;
  const player = gameState.player;
  const intent = enemy.nextIntent;

  if (!intent) {
    endTurn();
    return;
  }

  // statuses and block reset already handled by startTurn()

  if (enemy.hp <= 0) {
    handleDeath();
    return;
  }

  addLog(`${enemy.name} uses ${INTENT_ICONS[intent.type]} ${intent.type}!`);

  // Execute intent
  if (intent.damage) {
    let dmg = intent.damage;
    const vuln = player.statuses.find(s => s.type === 'vulnerable');
    if (vuln) dmg = Math.floor(dmg * 1.5);

    applyDamage(player, dmg);
    addLog(`${enemy.name} deals ${dmg} damage.`);
  }

  if (intent.block) {
    enemy.block += intent.block;
    addLog(`${enemy.name} gains ${intent.block} Block.`);
  }

  if (intent.effects) {
    for (const effect of intent.effects) {
      if (['burn', 'vulnerable'].includes(effect.type)) {
        applyEffect(effect, enemy, player);
      } else if (['thorns'].includes(effect.type)) {
        applyEffect(effect, enemy, enemy);
      }
    }
  }

  if (player.hp <= 0) {
    handleDeath();
    return;
  }

  // Pick next intent for display
  enemy.nextIntent = pickIntent(enemy);

  // End AI turn, back to player
  setTimeout(() => {
    startTurn('player');
  }, 800);
}
