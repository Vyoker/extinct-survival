/**
 * Topup Module
 * Alur topup manual berbasis QRIS STATIS (bukan QRIS dinamis dari payment
 * gateway) — jadi tidak ada callback otomatis dari bank/e-wallet.
 *
 * Alur:
 * 1. Pemain pilih paket -> client minta order ke Netlify Function
 *    (topup-create). Server balas kode order + NOMINAL UNIK (harga asli
 *    + 1..899 rupiah) supaya mutasi gampang dicocokkan admin secara manual.
 * 2. Pemain transfer via QRIS statis (gambar sama untuk semua transaksi)
 *    TEPAT sejumlah nominal unik tsb.
 * 3. Pemain klik "Saya Sudah Bayar" -> client POST topup-confirm,
 *    order dikunci berstatus "paid" (menunggu verifikasi admin).
 *    Status paid TIDAK bisa kedaluwarsa sendiri.
 * 4. Client polling status tiap beberapa detik (juga bisa dicek manual).
 * 5. Admin verifikasi manual mutasi di dashboard (/admin/index2.html),
 *    lalu klik Approve.
 * 6. Begitu status 'approved' terdeteksi, client menambahkan Kredit ke
 *    player LOKAL (game ini single-player berbasis localStorage, tidak
 *    ada akun server, jadi kredit di-apply langsung di device pemain
 *    yang membuat order tsb).
 *
 * Order pending disimpan juga di localStorage dan SELALU di-resume ke
 * payment screen saat menu Top Up dibuka — menu tidak kembali ke pilih
 * paket sebelum order selesai (claimed/rejected/expired) atau player
 * eksplisit membatalkan. Kalau app ditutup/reload di tengah proses
 * bayar, pemain bisa lanjut cek status begitu buka lagi menu Top Up
 * (tidak perlu bikin order baru).
 */
