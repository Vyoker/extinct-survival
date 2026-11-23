/**
 * admin-ban.js (v0.7.7) — Full ban pemain berdasarkan kode save.
 *
 * GET  /.netlify/functions/admin-ban   (header x-admin-password)
 *   -> { ok, count, bans: [{ code, reason, bannedAt }] } (terbaru dulu)
 * GET  /.netlify/functions/admin-ban?code=AB12CD34EF56GH78
 *   -> { ok, banned, ban: { code, reason, bannedAt } | null }
 * POST /.netlify/functions/admin-ban   (header x-admin-password)
 *   body { action: 'ban', code, reason? }
 *   -> { ok, action: 'ban', banned: true, already: false }
 *      Ban idempotent: ban kedua pada kode yang sama tetap sukses
 *      (already: true) tanpa menimpa catatan ban pertama.
 *   body { action: 'unban', code }
 *   -> { ok, action: 'unban', banned: false, existed: true|false }
 *      Unban kode yang memang tidak di-ban tetap sukses.
 *
 * SEMUA akses butuh ADMIN_PASSWORD (env Netlify) via header
 * x-admin-password — sama seperti admin-players.js. Daftar blokir
 * disimpan di Blobs store 'bans', key "<KODE>.json".
 *
 * Catatan: ban ini berdasarkan kode save. Pemain yang di-ban masih
 * bisa membuat akun baru (kode save baru) — itu keterbatasan yang
 * disetujui user 22 Nov 2026. Ban menutup web + Play Store sekaligus
 * karena server keduanya masih nyatu.
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json, corsPreflight } = require('./utils/response');
const { getBanStore, normalizeCode, isValidCode } = require('./utils/ban-store');

const MAX_LIST = 300;
const MAX_REASON_LEN = 200;

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });

  const store = getBanStore();
  const qs = event.queryStringParameters || {};

  // --- Status 1 kode: GET ?code=... ---
  if (event.httpMethod === 'GET' && qs.code) {
    const code = normalizeCode(qs.code);
    if (!isValidCode(code)) return json(400, { error: 'Kode save tidak valid.' });
    const ban = await store.get(code + '.json', { type: 'json' });
    return json(200, { ok: true, banned: !!ban, ban: ban || null });
  }

  // --- Daftar semua ban: GET (tanpa code) ---
  if (event.httpMethod === 'GET') {
    const { blobs } = await store.list({ prefix: '' });
    const bans = [];
    for (const b of (blobs || []).slice(0, MAX_LIST)) {
      const entry = await store.get(b.key, { type: 'json' });
      if (entry && entry.code) bans.push(entry);
    }
    bans.sort((a, b) => (b.bannedAt || 0) - (a.bannedAt || 0));
    return json(200, { ok: true, count: bans.length, bans: bans });
  }

  // --- Ban / unban: POST ---
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }
  const code = normalizeCode(payload.code);
  if (!isValidCode(code)) return json(400, { error: 'Kode save tidak valid.' });

  if (payload.action === 'ban') {
    const existing = await store.get(code + '.json', { type: 'json' });
    if (existing) return json(200, { ok: true, action: 'ban', banned: true, already: true, ban: existing });
    const reason = String(payload.reason || '').slice(0, MAX_REASON_LEN);
    const ban = { code: code, reason: reason, bannedAt: Date.now() };
    await store.setJSON(code + '.json', ban);
    return json(200, { ok: true, action: 'ban', banned: true, already: false, ban: ban });
  }

  if (payload.action === 'unban') {
    const existing = await store.get(code + '.json', { type: 'json' });
    if (existing) await store.delete(code + '.json');
    return json(200, { ok: true, action: 'unban', banned: false, existed: !!existing });
  }

  return json(400, { error: 'Aksi tidak dikenal.' });
};
