/**
 * watch-pending.js (v0.3.7) — endpoint PUBLIK untuk monitoring.
 * Mengembalikan HANYA agregat (tanpa nama player, nominal, atau kode
 * order) sehingga aman di-poll berkala tanpa password admin:
 * { pending, paid, oldestWaitingMin, checkedAt }
 * Dipakai cron monitoring untuk notifikasi "ada order menunggu".
 */
const { json } = require('./utils/response');
const { getTopupStore } = require('./utils/blob-store');

exports.handler = async () => {
  try {
    const store = getTopupStore();
    const { blobs } = await store.list({ prefix: 'order:' });
    const now = Date.now();
    let pending = 0;
    let paid = 0;
    let oldest = null;
    for (const b of blobs) {
      const o = await store.get(b.key, { type: 'json' });
      if (!o) continue;
      // Samakan logika expiry dengan topup-status: pending lewat TTL = expired
      let st = o.status;
      if (st === 'pending' && now > o.expiresAt) st = 'expired';
      if (st !== 'pending' && st !== 'paid') continue;
      if (st === 'pending') pending++;
      else paid++;
      const waitMin = Math.floor((now - (o.paidAt || o.createdAt || now)) / 60000);
      if (oldest === null || waitMin > oldest) oldest = waitMin;
    }
    return json(200, { pending: pending, paid: paid, oldestWaitingMin: oldest, checkedAt: now });
  } catch (e) {
    return json(500, { error: 'Gagal membaca data order.' });
  }
};
