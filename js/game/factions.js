/**
 * Faction Database + Faction System (v0.1.8)
 * 5 faksi tematik (bukan terikat kota/lokasi seperti draft lama):
 * Blue Tiger, Mojang Beauty, Seafire, Viking Bonex, White Ghost.
 * Player join 1 faksi, naikkan reputasi + kumpulkan Koin Faksi dari
 * aktivitas (Scavenge/Hunting) selama sedang jadi anggota, lalu tukar
 * Koin Faksi itu di Faction Shop untuk equipment/item eksklusif faksi
 * (rarity Rare ke atas, di atas Uncommon sesuai permintaan).
 *
 * Reputasi & koin disimpan PER FAKSI (p.factionData[factionId]), jadi
 * kalau pemain pindah faksi lalu balik lagi, progres lama tidak hilang
 * — cuma berhenti nambah selama tidak jadi anggota aktif.
 */
const FactionDB = (function () {
  'use strict';

  let factions = {};
  let loaded = false;

  async function load() {
    if (loaded) return factions;
    try {
      const res = await fetch('js/data/factions.json');
      const list = await res.json();
      factions = {};
      list.forEach(f => { factions[f.id] = f; });
      loaded = true;
    } catch (e) {
      console.error('[FactionDB] Gagal memuat factions.json:', e);
    }
    return factions;
  }

  function get(id) {
    return factions[id] || null;
  }

  function all() {
    return factions;
  }

  return { load, get, all };
})();

window.FactionDB = FactionDB;

