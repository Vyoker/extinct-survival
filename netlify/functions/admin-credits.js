/**
 * admin-credits.js (v0.3.3) — Riwayat kiriman kredit manual untuk dashboard.
 * GET, butuh header x-admin-password. -> { log: [...] }
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json, corsPreflight } = require('./utils/response');
const { getCreditStore } = require('./utils/blob-store');

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });
  const store = getCreditStore();
  const log = (await store.get('log', { type: 'json' })) || [];
  return json(200, { log: log });
};
