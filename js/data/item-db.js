/**
 * Item Database
 * Memuat data item dari js/data/items.json dan menyediakan lookup cepat.
 */
const ItemDB = (function () {
  'use strict';

  let items = {};
  let loaded = false;

  async function load() {
    if (loaded) return items;
    try {
      const res = await fetch('js/data/items.json');
      const list = await res.json();
      items = {};
      list.forEach(item => { items[item.id] = item; });
      loaded = true;
    } catch (e) {
      console.error('[ItemDB] Gagal memuat items.json:', e);
    }
    return items;
  }

  function get(itemId) {
    return items[itemId] || null;
  }

  function all() {
    return items;
  }

  function isLoaded() {
    return loaded;
  }

  return { load, get, all, isLoaded };
})();

window.ItemDB = ItemDB;
