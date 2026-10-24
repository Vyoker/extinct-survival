/**
 * Crafting Module
 * Membuat item (senjata/armor/consumable) dari material di tas sesuai
 * recipe yang didefinisikan di items.json (field `recipe` + `craftable`).
 */
const Crafting = (function () {
  'use strict';

  function getPlayer() {
    return GameState.get().player;
  }

  // Semua item yang punya recipe & craftable=true
  function getCraftableItems() {
    const all = ItemDB.all();
    return Object.values(all).filter(def => def.craftable && def.recipe);
  }

  // Cek apakah player punya semua material yang cukup untuk 1x craft
  function canCraft(itemId) {
    const def = ItemDB.get(itemId);
    if (!def || !def.craftable || !def.recipe) return false;
    return Object.entries(def.recipe).every(([matId, qty]) => Inventory.hasItem(matId, qty));
  }

  // v0.6.9: apakah hasil craft muat di tas? Jenis yang sudah ada
  // (stack) selalu muat; jenis baru butuh 1 slot kosong. Cerminan
  // aturan Inventory.addItem — dipakai sebagai pra-cek supaya
  // material tidak terpotong sia-sia bila tas penuh.
  // Catatan defensif: hanya entri qty > 0 yang dihitung (di
  // inventory asli entri 0 langsung dihapus), dan maxSlots
  // jatuh ke 20 bila derived stats tidak membawa fieldnya —
  // tanpa ini, maxSlots undefined membuat semua craft gagal.
  function fitsInBag(itemId) {
    const inv = Inventory.getInventory();
    const live = inv.filter(entry => entry.qty > 0);
    if (live.some(entry => entry.itemId === itemId)) return true;
    const stats = window.Player ? Player.getDerivedStats() : null;
    const maxSlots = (stats && typeof stats.maxInventorySlots === 'number') ? stats.maxInventorySlots : 20;
    return live.length < maxSlots;
  }

  function craft(itemId) {
    const def = ItemDB.get(itemId);
    if (!def || !def.craftable || !def.recipe) {
      Events.emit('notify', { message: 'Item ini tidak bisa dibuat.', type: 'error' });
      return false;
    }
    if (!canCraft(itemId)) {
      Events.emit('notify', { message: 'Material tidak cukup untuk membuat item ini.', type: 'error' });
      return false;
    }
    // v0.6.9 FIX (bug: item hasil craft hilang): dulu material
    // dipotong dulu lalu hasil addItem DIABAIKAN — bila tas penuh
    // untuk jenis baru (mis. Homemade Pistol pertama), addItem
    // gagal diam-diam, material hangus, tapi toast tetap bilang
    // "Berhasil membuat". Kini: tolak sejak awal bila tidak muat.
    if (!fitsInBag(itemId)) {
      Events.emit('notify', { message: 'Tas penuh! Hasil craft tidak muat — material tidak dipotong.', type: 'error' });
      return false;
    }

    // Kurangi semua material sesuai recipe
    Object.entries(def.recipe).forEach(([matId, qty]) => {
      Inventory.removeItem(matId, qty);
    });

    // v0.6.5: item bisa punya hasil racik banyak (resultQty, mis.
    // peluru x5 per racik). Bonus INT (Crafting Bonus dari derived
    // stats): peluang dapat 1 item ekstra di atas hasil dasar.
    let qtyResult = def.resultQty || 1;
    const craftingBonusPct = window.Player ? Player.getDerivedStats().craftingBonus : 0;
    const gotBonus = Math.random() * 100 < Math.min(50, craftingBonusPct);
    if (gotBonus) qtyResult += 1;

    // v0.6.9: pengaman lapis kedua — bila addItem secara EKSPLISIT
    // mengembalikan false, kembalikan SEMUA material (refund) dan
    // laporkan gagal, jangan pernah mengaku berhasil tanpa item.
    // (Perbandingan === false, bukan falsy: implementasi addItem
    // yang tidak mengembalikan status — undefined — tetap
    // dianggap berhasil seperti perilaku lama.)
    if (Inventory.addItem(itemId, qtyResult) === false) {
      Object.entries(def.recipe).forEach(([matId, qty]) => {
        Inventory.addItem(matId, qty);
      });
      Events.emit('notify', { message: 'Craft gagal: hasil tidak muat di tas. Material dikembalikan.', type: 'error' });
      return false;
    }
    if (window.AudioManager) AudioManager.sfx('craft'); // v0.3.8
    Events.emit('notify', {
      message: qtyResult > 1
        ? `🔨 Berhasil membuat ${qtyResult}x ${def.name}${gotBonus ? ' (bonus Crafting Bonus!)' : ''}.`
        : `🔨 Berhasil membuat ${def.name}.`
    });
    if (window.Skills) Skills.addSkillExp('scavenger', 2);
    Events.emit('inventory:updated');
    return true;
  }

  return { getCraftableItems, canCraft, craft };
})();

window.Crafting = Crafting;
