/**
 * ESFirebase (v0.7.0) — penghubung Firebase Realtime Database untuk
 * chat global + presence. Hosting dan semua urusan uang (top-up,
 * kredit, Play Billing, cloud save, admin top-up) TETAP di Netlify.
 *
 * Desain:
 * - Aktif HANYA bila window.ES_FIREBASE_CONFIG terisi lengkap
 *   (apiKey + databaseURL). Bila kosong/gagal load SDK, modul ini
 *   melaporkan enabled=false dan chat.js / presence.js otomatis
 *   fallback ke Netlify Functions lama. Game tidak pernah mati
 *   hanya karena Firebase belum disetup.
 * - Auth: anonymous (tanpa password/email baru). Identitas game
 *   tetap PID perangkat (localStorage), sama seperti Netlify.
 * - SDK: Firebase compat v9 lewat CDN gstatic, dimuat dinamis
 *   hanya bila config ada. Tanpa build step, sesuai gaya game ini.
 * - Presence: tulis presence/<pid>, onDisconnect().remove() supaya
 *   nama langsung hilang saat koneksi putus (lebih akurat dari
 *   jendela 2 menit Netlify). Refresh data sendiri tiap 2 menit.
 * - Chat: dengarkan chat/messages limitToLast(50). Kirim via
 *   multi-path update: pesan + chat/last/<pid> (cap cooldown).
 *   Validasi klien: maks 200 karakter, tolak tautan, samarkan kata
 *   kasar (daftar sama dengan server Netlify lama). Role SELALU
 *   'player' di mode Firebase — badge ADMIN tidak bisa diklaim
 *   dari klien; moderasi (hapus/ban) hanya lewat dashboard admin
 *   yang memanggil Netlify function + Firebase Admin SDK.
 *
 * Keamanan yang perlu diterima user (fase 1): sensor & cooldown
 * ditegakkan di klien + rules RTDB, bukan server. Pemain yang
 * memodifikasi game bisa lolos sensor, tapi admin bisa hapus/ban
 * dari dashboard. Ini trade-off yang sudah disetujui untuk v0.7.0.
 */
