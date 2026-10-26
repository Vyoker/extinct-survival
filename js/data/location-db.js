/**
 * Location Database
 * Memuat data lokasi (deskripsi, scavenge loot, daftar musuh) dari
 * js/data/locations.json.
 *
 * v0.5.2 — Scaling musuh: tiap musuh punya `level` (1-100) dan stat
 * level-1 (`baseHp`, `baseDamageMin`, dst). Stat akhir digenerate saat
 * data dimuat: stat = base x (1 + 0.5 x (level - 1)) — tiap level naik
 * statistik +50% dari base level 1. Tier warna mengikuti level dengan
 * palet rarity item persis (Rarity): 1-15 Common (putih), 16-30
 * Uncommon (hijau), 31-50 Rare (biru), 51-70 Epic (ungu), 71-90
 * Legendary (emas), 91-100 Mythic (merah) + label BOSS.
 */
const LocationDB = (function () {
  'use strict';

  let locations = {};
  let loaded = false;

  const ENEMY_TIERS = [
    { id: 'common', name: 'Common', maxLevel: 15 },
    { id: 'uncommon', name: 'Uncommon', maxLevel: 30 },
    { id: 'rare', name: 'Rare', maxLevel: 50 },
    { id: 'epic', name: 'Epic', maxLevel: 70 },
    { id: 'legendary', name: 'Legendary', maxLevel: 90 },
    { id: 'mythic', name: 'Mythic', maxLevel: 100 }
  ];
  const TIER_FALLBACK_COLORS = {
    common: '#f5f5f5', uncommon: '#22c55e', rare: '#3b82f6',
    epic: '#a855f7', legendary: '#f5c518', mythic: '#ff3b3b'
  };

  function tierForLevel(level) {
    const lv = Math.max(1, Math.min(100, level || 1));
    const t = ENEMY_TIERS.find(x => lv <= x.maxLevel) || ENEMY_TIERS[ENEMY_TIERS.length - 1];
    const color = (window.Rarity && Rarity.getColor) ? Rarity.getColor(t.id) : TIER_FALLBACK_COLORS[t.id];
    return { id: t.id, name: t.name, color, isBoss: t.id === 'mythic' };
  }

  // v0.6.6 — Tier sebagai SIFAT TETAP musuh (bukan dari level):
  // tier musuh kini ditulis di locations.json (field `tier`), levelnya
  // justru di-generate dari level pemain saat Hunting dibuka.
  const KIND_TIER_NAMES = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', boss: 'BOSS' };
  function tierForKind(tierId) {
    const id = KIND_TIER_NAMES[tierId] ? tierId : 'common';
    const rarityId = id === 'boss' ? 'mythic' : id;
    const color = (window.Rarity && Rarity.getColor) ? Rarity.getColor(rarityId) : TIER_FALLBACK_COLORS[rarityId];
    return { id, name: KIND_TIER_NAMES[id], color, isBoss: id === 'boss' };
  }

  // v0.6.6 — Offset level per tier (contoh user: pemain lv 10 ->
  // musuh putih lv 10, ungu lv 15, boss lv 20).
  const TIER_OFFSETS = { common: 0, uncommon: 2, rare: 3, epic: 5, legendary: 7, boss: 10 };

  // Hasilkan salinan musuh yang level & statnya disesuaikan dengan
  // level pemain. Stat dihitung ULANG dari base stat (baseHp dst) x
  // pengali level baru — jadi musuh lv 15 benar-benar lebih tebal &
  // lebih sakit daripada lv 10, bukan sekadar angka level ditempel.
  // v0.7.3 (revisi final, DIKUNCI user 2026-10-26: x5 — setelah
  // simulasi x1,5 terasa lemah, x10 terlalu sadis, x3 masih ringan):
  // musuh event lebih sulit. Metodenya TETAP sama seperti
  // sebelumnya (base x pengali level), hanya ditambah pengali
  // event x5 untuk HP, damage (ATK), dan Defense — bila
  // options.eventHard true. EXP dan Rupiah TIDAK ikut dikali,
  // supaya hadiah tidak ikut membengkak. Defense musuh normal
  // selama ini 0 di battle, jadi Defense event dihitung dari
  // baseDefense (Kalimantan saja) x pengali level x5; di luar
  // event armor tetap 0 seperti sebelumnya.
  function scaleEnemyForPlayer(enemy, playerLevel, options) {
    if (!enemy) return enemy;
    const tierId = (typeof enemy.tier === 'string') ? enemy.tier : null;
    const tier = tierId ? tierForKind(tierId) : (enemy.tier || tierForLevel(enemy.level));
    const scaled = Object.assign({}, enemy, { tier });
    if (typeof enemy.baseHp !== 'number') return scaled; // musuh lama tanpa base stat: apa adanya
    const offset = TIER_OFFSETS[tier.id] || 0;
    const level = Math.max(1, Math.min(100, (playerLevel || 1) + offset));
    const mult = levelMultiplier(level);
    const eventHard = !!(options && options.eventHard);
    const eventMult = eventHard ? 5 : 1;
    scaled.level = level;
    scaled.eventHard = eventHard;
    scaled.hp = Math.max(1, Math.round(enemy.baseHp * mult * eventMult));
    scaled.damageMin = Math.max(1, Math.round((enemy.baseDamageMin || 0) * mult * eventMult));
    scaled.damageMax = Math.max(scaled.damageMin, Math.round((enemy.baseDamageMax || 0) * mult * eventMult));
    scaled.expReward = Math.max(1, Math.round((enemy.baseExpReward || 0) * mult));
    scaled.rupiahMin = Math.max(0, Math.round((enemy.baseRupiahMin || 0) * mult));
    scaled.rupiahMax = Math.max(scaled.rupiahMin, Math.round((enemy.baseRupiahMax || 0) * mult));
    scaled.armor = (eventHard && typeof enemy.baseDefense === 'number')
      ? Math.round(enemy.baseDefense * mult * 5) : 0;
    return scaled;
  }

  function levelMultiplier(level) {
    return 1 + 0.5 * (Math.max(1, level || 1) - 1);
  }

  // Isi stat akhir (hp, damageMin, ...) dari base stat x multiplier level
  // + tempel info tier. v0.6.6: kalau musuh punya field `tier` (sifat
  // tetap), tier itu yang dipakai — bukan dari level. Musuh lama tanpa
  // base stat dibiarkan apa adanya.
  function normalizeEnemy(e) {
    if (!e || typeof e.baseHp !== 'number') return e;
    const mult = levelMultiplier(e.level);
    e.hp = Math.max(1, Math.round(e.baseHp * mult));
    e.damageMin = Math.max(1, Math.round((e.baseDamageMin || 0) * mult));
    e.damageMax = Math.max(e.damageMin, Math.round((e.baseDamageMax || 0) * mult));
    e.expReward = Math.max(1, Math.round((e.baseExpReward || 0) * mult));
    e.rupiahMin = Math.max(0, Math.round((e.baseRupiahMin || 0) * mult));
    e.rupiahMax = Math.max(e.rupiahMin, Math.round((e.baseRupiahMax || 0) * mult));
    e.tier = (typeof e.tier === 'string') ? tierForKind(e.tier) : tierForLevel(e.level);
    return e;
  }

  async function load() {
    if (loaded) return locations;
    try {
      const res = await fetch('js/data/locations.json');
      const list = await res.json();
      locations = {};
      list.forEach(loc => {
        if (Array.isArray(loc.enemies)) loc.enemies = loc.enemies.map(normalizeEnemy);
        locations[loc.id] = loc;
      });
      loaded = true;
    } catch (e) {
      console.error('[LocationDB] Gagal memuat locations.json:', e);
    }
    return locations;
  }

  function get(locationId) {
    return locations[locationId] || null;
  }

  function all() {
    return locations;
  }

  return { load, get, all, tierForLevel, tierForKind, scaleEnemyForPlayer, levelMultiplier, ENEMY_TIERS, TIER_OFFSETS };
})();

window.LocationDB = LocationDB;
