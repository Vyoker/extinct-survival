/**
 * admin-players.js (v0.7.7 Fase 1) — Database pemain untuk panel admin.
 *
 * GET  /.netlify/functions/admin-players   (header x-admin-password)
 *   -> { ok, count, players: [{ code, name, level, kredit, rupiah,
 *        faction, location, createdAt, createdIn, anticheat, updatedAt, appVersion }] }
 *      v0.8.0 (25 Nov 2026): anticheat { flags, origin, checkedAt,
 *      skewMs } dari save.meta.anticheat — hasil verifikasi Anti-Cheat
 *      v1 terakhir pemain (null bila belum pakai build baru).
 *      v0.7.11 (koreksi 23 Nov 2026): createdAt (ms) + createdIn
 *      ('playstore' | 'web' | 'unknown') TIDAK datang dari field
 *      baru di save — datanya SUDAH ADA di Blobs, di file save
 *      pemain (`player/<KODE>.json`, `save.meta.createdAt` /
 *      `save.world.time`, bahasa komputer = timestamp ms). Endpoint
 *      ini yang mengonversinya jadi tanggal untuk panel admin:
 *      daftar (list) men-scrap file save itu kalau indeks belum
 *      punya createdAt, lalu menyimpannya kembali ke indeks supaya
 *      daftar berikutnya cepat. Akun lama TIDAK perlu save ulang
 *      dari build baru — cukup deploy server ini.
 *      Daftar dibaca dari indeks pemain (ditulis player-save.js tiap
 *      Simpan Online) — cepat, tanpa membuka file save (maks 512 KB).
 * GET  /.netlify/functions/admin-players?code=AB12CD34EF56GH78
 *   -> { ok, player, fromIndex } — detail 1 pemain. Kalau belum ada di
 *      indeks (pemain lama), fallback baca file save-nya langsung.
 * POST /.netlify/functions/admin-players   (header x-admin-password)
 *   body { action: 'backfill' }
 *   -> { ok, scanned, added } — bangun indeks dari save lama, sekali
 *      jalan (untuk pemain yang terakhir simpan sebelum indeks ada).
 *
 * SEMUA akses butuh ADMIN_PASSWORD (env Netlify) via header
 * x-admin-password. Kode save adalah kunci akun pemain — daftar ini
 * tidak boleh diakses tanpa password admin.
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json, corsPreflight } = require('./utils/response');
const { getSaveStore } = require('./utils/save-store');
// v0.8.0: teruskan hasil verifikasi anti-cheat ke panel admin.
const { cleanAnticheat } = require('./utils/levelcap');

const CODE_RE = /^[A-Z2-9-]{8,64}$/;
const MAX_LIST = 300;

// Ringkasan 1 pemain dari isi save cloud (dipakai detail + backfill).
// v0.7.11: + createdAt / createdIn (tanggal + asal pembuatan akun).
// Sumbernya file save di Blobs yang SUDAH ADA — meta.createdAt /
// world.time (timestamp ms, itu waktu akun dibuat). BUKAN field baru:
// save lama pun sudah punya meta.createdAt (contoh ALFIAN
// 1795253267083 = 21 Nov 2026 16:27 WIB). player.createdAt hanya
// dipakai kalau ada (tidak wajib).
function summarize(code, data, updatedAt, appVersion) {
  var pl = (data && data.save && data.save.player) || {};
  var cur = pl.currency || {};
  var meta = (data && data.save && data.save.meta) || {};
  var world = (data && data.save && data.save.world) || {};
  var createdAt = Number(pl.createdAt) || Number(meta.createdAt) || Number(world.time) || null;
  var createdIn = pl.createdIn;
  if (createdIn !== 'playstore' && createdIn !== 'web') {
    createdIn = (pl.subSkills && pl.subSkills['beta-tester']) ? 'playstore' : 'unknown';
  }
  return {
    code: code,
    name: String(pl.name || 'Survivor').slice(0, 32),
    level: Number(pl.level) || 1,
    kredit: Number(cur.kredit) || 0,
    rupiah: Number(cur.rupiah) || 0,
    faction: pl.faction || null,
    location: pl.location || null,
    createdAt: createdAt,
    createdIn: createdIn,
    // v0.8.0 Anti-Cheat v1: hasil verifikasi terakhir dari
    // save.meta.anticheat (null bila pemain belum pakai build baru).
    anticheat: cleanAnticheat(meta.anticheat),
    updatedAt: updatedAt || (data && data.exportedAt) || null,
    appVersion: appVersion || (data && data.appVersion) || null
  };
}

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });

  const store = getSaveStore();
  const qs = event.queryStringParameters || {};

  // --- Detail 1 pemain: GET ?code=... ---
  if (event.httpMethod === 'GET' && qs.code) {
    const code = String(qs.code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!CODE_RE.test(code)) return json(400, { error: 'Kode save tidak valid.' });
    const idx = await store.get('player-index/' + code + '.json', { type: 'json' });
    if (idx) {
      // v0.7.10: indeks lama belum punya createdAt — lengkapi dari
      // file save-nya (best-effort, tanpa menimpa indeks di sini).
      // Hanya kalau save-nya memang punya createdAt; kalau save-nya
      // juga tidak punya, kembalikan indeks apa adanya (fromIndex
      // tetap true) supaya backfill/detail tidak berputar tanpa hasil.
      if (!idx.createdAt) {
        const recIdx = await store.get('player/' + code + '.json', { type: 'json' });
        if (recIdx && recIdx.data) {
          const enriched = summarize(code, recIdx.data, recIdx.updatedAt, recIdx.appVersion);
          if (enriched.createdAt) {
            return json(200, { ok: true, player: enriched, fromIndex: false });
          }
        }
      }
      return json(200, { ok: true, player: idx, fromIndex: true });
    }
    const rec = await store.get('player/' + code + '.json', { type: 'json' });
    if (!rec || !rec.data) return json(404, { error: 'Pemain tidak ditemukan.' });
    return json(200, {
      ok: true,
      player: summarize(code, rec.data, rec.updatedAt, rec.appVersion),
      fromIndex: false
    });
  }

  // --- Backfill indeks dari save lama: POST { action: 'backfill' } ---
  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return json(400, { error: 'Body tidak valid.' });
    }
    if (payload.action !== 'backfill') return json(400, { error: 'Aksi tidak dikenal.' });
    const { blobs } = await store.list({ prefix: 'player/' });
    let scanned = 0;
    let added = 0;
    for (const b of (blobs || []).slice(0, MAX_LIST)) {
      const m = /^player\/([A-Z2-9-]+)\.json$/.exec(b.key || '');
      if (!m) continue;
      scanned++;
      const existing = await store.get('player-index/' + m[1] + '.json', { type: 'json' });
      // v0.7.10: indeks lama yang belum punya createdAt DIBANGUN ULANG
      // (bukan dilewati) supaya tanggal/asal akun lama ikut terisi.
      // Indeks yang sudah punya createdAt tetap dilewati — nilainya
      // first-seen, jangan ditimpa. Kalau save-nya juga tidak punya
      // createdAt, lewati juga (membangun ulang tidak menambah apa-apa
      // dan backfill kedua harus tetap 0).
      if (existing && existing.createdAt) continue;
      const rec = await store.get(b.key, { type: 'json' });
      if (!rec || !rec.data) continue;
      const summary = summarize(m[1], rec.data, rec.updatedAt, rec.appVersion);
      if (existing && !summary.createdAt) continue;
      await store.setJSON('player-index/' + m[1] + '.json', summary);
      added++;
    }
    return json(200, { ok: true, scanned: scanned, added: added });
  }

  // --- Daftar semua pemain: GET (tanpa code) ---
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });
  const { blobs } = await store.list({ prefix: 'player-index/' });
  const players = [];
  for (const b of (blobs || []).slice(0, MAX_LIST)) {
    const entry = await store.get(b.key, { type: 'json' });
    if (!entry) continue;
    // v0.7.11: scrap Blobs — kalau indeks belum punya createdAt,
    // baca file save pemain itu langsung (di sanalah tanggal buat
    // sudah tersimpan sebagai meta.createdAt) dan pakai hasil
    // konversinya untuk daftar ini. Best-effort: simpan kembali
    // ke indeks supaya daftar berikutnya tidak perlu scrap lagi.
    // Gagal scrap satu pemain TIDAK menggagalkan daftar.
    if (!entry.createdAt) {
      try {
        const codeFromKey = (/^player-index\/([A-Z2-9-]+)\.json$/.exec(b.key || '') || [])[1] || entry.code;
        const recList = await store.get('player/' + codeFromKey + '.json', { type: 'json' });
        if (recList && recList.data) {
          const enriched = summarize(codeFromKey, recList.data, recList.updatedAt, recList.appVersion);
          if (enriched.createdAt) {
            try { await store.setJSON('player-index/' + codeFromKey + '.json', enriched); } catch (e) { /* cache gagal — daftar tetap tampil */ }
            players.push(enriched);
            continue;
          }
        }
      } catch (e) { /* scrap gagal — tampilkan indeks apa adanya */ }
    }
    players.push(entry);
  }
  players.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return json(200, { ok: true, count: players.length, players: players });
};
