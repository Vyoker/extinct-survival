/**
 * Chat Global (v0.5.7)
 *
 * GET  /.netlify/functions/chat
 *   -> 50 pesan terakhir (urut lama -> baru).
 * POST /.netlify/functions/chat
 *   body: { pid, name, level, text }
 *   header opsional x-chat-admin: <ADMIN_PASSWORD> -> role admin.
 *   -> terapkan cooldown SERVER 15 detik per pid (429 + retryAfterSec
 *      bila kepagian), tolak tautan, samarkan kata kasar, simpan
 *      pesan, balas daftar terbaru.
 */
const { json } = require('./utils/response');
const { getChatStore } = require('./utils/blob-store');
const { cleanText, cleanLevel, cleanPid } = require('./utils/presence');
const {
  COOLDOWN_MS, MAX_TEXT_LEN, maskBadwords, hasLink,
  listMessages, pruneMessages, getBanned
} = require('./utils/chat');

const MAX_BODY_BYTES = 4096;

function isChatAdmin(event) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const provided = event.headers && (event.headers['x-chat-admin'] || event.headers['X-Chat-Admin']);
  return !!provided && provided === expected;
}

exports.handler = async (event) => {
  const store = getChatStore();
  const now = Date.now();

  if (event.httpMethod === 'GET') {
    const messages = await listMessages(store);
    return json(200, { ok: true, serverTime: now, messages });
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

  const banned = await getBanned(store);
  if (banned.includes(pid)) {
    return json(403, { error: 'Kamu diblokir dari chat oleh admin.' });
  }

  const name = cleanText(payload.name, 24);
  if (!name) return json(400, { error: 'Nama pemain tidak valid.' });

  let text = String(payload.text == null ? '' : payload.text).replace(/\s+/g, ' ').trim();
  if (!text) return json(400, { error: 'Pesan kosong.' });
  if (text.length > MAX_TEXT_LEN) {
    return json(400, { error: 'Pesan terlalu panjang (maks ' + MAX_TEXT_LEN + ' karakter).' });
  }
  if (hasLink(text)) {
    return json(400, { error: 'Tautan tidak diizinkan di chat.' });
  }
  text = maskBadwords(text);

  // Cooldown server: 1 pesan per pid per 15 detik.
  const lastKey = 'last/' + pid + '.json';
  const last = await store.get(lastKey, { type: 'json' }).catch(() => null);
  if (last && typeof last.ts === 'number') {
    const elapsed = now - last.ts;
    if (elapsed < COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return json(429, { error: 'Terlalu cepat. Tunggu ' + retryAfterSec + ' detik lagi.', retryAfterSec });
    }
  }

  const role = isChatAdmin(event) ? 'admin' : 'player';
  const rand = Math.random().toString(36).slice(2, 8);
  const id = now + '-' + pid + '-' + rand;
  const record = {
    id,
    pid,
    name,
    level: cleanLevel(payload.level),
    role,
    text,
    ts: now
  };
  await store.setJSON('msg/' + id + '.json', record);
  await store.setJSON(lastKey, { ts: now });
  await pruneMessages(store);

  const messages = await listMessages(store);
  return json(200, { ok: true, serverTime: now, role, cooldownSec: COOLDOWN_MS / 1000, messages });
};
