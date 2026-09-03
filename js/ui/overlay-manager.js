/**
 * Overlay Manager
 * Sistem modal/overlay terpusat, reusable untuk seluruh game.
 * - Maksimal 2 layer aktif bersamaan (stabilitas WebView Android)
 * - Backdrop blur "modern" di tiap layer
 * - Tombol back Android (hardware) menutup overlay teratas dulu,
 *   bukan langsung keluar app, lewat trik history.pushState/popstate
 */
const OverlayManager = (function () {
  'use strict';

  const MAX_DEPTH = 2;
  let stack = []; // { id, el, onClose }
  let container = null;
  let popstateBound = false;
  let suppressNextPopstate = false; // cegah double-close saat close() manual memicu history.back()

  function ensureContainer() {
    if (!container) {
      container = document.getElementById('overlay-root');
      if (!container) {
        container = document.createElement('div');
        container.id = 'overlay-root';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  function bindPopstateOnce() {
    if (popstateBound) return;
    popstateBound = true;
    window.addEventListener('popstate', () => {
      if (suppressNextPopstate) {
        suppressNextPopstate = false;
        return;
      }
      if (stack.length > 0) {
        closeTop({ fromPopstate: true });
      }
    });
  }

  function open(html, opts = {}) {
    bindPopstateOnce();
    const root = ensureContainer();

    if (stack.length >= MAX_DEPTH) {
      console.warn('[OverlayManager] Sudah mencapai max depth (2). Overlay ditolak.');
      return null;
    }

    const id = 'ov_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const depth = stack.length;

    const backdrop = document.createElement('div');
    backdrop.className = 'overlay-backdrop';
    backdrop.style.zIndex = String(2000 + depth * 10);
    // Layer ke-2 (teratas saat ada 2 layer) pakai blur lebih kuat; layer
    // di bawahnya otomatis "diredupkan" tanpa blur tambahan (hemat GPU).
    backdrop.classList.add(depth === 0 ? 'overlay-blur' : 'overlay-blur-top');

    const panel = document.createElement('div');
    panel.className = 'overlay-panel';
    panel.innerHTML = html;
    backdrop.appendChild(panel);

    if (opts.closeOnBackdrop !== false) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(id);
      });
    }

    root.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    // Kalau ada overlay di bawahnya, redupkan (dim) supaya fokus ke atas
    if (stack.length > 0) {
      stack[stack.length - 1].el.classList.add('overlay-dimmed');
    }

    stack.push({ id, el: backdrop, onClose: opts.onClose });

    // Push history state supaya tombol back Android menutup overlay dulu
    history.pushState({ overlayId: id }, '');

    return id;
  }

  // Ganti konten layer TERATAS di tempat, tanpa close+open terpisah.
  // PENTING: ini TIDAK menyentuh history sama sekali (reuse history entry
  // yang sudah ada dari layer lama) — sengaja dibuat begini supaya aman
  // dipakai untuk transisi "lanjut ke tampilan lain" (misal Hamburger->Shop,
  // atau popup slot->popup repair) tanpa risiko race condition antara
  // history.back() (async, dipakai oleh close()) dan pushState (sync,
  // dipakai oleh open()) kalau keduanya dipanggil berurutan langsung.
  function replaceTop(html, opts = {}) {
    if (stack.length === 0) return open(html, opts);

    const old = stack.pop();
    old.el.remove();
    if (typeof old.onClose === 'function') old.onClose();

    const depth = stack.length;
    const id = 'ov_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const backdrop = document.createElement('div');
    backdrop.className = 'overlay-backdrop';
    backdrop.style.zIndex = String(2000 + depth * 10);
    backdrop.classList.add(depth === 0 ? 'overlay-blur' : 'overlay-blur-top');

    const panel = document.createElement('div');
    panel.className = 'overlay-panel';
    panel.innerHTML = html;
    backdrop.appendChild(panel);

    if (opts.closeOnBackdrop !== false) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close(id);
      });
    }

    ensureContainer().appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    if (stack.length > 0) {
      stack[stack.length - 1].el.classList.add('overlay-dimmed');
    }

    stack.push({ id, el: backdrop, onClose: opts.onClose });
    // Sengaja TIDAK pushState lagi — history entry lama (dari layer yang
    // diganti) tetap dipakai, jadi tombol back tetap balik ke sebelum
    // layer ini pernah dibuka, seolah cuma 1 langkah overlay saja.
    return id;
  }

  function close(id, meta = {}) {
    const idx = stack.findIndex(o => o.id === id);
    if (idx === -1) return;

    const [entry] = stack.splice(idx, 1);
    entry.el.classList.remove('show');
    setTimeout(() => entry.el.remove(), 200);

    if (typeof entry.onClose === 'function') entry.onClose();

    // Un-dim layer di bawahnya kalau ini yang teratas
    if (stack.length > 0) {
      stack[stack.length - 1].el.classList.remove('overlay-dimmed');
    }

    // Kalau bukan dipicu tombol back (popstate), kita yang perlu mundurkan
    // history secara manual supaya stack history tetap sinkron. Tandai
    // suppressNextPopstate supaya popstate hasil back() ini sendiri
    // tidak memicu closeTop() lagi (mencegah double-close).
    if (!meta.fromPopstate) {
      suppressNextPopstate = true;
      history.back();
    }
  }

  function closeTop(meta = {}) {
    if (stack.length === 0) return;
    close(stack[stack.length - 1].id, meta);
  }

  function closeAll() {
    [...stack].reverse().forEach(o => close(o.id, { fromPopstate: true }));
  }

  function depth() {
    return stack.length;
  }

  return { open, close, closeTop, closeAll, depth, MAX_DEPTH, replaceTop };
})();

window.OverlayManager = OverlayManager;
