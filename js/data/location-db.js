/**
 * Location Database
 * Memuat data lokasi (deskripsi, scavenge loot, daftar musuh) dari
 * js/data/locations.json.
 */
const LocationDB = (function () {
  'use strict';

  let locations = {};
  let loaded = false;

  async function load() {
    if (loaded) return locations;
    try {
      const res = await fetch('js/data/locations.json');
      const list = await res.json();
      locations = {};
      list.forEach(loc => { locations[loc.id] = loc; });
      loaded = true;
    } catch (e) {
      console.error('[LocationDB] Gagal memuat locations.json:', e);
    }
    return locations;
  }

  function get(locationId) {
    return locations[locationId] || null;
  }

  function all() {
    return locations;
  }

  return { load, get, all };
})();

window.LocationDB = LocationDB;
