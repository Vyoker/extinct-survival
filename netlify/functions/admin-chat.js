/**
 * Admin Chat (v0.5.7) — moderasi chat global dari dashboard admin.
 *
 * GET  /.netlify/functions/admin-chat   (header x-admin-password)
 *   -> 50 pesan terakhir TERMASUK pid pengirim + daftar pid ter-ban.
 * POST /.netlify/functions/admin-chat   (header x-admin-password)
 *   body aksi:
 *   { action: 'delete', id }  -> hapus 1 pesan
 *   { action: 'ban', pid }    -> blokir pid dari chat
 *   { action: 'unban', pid }  -> buka blokir
 *   { action: 'clear' }       -> hapus semua pesan
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json } = require('./utils/response');
const { getChatStore } = require('./utils/blob-store');
const { cleanPid } = require('./utils/presence');
const { listMessages, getBanned, setBanned } = require('./utils/chat');

exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });
  const store = getChatStore();

  if (event.httpMethod === 'GET') {
    const messages = await listMessages(store, { withPid: true });
    const banned = await getBanned(store);
    return json(200, { ok: true, serverTime: Date.now(), messages, banned });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const action = payload.action;
  if (action === 'delete') {
    const id = String(payload.id || '');
    if (!/^[0-9]+-[A-Z0-9-]+-[a-z0-9]+$/i.test(id)) return json(400, { error: 'ID pesan tidak valid.' });
    await store.delete('msg/' + id + '.json');
    return json(200, { ok: true, action });
  }
  if (action === 'ban' || action === 'unban') {
    const pid = cleanPid(payload.pid);
    if (!pid) return json(400, { error: 'PID tidak valid.' });
    let banned = await getBanned(store);
    banned = action === 'ban' ? [...banned, pid] : banned.filter(p => p !== pid);
    await setBanned(store, banned);
    return json(200, { ok: true, action, banned: [...new Set(banned)] });
  }
  if (action === 'clear') {
    const { blobs } = await store.list({ prefix: 'msg/' });
    await Promise.all(blobs.map(b => store.delete(b.key).catch(() => {})));
    return json(200, { ok: true, action });
  }

  return json(400, { error: 'Aksi tidak dikenal.' });
};
