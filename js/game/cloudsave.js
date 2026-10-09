/**
 * CloudSave — save online via Netlify Functions + Blobs.
 *
 * Tiap pemain punya KODE SAVE rahasia (16 karakter acak, tidak bisa
 * ditebak). Data disimpan di key blob "player/<KODE>.json".
 * Siapa pun yang memegang kode bisa membaca & menimpa save tersebut —
 * jadi kode = kunci, pemain wajib menyimpannya baik-baik.
 *
 * - saveNow():  push GameState lokal -> cloud (butuh fungsi player-save)
 * - loadFrom(): pull dari cloud -> timpa state lokal (butuh player-load)
 *
 * Berfungsi penuh hanya di deploy Netlify (butuh Functions). Di
 * GitHub Pages / build statis lain, modul menampilkan pesan error
 * yang jelas alih-alih gagal diam-diam.
 */
const CloudSave = (function () {
  'use strict';

  var API_BASE = '/.netlify/functions';
  var CODE_KEY = 'extinct_survival_cloud_code';
  var LAST_SAVED_KEY = 'extinct_survival_cloud_last_saved';
  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var CODE_LEN = 16;

  function ic(name) {
    return window.Icons ? Icons.svg(name) : '';
  }

  function getCode() {
    try { return localStorage.getItem(CODE_KEY) || null; }
    catch (e) { return null; }
  }
  function setCode(code) {
    try { localStorage.setItem(CODE_KEY, code); } catch (e) { /* abaikan */ }
  }

  function generateCode() {
    var out = '';
    var buf = new Uint32Array(CODE_LEN);
    if (window.crypto && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      for (var i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    } else {
      for (var j = 0; j < CODE_LEN; j++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    // Format readability: XXXX-XXXX-XXXX-XXXX
    return out.match(/.{1,4}/g).join('-');
  }

  function ensureCode() {
    var code = getCode();
    if (!code) {
      code = generateCode();
      setCode(code);
    }
    return code;
  }

  function getLastSaved() {
    try {
      var v = parseInt(localStorage.getItem(LAST_SAVED_KEY) || '0', 10);
      return v || null;
    } catch (e) { return null; }
  }
  function setLastSaved(ts) {
    try { localStorage.setItem(LAST_SAVED_KEY, String(ts)); } catch (e) { /* abaikan */ }
  }

  function fmtTime(ts) {
    if (!ts) return 'belum pernah';
    try {
      return new Date(ts).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return 'baru saja'; }
  }

  function serverError() {
    return 'Tidak bisa terhubung ke server cloud. Fitur ini hanya aktif di versi Netlify (butuh koneksi internet).';
  }

  // ---- API ----

  async function saveNow() {
    var payload = GameState.exportSave();
    if (!payload) throw new Error('Belum ada data lokal untuk disimpan.');
    var code = ensureCode();
    var res = await fetch(API_BASE + '/player-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, data: payload })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || serverError());
    setLastSaved(data.updatedAt || Date.now());
    return data;
  }

  async function loadFrom(rawCode) {
    var code = String(rawCode || '').toUpperCase().trim();
    if (code.length < 8) throw new Error('Kode save tidak valid.');
    var res = await fetch(API_BASE + '/player-load?code=' + encodeURIComponent(code));
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || serverError());
    GameState.importSave(data.data);
    setCode(code);
    setLastSaved(data.updatedAt || Date.now());
    return { updatedAt: data.updatedAt, playerName: (data.data.save.player || {}).name };
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* abaikan */ }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
    } else {
      fallback();
    }
  }

  // ---- UI ----

  function renderOverlay(mode) {
    var code = getCode();
    var lastSaved = getLastSaved();
    var showSaveSection = mode !== 'restore';

    return `
      <div class="overlay-header">
        <span class="overlay-title">${ic('cloud')} Simpan Online</span>
        <button class="overlay-close-btn" id="cs-close">${ic('x')}</button>
      </div>

      <div class="card">
        <p style="font-size:11px; color:var(--text-dim); line-height:1.7; margin:0;">
          Simpan progresmu ke cloud supaya tidak hilang saat ganti HP,
          hapus data, atau install ulang. Pakai <b style="color:var(--text-primary);">kode save</b>
          di bawah untuk memulihkan di perangkat lain.
        </p>
      </div>

      ${showSaveSection ? `
      <div class="card" style="text-align:center;">
        <div style="font-size:10px; color:var(--text-dim); letter-spacing:1px; margin-bottom:6px;">KODE SAVEMU — SIMPAN BAIK-BAIK</div>
        <div id="cs-code" style="font-size:19px; font-weight:800; letter-spacing:2px; color:var(--ds-gold, #e8c26a); margin-bottom:10px; user-select:text; -webkit-user-select:text;">${code || '—'}</div>
        <div class="card-row"><span>Terakhir disimpan</span><span id="cs-last-saved">${fmtTime(lastSaved)}</span></div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="action-btn" id="cs-btn-save" style="flex:1.4;">${ic('cloudUp')} Simpan Sekarang</button>
          <button class="action-btn secondary" id="cs-btn-copy" style="flex:1;">${ic('copy')} Salin Kode</button>
        </div>
        <p id="cs-save-status" style="font-size:11px; color:var(--text-dim); text-align:center; margin:8px 0 0;"></p>
      </div>
      ` : ''}

      <div style="color:var(--accent-orange); font-size:12px; font-weight:700; letter-spacing:1px; margin:14px 0 8px; text-transform:uppercase;">${ic('cloudDown')} Muat dari Cloud</div>
      <div class="card">
        <div class="form-group" style="margin-bottom:8px;">
          <input type="text" id="cs-input-code" placeholder="Contoh: AB12-CD34-EF56-GH78"
                 maxlength="24" autocapitalize="characters" autocomplete="off"
                 style="text-transform:uppercase; letter-spacing:1px; user-select:text; -webkit-user-select:text;">
        </div>
        <button class="action-btn" id="cs-btn-load">${ic('cloudDown')} Muat &amp; Timpa Data Lokal</button>
        <p id="cs-load-status" style="font-size:11px; color:var(--text-dim); text-align:center; margin:8px 0 0;"></p>
        <p style="font-size:10px; color:var(--accent-red); line-height:1.6; margin:8px 0 0;">
          ${ic('alert')} Data lokal di perangkat ini akan DIGANTI dengan data dari cloud. Pastikan kode benar.
        </p>
      </div>
    `;
  }

  function open(mode) {
    var overlayId = OverlayManager.open('<p style="text-align:center; padding:20px;">Memuat...</p>', { closeOnBackdrop: true });
    if (!overlayId) return;
    var root = document.getElementById('overlay-root');
    requestAnimationFrame(function () {
      var panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (!panel) return;
      panel.innerHTML = renderOverlay(mode || 'full');
      bindEvents(panel, overlayId, mode || 'full');
    });
  }

  function bindEvents(panel, overlayId, mode) {
    var closeBtn = panel.querySelector('#cs-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { OverlayManager.close(overlayId); });

    var btnSave = panel.querySelector('#cs-btn-save');
    if (btnSave) btnSave.addEventListener('click', async function () {
      var status = panel.querySelector('#cs-save-status');
      btnSave.disabled = true;
      if (status) status.textContent = 'Menyimpan ke cloud...';
      try {
        await saveNow();
        var codeEl = panel.querySelector('#cs-code');
        var lastEl = panel.querySelector('#cs-last-saved');
        if (codeEl) codeEl.textContent = getCode();
        if (lastEl) lastEl.textContent = fmtTime(getLastSaved());
        if (status) { status.textContent = 'Tersimpan di cloud.'; status.style.color = '#22c55e'; }
        Events.emit('notify', { message: 'Progres tersimpan di cloud.' });
      } catch (e) {
        if (status) { status.textContent = e.message; status.style.color = 'var(--accent-red)'; }
      }
      btnSave.disabled = false;
    });

    var btnCopy = panel.querySelector('#cs-btn-copy');
    if (btnCopy) btnCopy.addEventListener('click', function () {
      var code = ensureCode();
      copyText(code);
      var codeEl = panel.querySelector('#cs-code');
      if (codeEl) codeEl.textContent = code;
      Events.emit('notify', { message: 'Kode save disalin.' });
    });

    var btnLoad = panel.querySelector('#cs-btn-load');
    var inputCode = panel.querySelector('#cs-input-code');
    if (btnLoad) btnLoad.addEventListener('click', async function () {
      var status = panel.querySelector('#cs-load-status');
      var code = inputCode ? inputCode.value : '';
      if (!code || code.trim().length < 8) {
        if (status) status.textContent = 'Masukkan kode save dulu.';
        return;
      }
      if (!confirm('Timpa data lokal dengan data dari cloud?')) return;
      btnLoad.disabled = true;
      if (status) { status.textContent = 'Memuat dari cloud...'; status.style.color = ''; }
      try {
        var result = await loadFrom(code);
        if (status) { status.textContent = 'Berhasil! Memuat ulang...'; status.style.color = '#22c55e'; }
        Events.emit('notify', { message: 'Save "' + (result.playerName || '') + '" dipulihkan dari cloud.' });
        setTimeout(function () { window.location.reload(); }, 900);
      } catch (e) {
        if (status) { status.textContent = e.message; status.style.color = 'var(--accent-red)'; }
        btnLoad.disabled = false;
      }
    });
  }

  return {
    open: open,
    saveNow: saveNow,
    loadFrom: loadFrom,
    getCode: getCode,
    ensureCode: ensureCode,
    getLastSaved: getLastSaved
  };
})();

window.CloudSave = CloudSave;
