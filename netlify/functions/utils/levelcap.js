/**
 * levelcap.js (v0.8.0) — logika cap level 35 + anti-cheat, dipakai
 * server (player-save.js, admin-players.js). Cerminan dari
 * js/game/player.js enforceLevelCap() di client — aturan yang sama,
 * supaya hasil clamp server dan client tidak pernah berbeda.
 *
 * Aturan cap (keputusan Alfi 25 Nov 2026):
 * - Level maksimal 35 (dulu 100). Pemain di atas 35 otomatis turun
 *   ke 35 begitu mereka Simpan Online (player-save memotong di sini
 *   SEBELUM menyimpan, jadi client lama / client yang dimodifikasi
 *   tidak bisa lolos lewat cloud save).
 * - Total poin atribut di-lock 170 (= 5 poin x 34 level). Kalau yang
 *   sudah dialokasikan ke stats (atk/def/dex/int) melebihi 170,
 *   stats dipangkas proporsional (bentuk build dipertahankan) sampai
 *   totalnya 170; sisa poin = 170 - yang dialokasikan.
 * - maxEnergy dihitung ulang ke 168 (100 + 2*34); energy dipotong
 *   ke maxEnergy baru.
 * - exp direset 0, expToNext 7000 (100*35*2).
 */
'use strict';

var LEVEL_CAP = 35;
var POINTS_PER_LEVEL = 5;

function maxTotalPoints(level) {
  return POINTS_PER_LEVEL * (Math.max(1, Math.min(level, LEVEL_CAP)) - 1);
}
function maxEnergyAt(level) {
  return 100 + 2 * (Math.max(1, Math.min(level, LEVEL_CAP)) - 1);
}

// Potong player object di tempat (mutasi). Mengembalikan info clamp
// atau null bila tidak ada yang berubah.
function clampLevel(pl) {
  if (!pl || typeof pl.level !== 'number' || !isFinite(pl.level)) return null;
  var level = Math.floor(pl.level);
  var budget = maxTotalPoints(Math.min(level, LEVEL_CAP));
  var stats = pl.stats || {};
  var keys = ['atk', 'def', 'dex', 'int'];
  var spent = 0;
  keys.forEach(function (k) { spent += Math.max(0, Math.floor(Number(stats[k]) || 0)); });
  var unspent = Math.max(0, Math.floor(Number(pl.attributePoints) || 0));
  var capEnergy = maxEnergyAt(Math.min(level, LEVEL_CAP));
  var overLevel = level > LEVEL_CAP;
  var overPoints = (spent + unspent) > budget;
  var overEnergy = (typeof pl.maxEnergy === 'number') && pl.maxEnergy > capEnergy;
  if (!overLevel && !overPoints && !overEnergy) return null;
  var fromLevel = level;
  var fromSpent = spent;
  if (overLevel) {
    pl.level = LEVEL_CAP;
    pl.exp = 0;
    pl.expToNext = 100 * LEVEL_CAP * 2;
  }
  if (spent > budget) {
    var factor = budget / spent;
    var ns = {};
    var sum = 0;
    keys.forEach(function (k) {
      var v = Math.floor(Math.max(0, Math.floor(Number(stats[k]) || 0)) * factor);
      ns[k] = v;
      sum += v;
    });
    var order = keys.slice().sort(function (a, b) { return ns[b] - ns[a]; });
    var i = 0;
    while (sum < budget) { ns[order[i % 4]] += 1; sum += 1; i++; }
    keys.forEach(function (k) { stats[k] = ns[k]; });
    spent = sum;
  }
  pl.attributePoints = Math.max(0, budget - spent);
  if (typeof pl.maxEnergy === 'number') pl.maxEnergy = Math.min(pl.maxEnergy, capEnergy);
  else pl.maxEnergy = capEnergy;
  if (typeof pl.energy === 'number') pl.energy = Math.min(pl.energy, pl.maxEnergy);
  return { fromLevel: fromLevel, fromSpent: fromSpent, toLevel: pl.level, spent: spent };
}

// Bersihkan hasil verifikasi anti-cheat dari save (meta.anticheat)
// sebelum disimpan ke indeks pemain — hanya field yang dikenal,
// dibatasi panjangnya, supaya save editan tidak menyuntik data aneh
// ke indeks. Mengembalikan null bila tidak ada hasil verifikasi.
function cleanAnticheat(ac) {
  if (!ac || typeof ac !== 'object') return null;
  var flags = Array.isArray(ac.flags) ? ac.flags : [];
  var cleanFlags = [];
  flags.slice(0, 5).forEach(function (f) {
    var s = String(f || '').slice(0, 32);
    if (s && cleanFlags.indexOf(s) === -1) cleanFlags.push(s);
  });
  var origin = (ac.origin === 'playstore' || ac.origin === 'web') ? ac.origin : null;
  var checkedAt = Number(ac.checkedAt) || null;
  var skewMs = (typeof ac.skewMs === 'number' && isFinite(ac.skewMs)) ? Math.round(ac.skewMs) : null;
  if (!cleanFlags.length && !origin && !checkedAt) return null;
  return { flags: cleanFlags, origin: origin, checkedAt: checkedAt, skewMs: skewMs };
}

module.exports = {
  LEVEL_CAP: LEVEL_CAP,
  POINTS_PER_LEVEL: POINTS_PER_LEVEL,
  maxTotalPoints: maxTotalPoints,
  maxEnergyAt: maxEnergyAt,
  clampLevel: clampLevel,
  cleanAnticheat: cleanAnticheat
};
