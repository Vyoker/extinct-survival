/**
 * Friends (v0.5.8) — logika bersama function friends.
 *
 * Model data (store 'friends'):
 * - list/<PID>.json   : { friends: [{ pid, name }] }
 * - reqin/<PID>.json  : { items: [{ fromPid, fromName, ts }] }
 * - reqout/<PID>.json : { items: [{ toPid, toName, ts }] }
 *
 * Keamanan identitas: PID adalah token rahasia per perangkat (sama
 * seperti kode save cloud) dan TIDAK PERNAH dikirim ke klien lain.
 * Untuk merujuk pemain lain, server memakai "ref" = potongan hash
 * SHA-256 dari PID — tidak bisa dibalik menjadi PID, jadi tidak
 * bisa dipakai menyamar di presence/chat. Profil tampilan (nama,
 * level, faksi, lokasi, power, status online) diambil dari record
 * presence terbaru.
 */
const crypto = require('crypto');

const MAX_FRIENDS = 100;
const MAX_OUTGOING = 20;
const MAX_INCOMING = 50;

function refOf(pid) {
  return crypto.createHash('sha256').update(String(pid)).digest('hex').slice(0, 12);
}

async function loadArray(store, key, field) {
  const rec = await store.get(key, { type: 'json' }).catch(() => null);
  return rec && Array.isArray(rec[field]) ? rec[field] : [];
}

async function loadFriends(store, pid) {
  return loadArray(store, 'list/' + pid + '.json', 'friends');
}
async function saveFriends(store, pid, friends) {
  await store.setJSON('list/' + pid + '.json', { friends });
}
async function loadReqIn(store, pid) {
  return loadArray(store, 'reqin/' + pid + '.json', 'items');
}
async function saveReqIn(store, pid, items) {
  await store.setJSON('reqin/' + pid + '.json', { items });
}
async function loadReqOut(store, pid) {
  return loadArray(store, 'reqout/' + pid + '.json', 'items');
}
async function saveReqOut(store, pid, items) {
  await store.setJSON('reqout/' + pid + '.json', { items });
}

// Profil publik seorang pemain dari record presence-nya.
function profileOf(rec, now, isOnlineFn) {
  if (!rec) return null;
  return {
    ref: refOf(rec.pid),
    name: rec.name,
    level: rec.level,
    power: rec.power != null ? rec.power : null,
    faction: rec.faction || null,
    location: rec.location || '',
    lastSeen: rec.lastSeen,
    online: isOnlineFn(rec, now)
  };
}

module.exports = {
  MAX_FRIENDS,
  MAX_OUTGOING,
  MAX_INCOMING,
  refOf,
  loadFriends,
  saveFriends,
  loadReqIn,
  saveReqIn,
  loadReqOut,
  saveReqOut,
  profileOf
};
