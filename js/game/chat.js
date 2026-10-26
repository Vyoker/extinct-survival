/**
 * Chat Global (v0.5.7) — obrolan antar pemain.
 *
 * Keputusan user 2026-10-21: polling 15 detik, simpan 50 pesan,
 * maks 200 karakter, cooldown 15 detik, badge ADMIN resmi.
 * - Polling HANYA jalan saat panel chat dibuka (hemat kuota
 *   Functions); panel ditutup, polling berhenti sendiri.
 * - Cooldown 15 detik ditegakkan server; klien menampilkan hitung
 *   mundur di tombol kirim. Balasan 429 dari server menyinkronkan
 *   ulang hitung mundur klien.
 * - Badge ADMIN hanya tampil untuk pesan yang server tandai
 *   role 'admin' (terverifikasi password admin). Mode admin untuk
 *   developer: tombol kecil "Admin" di panel -> masukkan password
 *   admin -> tersimpan di sessionStorage (hilang saat sesi tutup).
 *
 * Berfungsi penuh hanya di deploy Netlify; di build statis panel
 * menampilkan pesan tidak dapat terhubung.
 *
 * v0.7.0: bila Firebase RTDB terkonfigurasi, chat pindah ke RTDB
 * (listener realtime, tanpa polling Netlify). Bila tidak, fallback
 * ke Netlify Functions lama seperti di atas.
 */
