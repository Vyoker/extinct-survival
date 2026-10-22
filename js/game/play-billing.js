/**
 * PlayBilling Module (v0.4.5)
 * Alur topup via Google Play Billing — HANYA aktif di dalam wrapper native
 * Play Store (window.NativeBilling tersedia). Di luar wrapper, menu Top Up
 * tetap memakai alur QRIS manual di js/game/topup.js.
 *
 * Alur:
 * 1. open() -> kirim daftar SKU ke native (configure), baca harga dari
 *    Google Play (getSkus), tampilkan paket.
 * 2. Pemain pilih paket -> NativeBilling.buy(sku) -> dialog Google Play.
 * 3. Hasil masuk via window.onNativePurchaseResult(json) dari native.
 * 4. Client POST purchaseToken ke Netlify Function play-billing-verify.
 *    Server verifikasi token ke Play Developer API (atau mode uji untuk
 *    SKU android.test.purchased), cegah grant ganda via Blobs.
 * 5. Kalau server menjawab 'granted', kredit di-apply ke player LOKAL
 *    (pola sama seperti topup QRIS: game ini single-player localStorage),
 *    lalu NativeBilling.consume(token) supaya bisa dibeli lagi.
 *
 * Mode uji: selama SKU asli belum dibuat di Play Console, native hanya
 * menemukan SKU test bawaan Google (android.test.purchased) -> semua
 * pembelian memakai SKU itu dan server berjalan dalam mode uji
 * (PLAY_BILLING_TEST_MODE=true). Begitu SKU asli dibuat, game otomatis
 * memakai SKU asli tanpa update wrapper/AAB.
 */
