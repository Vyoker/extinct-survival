/**
 * check-ban.js (v0.7.7) — Cek status ban untuk 1 kode save (PUBLIK).
 *
 * GET  /.netlify/functions/check-ban?code=AB12CD34EF56GH78
 * POST /.netlify/functions/check-ban   body { code }
 *   -> { banned: true|false }
 *
 * TIDAK butuh auth (dipanggil game sebelum masuk, saat pemain belum
 * login sebagai siapa pun). Sengaja HANYA mengembalikan boolean:
 * daftar blokir dan alasan ban TIDAK PERNAH dibocorkan ke publik.
 * Kode kosong / tidak valid -> 400 dengan pesan rapi.
 *
 * Dipakai klien (js/main.js) sebagai gerbang UX saat masuk game.
 * Penegakan utama tetap di server: player-load & player-save menolak
 * kode yang di-ban dengan 403, jadi klien yang di-bypass pun tidak
 * bisa main.
 */
const { json, corsPreflight } = require('./utils/response');
const { getBanStore, normalizeCode, isValidCode, isBanned } = require('./utils/ban-store');

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;

  let raw = '';
  if (event.httpMethod === 'GET') {
    raw = (event.queryStringParameters && event.queryStringParameters.code) || '';
  } else if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return json(400, { error: 'Body tidak valid.' });
    }
    raw = payload.code || '';
  } else {
    return json(405, { error: 'Method Not Allowed' });
  }

  const code = normalizeCode(raw);
  if (!isValidCode(code)) return json(400, { error: 'Kode save tidak valid.' });

  const store = getBanStore();
  const banned = await isBanned(store, code);
  return json(200, { banned: banned });
};
