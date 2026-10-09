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

module.exports = { getTopupStore, getCreditStore };
