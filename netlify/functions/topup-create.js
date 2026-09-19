/**
 * POST /.netlify/functions/topup-create
 * Body: { packageId, playerId, playerName }
 *
 * Membuat order topup baru berstatus 'pending'. Nominal yang wajib
 * ditransfer pemain BUKAN harga bulat paket, tapi harga + kode unik
 * 1-899 rupiah (mis. Rp10.000 jadi Rp10.437). Karena QRIS yang dipakai
 * QRIS STATIS (satu gambar sama untuk semua transaksi, bukan QRIS
 * dinamis dari payment gateway), tidak ada callback otomatis dari bank/
 * e-wallet. Nominal unik ini cuma memudahkan admin mencocokkan mutasi
 * secara MANUAL saat verifikasi — bukan otomatisasi penuh.
 */
const { getTopupStore } = require('@netlify/blobs');
const { getPackage } = require('./utils/packages');
const { generateOrderCode } = require('./utils/order-code');
const { json } = require('./utils/response');

const ORDER_TTL_MS = 30 * 60 * 1000; // order berlaku 30 menit

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
  const uniqueAmount = pkg.priceRupiah + 1 + Math.floor(Math.random() * 899); // +Rp1..+Rp899
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
