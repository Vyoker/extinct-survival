/**
 * Spin Wheel Module
 * Roda putar berhadiah, dibuka lewat Menu Hamburger. 1x putaran = 1x
 * nonton Iklan Reward (AdMob via js/game/ads.js). Ukuran juring roda
 * proporsional terhadap peluang menang tiap hadiah (juring lebih besar
 * = peluang lebih besar), jadi visualnya sekaligus jujur ke pemain.
 *
 * Tabel hadiah (chance total harus 100):
 *   - EXP 500          -> common, 35%
 *   - Rupiah 5.000     -> common, 35%
 *   - Item acak (common)-> common, 25% (dari pool 5 item common)
 *   - Kredit 10-50      -> rare, 5%
 */
const SpinWheel = (function () {
  'use strict';

  // Pool 5 item common yang bisa keluar dari hadiah "Item".
  const ITEM_POOL = [
    'canned_food_01', 'water_bottle_01', 'bandage_01', 'wood_plank', 'scrap_metal'
  ];

  // Urutan array ini menentukan urutan juring di roda (searah jarum jam
  // dari sudut 0°/atas). `chance` dalam persen, total harus 100.
  const PRIZES = [
    { id: 'exp', label: '✨ EXP 500', color: '#4f9fd8', chance: 35 },
    { id: 'rupiah', label: '💵 Rp 5.000', color: '#7fc93f', chance: 35 },
    { id: 'item', label: '🎒 Item', color: '#e0b83f', chance: 25 },
    { id: 'kredit', label: '💎 Kredit', color: '#d84fc9', chance: 5 }
  ];

  function getPlayer() {
    return GameState.get().player;
  }

  // Weighted random pick berdasarkan field `chance`.
  function rollPrize() {
    const total = PRIZES.reduce((sum, p) => sum + p.chance, 0);
    let roll = Math.random() * total;
    for (const prize of PRIZES) {
      if (roll < prize.chance) return prize;
      roll -= prize.chance;
    }
    return PRIZES[PRIZES.length - 1]; // fallback (harusnya tak pernah kena)
  }

  // Hitung sudut awal (derajat) tiap juring, dipakai buat gambar roda
  // (conic-gradient) & buat animasi supaya jarum berhenti di tengah
  // juring hadiah yang menang.
  function getSliceRanges() {
    const total = PRIZES.reduce((sum, p) => sum + p.chance, 0);
    let cursor = 0;
    return PRIZES.map(p => {
      const startDeg = (cursor / total) * 360;
      const sweepDeg = (p.chance / total) * 360;
      cursor += p.chance;
      return { ...p, startDeg, sweepDeg, midDeg: startDeg + sweepDeg / 2 };
    });
  }

  function grantPrize(prize) {
    const p = getPlayer();
    let detailText = '';

    switch (prize.id) {
      case 'exp':
        Player.addExp(500);
        detailText = '+500 EXP';
        break;
      case 'rupiah':
        p.currency.rupiah += 5000;
        detailText = '+Rp 5.000';
        break;
      case 'kredit': {
        const amount = Math.floor(Math.random() * (50 - 10 + 1)) + 10;
        p.currency.kredit += amount;
        detailText = `+${amount} 💎 Kredit`;
        break;
      }
      case 'item': {
        const itemId = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
        Inventory.addItem(itemId, 1);
        const def = ItemDB.get(itemId);
        detailText = `+1 ${def ? def.name : itemId}`;
        break;
      }
    }

    GameState.save();
    Events.emit('player:updated');
    return detailText;
  }

  return { PRIZES, rollPrize, getSliceRanges, grantPrize };
})();

window.SpinWheel = SpinWheel;
