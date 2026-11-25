const { json, corsPreflight } = require('./utils/response');
const { getSaveStore } = require('./utils/save-store');
// v0.8.0: cap level 35 + hitung ulang poin atribut (lock total 170).
const { clampLevel, cleanAnticheat } = require('./utils/levelcap');

const MAX_BYTES = 512 * 1024; // 512 KB — cukup untuk save JSON game ini
const CODE_RE = /^[A-Z2-9-]{8,64}$/;

// v0.7.11: tanggal + asal pembuatan akun (panel admin).
// Resolve dari save yang SUDAH ADA di Blobs: meta.createdAt / world.time
// (itu waktu akun dibuat — contoh ALFIAN 21 Nov 2026 16:27 WIB).
// Nilai ini TIDAK boleh dipercaya 100%: save dikirim dari klien,
// pemain bisa mengedit JSON lokal sebelum upload. Karena itu
// player-save MEMPERTAHANKAN nilai first-seen di indeks (lihat
// bawah): sekali tercatat, save berikutnya tidak bisa mengubahnya
// untuk menyembunyikan akun lama / asal web.
// v0.8.0: cap level 35 + anti-cheat (lihat bawah, sebelum disimpan).
function resolveCreated(data) {
  var save = (data && data.save) || {};
  var pl = save.player || {};
  var createdAt = Number(pl.createdAt) || 0;
  if (!createdAt) createdAt = Number(save.meta && save.meta.createdAt) || 0;
  if (!createdAt) createdAt = Number(save.world && save.world.time) || 0;
  var createdIn = pl.createdIn;
  if (createdIn !== 'playstore' && createdIn !== 'web') {
    createdIn = (pl.subSkills && pl.subSkills['beta-tester']) ? 'playstore' : 'unknown';
  }
  return { createdAt: createdAt || null, createdIn: createdIn };
}

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const code = String(payload.code || '').toUpperCase().trim();
  if (!CODE_RE.test(code)) return json(400, { error: 'Kode save tidak valid.' });

  const data = payload.data;
  if (!data || typeof data !== 'object' || !data.save || !data.save.player) {
    return json(400, { error: 'Data save tidak valid.' });
  }
  if (JSON.stringify(data).length > MAX_BYTES) {
    return json(413, { error: 'Data save terlalu besar (maks 512 KB).' });
  }

  // v0.8.0 (keputusan Alfi 25 Nov 2026): pemain di atas level 35
  // OTOMATIS dihitung ulang saat Simpan Online — level jadi 35,
  // total poin atribut di-lock 170, maxEnergy 168. Penegakan di sini
  // (sebelum disimpan) supaya client lama / client yang dimodifikasi
  // tidak bisa lolos lewat cloud save. Riwayat clamp dicatat di meta.
  var clamped = clampLevel(data.save.player);
  if (clamped) {
    if (!data.save.meta) data.save.meta = {};
    data.save.meta.levelCapClamp = { fromLevel: clamped.fromLevel, at: Date.now() };
  }

  const store = getSaveStore();
  const record = {
    data: data,
    updatedAt: Date.now(),
    appVersion: data.appVersion || null
  };
  await store.setJSON('player/' + code + '.json', record);

  // v0.7.7 Fase 1 (panel admin pemain): tulis juga satu baris ringkas ke
  // indeks pemain, supaya daftar pemain bisa dibaca tanpa membuka seluruh
  // file save (sampai 512 KB per pemain). Best-effort: gagal tulis indeks
  // TIDAK boleh menggagalkan save utama.
  try {
    const pl = data.save.player || {};
    const cur = pl.currency || {};
    const created = resolveCreated(data);
    // Pertahankan first-seen: kalau indeks sudah punya createdAt,
    // pakai itu — jangan biarkan save editan menimpa tanggal/asal.
    var existingIdx = null;
    try { existingIdx = await store.get('player-index/' + code + '.json', { type: 'json' }); } catch (e) { existingIdx = null; }
    if (existingIdx && existingIdx.createdAt) {
      created.createdAt = existingIdx.createdAt;
      if (existingIdx.createdIn) created.createdIn = existingIdx.createdIn;
    }
    // v0.8.0 Anti-Cheat v1: simpan hasil verifikasi terakhir pemain
    // ke indeks (dari save.meta.anticheat) supaya panel admin bisa
    // menampilkannya tanpa membuka file save. Kalau save ini dari
    // build lama (belum ada anticheat), pertahankan nilai indeks lama.
    var anticheat = cleanAnticheat(data.save.meta && data.save.meta.anticheat);
    if (!anticheat && existingIdx && existingIdx.anticheat) anticheat = existingIdx.anticheat;
    await store.setJSON('player-index/' + code + '.json', {
      code: code,
      name: String(pl.name || 'Survivor').slice(0, 32),
      level: Number(pl.level) || 1,
      kredit: Number(cur.kredit) || 0,
      rupiah: Number(cur.rupiah) || 0,
      faction: pl.faction || null,
      location: pl.location || null,
      createdAt: created.createdAt,
      createdIn: created.createdIn,
      anticheat: anticheat,
      updatedAt: record.updatedAt,
      appVersion: record.appVersion
    });
  } catch (e) { /* indeks gagal — save utama tetap berhasil */ }

  return json(200, { ok: true, updatedAt: record.updatedAt });
};
