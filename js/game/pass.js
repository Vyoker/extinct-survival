/**
 * Pass Database + Pass System (v0.1.9)
 * Elite Pass: 100 level, 2 jalur (Free & Premium). Pass EXP naik
 * otomatis mengikuti EXP karakter normal (1:1, di-hook dari
 * Player.addExp), jadi pemain tidak perlu grind terpisah — main
 * seperti biasa udah otomatis naikkan Pass level.
 *
 * Free track: siapa saja bisa klaim tiap level tercapai.
 * Premium track: harus dibuka dulu pakai Kredit (mata uang premium),
 * baru semua reward premium dari level 1 sampai level sekarang bisa
 * diklaim. Reward tiap level didefinisikan statis di js/data/pass.json
 * (hasil generate, bukan RNG, supaya predictable & bisa di-preview).
 */
const PassDB = (function () {
  'use strict';

  let levels = []; // array index 0 = level 1
  let loaded = false;

  async function load() {
    if (loaded) return levels;
    try {
      const res = await fetch('js/data/pass.json');
      levels = await res.json();
      loaded = true;
    } catch (e) {
      console.error('[PassDB] Gagal memuat pass.json:', e);
    }
    return levels;
  }

  function getLevelData(level) {
    return levels.find(l => l.level === level) || null;
  }

  function all() {
    return levels;
  }

  function maxLevel() {
    return levels.length || 100;
  }

  return { load, getLevelData, all, maxLevel };
})();

window.PassDB = PassDB;

