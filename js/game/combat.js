/**
 * Combat Module
 * Battle turn-based sederhana: pilih Attack / Defend / Use Item / Flee.
 * Dipicu dari menu Hunting di Jelajah.
 */
const Combat = (function () {
  'use strict';

  function getPlayer() {
    return GameState.get().player;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function log(state, message) {
    state.log.push(message);
    if (state.log.length > 30) state.log.shift();
  }

  function startBattle(enemyDef) {
    const state = GameState.get();
    state.combat = {
      enemy: {
        id: enemyDef.id,
        name: enemyDef.name,
        hp: enemyDef.hp,
        maxHp: enemyDef.hp,
        damageMin: enemyDef.damageMin,
        damageMax: enemyDef.damageMax,
        expReward: enemyDef.expReward,
        rupiahMin: enemyDef.rupiahMin,
        rupiahMax: enemyDef.rupiahMax,
        lootChance: enemyDef.lootChance,
        lootTable: enemyDef.lootTable || []
      },
      playerDefending: false,
      log: [],
      status: 'ongoing' // ongoing | won | lost | fled
    };
    log(state.combat, `⚔️ ${enemyDef.name} muncul di hadapanmu!`);
    Events.emit('combat:updated');
  }

  function isActive() {
    const c = GameState.get().combat;
    return !!c && c.status === 'ongoing';
  }

  function enemyTurn() {
    const state = GameState.get();
    const c = state.combat;
    if (!c || c.status !== 'ongoing') return;

    const p = getPlayer();
    let dmg = randInt(c.enemy.damageMin, c.enemy.damageMax);
    if (c.playerDefending) {
      dmg = Math.round(dmg * 0.5);
      log(c, `Kamu bertahan, damage dikurangi.`);
    }
    p.survival.health = clamp(p.survival.health - dmg, 0, 100);
    log(c, `${c.enemy.name} menyerang! -${dmg} HP.`);
    c.playerDefending = false;

    if (p.survival.health <= 0) {
      resolveLoss();
    }
    Events.emit('player:updated');
    Events.emit('combat:updated');
  }

  function playerAttack() {
    const state = GameState.get();
    const c = state.combat;
    if (!c || c.status !== 'ongoing') return;

    const p = getPlayer();
    const weaponDmg = window.Inventory ? Inventory.getEquippedWeaponDamage() : 3;
    const dmg = weaponDmg + Math.floor(p.stats.strength / 2) + randInt(0, 3);
    c.enemy.hp = clamp(c.enemy.hp - dmg, 0, c.enemy.maxHp);
    log(c, `Kamu menyerang ${c.enemy.name}! -${dmg} HP.`);

    if (c.enemy.hp <= 0) {
      resolveWin();
    } else {
      enemyTurn();
    }
    Events.emit('combat:updated');
  }

  function playerDefend() {
    const c = GameState.get().combat;
    if (!c || c.status !== 'ongoing') return;
    c.playerDefending = true;
    log(c, 'Kamu bersiap bertahan.');
    enemyTurn();
    Events.emit('combat:updated');
  }

  function playerUseItem(itemId) {
    const c = GameState.get().combat;
    if (!c || c.status !== 'ongoing') return;
    const used = Inventory.useItem(itemId);
    if (used) {
      log(c, `Kamu menggunakan item.`);
      enemyTurn();
    }
    Events.emit('combat:updated');
  }

  function playerFlee() {
    const state = GameState.get();
    const c = state.combat;
    if (!c || c.status !== 'ongoing') return;
    const p = getPlayer();

    const fleeChance = clamp(0.3 + p.stats.agility * 0.03, 0.2, 0.85);
    if (Math.random() < fleeChance) {
      c.status = 'fled';
      log(c, '🏃 Kamu berhasil kabur dari pertarungan.');
      Events.emit('notify', { message: 'Berhasil kabur.' });
    } else {
      log(c, 'Gagal kabur!');
      enemyTurn();
    }
    Events.emit('combat:updated');
  }

  function resolveWin() {
    const state = GameState.get();
    const c = state.combat;
    const p = getPlayer();
    c.status = 'won';

    const rupiah = randInt(c.enemy.rupiahMin, c.enemy.rupiahMax);
    p.currency.rupiah += rupiah;
    Player.addExp(c.enemy.expReward);

    log(c, `🎉 ${c.enemy.name} berhasil dikalahkan! +Rp ${rupiah}, +${c.enemy.expReward} EXP.`);

    if (c.enemy.lootTable.length > 0 && Math.random() < c.enemy.lootChance) {
      const lootId = c.enemy.lootTable[Math.floor(Math.random() * c.enemy.lootTable.length)];
      Inventory.addItem(lootId, 1);
      log(c, `Mendapat item tambahan dari hasil buruan.`);
    }
    Events.emit('notify', { message: `Menang melawan ${c.enemy.name}!` });
  }

  function resolveLoss() {
    const state = GameState.get();
    const c = state.combat;
    const p = getPlayer();
    c.status = 'lost';

    // Kalah: kehilangan sebagian EXP progress level ini, HP dipulihkan
    // sedikit supaya tidak softlock.
    const expLost = Math.floor(p.exp * 0.5);
    p.exp = Math.max(0, p.exp - expLost);
    p.survival.health = 15;

    log(c, `💀 Kamu kalah melawan ${c.enemy.name}. Kehilangan ${expLost} EXP.`);
    Events.emit('notify', { message: `Kalah dan kehilangan ${expLost} EXP.`, type: 'error' });
  }

  function endBattle() {
    GameState.get().combat = null;
    Events.emit('combat:updated');
  }

  return {
    startBattle, isActive, playerAttack, playerDefend,
    playerUseItem, playerFlee, endBattle
  };
})();

window.Combat = Combat;
