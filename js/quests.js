// Quest definitions and NPC dialogues

const QUEST_STATUS = {
  AVAILABLE: 'available',
  ACTIVE: 'active',
  COMPLETE: 'complete',
  TURNED_IN: 'turned_in',
};

const NPCS = {
  elder: {
    name: 'Village Elder',
    icon: '👴',
    location: 'village',
    greeting: 'Welcome, dragon hunter. Dark times have come to the Isles.',
  },
  merchant: {
    name: 'Merchant',
    icon: '🧔',
    location: 'village',
    greeting: 'Looking to trade? I deal in cards and curiosities.',
  },
  priestess: {
    name: 'Temple Priestess',
    icon: '🧙‍♀️',
    location: 'ancient_temple',
    greeting: 'The temple has long awaited a champion.',
  },
};

const QUESTS = {
  slay_dragon: {
    name: 'Slay the Dragon',
    giver: 'elder',
    description: 'Defeat the Ancient Dragon in its lair to free the Isles.',
    dialogue: {
      offer: 'An Ancient Dragon terrorizes these lands from its mountain lair. We need a champion to slay it. Will you take up the quest?',
      accept: 'May the elements guide you. You\'ll need to find a way through the Lava Bridge and the Volcano Peak before reaching its lair.',
      active: 'The dragon still lives. Travel north through the Dark Forest and find a way to its lair.',
      complete: 'You have done what none could. The Isles are free. You are legend.',
    },
    condition: () => gameState.campaign.locationStates.dragons_lair.cleared,
    reward: { victory: true },
  },
  fire_rune_trade: {
    name: 'The Fire Rune',
    giver: 'merchant',
    description: 'Bring a Fire Rune to the merchant for a card upgrade.',
    dialogue: {
      offer: 'I\'ve heard the Dark Forest hides a Fire Rune — powerful magic. Bring it to me and I\'ll enhance one of your cards.',
      accept: 'Venture into the Dark Forest and defeat whatever guards it. The rune will be your reward.',
      active: 'Have you found the Fire Rune yet? The Dark Forest holds many dangers.',
      turnin: 'Magnificent! This rune pulses with power. As promised, let me enhance a card for you.',
      done: 'A pleasure doing business. May your enhanced cards serve you well.',
    },
    condition: () => hasItem('fire_rune'),
    reward: { cardUpgrade: true },
  },
  temple_cleansing: {
    name: 'Temple Cleansing',
    giver: 'priestess',
    description: 'Clear the Dark Forest to lift its curse on the temple.',
    dialogue: {
      offer: 'The darkness in the forest corrupts our sacred grounds. Clear the forest of its guardian, and I will grant you the Crystal Key to the hidden cave.',
      accept: 'Defeat the creature in the Dark Forest and return to me. The temple\'s blessing goes with you.',
      active: 'The forest\'s corruption still lingers. Have you defeated its guardian?',
      turnin: 'I can feel the corruption lifting. The temple breathes again. Take this Crystal Key — the Crystal Cave holds great power.',
      done: 'The temple is at peace. Use the Crystal Key wisely.',
    },
    condition: () => gameState.campaign.locationStates.dark_forest.cleared,
    reward: { item: 'crystal_key' },
  },
};

// --- Quest state management ---

function getQuestStatus(questId) {
  const quest = gameState.campaign.quests.find(q => q.id === questId);
  return quest ? quest.status : QUEST_STATUS.AVAILABLE;
}

function setQuestStatus(questId, status) {
  const existing = gameState.campaign.quests.find(q => q.id === questId);
  if (existing) {
    existing.status = status;
  } else {
    gameState.campaign.quests.push({ id: questId, status });
  }
}

function acceptQuest(questId) {
  setQuestStatus(questId, QUEST_STATUS.ACTIVE);
  addLog(`Quest accepted: ${QUESTS[questId].name}`);
}

function checkQuestCompletion(questId) {
  const quest = QUESTS[questId];
  const status = getQuestStatus(questId);
  if (status === QUEST_STATUS.ACTIVE && quest.condition()) {
    setQuestStatus(questId, QUEST_STATUS.COMPLETE);
    return true;
  }
  return false;
}

function turnInQuest(questId) {
  const quest = QUESTS[questId];
  const reward = quest.reward;

  setQuestStatus(questId, QUEST_STATUS.TURNED_IN);
  addLog(`Quest complete: ${quest.name}`);

  if (reward.item) {
    addItem(reward.item);
  }
  if (reward.gold) {
    gameState.campaign.gold += reward.gold;
  }
  if (reward.cardUpgrade) {
    gameState._pendingCardUpgrade = true;
  }
  if (reward.victory) {
    // handled by final boss defeat
  }
}

function getAvailableQuestsAtLocation(locId) {
  const results = [];
  for (const [id, quest] of Object.entries(QUESTS)) {
    const npc = NPCS[quest.giver];
    if (npc.location !== locId) continue;

    const status = getQuestStatus(id);
    if (status === QUEST_STATUS.AVAILABLE) {
      results.push({ questId: id, quest, npc, action: 'offer' });
    } else if (status === QUEST_STATUS.ACTIVE) {
      checkQuestCompletion(id);
      const updatedStatus = getQuestStatus(id);
      if (updatedStatus === QUEST_STATUS.COMPLETE) {
        results.push({ questId: id, quest, npc, action: 'turnin' });
      } else {
        results.push({ questId: id, quest, npc, action: 'active' });
      }
    } else if (status === QUEST_STATUS.TURNED_IN) {
      results.push({ questId: id, quest, npc, action: 'done' });
    }
  }
  return results;
}
