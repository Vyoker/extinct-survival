/**
 * Visual Novel Quest Dialog — v0.7.1
 * Sistem dialog gaya Day R untuk misi: potret pembicara di kiri,
 * papan nama di bawah potret, kotak dialog, tombol Lanjut.
 *
 * Data dialog ada di js/data/quest-dialogs.json, format per misi:
 *   { speaker, portrait, open: [...kalimat], close: [...kalimat] }
 * - open  : tampil saat misi diambil (sebelum accept dieksekusi)
 * - close : tampil saat misi diklaim (sesudah claim dieksekusi)
 * Misi tanpa entri dialog di file itu berperilaku seperti dulu
 * (tanpa dialog) — jadi retrofit v0.7.2/v0.7.3 cukup menambah data,
 * tanpa mengubah mesin ini lagi.
 *
 * Portrait boleh kosong: panel tetap tampil dengan inisial nama.
 * Portrait yang dipakai ulang dari aset musuh/karakter yang sudah
 * ada; potret NPC baru bisa diganti cukup dengan mengubah path
 * di quest-dialogs.json, tanpa ubah kode.
 */
const VN = (function () {
  'use strict';

  let dialogs = {};
  let loaded = false;

  async function load() {
    if (loaded) return dialogs;
    try {
      const res = await fetch('js/data/quest-dialogs.json');
      const data = await res.json();
      dialogs = data || {};
      loaded = true;
    } catch (e) {
      console.error('[VN] Gagal memuat quest-dialogs.json:', e);
      dialogs = {};
    }
    return dialogs;
  }

  function get(questId) {
    return dialogs[questId] || null;
  }

  function has(questId, phase) {
    const d = get(questId);
    return !!(d && Array.isArray(d[phase]) && d[phase].length > 0);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Tampilkan dialog 1 fase (open/close). onDone dipanggil setelah
  // tombol terakhir ditekan / panel ditutup. Mengembalikan false
  // bila tidak ada dialog untuk fase itu (pemanggil lanjut normal).
  function show(questId, phase, onDone) {
    const d = get(questId);
    if (!d || !has(questId, phase)) {
      if (typeof onDone === 'function') onDone();
      return false;
    }
    if (typeof window === 'undefined' || !window.OverlayManager) {
      if (typeof onDone === 'function') onDone();
      return false;
    }

    const lines = d[phase];
    let idx = 0;
    let done = false;
    let ovId = null;

    const finish = () => {
      if (done) return;
      done = true;
      if (ovId !== null) window.OverlayManager.close(ovId);
      if (typeof onDone === 'function') onDone();
    };

    const render = () => {
      const portrait = d.portrait
        ? `<img src="${escapeHtml(d.portrait)}" alt="${escapeHtml(d.speaker || '')}" style="width:96px; height:120px; object-fit:cover; border:2px solid #8a6b3a; border-radius:6px; background:#1a1208;">`
        : `<div style="width:96px; height:120px; display:flex; align-items:center; justify-content:center; font-size:36px; font-weight:bold; color:#ffd782; border:2px solid #8a6b3a; border-radius:6px; background:#1a1208;">${escapeHtml((d.speaker || '?').charAt(0))}</div>`;
      const isLast = idx >= lines.length - 1;
      return `
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="flex-shrink:0; text-align:center;">
            ${portrait}
            <div style="margin-top:6px; padding:4px 6px; background:#d8c49a; color:#2a1a08; font-size:11px; font-weight:bold; border-radius:4px; max-width:96px; word-wrap:break-word;">${escapeHtml(d.speaker || '???')}</div>
          </div>
          <div style="flex:1; background:#e8dcc0; color:#2a1a08; padding:14px; border-radius:6px; font-size:13px; line-height:1.7; min-height:120px; border:1px solid #8a6b3a;">
            ${escapeHtml(lines[idx])}
          </div>
        </div>
        <button class="action-btn" id="vn-next" style="margin-top:12px; width:100%;">${isLast ? 'Tutup' : 'Lanjut'}</button>
      `;
    };

    const bind = () => {
      const root = document.getElementById('overlay-root');
      if (!root) { finish(); return; }
      const panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (!panel) { finish(); return; }
      const btn = panel.querySelector('#vn-next');
      if (btn) btn.addEventListener('click', () => {
        if (idx < lines.length - 1) {
          idx += 1;
          panel.innerHTML = render();
          bind();
        } else {
          finish();
        }
      });
    };

    ovId = window.OverlayManager.open(render(), { closeOnBackdrop: false });
    // OverlayManager menolak layer ke-3 (MAX_DEPTH 2). Bila ditolak,
    // jangan gantung: pemanggil lanjut normal tanpa dialog.
    if (ovId === null) {
      if (typeof onDone === 'function') onDone();
      return false;
    }
    requestAnimationFrame(() => bind());
    return true;
  }

  return { load, get, has, show };
})();

if (typeof window !== 'undefined') window.VN = VN;
