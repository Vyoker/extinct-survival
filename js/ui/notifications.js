/**
 * Notifications
 * Menampilkan toast dari bawah layar. Terhubung ke event 'notify'.
 */
const Notifications = (function () {
  'use strict';

  function show(message, type = 'info', duration = 2500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function init() {
    Events.on('notify', (payload) => {
      show(payload.message, payload.type || 'info');
    });
  }

  return { show, init };
})();

window.Notifications = Notifications;
