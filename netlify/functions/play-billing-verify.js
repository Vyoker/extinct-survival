/**
 * play-billing-verify (v0.4.5)
 * Verifikasi pembelian Google Play Billing dari wrapper native Play Store.
 *
 * POST { packageId, sku, purchaseToken, orderId, playerId }
 *
 * - Mode uji: PLAY_BILLING_TEST_MODE=true + sku android.test.purchased
 *   -> token diterima tanpa memanggil Google (tidak ada tagihan nyata).
 * - Mode produksi: verifikasi purchaseToken ke Play Developer API
 *   (purchases.products.get) memakai service account dari env
 *   GOOGLE_SERVICE_ACCOUNT_JSON. purchaseState harus 0 (purchased).
 * - Idempotency: token yang sudah pernah di-grant tercatat di Blobs
 *   (key "grant:<token>") -> jawab 'already_granted' supaya kredit
 *   tidak diberikan dua kali.
 *
 * Kredit di-apply oleh CLIENT ke player lokal (pola sama seperti topup
 * QRIS yang di-approve: game ini single-player berbasis localStorage).
 * Function ini hanya menyatakan token VALID + jumlah kreditnya.
 */
const https = require('https');
const crypto = require('crypto');
const { getPackage } = require('./utils/packages');
const { getPlayBillingStore } = require('./utils/blob-store');
const { json } = require('./utils/response');

const PACKAGE_NAME = 'com.extinctsurvival.game';
const TEST_SKU = 'android.test.purchased';

function postJson(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          headers || {}
        )
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
          } catch (e) {
            reject(new Error('Respon Google tidak valid.'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(url, accessToken) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { Authorization: 'Bearer ' + accessToken }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
          } catch (e) {
            reject(new Error('Respon Google tidak valid.'));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** Tukar service account JSON -> OAuth2 access token (tanpa dependensi tambahan). */
async function getAccessToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Service account Google belum dikonfigurasi.');
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    throw new Error('Format service account Google tidak valid.');
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error('Service account Google tidak lengkap.');
  }
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned =
    b64({ alg: 'RS256', typ: 'JWT' }) +
    '.' +
    b64({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    });
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, 'base64url');
  const res = await postJson(
    'https://oauth2.googleapis.com/token',
    JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + signature
    })
  );
  if (res.status !== 200 || !res.body.access_token) {
    throw new Error('Gagal mendapatkan token akses Google.');
  }
  return res.body.access_token;
}

async function verifyWithGoogle(sku, purchaseToken) {
  const accessToken = await getAccessToken();
  const url =
    'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
    encodeURIComponent(PACKAGE_NAME) +
    '/purchases/products/' +
    encodeURIComponent(sku) +
    '/tokens/' +
    encodeURIComponent(purchaseToken);
  const res = await getJson(url, accessToken);
  if (res.status !== 200) {
    throw new Error('Pembelian tidak ditemukan di Google Play.');
  }
  // purchaseState: 0 = purchased, 1 = cancelled, 2 = pending
  if (res.body.purchaseState !== 0) {
    throw new Error('Status pembelian tidak valid di Google Play.');
  }
  return res.body;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method tidak diizinkan.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const { packageId, sku, purchaseToken, orderId } = body;
  if (!packageId || !sku || !purchaseToken) {
    return json(400, { error: 'Data pembelian tidak lengkap.' });
  }

  const pkg = getPackage(packageId);
  if (!pkg) return json(400, { error: 'Paket tidak dikenal.' });

  const testMode =
    process.env.PLAY_BILLING_TEST_MODE === 'true' && sku === TEST_SKU;
  if (!testMode && sku !== pkg.playSku) {
    return json(400, { error: 'SKU tidak cocok dengan paket.' });
  }

  // Pembelian Play memakai tangga kredit Play (playKredit), bukan tangga QRIS.
  const grantKredit = typeof pkg.playKredit === 'number' ? pkg.playKredit : pkg.kredit;

  const store = getPlayBillingStore();
  const grantKey = 'grant:' + purchaseToken;

  try {
    const existing = await store.get(grantKey, { type: 'json' }).catch(() => null);
    if (existing) {
      return json(200, { ok: true, status: 'already_granted', kredit: 0 });
    }

    if (!testMode) {
      await verifyWithGoogle(sku, purchaseToken);
    }

    await store.setJSON(grantKey, {
      packageId: pkg.id,
      sku,
      orderId: orderId || null,
      kredit: grantKredit,
      testMode,
      grantedAt: new Date().toISOString()
    });

    return json(200, { ok: true, status: 'granted', kredit: grantKredit, testMode });
  } catch (e) {
    console.error('[play-billing-verify]', e.message);
    return json(400, { error: e.message || 'Verifikasi pembelian gagal.' });
  }
};