const ESFirebase = (function () {
  'use strict';

  var SDK_VERSION = '9.23.0';
  var COOLDOWN_MS = 15 * 1000;
  var MAX_TEXT_LEN = 200;
  var MAX_MESSAGES = 50;

  var LINK_RE = /(https?:|www\.|\.com\b|\.net\b|\.xyz\b|\.online\b|\.site\b|\.top\b|\.icu\b|\.click\b)/i;
  var BADWORDS = [
    'anjing', 'bangsat', 'babi', 'kontol', 'memek', 'ngentot', 'tolol',
    'goblok', 'bodoh', 'jancok', 'asu', 'tai', 'bajingan', 'fuck',
    'shit', 'bitch', 'dick', 'pussy', 'nigger'
  ];
  var BADWORD_RE = new RegExp('\\b(' + BADWORDS.join('|') + ')\\b', 'gi');

  var app = null;
  var db = null;
  var authReady = null;
  var initPromise = null;
  var presenceRef = null;
  var presenceListener = null;
  var chatListener = null;

  function getConfig() {
    var c = window.ES_FIREBASE_CONFIG || null;
    if (!c) return null;
    if (!c.apiKey || !c.databaseURL || !c.projectId) return null;
    return c;
  }

  function isConfigured() {
    return !!getConfig();
  }

  function maskBadwords(text) {
    return String(text).replace(BADWORD_RE, function (m) {
      return '*'.repeat(Math.max(3, m.length));
    });
  }

  function hasLink(text) {
    return LINK_RE.test(text);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Gagal memuat ' + src)); };
      document.head.appendChild(s);
    });
  }

  function init() {
    if (initPromise) return initPromise;
    initPromise = (async function () {
      var cfg = getConfig();
      if (!cfg) return false;
      try {
        if (!window.firebase || !window.firebase.apps || !window.firebase.apps.length) {
          if (!window.firebase) {
            await loadScript('https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-app-compat.js');
          }
          await loadScript('https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-auth-compat.js');
          await loadScript('https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-database-compat.js');
        }
        if (!window.firebase.apps.length) {
          app = window.firebase.initializeApp(cfg);
        } else {
          app = window.firebase.app();
        }
        db = window.firebase.database();
        authReady = window.firebase.auth().signInAnonymously()
          .then(function () { return true; })
          .catch(function () { return false; });
        var ok = await authReady;
        if (!ok) { db = null; return false; }
        return true;
      } catch (e) {
        db = null;
        return false;
      }
    })();
    return initPromise;
  }

  function isEnabled() {
    return !!db;
  }

  // ---- presence ----

  function publishPresence(snapshot) {
    if (!db || !snapshot || !snapshot.pid) return Promise.resolve(false);
    var pid = snapshot.pid;
    var data = {
      pid: pid,
      name: String(snapshot.name || '').slice(0, 24),
      level: Math.max(1, Math.min(999, Math.floor(Number(snapshot.level) || 1))),
      power: snapshot.power != null ? Math.max(0, Math.min(999999, Math.floor(Number(snapshot.power) || 0))) : null,
      faction: snapshot.faction || null,
      location: String(snapshot.location || '').slice(0, 48),
      appVersion: snapshot.appVersion || null,
      firstSeen: snapshot.firstSeen || Date.now(),
      lastSeen: Date.now()
    };
    presenceRef = db.ref('presence/' + pid);
    return presenceRef.set(data).then(function () {
      try { presenceRef.onDisconnect().remove(); } catch (e) { /* abaikan */ }
      return true;
    }).catch(function () { return false; });
  }

  function onPresence(callback) {
    if (!db) return function () {};
    if (presenceListener) { try { db.ref('presence').off('value', presenceListener); } catch (e) {} }
    presenceListener = function (snap) {
      var val = snap.val() || {};
      var players = [];
      Object.keys(val).forEach(function (pid) {
        var r = val[pid];
        if (r && r.name && r.lastSeen) players.push(r);
      });
      players.sort(function (a, b) { return b.lastSeen - a.lastSeen; });
      callback({ onlineCount: players.length, players: players.slice(0, 100), serverTime: Date.now() });
    };
    db.ref('presence').on('value', presenceListener);
    return function () {
      try { db.ref('presence').off('value', presenceListener); } catch (e) {}
      presenceListener = null;
    };
  }

  function removePresence(pid) {
    if (!db || !pid) return Promise.resolve();
    return db.ref('presence/' + pid).remove().catch(function () {});
  }

  // ---- chat ----

  function onMessages(callback) {
    if (!db) return function () {};
    if (chatListener) { try { db.ref('chat/messages').off('value', chatListener); } catch (e) {} }
    chatListener = function (snap) {
      var val = snap.val() || {};
      var msgs = [];
      Object.keys(val).forEach(function (k) {
        var m = val[k];
        if (m && m.text && m.ts) msgs.push(m);
      });
      msgs.sort(function (a, b) { return a.ts - b.ts; });
      callback(msgs.slice(-MAX_MESSAGES));
    };
    db.ref('chat/messages').orderByChild('ts').limitToLast(MAX_MESSAGES).on('value', chatListener);
    return function () {
      try { db.ref('chat/messages').off('value', chatListener); } catch (e) {}
      chatListener = null;
    };
  }

  async function sendMessage(input) {
    if (!db) return { ok: false, error: 'Firebase belum aktif.' };
    var pid = String(input.pid || '').toUpperCase().trim();
    var name = String(input.name || '').trim().slice(0, 24);
    var text = String(input.text == null ? '' : input.text).replace(/\s+/g, ' ').trim();
    if (!pid || !name) return { ok: false, error: 'ID/nama pemain tidak valid.' };
    if (!text) return { ok: false, error: 'Pesan kosong.' };
    if (text.length > MAX_TEXT_LEN) return { ok: false, error: 'Pesan terlalu panjang (maks 200 karakter).' };
    if (hasLink(text)) return { ok: false, error: 'Tautan tidak diizinkan di chat.' };
    try {
      var banSnap = await db.ref('chat/banned/' + pid).once('value');
      if (banSnap.val()) return { ok: false, error: 'Kamu diblokir dari chat oleh admin.' };
      var lastSnap = await db.ref('chat/last/' + pid).once('value');
      var last = lastSnap.val();
      var now = Date.now();
      if (typeof last === 'number' && now - last < COOLDOWN_MS) {
        var retry = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
        return { ok: false, error: 'Terlalu cepat. Tunggu ' + retry + ' detik lagi.', retryAfterSec: retry };
      }
      var clean = maskBadwords(text);
      var key = db.ref('chat/messages').push().key;
      var record = {
        id: now + '-' + pid + '-' + key.slice(-6),
        pid: pid,
        name: name,
        level: Math.max(1, Math.min(999, Math.floor(Number(input.level) || 1))),
        role: 'player',
        text: clean,
        ts: now
      };
      var updates = {};
      updates['chat/messages/' + key] = record;
      updates['chat/last/' + pid] = now;
      await db.ref().update(updates);
      // Prune best-effort: hapus pesan di luar 80 terbaru (tanpa
      // memblokir kiriman bila gagal — RTDB 1 GB masih sangat longgar).
      try {
        var allSnap = await db.ref('chat/messages').orderByChild('ts').once('value');
        var all = allSnap.val() || {};
        var keys = Object.keys(all);
        if (keys.length > 80) {
          keys.sort(function (a, b) { return (all[a].ts || 0) - (all[b].ts || 0); });
          var excess = keys.slice(0, keys.length - 80);
          var del = {};
          excess.forEach(function (k) { del['chat/messages/' + k] = null; });
          await db.ref().update(del);
        }
      } catch (e) { /* abaikan */ }
      return { ok: true, cooldownSec: COOLDOWN_MS / 1000, message: record };
    } catch (e) {
      return { ok: false, error: 'Tidak dapat terhubung ke server chat Firebase.' };
    }
  }

  return {
    isConfigured: isConfigured,
    init: init,
    isEnabled: isEnabled,
    maskBadwords: maskBadwords,
    hasLink: hasLink,
    publishPresence: publishPresence,
    onPresence: onPresence,
    removePresence: removePresence,
    onMessages: onMessages,
    sendMessage: sendMessage,
    COOLDOWN_MS: COOLDOWN_MS,
    MAX_TEXT_LEN: MAX_TEXT_LEN
  };
})();

window.ESFirebase = ESFirebase;
