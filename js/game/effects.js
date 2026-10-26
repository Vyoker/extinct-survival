/**
 * Effects — Extinct Survival v0.7.3
 * Efek atribut senjata & bonus set armor. Modul murni (tidak menyentuh
 * DOM): dipakai BattleBridge (hitung bonus pemain), BattleEngine
 * (label status) dan Panels (detail item). Satu-satunya sumber definisi
 * bonus set, supaya tidak ada duplikasi angka di tiga tempat.
 *
 * Aturan yang dikunci user (2026-10-26):
 * - Senjata: hanya yang di-equip yang memicu; DoT diserap Defense dulu;
 *   boss kebal Stun; senapan tanpa efek; peluang 5%-25%.
 * - Armor: bonus set HANYA aktif jika satu set lengkap terpasang
 *   (3/3 armor satu faksi), kecuali equipment standalone (Elite Pass
 *   dan equipment event) yang aktif cukup satu piece.
 * - Armor kandidat single (kulit ular, helm baja, dsb.) aktif jika
 *   piece itu sendiri di-equip, bukan sebagai set.
 */
const Effects = (function () {
  'use strict';

  const STATUS_LABEL = {
    burn: 'BURN',
    poison: 'RACUN',
    bleeding: 'BLEED',
    stun: 'STUN'
  };

  const STATUS_CSS = {
    burn: 'burn',
    poison: 'poison',
    bleeding: 'bleed',
    stun: 'stun'
  };

  const SET_NAMES = {
    blue_tiger: 'Blue Tiger',
    mojang_beauty: 'Mojang',
    seafire: 'Seafire',
    viking_bonex: 'Viking Bonex',
    white_ghost: 'White Ghost'
  };

  // Bonus set per faksi. Angka di sini = angka yang disetujui user
  // di draf JSON set armor v0.7.3 (2026-10-26).
  const SET_BONUSES = {
    blue_tiger: { effect: 'dodge', chance: 15 },
    mojang_beauty: { effect: 'status_resist', chance: 20 },
    seafire: { effect: 'burn_reflect', chance: 20, duration: 2, dotPct: 10 },
    viking_bonex: { effect: 'iron_guard', chance: 15, reductionPct: 50 },
    white_ghost: { effect: 'cleanse_dot', chance: 25 }
  };

  function setBonusLabel(setId) {
    const b = SET_BONUSES[setId];
    if (!b) return null;
    if (b.effect === 'dodge') return 'Menghindar ' + b.chance + '% dari serangan musuh';
    if (b.effect === 'status_resist') return 'Menolak status ' + b.chance + '% saat status akan menempel';
    if (b.effect === 'burn_reflect') return 'Pantulkan Burn ' + b.chance + '% saat diserang melee (' + b.duration + ' giliran)';
    if (b.effect === 'iron_guard') return 'Tahan ' + b.chance + '% peluang damage masuk dipotong ' + b.reductionPct + '%';
    if (b.effect === 'cleanse_dot') return 'Bersihkan DoT ' + b.chance + '% di awal giliran';
    return null;
  }

  function weaponEffectLabel(effect) {
    if (!effect || !effect.type) return null;
    const name = STATUS_LABEL[effect.type] || effect.type.toUpperCase();
    if (effect.type === 'stun') {
      return name + ' ' + effect.chance + '% (1 giliran, boss kebal)';
    }
    let s = name + ' ' + effect.chance + '%, ' + effect.duration + ' giliran, ' + effect.dotPct + '% damage/giliran';
    if (effect.blocksDefenseRegen) s += ' (blokir regen Defense)';
    return s;
  }

  function weaponEffectShort(effect) {
    if (!effect || !effect.type) return null;
    return (STATUS_LABEL[effect.type] || effect.type.toUpperCase()) + ' ' + effect.chance + '%';
  }

  function resistLabel(resist) {
    if (!resist || !resist.type) return null;
    if (resist.type === 'block') return 'Tangkis ' + resist.chance + '% serangan musuh';
    return 'Tahan ' + (STATUS_LABEL[resist.type] || resist.type) + ' ' + resist.chance + '%';
  }

  function standaloneLabel(effect) {
    if (!effect) return null;
    if (effect.type === 'defense_regen') return 'Regen Defense +' + effect.perTurn + '/giliran';
    return null;
  }

  // Baris efek untuk popup detail item. Mengembalikan string atau null.
  function formatItemEffect(def) {
    if (!def) return null;
    const parts = [];
    if (def.effect) {
      const l = weaponEffectLabel(def.effect);
      if (l) parts.push('Efek senjata: ' + l);
    }
    if (def.armorSet) {
      const setName = SET_NAMES[def.armorSet] || def.armorSet;
      const bonus = setBonusLabel(def.armorSet);
      parts.push('Set ' + setName + ' — bonus aktif jika 3/3 terpasang' + (bonus ? ': ' + bonus : ''));
    }
    if (def.standaloneEffect) {
      const l = standaloneLabel(def.standaloneEffect);
      if (l) parts.push('Efek standalone: ' + l);
    }
    if (def.resist) {
      const l = resistLabel(def.resist);
      if (l) parts.push('Efek armor: ' + l);
    }
    return parts.length ? parts.join(' | ') : null;
  }

  /**
   * Hitung bonus armor pemain dari daftar def armor yang terpasang
   * dan daftar semua def item (untuk menghitung ukuran set).
   * equippedDefs: array def (boleh berisi null, dilewati).
   * allDefs: array def semua item.
   * Hasil: objek bonus yang langsung dipakai BattleEngine via
   * config.player (field di bawah), plus setId/setBonus untuk info.
   */
  function resolveArmorBonus(equippedDefs, allDefs) {
    const bonus = {
      setId: null, setBonus: null,
      dodgeChance: 0, ironGuardChance: 0, ironGuardReductionPct: 50,
      statusResistChance: 0, cleanseChance: 0,
      defenseRegen: 0, burnReflect: null, blockChance: 0,
      resists: {}
    };
    const equipped = (equippedDefs || []).filter(Boolean);
    const all = allDefs || [];

    // Bonus set: hitung per set, aktif hanya bila semua piece set
    // itu terpasang (lengkap, bukan parsial).
    const bySet = {};
    equipped.forEach(function (def) {
      if (def.armorSet) {
        if (!bySet[def.armorSet]) bySet[def.armorSet] = 0;
        bySet[def.armorSet] += 1;
      }
    });
    Object.keys(bySet).forEach(function (setId) {
      const total = all.filter(function (d) { return d && d.armorSet === setId; }).length;
      if (total > 0 && bySet[setId] >= total && SET_BONUSES[setId]) {
        bonus.setId = setId;
        bonus.setBonus = SET_BONUSES[setId];
      }
    });
    if (bonus.setBonus) {
      const b = bonus.setBonus;
      if (b.effect === 'dodge') bonus.dodgeChance = b.chance;
      if (b.effect === 'status_resist') bonus.statusResistChance = b.chance;
      if (b.effect === 'burn_reflect') bonus.burnReflect = { chance: b.chance, duration: b.duration, dotPct: b.dotPct };
      if (b.effect === 'iron_guard') { bonus.ironGuardChance = b.chance; bonus.ironGuardReductionPct = b.reductionPct || 50; }
      if (b.effect === 'cleanse_dot') bonus.cleanseChance = b.chance;
    }

    // Standalone + resist per piece (aktif cukup piece itu terpasang).
    equipped.forEach(function (def) {
      if (def.standaloneEffect && def.standaloneEffect.type === 'defense_regen') {
        bonus.defenseRegen = Math.max(bonus.defenseRegen, def.standaloneEffect.perTurn || 0);
      }
      if (def.resist && def.resist.type && typeof def.resist.chance === 'number') {
        if (def.resist.type === 'block') {
          bonus.blockChance = Math.max(bonus.blockChance, def.resist.chance);
        } else {
          const prev = bonus.resists[def.resist.type] || 0;
          bonus.resists[def.resist.type] = Math.max(prev, def.resist.chance);
        }
      }
    });
    return bonus;
  }

  return {
    STATUS_LABEL, STATUS_CSS, SET_NAMES, SET_BONUSES,
    setBonusLabel, weaponEffectLabel, weaponEffectShort,
    resistLabel, standaloneLabel, formatItemEffect, resolveArmorBonus
  };
})();

if (typeof window !== 'undefined') window.Effects = Effects;
if (typeof module !== 'undefined' && module.exports) module.exports = Effects;
