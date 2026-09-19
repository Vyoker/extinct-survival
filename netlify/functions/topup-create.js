const { getPackage } = require('./utils/packages');
const { generateOrderCode } = require('./utils/order-code');
const { json } = require('./utils/response');
const { getTopupStore } = require('./utils/blob-store');

const ORDER_TTL_MS = 30 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const { packageId, playerId, playerName } = payload;
  const pkg = getPackage(packageId);
  if (!pkg) return json(400, { error: 'Paket topup tidak dikenal.' });
  if (!playerId) return json(400, { error: 'playerId wajib diisi.' });

  const now = Date.now();
  const uniqueAmount = pkg.priceRupiah + 1 + Math.floor(Math.random() * 899);
  const orderCode = generateOrderCode();

  const order = {
    orderCode,
    playerId,
    playerName: String(playerName || '-').slice(0, 32),
    packageId: pkg.id,
    packageLabel: pkg.label,
    priceRupiah: pkg.priceRupiah,
    uniqueAmount,
    kredit: pkg.kredit,
    status: 'pending',
    createdAt: now,
    expiresAt: now + ORDER_TTL_MS
  };

  const store = getTopupStore();
  await store.setJSON(`order:${orderCode}`, order);

  return json(200, {
    orderCode,
    uniqueAmount,
    kredit: pkg.kredit,
    priceRupiah: pkg.priceRupiah,
    expiresAt: order.expiresAt
  });
};    createdAt: now,
    expiresAt: now + ORDER_TTL_MS
  };

  const store = getStore('topup');
  await store.setJSON(`order:${orderCode}`, order);

  return json(200, {
    orderCode,
    uniqueAmount,
    kredit: pkg.kredit,
    priceRupiah: pkg.priceRupiah,
    expiresAt: order.expiresAt
  });
};
