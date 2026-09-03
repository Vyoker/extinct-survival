/**
 * Battle Bridge
 * Menjembatani data game kita (player stats, equipment, derived stats)
 * ke window.ExtinctBattle (engine tactical grid battle), dan menangani
 * hasil pertempuran (reward/penalty) balik ke GameState.
 *
 * CATATAN KETERBATASAN: state pertempuran tactical (posisi unit, AP,
 * board) TIDAK di-persist ke localStorage. Kalau halaman di-reload di
 * tengah battle, battle akan hilang (kembali ke menu Jelajah, tanpa
 * penalti). Ini trade-off yang disengaja karena kompleksitas state
 * grid battle terlalu besar untuk disinkronkan penuh ke save system.
 */
const BattleBridge = (function () {
  'use strict';

  function getPlayer() {
    return GameState.get().player;
  }

  function buildPlayerConfig() {
    const p = getPlayer();
    const derived = Player.getDerivedStats();
    const weapon = p.equipment.weapon;
    const weaponDef = weapon && weapon.itemId ? ItemDB.get(weapon.itemId) : null;

    // Damage total mengikuti formula yang sama dengan sistem lama:
    // weaponDamage dikali bonus damage dari ATK (Attribute Point).
    const baseDmg = (weaponDef && weaponDef.stats && weaponDef.stats.damage) || 3;
    const finalDmg = Math.round(baseDmg * (1 + derived.damageBonusPct / 100));
    const dmgMin = Math.max(1, finalDmg - 2);
    const dmgMax = finalDmg + 2;

    const weaponEntry = {
      name: weaponDef ? weaponDef.name : 'Tangan Kosong',
      icon: weaponDef ? '🔪' : '👊',
      apCost: 1,
      dmgMin, dmgMax,
      range: 1,
      ammo: null,
      refItemId: weapon ? weapon.itemId : null // dipakai utk kurangi durability
    };

    return {
      name: p.name,
      icon: '🧑',
      hp: Math.max(1, p.survival.health),
      maxHp: 100,
      armor: Math.round(derived.defensePct), // sinkron dgn Defense% (cap 70)
      maxAp: 6,
      weapons: [weaponEntry]
    };
  }

  function buildEnemiesConfig(enemyDef) {
    // Satu musuh per battle (konsisten dengan alur Hunting: pilih 1 target).
    return [{
      id: enemyDef.id,
      name: enemyDef.name,
      icon: enemyDef.icon || '👤',
      hp: enemyDef.hp,
      maxHp: enemyDef.hp,
      dmgMin: enemyDef.damageMin,
      dmgMax: enemyDef.damageMax,
      moveRange: 3,
      armor: 0,
      // Field custom asli dititipkan supaya bisa dibaca lagi di summary onEnd
      expReward: enemyDef.expReward,
      rupiahMin: enemyDef.rupiahMin,
      rupiahMax: enemyDef.rupiahMax,
      lootChance: enemyDef.lootChance,
      lootTable: enemyDef.lootTable || []
    }];
  }

  function onWeaponUse(weapon) {
    if (weapon && weapon.refItemId && window.Inventory) {
      // Disamakan: semua equipment yang terpasang (bukan cuma senjata)
      // ikut berkurang durability-nya tiap Attack.
      Inventory.reduceEquipmentDurability(1);
    }
  }

  function applyBattleResult(summary) {
    const p = getPlayer();

    // Sinkronkan HP tersisa balik ke GameState
    p.survival.health = clamp(summary.player.hp, 0, 100);

    if (summary.result === 'win') {
      const defeated = summary.enemies.filter(e => e.defeated);
      let totalRupiah = 0;
      let totalExp = 0;

      defeated.forEach(e => {
        const rupiah = randInt(e.rupiahMin || 0, e.rupiahMax || 0);
        totalRupiah += rupiah;
        totalExp += e.expReward || 0;

        if (e.lootTable && e.lootTable.length > 0 && Math.random() < (e.lootChance || 0)) {
          const lootId = e.lootTable[Math.floor(Math.random() * e.lootTable.length)];
          Inventory.addItem(lootId, 1);
        }

        if (window.QuestSystem) QuestSystem.registerKill(e.id);
        if (window.FactionSystem) FactionSystem.grantHuntProgress(e.expReward);
      });

      p.currency.rupiah += totalRupiah;
      if (totalExp > 0) Player.addExp(totalExp);
      if (window.Skills) Skills.addSkillExp('hunter', Math.round(totalExp * 0.8));

      Events.emit('notify', { message: `Menang! +Rp ${totalRupiah}, +${totalExp} EXP.` });
    } else if (summary.result === 'lose') {
      const expLost = Math.floor(p.exp * 0.5);
      p.exp = Math.max(0, p.exp - expLost);
      p.survival.health = 15; // hindari softlock, sama seperti sistem lama
      Events.emit('notify', { message: `Kalah dan kehilangan ${expLost} EXP.`, type: 'error' });
    } else if (summary.result === 'flee') {
      Events.emit('notify', { message: 'Berhasil kabur dari pertempuran.' });
    }

    // Battle sudah selesai dengan benar (menang/kalah/kabur) -> hapus
    // penanda battleInProgress supaya tidak dianggap "terinterupsi" lagi.
    p.battleInProgress = null;
    GameState.save();

    Events.emit('player:updated');
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // Dipanggil sekali saat game dibuka (baik karakter baru maupun lanjut).
  // Kalau ketahuan battle sebelumnya terinterupsi (app ditutup/reload di
  // tengah battle tactical, yang memang sengaja tidak di-persist), energy
  // yang sudah terlanjur kepotong buat mulai Hunting dikembalikan.
  function recoverInterruptedBattle() {
    const p = getPlayer();
    if (!p.battleInProgress) return;

    const refund = p.battleInProgress.energyCost || 0;
    p.energy = clamp(p.energy + refund, 0, p.maxEnergy);
    p.battleInProgress = null;
    GameState.save();

    if (refund > 0) {
      Events.emit('notify', { message: `Pertarungan sebelumnya terganggu. +${refund}⚡ energy dikembalikan.` });
    }
  }

  // Titik masuk utama: dipanggil dari panels.js saat pemain pilih target Hunting
  function startHunt(enemyDef, onFinish) {
    Renderer.showScreen('screen-battle-tactical');

    window.ExtinctBattle.start({
      cols: 7,
      rows: 8,
      player: buildPlayerConfig(),
      enemies: buildEnemiesConfig(enemyDef),
      onWeaponUse: onWeaponUse,
      onEnd: function (summary) {
        applyBattleResult(summary);
        Renderer.showScreen('screen-game');
        if (typeof onFinish === 'function') onFinish(summary);
      }
    });
  }

  return { startHunt, recoverInterruptedBattle };
})();

window.BattleBridge = BattleBridge;
