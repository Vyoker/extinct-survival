/**
 * Presence source (v0.7.0) — satu pintu baca daftar presence untuk
 * barter, friends, dan admin-presence.
 *
 * Urutan: RTDB (bila Admin SDK + env tersedia) dulu, lalu fallback
 * ke Blobs lama. Bentuk record disamakan dengan format lama
 * (pid, name, level, power, faction, location, appVersion,
 * firstSeen, lastSeen) supaya pemanggil tidak perlu diubah.
 */
const { listPresence } = require('./presence');
const { listPresenceRTDB } = require('./rtdb');

async function getPresenceRecords(store, now) {
  try {
    const rtdb = await listPresenceRTDB();
    if (Array.isArray(rtdb)) return rtdb;
  } catch (e) { /* fallback Blobs */ }
  return listPresence(store, now);
}

module.exports = { getPresenceRecords };
