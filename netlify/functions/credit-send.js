/**
 * credit-send.js (v0.3.3) — Admin mengirim kredit MANUAL ke player.
 * POST, butuh header x-admin-password.
 * Body: { code, kredit, note }
 * - code: kode save cloud player (boleh pakai strip, mis. "AB12-CD34-...").
 * - kredit: 1..100000
 * Grant disimpan di blob "grant:<KODE16>" dan dicatat di "log".
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json } = require('./utils/response');
const { getCreditStore } = require('./utils/blob-store');
const { normCode, isValidCode, fmtCode } = require('./utils/credit');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const code = normCode(payload.code);
  const kredit = parseInt(payload.kredit, 10);
  const note = String(payload.note || '').slice(0, 120);

  if (!isValidCode(code)) {
    return json(400, { error: 'Kode save tidak valid. Minta player buka Menu > Simpan Online untuk melihat kodenya.' });
  }
  if (!Number.isFinite(kredit) || kredit < 1 || kredit > 100000) {
    return json(400, { error: 'Jumlah kredit harus 1–100.000.' });
  }

  const store = getCreditStore();
  const key = 'grant:' + code;
  const grants = (await store.get(key, { type: 'json' })) || [];

  const grant = {
    id: 'CR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
    kredit: kredit,
    note: note,
    createdAt: Date.now(),
    claimed: false
  };
  grants.push(grant);
  await store.setJSON(key, grants);

  // Riwayat untuk dashboard admin (terbaru dulu, maks 50 entri)
  const log = (await store.get('log', { type: 'json' })) || [];
  log.unshift({
    id: grant.id,
    code: fmtCode(code),
    kredit: kredit,
    note: note,
    createdAt: grant.createdAt,
    claimed: false
  });
  await store.setJSON('log', log.slice(0, 50));

  return json(200, { ok: true, grant: Object.assign({}, grant, { code: fmtCode(code) }) });
};
