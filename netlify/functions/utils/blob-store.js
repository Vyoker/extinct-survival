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

// v0.5.6: store presence pemain online.
// Key: "presence/<PID>.json" — 1 record per pemain (nama, level,
// faksi, lokasi, lastSeen). Fondasi v0.5.7 (chat) & v0.5.8 (friends).
function getPresenceStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'presence', siteID, token });
  }
  return getStore('presence');
}

// v0.5.7: store chat global.
// Key: "msg/<ts>-<PID>-<rand>.json" (1 key per pesan — anti tabrakan
// tulis), "last/<PID>.json" (cooldown server), "meta/banned.json".
function getChatStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'chat', siteID, token });
  }
  return getStore('chat');
}

// v0.5.8: store friends.
// Key: "list/<PID>.json" (daftar teman), "reqin/<PID>.json"
// (permintaan masuk), "reqout/<PID>.json" (permintaan terkirim).
function getFriendsStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'friends', siteID, token });
  }
  return getStore('friends');
}

// v0.6.3: store barter antar pemain.
// Key: "inbox/<PID>.json" (kiriman menunggu diambil penerima),
// "cd/<PID>.json" (cooldown pengirim).
function getBarterStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'barter', siteID, token });
  }
  return getStore('barter');
}

module.exports = { getTopupStore, getCreditStore, getPlayBillingStore, getPresenceStore, getChatStore, getFriendsStore, getBarterStore };
