/**
 * Version
 * Format: v0.0.X — naik tiap update (v0.0.6 -> v0.0.7 -> ... -> v0.0.9),
 * setelah X mencapai 9, lanjut ke v0.1.0, lalu v0.1.1, dst.
 * Update angka ini manual tiap kali ada rilis baru.
 */
const APP_VERSION = '0.3.5';
window.APP_VERSION = APP_VERSION;

// v0.3.4-hotfix: label versi di layar login selalu mengikuti APP_VERSION,
// supaya tidak perlu diubah manual tiap rilis (sebelumnya tertinggal "v0.3.0").
(function stampLoginVersion() {
  function apply() {
    var el = document.getElementById('login-version');
    if (el) el.textContent = 'v' + APP_VERSION;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