const GlobalChat = (function () {
  'use strict';

  var API_BASE = '/.netlify/functions';
  var POLL_MS = 15 * 1000;
  var COOLDOWN_MS = 15 * 1000;
  var MAX_LEN = 200;
  var ADMIN_PW_KEY = 'es_chat_admin_pw';

  var overlayId = null;
  var pollTimer = null;
  var cooldownTimer = null;
  var cooldownUntil = 0;
  var messages = [];
  var sending = false;
  // v0.7.0: mode Firebase RTDB (listener, bukan polling). Fallback Netlify.
  var fbMode = false;
  var fbUnsub = null;

  function useFirebase() {
    return !!(window.ESFirebase && ESFirebase.isEnabled());
  }

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

  function getAdminPw() {
    try { return sessionStorage.getItem(ADMIN_PW_KEY) || ''; }
    catch (e) { return ''; }
  }
  function setAdminPw(pw) {
    try {
      if (pw) sessionStorage.setItem(ADMIN_PW_KEY, pw);
      else sessionStorage.removeItem(ADMIN_PW_KEY);
    } catch (e) { /* abaikan */ }
  }

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function panelEl() {
    var root = document.getElementById('overlay-root');
    if (!root || !overlayId) return null;
    var panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
    return panel && panel.querySelector('#chat-messages') ? panel : null;
  }

  // ---- render ----

  function renderMessagesHtml() {
    if (!messages.length) {
      return '<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:16px 0;">Belum ada pesan. Jadilah yang pertama menyapa.</p>';
    }
    var myName = GameState.get().player.name;
    return messages.map(function (m) {
      var badge = m.role === 'admin' ? ' <span class="chat-badge-admin">ADMIN</span>' : '';
      var mine = m.name === myName ? ' <span class="online-you">(Kamu)</span>' : '';
      return `
        <div class="chat-msg">
          <div class="chat-msg-head">
            <span class="chat-msg-name${m.role === 'admin' ? ' is-admin' : ''}">${escapeHtml(m.name)}${badge}${mine}</span>
            <span class="chat-msg-time">${fmtTime(m.ts)}</span>
          </div>
          <p class="chat-msg-text">${escapeHtml(m.text)}</p>
        </div>`;
    }).join('');
  }

  function renderPanelHtml() {
    var online = window.Presence ? Presence.getCache().onlineCount : 0;
    var adminOn = !!getAdminPw();
    return `
      <div class="overlay-header">
        <span class="overlay-title">${ic('chat')} Chat Global</span>
        <button class="overlay-close-btn" id="chat-close">${ic('x')}</button>
      </div>
      <p class="chat-note">
        ${online ? online + ' pemain online. ' : ''}Admin resmi selalu memakai badge <span class="chat-badge-admin">ADMIN</span> — jangan percaya akun lain yang mengaku admin, dan jangan pernah bagikan kode savemu.
      </p>
      <div class="chat-messages" id="chat-messages">${renderMessagesHtml()}</div>
      <div class="chat-status" id="chat-status"></div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" maxlength="${MAX_LEN}" placeholder="Tulis pesan..." autocomplete="off">
        <button class="chat-send-btn" id="chat-send" aria-label="Kirim pesan">${ic('send')}</button>
      </div>
      <div class="chat-foot">
        <span id="chat-counter">0/${MAX_LEN}</span>
        <button type="button" class="chat-admin-toggle" id="chat-admin-toggle">${adminOn ? 'Mode Admin aktif — tap untuk keluar' : 'Admin'}</button>
      </div>
    `;
  }

  function refreshMessagesView(keepScroll) {
    var panel = panelEl();
    if (!panel) return;
    var box = panel.querySelector('#chat-messages');
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = renderMessagesHtml();
    if (!keepScroll || nearBottom) box.scrollTop = box.scrollHeight;
  }

  function setStatus(text, isError) {
    var panel = panelEl();
    if (!panel) return;
    var el = panel.querySelector('#chat-status');
    if (el) {
      el.textContent = text || '';
      el.style.color = isError ? 'var(--accent-red)' : 'var(--text-dim)';
    }
  }

  // ---- cooldown UI ----

  function startCooldown(sec) {
    cooldownUntil = Date.now() + sec * 1000;
    if (cooldownTimer) clearInterval(cooldownTimer);
    var tick = function () {
      var panel = panelEl();
      var remain = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (!panel) { clearInterval(cooldownTimer); cooldownTimer = null; return; }
      var btn = panel.querySelector('#chat-send');
      if (remain > 0) {
        // v0.6.0: tombol kirim ikon — selama cooldown tampilkan
        // angka hitung mundurnya saja di tombol yang sama.
        if (btn) { btn.disabled = true; btn.textContent = String(remain); }
      } else {
        clearInterval(cooldownTimer); cooldownTimer = null;
        if (btn) { btn.disabled = false; btn.innerHTML = ic('send'); }
      }
    };
    tick();
    cooldownTimer = setInterval(tick, 500);
  }

  // ---- jaringan ----

  async function fetchMessages() {
    // v0.7.0 Firebase: listener sudah berjalan selama panel terbuka.
    if (fbMode && window.ESFirebase) {
      if (!fbUnsub) {
        fbUnsub = ESFirebase.onMessages(function (msgs) {
          messages = msgs;
          refreshMessagesView(true);
        });
      }
      return true;
    }
    try {
      var res = await fetch(API_BASE + '/chat');
      var data = await res.json().catch(function () { return null; });
      if (res.ok && data && Array.isArray(data.messages)) {
        messages = data.messages;
        refreshMessagesView(true);
        return true;
      }
    } catch (e) { /* abaikan */ }
    return false;
  }

  async function send() {
    if (sending) return;
    var panel = panelEl();
    if (!panel) return;
    var input = panel.querySelector('#chat-input');
    var text = (input.value || '').trim();
    if (!text) return;
    if (Date.now() < cooldownUntil) return;

    sending = true;
    var p = GameState.get().player;
    // v0.7.0 Firebase: kirim via RTDB, role selalu player.
    if (fbMode && window.ESFirebase) {
      try {
        var fbRes = await ESFirebase.sendMessage({ pid: getPid(), name: p.name, level: p.level, text: text });
        if (!fbRes.ok) {
          setStatus(fbRes.error || 'Gagal mengirim pesan.', true);
          if (fbRes.retryAfterSec) startCooldown(fbRes.retryAfterSec);
          return;
        }
        input.value = '';
        updateCounter(panel);
        setStatus('');
        refreshMessagesView(false);
        startCooldown(fbRes.cooldownSec || 15);
      } catch (e) {
        setStatus('Tidak dapat terhubung ke server chat Firebase.', true);
      } finally {
        sending = false;
      }
      return;
    }
    var headers = { 'Content-Type': 'application/json' };
    var pw = getAdminPw();
    if (pw) headers['x-chat-admin'] = pw;
    try {
      var res = await fetch(API_BASE + '/chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ pid: getPid(), name: p.name, level: p.level, text: text })
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 429) {
        setStatus(data.error || 'Terlalu cepat.', true);
        startCooldown(data.retryAfterSec || 15);
        return;
      }
      if (!res.ok) {
        setStatus(data.error || 'Gagal mengirim pesan.', true);
        return;
      }
      messages = Array.isArray(data.messages) ? data.messages : messages;
      input.value = '';
      updateCounter(panel);
      setStatus('');
      refreshMessagesView(false);
      startCooldown(data.cooldownSec || 15);
    } catch (e) {
      setStatus('Tidak dapat terhubung ke server chat. Fitur ini hanya aktif di versi Netlify.', true);
    } finally {
      sending = false;
    }
  }

  function updateCounter(panel) {
    var input = panel.querySelector('#chat-input');
    var counter = panel.querySelector('#chat-counter');
    if (input && counter) counter.textContent = input.value.length + '/' + MAX_LEN;
  }

  // ---- polling (hanya selama panel terbuka) ----

  function startPolling() {
    // v0.7.0 Firebase: listener menggantikan polling.
    if (fbMode) return;
    stopPolling();
    pollTimer = setInterval(function () {
      if (!panelEl()) { stopPolling(); return; }
      fetchMessages();
    }, POLL_MS);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ---- buka / tutup ----

  function bindEvents(panel) {
    var closeBtn = panel.querySelector('#chat-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { close(); });

    var sendBtn = panel.querySelector('#chat-send');
    if (sendBtn) sendBtn.addEventListener('click', send);

    var input = panel.querySelector('#chat-input');
    if (input) {
      input.addEventListener('input', function () { updateCounter(panel); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    }

    var adminBtn = panel.querySelector('#chat-admin-toggle');
    if (adminBtn) adminBtn.addEventListener('click', function () {
      // v0.7.0 Firebase: badge ADMIN tidak bisa diklaim dari klien.
      // Moderasi (hapus/ban) hanya lewat dashboard admin.
      if (fbMode) {
        Events.emit('notify', { message: 'Mode Firebase: moderasi chat lewat dashboard admin, bukan dari panel ini.' });
        return;
      }
      if (getAdminPw()) {
        setAdminPw('');
        Events.emit('notify', { message: 'Mode Admin chat dimatikan.' });
      } else {
        var pw = prompt('Password admin (badge ADMIN hanya tampil bila benar):');
        if (pw) {
          setAdminPw(pw.trim());
          Events.emit('notify', { message: 'Mode Admin chat aktif. Kirim pesan untuk verifikasi badge.' });
        }
      }
      var fresh = panelEl();
      if (fresh) {
        var btn = fresh.querySelector('#chat-admin-toggle');
        if (btn) btn.textContent = getAdminPw() ? 'Mode Admin aktif — tap untuk keluar' : 'Admin';
      }
    });
  }

  function open() {
    // v0.7.0: Presence.start() sudah menginisialisasi Firebase bila
    // config ada; chat mengikuti status itu (bukan init ulang).
    fbMode = useFirebase();
    overlayId = OverlayManager.open(renderPanelHtml(), { closeOnBackdrop: true });
    // OverlayManager memasang panel secara sinkron — ikat event
    // langsung (tanpa menunggu frame animasi) supaya panel siap
    // dipakai seketika dan tidak ada jeda race.
    var panel = panelEl();
    if (panel) {
      bindEvents(panel);
      var box = panel.querySelector('#chat-messages');
      if (box) box.scrollTop = box.scrollHeight;
      // Sisa cooldown dari kiriman sebelumnya tetap berlaku.
      var remain = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remain > 0) startCooldown(remain);
    }
    fetchMessages();
    startPolling();
  }

  function close() {
    stopPolling();
    if (fbUnsub) { try { fbUnsub(); } catch (e) {} fbUnsub = null; }
    if (cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
    if (overlayId) OverlayManager.close(overlayId);
    overlayId = null;
  }

  return {
    open: open,
    close: close,
    fetchMessages: fetchMessages,
    getMessages: function () { return messages; },
    POLL_MS: POLL_MS,
    COOLDOWN_MS: COOLDOWN_MS,
    MAX_LEN: MAX_LEN
  };
})();

window.GlobalChat = GlobalChat;
