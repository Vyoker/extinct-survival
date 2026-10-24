/**
 * Barter (v0.6.3) — logika bersama function barter.
 *
 * Spek terkunci user 2026-10-23: kirim item SATU ARAH, langsung
 * masuk tanpa persetujuan penerima; ITEM SAJA (Rupiah & Kredit
 * tidak bisa dikirim); pengirim & penerima harus sama-sama online
 * DAN berada di wilayah (lokasi) yang sama — divalidasi server
 * dari record presence.
 *
 * Model data (store 'barter'):
 * - inbox/<PID>.json : { items: [ { id, fromPid, fromName,
 *                        items: [{ itemId, qty }], ts } ] }
 *   Kiriman menunggu diambil klien penerima (polling). Penerima
 *   yang keburu offline tidak kehilangan kiriman: ditahan server
 *   maks 24 jam (DELIVERY_TTL_MS), lewat itu dibuang.
 * - cd/<PID>.json    : { ts } cooldown pengirim (anti-spam).
 */
const COOLDOWN_MS = 10 * 1000;          // jeda antar kiriman per pengirim
const MAX_TYPES_PER_SEND = 5;           // jenis item per kiriman
const MAX_QTY_PER_ITEM = 999;           // jumlah per jenis
const MAX_INBOX = 20;                   // kiriman menunggu per penerima
const DELIVERY_TTL_MS = 24 * 60 * 60 * 1000;

const ITEM_ID_RE = /^[a-z0-9_]{2,48}$/;

// Validasi daftar item kiriman. Mengembalikan array bersih atau
// null bila tidak valid.
function cleanItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TYPES_PER_SEND) return null;
  const out = [];
  const seen = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const itemId = String(raw.itemId || '');
    if (!ITEM_ID_RE.test(itemId) || seen.has(itemId)) return null;
    const qty = Math.floor(Number(raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) return null;
    seen.add(itemId);
    out.push({ itemId, qty });
  }
  return out;
}

function pruneExpired(deliveries, now) {
  return deliveries.filter(d => d && typeof d.ts === 'number' && (now - d.ts) <= DELIVERY_TTL_MS);
}

async function loadInbox(store, pid) {
  const rec = await store.get('inbox/' + pid + '.json', { type: 'json' }).catch(() => null);
  return rec && Array.isArray(rec.items) ? rec.items : [];
}

async function saveInbox(store, pid, items) {
  await store.setJSON('inbox/' + pid + '.json', { items });
}

module.exports = {
  COOLDOWN_MS,
  MAX_TYPES_PER_SEND,
  MAX_QTY_PER_ITEM,
  MAX_INBOX,
  DELIVERY_TTL_MS,
  cleanItems,
  pruneExpired,
  loadInbox,
  saveInbox
};
