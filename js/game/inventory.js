/**
 * Inventory Module
 * Mengatur item di tas pemain (stackable by itemId + qty) dan slot equipment.
 * Bergantung pada ItemDB untuk data statis item.
 */
const Inventory = (function () {
  'use strict';

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getPlayer() {
    return GameState.get().player;
  }

  function getInventory() {
    return getPlayer().inventory; // array of { itemId, qty }
  }

  function findSlot(itemId) {
    return getInventory().find(entry => entry.itemId === itemId);
  }

  function addItem(itemId, qty = 1) {
    const def = ItemDB.get(itemId);
    if (!def) {
      console.warn('[Inventory] Item tidak dikenal:', itemId);
      return false;
    }
    const inv = getInventory();
    const existing = findSlot(itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      // Slot baru (item jenis baru) dibatasi kapasitas tas (dari INT).
      // Stack ke item yang sudah ada (di atas) selalu diperbolehkan.
      const maxSlots = window.Player ? Player.getDerivedStats().maxInventorySlots : 20;
      if (inv.length >= maxSlots) {
        Events.emit('notify', { message: `Tas penuh (${maxSlots} slot)! Alokasikan poin INT untuk nambah kapasitas.`, type: 'error' });
        return false;
      }
      inv.push({ itemId, qty });
    }
    Events.emit('notify', { message: `+${qty} ${def.name}` });
    Events.emit('inventory:updated');
    return true;
  }

  function removeItem(itemId, qty = 1) {
    const inv = getInventory();
    const existing = findSlot(itemId);
    if (!existing || existing.qty < qty) return false;
    existing.qty -= qty;
    if (existing.qty <= 0) {
      const idx = inv.indexOf(existing);
      inv.splice(idx, 1);
    }
    Events.emit('inventory:updated');
    return true;
  }

  function hasItem(itemId, qty = 1) {
    const existing = findSlot(itemId);
    return !!existing && existing.qty >= qty;
  }

  const ITEM_COOLDOWN_MS = 5000;

  // Item yang termasuk kategori "boost" (energy/healing) kena cooldown
  // anti-spam 5 detik supaya tidak di-spam terus-menerus.
  function isBoostItem(def) {
    return def.stats && (
      typeof def.stats.energy === 'number' ||
      typeof def.stats.health === 'number'
    );
  }

  // Item konsumsi: efek langsung ke survival stats, lalu berkurang 1 dari tas
  function useItem(itemId) {
    const def = ItemDB.get(itemId);
    if (!def || def.type !== 'consumable') {
      Events.emit('notify', { message: 'Item ini tidak bisa dipakai.', type: 'error' });
      return false;
    }
    if (!hasItem(itemId, 1)) {
      Events.emit('notify', { message: 'Kamu tidak punya item ini.', type: 'error' });
      return false;
    }
    if (isBoostItem(def) && window.Cooldown && Cooldown.isActive('item:' + itemId)) {
      Events.emit('notify', { message: `Tunggu ${Cooldown.remainingSec('item:' + itemId)} detik lagi.`, type: 'error' });
      return false;
    }

    const p = getPlayer();
    const stats = def.stats || {};
    if (stats.hunger) p.survival.hunger = clamp(p.survival.hunger + stats.hunger, 0, 100);
    if (stats.thirst) p.survival.thirst = clamp(p.survival.thirst + stats.thirst, 0, 100);
    if (stats.health) p.survival.health = clamp(p.survival.health + stats.health, 0, 100);
    if (stats.sanity) p.survival.sanity = clamp(p.survival.sanity + stats.sanity, 0, 100);
    if (stats.energy) p.energy = clamp(p.energy + stats.energy, 0, p.maxEnergy);

    removeItem(itemId, 1);
    Events.emit('notify', { message: `Menggunakan ${def.name}.` });
    Events.emit('player:updated');
    if (window.Skills) Skills.addSkillExp('survivor', 3);
    if (isBoostItem(def) && window.Cooldown) Cooldown.start('item:' + itemId, ITEM_COOLDOWN_MS);
    return true;
  }

  // Menentukan slot equipment berdasarkan tipe item.
  // Untuk MVP: hanya 'weapon' yang mapped otomatis; tipe lain (armor set)
  // bisa ditambah item.slot eksplisit di data JSON nanti.
  function getSlotForItem(def) {
    if (def.slot) return def.slot;
    if (def.type === 'weapon') return 'weapon';
    return null;
  }

  function equipItem(itemId) {
    const def = ItemDB.get(itemId);
    if (!def) return false;
    const slot = getSlotForItem(def);
    if (!slot) {
      Events.emit('notify', { message: 'Item ini tidak bisa dipakai sebagai equipment.', type: 'error' });
      return false;
    }
    if (!hasItem(itemId, 1)) {
      Events.emit('notify', { message: 'Kamu tidak punya item ini.', type: 'error' });
      return false;
    }

    const p = getPlayer();
    // Lepas item lama di slot itu (kembalikan ke tas) sebelum pasang yang baru
    const currentEquipped = p.equipment[slot];
    if (currentEquipped && currentEquipped.itemId) {
      addItem(currentEquipped.itemId, 1);
    }

    const maxDur = def.stats && typeof def.stats.durability === 'number' ? def.stats.durability : null;
    p.equipment[slot] = { itemId, durability: maxDur };
    removeItem(itemId, 1);

    Events.emit('notify', { message: `${def.name} dipasang di slot ${slot}.` });
    Events.emit('player:updated');
    Events.emit('inventory:updated');
    return true;
  }

  function unequipItem(slot) {
    const p = getPlayer();
    const equipped = p.equipment[slot];
    if (!equipped || !equipped.itemId) return false;
    p.equipment[slot] = null;
    addItem(equipped.itemId, 1);
    Events.emit('player:updated');
    Events.emit('inventory:updated');
    return true;
  }

  const ALL_EQUIP_SLOTS = ['head', 'chest', 'legs', 'weapon', 'offhand', 'accessory'];

  // Kurangi durability SEMUA equipment yang terpasang (dipanggil tiap
  // Attack di battle) — disamakan mekanismenya untuk semua slot, bukan
  // cuma senjata. Item yang habis durability-nya patah & otomatis lepas
  // (tidak kembali ke tas).
  function reduceEquipmentDurability(amount = 1) {
    const p = getPlayer();
    ALL_EQUIP_SLOTS.forEach(slot => {
      const equipped = p.equipment[slot];
      if (!equipped || equipped.durability === null || typeof equipped.durability !== 'number') return;

      equipped.durability = Math.max(0, equipped.durability - amount);
      if (equipped.durability <= 0) {
        const def = ItemDB.get(equipped.itemId);
        p.equipment[slot] = null;
        Events.emit('notify', { message: `💔 ${def ? def.name : 'Equipment'} rusak karena terlalu sering dipakai!`, type: 'error' });
      }
    });
    Events.emit('inventory:updated');
  }

  // Total damage dari weapon yang terpasang
  function getEquippedWeaponDamage() {
    const p = getPlayer();
    const weapon = p.equipment.weapon;
    if (!weapon || !weapon.itemId) return 3; // damage tangan kosong (unarmed)
    const def = ItemDB.get(weapon.itemId);
    return (def && def.stats && def.stats.damage) || 3;
  }

  // Total defense (persen) dari semua armor yang terpasang (head/chest/
  // legs/offhand/accessory) — dijumlah, dipakai di Player.getDerivedStats()
  function getEquipmentDefenseBonus() {
    const p = getPlayer();
    let total = 0;
    ['head', 'chest', 'legs', 'offhand', 'accessory'].forEach(slot => {
      const equipped = p.equipment[slot];
      if (equipped && equipped.itemId) {
        const def = ItemDB.get(equipped.itemId);
        if (def && def.stats && typeof def.stats.defense === 'number') {
          total += def.stats.defense;
        }
      }
    });
    return total;
  }

  // Hitung biaya repair (material + rupiah) berdasarkan durability yang
  // hilang. Kalau item punya recipe, materialnya mengikuti proporsi
  // recipe asli (60% dari kekurangan). Kalau tidak punya recipe (item
  // hasil temuan), fallback pakai scrap_metal generik. Berlaku untuk
  // SEMUA jenis equipment (bukan cuma senjata).
  function getRepairCost(itemId, missingDurability) {
    const def = ItemDB.get(itemId);
    if (!def || !def.stats || !def.stats.durability) return null;

    const missingFraction = missingDurability / def.stats.durability;
    const materials = {};

    if (def.recipe) {
      Object.entries(def.recipe).forEach(([matId, qty]) => {
        materials[matId] = Math.max(1, Math.ceil(qty * missingFraction * 0.6));
      });
    } else {
      materials['scrap_metal'] = Math.max(1, Math.ceil(missingDurability / 15));
    }

    const rupiah = Math.max(5, Math.round(missingDurability * 3));
    return { materials, rupiah };
  }

  function canRepairSlot(slot) {
    const p = getPlayer();
    const equipped = p.equipment[slot];
    if (!equipped || !equipped.itemId) return false;
    const def = ItemDB.get(equipped.itemId);
    if (!def || !def.stats || !def.stats.durability) return false;
    if (equipped.durability >= def.stats.durability) return false;

    const missing = def.stats.durability - equipped.durability;
    const cost = getRepairCost(equipped.itemId, missing);
    if (!cost) return false;

    const hasMaterials = Object.entries(cost.materials).every(([matId, qty]) => hasItem(matId, qty));
    return hasMaterials && p.currency.rupiah >= cost.rupiah;
  }

  function repairSlot(slot) {
    const p = getPlayer();
    const equipped = p.equipment[slot];
    if (!equipped || !equipped.itemId) {
      Events.emit('notify', { message: 'Tidak ada item terpasang di slot ini.', type: 'error' });
      return false;
    }
    const def = ItemDB.get(equipped.itemId);
    if (!def || !def.stats || !def.stats.durability) {
      Events.emit('notify', { message: 'Item ini tidak punya durability.', type: 'error' });
      return false;
    }
    if (equipped.durability >= def.stats.durability) {
      Events.emit('notify', { message: 'Item sudah dalam kondisi penuh.', type: 'error' });
      return false;
    }

    const missing = def.stats.durability - equipped.durability;
    const cost = getRepairCost(equipped.itemId, missing);
    const hasMaterials = Object.entries(cost.materials).every(([matId, qty]) => hasItem(matId, qty));

    if (!hasMaterials || p.currency.rupiah < cost.rupiah) {
      Events.emit('notify', { message: 'Material atau Rupiah tidak cukup untuk perbaikan.', type: 'error' });
      return false;
    }

    Object.entries(cost.materials).forEach(([matId, qty]) => removeItem(matId, qty));
    p.currency.rupiah -= cost.rupiah;
    equipped.durability = def.stats.durability;

    Events.emit('notify', { message: `🔧 ${def.name} berhasil diperbaiki (full durability).` });
    Events.emit('player:updated');
    Events.emit('inventory:updated');
    return true;
  }

  return {
    getInventory, addItem, removeItem, hasItem, useItem,
    equipItem, unequipItem, getEquippedWeaponDamage, getSlotForItem,
    reduceEquipmentDurability, getEquipmentDefenseBonus, isBoostItem,
    getRepairCost, canRepairSlot, repairSlot
  };
})();

window.Inventory = Inventory;
