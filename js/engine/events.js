/**
 * Event System - pola publish/subscribe sederhana
 * Dipakai untuk komunikasi antar modul (game, ui, engine) tanpa coupling.
 */
const Events = (function () {
  'use strict';

  const listeners = {};

  function on(eventName, callback) {
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(callback);
    return () => off(eventName, callback); // return unsubscribe function
  }

  function off(eventName, callback) {
    if (!listeners[eventName]) return;
    listeners[eventName] = listeners[eventName].filter(cb => cb !== callback);
  }

  function emit(eventName, payload) {
    if (!listeners[eventName]) return;
    listeners[eventName].forEach(cb => {
      try {
        cb(payload);
      } catch (e) {
        console.error(`[Events] Error di listener "${eventName}":`, e);
      }
    });
  }

  function once(eventName, callback) {
    const unsub = on(eventName, (payload) => {
      unsub();
      callback(payload);
    });
  }

  return { on, off, emit, once };
})();

window.Events = Events;
