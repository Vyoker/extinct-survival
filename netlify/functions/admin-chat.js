/**
 * Admin Chat (v0.5.7, diperbarui v0.7.0) — moderasi chat global dari
 * dashboard admin.
 *
 * GET  /.netlify/functions/admin-chat   (header x-admin-password)
 *   -> 50 pesan terakhir TERMASUK pid pengirim + daftar pid ter-ban.
 * POST /.netlify/functions/admin-chat   (header x-admin-password)
 *   body aksi:
 *   { action: 'delete', id }  -> hapus 1 pesan
 *   { action: 'ban', pid }    -> blokir pid dari chat
 *   { action: 'unban', pid }  -> buka blokir
 *   { action: 'clear' }       -> hapus semua pesan
 *   { action: 'send', text, name?, level?, pid? } -> kirim pesan
 *     sebagai ADMIN (badge). DRAF 2026-11-20: ini jalan yang
 *     selama ini hilang — chat game mode Firebase selalu kirim
 *     role 'player', jadi admin tidak bisa membalas di chat.
 *     Role dipaksa 'admin' di server; nama default 'Vyoker',
 *     level default 99 bila tidak dikirim (penanda GM di dashboard;
 *     di game level tidak tampil). Validasi sama seperti chat
 *     biasa: maks 200 karakter, tolak tautan, samarkan kata kasar,
 *     cooldown server 15 detik per pid admin.
 *
 * v0.7.0: bila RTDB tersedia (Admin SDK + env Netlify), semua aksi
 * di atas beroperasi di RTDB. Bila tidak, fallback ke Blobs lama
 * persis seperti sebelumnya (tidak crash).
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json, corsPreflight } = require('./utils/response');
const { getChatStore } = require('./utils/blob-store');
const { cleanPid } = require('./utils/presence');
const { listMessages, getBanned, setBanned, pruneMessages, maskBadwords, hasLink, MAX_TEXT_LEN, COOLDOWN_MS } = require('./utils/chat');
const { cleanText, cleanLevel } = require('./utils/presence'); // cleanPid sudah diimpor di atas
const {
  isAvailable, listMessagesRTDB, deleteMessageRTDB, setBanRTDB, clearMessagesRTDB,
  sendMessageRTDB, getLastChatRTDB
} = require('./utils/rtdb');

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });
  const store = getChatStore();
  const useRtdb = isAvailable();

  if (event.httpMethod === 'GET') {
    if (useRtdb) {
      const data = await listMessagesRTDB(true);
      if (data) return json(200, { ok: true, serverTime: Date.now(), messages: data.messages, banned: data.banned });
    }
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
  if (action === 'send') {
    // DRAF 2026-11-20: kirim sebagai ADMIN, role dipaksa server.
    let text = String(payload.text == null ? '' : payload.text).replace(/\s+/g, ' ').trim();
    if (!text) return json(400, { error: 'Pesan kosong.' });
    if (text.length > MAX_TEXT_LEN) return json(400, { error: 'Pesan terlalu panjang (maks ' + MAX_TEXT_LEN + ' karakter).' });
    if (hasLink(text)) return json(400, { error: 'Tautan tidak diizinkan di chat.' });
    text = maskBadwords(text);
    const name = cleanText(payload.name, 24) || 'Vyoker';
    const level = payload.level != null ? cleanLevel(payload.level) : 99;
    const pid = payload.pid ? cleanPid(payload.pid) : 'ADMIN-0000';
    if (!pid) return json(400, { error: 'ID pemain tidak valid.' });
    const now = Date.now();
    // Cooldown server 15 detik per pid admin (sama seperti chat biasa).
    let lastTs = null;
    if (useRtdb) lastTs = await getLastChatRTDB(pid);
    else {
      const last = await store.get('last/' + pid + '.json', { type: 'json' }).catch(function () { return null; });
      if (last && typeof last.ts === 'number') lastTs = last.ts;
    }
    if (typeof lastTs === 'number' && now - lastTs < COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((COOLDOWN_MS - (now - lastTs)) / 1000);
      return json(429, { error: 'Terlalu cepat. Tunggu ' + retryAfterSec + ' detik lagi.', retryAfterSec });
    }
    const rand = Math.random().toString(36).slice(2, 8);
    const record = { id: now + '-' + pid + '-' + rand, pid, name, level, role: 'admin', text, ts: now };
    if (useRtdb) {
      const saved = await sendMessageRTDB(record);
      if (!saved) return json(500, { error: 'Gagal menyimpan ke RTDB.' });
    } else {
      await store.setJSON('msg/' + record.id + '.json', record);
      await store.setJSON('last/' + pid + '.json', { ts: now });
      await pruneMessages(store);
    }
    return json(200, { ok: true, action: 'send', role: 'admin', cooldownSec: COOLDOWN_MS / 1000, message: record });
  }
  if (action === 'delete') {
    const id = String(payload.id || '');
    if (!/^[0-9]+-[A-Z0-9-]+-[a-z0-9]+$/i.test(id)) return json(400, { error: 'ID pesan tidak valid.' });
    if (useRtdb) await deleteMessageRTDB(id);
    else await store.delete('msg/' + id + '.json');
    return json(200, { ok: true, action });
  }
  if (action === 'ban' || action === 'unban') {
    const pid = cleanPid(payload.pid);
    if (!pid) return json(400, { error: 'PID tidak valid.' });
    if (useRtdb) {
      await setBanRTDB(pid, action === 'ban');
      const data = await listMessagesRTDB(true);
      return json(200, { ok: true, action, banned: data ? data.banned : [] });
    }
    let banned = await getBanned(store);
    banned = action === 'ban' ? [...banned, pid] : banned.filter(p => p !== pid);
    await setBanned(store, banned);
    return json(200, { ok: true, action, banned: [...new Set(banned)] });
  }
  if (action === 'clear') {
    if (useRtdb) await clearMessagesRTDB();
    else {
      const { blobs } = await store.list({ prefix: 'msg/' });
      await Promise.all(blobs.map(b => store.delete(b.key).catch(() => {})));
    }
    return json(200, { ok: true, action });
  }

  return json(400, { error: 'Aksi tidak dikenal.' });
};
