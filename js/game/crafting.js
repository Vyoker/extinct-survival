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

    // Kurangi semua material sesuai recipe
    Object.entries(def.recipe).forEach(([matId, qty]) => {
      Inventory.removeItem(matId, qty);
    });

    // Bonus INT (Crafting Bonus dari derived stats): peluang dapat 1 item ekstra
    let qtyResult = 1;
    const craftingBonusPct = window.Player ? Player.getDerivedStats().craftingBonus : 0;
    if (Math.random() * 100 < Math.min(50, craftingBonusPct)) {
      qtyResult += 1;
    }

    Inventory.addItem(itemId, qtyResult);
    Events.emit('notify', {
      message: qtyResult > 1
        ? `🔨 Berhasil membuat ${qtyResult}x ${def.name} (bonus Crafting Bonus)!`
        : `🔨 Berhasil membuat ${def.name}.`
    });
    if (window.Skills) Skills.addSkillExp('scavenger', 2);
    Events.emit('inventory:updated');
    return true;
  }

  return { getCraftableItems, canCraft, craft };
})();

window.Crafting = Crafting;
