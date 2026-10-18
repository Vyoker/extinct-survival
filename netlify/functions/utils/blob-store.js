const { getStore } = require('@netlify/blobs');

function getTopupStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'topup', siteID, token });
  }
  return getStore('topup');
}

// v0.3.3: store kiriman kredit manual admin -> player.
// Key: "grant:<KODE16>" (array grant), "log" (riwayat untuk admin).
function getCreditStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'credits', siteID, token });
  }
  return getStore('credits');
}

// v0.4.5: store verifikasi Google Play Billing.
// Key: "grant:<purchaseToken>" (mencegah grant kredit ganda per pembelian).
function getPlayBillingStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'play-billing', siteID, token });
  }
  return getStore('play-billing');
}

module.exports = { getTopupStore, getCreditStore, getPlayBillingStore };
