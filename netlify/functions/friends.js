/**
 * Friends (v0.5.8) — pertemanan antar pemain.
 *
 * GET  /.netlify/functions/friends?pid=<PID>
 *   -> state: { friends[], incoming[], outgoing[] } (profil dari
 *      presence, dirujuk via ref hash — PID pemain lain tidak
 *      pernah terekspos).
 * POST /.netlify/functions/friends  { pid, action, ... }
 *   action 'search'  { query }  cari pemain berdasarkan username
 *                               (dari direktori presence).
 *   action 'request' { ref }    kirim permintaan; bila target sudah
 *                               lebih dulu meminta -> auto-terima.
 *   action 'accept'  { ref }    terima permintaan masuk.
 *   action 'reject'  { ref }    tolak permintaan masuk.
 *   action 'cancel'  { ref }    batalkan permintaan terkirim.
 *   action 'remove'  { ref }    hapus pertemanan (kedua sisi).
 * Semua POST membalas state terbaru.
 */
const { json } = require('./utils/response');
const { getFriendsStore, getPresenceStore } = require('./utils/blob-store');
const { cleanText, cleanPid, isOnline } = require('./utils/presence');
const { getPresenceRecords } = require('./utils/presence-source');
const F = require('./utils/friends');

const MAX_BODY_BYTES = 2048;
const MAX_SEARCH_RESULTS = 10;

async function buildContext(store, presenceStore, pid) {
  const now = Date.now();
  const records = await getPresenceRecords(presenceStore, now);
  const byPid = new Map(records.map(r => [r.pid, r]));
  const [friends, reqIn, reqOut] = await Promise.all([
    F.loadFriends(store, pid),
    F.loadReqIn(store, pid),
    F.loadReqOut(store, pid)
  ]);
  return { now, records, byPid, friends, reqIn, reqOut };
}

function profileOrFallback(ctx, targetPid, snapshotName) {
  const rec = ctx.byPid.get(targetPid);
  if (rec) return F.profileOf(rec, ctx.now, isOnline);
  // Record presence sudah kedaluwarsa: tetap tampilkan dari snapshot.
  return {
    ref: F.refOf(targetPid),
    name: snapshotName || 'Pemain',
    level: null,
    power: null,
    faction: null,
    location: '',
    lastSeen: null,
    online: false
  };
}

function buildState(ctx, pid) {
  return {
    ok: true,
    serverTime: ctx.now,
    friends: ctx.friends.map(f => profileOrFallback(ctx, f.pid, f.name)),
    incoming: ctx.reqIn.map(r => Object.assign(profileOrFallback(ctx, r.fromPid, r.fromName), { ts: r.ts })),
    outgoing: ctx.reqOut.map(r => Object.assign(profileOrFallback(ctx, r.toPid, r.toName), { ts: r.ts }))
  };
}

// Cari PID dari ref: utamakan direktori presence, lalu relasi sendiri.
function resolveRef(ctx, pid, ref) {
  const hit = ctx.records.find(r => F.refOf(r.pid) === ref);
  if (hit) return hit.pid;
  const relPids = [
    ...ctx.friends.map(f => f.pid),
    ...ctx.reqIn.map(r => r.fromPid),
    ...ctx.reqOut.map(r => r.toPid)
  ];
  return relPids.find(p => F.refOf(p) === ref) || null;
}

async function addFriendship(store, ctx, pidA, nameA, pidB, nameB) {
  const listA = await F.loadFriends(store, pidA);
  if (!listA.some(f => f.pid === pidB)) listA.push({ pid: pidB, name: nameB });
  await F.saveFriends(store, pidA, listA);
  const listB = await F.loadFriends(store, pidB);
  if (!listB.some(f => f.pid === pidA)) listB.push({ pid: pidA, name: nameA });
  await F.saveFriends(store, pidB, listB);
}

async function removeRequestPair(store, fromPid, toPid) {
  const reqIn = await F.loadReqIn(store, toPid);
  await F.saveReqIn(store, toPid, reqIn.filter(r => r.fromPid !== fromPid));
  const reqOut = await F.loadReqOut(store, fromPid);
  await F.saveReqOut(store, fromPid, reqOut.filter(r => r.toPid !== toPid));
}

