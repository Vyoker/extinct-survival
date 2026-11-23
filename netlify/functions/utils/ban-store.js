const { getStore } = require('@netlify/blobs');

// Store 'bans' — daftar blokir pemain (full ban by kode save, v0.7.7).
// Key: "<KODE>.json" (kode dinormalisasi: huruf besar, tanpa tanda
// hubung/spasi) -> { code, reason, bannedAt }.
// Satu store untuk web + Play Store (server masih nyatu), jadi satu
// ban menutup kedua versi game sekaligus.
//
// Pola sama seperti utils/save-store.js & utils/blob-store.js:
// BLOBS_SITE_ID + BLOBS_TOKEN dipakai kalau ada (lokal/CI), kalau
// tidak, getStore('bans') memakai konteks Netlify otomatis.
function getBanStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'bans', siteID, token });
  }
  return getStore('bans');
}

// Kode save dinormalisasi supaya 'AB12-CD34-EF56-GH78' dan
// 'AB12CD34EF56GH78' mengacu ke ban yang sama. Dipakai di keempat
// function ban (admin-ban, check-ban, player-save, player-load).
function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Alphabet kode save: A-Z + 2-9 (tanpa 0/1/O/I, sama seperti generator
// kode di CloudSave). Panjang 8-64 mengikuti validasi lama.
const CODE_RE = /^[A-Z2-9]{8,64}$/;

function isValidCode(raw) {
  return CODE_RE.test(normalizeCode(raw));
}

async function getBan(store, code) {
  const rec = await store.get(normalizeCode(code) + '.json', { type: 'json' });
  return rec || null;
}

async function isBanned(store, code) {
  return !!(await getBan(store, code));
}

module.exports = { getBanStore, normalizeCode, isValidCode, getBan, isBanned, CODE_RE };
