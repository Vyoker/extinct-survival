/**
 * Barter (v0.6.3) — kirim item antar pemain (satu arah, langsung).
 *
 * GET  /.netlify/functions/barter?pid=<PID>
 *   -> { region, players[], deliveries[] }
 *      players    : pemain online di wilayah yang sama (dirujuk
 *                   via ref hash; PID pemain lain tidak terekspos).
 *      deliveries : kiriman masuk yang menunggu diambil pemain
 *                   ini (klien mengklaimnya ke inventaris).
 * POST /.netlify/functions/barter  { pid, action, ... }
 *   action 'send' { ref, items:[{itemId, qty}] }
 *      Validasi server: pengirim & penerima online (heartbeat
 *      presence segar) dan wilayah sama; cooldown 10 detik;
 *      kotak penerima maks 20 kiriman. Item dipotong klien
 *      pengirim SETELAH server membalas ok.
 *   action 'ack'  { ids:[...] }
 *      Klien penerima mengonfirmasi kiriman yang sudah berhasil
 *      masuk inventarisnya -> dihapus dari kotak server.
 */
const { json } = require('./utils/response');
const { getBarterStore, getPresenceStore } = require('./utils/blob-store');
const { cleanPid, isOnline, listPresence } = require('./utils/presence');
const F = require('./utils/friends');
const B = require('./utils/barter');

const MAX_BODY_BYTES = 4096;

exports.handler = async (event) => {
  const store = getBarterStore();
  const presenceStore = getPresenceStore();
  const now = Date.now();

  // ---------------- GET: daftar sewilayah + kiriman masuk ----------------
  if (event.httpMethod === 'GET') {
    const pid = cleanPid((event.queryStringParameters || {}).pid);
    if (!pid) return json(400, { error: 'ID pemain tidak valid.' });

    const records = await listPresence(presenceStore, now);
    const me = records.find(r => r.pid === pid) || null;
    const myLoc = me ? (me.location || '') : '';
    const players = (me && isOnline(me, now) && myLoc)
      ? records
          .filter(r => r.pid !== pid && isOnline(r, now) && (r.location || '') === myLoc)
          .map(r => F.profileOf(r, now, isOnline))
      : [];

    const rawInbox = await B.loadInbox(store, pid);
    const deliveries = B.pruneExpired(rawInbox, now);
    // Tulis balik hanya bila ada yang dibuang (hemat operasi tulis).
    if (deliveries.length !== rawInbox.length) await B.saveInbox(store, pid, deliveries);
    const publicDeliveries = deliveries.map(d => ({
      id: d.id,
      fromName: d.fromName,
      items: d.items,
      ts: d.ts
    }));

    return json(200, {
      ok: true,
      serverTime: now,
      region: myLoc || null,
      players,
      deliveries: publicDeliveries,
      pending: publicDeliveries.length
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  if ((event.body || '').length > MAX_BODY_BYTES) return json(413, { error: 'Payload terlalu besar.' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const pid = cleanPid(payload.pid);
  if (!pid) return json(400, { error: 'ID pemain tidak valid.' });
  const action = String(payload.action || '');

  // ---------------- ACK: kiriman sudah masuk inventaris ----------------
  if (action === 'ack') {
    const ids = Array.isArray(payload.ids) ? payload.ids.map(String).slice(0, 50) : [];
    if (!ids.length) return json(400, { error: 'Tidak ada kiriman yang dikonfirmasi.' });
    const idSet = new Set(ids);
    const inbox = B.pruneExpired(await B.loadInbox(store, pid), now);
    const kept = inbox.filter(d => !idSet.has(d.id));
    if (kept.length !== inbox.length) await B.saveInbox(store, pid, kept);
    return json(200, { ok: true, remaining: kept.length });
  }

  // ---------------- SEND: kirim item ke pemain sewilayah ----------------
  if (action === 'send') {
    const ref = String(payload.ref || '');
    if (!/^[a-f0-9]{12}$/.test(ref)) return json(400, { error: 'Referensi pemain tidak valid.' });

    const items = B.cleanItems(payload.items);
    if (!items) return json(400, { error: 'Daftar item tidak valid.' });

    const records = await listPresence(presenceStore, now);
    const me = records.find(r => r.pid === pid) || null;
    if (!me || !isOnline(me, now)) {
      return json(403, { error: 'Kamu belum terdeteksi online. Tunggu sebentar lalu coba lagi.' });
    }
    const target = records.find(r => F.refOf(r.pid) === ref) || null;
    if (!target) return json(404, { error: 'Pemain tidak ditemukan.' });
    if (target.pid === pid) return json(400, { error: 'Tidak bisa mengirim ke diri sendiri.' });
    if (!isOnline(target, now)) return json(409, { error: 'Pemain itu sudah tidak online.' });
    if ((target.location || '') !== (me.location || '')) {
      return json(409, { error: 'Pemain itu tidak berada di wilayahmu.' });
    }

    // Cooldown server per pengirim (anti-spam).
    const cdKey = 'cd/' + pid + '.json';
    const cd = await store.get(cdKey, { type: 'json' }).catch(() => null);
    if (cd && typeof cd.ts === 'number') {
      const elapsed = now - cd.ts;
      if (elapsed < B.COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((B.COOLDOWN_MS - elapsed) / 1000);
        return json(429, { error: 'Terlalu cepat. Tunggu ' + retryAfterSec + ' detik lagi.', retryAfterSec });
      }
    }

    const inbox = B.pruneExpired(await B.loadInbox(store, target.pid), now);
    if (inbox.length >= B.MAX_INBOX) {
      return json(409, { error: 'Kotak barter pemain itu sedang penuh. Coba lagi nanti.' });
    }

    const rand = Math.random().toString(36).slice(2, 8);
    inbox.push({
      id: now + '-' + pid + '-' + rand,
      fromPid: pid,
      fromName: me.name,
      items,
      ts: now
    });
    await B.saveInbox(store, target.pid, inbox);
    await store.setJSON(cdKey, { ts: now });

    return json(200, { ok: true, cooldownSec: B.COOLDOWN_MS / 1000, toName: target.name });
  }

  return json(400, { error: 'Aksi tidak dikenal.' });
};
