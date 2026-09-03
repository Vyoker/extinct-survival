/**
 * Cooldown Module
 * Anti-spam timer sederhana (in-memory, per sesi). Dipakai untuk
 * membatasi aksi yang gampang di-spam: Scavenge & item Energy/Healing
 * (5 detik), Travel (15 detik).
 */
const Cooldown = (function () {
  'use strict';

  const endTimestamps = {}; // key -> timestamp selesai cooldown

  function start(key, durationMs) {
    endTimestamps[key] = Date.now() + durationMs;
  }

  function isActive(key) {
    const end = endTimestamps[key];
    if (!end) return false;
    return Date.now() < end;
  }

  function remainingMs(key) {
    const end = endTimestamps[key];
    if (!end) return 0;
    return Math.max(0, end - Date.now());
  }

  function remainingSec(key) {
    return Math.ceil(remainingMs(key) / 1000);
  }

  function clear(key) {
    delete endTimestamps[key];
  }

  function hasAnyActive() {
    return Object.keys(endTimestamps).some(k => isActive(k));
  }

  return { start, isActive, remainingMs, remainingSec, clear, hasAnyActive };
})();

window.Cooldown = Cooldown;