exports.handler = async (event) => {
  const store = getFriendsStore();
  const presenceStore = getPresenceStore();

  if (event.httpMethod === 'GET') {
    const pid = cleanPid((event.queryStringParameters || {}).pid);
    if (!pid) return json(400, { error: 'ID pemain tidak valid.' });
    const ctx = await buildContext(store, presenceStore, pid);
    return json(200, buildState(ctx, pid));
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
  const ctx = await buildContext(store, presenceStore, pid);
  const myRec = ctx.byPid.get(pid);
  const myName = myRec ? myRec.name : 'Pemain';

  // ---------- cari pemain ----------
  if (action === 'search') {
    const query = cleanText(payload.query, 24).toLowerCase();
    if (query.length < 2) return json(400, { error: 'Ketik minimal 2 huruf untuk mencari.' });
    const friendPids = new Set(ctx.friends.map(f => f.pid));
    const inPids = new Set(ctx.reqIn.map(r => r.fromPid));
    const outPids = new Set(ctx.reqOut.map(r => r.toPid));
    const results = ctx.records
      .filter(r => r.pid !== pid && r.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const exactA = a.name.toLowerCase() === query ? 0 : 1;
        const exactB = b.name.toLowerCase() === query ? 0 : 1;
        if (exactA !== exactB) return exactA - exactB;
        const onA = isOnline(a, ctx.now) ? 0 : 1;
        const onB = isOnline(b, ctx.now) ? 0 : 1;
        if (onA !== onB) return onA - onB;
        return b.lastSeen - a.lastSeen;
      })
      .slice(0, MAX_SEARCH_RESULTS)
      .map(r => Object.assign(F.profileOf(r, ctx.now, isOnline), {
        relation: friendPids.has(r.pid) ? 'friend'
          : inPids.has(r.pid) ? 'incoming'
          : outPids.has(r.pid) ? 'outgoing' : 'none'
      }));
    return json(200, { ok: true, results });
  }

  // Semua aksi lain butuh ref target yang valid.
  const ref = String(payload.ref || '');
  if (!/^[a-f0-9]{12}$/.test(ref)) return json(400, { error: 'Referensi pemain tidak valid.' });
  const targetPid = resolveRef(ctx, pid, ref);
  if (!targetPid) return json(404, { error: 'Pemain tidak ditemukan.' });
  if (targetPid === pid) return json(400, { error: 'Tidak bisa memproses diri sendiri.' });
  const targetRec = ctx.byPid.get(targetPid);
  const targetName = targetRec ? targetRec.name : 'Pemain';

  // ---------- kirim permintaan ----------
  if (action === 'request') {
    if (ctx.friends.some(f => f.pid === targetPid)) {
      return json(409, { error: 'Pemain ini sudah jadi temanmu.' });
    }
    if (ctx.reqOut.some(r => r.toPid === targetPid)) {
      return json(409, { error: 'Permintaan sudah terkirim, menunggu jawaban.' });
    }
    // Target sudah lebih dulu meminta -> langsung jadi teman.
    if (ctx.reqIn.some(r => r.fromPid === targetPid)) {
      await removeRequestPair(store, targetPid, pid);
      await addFriendship(store, ctx, pid, myName, targetPid, targetName);
      const fresh = await buildContext(store, presenceStore, pid);
      return json(200, Object.assign(buildState(fresh, pid), { autoAccepted: true }));
    }
    if (ctx.reqOut.length >= F.MAX_OUTGOING) {
      return json(429, { error: 'Permintaan terkirim sudah mencapai batas (' + F.MAX_OUTGOING + ').' });
    }
    if (ctx.friends.length >= F.MAX_FRIENDS) {
      return json(429, { error: 'Daftar teman sudah penuh (' + F.MAX_FRIENDS + ').' });
    }
    const targetReqIn = await F.loadReqIn(store, targetPid);
    if (targetReqIn.length >= F.MAX_INCOMING) {
      return json(429, { error: 'Kotak permintaan pemain itu sedang penuh.' });
    }
    targetReqIn.push({ fromPid: pid, fromName: myName, ts: Date.now() });
    await F.saveReqIn(store, targetPid, targetReqIn);
    const myReqOut = await F.loadReqOut(store, pid);
    myReqOut.push({ toPid: targetPid, toName: targetName, ts: Date.now() });
    await F.saveReqOut(store, pid, myReqOut);
    const fresh = await buildContext(store, presenceStore, pid);
    return json(200, buildState(fresh, pid));
  }

  // ---------- terima permintaan ----------
  if (action === 'accept') {
    if (!ctx.reqIn.some(r => r.fromPid === targetPid)) {
      return json(404, { error: 'Permintaan tidak ditemukan.' });
    }
    if (ctx.friends.length >= F.MAX_FRIENDS) {
      return json(429, { error: 'Daftar teman sudah penuh (' + F.MAX_FRIENDS + ').' });
    }
    await removeRequestPair(store, targetPid, pid);
    await addFriendship(store, ctx, pid, myName, targetPid, targetName);
    const fresh = await buildContext(store, presenceStore, pid);
    return json(200, buildState(fresh, pid));
  }

  // ---------- tolak permintaan ----------
  if (action === 'reject') {
    if (!ctx.reqIn.some(r => r.fromPid === targetPid)) {
      return json(404, { error: 'Permintaan tidak ditemukan.' });
    }
    await removeRequestPair(store, targetPid, pid);
    const fresh = await buildContext(store, presenceStore, pid);
    return json(200, buildState(fresh, pid));
  }

  // ---------- batalkan permintaan terkirim ----------
  if (action === 'cancel') {
    if (!ctx.reqOut.some(r => r.toPid === targetPid)) {
      return json(404, { error: 'Permintaan tidak ditemukan.' });
    }
    await removeRequestPair(store, pid, targetPid);
    const fresh = await buildContext(store, presenceStore, pid);
    return json(200, buildState(fresh, pid));
  }

  // ---------- hapus teman ----------
  if (action === 'remove') {
    if (!ctx.friends.some(f => f.pid === targetPid)) {
      return json(404, { error: 'Teman tidak ditemukan.' });
    }
    await F.saveFriends(store, pid, ctx.friends.filter(f => f.pid !== targetPid));
    const targetList = await F.loadFriends(store, targetPid);
    await F.saveFriends(store, targetPid, targetList.filter(f => f.pid !== pid));
    const fresh = await buildContext(store, presenceStore, pid);
    return json(200, buildState(fresh, pid));
  }

  return json(400, { error: 'Aksi tidak dikenal.' });
};
