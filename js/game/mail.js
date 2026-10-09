/**
 * Mail (v0.3.5) — inbox kiriman dari admin, ala game pada umumnya.
 *
 * Menggantikan auto-apply diam-diam (CreditSync v0.3.3): kiriman kredit
 * manual dari admin kini masuk sebagai MAIL yang harus di-KLAIM player
 * lewat Menu -> Mail. Ini juga jadi "backup" resmi untuk topup yang
 * gagal/nyangkut — admin tinggal kirim mail kompensasi.
 *
 * - fetchMails(): ambil grant yang belum diklaim (key = kode save cloud).
 * - open(): overlay daftar mail + tombol Klaim per mail.
 * - claim(id): tambah kredit lokal -> ack ke server -> refresh daftar.
 * - start(): cek berkala untuk badge jumlah mail belum dibaca.
 */
const Mail = (function () {
  'use strict';

  var API_BASE = '/.netlify/functions';
  var POLL_MS = 60000;
  var handle = null;
  var currentOverlayId = null;
  var panelEl = null;
  var unreadCount = 0;

  function ic(name) {
    return window.Icons ? Icons.svg(name) : '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getCode() {
    return (window.CloudSave && CloudSave.getCode && CloudSave.getCode()) || null;
  }

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  async function fetchMails() {
    var code = getCode();
    if (!code) return { noCode: true, mails: [] };
    try {
      var res = await fetch(API_BASE + '/credit-pending?who=' + encodeURIComponent(code));
      if (!res.ok) return { mails: [] };
      var data = await res.json().catch(function () { return {}; });
      return { mails: (data && data.grants) || [] };
    } catch (e) {
      return { mails: [] }; // offline / bukan Netlify -> diam
    }
  }

  function renderMailItem(m) {
    var kredit = parseInt(m.kredit, 10) || 0;
    return '' +
      '<div class="card mail-item">' +
        '<div class="mail-head"><b>' + esc(m.title || 'Kiriman dari Admin') + '</b>' +
        '<span class="mail-time">' + esc(fmtTime(m.createdAt)) + '</span></div>' +
        (m.note ? '<p class="mail-body">' + esc(m.note) + '</p>' : '') +
        '<div class="mail-foot">' +
          '<span class="mail-kredit">' + ic('gem') + ' +' + kredit.toLocaleString('id-ID') + ' Kredit</span>' +
          '<button class="action-btn mail-claim-btn" data-claim="' + esc(m.id) + '">Klaim</button>' +
        '</div>' +
      '</div>';
  }

  function renderPanel(mails, noCode) {
    var body;
    if (noCode) {
      body = '<div class="card" style="text-align:center; padding:24px 12px;">' +
        '<p style="font-size:13px; margin-bottom:6px;">Mail butuh kode save.</p>' +
        '<p style="font-size:11px; color:var(--text-dim);">Buka Menu → Simpan Online dulu supaya admin bisa mengirimi kamu mail.</p></div>';
    } else if (!mails.length) {
      body = '<div class="empty-mail">' + ic('mail') + '<p>Tidak ada mail.<br>Kiriman dari admin akan muncul di sini.</p></div>';
    } else {
      body = mails.map(renderMailItem).join('');
    }
    return '' +
      '<div class="overlay-header">' +
        '<span class="overlay-title">' + ic('mail') + ' Mail</span>' +
        '<button class="overlay-close-btn" id="mail-close">✕</button>' +
      '</div>' + body;
  }

  function redraw(mails, noCode) {
    if (!panelEl) return;
    panelEl.innerHTML = renderPanel(mails, noCode);
    bindPanelEvents(panelEl);
  }

  function bindPanelEvents(panel) {
    var closeBtn = panel.querySelector('#mail-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { OverlayManager.close(currentOverlayId); });
    panel.querySelectorAll('[data-claim]').forEach(function (btn) {
      btn.addEventListener('click', function () { claim(btn.dataset.claim, btn); });
    });
  }

  async function claim(id, btn) {
    var code = getCode();
    if (!code) return;
    btn.disabled = true;
    btn.textContent = 'Mengklaim...';
    try {
      var res = await fetch(API_BASE + '/credit-pending?who=' + encodeURIComponent(code));
      var data = await res.json().catch(function () { return {}; });
      var mail = ((data && data.grants) || []).filter(function (g) { return g.id === id; })[0];
      if (!mail) throw new Error('Mail sudah tidak tersedia.');
      var k = parseInt(mail.kredit, 10) || 0;
      if (k > 0 && window.GameState) {
        GameState.get().player.currency.kredit += k;
        GameState.save();
      }
      await fetch(API_BASE + '/credit-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ who: code, ids: [id] })
      });
      if (window.Events) {
        Events.emit('player:updated');
        Events.emit('notify', { message: 'Mail diklaim! +' + k.toLocaleString('id-ID') + ' Kredit masuk.' });
      }
      var fresh = await fetchMails();
      setUnread(fresh.mails.length);
      redraw(fresh.mails, fresh.noCode);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Klaim';
      if (window.Events) Events.emit('notify', { message: e.message || 'Gagal klaim, coba lagi.', type: 'error' });
    }
  }

  function setUnread(n) {
    var prev = unreadCount;
    unreadCount = n;
    paintBadge();
    if (n > prev && window.Events) {
      Events.emit('notify', { message: 'Ada mail baru dari admin! Buka Menu → Mail.' });
    }
  }

  // Gambar ulang badge di pill mail bila flyout sedang terbuka.
  function paintBadge() {
    var pill = document.querySelector('[data-flyout-action="mail"]');
    if (!pill) return;
    var b = pill.querySelector('.flyout-badge');
    if (unreadCount > 0) {
      if (!b) {
        b = document.createElement('span');
        b.className = 'flyout-badge';
        pill.appendChild(b);
      }
      b.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      b.style.display = 'flex';
    } else if (b) {
      b.style.display = 'none';
    }
  }

  async function check() {
    var r = await fetchMails();
    if (!r.noCode) setUnread(r.mails.length);
  }

  function open() {
    currentOverlayId = OverlayManager.open(
      '<p style="text-align:center; padding:20px 0; font-size:12px; color:var(--text-dim);">Memuat mail...</p>',
      { closeOnBackdrop: true }
    );
    var root = document.getElementById('overlay-root');
    requestAnimationFrame(async function () {
      panelEl = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (!panelEl) return;
      var r = await fetchMails();
      setUnread(r.mails.length);
      redraw(r.mails, r.noCode);
    });
  }

  function start() {
    if (handle) return;
    check();
    handle = setInterval(check, POLL_MS);
  }

  return {
    open: open,
    start: start,
    check: check,
    paintBadge: paintBadge,
    get unreadCount() { return unreadCount; }
  };
})();

window.Mail = Mail;
