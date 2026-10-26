/**
 * Presence (v0.5.6) — penanda pemain online.
 *
 * Keputusan user 2026-10-21: semua durasi 2 menit biar aman kuota.
 * - Heartbeat dikirim tiap 2 menit ke function `presence`.
 * - Server menganggap pemain online bila heartbeat terakhir <= 2
 *   menit (+ toleransi jaringan kecil di sisi server).
 * - Balasan heartbeat membawa daftar online terbaru, jadi UI kecil
 *   (chip "N Online" di HUD) terupdate TANPA polling tambahan.
 * - Chip diklik -> overlay daftar pemain online (nama, level,
 *   lokasi, faksi).
 *
 * Identitas: ID acak persisten per perangkat (localStorage), dibuat
 * sekali. Nama karakter hanya label tampilan (bisa sama antar
 * pemain). Berfungsi penuh hanya di deploy Netlify; di build statis
 * heartbeat gagal diam-diam dan chip tetap tersembunyi.
 */
const Presence = (function () {
  'use strict';

  var API_BASE = '/.netlify/functions';
  var PID_KEY = 'extinct_survival_presence_id';
  var HEARTBEAT_MS = 2 * 60 * 1000; // 2 menit (keputusan user)
  var PID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var PID_LEN = 16;

  var timer = null;
  var started = false;
  var lastPingAt = 0;
  var cache = { onlineCount: 0, players: [], serverTime: 0 };
  var listOverlayId = null;
  // v0.7.0: mode Firebase RTDB (aktif bila config terisi + SDK jalan).
  // Bila tidak aktif, semua fungsi di bawah fallback ke Netlify lama.
  var fbMode = false;
  var fbUnsub = null;

  function ic(name) {
    return window.Icons ? Icons.svg(name) : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPid() {
    try { return localStorage.getItem(PID_KEY) || null; }
    catch (e) { return null; }
  }
  function setPid(pid) {
    try { localStorage.setItem(PID_KEY, pid); } catch (e) { /* abaikan */ }
  }
  function ensurePid() {
    var pid = getPid();
    if (pid) return pid;
    var out = '';
    var buf = new Uint32Array(PID_LEN);
    if (window.crypto && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      for (var i = 0; i < PID_LEN; i++) out += PID_ALPHABET[buf[i] % PID_ALPHABET.length];
    } else {
      for (var j = 0; j < PID_LEN; j++) out += PID_ALPHABET[Math.floor(Math.random() * PID_ALPHABET.length)];
    }
    pid = out.match(/.{1,4}/g).join('-');
    setPid(pid);
    return pid;
  }

  function getFirstSeen() {
    try {
      var v = localStorage.getItem('es_presence_first_seen');
      if (v) return Number(v);
      var now = Date.now();
      localStorage.setItem('es_presence_first_seen', String(now));
      return now;
    } catch (e) { return Date.now(); }
  }

  function playerSnapshot() {
    var p = GameState.get().player;
    var locName = p.location;
    if (window.LocationDB) {
      var loc = LocationDB.get(p.location);
      if (loc && loc.name) locName = loc.name;
    }
    // v0.5.8: skor power untuk info karakter (dipakai daftar teman):
    // gabungan level + damage + pertahanan + crit + evasion.
    var power = null;
    if (window.Player && Player.getDerivedStats) {
      var d = Player.getDerivedStats();
      power = (p.level || 1) * 10 + (d.totalDamage || 0) * 5 + (d.defensePct || 0) * 2 + (d.critChance || 0) + (d.evasionChance || 0);
    }
    return {
      pid: ensurePid(),
      name: p.name,
      level: p.level,
      power: power,
      faction: p.faction || null,
      location: locName,
      appVersion: window.APP_VERSION || null,
      firstSeen: getFirstSeen()
    };
  }

  function updateChip() {
    var chip = document.getElementById('hud-online');
    var countEl = document.getElementById('hud-online-count');
    if (!chip || !countEl) return;
    chip.classList.remove('hidden');
    countEl.textContent = cache.onlineCount + ' Online';
    chip.title = cache.onlineCount + ' pemain online — tap untuk lihat daftar';
  }

  function applyResponse(data) {
    if (!data || !data.ok) return false;
    cache = {
      onlineCount: data.onlineCount || 0,
      players: Array.isArray(data.players) ? data.players : [],
      serverTime: data.serverTime || Date.now()
    };
    updateChip();
    return true;
  }

  function applyFirebaseData(data) {
    if (!data) return false;
    cache = {
      onlineCount: data.onlineCount || 0,
      players: Array.isArray(data.players) ? data.players : [],
      serverTime: data.serverTime || Date.now()
    };
    updateChip();
    if (listOverlayId) renderListIntoOverlay();
    return true;
  }

  async function ping() {
    lastPingAt = Date.now();
    // v0.7.0 Firebase: publish presence (bukan heartbeat Netlify).
    if (fbMode && window.ESFirebase) {
      try {
        var ok = await ESFirebase.publishPresence(playerSnapshot());
        return !!ok;
      } catch (e) { return false; }
    }
    try {
      var res = await fetch(API_BASE + '/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerSnapshot())
      });
      var data = await res.json().catch(function () { return null; });
      if (!res.ok || !applyResponse(data)) return false;
      if (listOverlayId) renderListIntoOverlay();
      return true;
    } catch (e) {
      return false; // offline / bukan Netlify — diam saja, coba lagi siklus berikut
    }
  }

  async function refreshList() {
    // v0.7.0 Firebase: listener sudah memperbarui cache realtime.
    if (fbMode) { if (listOverlayId) renderListIntoOverlay(); return; }
    try {
      var res = await fetch(API_BASE + '/presence');
      var data = await res.json().catch(function () { return null; });
      if (res.ok) applyResponse(data);
    } catch (e) { /* abaikan */ }
  }

  // ---- UI daftar pemain online (overlay) ----

  function agoLabel(lastSeen) {
    var sec = Math.max(0, Math.round((Date.now() - lastSeen) / 1000));
    if (sec < 60) return 'baru saja';
    var min = Math.floor(sec / 60);
    return min + ' mnt lalu';
  }

  function renderListHtml() {
    var me = GameState.get().player.name;
    var rows = cache.players.map(function (pl) {
      var isMe = pl.name === me;
      return `
        <div class="card online-row">
          <div class="online-row-main">
            <span class="online-dot"></span>
            <div>
              <div class="location-name" style="font-size:13px;">${escapeHtml(pl.name)}${isMe ? ' <span class="online-you">(Kamu)</span>' : ''}</div>
              <p class="location-desc" style="margin:2px 0 0;">${escapeHtml(pl.location || 'Tidak diketahui')}${pl.faction ? ' • Faksi ' + escapeHtml(pl.faction) : ''}</p>
            </div>
          </div>
          <div class="online-row-side">
            <span class="online-level">Lv.${pl.level}</span>
            <span class="online-ago">${agoLabel(pl.lastSeen)}</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">${ic('users')} Pemain Online</span>
        <button class="overlay-close-btn" id="onl-close">${ic('x')}</button>
      </div>
      <p style="font-size:11px; color:var(--text-dim); line-height:1.6; margin:0 0 10px;">
        ${cache.onlineCount} pemain aktif dalam 2 menit terakhir. Daftar diperbarui otomatis tiap 2 menit.
      </p>
      ${cache.players.length ? rows : '<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:14px 0;">Belum ada data pemain online. Tunggu heartbeat berikutnya.</p>'}
      <button class="action-btn secondary" id="onl-refresh">Perbarui Sekarang</button>
    `;
  }

  function renderListIntoOverlay() {
    var root = document.getElementById('overlay-root');
    if (!root) return;
    var panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
    if (!panel) return;
    panel.innerHTML = renderListHtml();
    bindListEvents(panel);
  }

  function bindListEvents(panel) {
    var closeBtn = panel.querySelector('#onl-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      OverlayManager.close(listOverlayId);
      listOverlayId = null;
    });
    var refreshBtn = panel.querySelector('#onl-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', async function () {
      refreshBtn.disabled = true;
      await ping();
      refreshBtn.disabled = false;
    });
  }

  function openList() {
    listOverlayId = OverlayManager.open(renderListHtml(), { closeOnBackdrop: true });
    var root = document.getElementById('overlay-root');
    requestAnimationFrame(function () {
      var panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (panel) bindListEvents(panel);
    });
    // Segarkan data saat daftar dibuka (tetap hemat: 1 panggilan).
    refreshList().then(function () { if (listOverlayId) renderListIntoOverlay(); });
  }

  function startNetlify() {
    ping();
    timer = setInterval(ping, HEARTBEAT_MS);
  }

  function start() {
    if (started) return;
    started = true;
    var chip = document.getElementById('hud-online');
    if (chip) chip.addEventListener('click', openList);
    // Pulang ke tab/aplikasi setelah lama di-background: ping sekali
    // (dijaga jeda minimal 60 detik supaya tidak spam).
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Date.now() - lastPingAt >= 60 * 1000) ping();
    });
    // v0.7.0: coba Firebase dulu; gagal/konfigurasi kosong -> Netlify.
    if (window.ESFirebase && ESFirebase.isConfigured()) {
      ESFirebase.init().then(function (ok) {
        if (ok && ESFirebase.isEnabled()) {
          fbMode = true;
          fbUnsub = ESFirebase.onPresence(applyFirebaseData);
          ping();
          timer = setInterval(ping, HEARTBEAT_MS);
        } else {
          startNetlify();
        }
      }).catch(function () { startNetlify(); });
    } else {
      startNetlify();
    }
  }

  function getCache() {
    return cache;
  }

  return { start: start, ping: ping, openList: openList, getCache: getCache, ensurePid: ensurePid, HEARTBEAT_MS: HEARTBEAT_MS, isFirebaseMode: function () { return fbMode; } };
})();

window.Presence = Presence;
