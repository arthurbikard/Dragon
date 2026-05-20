#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');

// Stub browser globals
global.document = { addEventListener: () => {}, querySelector: () => null, getElementById: () => ({ innerHTML: '' }), createElement: () => ({ className: '', style: {}, textContent: '', remove() {} }), body: { appendChild() {} } };
global.window = { addEventListener: () => {}, location: { reload: () => {} } };
global.setTimeout = (fn) => fn();
global.requestAnimationFrame = (fn) => fn();
global.navigator = { clipboard: { writeText: () => Promise.resolve() } };
global.GAME_VERSION = '0';
global.renderGame = () => {};
global.showNotification = () => {};

const SRC = path.join(__dirname, 'js');
for (const f of ['icons.js', 'cards.js', 'ai.js', 'map.js', 'quests.js', 'game.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f });
}
for (const f of ['ui.js', 'map-ui.js']) {
  try { vm.runInThisContext(fs.readFileSync(path.join(SRC, f), 'utf8'), { filename: f }); } catch (e) {}
}
renderGame = () => {};
showNotification = () => {};

// Agent for combat
const AGENT = {
  pickCard(hand, energy, actor, opponent) {
    const playable = hand.filter(c => c.cost <= energy);
    if (playable.length === 0) return null;
    const hpRatio = actor.hp / actor.maxHp;
    const intent = opponent.nextIntent;
    const enemyAttacking = intent && (intent.type === 'attack' || intent.type === 'heavy_attack');
    const incomingDamage = enemyAttacking ? (intent.damage || 0) : 0;
    const needsBlock = incomingDamage > actor.block;
    // Heal when low
    if (hpRatio < 0.4) {
      const healers = playable.filter(c => c.effects.some(e => e.type === 'heal'));
      if (healers.length > 0) return healers[0];
    }
    // Block heavy attacks
    if (needsBlock && incomingDamage > 10) {
      const blockers = playable.filter(c => c.block > 0);
      if (blockers.length > 0) return blockers.reduce((a, b) => a.block > b.block ? a : b);
    }
    // Free cards
    const free = playable.filter(c => c.cost === 0);
    if (free.length > 0) return free[0];
    // Energy gain
    if (playable.length > 2) {
      const eg = playable.filter(c => c.effects.some(e => e.type === 'gainEnergy'));
      if (eg.length > 0) return eg[0];
    }
    // Best damage
    const attacks = playable.filter(c => c.damage > 0);
    if (attacks.length > 0) return attacks.reduce((a, b) => (a.damage / a.cost) > (b.damage / b.cost) ? a : b);
    // Block
    if (needsBlock) {
      const blockers = playable.filter(c => c.block > 0);
      if (blockers.length > 0) return blockers.reduce((a, b) => a.block > b.block ? a : b);
    }
    // Draw
    const drawers = playable.filter(c => c.effects.some(e => e.type === 'draw'));
    if (drawers.length > 0) return drawers[0];
    return playable[0];
  }
};

// Start game
const elem = process.argv[2] || 'fire';
startAIGame(elem);
gameState.phase = GAME_PHASES.MAP;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function status() {
  const p = gameState.player;
  const c = gameState.campaign;
  const deck = [...p.deck, ...p.discard, ...p.hand];
  const dmg = deck.reduce((s, c) => s + (c.damage || 0), 0);
  const blk = deck.reduce((s, c) => s + (c.block || 0), 0);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  HP: ${p.hp}/${p.maxHp}  |  Gold: ${c.gold}  |  Deck: ${deck.length} cards (dmg:${dmg} blk:${blk})`);
  console.log(`  At: ${WORLD.locations[c.currentLocation].name}`);
}

function showNav() {
  status();
  const loc = WORLD.locations[gameState.campaign.currentLocation];
  const conns = loc.paths.filter(id => canTravelTo(id));
  console.log('\n  Where to go?');
  conns.forEach((id, i) => {
    const l = WORLD.locations[id];
    const cl = gameState.campaign.cleared.has(id) ? ' ✓' : '';
    const warn = !cl && [LOC_TYPES.MINI_BOSS, LOC_TYPES.BOSS, LOC_TYPES.ELITE].includes(l.type) ? ' ⚠️' : '';
    console.log(`  ${i + 1}. ${l.name} (${l.type})${cl}${warn}`);
  });
  console.log('');
  rl.question('  > ', ans => {
    const idx = parseInt(ans) - 1;
    if (idx >= 0 && idx < conns.length) {
      travelTo(conns[idx]);
      const amb = rollAmbush(conns[idx]);
      if (amb) {
        console.log('\n  ⚠ AMBUSH!');
        setupAIBattleByEnemy(amb);
        prepareBattle();
        startTurn('player');
        runBattle();
        return;
      }
      enterLocation();
    } else {
      showNav();
    }
  });
}

function runBattle() {
  const enemy = gameState.enemy;
  console.log(`\n  ⚔ Battle: ${enemy.name} (${enemy.hp}/${enemy.maxHp} HP, ${enemy.element})`);
  let turns = 0;
  while (gameState.phase === GAME_PHASES.BATTLE && turns < 100) {
    if (gameState.currentTurn === 'player') {
      turns++;
      let cards = 0;
      while (gameState.phase === GAME_PHASES.BATTLE && cards < 20) {
        const card = AGENT.pickCard(gameState.player.hand, gameState.player.energy, gameState.player, gameState.enemy);
        if (!card) break;
        const idx = gameState.player.hand.findIndex(c => c.id === card.id);
        if (idx < 0) break;
        playCard(idx);
        cards++;
        if (gameState.phase !== GAME_PHASES.BATTLE) break;
      }
      if (gameState.phase === GAME_PHASES.BATTLE) endTurn();
    } else {
      if (gameState.currentTurn === 'enemy' && gameState.phase === GAME_PHASES.BATTLE) endTurn();
    }
  }
  const won = gameState.enemy && gameState.enemy.hp <= 0;
  console.log(`  Result: ${won ? 'WON' : 'LOST'} — HP: ${gameState.player.hp}/${gameState.player.maxHp}, Enemy: ${gameState.enemy ? gameState.enemy.hp : 'dead'} HP`);
  console.log(`  (${turns} turns)`);
  if (gameState.player.hp <= 0) { console.log('\n  💀 YOU DIED'); rl.close(); return; }
  afterBattle();
}

function afterBattle() {
  if (gameState.phase === GAME_PHASES.CARD_REWARD) {
    const cards = gameState._rewardCards || [];
    if (cards.length > 0) {
      console.log('\n  Card reward:');
      cards.forEach((c, i) => {
        const fx = c.effects.map(e => e.type + (e.value ? ':' + e.value : '')).join(', ');
        console.log(`    ${i + 1}. ${c.name} (cost:${c.cost} dmg:${c.damage} blk:${c.block}${fx ? ' ' + fx : ''}) ${c.rarity || ''}`);
      });
      rl.question('  Pick (1-' + cards.length + ') or s to skip: ', ans => {
        if (ans === 's') { skipReward(); }
        else {
          const pick = parseInt(ans) - 1;
          if (pick >= 0 && pick < cards.length) { console.log('  → ' + cards[pick].name); pickRewardCard(pick); }
          else skipReward();
        }
        continueAfterReward();
      });
      return;
    }
    skipReward();
  }
  continueAfterReward();
}

function continueAfterReward() {
  if (gameState.phase === 'mini_boss_victory') {
    const mbv = gameState._miniBossVictory;
    console.log('\n  🏆 ' + mbv.title);
    mbv.lines.forEach(l => console.log('  ' + l));
    console.log('  → ' + mbv.reward + ': ' + mbv.rewardDesc);
    continueAfterMiniBoss();
    afterBattle(); // handle the card reward
    return;
  }
  if (gameState.phase === GAME_PHASES.VICTORY) { console.log('\n  🏆 VICTORY!'); rl.close(); return; }
  if (gameState.phase === GAME_PHASES.GAME_OVER) { console.log('\n  💀 GAME OVER'); rl.close(); return; }
  if (gameState.phase === GAME_PHASES.MAP) showNav();
}

function enterLocation() {
  const id = gameState.campaign.currentLocation;
  const loc = WORLD.locations[id];
  const cleared = gameState.campaign.cleared.has(id);

  if (!cleared) {
    if ([LOC_TYPES.BATTLE, LOC_TYPES.ELITE, LOC_TYPES.MINI_BOSS, LOC_TYPES.BOSS].includes(loc.type)) {
      gameState._battleLocationId = id;
      if (loc.blessing) gameState._miniBossBlessing = loc.blessing;
      if (loc.type === LOC_TYPES.ELITE) startEliteBattle(loc.enemy, loc.goldReward || 0);
      else startNodeBattle(loc.enemy, loc.goldReward || 0);
      runBattle();
      return;
    }
    if (loc.type === LOC_TYPES.SHOP) {
      console.log('\n  🛒 Shop');
      gameState._shopCards = getAvailableShopCards();
      doShop();
      return;
    }
    if (loc.type === LOC_TYPES.REST) {
      console.log('\n  🔥 Campfire');
      if (canRest()) {
        console.log('  Healed ' + Math.min(Math.floor(gameState.player.maxHp * REST_HEAL_FRACTION), gameState.player.maxHp - gameState.player.hp) + ' HP');
        doRest();
      } else {
        console.log('  (cannot rest yet — need more battles)');
        clearLocation(id);
      }
      showNav();
      return;
    }
    if (loc.type === LOC_TYPES.EVENT && loc.eventKey && EVENTS[loc.eventKey]) {
      const ev = EVENTS[loc.eventKey];
      gameState._currentEvent = loc.eventKey;
      console.log('\n  ❓ ' + ev.title + ': ' + ev.description);
      ev.choices.forEach((c, i) => console.log(`    ${i + 1}. ${c.text}`));
      rl.question('  > ', ans => {
        const choice = parseInt(ans) - 1;
        if (choice >= 0 && choice < ev.choices.length) {
          doEventChoice(choice);
          if (gameState.phase === GAME_PHASES.EVENT && gameState._rewardCards) gameState.phase = GAME_PHASES.CARD_REWARD;
          afterBattle();
        } else {
          enterLocation(); // retry
        }
      });
      return;
    }
    if (loc.type === LOC_TYPES.NPC) {
      console.log('\n  💬 ' + (loc.npc ? loc.npc.name : 'NPC'));
      leaveNpc();
      showNav();
      return;
    }
    clearLocation(id);
  }
  showNav();
}

function doShop() {
  gameState.phase = GAME_PHASES.SHOP;
  const g = gameState.campaign.gold;
  const p = gameState.player;
  const deck = [...p.deck, ...p.discard, ...p.hand];
  const items = gameState._shopCards || [];
  console.log(`  Gold: ${g} | HP: ${p.hp}/${p.maxHp} | Deck: ${deck.length}`);
  const options = [];
  if (p.hp < p.maxHp && g >= SHOP_HEAL_PRICE) options.push({ key: 'h', label: `Heal 10 HP (${SHOP_HEAL_PRICE}g)` });
  if (g >= CARD_REMOVE_PRICE && deck.length > 0) options.push({ key: 'r', label: `Remove a card (${CARD_REMOVE_PRICE}g)` });
  items.forEach((item, i) => {
    if (item.price <= g) options.push({ key: String(i + 1), label: `Buy ${item.card.name} (${item.price}g)` });
  });
  options.push({ key: 'l', label: 'Leave' });
  options.forEach(o => console.log(`    ${o.key}. ${o.label}`));
  rl.question('  > ', ans => {
    if (ans === 'h' && p.hp < p.maxHp && g >= SHOP_HEAL_PRICE) {
      buyHeal();
      console.log('  Healed! HP: ' + gameState.player.hp);
      doShop();
    } else if (ans === 'r' && g >= CARD_REMOVE_PRICE) {
      const cards = [...gameState.player.deck, ...gameState.player.discard];
      console.log('  Remove which card?');
      cards.forEach((c, i) => console.log(`    ${i + 1}. ${c.name} (dmg:${c.damage} blk:${c.block})`));
      rl.question('  > ', ans2 => {
        const ri = parseInt(ans2) - 1;
        if (ri >= 0 && ri < cards.length) {
          openShopRemove();
          doCardAction(ri);
          console.log('  Removed: ' + cards[ri].name);
        }
        doShop();
      });
    } else if (ans === 'l') {
      leaveShop();
      showNav();
    } else {
      const bi = parseInt(ans) - 1;
      if (bi >= 0 && bi < items.length && items[bi].price <= gameState.campaign.gold) {
        buyCard(bi);
        console.log('  Bought: ' + items[bi].card.name);
        doShop();
      } else {
        doShop();
      }
    }
  });
}

console.log('\n🐉 Dragon Cards — Interactive Mode');
console.log('Agent fights battles, you make all other decisions.\n');
enterLocation();
