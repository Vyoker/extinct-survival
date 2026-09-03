/**
 * Quest Database + Quest System (v0.1.7 rewrite)
 * QuestDB: memuat definisi misi dari js/data/quests.json (pola sama
 * seperti ItemDB/LocationDB). Tiap quest sekarang punya:
 *   - category: 'main' | 'side'
 *   - prereqQuestId: quest lain yang harus sudah diklaim dulu (null =
 *     langsung tersedia sejak awal)
 *   - nextQuestId: dipakai untuk chain main quest (opsional)
 *
 * QuestSystem: mengatur progres BANYAK quest sekaligus (ditumpuk/stack),
 * bukan lagi cuma 1 quest aktif. Alur baru:
 *   tersedia (available) -> Ambil (accept) -> masuk acceptedQuestIds ->
 *   semua objective selesai -> klaim (claim) -> masuk completedQuestIds
 *   -> quest lain yang prereq-nya cocok jadi available.
 *
 * Batas stack: main quest max 1 aktif bersamaan (linear story), side
 * quest bisa sampai 5 aktif bersamaan (ditumpuk).
 *
 * 2 tipe objective (sama seperti sebelumnya):
 *   - 'collect' : progres dibaca langsung dari qty item di Tas (live)
 *   - 'hunt'    : progres dihitung dari counter kill per quest+enemyId,
 *                 di-increment oleh battle-bridge.js tiap menang battle
 *                 (dikunci per quest supaya 2 quest hunt dengan musuh
 *                 yang sama tidak saling mengganggu hitungannya)
 */
const QuestDB = (function () {
  'use strict';

  let quests = {};
  let loaded = false;

  async function load() {
    if (loaded) return quests;
    try {
      const res = await fetch('js/data/quests.json');
      const list = await res.json();
      quests = {};
      list.forEach(q => { quests[q.id] = q; });
      loaded = true;
    } catch (e) {
      console.error('[QuestDB] Gagal memuat quests.json:', e);
    }
    return quests;
  }

  function get(id) {
    return quests[id] || null;
  }

  function all() {
    return quests;
  }

  return { load, get, all };
})();

window.QuestDB = QuestDB;

