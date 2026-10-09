/**
 * CreditSync (v0.3.3) — sinkronisasi kiriman kredit MANUAL dari admin.
 *
 * Admin mengirim kredit ke KODE SAVE cloud player (bukan nama, supaya
 * tidak bisa diintip orang lain). Modul ini mengecek kiriman baru tiap
 * 30 detik + sekali saat game dibuka, lalu:
 *  1. Tambahkan kredit ke player + toast notifikasi.
 *  2. Tandai grant sebagai diterima (ack) supaya tidak dikirim ulang.
 *
 * Grant yang sudah di-apply dicatat di localStorage (anti double-apply
 * walau ack gagal terkirim). Diam total bila offline / bukan Netlify.
 */
const CreditSync = (function () {
  'use strict';

  var API_BASE = '/.netlify/functions';
  var APPLIED_KEY = 'extinct_survival_credit_applied';
  var POLL_MS = 30000;
  var handle = null;

  function getApplied() {
    try { return JSON.parse(localStorage.getItem(APPLIED_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveApplied(ids) {
    try { localStorage.setItem(APPLIED_KEY, JSON.stringify(ids.slice(-200))); }
    catch (e) { /* abaikan */ }
  }

  async function poll() {
    var code = (window.CloudSave && CloudSave.getCode && CloudSave.getCode()) || null;
    if (!code) return; // belum pernah Simpan Online -> tidak bisa menerima kiriman manual
    try {
      var res = await fetch(API_BASE + '/credit-pending?who=' + encodeURIComponent(code));
      if (!res.ok) return;
      var data = await res.json().catch(function () { return {}; });
      var grants = (data && data.grants) || [];
      if (!grants.length) return;

      var applied = getApplied();
      var fresh = grants.filter(function (g) { return applied.indexOf(g.id) === -1; });

      if (fresh.length && window.GameState) {
        var st = GameState.get();
        var total = 0;
        fresh.forEach(function (g) {
          var k = parseInt(g.kredit, 10);
          if (k > 0) {
            st.currency.kredit += k;
            total += k;
            applied.push(g.id);
          }
        });
        if (total > 0) {
          GameState.save();
          saveApplied(applied);
          if (window.Events) {
            Events.emit('player:updated');
            Events.emit('notify', { message: 'Kredit masuk! +' + total.toLocaleString('id-ID') + ' dari admin.' });
          }
        }
      }

      // Ack semua grant yang terlihat (termasuk yang sudah di-apply
      // sebelumnya tapi ack-nya sempat gagal) supaya tidak menumpuk.
      var ids = grants.map(function (g) { return g.id; });
      if (ids.length) {
        fetch(API_BASE + '/credit-ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ who: code, ids: ids })
        }).catch(function () { /* ack dicoba lagi di poll berikutnya */ });
      }
    } catch (e) {
      /* offline / bukan Netlify -> diam */
    }
  }

  function start() {
    if (handle) return;
    poll();
    handle = setInterval(poll, POLL_MS);
  }

  return { poll: poll, start: start };
})();

window.CreditSync = CreditSync;
