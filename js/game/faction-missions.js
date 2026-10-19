/**
 * Faction Daily Missions (v0.5.0)
 * 3 misi harian acak per faksi aktif, reset tiap hari (tanggal lokal).
 * Reward: reputasi + Koin Faksi (+ exp & rupiah). Syarat: pemain harus
 * jadi anggota faksi aktif DAN sudah menyelesaikan misi kontrak faksi
 * tersebut (aturan v0.4.9).
 *
 * State tersimpan di p.factionDaily:
 *   { date, factionId, missionIds:[3], huntCounts:{}, claimed:[] }
 */
const FactionMissions = (function () {
  'use strict';

  let templates = {};
  let loaded = false;

  async function load() {
    if (loaded) return templates;
    try {
      const res = await fetch('js/data/faction-missions.json');
      const list = await res.json();
      templates = {};
      list.forEach(t => { templates[t.id] = t; });
      loaded = true;
    } catch (e) {
      console.error('[FactionMissions] Gagal memuat faction-missions.json:', e);
    }
    return templates;
  }

  function getPlayer() {
    return GameState.get().player;
  }

  // Tanggal lokal YYYY-MM-DD (bukan UTC, supaya reset ikut WIB pemain)
  function todayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function getCurrentFactionId() {
    return window.FactionSystem ? FactionSystem.getCurrentFactionId() : null;
  }

  function ensureShape() {
    const p = getPlayer();
    if (!p.factionDaily || typeof p.factionDaily !== 'object') p.factionDaily = {};
    const fd = p.factionDaily;
    if (fd.date !== todayKey()) {
      fd.date = todayKey();
      fd.factionId = null;
      fd.missionIds = [];
      fd.huntCounts = {};
      fd.claimed = [];
    }
    if (!Array.isArray(fd.missionIds)) fd.missionIds = [];
    if (!fd.huntCounts || typeof fd.huntCounts !== 'object') fd.huntCounts = {};
    if (!Array.isArray(fd.claimed)) fd.claimed = [];
  }

  // Pilih n template berbeda, deterministik per hari+faksi (FNV-1a hash)
  function seededPick(pool, n, seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const rest = pool.slice();
    const out = [];
    while (out.length < n && rest.length > 0) {
      h ^= h >>> 13; h = Math.imul(h, 16777619);
      h ^= h >>> 7;
      const idx = Math.abs(h) % rest.length;
      out.push(rest.splice(idx, 1)[0]);
    }
    return out;
  }

  function eligibleTemplates() {
    const fid = getCurrentFactionId();
    return Object.values(templates).filter(t => !t.factionId || t.factionId === fid);
  }

  function rollToday() {
    ensureShape();
    const p = getPlayer();
    const fid = getCurrentFactionId();
    const picked = seededPick(eligibleTemplates(), 3, `${todayKey()}:${fid || 'none'}`);
    p.factionDaily.factionId = fid;
    p.factionDaily.missionIds = picked.map(t => t.id);
    p.factionDaily.huntCounts = {};
    p.factionDaily.claimed = [];
    GameState.save();
  }

  function getItemQty(itemId) {
    if (!window.Inventory) return 0;
    const entry = Inventory.getInventory().find(e => e.itemId === itemId);
    return entry ? (entry.qty || 0) : 0;
  }

  function getProgress(tplId) {
    const t = templates[tplId];
    if (!t) return [];
    const p = getPlayer();
    return t.objectives.map(o => {
      if (t.type === 'collect') {
        const have = getItemQty(o.itemId);
        return { name: o.name || o.itemId, target: o.target, have: Math.min(have, o.target), done: have >= o.target };
      }
      const have = (p.factionDaily.huntCounts || {})[tplId + ':' + o.enemyId] || 0;
      return { name: o.name, target: o.target, have: Math.min(have, o.target), done: have >= o.target };
    });
  }

  function isComplete(tplId) {
    const prog = getProgress(tplId);
    return prog.length > 0 && prog.every(o => o.done);
  }

  function isClaimed(tplId) {
    ensureShape();
    return getPlayer().factionDaily.claimed.includes(tplId);
  }

  // Daftar 3 misi hari ini + status, untuk faksi aktif. [] kalau belum
  // join faksi / kontrak belum selesai.
  function getTodayMissions() {
    ensureShape();
    const fid = getCurrentFactionId();
    if (!fid) return [];
    if (window.FactionSystem && !FactionSystem.isContractCompleted(fid)) return [];
    const p = getPlayer();
    if (p.factionDaily.factionId !== fid || p.factionDaily.missionIds.length === 0) {
      rollToday();
    }
    return p.factionDaily.missionIds
      .map(id => templates[id])
      .filter(Boolean)
      .map(t => ({
        tpl: t,
        progress: getProgress(t.id),
        complete: isComplete(t.id),
        claimed: p.factionDaily.claimed.includes(t.id)
      }));
  }

  // Dipanggil battle-bridge.js tiap musuh dikalahkan (seperti QuestSystem)
  function registerKill(enemyId) {
    ensureShape();
    const p = getPlayer();
    let changed = false;
    (p.factionDaily.missionIds || []).forEach(tplId => {
      const t = templates[tplId];
      if (!t || t.type !== 'hunt') return;
      if (p.factionDaily.claimed.includes(tplId)) return;
      const obj = t.objectives.find(o => o.enemyId === enemyId);
      if (!obj) return;
      const key = tplId + ':' + enemyId;
      const cur = p.factionDaily.huntCounts[key] || 0;
      if (cur < obj.target) {
        p.factionDaily.huntCounts[key] = cur + 1;
        changed = true;
      }
    });
    if (changed) GameState.save();
  }

  function claimMission(tplId) {
    const t = templates[tplId];
    if (!t) return false;
    ensureShape();
    const p = getPlayer();
    if (!p.factionDaily.missionIds.includes(tplId)) {
      Events.emit('notify', { message: 'Misi tidak ditemukan.', type: 'error' });
      return false;
    }
    if (p.factionDaily.claimed.includes(tplId)) {
      Events.emit('notify', { message: 'Misi ini sudah diklaim hari ini.', type: 'error' });
      return false;
    }
    if (!isComplete(tplId)) {
      Events.emit('notify', { message: 'Objective misi belum semua selesai.', type: 'error' });
      return false;
    }
    const fid = getCurrentFactionId();
    if (!fid) {
      Events.emit('notify', { message: 'Kamu belum bergabung dengan faksi.', type: 'error' });
      return false;
    }
    if (window.FactionSystem && !FactionSystem.isContractCompleted(fid)) {
      Events.emit('notify', { message: 'Selesaikan misi kontrak faksi dulu.', type: 'error' });
      return false;
    }

    // Konsumsi material untuk misi collect
    if (t.type === 'collect') {
      t.objectives.forEach(o => Inventory.removeItem(o.itemId, o.target));
    }

    const r = t.rewards || {};
    const entry = p.factionData[fid] || (p.factionData[fid] = { reputation: 0, coins: 0 });
    if (r.rep) entry.reputation += r.rep;
    if (r.coins) entry.coins += r.coins;
    if (r.exp && window.Player) Player.addExp(r.exp);
    if (r.rupiah) {
      if (!p.currency) p.currency = { rupiah: 0, kredit: 0 };
      p.currency.rupiah += r.rupiah;
    }

    p.factionDaily.claimed.push(tplId);
    GameState.save();
    Events.emit('notify', { message: `Misi harian "${t.title}" selesai! +${r.rep || 0} reputasi, +${r.coins || 0} Koin Faksi.` });
    Events.emit('player:updated');
    Events.emit('inventory:updated');
    return true;
  }

  return {
    load, getTodayMissions, registerKill, claimMission,
    isComplete, isClaimed, todayKey
  };
})();

window.FactionMissions = FactionMissions;