const PassSystem = (function () {
  'use strict';

  const PREMIUM_UNLOCK_COST_KREDIT = 150;

  function getPlayer() {
    return GameState.get().player;
  }

  function ensureShape() {
    const p = getPlayer();
    if (!p.passProgress || typeof p.passProgress !== 'object') {
      p.passProgress = { level: 1, exp: 0, premiumUnlocked: false, claimedFree: [], claimedPremium: [] };
    }
    if (typeof p.passProgress.level !== 'number') p.passProgress.level = 1;
    if (typeof p.passProgress.exp !== 'number') p.passProgress.exp = 0;
    if (typeof p.passProgress.premiumUnlocked !== 'boolean') p.passProgress.premiumUnlocked = false;
    if (!Array.isArray(p.passProgress.claimedFree)) p.passProgress.claimedFree = [];
    if (!Array.isArray(p.passProgress.claimedPremium)) p.passProgress.claimedPremium = [];
  }

  // EXP dibutuhkan buat naik 1 level Pass (linear ringan, karena EXP-nya
  // numpang dari EXP karakter yang juga dipakai buat level karakter)
  function expToNextPassLevel(level) {
    return 50 + level * 15;
  }

  // Dipanggil dari Player.addExp() tiap kali EXP karakter bertambah,
  // dengan jumlah yang SAMA (1:1) — jadi main seperti biasa otomatis
  // menaikkan Pass level, tidak perlu grind terpisah.
  function addPassExp(amount) {
    ensureShape();
    const p = getPlayer();
    const maxLvl = window.PassDB ? PassDB.maxLevel() : 100;
    if (p.passProgress.level >= maxLvl) return;

    p.passProgress.exp += amount;
    while (p.passProgress.level < maxLvl) {
      const required = expToNextPassLevel(p.passProgress.level);
      if (p.passProgress.exp < required) break;
      p.passProgress.exp -= required;
      p.passProgress.level += 1;
      Events.emit('notify', { message: `🎫 Elite Pass naik ke level ${p.passProgress.level}!` });
    }
    if (p.passProgress.level >= maxLvl) p.passProgress.exp = 0;
  }

  function getProgress() {
    ensureShape();
    const p = getPlayer();
    const maxLvl = window.PassDB ? PassDB.maxLevel() : 100;
    const required = p.passProgress.level >= maxLvl ? 0 : expToNextPassLevel(p.passProgress.level);
    return {
      level: p.passProgress.level,
      exp: p.passProgress.exp,
      required,
      maxLevel: maxLvl,
      premiumUnlocked: p.passProgress.premiumUnlocked,
      progressPct: required > 0 ? Math.min(100, Math.round((p.passProgress.exp / required) * 100)) : 100
    };
  }

  function isPremiumUnlocked() {
    ensureShape();
    return getPlayer().passProgress.premiumUnlocked;
  }

  function unlockPremium() {
    ensureShape();
    const p = getPlayer();
    if (p.passProgress.premiumUnlocked) {
      Events.emit('notify', { message: 'Jalur Premium sudah aktif.', type: 'error' });
      return false;
    }
    if (p.currency.kredit < PREMIUM_UNLOCK_COST_KREDIT) {
      Events.emit('notify', { message: `Kredit tidak cukup (butuh ${PREMIUM_UNLOCK_COST_KREDIT}, punya ${p.currency.kredit}).`, type: 'error' });
      return false;
    }
    p.currency.kredit -= PREMIUM_UNLOCK_COST_KREDIT;
    p.passProgress.premiumUnlocked = true;
    GameState.save();
    Events.emit('notify', { message: '🎫 Jalur Premium Elite Pass aktif! Semua reward premium sampai level sekarang bisa diklaim.' });
    Events.emit('player:updated');
    return true;
  }

  function isClaimed(level, track) {
    ensureShape();
    const p = getPlayer();
    const list = track === 'premium' ? p.passProgress.claimedPremium : p.passProgress.claimedFree;
    return list.includes(level);
  }

  function canClaim(level, track) {
    ensureShape();
    const p = getPlayer();
    if (level > p.passProgress.level) return { ok: false, reason: 'Level belum tercapai.' };
    if (isClaimed(level, track)) return { ok: false, reason: 'Sudah diklaim.' };
    if (track === 'premium' && !p.passProgress.premiumUnlocked) {
      return { ok: false, reason: 'Buka jalur Premium dulu.' };
    }
    const levelData = window.PassDB ? PassDB.getLevelData(level) : null;
    if (!levelData || !levelData[track] || levelData[track].length === 0) {
      return { ok: false, reason: 'Tidak ada reward di level ini.' };
    }
    return { ok: true };
  }

  function grantRewards(rewards) {
    const p = getPlayer();
    rewards.forEach(r => {
      if (r.type === 'rupiah') p.currency.rupiah += r.amount;
      else if (r.type === 'kredit') p.currency.kredit += r.amount;
      else if (r.type === 'item' && window.Inventory) Inventory.addItem(r.itemId, r.qty || 1);
    });
  }

  function claim(level, track) {
    const check = canClaim(level, track);
    if (!check.ok) {
      Events.emit('notify', { message: check.reason, type: 'error' });
      return false;
    }
    const p = getPlayer();
    const levelData = PassDB.getLevelData(level);
    grantRewards(levelData[track]);

    if (track === 'premium') p.passProgress.claimedPremium.push(level);
    else p.passProgress.claimedFree.push(level);

    GameState.save();
    Events.emit('notify', { message: `🎁 Reward level ${level} (${track === 'premium' ? 'Premium' : 'Free'}) diklaim.` });
    Events.emit('player:updated');
    Events.emit('inventory:updated');
    return true;
  }

  // Klaim semua yang tersedia sekaligus (tombol "Klaim Semua"), berguna
  // kalau pemain lama tidak buka Pass dan levelnya udah jauh di depan.
  function claimAllAvailable() {
    ensureShape();
    const p = getPlayer();
    let claimedCount = 0;
    for (let lvl = 1; lvl <= p.passProgress.level; lvl++) {
      if (canClaim(lvl, 'free').ok) { claim(lvl, 'free'); claimedCount++; }
      if (p.passProgress.premiumUnlocked && canClaim(lvl, 'premium').ok) { claim(lvl, 'premium'); claimedCount++; }
    }
    if (claimedCount === 0) {
      Events.emit('notify', { message: 'Tidak ada reward yang bisa diklaim sekarang.' });
    } else {
      Events.emit('notify', { message: `🎁 ${claimedCount} reward berhasil diklaim sekaligus!` });
    }
    return claimedCount;
  }

  function countClaimable() {
    ensureShape();
    const p = getPlayer();
    let count = 0;
    for (let lvl = 1; lvl <= p.passProgress.level; lvl++) {
      if (canClaim(lvl, 'free').ok) count++;
      if (p.passProgress.premiumUnlocked && canClaim(lvl, 'premium').ok) count++;
    }
    return count;
  }

  return {
    ensureShape, addPassExp, getProgress, isPremiumUnlocked, unlockPremium,
    isClaimed, canClaim, claim, claimAllAvailable, countClaimable,
    expToNextPassLevel, PREMIUM_UNLOCK_COST_KREDIT
  };
})();

window.PassSystem = PassSystem;