const FactionSystem = (function () {
  'use strict';

  // Tier rank berdasarkan reputasi (khusus faksi yang sedang diikuti)
  const RANKS = [
    { name: 'Rekrut', minRep: 0 },
    { name: 'Anggota', minRep: 100 },
    { name: 'Veteran', minRep: 300 },
    { name: 'Elite', minRep: 700 },
    { name: 'Legenda', minRep: 1500 }
  ];

  // Rarity item Faction Shop yang bisa dibeli: butuh reputasi minimum
  // + harga dalam Koin Faksi. Common/Uncommon sengaja tidak dijual di
  // sini (sudah cukup didapat lewat Shop/scavenge biasa).
  const RARITY_GATE = {
    rare: { minRep: 0, price: 80 },
    epic: { minRep: 300, price: 220 },
    legendary: { minRep: 700, price: 500 }
  };

  // Sumber reputasi + koin: aktivitas Scavenge & menang Hunting selama
  // jadi anggota aktif faksi manapun (tidak lagi terikat lokasi/kota).
  const SCAVENGE_REP = 3;
  const SCAVENGE_COIN = 2;

  function getPlayer() {
    return GameState.get().player;
  }

  function ensureShape() {
    const p = getPlayer();
    if (typeof p.faction === 'undefined') p.faction = null;
    if (!p.factionData || typeof p.factionData !== 'object') p.factionData = {};

    // Kalau p.faction menunjuk ke id faksi yang sudah tidak ada lagi di
    // FactionDB (misal dari draft lama sebelum v0.1.8), reset ke null
    // supaya tidak nyangkut di faksi hantu.
    if (p.faction && window.FactionDB && !FactionDB.get(p.faction)) {
      p.faction = null;
    }
  }

  function ensureFactionEntry(factionId) {
    const p = getPlayer();
    if (!p.factionData[factionId]) {
      p.factionData[factionId] = { reputation: 0, coins: 0 };
    }
    return p.factionData[factionId];
  }

  function getCurrentFactionId() {
    ensureShape();
    return getPlayer().faction;
  }

  function getReputation(factionId) {
    ensureShape();
    const entry = getPlayer().factionData[factionId];
    return entry ? entry.reputation : 0;
  }

  function getCoins(factionId) {
    ensureShape();
    const entry = getPlayer().factionData[factionId];
    return entry ? entry.coins : 0;
  }

  function getRankInfo(factionId) {
    const rep = getReputation(factionId);
    let current = RANKS[0];
    let next = RANKS[1] || null;
    for (let i = 0; i < RANKS.length; i++) {
      if (rep >= RANKS[i].minRep) {
        current = RANKS[i];
        next = RANKS[i + 1] || null;
      }
    }
    const progressPct = next
      ? Math.min(100, Math.round(((rep - current.minRep) / (next.minRep - current.minRep)) * 100))
      : 100;
    return { name: current.name, rep, next, progressPct };
  }

  function joinFaction(factionId) {
    if (!window.FactionDB || !FactionDB.get(factionId)) {
      Events.emit('notify', { message: 'Faksi tidak ditemukan.', type: 'error' });
      return false;
    }
    ensureShape();
    const p = getPlayer();
    if (p.faction === factionId) {
      Events.emit('notify', { message: 'Kamu sudah jadi anggota faksi ini.', type: 'error' });
      return false;
    }
    p.faction = factionId;
    ensureFactionEntry(factionId);
    GameState.save();
    Events.emit('notify', { message: `🚩 Bergabung dengan ${FactionDB.get(factionId).name}.` });
    Events.emit('player:updated');
    return true;
  }

  function leaveFaction() {
    ensureShape();
    const p = getPlayer();
    if (!p.faction) return false;
    p.faction = null;
    GameState.save();
    Events.emit('notify', { message: 'Kamu keluar dari faksi. Reputasi & Koin Faksi tetap tersimpan kalau ingin gabung lagi nanti.' });
    Events.emit('player:updated');
    return true;
  }

  // Dipanggil dari exploration.js tiap kali Scavenge berhasil
  function grantScavengeProgress() {
    ensureShape();
    const p = getPlayer();
    if (!p.faction) return;
    const entry = ensureFactionEntry(p.faction);
    entry.reputation += SCAVENGE_REP;
    entry.coins += SCAVENGE_COIN;
  }

  // Dipanggil dari battle-bridge.js tiap kali menang Hunting, per musuh
  // yang berhasil dikalahkan (expReward dipakai buat skala reward).
  function grantHuntProgress(expReward) {
    ensureShape();
    const p = getPlayer();
    if (!p.faction) return;
    const entry = ensureFactionEntry(p.faction);
    const repGain = Math.max(5, Math.round((expReward || 10) / 3));
    const coinGain = Math.max(3, Math.round((expReward || 10) / 5));
    entry.reputation += repGain;
    entry.coins += coinGain;
  }

  // Semua item eksklusif 1 faksi (def.faction === factionId)
  function getFactionShopCatalog(factionId) {
    if (!window.ItemDB) return [];
    return Object.values(ItemDB.all())
      .filter(def => def.faction === factionId)
      .map(def => {
        const gate = RARITY_GATE[def.rarity] || { minRep: 0, price: 50 };
        return { def, price: gate.price, minRep: gate.minRep };
      });
  }

  function canBuyFactionItem(itemId) {
    const def = window.ItemDB ? ItemDB.get(itemId) : null;
    if (!def || !def.faction) return { ok: false, reason: 'Item tidak ditemukan.' };
    const factionId = getCurrentFactionId();
    if (factionId !== def.faction) return { ok: false, reason: 'Kamu bukan anggota faksi ini.' };

    const gate = RARITY_GATE[def.rarity] || { minRep: 0, price: 50 };
    const rep = getReputation(factionId);
    if (rep < gate.minRep) {
      return { ok: false, reason: `Butuh reputasi minimal ${gate.minRep} (sekarang ${rep}).` };
    }
    const coins = getCoins(factionId);
    if (coins < gate.price) {
      return { ok: false, reason: `Koin Faksi tidak cukup (butuh ${gate.price}, punya ${coins}).` };
    }
    return { ok: true, price: gate.price };
  }

  function buyFactionItem(itemId) {
    const check = canBuyFactionItem(itemId);
    if (!check.ok) {
      Events.emit('notify', { message: check.reason, type: 'error' });
      return false;
    }
    const def = ItemDB.get(itemId);
    const factionId = getCurrentFactionId();
    const entry = ensureFactionEntry(factionId);
    entry.coins -= check.price;

    Inventory.addItem(itemId, 1);
    GameState.save();
    Events.emit('notify', { message: `🎁 Menukar ${check.price} Koin Faksi dengan ${def.name}.` });
    Events.emit('player:updated');
    Events.emit('inventory:updated');
    return true;
  }

  return {
    getCurrentFactionId, getReputation, getCoins, getRankInfo,
    joinFaction, leaveFaction,
    grantScavengeProgress, grantHuntProgress,
    getFactionShopCatalog, canBuyFactionItem, buyFactionItem,
    ensureShape, RANKS, RARITY_GATE
  };
})();

window.FactionSystem = FactionSystem;
