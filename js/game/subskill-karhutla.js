/**
 * SubSkill Karhutla — terpasang 2026-10-25, badge disetujui user.
 * Modul BARU yang berdiri sendiri, supaya skills.js
 * (survivor / hunter / scavenger) tidak dirombak sama sekali.
 *
 * Keputusan user 2026-10-25:
 * - Reward event karhutla (sekali jalan, 20 misi, dalang sabotase pihak ketiga)
 * - Hanya pakai item yang sudah ada
 * - Efek pasif: looting Kayu (wood_plank) dari Scavenge menjadi 2x lipat,
 *   dan chance Kayu naik 20% (relatif, lihat woodWeight di bawah)
 *
 * Titik pasang (sudah dilakukan):
 * 1. <script> di index.html, sebelum exploration.js.
 * 2. Exploration.pickLootWeighted memakai woodWeight().
 * 3. Exploration.scavenge (loop utama + bonus pick) memakai woodQty().
 * 4. QuestSystem.claimQuest memanggil unlock() saat misi final diklaim
 *    — ID misi final masih placeholder di bawah, karena data 20 misi
 *    karhutla belum ditulis. Sampai saat itu sub skill tetap terkunci.
 * 5. GameState.migrate memastikan `p.subSkills` berbentuk object.
 *    JANGAN masukkan 'karhutla' ke p.skills, karena migrate skills
 *    menghapus skill yang tidak ada di daftar valid (survivor/hunter/
 *    scavenger) — inilah alasan sub skill disimpan terpisah.
 *
 * Ruang lingkup efek (sengaja sempit):
 * - Hanya Scavenge, bukan Hunting loot, crafting, toko, atau barter.
 * - Hanya item wood_plank. Hari ini wood_plank hanya ada di loot pool
 *   Kalimantan Wilds, jadi boost chance praktis hanya terasa di sana.
 * - Tidak menaikkan rank/tier, tidak pakai EXP. Sekali unlock, aktif permanen.
 */
const SubSkillKarhutla = (function () {
  'use strict';

  const ID = 'karhutla';
  const WOOD_ITEM_ID = 'wood_plank';
  const QTY_MULTIPLIER = 2;
  const CHANCE_MULTIPLIER = 1.2; // +20% relatif, BUKAN +20 poin persentase
  const FINAL_QUEST_ID = 'karhutla_20_fajar_setelah_asap'; // v0.7.1: misi final event karhutla, terkunci

  function getPlayer() {
    return (typeof GameState !== 'undefined' && GameState.get)
      ? GameState.get().player
      : null;
  }

  function ensureShape(player) {
    if (!player.subSkills || typeof player.subSkills !== 'object') {
      player.subSkills = {};
    }
    return player.subSkills;
  }

  function isUnlocked() {
    const p = getPlayer();
    return !!(p && p.subSkills && p.subSkills[ID] === true);
  }

  // Dipanggil sekali saat misi final karhutla diklaim. Idempotent:
  // kalau sudah unlock, tidak memberi apa-apa lagi (event sekali jalan).
  function unlock() {
    const p = getPlayer();
    if (!p) return false;
    const sub = ensureShape(p);
    if (sub[ID] === true) return false;
    sub[ID] = true;
    if (typeof GameState !== 'undefined' && GameState.save) GameState.save();
    if (typeof Events !== 'undefined' && Events.emit) {
      Events.emit('notify', { message: 'Sub Skill Karhutla terbuka: Kayu Scavenge x2, chance Kayu +20%.' });
      Events.emit('subskills:updated');
    }
    return true;
  }

  // Dipakai pickLootWeighted: bobot kayu dikali 1.2, item lain tidak berubah.
  // Contoh Kalimantan: bobot kayu 40 -> 48, total bobot 100 -> 108,
  // chance kayu 40% -> 44.4%. Kalau maksudnya +20 poin (40% -> 60%),
  // ubah fungsi ini, bukan angka di tempat lain.
  function woodWeight(weight, itemId) {
    if (!isUnlocked() || itemId !== WOOD_ITEM_ID) return weight;
    return weight * CHANCE_MULTIPLIER;
  }

  // Dipakai scavenge: qty kayu dikali 2 (1-2 jadi 2-4), item lain tidak berubah.
  function woodQty(qty, itemId) {
    if (!isUnlocked() || itemId !== WOOD_ITEM_ID) return qty;
    return qty * QTY_MULTIPLIER;
  }

  function describe() {
    return {
      id: ID,
      name: 'Karhutla',
      active: isUnlocked(),
      effects: 'Kayu Scavenge x2; chance Kayu +20% (relatif)',
      scope: 'Scavenge saja, item wood_plank saja'
    };
  }

  return {
    ID, WOOD_ITEM_ID, QTY_MULTIPLIER, CHANCE_MULTIPLIER, FINAL_QUEST_ID,
    isUnlocked, unlock, woodWeight, woodQty, describe
  };
})();

if (typeof window !== 'undefined') window.SubSkillKarhutla = SubSkillKarhutla;
if (typeof module !== 'undefined' && module.exports) module.exports = SubSkillKarhutla;
