/**
 * RTDB reader (v0.7.0) — baca presence/chat dari Firebase Realtime
 * Database lewat Firebase Admin SDK, KHUSUS untuk function Netlify
 * yang masih butuh data presence: barter, friends, admin-presence,
 * admin-chat.
 *
 * Kredensial: HANYA dari environment Netlify, tidak pernah dari
 * chat / file repo / workspace:
 *   FIREBASE_SERVICE_ACCOUNT_JSON : seluruh JSON Service Account
 *   FIREBASE_DATABASE_URL          : URL RTDB (lihat SETUP-v0.7.0.md)
 * Bila salah satu kosong atau firebase-admin tidak terinstal,
 * fungsi ini mengembalikan null dan pemanggil WAJIB fallback ke
 * Blobs lama (tidak crash, tapi datanya bisa basi setelah migrasi).
 *
 * Admin SDK melewati RTDB Rules (bypass), jadi admin bisa
 * hapus pesan / ban dari dashboard walau rules klien melarangnya.
 */
let cachedDb = null;
let attempted = false;

function getDb() {
  if (attempted) return cachedDb;
  attempted = true;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
    const url = process.env.FIREBASE_DATABASE_URL || '';
    if (!raw || !url) return null;
    let cred;
    try { cred = JSON.parse(raw); } catch (e) { return null; }
    if (!cred.private_key || !cred.client_email || !cred.project_id) return null;
    // Require dinamis: bila firebase-admin belum terinstal di
    // environment lokal, jangan crash — kembalikan null (fallback).
    const admin = require('firebase-admin');
    if (!admin.apps || !admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(cred),
        databaseURL: url
      });
    }
    cachedDb = admin.database();
    return cachedDb;
  } catch (e) {
    return null;
  }
}

function isAvailable() {
  return !!getDb();
}

async function listPresenceRTDB() {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.ref('presence').once('value');
    const val = snap.val() || {};
    const records = Object.keys(val).map(k => val[k]).filter(r => r && r.name && r.lastSeen);
    records.sort((a, b) => b.lastSeen - a.lastSeen);
    return records;
  } catch (e) {
    return null;
  }
}

async function listMessagesRTDB(withPid) {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.ref('chat/messages').orderByChild('ts').limitToLast(50).once('value');
    const val = snap.val() || {};
    const msgs = Object.keys(val).map(k => val[k]).filter(m => m && m.text && m.ts);
    msgs.sort((a, b) => a.ts - b.ts);
    const out = msgs.slice(-50).map(m => {
      const o = {
        id: m.id, name: m.name, level: m.level,
        role: m.role === 'admin' ? 'admin' : 'player',
        text: m.text, ts: m.ts
      };
      if (withPid) o.pid = m.pid;
      return o;
    });
    const banSnap = await db.ref('chat/banned').once('value');
    const bannedVal = banSnap.val() || {};
    const banned = Object.keys(bannedVal).filter(k => bannedVal[k]);
    return { messages: out, banned };
  } catch (e) {
    return null;
  }
}

async function deleteMessageRTDB(id) {
  const db = getDb();
  if (!db) return false;
  try {
    const snap = await db.ref('chat/messages').orderByChild('id').equalTo(id).once('value');
    const val = snap.val() || {};
    const updates = {};
    Object.keys(val).forEach(k => { updates['chat/messages/' + k] = null; });
    if (Object.keys(updates).length) await db.ref().update(updates);
    return true;
  } catch (e) { return false; }
}

async function setBanRTDB(pid, banned) {
  const db = getDb();
  if (!db) return false;
  try {
    if (banned) await db.ref('chat/banned/' + pid).set(true);
    else await db.ref('chat/banned/' + pid).remove();
    return true;
  } catch (e) { return false; }
}

async function clearMessagesRTDB() {
  const db = getDb();
  if (!db) return false;
  try { await db.ref('chat/messages').remove(); return true; }
  catch (e) { return false; }
}

module.exports = {
  getDb, isAvailable,
  listPresenceRTDB, listMessagesRTDB,
  deleteMessageRTDB, setBanRTDB, clearMessagesRTDB
};