const Topup = (function () {
  'use strict';

  const API_BASE = '/.netlify/functions';
  const PENDING_KEY = 'extinct_survival_pending_topup';
  const POLL_INTERVAL_MS = 6000;
  const QRIS_IMAGE = 'assets/images/qris-afistore.jpg';
  const MERCHANT_NAME = 'Afistore';

  function IC(name) {
    return window.Icons ? Icons.svg(name) : '';
  }

  let packagesCache = null;
  let pollHandle = null;
  let countdownHandle = null;
  let currentOverlayId = null;

  function getPlayer() {
    return GameState.get().player;
  }

  function savePending(order) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(order)); } catch (e) { /* abaikan */ }
  }
  function loadPending() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* abaikan */ }
  }

  async function fetchPackages() {
    if (packagesCache) return packagesCache;
    try {
      const res = await fetch(`${API_BASE}/topup-packages`);
      const data = await res.json();
      packagesCache = data.packages || [];
    } catch (e) {
      packagesCache = [];
    }
    return packagesCache;
  }

  function formatRupiah(n) {
    return 'Rp' + Number(n).toLocaleString('id-ID');
  }
  function formatCountdown(ms) {
    if (ms <= 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function stopPolling() { if (pollHandle) clearInterval(pollHandle); pollHandle = null; }
  function stopCountdown() { if (countdownHandle) clearInterval(countdownHandle); countdownHandle = null; }

  // =========================================================
  // SCREEN 1: pilih paket
  // =========================================================
  function renderPackageGrid(packages) {
    if (!packages.length) {
      return `<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:16px 0;">
        Gagal memuat daftar paket. Cek koneksi internet lalu coba lagi.
      </p>`;
    }
    return `
      <div class="topup-package-grid">
        ${packages.map(p => `
          <div class="topup-package-card" data-package="${p.id}">
            ${p.bonusLabel ? `<div class="topup-bonus-tag">${p.bonusLabel}</div>` : ''}
            <div class="topup-package-kredit">${IC('gem')} ${p.kredit.toLocaleString('id-ID')}</div>
            <div class="topup-package-label">${p.label}</div>
            <div class="topup-package-price">${formatRupiah(p.priceRupiah)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function renderSelectScreen() {
    const packages = await fetchPackages();
    return `
      <div class="overlay-header">
        <span class="overlay-title">${IC('card')} Top Up Kredit</span>
        <button class="overlay-close-btn" id="topup-close">✕</button>
      </div>
      <div class="card">
        <div class="card-row"><span>Kredit kamu</span><span>${IC('gem')} ${getPlayer().currency.kredit.toLocaleString('id-ID')}</span></div>
        ${renderManualHint()}
      </div>
      <p style="font-size:11px; color:var(--text-dim); margin-bottom:10px; line-height:1.6;">
        Pilih paket, bayar via QRIS, lalu tunggu verifikasi. Prosesnya
        <b style="color:var(--text-primary);">manual</b> jadi butuh beberapa
        menit, bukan instan.
      </p>
      ${renderPackageGrid(packages)}
    `;
  }

  // v0.3.3: tunjukkan kode save supaya player bisa memberikannya ke admin
  // untuk kiriman kredit manual (kredit masuk otomatis, tanpa klaim).
  function renderManualHint() {
    const code = (window.CloudSave && CloudSave.getCode && CloudSave.getCode()) || null;
    if (!code) {
      return `<div class="card-row" style="font-size:11px; color:var(--text-dim);">
        <span>Belum punya kode save — buka Menu → Simpan Online dulu supaya admin bisa kirim kredit manual.</span>
      </div>`;
    }
    return `<div class="card-row" style="font-size:11px; color:var(--text-dim);">
      <span>Kode save kamu</span>
      <span class="topup-order-code" style="font-size:12px;">${code}</span>
    </div>
    <div style="font-size:10px; color:var(--text-dim); opacity:0.8; margin-top:2px;">
      Berikan kode ini ke admin bila ingin dikirimi kredit via Mail (klaim di Menu → Mail).
    </div>`;
  }

  function bindSelectScreenEvents(panel) {
    const closeBtn = panel.querySelector('#topup-close');
    if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(currentOverlayId));

    panel.querySelectorAll('[data-package]').forEach(card => {
      card.addEventListener('click', () => createOrder(card.dataset.package, panel));
    });
  }

  // =========================================================
  // SCREEN 2: instruksi bayar (QRIS + nominal unik + countdown)
  // =========================================================
  function renderPaymentScreen(order) {
    return `
      <div class="overlay-header">
        <span class="overlay-title">${IC('card')} Selesaikan Pembayaran</span>
        <button class="overlay-close-btn" id="topup-close">✕</button>
      </div>

      <div class="card topup-qris-card">
        <img src="${QRIS_IMAGE}" alt="QRIS ${MERCHANT_NAME}" class="topup-qris-img">
        <div class="topup-merchant-name">${MERCHANT_NAME} • QRIS Standar Nasional</div>
      </div>

      <div class="card">
        <div class="card-row"><span>Kode Order</span><span class="topup-order-code">${order.orderCode}</span></div>
        <div class="card-row"><span>Paket</span><span>${IC('gem')} ${order.kredit.toLocaleString('id-ID')} Kredit</span></div>
        <div class="card-row topup-amount-row">
          <span>Transfer TEPAT sejumlah</span>
          <span class="topup-amount-value">${formatRupiah(order.uniqueAmount)}</span>
        </div>
        <div class="card-row"><span>Sisa waktu</span><span id="topup-countdown">--:--</span></div>
      </div>

      <p style="font-size:11px; color:var(--accent-orange); line-height:1.6; margin-bottom:10px;">
        ${IC('alert')} Nominal harus PAS sampai 3 digit terakhir — ini kode unik supaya
        transfermu gampang ditemukan admin saat verifikasi manual. Kalau
        dibulatkan, verifikasi bisa lebih lama atau gagal cocok.
      </p>

      <button class="action-btn" id="topup-check-status">${IC('refresh')} Saya Sudah Bayar / Cek Status</button>
      <button class="action-btn secondary" id="topup-cancel">Batalkan Order</button>
      <p id="topup-status-line" style="font-size:11px; color:var(--text-dim); text-align:center; margin-top:6px;"></p>
    `;
  }

  function startCountdown(order, panel) {
    stopCountdown();
    // v0.3.4: order yang sudah "paid" tidak pakai countdown — dikunci
    // menunggu verifikasi admin, tidak bisa kedaluwarsa sendiri.
    if (order.status === 'paid') {
      const t = panel.querySelector('#topup-countdown');
      if (t) t.textContent = 'Menunggu verifikasi admin';
      return;
    }
    function tick() {
      const target = panel.querySelector('#topup-countdown');
      if (!target) { stopCountdown(); return; }
      const remain = order.expiresAt - Date.now();
      if (remain <= 0) {
        // v0.3.4: JANGAN hapus pending di sini. Server yang menentukan
        // status sebenarnya (pending->expired, tapi paid TIDAK expire).
        target.textContent = 'Memeriksa status...';
        stopCountdown();
        checkStatus(order, panel);
        return;
      }
      target.textContent = formatCountdown(remain);
    }
    tick();
    countdownHandle = setInterval(tick, 1000);
  }

  function startPolling(order, panel) {
    stopPolling();
    pollHandle = setInterval(() => checkStatus(order, panel, { silent: true }), POLL_INTERVAL_MS);
  }

  async function checkStatus(order, panel, opts = {}) {
    const lineEl = panel.querySelector('#topup-status-line');
    if (!opts.silent && lineEl) lineEl.textContent = 'Mengecek status...';
    try {
      const res = await fetch(`${API_BASE}/topup-status?code=${encodeURIComponent(order.orderCode)}`);
      const data = await res.json();

      if (data.status === 'approved') {
        stopPolling(); stopCountdown();
        const p = getPlayer();
        p.currency.kredit += data.kredit;
        GameState.save();
        clearPending();
        Events.emit('player:updated');
        if (window.AudioManager) AudioManager.sfx('coin'); // v0.3.8
        Events.emit('notify', { message: `Topup berhasil! +${data.kredit} Kredit masuk.` });
        OverlayManager.close(currentOverlayId);
        return;
      }
      if (data.status === 'claimed') {
        stopPolling(); stopCountdown(); clearPending();
        OverlayManager.close(currentOverlayId);
        return;
      }
      if (data.status === 'rejected') {
        stopPolling(); stopCountdown(); clearPending();
        Events.emit('notify', { message: `Topup ditolak admin.${data.reason ? ' Alasan: ' + data.reason : ''}`, type: 'error' });
        OverlayManager.close(currentOverlayId);
        return;
      }
      // v0.3.4: "paid" = player sudah klik "Saya Sudah Bayar", dikunci
      // menunggu verifikasi admin. Tetap polling sampai approved.
      if (data.status === 'paid') {
        order.status = 'paid';
        savePending(order);
        updatePaidUI(panel);
        if (lineEl) lineEl.textContent = 'Menunggu verifikasi admin...';
        return;
      }
      if (data.status === 'expired' || data.status === 'not_found') {
        // v0.3.4: jangan tutup diam-diam — tampilkan layar expired dengan
        // tombol eksplisit "Buat Order Baru". Menu TIDAK kembali ke semula
        // sebelum player memutuskan.
        stopPolling(); stopCountdown(); clearPending();
        panel.innerHTML = renderExpiredScreen(data.status);
        bindExpiredScreenEvents(panel);
        return;
      }
      if (lineEl) lineEl.textContent = 'Masih menunggu verifikasi admin...';
    } catch (e) {
      if (lineEl) lineEl.textContent = 'Gagal mengecek status, cek koneksi internet.';
    }
  }

  // v0.3.4: player mengklik "Saya Sudah Bayar" -> kunci order jadi "paid".
  async function confirmPaid(order, panel) {
    if (order.status === 'paid') { checkStatus(order, panel); return; }
    const lineEl = panel.querySelector('#topup-status-line');
    const btn = panel.querySelector('#topup-check-status');
    if (lineEl) lineEl.textContent = 'Mengonfirmasi pembayaran...';
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/topup-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: order.orderCode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengonfirmasi.');
      order.status = 'paid';
      savePending(order);
      updatePaidUI(panel);
      Events.emit('notify', { message: 'Terima kasih! Menunggu verifikasi manual admin.' });
    } catch (e) {
      if (lineEl) lineEl.textContent = e.message || 'Gagal mengonfirmasi, coba lagi.';
    } finally {
      if (btn) btn.disabled = false;
    }
    checkStatus(order, panel, { silent: true });
  }

  // Ubah tampilan payment screen ke mode "menunggu verifikasi".
  function updatePaidUI(panel) {
    const btn = panel.querySelector('#topup-check-status');
    if (btn) btn.innerHTML = `${IC('refresh')} Cek Status`;
    const cd = panel.querySelector('#topup-countdown');
    if (cd) cd.textContent = 'Menunggu verifikasi admin';
    const line = panel.querySelector('#topup-status-line');
    if (line) line.textContent = 'Pembayaran dikonfirmasi. Admin akan verifikasi manual — kredit masuk otomatis setelah di-approve.';
  }

  function renderExpiredScreen(status) {
    const msg = status === 'not_found'
      ? 'Order tidak ditemukan di server.'
      : 'Order ini sudah kedaluwarsa (batas 30 menit).';
    return `
      <div class="overlay-header">
        <span class="overlay-title">${IC('card')} Top Up Kredit</span>
        <button class="overlay-close-btn" id="topup-close">✕</button>
      </div>
      <div class="card" style="text-align:center; padding:24px 12px;">
        <p style="font-size:13px; margin-bottom:6px;">${msg}</p>
        <p style="font-size:11px; color:var(--text-dim);">Belum sempat bayar? Buat order baru dengan nominal unik yang baru.</p>
      </div>
      <button class="action-btn" id="topup-new-order">${IC('refresh')} Buat Order Baru</button>
    `;
  }

  function bindExpiredScreenEvents(panel) {
    const closeBtn = panel.querySelector('#topup-close');
    if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(currentOverlayId));
    const newBtn = panel.querySelector('#topup-new-order');
    if (newBtn) newBtn.addEventListener('click', async () => {
      panel.innerHTML = `<p style="text-align:center; padding:20px 0; font-size:12px; color:var(--text-dim);">Memuat...</p>`;
      panel.innerHTML = await renderSelectScreen();
      bindSelectScreenEvents(panel);
    });
  }

  function bindPaymentScreenEvents(order, panel) {
    const closeBtn = panel.querySelector('#topup-close');
    if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(currentOverlayId));

    const cancelBtn = panel.querySelector('#topup-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      stopPolling(); stopCountdown(); clearPending();
      OverlayManager.close(currentOverlayId);
    });

    const checkBtn = panel.querySelector('#topup-check-status');
    if (checkBtn) checkBtn.addEventListener('click', () => confirmPaid(order, panel));

    // v0.3.4: kalau order sudah "paid" (mis. resume setelah tutup app),
    // langsung tampilkan mode menunggu verifikasi.
    if (order.status === 'paid') updatePaidUI(panel);

    startCountdown(order, panel);
    startPolling(order, panel);
  }

  async function createOrder(packageId, panel) {
    panel.innerHTML = `
      <div class="overlay-header"><span class="overlay-title">${IC('card')} Top Up Kredit</span></div>
      <p style="font-size:12px; color:var(--text-dim); text-align:center; padding:20px 0;">Membuat order...</p>
    `;
    const p = getPlayer();
    try {
      const res = await fetch(`${API_BASE}/topup-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, playerId: p.id, playerName: p.name })
      });
      const data = await res.json();
      if (!res.ok) {
        panel.innerHTML = `
          <div class="overlay-header"><span class="overlay-title">${IC('card')} Top Up Kredit</span><button class="overlay-close-btn" id="topup-close">✕</button></div>
          <p style="font-size:12px; color:var(--accent-red);">${data.error || 'Gagal membuat order.'}</p>
        `;
        const closeBtn = panel.querySelector('#topup-close');
        if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(currentOverlayId));
        return;
      }
      const order = Object.assign({ packageId }, data);
      savePending(order);
      panel.innerHTML = renderPaymentScreen(order);
      bindPaymentScreenEvents(order, panel);
    } catch (e) {
      panel.innerHTML = `<p style="font-size:12px; color:var(--accent-red); text-align:center; padding:20px 0;">Gagal terhubung ke server. Cek koneksi internet lalu coba lagi.</p>`;
    }
  }

  // =========================================================
  // ENTRY POINT
  // =========================================================
  function open() {
    const pending = loadPending();

    currentOverlayId = OverlayManager.open(
      `<p style="text-align:center; padding:20px 0; font-size:12px; color:var(--text-dim);">Memuat...</p>`,
      { closeOnBackdrop: true, onClose: () => { stopPolling(); stopCountdown(); } }
    );

    const root = document.getElementById('overlay-root');
    requestAnimationFrame(async () => {
      const panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (!panel) return;

      // v0.3.4: selama masih ada pending order (status apa pun yang belum
      // terminal), SELALU resume ke payment screen — jangan kembali ke
      // pilih paket. Server (checkStatus) yang menentukan status sebenarnya.
      if (pending) {
        panel.innerHTML = renderPaymentScreen(pending);
        bindPaymentScreenEvents(pending, panel);
        checkStatus(pending, panel, { silent: true });
      } else {
        panel.innerHTML = await renderSelectScreen();
        bindSelectScreenEvents(panel);
      }
    });
  }

  return { open };
})();

window.Topup = Topup;