const PlayBilling = (function () {
  'use strict';

  const API_BASE = '/.netlify/functions';
  const TEST_SKU = 'android.test.purchased';
  const GRANTED_KEY = 'extinct_survival_play_granted_tokens';

  let packagesCache = null;
  let skuPriceMap = {};
  let currentOverlayId = null;
  let buying = false;

  function IC(name) {
    return window.Icons ? Icons.svg(name) : '';
  }
  function getPlayer() {
    return GameState.get().player;
  }
  function formatRupiah(n) {
    return 'Rp' + Number(n).toLocaleString('id-ID');
  }

  /** True bila game jalan di dalam wrapper Play (bridge native tersedia). */
  function isAvailable() {
    try {
      return typeof window.NativeBilling !== 'undefined' &&
        typeof window.NativeBilling.isAvailable === 'function';
    } catch (e) {
      return false;
    }
  }

  function loadGranted() {
    try {
      const raw = localStorage.getItem(GRANTED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }
  function saveGranted(set) {
    try {
      localStorage.setItem(GRANTED_KEY, JSON.stringify(Array.from(set).slice(-200)));
    } catch (e) { /* abaikan */ }
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

  function readNativeSkus() {
    skuPriceMap = {};
    try {
      const raw = window.NativeBilling.getSkus();
      const list = JSON.parse(raw || '[]');
      list.forEach(s => {
        if (s && s.id) skuPriceMap[s.id] = s.price || '';
      });
    } catch (e) { /* abaikan */ }
  }

  /** Pilih SKU yang dipakai untuk paket: SKU asli bila ada di Play, else SKU uji. */
  function resolveSku(pkg) {
    if (skuPriceMap[pkg.playSku]) return pkg.playSku;
    if (skuPriceMap[TEST_SKU]) return TEST_SKU;
    return pkg.playSku;
  }

  function priceLabel(pkg) {
    const sku = resolveSku(pkg);
    if (skuPriceMap[sku]) return skuPriceMap[sku];
    return formatRupiah(pkg.playPriceRupiah || pkg.priceRupiah);
  }

  function renderScreen(packages, isTestMode) {
    // Tampilan Play memakai tangga kredit & label bonus Play (playKredit/
    // playBonusLabel dari packages.js), bukan tangga QRIS.
    packages = packages.map(p => Object.assign({}, p, {
      kredit: typeof p.playKredit === 'number' ? p.playKredit : p.kredit,
      bonusLabel: typeof p.playBonusLabel === 'string' ? p.playBonusLabel : p.bonusLabel
    }));
    return `
      <div class="overlay-header">
        <span class="overlay-title">${IC('card')} Top Up Kredit</span>
        <button class="overlay-close-btn" id="pb-close">✕</button>
      </div>
      <div class="card">
        <div class="card-row"><span>Kredit kamu</span><span>${IC('gem')} ${getPlayer().currency.kredit.toLocaleString('id-ID')}</span></div>
      </div>
      <p style="font-size:11px; color:var(--text-dim); margin-bottom:10px; line-height:1.6;">
        Pembayaran via <b style="color:var(--text-primary);">Google Play</b> — kredit masuk
        otomatis setelah pembayaran berhasil, tanpa verifikasi manual.
        ${isTestMode ? '<br><span style="color:var(--accent-orange);">Mode uji: memakai SKU test Google, tidak ada tagihan nyata.</span>' : ''}
      </p>
      <div class="topup-package-grid">
        ${packages.map(p => `
          <div class="topup-package-card" data-package="${p.id}">
            ${p.bonusLabel ? `<div class="topup-bonus-tag">${p.bonusLabel}</div>` : ''}
            <div class="topup-package-kredit">${IC('gem')} ${p.kredit.toLocaleString('id-ID')}</div>
            <div class="topup-package-label">${p.label}</div>
            <div class="topup-package-price" data-sku-price="${p.id}">${priceLabel(p)}</div>
          </div>
        `).join('')}
      </div>
      <p id="pb-status-line" style="font-size:11px; color:var(--text-dim); text-align:center; margin-top:8px;"></p>
    `;
  }

  function setStatus(msg, isError) {
    const root = document.getElementById('overlay-root');
    const panel = root && root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
    const line = panel && panel.querySelector('#pb-status-line');
    if (line) {
      line.textContent = msg || '';
      line.style.color = isError ? 'var(--accent-red)' : 'var(--text-dim)';
    }
  }

  async function buy(pkg, panel) {
    if (buying) return;
    const sku = resolveSku(pkg);
    buying = true;
    setStatus('Membuka Google Play...');
    try {
      window.NativeBilling.buy(sku);
      // Hasil pembelian masuk asinkron via window.onNativePurchaseResult.
    } catch (e) {
      buying = false;
      setStatus('Gagal membuka pembayaran: ' + (e.message || e), true);
    }
  }

  function bindEvents(panel, packages) {
    const closeBtn = panel.querySelector('#pb-close');
    if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(currentOverlayId));
    const byId = {};
    packages.forEach(p => { byId[p.id] = p; });
    panel.querySelectorAll('[data-package]').forEach(card => {
      card.addEventListener('click', () => {
        const pkg = byId[card.dataset.package];
        if (pkg) buy(pkg, panel);
      });
    });
  }

  async function verifyWithServer(payload) {
    const p = getPlayer();
    const res = await fetch(`${API_BASE}/play-billing-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: payload.packageId,
        sku: payload.sku,
        purchaseToken: payload.purchaseToken,
        orderId: payload.orderId,
        playerId: p.id
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Verifikasi pembelian gagal.');
    return data;
  }

  function grantKredit(kredit, purchaseToken) {
    const granted = loadGranted();
    if (granted.has(purchaseToken)) return false; // cegah apply ganda di device
    const player = getPlayer();
    player.currency.kredit += kredit;
    GameState.save();
    granted.add(purchaseToken);
    saveGranted(granted);
    Events.emit('player:updated');
    if (window.AudioManager) AudioManager.sfx('coin');
    return true;
  }

  async function handlePurchaseResult(raw) {
    let r;
    try {
      r = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      buying = false;
      setStatus('Respon pembelian tidak valid.', true);
      return;
    }
    if (!r) { buying = false; return; }

    if (r.status === 'cancelled') {
      buying = false;
      setStatus('Pembelian dibatalkan.');
      return;
    }
    if (r.status !== 'ok' || !r.purchaseToken) {
      buying = false;
      setStatus('Pembelian gagal. Coba lagi.', true);
      return;
    }

    // Cari packageId dari SKU yang dipakai (mode uji -> petakan ke paket termurah).
    const pkg = (packagesCache || []).find(x => x.playSku === r.sku) ||
      (packagesCache || []).find(x => r.sku === TEST_SKU && x.id === 'starter');

    setStatus('Memverifikasi pembayaran...');
    try {
      const data = await verifyWithServer({
        packageId: pkg ? pkg.id : 'starter',
        sku: r.sku,
        purchaseToken: r.purchaseToken,
        orderId: r.orderId
      });

      if (data.status === 'granted' && data.kredit > 0) {
        grantKredit(data.kredit, r.purchaseToken);
        Events.emit('notify', { message: `Topup berhasil! +${data.kredit} Kredit masuk.` });
      } else if (data.status === 'already_granted') {
        Events.emit('notify', { message: 'Pembelian ini sudah diproses sebelumnya.' });
      }

      try { window.NativeBilling.consume(r.purchaseToken); } catch (e) { /* abaikan */ }
      buying = false;
      OverlayManager.close(currentOverlayId);
    } catch (e) {
      buying = false;
      // JANGAN consume — token tetap valid dan bisa diverifikasi ulang.
      setStatus('Verifikasi gagal: ' + (e.message || e) + ' Pembayaran aman, coba lagi nanti.', true);
    }
  }

  // Dipanggil native via evaluateJavascript: window.onNativePurchaseResult("<json>")
  window.onNativePurchaseResult = function (payload) {
    handlePurchaseResult(payload);
  };

  function open() {
    currentOverlayId = OverlayManager.open(
      `<p style="text-align:center; padding:20px 0; font-size:12px; color:var(--text-dim);">Memuat...</p>`,
      { closeOnBackdrop: true }
    );

    const root = document.getElementById('overlay-root');
    requestAnimationFrame(async () => {
      const panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (!panel) return;

      const packages = await fetchPackages();
      if (!packages.length) {
        panel.innerHTML = `
          <div class="overlay-header"><span class="overlay-title">${IC('card')} Top Up Kredit</span>
          <button class="overlay-close-btn" id="pb-close">✕</button></div>
          <p style="font-size:12px; color:var(--text-dim); text-align:center; padding:16px 0;">
          Gagal memuat daftar paket. Cek koneksi internet lalu coba lagi.</p>`;
        const closeBtn = panel.querySelector('#pb-close');
        if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(currentOverlayId));
        return;
      }

      // Daftarkan SKU asli ke native, lalu baca harga dari Google Play.
      try {
        window.NativeBilling.configure(JSON.stringify(packages.map(p => p.playSku).filter(Boolean)));
      } catch (e) { /* abaikan */ }
      readNativeSkus();
      const isTestMode = !packages.some(p => skuPriceMap[p.playSku]);

      panel.innerHTML = renderScreen(packages, isTestMode);
      bindEvents(panel, packages);

      // Harga Play kadang datang terlambat (query async di native) — refresh sekali.
      setTimeout(() => {
        const before = JSON.stringify(skuPriceMap);
        readNativeSkus();
        if (JSON.stringify(skuPriceMap) !== before) {
          packages.forEach(p => {
            const el = panel.querySelector(`[data-sku-price="${p.id}"]`);
            if (el) el.textContent = priceLabel(p);
          });
        }
      }, 2000);
    });
  }

  return { open, isAvailable };
})();

window.PlayBilling = PlayBilling;
