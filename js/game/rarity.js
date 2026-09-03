/**
 * Rarity Module
 * 6 tingkat kualitas item/equipment: Common, Uncommon, Rare, Epic,
 * Legendary, Mythic. Tiap tier punya chance & warna sendiri.
 * Roll dilakukan dari yang paling langka ke yang paling umum (nested
 * check), jatuh ke Common sebagai default kalau semua roll gagal.
 */
const Rarity = (function () {
  'use strict';

  // Urutan dari paling langka ke paling umum (penting untuk roll order)
  const TIERS = [
    { id: 'mythic', name: 'Mythic', color: '#ff3b3b', chance: 0.01 },
    { id: 'legendary', name: 'Legendary', color: '#f5c518', chance: 0.05 },
    { id: 'epic', name: 'Epic', color: '#a855f7', chance: 0.10 },
    { id: 'rare', name: 'Rare', color: '#3b82f6', chance: 0.25 },
    { id: 'uncommon', name: 'Uncommon', color: '#22c55e', chance: 0.40 },
    { id: 'common', name: 'Common', color: '#f5f5f5', chance: 0.50 }
  ];

  const TIER_ORDER = TIERS.map(t => t.id); // mythic..common
  const TIER_MAP = {};
  TIERS.forEach(t => { TIER_MAP[t.id] = t; });

  // Roll satu tier rarity: cek dari yang paling langka dulu (nested
  // independent check), fallback ke 'common' kalau semuanya gagal.
  function roll() {
    for (const tier of TIERS) {
      if (tier.id === 'common') continue; // common jadi default fallback
      if (Math.random() < tier.chance) return tier.id;
    }
    return 'common';
  }

  function getTier(id) {
    return TIER_MAP[id] || TIER_MAP.common;
  }

  function getColor(id) {
    return getTier(id).color;
  }

  function getName(id) {
    return getTier(id).name;
  }

  return { roll, getTier, getColor, getName, TIERS, TIER_ORDER };
})();

window.Rarity = Rarity;
