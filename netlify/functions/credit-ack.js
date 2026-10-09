/**
 * credit-ack.js (v0.3.3) — Game menandai grant sudah diterima.
 * POST { who, ids: [] } -> { ok, acked }
 * Publik: hanya pemilik kode yang bisa mengambil daftar grant-nya,
 * jadi ack dari pemilik kode adalah klaim yang sah.
 */
const { json } = require('./utils/response');
const { getCreditStore } = require('./utils/blob-store');
const { normCode, isValidCode } = require('./utils/credit');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const code = normCode(payload.who);
  const ids = Array.isArray(payload.ids) ? payload.ids.map(String).slice(0, 50) : [];
  if (!isValidCode(code) || ids.length === 0) return json(200, { ok: true, acked: 0 });

  const store = getCreditStore();
  const key = 'grant:' + code;
  const grants = (await store.get(key, { type: 'json' })) || [];
  const now = Date.now();
  let acked = 0;
  for (const g of grants) {
    if (ids.indexOf(g.id) !== -1 && !g.claimed) {
      g.claimed = true;
      g.claimedAt = now;
      acked++;
    }
  }
  if (acked > 0) {
    await store.setJSON(key, grants);
    // Sinkronkan status klaim di riwayat admin
    const log = (await store.get('log', { type: 'json' })) || [];
    let touched = false;
    for (const e of log) {
      if (ids.indexOf(e.id) !== -1 && !e.claimed) {
        e.claimed = true;
        e.claimedAt = now;
        touched = true;
      }
    }
    if (touched) await store.setJSON('log', log);
  }
  return json(200, { ok: true, acked: acked });
};