const QuestSystem = (function () {
  'use strict';

  const MAX_ACTIVE_MAIN = 1;
  const MAX_ACTIVE_SIDE = 5;

  function getPlayer() {
    return GameState.get().player;
  }

  // Pastikan struktur questProgress selalu berbentuk baru (list, bukan
  // 1 activeQuestId). Migrasi dari skema lama juga ditangani di
  // state.js (GameState.migrate), fungsi ini cuma jaring pengaman kedua.
  function ensureShape() {
    const p = getPlayer();
    if (!p.questProgress || typeof p.questProgress !== 'object') {
      p.questProgress = { acceptedQuestIds: [], completedQuestIds: [], huntCounts: {} };
    }
    if (!Array.isArray(p.questProgress.acceptedQuestIds)) {
      // Migrasi in-place dari skema lama { activeQuestId }
      const legacyId = p.questProgress.activeQuestId;
      p.questProgress.acceptedQuestIds = legacyId ? [legacyId] : [];
    }
    if (!Array.isArray(p.questProgress.completedQuestIds)) p.questProgress.completedQuestIds = [];
    if (!p.questProgress.huntCounts || typeof p.questProgress.huntCounts !== 'object') p.questProgress.huntCounts = {};
    delete p.questProgress.activeQuestId;
  }

  function getQuestDef(questId) {
    return window.QuestDB ? QuestDB.get(questId) : null;
  }

  function isAccepted(questId) {
    ensureShape();
    return getPlayer().questProgress.acceptedQuestIds.includes(questId);
  }

  function isCompleted(questId) {
    ensureShape();
    return getPlayer().questProgress.completedQuestIds.includes(questId);
  }

  function prereqSatisfied(quest) {
    if (!quest.prereqQuestId) return true;
    return isCompleted(quest.prereqQuestId);
  }

  // Quest yang BISA diambil sekarang: belum diambil, belum selesai,
  // dan prereq-nya (kalau ada) sudah diklaim.
  function getAvailableQuests() {
    ensureShape();
    const all = window.QuestDB ? Object.values(QuestDB.all()) : [];
    return all.filter(q => !isAccepted(q.id) && !isCompleted(q.id) && prereqSatisfied(q));
  }

  // Quest yang sedang ditumpuk/aktif (sudah diambil, belum diklaim)
  function getAcceptedQuests() {
    ensureShape();
    const p = getPlayer();
    return p.questProgress.acceptedQuestIds
      .map(id => getQuestDef(id))
      .filter(Boolean);
  }

  function getAcceptedQuestsByCategory(category) {
    return getAcceptedQuests().filter(q => q.category === category);
  }

  function getAvailableQuestsByCategory(category) {
    return getAvailableQuests().filter(q => q.category === category);
  }

  function canAccept(questId) {
    const quest = getQuestDef(questId);
    if (!quest) return { ok: false, reason: 'Misi tidak ditemukan.' };
    if (isAccepted(questId)) return { ok: false, reason: 'Misi ini sudah diambil.' };
    if (isCompleted(questId)) return { ok: false, reason: 'Misi ini sudah selesai.' };
    if (!prereqSatisfied(quest)) return { ok: false, reason: 'Misi sebelumnya belum diselesaikan.' };

    const cap = quest.category === 'main' ? MAX_ACTIVE_MAIN : MAX_ACTIVE_SIDE;
    const activeCount = getAcceptedQuestsByCategory(quest.category).length;
    if (activeCount >= cap) {
      return {
        ok: false,
        reason: quest.category === 'main'
          ? 'Selesaikan main quest yang aktif dulu sebelum ambil yang baru.'
          : `Maksimal ${MAX_ACTIVE_SIDE} side quest aktif bersamaan. Selesaikan salah satu dulu.`
      };
    }
    return { ok: true };
  }

  function acceptQuest(questId) {
    const check = canAccept(questId);
    if (!check.ok) {
      Events.emit('notify', { message: check.reason, type: 'error' });
      return false;
    }
    ensureShape();
    const p = getPlayer();
    p.questProgress.acceptedQuestIds.push(questId);
    GameState.save();
    Events.emit('notify', { message: `📋 Misi "${getQuestDef(questId).title}" diambil.` });
    Events.emit('quests:updated');
    return true;
  }

  // Batalkan side quest yang sedang ditumpuk (tidak berlaku untuk main
  // quest, supaya alur cerita utama tidak bisa "dibuang" begitu saja).
  function abandonQuest(questId) {
    const quest = getQuestDef(questId);
    if (!quest || quest.category !== 'side') {
      Events.emit('notify', { message: 'Misi ini tidak bisa dibatalkan.', type: 'error' });
      return false;
    }
    ensureShape();
    const p = getPlayer();
    const idx = p.questProgress.acceptedQuestIds.indexOf(questId);
    if (idx === -1) return false;
    p.questProgress.acceptedQuestIds.splice(idx, 1);
    // Bersihkan hunt counter khusus quest ini supaya tidak menumpuk sia-sia
    Object.keys(p.questProgress.huntCounts).forEach(key => {
      if (key.startsWith(questId + ':')) delete p.questProgress.huntCounts[key];
    });
    GameState.save();
    Events.emit('notify', { message: `Misi "${quest.title}" dibatalkan.` });
    Events.emit('quests:updated');
    return true;
  }

  function getItemQty(itemId) {
    const entry = Inventory.getInventory().find(e => e.itemId === itemId);
    return entry ? entry.qty : 0;
  }

  // Progres tiap objective untuk 1 quest tertentu (dipakai UI), format
  // seragam untuk kedua tipe (collect/hunt).
  function getObjectiveProgress(questId) {
    const quest = getQuestDef(questId);
    if (!quest) return [];
    const p = getPlayer();
    ensureShape();

    if (quest.type === 'collect') {
      return quest.objectives.map(obj => {
        const def = window.ItemDB ? ItemDB.get(obj.itemId) : null;
        const have = getItemQty(obj.itemId);
        return {
          label: def ? def.name : obj.itemId,
          have: Math.min(have, obj.target),
          target: obj.target,
          done: have >= obj.target
        };
      });
    }

    if (quest.type === 'hunt') {
      return quest.objectives.map(obj => {
        const key = questId + ':' + obj.enemyId;
        const have = p.questProgress.huntCounts[key] || 0;
        return {
          label: obj.name || obj.enemyId,
          have: Math.min(have, obj.target),
          target: obj.target,
          done: have >= obj.target
        };
      });
    }

    return [];
  }

  function isQuestComplete(questId) {
    const progress = getObjectiveProgress(questId);
    if (progress.length === 0) return false;
    return progress.every(o => o.done);
  }

  // Dipanggil dari battle-bridge.js tiap kali 1 musuh berhasil dikalahkan
  // (win). Cek SEMUA quest hunt yang sedang ditumpuk, bukan cuma 1.
  function registerKill(enemyId) {
    ensureShape();
    const p = getPlayer();
    getAcceptedQuests().forEach(quest => {
      if (quest.type !== 'hunt') return;
      const obj = quest.objectives.find(o => o.enemyId === enemyId);
      if (!obj) return;

      const key = quest.id + ':' + enemyId;
      const current = p.questProgress.huntCounts[key] || 0;
      if (current < obj.target) {
        p.questProgress.huntCounts[key] = current + 1;
      }
    });
  }

  function claimQuest(questId) {
    const quest = getQuestDef(questId);
    if (!quest || !isAccepted(questId)) {
      Events.emit('notify', { message: 'Misi ini belum diambil.', type: 'error' });
      return false;
    }
    if (!isQuestComplete(questId)) {
      Events.emit('notify', { message: 'Objective misi belum semua selesai.', type: 'error' });
      return false;
    }

    const p = getPlayer();

    // Untuk quest 'collect', material yang jadi syarat dikonsumsi dari Tas
    if (quest.type === 'collect') {
      quest.objectives.forEach(obj => Inventory.removeItem(obj.itemId, obj.target));
    }

    // Berikan reward
    const rewards = quest.rewards || {};
    if (rewards.exp) Player.addExp(rewards.exp);
    if (rewards.rupiah) p.currency.rupiah += rewards.rupiah;
    if (rewards.kredit) p.currency.kredit += rewards.kredit;

    // Pindah dari accepted -> completed, bersihkan hunt counter quest ini
    const idx = p.questProgress.acceptedQuestIds.indexOf(questId);
    if (idx !== -1) p.questProgress.acceptedQuestIds.splice(idx, 1);
    p.questProgress.completedQuestIds.push(questId);
    Object.keys(p.questProgress.huntCounts).forEach(key => {
      if (key.startsWith(questId + ':')) delete p.questProgress.huntCounts[key];
    });

    // Kalau ada nextQuestId (chain main quest) dan pemain belum punya/
    // selesaikan itu, otomatis langsung tersedia (bukan auto-accept,
    // pemain tetap harus tap "Ambil" supaya konsisten dengan alur baru).
    GameState.save();
    Events.emit('notify', { message: `✅ Misi "${quest.title}" selesai!` });
    Events.emit('player:updated');
    Events.emit('inventory:updated');
    Events.emit('quests:updated');
    return true;
  }

  return {
    getQuestDef, getAvailableQuests, getAcceptedQuests,
    getAvailableQuestsByCategory, getAcceptedQuestsByCategory,
    canAccept, acceptQuest, abandonQuest,
    getObjectiveProgress, isQuestComplete, isAccepted, isCompleted,
    registerKill, claimQuest, ensureShape,
    MAX_ACTIVE_MAIN, MAX_ACTIVE_SIDE
  };
})();

window.QuestSystem = QuestSystem;
