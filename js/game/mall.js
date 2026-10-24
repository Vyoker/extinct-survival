/**
 * Item Mall (v0.6.5) — toko premium berbasis Kredit.
 *
 * Berisi senjata api pabrikan dan pak peluru. Pembelian memotong
 * saldo Kredit pemain (currency.kredit — saldo yang sama dengan
 * hasil top up) dan memasukkan item ke inventaris. Berbeda dari
 * Shop biasa yang memakai Rupiah.
 *
 * Harga & katalog dikunci user 2026-10-24: senjata pabrikan
 * 50/100/150/200 Kredit, pak peluru murah.
 */
const Mall = (function () {
  'use strict';

  var CATALOG = [
    { itemId: 'factory_pistol', price: 50, qty: 1 },
    { itemId: 'factory_shotgun', price: 100, qty: 1 },
    { itemId: 'factory_rifle', price: 150, qty: 1 },
    { itemId: 'factory_sniper', price: 200, qty: 1 },
    { itemId: 'ammo_9mm', price: 10, qty: 50 },
    { itemId: 'ammo_556', price: 10, qty: 50 },
    { itemId: 'ammo_12gauge', price: 10, qty: 50 },
    { itemId: 'ammo_762', price: 10, qty: 50 }
  ];

  var overlayId = null;

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

  function getCatalog() {
    return CATALOG.map(function (entry) {
      return Object.assign({}, entry, { def: window.ItemDB ? ItemDB.get(entry.itemId) : null });
    }).filter(function (entry) { return entry.def; });
  }

  function buy(itemId) {
    var entry = null;
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].itemId === itemId) entry = CATALOG[i];
    if (!entry) return false;
    var def = window.ItemDB ? ItemDB.get(itemId) : null;
    if (!def) return false;

    var p = getPlayer();
    if ((p.currency.kredit || 0) < entry.price) {
      Events.emit('notify', { message: 'Kredit tidak cukup. Top up dulu lewat Menu → Top Up.', type: 'error' });
      return false;
    }

    // Item jenis baru butuh slot tas kosong (aturan sama seperti Shop).
    var inv = Inventory.getInventory();
    var alreadyOwned = inv.some(function (e) { return e.itemId === itemId; });
    if (!alreadyOwned) {
      var maxSlots = window.Player ? Player.getDerivedStats().maxInventorySlots : 20;
      if (inv.length >= maxSlots) {
        Events.emit('notify', { message: 'Tas penuh (' + maxSlots + ' slot)! Kosongkan dulu sebelum membeli.', type: 'error' });
        return false;
      }
    }

    var added = Inventory.addItem(itemId, entry.qty);
    if (!added) return false; // saldo belum dipotong
    p.currency.kredit -= entry.price;
    GameState.save();
    Events.emit('notify', { message: 'Membeli ' + (entry.qty > 1 ? entry.qty + 'x ' : '') + def.name + ' seharga ' + entry.price + ' Kredit.' });
    Events.emit('player:updated');
    refresh();
    return true;
  }

  function statLine(def, qty) {
    if (def.type === 'weapon' && def.stats) {
      var s = def.stats;
      var ammoNames = { ammo_9mm: '9mm Ammo', ammo_556: '5.56mm Ammo', ammo_12gauge: '12 Gauge Ammo', ammo_762: '7.62mm Ammo' };
      var ammoName = ammoNames[s.ammoType] || 'Peluru';
      return 'Damage ' + s.damage + ' · Jarak ' + (s.range || 1) + ' · Crit ' + (s.crit || 0) + '% · ' + ammoName;
    }
    return 'Pak isi ' + qty + ' butir';
  }

  function renderPanelHtml() {
    var p = getPlayer();
    var kredit = (p.currency && p.currency.kredit) || 0;
    // v0.6.7: baris mall memakai layout khusus (.mall-row), bukan
    // .online-row lagi — .online-row memakai space-between tanpa
    // flex:1 pada kolom info, sehingga baris dengan teks pendek
    // (pak peluru) terdorong ke kanan dan tampil berantakan.
    var rows = getCatalog().map(function (entry) {
      var def = entry.def;
      var afford = kredit >= entry.price;
      return '<div class="mall-row">' +
        (def.icon ? '<img class="mall-item-img" src="assets/images/items/' + def.icon + '" alt="">' : '') +
        '<div class="mall-info">' +
          '<div class="mall-name">' + escapeHtml(def.name) + (entry.qty > 1 ? ' <span class="mall-qty">x' + entry.qty + '</span>' : '') + '</div>' +
          '<div class="mall-sub">' + escapeHtml(statLine(def, entry.qty)) + '</div>' +
          '<div class="mall-price">' + ic('gem') + ' ' + entry.price + ' Kredit</div>' +
        '</div>' +
        '<div class="mall-actions">' +
          '<button class="mini-btn primary mall-buy" data-item="' + def.id + '"' + (afford ? '' : ' disabled') + '>Beli</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div id="mall-panel">' +
      '<div class="overlay-header">' +
        '<div class="overlay-title">' + ic('gem') + ' Item Mall</div>' +
        '<button class="overlay-close" id="mall-close" aria-label="Tutup">&times;</button>' +
      '</div>' +
      '<div class="overlay-body">' +
        '<div class="friend-section" style="margin-top:0;">KREDIT KAMU: ' + kredit.toLocaleString('id-ID') + '</div>' +
        '<p class="online-sub" style="margin:0 0 8px;">Senjata pabrikan dan peluru, dibeli dengan Kredit. Senjata rakitan tetap bisa dibuat sendiri lewat Crafting.</p>' +
        (rows || '<div class="online-empty">Katalog kosong.</div>') +
      '</div>' +
    '</div>';
  }

  function bindPanelEvents(panel) {
    if (!panel) return;
    var closeBtn = panel.querySelector('#mall-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    var btns = panel.querySelectorAll('.mall-buy');
    btns.forEach(function (b) {
      b.addEventListener('click', function () { buy(b.getAttribute('data-item')); });
    });
  }

  function refresh() {
    if (!overlayId) return;
    var el = document.getElementById('mall-panel');
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

  return { open: open, close: close, buy: buy, getCatalog: getCatalog };
})();

window.Mall = Mall;
