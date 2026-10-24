/**
 * Hadiah Harian (v0.6.7) — kalender login 30 hari.
 *
 * Aturan (dikunci user 2026-10-24):
 * - 1x klaim per hari kalender (tanggal lokal perangkat).
 * - Hadiah utama: 1 Kredit setiap hari.
 * - Tambahan: 1 item acak (material/consumable common & uncommon)
 *   dengan quantity bertahap: hari 1-3 = x1, 4-6 = x2, ..., 28-30
 *   = x10. Setelah hari 30, kalender mengulang dari hari 1.
 * - Tidak ada reset karena bolos: hari berjalan maju tiap klaim
 *   (maaf-telat tetap lanjut, bukan ulang dari 1).
 *
 * State disimpan di objek pemain (ikut save game & cloud save):
 * p.dailyReward = { day: 1-30 (hari yang AKAN diklaim), lastDate }
 */
const DailyReward = (function () {
  'use strict';

  var TOTAL_DAYS = 30;
  var overlayId = null;
  var notifiedThisSession = false;

  function ic(name) {
    return window.Icons ? Icons.svg(name) : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPlayer() {
    return GameState.get().player;
  }

  function getState() {
    var p = getPlayer();
    if (!p.dailyReward) p.dailyReward = { day: 1, lastDate: null };
    if (!p.dailyReward.day || p.dailyReward.day < 1 || p.dailyReward.day > TOTAL_DAYS) {
      p.dailyReward.day = 1;
    }
    return p.dailyReward;
  }

  // Tanggal lokal perangkat (YYYY-MM-DD) — bukan UTC, supaya
  // pergantian hari mengikuti jam pemain.
  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function canClaim() {
    return getState().lastDate !== todayStr();
  }

  // Quantity bertahap: hari 1-3 = 1, 4-6 = 2, ..., 28-30 = 10.
  function qtyForDay(day) {
    return Math.min(10, Math.ceil(day / 3));
  }

  // Pool hadiah: material & consumable rarity common/uncommon.
  // (Senjata, armor, dan item langka tidak masuk pool harian.)
  function pickRandomItem() {
    var all = window.ItemDB ? ItemDB.all() : {};
    var pool = Object.values(all).filter(function (def) {
      return def && (def.type === 'material' || def.type === 'consumable') &&
        (def.rarity === 'common' || def.rarity === 'uncommon');
    });
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }

  function claim() {
    var p = getPlayer();
    var state = getState();
    if (!canClaim()) {
      Events.emit('notify', { message: 'Hadiah hari ini sudah diklaim. Kembali lagi besok!', type: 'error' });
      return false;
    }

    var day = state.day;
    var qty = qtyForDay(day);
    var itemId = pickRandomItem();
    var def = itemId && window.ItemDB ? ItemDB.get(itemId) : null;
    if (!def) return false;

    // Jangan hanguskan hari kalau tas penuh untuk jenis item baru.
    var inv = Inventory.getInventory();
    var owned = inv.some(function (e) { return e.itemId === itemId; });
    if (!owned) {
      var maxSlots = window.Player ? Player.getDerivedStats().maxInventorySlots : 20;
      if (inv.length >= maxSlots) {
        Events.emit('notify', { message: 'Tas penuh! Kosongkan dulu sebelum klaim hadiah harian.', type: 'error' });
        return false;
      }
    }
    if (!Inventory.addItem(itemId, qty)) return false;

    p.currency.kredit = (p.currency.kredit || 0) + 1;
    state.lastDate = todayStr();
    state.day = (day % TOTAL_DAYS) + 1; // hari 30 -> kembali ke 1
    GameState.save();
    Events.emit('notify', { message: 'Hadiah Harian hari ke-' + day + ': +1 Kredit, +' + qty + 'x ' + def.name + '!' });
    Events.emit('player:updated');
    refresh();
    return true;
  }

  function renderPanelHtml() {
    var state = getState();
    var claimable = canClaim();
    var cells = '';
    for (var d = 1; d <= TOTAL_DAYS; d++) {
      var cls = 'daily-cell';
      var mark = 'x' + qtyForDay(d);
      if (d < state.day || (!claimable && d === state.day)) cls += ' daily-claimed';
      else if (d === state.day) cls += ' daily-today';
      else cls += ' daily-locked';
      if (d < state.day || (!claimable && d === state.day)) mark = '&#10003;';
      cells += '<div class="' + cls + '"><div class="daily-cell-day">Hari ' + d + '</div><div class="daily-cell-reward">' + mark + '</div></div>';
    }

    var statusText = claimable
      ? 'Hadiah hari ke-' + state.day + ' tersedia! Klaim sekarang: +1 Kredit dan item acak x' + qtyForDay(state.day) + '.'
      : 'Hadiah hari ini sudah diklaim. Hadiah berikutnya (hari ke-' + state.day + ') bisa diklaim besok.';

    return '<div id="daily-panel">' +
      '<div class="overlay-header">' +
        '<div class="overlay-title">' + ic('sparkles') + ' Hadiah Harian</div>' +
        '<button class="overlay-close" id="daily-close" aria-label="Tutup">&times;</button>' +
      '</div>' +
      '<div class="overlay-body">' +
        '<p class="online-sub" style="margin:0 0 8px;">' + statusText + '</p>' +
        '<p class="online-sub" style="margin:0 0 10px;">Setiap hari: +1 Kredit dan 1 item acak. Jumlah item bertambah tiap 3 hari (maksimal x10 di hari 28-30), lalu kalender mengulang dari hari 1.</p>' +
        '<div class="daily-grid">' + cells + '</div>' +
        '<button class="action-btn primary" id="daily-claim" style="margin-top:12px;width:100%;"' + (claimable ? '' : ' disabled') + '>' +
          (claimable ? 'Klaim Hadiah Hari ke-' + state.day : 'Sudah Diklaim Hari Ini') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function bindPanelEvents(panel) {
    if (!panel) return;
    var closeBtn = panel.querySelector('#daily-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    var claimBtn = panel.querySelector('#daily-claim');
    if (claimBtn) claimBtn.addEventListener('click', claim);
  }

  function refresh() {
    if (!overlayId) return;
    var el = document.getElementById('daily-panel');
    if (!el) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = renderPanelHtml();
    var fresh = tmp.firstElementChild;
    el.replaceWith(fresh);
    bindPanelEvents(fresh);
  }

  function open() {
    overlayId = OverlayManager.open(renderPanelHtml(), { closeOnBackdrop: true, onClose: close });
    var root = document.getElementById('overlay-root');
    requestAnimationFrame(function () {
      var panel = root && root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      bindPanelEvents(panel || document);
    });
  }

  function close() {
    if (overlayId) {
      var id = overlayId;
      overlayId = null;
      OverlayManager.close(id);
    }
  }

  // Sekali per sesi: beri tahu pemain kalau hadiah hari ini tersedia.
  function start() {
    if (notifiedThisSession) return;
    notifiedThisSession = true;
    if (canClaim()) {
      var state = getState();
      Events.emit('notify', { message: 'Hadiah Harian hari ke-' + state.day + ' tersedia! Buka Menu -> Hadiah Harian untuk klaim.' });
    }
  }

  return { open: open, close: close, claim: claim, canClaim: canClaim, getState: getState, qtyForDay: qtyForDay, start: start, TOTAL_DAYS: TOTAL_DAYS };
})();

window.DailyReward = DailyReward;
