const { getStore } = require('@netlify/blobs');

// Store terpisah dari topup: menyimpan save player sebagai
// key "player/<KODE>.json". Kodenya sendiri adalah rahasianya
// (acak 16 karakter, tidak bisa ditebak).
function getSaveStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'saves', siteID, token });
  }
  return getStore('saves');
}

module.exports = { getSaveStore };
