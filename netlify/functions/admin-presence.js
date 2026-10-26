/**
 * Admin Presence (v0.5.6) — monitoring pemain untuk dashboard admin.
 *
 * GET /.netlify/functions/admin-presence  (header x-admin-password)
 * -> semua pemain yang terlihat dalam 24 jam terakhir, terbaru dulu:
 *    yang online (heartbeat <= 2 menit + toleransi) ditandai online,
 *    lengkap dengan lastSeen & detik sejak aktif terakhir — bahan
 *    monitoring di panel admin topup.
 */
const { isAdminAuthorized } = require('./utils/auth');
const { json } = require('./utils/response');
const { getPresenceStore } = require('./utils/blob-store');
const { isOnline } = require('./utils/presence');
const { getPresenceRecords } = require('./utils/presence-source');

const RECENT_MS = 24 * 60 * 60 * 1000;
const MAX_LIST = 300;

exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  const store = getPresenceStore();
  const now = Date.now();
  const records = await getPresenceRecords(store, now);

  const players = records
    .filter(r => now - r.lastSeen <= RECENT_MS)
    .slice(0, MAX_LIST)
    .map(r => ({
      name: r.name,
      level: r.level,
      faction: r.faction || null,
      location: r.location || '',
      appVersion: r.appVersion || null,
      firstSeen: r.firstSeen || r.lastSeen,
      lastSeen: r.lastSeen,
      agoSec: Math.max(0, Math.round((now - r.lastSeen) / 1000)),
      online: isOnline(r, now)
    }));

  return json(200, {
    ok: true,
    serverTime: now,
    onlineCount: players.filter(p => p.online).length,
    recentCount: players.length,
    players
  });
};
