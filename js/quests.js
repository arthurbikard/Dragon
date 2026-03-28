// Quest system — simplified for branching map
// NPC quests are replaced by map node choices (rest/upgrade/remove/shop/events)
// This file kept for compatibility with simulate.js

const QUEST_STATUS = { AVAILABLE: 'available', ACTIVE: 'active', COMPLETE: 'complete', TURNED_IN: 'turned_in' };
const NPCS = {};
const QUESTS = {};

function getQuestStatus() { return QUEST_STATUS.AVAILABLE; }
function setQuestStatus() {}
function acceptQuest() {}
function checkQuestCompletion() { return false; }
function turnInQuest() {}
