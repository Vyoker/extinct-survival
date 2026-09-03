/**
 * State Management (Global State)
 * Single source of truth untuk seluruh data game.
 * Auto-save ke localStorage setiap 30 detik.
 */
const GameState = (function () {
  'use strict';

  const STORAGE_KEY = 'extinct_survival_save';
  const AUTOSAVE_INTERVAL_MS = 30000;

  function createDefaultState(name, startLocation) {
    return {
      player: {
        id: crypto.randomUUID ? crypto.randomUUID() : 'p_' + Date.now(),
        name: name || 'Survivor',
        level: 1,
        exp: 0,
        expToNext: 200, // formula: 100 * level * 2 (level 1 = 200)
        // Atribut disederhanakan jadi 4: ATK/DEF/DEX/INT. Nilai ini
        // ADALAH poin yang sudah dialokasikan (satu-satunya sumber data,
        // tidak ada lagi "atribut dasar" terpisah yang tidak pernah terisi).
        stats: {
          atk: 0,
          def: 0,
          dex: 0,
          int: 0
        },
        attributePoints: 0, // poin belum dialokasikan, +5 tiap level up
        survival: { hunger: 100, thirst: 100, health: 100, sanity: 100 },
        energy: 100,
        maxEnergy: 100,
        // Penanda battle tactical sedang berlangsung (dipakai untuk deteksi
        // & pulihkan energy kalau app ditutup/reload di tengah battle,
        // karena state battle sendiri sengaja tidak di-persist).
        battleInProgress: null,
        // v0.1.7: quest bisa ditumpuk (banyak accepted sekaligus), jadi
        // bukan lagi 1 activeQuestId tunggal. Main quest awal ('prolog_
        // build_fortress') otomatis ke-accept di karakter baru supaya
        // pemain baru langsung punya progres cerita utama.
        questProgress: { acceptedQuestIds: ['prolog_build_fortress'], completedQuestIds: [], huntCounts: {} },
        location: startLocation || 'surabaya_stronghold',
        faction: null,
        // v0.1.8: reputasi & Koin Faksi disimpan per-faksi supaya progres
        // tidak hilang kalau pemain pindah faksi lalu balik lagi nanti.
        factionData: {},
        reputation: {},
        // v0.1.9: Elite Pass — level naik otomatis dari EXP karakter (1:1),
        // 2 jalur (Free selalu bisa diklaim, Premium perlu dibuka pakai Kredit)
        passProgress: { level: 1, exp: 0, premiumUnlocked: false, claimedFree: [], claimedPremium: [] },
        skills: {
          survivor: { rank: 0, tier: 1, exp: 0 },
          hunter: { rank: 0, tier: 1, exp: 0 },
          scavenger: { rank: 0, tier: 1, exp: 0 }
        },
        inventory: [
          { itemId: 'canned_food_01', qty: 2 },
          { itemId: 'water_bottle_01', qty: 2 },
          { itemId: 'machete_01', qty: 1 }
        ],
        equipment: { head: null, chest: null, legs: null, weapon: null, offhand: null, accessory: null },
        currency: { rupiah: 500, kredit: 0 },
        lastOnline: Date.now(),
        totalPlayTime: 0
      },
      world: {
        time: Date.now(),
        day: 1,
        weather: 'clear',
        events: [],
        marketPrices: {}
      },
      factions: {},
      quests: {},
      combat: null,
      exploration: null,
      meta: {
        createdAt: Date.now(),
        version: '0.1.0'
      }
    };
  }

  let state = null;
  let autosaveHandle = null;

  function hasSave() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  // Migrasi save lama supaya kompatibel dengan skema terbaru
  // (skill rank/tier/exp, currency kredit, dsb). Aman dipanggil berulang.
  function migrate(s) {
    if (!s || !s.player) return s;
    const p = s.player;

    // Skills: skema lama {combat:0,...} -> skema baru {rank,tier,exp}
    const validSkillIds = ['survivor', 'hunter', 'scavenger'];
    if (!p.skills || typeof p.skills !== 'object') p.skills = {};
    validSkillIds.forEach(id => {
      const sk = p.skills[id];
      const isValidShape = sk && typeof sk === 'object'
        && typeof sk.rank === 'number' && typeof sk.tier === 'number' && typeof sk.exp === 'number';
      if (!isValidShape) {
        p.skills[id] = { rank: 0, tier: 1, exp: 0 };
      }
    });
    // Buang skill id lama yang sudah tidak dipakai
    Object.keys(p.skills).forEach(id => {
      if (!validSkillIds.includes(id)) delete p.skills[id];
    });

    // Currency: bottlecaps lama -> kredit
    if (!p.currency) p.currency = { rupiah: 0, kredit: 0 };
    if (typeof p.currency.kredit !== 'number') {
      p.currency.kredit = typeof p.currency.bottlecaps === 'number' ? p.currency.bottlecaps : 0;
    }
    delete p.currency.bottlecaps;

    // expToNext lama (formula 1.15x) dikonversi ke formula baru kalau perlu
    if (window.Player && typeof p.level === 'number') {
      const correctExpToNext = Player.calcExpToNext(p.level);
      if (p.expToNext !== correctExpToNext && (!p.expToNext || p.expToNext < correctExpToNext)) {
        p.expToNext = correctExpToNext;
      }
    }

    // Attribute Points: pastikan ada di save lama
    if (typeof p.attributePoints !== 'number') p.attributePoints = 0;

    // Sederhanakan atribut jadi 4 (ATK/DEF/DEX/INT), satu sumber data.
    // Migrasi dari skema manapun sebelumnya (5 stat lama + allocatedPoints
    // terpisah, ATAU stats lama yang cuma belum punya field atk/def/dex/int).
    if (!p.stats || typeof p.stats.atk !== 'number') {
      const oldAlloc = p.allocatedPoints || {};
      p.stats = {
        atk: oldAlloc.damage || 0,
        def: oldAlloc.defense || 0,
        dex: (oldAlloc.evasion || 0) + (oldAlloc.crit || 0),
        int: 0
      };
    }
    delete p.allocatedPoints;

    // Gabungkan stamina lama ke energy (fitur unifikasi)
    if (typeof p.stamina === 'number') {
      if (typeof p.energy === 'number') {
        p.energy = Math.min(p.maxEnergy || 100, p.energy + p.stamina);
      }
      delete p.stamina;
      delete p.maxStamina;
    }

    // battleInProgress: pastikan ada di save lama (fitur recovery battle)
    if (typeof p.battleInProgress === 'undefined') p.battleInProgress = null;

    // factionData: fitur baru v0.1.8, save lama belum punya field ini.
    // Reset p.faction kalau menunjuk ke faksi lama yang sudah tidak ada
    // (skema faksi lama sebelum v0.1.8 pakai id kota, bukan tematik).
    if (!p.factionData || typeof p.factionData !== 'object') p.factionData = {};
    if (typeof p.faction === 'undefined') p.faction = null;
    const KNOWN_FACTION_IDS = ['blue_tiger', 'mojang_beauty', 'seafire', 'viking_bonex', 'white_ghost'];
    if (p.faction && !KNOWN_FACTION_IDS.includes(p.faction)) {
      p.faction = null;
    }

    // passProgress: fitur baru v0.1.9, save lama belum punya field ini
    if (!p.passProgress || typeof p.passProgress !== 'object') {
      p.passProgress = { level: 1, exp: 0, premiumUnlocked: false, claimedFree: [], claimedPremium: [] };
    }
    if (typeof p.passProgress.level !== 'number') p.passProgress.level = 1;
    if (typeof p.passProgress.exp !== 'number') p.passProgress.exp = 0;
    if (typeof p.passProgress.premiumUnlocked !== 'boolean') p.passProgress.premiumUnlocked = false;
    if (!Array.isArray(p.passProgress.claimedFree)) p.passProgress.claimedFree = [];
    if (!Array.isArray(p.passProgress.claimedPremium)) p.passProgress.claimedPremium = [];

    // questProgress: fitur baru v0.1.3, save lama belum punya field ini.
    // v0.1.7: skema diubah dari 1 activeQuestId tunggal jadi banyak quest
    // yang bisa ditumpuk sekaligus (acceptedQuestIds array). Save lama
    // dengan activeQuestId dimigrasi otomatis ke array berisi 1 id itu,
    // dan hunt counter lama (dikunci per-enemyId) dimigrasi jadi per-quest
    // (dikunci "questId:enemyId") supaya tidak tabrakan hitungannya kalau
    // di masa depan ada >1 quest hunt aktif dengan musuh yang sama.
    if (!p.questProgress || typeof p.questProgress !== 'object') {
      p.questProgress = { acceptedQuestIds: ['prolog_build_fortress'], completedQuestIds: [], huntCounts: {} };
    }
    if (!Array.isArray(p.questProgress.completedQuestIds)) p.questProgress.completedQuestIds = [];
    if (!p.questProgress.huntCounts || typeof p.questProgress.huntCounts !== 'object') p.questProgress.huntCounts = {};

    if (!Array.isArray(p.questProgress.acceptedQuestIds)) {
      const legacyId = p.questProgress.activeQuestId;
      p.questProgress.acceptedQuestIds = legacyId ? [legacyId] : [];

      // Hunt counter lama dikunci per-enemyId saja -> pindah jadi
      // "legacyId:enemyId" supaya tetap cocok dengan quest yang sedang
      // berjalan (hanya relevan kalau quest lama itu tipe hunt).
      if (legacyId) {
        const migratedCounts = {};
        Object.entries(p.questProgress.huntCounts).forEach(([enemyId, count]) => {
          migratedCounts[legacyId + ':' + enemyId] = count;
        });
        p.questProgress.huntCounts = migratedCounts;
      }
    }
    delete p.questProgress.activeQuestId;

    return s;
  }

  // Dipanggil setelah ItemDB siap (dari main.js), supaya bisa lookup
  // stat durability item lama yang masih format string.
  function migrateEquipmentDurability() {
    if (!state || !state.player || !state.player.equipment) return;
    const equipment = state.player.equipment;
    Object.keys(equipment).forEach(slot => {
      const val = equipment[slot];
      if (typeof val === 'string') {
        const def = window.ItemDB ? ItemDB.get(val) : null;
        const maxDur = def && def.stats && typeof def.stats.durability === 'number' ? def.stats.durability : null;
        equipment[slot] = { itemId: val, durability: maxDur };
      } else if (val && val.itemId && (val.durability === null || val.durability === undefined)) {
        // Item sudah object tapi durability-nya null: cek ulang, mungkin
        // item ini baru saja dapat stat durability di update terbaru
        // (misal armor yang sebelumnya tidak punya durability).
        const def = window.ItemDB ? ItemDB.get(val.itemId) : null;
        if (def && def.stats && typeof def.stats.durability === 'number') {
          val.durability = def.stats.durability; // anggap masih penuh
        }
      }
    });
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      state = JSON.parse(raw);
      state = migrate(state);
      return state;
    } catch (e) {
      console.error('[GameState] Gagal parse save data:', e);
      return null;
    }
  }

  function save() {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[GameState] Gagal menyimpan:', e);
    }
  }

  function init(name, startLocation) {
    state = createDefaultState(name, startLocation);
    save();
    return state;
  }

  function get() {
    return state;
  }

  function startAutosave() {
    if (autosaveHandle) clearInterval(autosaveHandle);
    autosaveHandle = setInterval(() => {
      save();
      if (window.Events) window.Events.emit('state:autosaved');
    }, AUTOSAVE_INTERVAL_MS);
  }

  function stopAutosave() {
    if (autosaveHandle) clearInterval(autosaveHandle);
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    state = null;
  }

  return { hasSave, load, save, init, get, startAutosave, stopAutosave, reset, migrateEquipmentDurability };
})();
