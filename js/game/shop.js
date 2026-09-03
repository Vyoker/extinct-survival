/**
 * Shop Module
 * Toko item dasar (healing/energy/survival) yang dibeli pakai Rupiah
 * (mata uang in-game, bukan premium). Item Mall (Kredit/premium) dan
 * Pass masih tahap pengembangan. Juga menyediakan fitur Jual (sell)
 * untuk item yang sudah dikumpulkan player.
 */
const Shop = (function () {
  'use strict';

  const CATALOG = [
    { itemId: 'canned_food_01', price: 25 },
    { itemId: 'water_bottle_01', price: 20 },
    { itemId: 'bandage_01', price: 40 },
    { itemId: 'first_aid_kit_01', price: 150 },
    { itemId: 'energy_drink_01', price: 100 }
  ];

  // Harga jual dasar per tier rarity (dipakai untuk item yang TIDAK ada
  // di katalog beli, misal material/armor hasil scavenge/hunting)
  const SELL_BASE_BY_RARITY = {
    common: 5, uncommon: 15, rare: 40, epic: 100, legendary: 250, mythic: 600
  };
  const SELL_MULTIPLIER_FOR_CATALOG_ITEM = 0.4; // 40% dari harga beli

  function getPlayer() {
    return GameState.get().player;
  }

  function getCatalog() {
    return CATALOG.map(entry => ({
      ...entry,
      def: window.ItemDB ? ItemDB.get(entry.itemId) : null
    })).filter(entry => entry.def);
  }

  function buy(itemId, qty = 1) {
    const entry = CATALOG.find(e => e.itemId === itemId);
    if (!entry) return false;

    const p = getPlayer();
    const totalPrice = entry.price * qty;
    if (p.currency.rupiah < totalPrice) {
      Events.emit('notify', { message: 'Rupiah tidak cukup.', type: 'error' });
      return false;
    }

    p.currency.rupiah -= totalPrice;
    Inventory.addItem(itemId, qty);
    Events.emit('notify', { message: `Membeli ${qty}x item seharga Rp ${totalPrice}.` });
    Events.emit('player:updated');
    return true;
  }

  function getSellPrice(itemId) {
    const catalogEntry = CATALOG.find(e => e.itemId === itemId);
    if (catalogEntry) {
      return Math.max(1, Math.round(catalogEntry.price * SELL_MULTIPLIER_FOR_CATALOG_ITEM));
    }
    const def = window.ItemDB ? ItemDB.get(itemId) : null;
    const rarity = def ? def.rarity : 'common';
    return SELL_BASE_BY_RARITY[rarity] || SELL_BASE_BY_RARITY.common;
  }

  function sell(itemId, qty = 1) {
    const p = getPlayer();
    if (!Inventory.hasItem(itemId, qty)) {
      Events.emit('notify', { message: 'Jumlah item tidak cukup untuk dijual.', type: 'error' });
      return false;
    }
    const pricePerUnit = getSellPrice(itemId);
    const total = pricePerUnit * qty;

    Inventory.removeItem(itemId, qty);
    p.currency.rupiah += total;

    Events.emit('notify', { message: `Menjual ${qty}x item seharga Rp ${total}.` });
    Events.emit('player:updated');
    return true;
  }

  return { getCatalog, buy, getSellPrice, sell };
})();

window.Shop = Shop;
