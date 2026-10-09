/**
 * topup-confirm.js (v0.3.4) — Player mengklik "Saya Sudah Bayar".
 * POST { code } -> { ok, status }
 * Order "pending" (belum kedaluwarsa) dikunci menjadi "paid":
 * menunggu verifikasi manual admin. Status paid TIDAK ikut kedaluwarsa
 * oleh topup-status — hanya admin (approve/reject) atau player
 * (batalkan) yang bisa menyelesaikannya.
 * Idempoten: paid/approved/claimed yang dikonfirmasi ulang tetap OK.
 */
const { json } = require('./utils/response');
const { getTopupStore } = require('./utils/blob-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const orderCode = String(payload.code || '').toUpperCase();
  if (!orderCode) return json(400, { error: 'Parameter code wajib diisi.' });

  const store = getTopupStore();
  const key = 'order:' + orderCode;
  const order = await store.get(key, { type: 'json' });
  if (!order) return json(404, { error: 'Order tidak ditemukan.' });

  const now = Date.now();
  if (order.status === 'pending' && now > order.expiresAt) {
    order.status = 'expired';
    await store.setJSON(key, order);
    return json(409, { error: 'Order kedaluwarsa. Silakan buat order baru.' });
  }
  if (order.status === 'expired') {
    return json(409, { error: 'Order kedaluwarsa. Silakan buat order baru.' });
  }
  if (order.status === 'rejected') {
    return json(409, { error: 'Order ini ditolak admin.' });
  }
  if (order.status === 'pending') {
    order.status = 'paid';
    order.paidAt = now;
    await store.setJSON(key, order);
  }
  return json(200, { ok: true, status: order.status });
};
