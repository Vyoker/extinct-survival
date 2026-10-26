/**
 * Exploration Module (versi menu, bukan grid real-time)
 * Menu Jelajah menampilkan info lokasi + 3 opsi: Scavenge, Hunting, Travel.
 */
const Exploration = (function () {
  'use strict';

  const SCAVENGE_ENERGY_COST = 5;
  const HUNTING_ENERGY_COST = 8;
  const TRAVEL_ENERGY_COST = 15;

  const SCAVENGE_COOLDOWN_MS = 5000;
  const TRAVEL_COOLDOWN_MS = 15000;

  function getPlayer() {
    return GameState.get().player;
  }

  function getCurrentLocation() {
    return LocationDB.get(getPlayer().location);
  }

  function getAllOtherLocations() {
    const current = getPlayer().location;
    return Object.values(LocationDB.all()).filter(loc => loc.id !== current);
  }

  function canScavenge() {
    return getPlayer().energy >= SCAVENGE_ENERGY_COST && !Cooldown.isActive('scavenge');
  }

  function canHunt() {
    return getPlayer().energy >= HUNTING_ENERGY_COST;
  }

  function canTravel() {
    return getPlayer().energy >= TRAVEL_ENERGY_COST && !Cooldown.isActive('travel');
  }

  // Pilih item dari loot pool lokasi berdasarkan rarity hasil roll.
  // Kalau tidak ada item dengan rarity itu di pool, coba tier di bawahnya
  // (makin umum) sampai ketemu; fallback terakhir pilih acak biasa.
  function pickLootByRarity(scavengeLoot) {
    const rolledRarity = Rarity.roll();
    const startIdx = Rarity.TIER_ORDER.indexOf(rolledRarity);

    for (let i = startIdx; i < Rarity.TIER_ORDER.length; i++) {
      const tierId = Rarity.TIER_ORDER[i];
      const matches = scavengeLoot.filter(itemId => {
        const def = ItemDB.get(itemId);
        return def && def.rarity === tierId;
      });
      if (matches.length > 0) {
        return matches[Math.floor(Math.random() * matches.length)];
      }
    }
    // Fallback: kalau tidak ada yang cocok sama sekali, pilih acak dari pool
    return scavengeLoot[Math.floor(Math.random() * scavengeLoot.length)];
  }

  // v0.6.6 — Pilih item dari pool lokasi dengan BOBOT geografis
  // (locations.json field `scavengeWeights`, mis. Kalimantan: kayu 40).
  // Item tanpa bobot tertulis bobotnya 1. `exclude` = item yang sudah
  // terpilih di scavenge ini (supaya 1-3 jenisnya berbeda-beda).
  function pickLootWeighted(loc, exclude) {
    const pool = (loc.scavengeLoot || []).filter(id => !(exclude || []).includes(id));
    if (pool.length === 0) return null;
    const weights = loc.scavengeWeights || {};
    let total = 0;
    const entries = pool.map(id => {
      const baseW = weights[id] || 1;
      const w = (typeof window !== 'undefined' && window.SubSkillKarhutla)
        ? window.SubSkillKarhutla.woodWeight(baseW, id) : baseW;
      total += w;
      return { id, w };
    });
    let roll = Math.random() * total;
    for (const e of entries) {
      roll -= e.w;
      if (roll <= 0) return e.id;
    }
    return entries[entries.length - 1].id;
  }

  // v0.6.6 — Jumlah jenis item per scavenge: 1 jenis 40%,
  // 2 jenis 40%, 3 jenis 20% (tidak pelit lagi).
  function rollLootTypeCount() {
    const r = Math.random();
    if (r < 0.4) return 1;
    if (r < 0.8) return 2;
    return 3;
  }

  // --- SCAVENGE ---
  function scavenge() {
    const p = getPlayer();
    if (Cooldown.isActive('scavenge')) {
      Events.emit('notify', { message: `Tunggu ${Cooldown.remainingSec('scavenge')} detik lagi.`, type: 'error' });
      return null;
    }
    if (p.energy < SCAVENGE_ENERGY_COST) {
      Events.emit('notify', { message: 'Energy tidak cukup untuk scavenge.', type: 'error' });
      return null;
    }
    const loc = getCurrentLocation();
    if (!loc || !loc.scavengeLoot || loc.scavengeLoot.length === 0) {
      Events.emit('notify', { message: 'Tidak ada yang bisa dikumpulkan di sini.', type: 'error' });
      return null;
    }

    p.energy -= SCAVENGE_ENERGY_COST;
    Cooldown.start('scavenge', SCAVENGE_COOLDOWN_MS);

    const rupiah = Math.floor(Math.random() * 35) + 10;
    p.currency.rupiah += rupiah;

    // v0.6.6: 1-3 jenis item berbeda dari pool berbobot wilayah.
    const items = [];
    const typeCount = Math.min(rollLootTypeCount(), loc.scavengeLoot.length);
    for (let i = 0; i < typeCount; i++) {
      const itemId = pickLootWeighted(loc, items.map(x => x.itemId));
      if (!itemId) break;
      const baseQty = Math.random() < 0.3 ? 2 : 1;
      const qty = (typeof window !== 'undefined' && window.SubSkillKarhutla)
        ? window.SubSkillKarhutla.woodQty(baseQty, itemId) : baseQty;
      items.push({ itemId, qty });
      Inventory.addItem(itemId, qty);
    }

    // Bonus loot tambahan berdasarkan LUCK + skill Scavenger:
    // 1 jenis ekstra (berbeda) di atas hasil dasar.
    const scavengerBonus = window.Skills ? Skills.getSkillBonusPct('scavenger') / 100 : 0;
    const lootBonusChance = Math.min(0.8, (p.stats.int * 0.4) / 100 + scavengerBonus);
    if (Math.random() < lootBonusChance) {
      const bonusItemId = pickLootWeighted(loc, items.map(x => x.itemId));
      if (bonusItemId) {
        const bonusQty = (typeof window !== 'undefined' && window.SubSkillKarhutla)
          ? window.SubSkillKarhutla.woodQty(1, bonusItemId) : 1;
        items.push({ itemId: bonusItemId, qty: bonusQty });
        Inventory.addItem(bonusItemId, bonusQty);
      }
    }

    const exp = Math.floor(Math.random() * 4) + 2;
    Player.addExp(exp);
    if (window.Skills) Skills.addSkillExp('scavenger', 5);
    if (window.FactionSystem) FactionSystem.grantScavengeProgress();

    const itemNames = items.map(x => {
      const def = ItemDB.get(x.itemId);
      return def ? def.name + (x.qty > 1 ? ' ×' + x.qty : '') : x.itemId;
    }).join(', ');
    Events.emit('notify', { message: `Scavenge selesai: +${itemNames}, +Rp ${rupiah}, +${exp} EXP.` });
    Events.emit('player:updated');
    // itemId/qty pertama dipertahankan untuk reveal UI lama.
    const first = items[0] || { itemId: null, qty: 0 };
    return { rupiah, itemId: first.itemId, qty: first.qty, items, exp };
  }

  // --- TRAVEL ---
  function travelTo(locationId) {
    const p = getPlayer();
    if (Cooldown.isActive('travel')) {
      Events.emit('notify', { message: `Tunggu ${Cooldown.remainingSec('travel')} detik lagi.`, type: 'error' });
      return false;
    }
    if (p.energy < TRAVEL_ENERGY_COST) {
      Events.emit('notify', { message: 'Energy tidak cukup untuk bepergian.', type: 'error' });
      return false;
    }
    const dest = LocationDB.get(locationId);
    if (!dest) return false;

    p.energy -= TRAVEL_ENERGY_COST;
    p.location = locationId;
    Cooldown.start('travel', TRAVEL_COOLDOWN_MS);

    Events.emit('notify', { message: `Tiba di ${dest.name}.` });
    Events.emit('player:updated');
    return true;
  }

  return {
    getCurrentLocation, getAllOtherLocations,
    canScavenge, canHunt, canTravel,
    scavenge, travelTo, pickLootByRarity, pickLootWeighted, rollLootTypeCount,
    SCAVENGE_ENERGY_COST, HUNTING_ENERGY_COST, TRAVEL_ENERGY_COST,
    SCAVENGE_COOLDOWN_MS, TRAVEL_COOLDOWN_MS
  };
})();

window.Exploration = Exploration;
