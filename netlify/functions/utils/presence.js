/**
 * Presence (v0.5.6) — logika bersama function presence & admin-presence.
 *
 * Keputusan user 2026-10-21: SEMUA durasi 2 menit biar aman kuota.
 * - Heartbeat klien: tiap 2 menit.
 * - Jendela online: pemain dianggap online bila heartbeat terakhir
 *   <= 2 menit. Ditambah toleransi 30 detik untuk keterlambatan
 *   jaringan/antrian Functions supaya status tidak kedip
 *   online-offline tepat di batas 2 menit.
 */
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const ONLINE_TOLERANCE_MS = 30 * 1000;
const MAX_SCAN = 500;          // batas record dibaca per panggilan
const STALE_DELETE_MS = 7 * 24 * 60 * 60 * 1000; // record > 7 hari dibersihkan

function isOnline(rec, now) {
  return !!rec && (now - rec.lastSeen) <= ONLINE_WINDOW_MS + ONLINE_TOLERANCE_MS;
}

// Buang karakter yang bisa dipakai menyuntik HTML/markup, batasi panjang.
function cleanText(value, maxLen) {
  return String(value == null ? '' : value)
    .replace(/[<>&"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanFaction(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(v) ? v : null;
}

function cleanLevel(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, n));
}

// v0.5.8: skor power karakter (dihitung klien dari stat turunan),
// untuk info karakter teman. Null bila tidak dikirim.
function cleanPower(value) {
  if (value == null) return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(999999, n));
}

const PID_RE = /^[A-Z0-9-]{8,40}$/;
function cleanPid(value) {
  const v = String(value || '').toUpperCase().trim();
  return PID_RE.test(v) ? v : null;
}

// Baca semua record presence (maks MAX_SCAN), urut lastSeen terbaru.
// Record basi > 7 hari dihapus sekalian (housekeeping ringan).
async function listPresence(store, now) {
  const { blobs } = await store.list({ prefix: 'presence/' });
  const records = [];
  const staleKeys = [];
  for (const b of blobs.slice(0, MAX_SCAN)) {
    const rec = await store.get(b.key, { type: 'json' });
    if (!rec || !rec.name || !rec.lastSeen) continue;
    if (now - rec.lastSeen > STALE_DELETE_MS) { staleKeys.push(b.key); continue; }
    records.push(rec);
  }
  if (staleKeys.length) {
    await Promise.all(staleKeys.map(k => store.delete(k).catch(() => {})));
  }
  records.sort((a, b) => b.lastSeen - a.lastSeen);
  return records;
}

// Bentuk publik untuk UI game: tanpa pid (identitas internal).
function publicPlayer(rec, now) {
  return {
    name: rec.name,
    level: rec.level,
    power: rec.power != null ? rec.power : null,
    faction: rec.faction || null,
    location: rec.location || '',
    lastSeen: rec.lastSeen,
    online: isOnline(rec, now)
  };
}

module.exports = {
  ONLINE_WINDOW_MS,
  ONLINE_TOLERANCE_MS,
  isOnline,
  cleanText,
  cleanFaction,
  cleanLevel,
  cleanPower,
  cleanPid,
  listPresence,
  publicPlayer
};
