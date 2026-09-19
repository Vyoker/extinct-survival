const { getStore } = require('@netlify/blobs');
const { isAdminAuthorized } = require('./utils/auth');
const { json } = require('./utils/response');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const orderCode = String(payload.orderCode || '').toUpperCase();
  if (!orderCode) return json(400, { error: 'orderCode wajib diisi.' });

  const store = getStore('topup');
  const key = `order:${orderCode}`;
  const order = await store.get(key, { type: 'json' });
  if (!order) return json(404, { error: 'Order tidak ditemukan.' });
  if (order.status !== 'pending' && order.status !== 'expired') {
    return json(409, { error: `Order sudah berstatus ${order.status}, tidak bisa di-approve lagi.` });
  }

  order.status = 'approved';
  order.approvedAt = Date.now();
  await store.setJSON(key, order);

  return json(200, { ok: true, order });
};
