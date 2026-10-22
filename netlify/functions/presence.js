/**
 * Presence (v0.5.6) — heartbeat pemain online + daftar yang sedang online.
 *
 * POST /.netlify/functions/presence
 *   body: { pid, name, level, faction, location, appVersion }
 *   -> catat/refresh heartbeat pemain ini, balas daftar online terbaru.
 * GET  /.netlify/functions/presence
 *   -> daftar pemain yang sedang online (jendela 2 menit).
 *
 * Identitas: pid = ID acak persisten per perangkat (dibuat klien,
 * disimpan localStorage). Nama karakter BUKAN identitas unik — dua
 * pemain bisa bernama sama; pid yang membedakan record mereka.
 * Nama & lokasi dibersihkan di server sebelum disimpan/ditampilkan.
 */
const { json } = require('./utils/response');
const { getPresenceStore } = require('./utils/blob-store');
const {
  isOnline, cleanText, cleanFaction, cleanLevel, cleanPower, cleanPid,
  listPresence, publicPlayer
} = require('./utils/presence');

const MAX_BODY_BYTES = 2048;
const MAX_LIST = 100;

exports.handler = async (event) => {
  const store = getPresenceStore();
  const now = Date.now();

  if (event.httpMethod === 'GET') {
    const records = await listPresence(store, now);
    const players = records.filter(r => isOnline(r, now)).slice(0, MAX_LIST).map(r => publicPlayer(r, now));
    return json(200, { ok: true, serverTime: now, onlineCount: players.length, players });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  if ((event.body || '').length > MAX_BODY_BYTES) {
    return json(413, { error: 'Payload terlalu besar.' });
  }
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const pid = cleanPid(payload.pid);
  if (!pid) return json(400, { error: 'ID pemain tidak valid.' });

  const name = cleanText(payload.name, 24);
  if (!name) return json(400, { error: 'Nama pemain tidak valid.' });

  const key = 'presence/' + pid + '.json';
  const existing = await store.get(key, { type: 'json' }).catch(() => null);
  const record = {
    pid,
    name,
    level: cleanLevel(payload.level),
    power: cleanPower(payload.power),
    faction: cleanFaction(payload.faction),
    location: cleanText(payload.location, 48),
    appVersion: cleanText(payload.appVersion, 12) || null,
    firstSeen: existing && existing.firstSeen ? existing.firstSeen : now,
    lastSeen: now
  };
  await store.setJSON(key, record);

  const records = await listPresence(store, now);
  const players = records.filter(r => isOnline(r, now)).slice(0, MAX_LIST).map(r => publicPlayer(r, now));
  return json(200, { ok: true, serverTime: now, onlineCount: players.length, players });
};
