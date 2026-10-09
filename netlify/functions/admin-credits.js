/**
 * admin-credits.js (v0.3.3) — Riwayat kiriman kredit manual untuk dashboard.
 * GET, butuh header x-admin-password. -> { log: [...] }
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json } = require('./utils/response');
const { getCreditStore } = require('./utils/blob-store');

exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });
  const store = getCreditStore();
  const log = (await store.get('log', { type: 'json' })) || [];
  return json(200, { log: log });
};
