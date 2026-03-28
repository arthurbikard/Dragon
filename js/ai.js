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
  // === EASY TIER ===
  {
    id: 'young_drake',
    name: 'Young Drake',
    element: ELEMENTS.FIRE,
    hp: 38,
    maxHp: 38,
    image: 'images/enemy_young_drake.png',
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 7, weight: 3 },
      { type: INTENT_TYPES.DEFEND, block: 5, weight: 2 },
      { type: INTENT_TYPES.ATTACK, damage: 10, weight: 1 },
    ],
  },
  {
    id: 'flame_serpent',
    name: 'Flame Serpent',
    element: ELEMENTS.FIRE,
    hp: 32,
    maxHp: 32,
    image: 'images/enemy_young_drake.png',
    // Burns you every turn — rewards fast kills and cleanse
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 5, effects: [{ type: 'burn', value: 2, duration: 3 }], weight: 3 },
      { type: INTENT_TYPES.ATTACK, damage: 8, weight: 2 },
      { type: INTENT_TYPES.BUFF, effects: [{ type: 'burn', value: 3, duration: 2 }], weight: 1 },
    ],
  },

  // === MEDIUM TIER ===
  {
    id: 'thornback',
    name: 'Thornback',
    element: ELEMENTS.EARTH,
    hp: 44,
    maxHp: 44,
    image: 'images/enemy_forest_wyrm.png',
    // Thorns but lower — still punishes multi-hit but not devastating
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 7, weight: 3 },
      { type: INTENT_TYPES.DEFEND, block: 6, effects: [{ type: 'thorns', value: 2, duration: 2 }], weight: 2 },
      { type: INTENT_TYPES.HEAVY_ATTACK, damage: 12, weight: 1 },
    ],
  },
  {
    id: 'storm_caller',
    name: 'Storm Caller',
    element: ELEMENTS.AIR,
    hp: 38,
    maxHp: 38,
    image: 'images/enemy_storm_wyrm.png',
    // Buffs itself — snowballs but lower HP so fast kills work
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 7, weight: 3 },
      { type: INTENT_TYPES.BUFF, effects: [{ type: 'strength', value: 1 }], weight: 2 },
      { type: INTENT_TYPES.ATTACK, damage: 10, weight: 1 },
    ],
  },

  // === ELITE TIER ===
  {
    id: 'iron_golem',
    name: 'Iron Golem',
    element: ELEMENTS.EARTH,
    hp: 52,
    maxHp: 52,
    image: 'images/enemy_ember_titan.png',
    // Alternates block and attacks. Lower HP makes it beatable.
    intents: [
      { type: INTENT_TYPES.DEFEND, block: 12, weight: 3 },
      { type: INTENT_TYPES.ATTACK, damage: 12, weight: 2 },
      { type: INTENT_TYPES.HEAVY_ATTACK, damage: 18, weight: 1 },
    ],
  },
  {
    id: 'shadow_wyrm',
    name: 'Shadow Wyrm',
    element: ELEMENTS.AIR,
    hp: 46,
    maxHp: 46,
    image: 'images/enemy_storm_wyrm.png',
    // Applies weak — manageable if you have cleanse or block
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 9, weight: 3 },
      { type: INTENT_TYPES.BUFF, effects: [{ type: 'weak', value: 1, duration: 2 }], weight: 2 },
      { type: INTENT_TYPES.HEAVY_ATTACK, damage: 15, weight: 1 },
    ],
  },

  // === BOSS ===
  {
    id: 'ancient_dragon',
    name: 'Ancient Dragon',
    element: ELEMENTS.EARTH,
    hp: 140,
    maxHp: 140,
    image: 'images/enemy_ancient_dragon.png',
    // Multi-phase: mixes everything. Requires a well-built deck.
    intents: [
      { type: INTENT_TYPES.ATTACK, damage: 13, weight: 3 },
      { type: INTENT_TYPES.HEAVY_ATTACK, damage: 24, weight: 1 },
      { type: INTENT_TYPES.DEFEND, block: 14, effects: [{ type: 'thorns', value: 2, duration: 2 }], weight: 2 },
      { type: INTENT_TYPES.BUFF, effects: [{ type: 'strength', value: 2 }], weight: 1 },
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
    strength: 0, // +damage per attack
    intents: template.intents,
    nextIntent: null,
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

  if (enemy.hp <= 0) {
    handleDeath();
    return;
  }

  addLog(`${enemy.name} uses ${INTENT_ICONS[intent.type]} ${intent.type}!`);

  // Execute intent
  if (intent.damage) {
    let dmg = intent.damage + (enemy.strength || 0);
    const vuln = player.statuses.find(s => s.type === 'vulnerable');
    if (vuln) dmg = Math.floor(dmg * 1.5);
    // Weak reduces incoming damage from enemy? No — weak applies to the weakened entity's OWN attacks
    const weak = enemy.statuses.find(s => s.type === 'weak');
    if (weak) dmg = Math.floor(dmg * 0.75);

    applyDamage(player, dmg);
    addLog(`${enemy.name} deals ${dmg} damage.`);
  }

  if (intent.block) {
    enemy.block += intent.block;
    addLog(`${enemy.name} gains ${intent.block} Block.`);
  }

  if (intent.effects) {
    for (const effect of intent.effects) {
      if (effect.type === 'strength') {
        enemy.strength = (enemy.strength || 0) + effect.value;
        addLog(`${enemy.name} gains ${effect.value} Strength!`);
      } else if (['burn', 'vulnerable', 'weak'].includes(effect.type)) {
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
