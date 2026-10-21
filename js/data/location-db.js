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

  function levelMultiplier(level) {
    return 1 + 0.5 * (Math.max(1, level || 1) - 1);
  }

  // Isi stat akhir (hp, damageMin, ...) dari base stat x multiplier level
  // + tempel info tier. Musuh lama tanpa base stat dibiarkan apa adanya.
  function normalizeEnemy(e) {
    if (!e || typeof e.baseHp !== 'number') return e;
    const mult = levelMultiplier(e.level);
    e.hp = Math.max(1, Math.round(e.baseHp * mult));
    e.damageMin = Math.max(1, Math.round((e.baseDamageMin || 0) * mult));
    e.damageMax = Math.max(e.damageMin, Math.round((e.baseDamageMax || 0) * mult));
    e.expReward = Math.max(1, Math.round((e.baseExpReward || 0) * mult));
    e.rupiahMin = Math.max(0, Math.round((e.baseRupiahMin || 0) * mult));
    e.rupiahMax = Math.max(e.rupiahMin, Math.round((e.baseRupiahMax || 0) * mult));
    e.tier = tierForLevel(e.level);
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

  return { load, get, all, tierForLevel, levelMultiplier, ENEMY_TIERS };
})();

window.LocationDB = LocationDB;
