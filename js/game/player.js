/**
 * Player Module
 * Mengatur regenerasi stat berbasis waktu (idle timer): energy +1/60detik,
 * hunger -1/10menit, thirst -1/8menit, health regen +1/15menit (jika
 * hunger & thirst > 50).
 */
const Player = (function () {
  'use strict';

  const MINUTE = 60 * 1000;

  const RATES = {
    energyRegenMs: 60 * 1000, // 1 energy per 60 detik (diam)
    hungerDecayMs: 10 * MINUTE,
    thirstDecayMs: 8 * MINUTE,
    healthRegenMs: 15 * MINUTE
  };

  let timers = {};

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getPlayer() {
    return GameState.get().player;
  }

  const MAX_LEVEL = 100;

  // Formula scaling level karakter (1-100): expToNext = 100 * level * 2
  function calcExpToNext(level) {
    return Math.round(100 * level * 2);
  }

  function addExp(amount) {
    const p = getPlayer();
    if (window.PassSystem) PassSystem.addPassExp(amount);
    if (p.level >= MAX_LEVEL) return; // sudah level maksimal
    p.exp += amount;
    Events.emit('notify', { message: `+${amount} EXP` });
    while (p.exp >= p.expToNext && p.level < MAX_LEVEL) {
      p.exp -= p.expToNext;
      p.level += 1;
      p.expToNext = calcExpToNext(p.level);
      p.maxEnergy += 2;
      p.attributePoints += 5;
      Events.emit('notify', { message: `🎉 Level Up! Sekarang level ${p.level} (+5 Attribute Point)` });
    }
    if (p.level >= MAX_LEVEL) {
      p.exp = 0;
    }
    Events.emit('player:updated');
  }

  function spendEnergy(amount) {
    const p = getPlayer();
    if (p.energy < amount) return false;
    p.energy -= amount;
    Events.emit('player:updated');
    return true;
  }

  function applyOfflineProgress() {
    const p = getPlayer();
    const now = Date.now();
    const elapsedMs = Math.max(0, now - (p.lastOnline || now));
    const cappedMs = Math.min(elapsedMs, 8 * 60 * MINUTE); // cap 8 jam

    if (cappedMs > 0) {
      const energyGain = Math.floor(cappedMs / RATES.energyRegenMs);
      const hungerLoss = Math.floor(cappedMs / RATES.hungerDecayMs);
      const thirstLoss = Math.floor(cappedMs / RATES.thirstDecayMs);

      p.energy = clamp(p.energy + energyGain, 0, p.maxEnergy);
      p.survival.hunger = clamp(p.survival.hunger - hungerLoss, 0, 100);
      p.survival.thirst = clamp(p.survival.thirst - thirstLoss, 0, 100);

      if (elapsedMs > MINUTE) {
        Events.emit('notify', {
          message: `Selamat datang kembali. ${formatDuration(elapsedMs)} berlalu sejak terakhir online.`
        });
      }
    }
    p.lastOnline = now;
  }

  function formatDuration(ms) {
    const totalMin = Math.floor(ms / MINUTE);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}j ${m}m`;
    return `${m}m`;
  }

  function startLoop() {
    // Energy regen: 1 energy per 60 detik
    timers.energy = setInterval(() => {
      const p = getPlayer();
      if (p.energy < p.maxEnergy) {
        p.energy = clamp(p.energy + 1, 0, p.maxEnergy);
        Events.emit('player:updated');
      }
    }, RATES.energyRegenMs);

    // Hunger decay (dikurangi oleh bonus skill Survivor)
    timers.hunger = setInterval(() => {
      const p = getPlayer();
      const survivorBonus = (window.Skills ? Skills.getSkillBonusPct('survivor') : 0) / 100;
      if (Math.random() < survivorBonus) return; // skill Survivor meredam drain
      p.survival.hunger = clamp(p.survival.hunger - 1, 0, 100);
      Events.emit('player:updated');
      if (p.survival.hunger === 0) {
        Events.emit('notify', { message: '⚠️ Kamu kelaparan! Health akan menurun.', type: 'error' });
      }
    }, RATES.hungerDecayMs);

    // Thirst decay (dikurangi oleh bonus skill Survivor)
    timers.thirst = setInterval(() => {
      const p = getPlayer();
      const survivorBonus = (window.Skills ? Skills.getSkillBonusPct('survivor') : 0) / 100;
      if (Math.random() < survivorBonus) return;
      p.survival.thirst = clamp(p.survival.thirst - 1, 0, 100);
      Events.emit('player:updated');
      if (p.survival.thirst === 0) {
        Events.emit('notify', { message: '⚠️ Kamu dehidrasi! Health akan menurun.', type: 'error' });
      }
    }, RATES.thirstDecayMs);

    // Health regen / decay
    timers.health = setInterval(() => {
      const p = getPlayer();
      const { hunger, thirst } = p.survival;
      if (hunger > 50 && thirst > 50) {
        p.survival.health = clamp(p.survival.health + 1, 0, 100);
      } else if (hunger === 0 || thirst === 0) {
        p.survival.health = clamp(p.survival.health - 2, 0, 100);
      }
      Events.emit('player:updated');
    }, RATES.healthRegenMs);
  }

  function stopLoop() {
    Object.values(timers).forEach(clearInterval);
    timers = {};
  }

  const POINT_VALUE_PCT = 0.2;   // 1 poin ATK/DEF/DEX = +0.2% status
  const INT_VALUE_PCT = 0.4;     // 1 poin INT = +0.4% crafting & loot
  const CAP_DEFENSE_PCT = 70;
  const CAP_EVASION_PCT = 70;
  const BASE_INVENTORY_SLOTS = 20; // slot dasar tas, +1 tiap poin INT

  function canAllocate(category) {
    const p = getPlayer();
    if (p.attributePoints <= 0) return false;
    if (category === 'def' && p.stats.def * POINT_VALUE_PCT >= CAP_DEFENSE_PCT) return false;
    if (category === 'dex' && p.stats.dex * POINT_VALUE_PCT >= CAP_EVASION_PCT) return false;
    return true;
  }

  const CATEGORY_LABEL = { atk: 'Damage', def: 'Defense', dex: 'Crit/Evasion', int: 'Crafting/Loot/Slot Tas' };

  // Alokasi poin LANGSUNG ke stats.{atk,def,dex,int} — ini satu-satunya
  // sumber data (tidak ada lagi "atribut dasar" terpisah yang berbeda
  // dari poin yang dialokasikan, supaya selalu sinkron).
  function allocatePoint(category) {
    const p = getPlayer();
    if (!['atk', 'def', 'dex', 'int'].includes(category)) return false;
    if (!canAllocate(category)) {
      Events.emit('notify', { message: 'Poin tidak bisa dialokasikan ke sini.', type: 'error' });
      return false;
    }
    p.attributePoints -= 1;
    p.stats[category] += 1;
    Events.emit('notify', { message: `+1 ${category.toUpperCase()} (${CATEGORY_LABEL[category]})` });
    Events.emit('player:updated');
    return true;
  }

  function getDerivedStats() {
    const p = getPlayer();
    const weaponDmg = window.Inventory ? Inventory.getEquippedWeaponDamage() : 3;
    const armorDefense = window.Inventory ? Inventory.getEquipmentDefenseBonus() : 0;

    const damageBonusPct = p.stats.atk * POINT_VALUE_PCT;
    const defensePct = clamp(p.stats.def * POINT_VALUE_PCT + armorDefense, 0, CAP_DEFENSE_PCT);
    const evasionPct = clamp(p.stats.dex * POINT_VALUE_PCT, 0, CAP_EVASION_PCT);
    const critPct = clamp(p.stats.dex * POINT_VALUE_PCT, 0, 90);
    const craftingBonus = p.stats.int * INT_VALUE_PCT;
    const lootBonus = clamp(p.stats.int * INT_VALUE_PCT, 0, 50);
    const fleeChance = clamp(0.3 + p.stats.dex * 0.03, 0.2, 0.85) * 100;

    return {
      totalDamage: Math.round(weaponDmg * (1 + damageBonusPct / 100)),
      damageBonusPct,
      critChance: Math.round(critPct),
      dodgeChance: Math.round(evasionPct), // alias evasion, kompatibilitas UI lama
      evasionChance: Math.round(evasionPct),
      defensePct: Math.round(defensePct),
      fleeChance: Math.round(fleeChance),
      craftingBonus: Math.round(craftingBonus),
      lootBonus: Math.round(lootBonus),
      maxInventorySlots: BASE_INVENTORY_SLOTS + p.stats.int
    };
  }

  return {
    addExp, spendEnergy, applyOfflineProgress, startLoop, stopLoop, RATES,
    getDerivedStats, calcExpToNext, MAX_LEVEL,
    allocatePoint, canAllocate,
    POINT_VALUE_PCT, INT_VALUE_PCT, CAP_DEFENSE_PCT, CAP_EVASION_PCT, BASE_INVENTORY_SLOTS
  };
})();

window.Player = Player;
