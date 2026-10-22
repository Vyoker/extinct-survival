/**
 * Friends (v0.5.8) — pertemanan antar pemain.
 *
 * - Tambah teman pakai username: cari di direktori pemain (yang
 *   pernah online), kirim permintaan.
 * - Sistem Terima / Tolak (keputusan user): permintaan masuk harus
 *   diterima dulu sebelum jadi teman.
 * - Info karakter teman: level, power, faksi, lokasi, status
 *   online & terakhir aktif (dari presence).
 * - Hapus pertemanan tersedia di tiap baris teman (dengan
 *   konfirmasi).
 *
 * Pemain lain dirujuk lewat "ref" hash dari server — PID perangkat
 * pemain lain tidak pernah tampil di klien ini. Berfungsi penuh
 * hanya di deploy Netlify; di build statis panel menampilkan pesan
 * tidak dapat terhubung.
 */
const Friends = (function () {
  'use strict';

  var API_BASE = '/.netlify/functions';
  var overlayId = null;
  var state = { friends: [], incoming: [], outgoing: [] };
  var lastQuery = '';
  var searchResults = null;
  var busy = false;

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

  function agoLabel(lastSeen) {
    if (!lastSeen) return 'tidak diketahui';
    var sec = Math.max(0, Math.round((Date.now() - lastSeen) / 1000));
    if (sec < 60) return 'baru saja';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + ' mnt lalu';
    var jam = Math.floor(min / 60);
    if (jam < 24) return jam + ' jam lalu';
    return Math.floor(jam / 24) + ' hari lalu';
  }

  function profileMeta(p) {
    var parts = [];
    if (p.level != null) parts.push('Lv.' + p.level);
    if (p.power != null) parts.push('Power ' + Number(p.power).toLocaleString('id-ID'));
    if (p.faction) parts.push('Faksi ' + p.faction);
    return parts.join(' • ');
  }

  function profileRow(p, actionsHtml) {
    return `
      <div class="card online-row friend-row">
        <div class="online-row-main">
          <span class="online-dot${p.online ? '' : ' is-off'}"></span>
          <div>
            <div class="location-name" style="font-size:13px;">${escapeHtml(p.name)}</div>
            <p class="location-desc" style="margin:2px 0 0;">${escapeHtml(profileMeta(p))}</p>
            <p class="location-desc" style="margin:1px 0 0;">${escapeHtml(p.location || 'Lokasi tidak diketahui')} • ${p.online ? 'Online' : 'Aktif ' + agoLabel(p.lastSeen)}</p>
          </div>
        </div>
        <div class="friend-actions">${actionsHtml}</div>
      </div>`;
  }

  function renderPanelHtml() {
    var searchHtml = '';
    if (searchResults !== null) {
      searchHtml = searchResults.length === 0
        ? '<p style="font-size:11px; color:var(--text-dim); margin:6px 0 0;">Tidak ada pemain ditemukan untuk "' + escapeHtml(lastQuery) + '". Pemain harus pernah online agar bisa dicari.</p>'
        : searchResults.map(function (p) {
            var btn = p.relation === 'friend'
              ? '<span class="friend-state">Teman</span>'
              : p.relation === 'outgoing'
                ? '<span class="friend-state">Menunggu</span>'
                : p.relation === 'incoming'
                  ? '<button class="mini-btn" data-friend-action="accept" data-ref="' + p.ref + '">Terima</button>'
                  : '<button class="mini-btn" data-friend-action="request" data-ref="' + p.ref + '">Tambah</button>';
            return profileRow(p, btn);
          }).join('');
    }

    var incomingHtml = state.incoming.length === 0
      ? '<p style="font-size:11px; color:var(--text-dim);">Tidak ada permintaan masuk.</p>'
      : state.incoming.map(function (p) {
          return profileRow(p,
            '<button class="mini-btn" data-friend-action="accept" data-ref="' + p.ref + '">Terima</button>' +
            '<button class="mini-btn danger" data-friend-action="reject" data-ref="' + p.ref + '">Tolak</button>');
        }).join('');

    var outgoingHtml = state.outgoing.length === 0
      ? ''
      : '<div class="friend-section">TERKIRIM (' + state.outgoing.length + ')</div>' +
        state.outgoing.map(function (p) {
          return profileRow(p, '<button class="mini-btn danger" data-friend-action="cancel" data-ref="' + p.ref + '">Batal</button>');
        }).join('');

    var friendsHtml = state.friends.length === 0
      ? '<p style="font-size:11px; color:var(--text-dim);">Belum ada teman. Cari pemain di atas dan kirim permintaan.</p>'
      : state.friends.map(function (p) {
          return profileRow(p, '<button class="mini-btn danger" data-friend-action="remove" data-ref="' + p.ref + '" data-name="' + escapeHtml(p.name) + '">Hapus</button>');
        }).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">${ic('userPlus')} Teman</span>
        <button class="overlay-close-btn" id="fr-close">${ic('x')}</button>
      </div>
      <div class="chat-input-row" style="margin-bottom:4px;">
        <input type="text" id="fr-query" placeholder="Cari username pemain..." maxlength="24" autocomplete="off" value="${escapeHtml(lastQuery)}">
        <button class="action-btn" id="fr-search">Cari</button>
      </div>
      <div id="fr-results">${searchHtml}</div>
      <div class="chat-status" id="fr-status"></div>
      <div class="friend-section">PERMINTAAN MASUK (${state.incoming.length})</div>
      ${incomingHtml}
      ${outgoingHtml}
      <div class="friend-section">TEMAN (${state.friends.length})</div>
      ${friendsHtml}
      <button class="action-btn secondary" id="fr-refresh">Perbarui</button>
    `;
  }

  function panelEl() {
    var root = document.getElementById('overlay-root');
    if (!root || !overlayId) return null;
    var panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
    return panel && panel.querySelector('#fr-refresh') ? panel : null;
  }

  function setStatus(text, isError) {
    var panel = panelEl();
    if (!panel) return;
    var el = panel.querySelector('#fr-status');
    if (el) {
      el.textContent = text || '';
      el.style.color = isError ? 'var(--accent-red)' : 'var(--text-dim)';
    }
  }

  function renderIntoPanel() {
    var panel = panelEl();
    if (!panel) return;
    panel.innerHTML = renderPanelHtml();
    bindEvents(panel);
  }

  // ---- jaringan ----

  async function apiGet() {
    var res = await fetch(API_BASE + '/friends?pid=' + encodeURIComponent(getPid()));
    var data = await res.json().catch(function () { return null; });
    if (!res.ok || !data) throw new Error((data && data.error) || 'Gagal memuat data teman.');
    return data;
  }

  async function apiPost(payload) {
    var res = await fetch(API_BASE + '/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ pid: getPid() }, payload))
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Gagal memproses permintaan.');
    return data;
  }

  function applyState(data) {
    state = {
      friends: Array.isArray(data.friends) ? data.friends : [],
      incoming: Array.isArray(data.incoming) ? data.incoming : [],
      outgoing: Array.isArray(data.outgoing) ? data.outgoing : []
    };
  }

  async function refresh() {
    try {
      var data = await apiGet();
      applyState(data);
      renderIntoPanel();
      return true;
    } catch (e) {
      setStatus('Tidak dapat terhubung ke server. Fitur ini hanya aktif di versi Netlify.', true);
      return false;
    }
  }

  async function doSearch() {
    if (busy) return;
    var panel = panelEl();
    if (!panel) return;
    var input = panel.querySelector('#fr-query');
    var query = (input.value || '').trim();
    if (query.length < 2) { setStatus('Ketik minimal 2 huruf untuk mencari.', true); return; }
    busy = true;
    try {
      var data = await apiPost({ action: 'search', query: query });
      lastQuery = query;
      searchResults = Array.isArray(data.results) ? data.results : [];
      renderIntoPanel();
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      busy = false;
    }
  }

  async function doAction(action, ref, name) {
    if (busy) return;
    if (action === 'remove' && !confirm('Hapus ' + (name || 'pemain ini') + ' dari daftar teman?')) return;
    busy = true;
    try {
      var data = await apiPost({ action: action, ref: ref });
      applyState(data);
      // Segarkan status relasi pada hasil pencarian yang masih tampil.
      if (searchResults) {
        searchResults = searchResults.map(function (p) {
          if (p.ref !== ref) return p;
          var rel = action === 'request' ? 'outgoing'
            : (action === 'accept' || data.autoAccepted) ? 'friend'
            : action === 'remove' ? 'none'
            : action === 'cancel' || action === 'reject' ? 'none' : p.relation;
          return Object.assign({}, p, { relation: rel });
        });
      }
      renderIntoPanel();
      if (data.autoAccepted) Events.emit('notify', { message: 'Permintaan diterima otomatis — kalian sudah berteman.' });
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      busy = false;
    }
  }

  function bindEvents(panel) {
    var closeBtn = panel.querySelector('#fr-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      OverlayManager.close(overlayId);
      overlayId = null;
    });

    var searchBtn = panel.querySelector('#fr-search');
    if (searchBtn) searchBtn.addEventListener('click', doSearch);

    var queryInput = panel.querySelector('#fr-query');
    if (queryInput) queryInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

    var refreshBtn = panel.querySelector('#fr-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', refresh);

    panel.querySelectorAll('[data-friend-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        doAction(btn.dataset.friendAction, btn.dataset.ref, btn.dataset.name);
      });
    });
  }

  function open() {
    searchResults = null;
    lastQuery = '';
    overlayId = OverlayManager.open(renderPanelHtml(), { closeOnBackdrop: true });
    var panel = panelEl();
    if (panel) bindEvents(panel);
    refresh();
  }

  return {
    open: open,
    refresh: refresh,
    getState: function () { return state; }
  };
})();

window.Friends = Friends;
