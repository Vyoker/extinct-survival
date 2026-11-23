const { json, corsPreflight } = require('./utils/response');
const { getSaveStore } = require('./utils/save-store');
const { getBanStore, normalizeCode, isBanned } = require('./utils/ban-store');

const CODE_RE = /^[A-Z2-9-]{8,64}$/;

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;

  const code = String(
    (event.queryStringParameters && event.queryStringParameters.code) || ''
  ).toUpperCase().trim();
  if (!CODE_RE.test(code)) return json(400, { error: 'Kode save tidak valid.' });

  // v0.7.7 Ban (full ban by kode save): kode yang di-ban ditolak di
  // sini — pertahanan utama, klien bisa di-bypass, server tidak.
  // Satu daftar blokir menutup web + Play Store (server masih nyatu).
  if (await isBanned(getBanStore(), normalizeCode(code))) {
    return json(403, { error: 'Akun ini di-banned. Hubungi admin jika ini kesalahan.' });
  }

  const store = getSaveStore();
  const record = await store.get('player/' + code + '.json', { type: 'json' });
  if (!record || !record.data) return json(404, { error: 'Kode tidak ditemukan. Periksa lagi kode savemu.' });

  return json(200, { ok: true, data: record.data, updatedAt: record.updatedAt });
};
