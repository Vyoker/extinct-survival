/**
 * GET /.netlify/functions/topup-status?code=AS-XXXXXX
 *
 * Dipoll berkala oleh client selama layar pembayaran terbuka. Begitu
 * status 'approved' terbaca SEKALI, langsung ditandai 'claimed' di
 * server supaya polling berikutnya (atau reload di tengah proses) tidak
 * memicu penambahan Kredit dua kali di client.
 */
const { getTopupStore } = require('@netlify/blobs');
const { json } = require('./utils/response');

exports.handler = async (event) => {
  const orderCode = event.queryStringParameters && event.queryStringParameters.code;
  if (!orderCode) return json(400, { error: 'Parameter code wajib diisi.' });

  const store = getStore('topup');
  const key = `order:${orderCode.toUpperCase()}`;
  const order = await store.get(key, { type: 'json' });
  if (!order) return json(404, { status: 'not_found' });

  const now = Date.now();
  if (order.status === 'pending' && now > order.expiresAt) {
    order.status = 'expired';
    await store.setJSON(key, order);
  }

  if (order.status === 'approved') {
    order.status = 'claimed';
    order.claimedAt = now;
    await store.setJSON(key, order);
    return json(200, { status: 'approved', kredit: order.kredit, orderCode: order.orderCode });
  }

  if (order.status === 'claimed') return json(200, { status: 'claimed' });
  if (order.status === 'rejected') return json(200, { status: 'rejected', reason: order.reason || '' });
  if (order.status === 'expired') return json(200, { status: 'expired' });

  return json(200, {
    status: 'pending',
    uniqueAmount: order.uniqueAmount,
    expiresAt: order.expiresAt,
    packageLabel: order.packageLabel
  });
};
