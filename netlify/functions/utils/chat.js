/**
 * Chat global (v0.5.7) — logika bersama function chat & admin-chat.
 *
 * Keputusan user 2026-10-21 (ditegaskan 22:13 WIB): cooldown tetap
 * 15 detik dan ditegakkan di SERVER (bukan cuma klien, supaya tidak
 * bisa di-bypass klien modif). Polling klien 15 detik hanya saat
 * panel chat dibuka. Simpan 50 pesan terakhir, maks 200 karakter.
 *
 * Badge ADMIN: role 'admin' HANYA diberikan server bila header
 * x-chat-admin cocok dengan ADMIN_PASSWORD (env yang sama dengan
 * dashboard admin). Field role dari klien selalu diabaikan —
 * badge tidak bisa dipalsukan.
 */
const COOLDOWN_MS = 15 * 1000;
const MAX_MESSAGES = 50;
const KEEP_MESSAGES = 80; // simpan sedikit di atas 50, sisanya dibersihkan
const MAX_TEXT_LEN = 200;

// Tautan = vektor scam topup palsu -> ditolak di chat.
const LINK_RE = /(https?:|www\.|\.com\b|\.net\b|\.xyz\b|\.online\b|\.site\b|\.top\b|\.icu\b|\.click\b)/i;

// Kata kasar dasar (IN/EN) — disamarkan ***, pesan tetap terkirim.
const BADWORDS = [
  'anjing', 'bangsat', 'babi', 'kontol', 'memek', 'ngentot', 'tolol',
  'goblok', 'bodoh', 'jancok', 'asu', 'tai', 'bajingan', 'fuck',
  'shit', 'bitch', 'dick', 'pussy', 'nigger'
];
const BADWORD_RE = new RegExp('\\b(' + BADWORDS.join('|') + ')\\b', 'gi');

function maskBadwords(text) {
  return text.replace(BADWORD_RE, (m) => '*'.repeat(Math.max(3, m.length)));
}

function hasLink(text) {
  return LINK_RE.test(text);
}

// Baca pesan terbaru (urut lama -> baru). withPid=true hanya untuk
// admin (moderasi/ban); tampilan publik tidak mengekspos pid.
async function listMessages(store, { withPid = false } = {}) {
  const { blobs } = await store.list({ prefix: 'msg/' });
  const msgs = [];
  for (const b of blobs) {
    const m = await store.get(b.key, { type: 'json' });
    if (m && m.text && m.ts) msgs.push(m);
  }
  msgs.sort((a, b) => a.ts - b.ts);
  return msgs.slice(-MAX_MESSAGES).map(m => {
    const out = {
      id: m.id,
      name: m.name,
      level: m.level,
      role: m.role === 'admin' ? 'admin' : 'player',
      text: m.text,
      ts: m.ts
    };
    if (withPid) out.pid = m.pid;
    return out;
  });
}

// Jaga pertumbuhan store: hapus pesan di luar KEEP_MESSAGES terbaru.
async function pruneMessages(store) {
  const { blobs } = await store.list({ prefix: 'msg/' });
  if (blobs.length <= KEEP_MESSAGES) return;
  const sorted = blobs.slice().sort((a, b) => a.key.localeCompare(b.key));
  const excess = sorted.slice(0, sorted.length - KEEP_MESSAGES);
  await Promise.all(excess.map(b => store.delete(b.key).catch(() => {})));
}

async function getBanned(store) {
  const rec = await store.get('meta/banned.json', { type: 'json' }).catch(() => null);
  return rec && Array.isArray(rec.pids) ? rec.pids : [];
}

async function setBanned(store, pids) {
  await store.setJSON('meta/banned.json', { pids: [...new Set(pids)] });
}

module.exports = {
  COOLDOWN_MS,
  MAX_MESSAGES,
  MAX_TEXT_LEN,
  maskBadwords,
  hasLink,
  listMessages,
  pruneMessages,
  getBanned,
  setBanned
};
