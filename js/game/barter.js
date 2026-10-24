/**
 * Barter (v0.6.3) — kirim item antar pemain, satu arah.
 *
 * Spek terkunci user 2026-10-23:
 * - Kirim item langsung masuk tanpa persetujuan penerima.
 * - Item saja — Rupiah & Kredit tidak bisa dikirim.
 * - Pengirim & penerima harus sama-sama online dan berada di
 *   wilayah yang sama (ditegakkan server dari data presence).
 *
 * Cara kerja klien:
 * - Panel Barter menampilkan pemain online satu wilayah (dari
 *   server), pilih pemain -> pilih item -> atur jumlah -> kirim.
 *   Item dipotong dari tas SETELAH server membalas ok.
 * - Kiriman masuk diambil otomatis: polling berkala (60 detik)
 *   selama di dalam game + setiap panel dibuka. Item yang muat
 *   langsung masuk inventaris dan dikonfirmasi (ack) ke server;
 *   yang tidak muat (tas penuh) tertahan di server dan ditandai
 *   di panel sampai ada ruang.
 *
 * Berfungsi penuh hanya di deploy Netlify; di build statis panel
 * menampilkan pesan tidak dapat terhubung.
 */
const Barter = (function () {
  'use strict';

  var API_BASE = '/.netlify/functions';
  var CLAIM_MS = 60 * 1000;   // polling klaim kiriman masuk
  var PANEL_POLL_MS = 15 * 1000; // polling saat panel terbuka
  var LOG_KEY = 'extinct_survival_barter_log';
  var LOG_MAX = 20;

  var overlayId = null;
  var panelTimer = null;
  var claimTimer = null;
  var started = false;
  var claiming = false;
  var state = { region: null, players: [], blocked: [], loaded: false, error: '' };
  var view = 'players'; // 'players' | 'pick' | 'qty'
  var target = null;    // { ref, name }
  var picked = null;    // { itemId, qty } item yang akan dikirim
  var sendQty = 1;
  var sending = false;

  function ic(name) {
    return window.Icons ? Icons.svg(name) : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPid() {
    if (window.Presence && Presence.ensurePid) return Presence.ensurePid();
    try { return localStorage.getItem('extinct_survival_presence_id') || ''; }
    catch (e) { return ''; }
  }

  function notify(message, type) {
    if (window.Events) Events.emit('notify', { message: message, type: type || 'success' });
  }

  function itemName(itemId) {
    var def = window.ItemDB ? ItemDB.get(itemId) : null;
    return def ? def.name : itemId;
  }

  function itemIconSrc(itemId) {
    var def = window.ItemDB ? ItemDB.get(itemId) : null;
    return def && def.icon ? 'assets/images/items/' + def.icon : 'assets/images/items/_placeholder.png';
  }

  function itemsLabel(items) {
    return items.map(function (it) { return it.qty + 'x ' + itemName(it.itemId); }).join(', ');
  }

  // ---- riwayat lokal ----
  function loadLog() {
    try {
      var raw = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }
  function pushLog(entry) {
    try {
      var log = loadLog();
      log.unshift(entry);
      localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_MAX)));
    } catch (e) { /* abaikan */ }
  }

  // ---- komunikasi server ----
  async function apiGet() {
    var res = await fetch(API_BASE + '/barter?pid=' + encodeURIComponent(getPid()));
    var data = await res.json().catch(function () { return null; });
    if (!res.ok || !data || !data.ok) {
      throw new Error((data && data.error) || ('HTTP ' + res.status));
    }
    return data;
  }

  async function apiPost(payload) {
    var res = await fetch(API_BASE + '/barter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ pid: getPid() }, payload))
    });
    var data = await res.json().catch(function () { return null; });
    return { ok: res.ok && !!data && !!data.ok, status: res.status, data: data || {} };
  }

  // Cek apakah kiriman muat di tas: item jenis baru butuh slot
  // kosong; menumpuk jenis yang sudah ada selalu muat.
  function canFit(delivery) {
    if (!window.Inventory || !window.Player) return false;
    var inv = Inventory.getInventory();
    var maxSlots = Player.getDerivedStats().maxInventorySlots;
    var used = inv.length;
    var owned = {};
    inv.forEach(function (e) { owned[e.itemId] = true; });
    for (var i = 0; i < delivery.items.length; i++) {
      var it = delivery.items[i];
      var def = window.ItemDB ? ItemDB.get(it.itemId) : null;
      if (!def) continue; // item tak dikenal: dilewati, tetap di-ack
      if (owned[it.itemId]) continue;
      if (used >= maxSlots) return false;
      used++;
      owned[it.itemId] = true;
    }
    return true;
  }

  // Ambil kiriman masuk: klaim yang muat, ack ke server, kembalikan
  // daftar yang tertahan (tas penuh).
  async function claimDeliveries(deliveries, silent) {
    var blocked = [];
    var ackIds = [];
    var inGame = window.GameState && GameState.get() && GameState.get().player;
    (deliveries || []).forEach(function (d) {
      if (!inGame || !canFit(d)) { blocked.push(d); return; }
      d.items.forEach(function (it) {
        var def = window.ItemDB ? ItemDB.get(it.itemId) : null;
        if (def) Inventory.addItem(it.itemId, it.qty);
      });
      ackIds.push(d.id);
      pushLog({ dir: 'in', name: d.fromName, items: d.items, ts: Date.now() });
      notify('Barter masuk dari ' + d.fromName + ': ' + itemsLabel(d.items));
    });
    if (ackIds.length) {
      await apiPost({ action: 'ack', ids: ackIds }).catch(function () { return null; });
    }
    return blocked;
  }

  // Satu siklus: ambil state server + klaim kiriman masuk.
  async function syncNow(silent) {
    if (claiming) return;
    claiming = true;
    try {
      var data = await apiGet();
      state.region = data.region;
      state.players = Array.isArray(data.players) ? data.players : [];
      state.blocked = await claimDeliveries(data.deliveries || [], silent);
      state.loaded = true;
      state.error = '';
    } catch (e) {
      state.error = 'Tidak dapat terhubung ke server barter.';
    } finally {
      claiming = false;
    }
    if (overlayId) renderPanel();
  }

  // ---- render panel ----
  function panelEl() {
    var root = document.getElementById('overlay-root');
    if (!root || !overlayId) return null;
    var panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
    return panel && panel.querySelector('#barter-body') ? panel : null;
  }

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function renderPlayersHtml() {
    var html = '';
    if (state.error && !state.loaded) {
      html += '<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:14px 0;">' + escapeHtml(state.error) + '<br>Barter hanya aktif di versi Netlify.</p>';
    }
    if (state.blocked.length) {
      html += '<div class="friend-section">KIRIMAN MENUNGGU</div>';
      html += state.blocked.map(function (d) {
        return '<div class="card online-row"><div class="online-row-main"><div>'
          + '<div class="location-name" style="font-size:13px;">Dari ' + escapeHtml(d.fromName) + '</div>'
          + '<p class="location-desc" style="margin:2px 0 0;">' + escapeHtml(itemsLabel(d.items)) + ' — tertahan, tasmu penuh.</p>'
          + '</div></div></div>';
      }).join('');
      html += '<button class="action-btn secondary" id="barter-retry">Coba Ambil Lagi</button>';
    }

    html += '<div class="friend-section">PEMAIN DI WILAYAHMU' + (state.region ? ' — ' + escapeHtml(state.region).toUpperCase() : '') + '</div>';
    if (!state.loaded) {
      html += '<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:10px 0;">Memuat...</p>';
    } else if (!state.players.length) {
      html += '<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:10px 0;">Tidak ada pemain lain yang online di wilayahmu saat ini.</p>';
    } else {
      html += state.players.map(function (pl) {
        return '<div class="card online-row">'
          + '<div class="online-row-main"><span class="online-dot"></span><div>'
          + '<div class="location-name" style="font-size:13px;">' + escapeHtml(pl.name) + '</div>'
          + '<p class="location-desc" style="margin:2px 0 0;">Lv.' + pl.level + (pl.power != null ? ' • Power ' + pl.power : '') + (pl.faction ? ' • Faksi ' + escapeHtml(pl.faction) : '') + '</p>'
          + '</div></div>'
          + '<button class="action-btn barter-send-open" data-ref="' + escapeHtml(pl.ref) + '" data-name="' + escapeHtml(pl.name) + '" style="width:auto; margin-top:0; padding:7px 14px;">Kirim</button>'
          + '</div>';
      }).join('');
    }

    var log = loadLog().slice(0, 8);
    if (log.length) {
      html += '<div class="friend-section">RIWAYAT BARTER</div>';
      html += log.map(function (en) {
        var arrow = en.dir === 'in' ? 'Masuk dari ' : 'Keluar ke ';
        return '<div class="barter-log-row"><span>' + escapeHtml(arrow + en.name) + ' — ' + escapeHtml(itemsLabel(en.items)) + '</span><span class="barter-log-time">' + fmtTime(en.ts) + '</span></div>';
      }).join('');
    }

    html += '<button class="action-btn secondary" id="barter-refresh">Perbarui</button>';
    return html;
  }

  function renderPickHtml() {
    var inv = window.Inventory ? Inventory.getInventory() : [];
    var rows = inv.length ? inv.map(function (e) {
      return '<div class="card online-row barter-pick-row" data-item="' + escapeHtml(e.itemId) + '" style="cursor:pointer;">'
        + '<div class="online-row-main"><img class="barter-item-img" src="' + escapeHtml(itemIconSrc(e.itemId)) + '" onerror="this.onerror=null;this.src=\'assets/images/items/_placeholder.png\';" alt="">'
        + '<div><div class="location-name" style="font-size:13px;">' + escapeHtml(itemName(e.itemId)) + '</div>'
        + '<p class="location-desc" style="margin:2px 0 0;">Kamu punya ' + e.qty + '</p></div></div>'
        + '<span class="online-level">Pilih</span></div>';
    }).join('') : '<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:12px 0;">Tasmu kosong, tidak ada yang bisa dikirim.</p>';
    return '<div class="friend-section">PILIH ITEM UNTUK ' + escapeHtml((target ? target.name : '')).toUpperCase() + '</div>'
      + rows
      + '<button class="action-btn secondary" id="barter-back">Kembali</button>';
  }

  function renderQtyHtml() {
    var owned = 0;
    if (window.Inventory) {
      var entry = Inventory.getInventory().find(function (e) { return e.itemId === picked; });
      owned = entry ? entry.qty : 0;
    }
    return '<div class="friend-section">ATUR JUMLAH</div>'
      + '<div class="card online-row"><div class="online-row-main"><img class="barter-item-img" src="' + escapeHtml(itemIconSrc(picked)) + '" onerror="this.onerror=null;this.src=\'assets/images/items/_placeholder.png\';" alt="">'
      + '<div><div class="location-name" style="font-size:13px;">' + escapeHtml(itemName(picked)) + '</div>'
      + '<p class="location-desc" style="margin:2px 0 0;">Untuk ' + escapeHtml(target ? target.name : '') + ' • Kamu punya ' + owned + '</p></div></div></div>'
      + '<div class="barter-stepper">'
      + '<button class="action-btn secondary barter-step-btn" id="barter-minus">−</button>'
      + '<input type="number" id="barter-qty-input" min="1" max="' + owned + '" value="' + sendQty + '">'
      + '<button class="action-btn secondary barter-step-btn" id="barter-plus">+</button>'
      + '<button class="action-btn secondary barter-step-btn" id="barter-max" style="width:auto;">MAX</button>'
      + '</div>'
      + '<input type="range" id="barter-qty-range" min="1" max="' + Math.max(1, owned) + '" value="' + sendQty + '" style="width:100%;">'
      + '<button class="action-btn" id="barter-do-send" ' + (sending ? 'disabled' : '') + '>' + (sending ? 'Mengirim...' : 'Kirim ' + sendQty + ' ke ' + escapeHtml(target ? target.name : '')) + '</button>'
      + '<button class="action-btn secondary" id="barter-back">Kembali</button>';
  }

  function renderPanel() {
    var panel = panelEl();
    if (!panel) return;
    var body = view === 'pick' ? renderPickHtml() : view === 'qty' ? renderQtyHtml() : renderPlayersHtml();
    panel.querySelector('#barter-body').innerHTML = body;
    bindPanelEvents(panel);
  }

  function renderPanelHtml() {
    return '<div class="overlay-header">'
      + '<span class="overlay-title">' + ic('gift') + ' Barter</span>'
      + '<button class="overlay-close-btn" id="barter-close">' + ic('x') + '</button>'
      + '</div>'
      + '<p style="font-size:11px; color:var(--text-dim); line-height:1.6; margin:0 0 6px;">Kirim item langsung ke pemain yang sedang online di wilayah yang sama denganmu. Item langsung masuk ke tas penerima. Uang dan kredit tidak bisa dikirim.</p>'
      + '<div id="barter-body">' + renderPlayersHtml() + '</div>';
  }

  // ---- kirim ----
  async function doSend() {
    if (sending || !target || !picked) return;
    var entry = Inventory.getInventory().find(function (e) { return e.itemId === picked; });
    var owned = entry ? entry.qty : 0;
    if (owned < sendQty) { notify('Jumlah melebihi isi tasmu.', 'error'); return; }
    sending = true;
    renderPanel();
    try {
      var r = await apiPost({ action: 'send', ref: target.ref, items: [{ itemId: picked, qty: sendQty }] });
      if (!r.ok) {
        notify(r.data.error || 'Gagal mengirim barter.', 'error');
        return;
      }
      // Server ok -> potong dari tas pengirim.
      Inventory.removeItem(picked, sendQty);
      pushLog({ dir: 'out', name: target.name, items: [{ itemId: picked, qty: sendQty }], ts: Date.now() });
      notify('Barter terkirim ke ' + target.name + ': ' + sendQty + 'x ' + itemName(picked));
      view = 'players';
      target = null;
      picked = null;
      syncNow(true);
    } catch (e) {
      notify('Tidak dapat terhubung ke server barter.', 'error');
    } finally {
      sending = false;
      renderPanel();
    }
  }

  // ---- event panel ----
  function bindPanelEvents(panel) {
    var closeBtn = panel.querySelector('#barter-close');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', close);
    }
    panel.querySelectorAll('.barter-send-open').forEach(function (btn) {
      btn.addEventListener('click', function () {
        target = { ref: btn.dataset.ref, name: btn.dataset.name };
        view = 'pick';
        renderPanel();
      });
    });
    var refresh = panel.querySelector('#barter-refresh');
    if (refresh) refresh.addEventListener('click', function () { syncNow(true); });
    var retry = panel.querySelector('#barter-retry');
    if (retry) retry.addEventListener('click', function () { syncNow(true); });
    var back = panel.querySelector('#barter-back');
    if (back) back.addEventListener('click', function () {
      view = view === 'qty' ? 'pick' : 'players';
      renderPanel();
    });
    panel.querySelectorAll('.barter-pick-row').forEach(function (row) {
      row.addEventListener('click', function () {
        picked = row.dataset.item;
        sendQty = 1;
        view = 'qty';
        renderPanel();
      });
    });
    if (view === 'qty') {
      var input = panel.querySelector('#barter-qty-input');
      var range = panel.querySelector('#barter-qty-range');
      var entry = window.Inventory ? Inventory.getInventory().find(function (e) { return e.itemId === picked; }) : null;
      var owned = entry ? entry.qty : 1;
      function setQty(v) {
        sendQty = Math.max(1, Math.min(owned, Math.floor(Number(v) || 1)));
        if (input) input.value = sendQty;
        if (range) range.value = sendQty;
        var sendBtn = panel.querySelector('#barter-do-send');
        if (sendBtn) sendBtn.textContent = 'Kirim ' + sendQty + ' ke ' + (target ? target.name : '');
      }
      if (input) input.addEventListener('input', function () { setQty(input.value); });
      if (range) range.addEventListener('input', function () { setQty(range.value); });
      var minus = panel.querySelector('#barter-minus');
      if (minus) minus.addEventListener('click', function () { setQty(sendQty - 1); });
      var plus = panel.querySelector('#barter-plus');
      if (plus) plus.addEventListener('click', function () { setQty(sendQty + 1); });
      var max = panel.querySelector('#barter-max');
      if (max) max.addEventListener('click', function () { setQty(owned); });
      var send = panel.querySelector('#barter-do-send');
      if (send) send.addEventListener('click', doSend);
    }
  }

  function open() {
    view = 'players';
    target = null;
    picked = null;
    overlayId = OverlayManager.open(renderPanelHtml(), { closeOnBackdrop: true, onClose: close });
    var root = document.getElementById('overlay-root');
    requestAnimationFrame(function () {
      var panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (panel) bindPanelEvents(panel);
    });
    if (panelTimer) clearInterval(panelTimer);
    panelTimer = setInterval(function () { if (overlayId) syncNow(true); }, PANEL_POLL_MS);
    syncNow(true);
  }

  function close() {
    if (panelTimer) { clearInterval(panelTimer); panelTimer = null; }
    if (overlayId) {
      var id = overlayId;
      overlayId = null;
      OverlayManager.close(id);
    }
  }

  function start() {
    if (started) return;
    started = true;
    claimTimer = setInterval(function () { syncNow(true); }, CLAIM_MS);
    setTimeout(function () { syncNow(true); }, 5000);
  }

  return { open: open, close: close, start: start, syncNow: syncNow };
})();

window.Barter = Barter;
