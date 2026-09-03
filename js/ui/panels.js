/**
 * Panels
 * Mengatur konten #main-panel berdasarkan nav yang dipilih.
 */
const Panels = (function () {
  'use strict';

  // Sub-view lokal untuk tab Jelajah (tidak disimpan di gameState,
  // kecuali battle yang persist lewat gameState.combat).
  let explorationView = 'menu'; // 'menu' | 'travel' | 'hunting'

  const SLOT_LABELS = {
    head: '🪖',
    chest: '👕',
    legs: '👖',
    weapon: '🗡️',
    offhand: '🛡️',
    accessory: '📿'
  };

  // =========================================================
  // DASHBOARD
  // =========================================================
  function renderDashboard() {
    const p = GameState.get().player;
    const world = GameState.get().world;
    const derived = Player.getDerivedStats();

    const equipmentChips = Object.keys(SLOT_LABELS).map(slot => {
      const equipped = p.equipment[slot];
      const def = equipped && equipped.itemId ? ItemDB.get(equipped.itemId) : null;
      const durText = def && equipped.durability !== null && equipped.durability !== undefined && def.stats && def.stats.durability
        ? `<span class="slot-dur">${equipped.durability}/${def.stats.durability}</span>` : '';
      return `<div class="equip-slot-cell ${def ? 'filled' : ''}" data-equip-slot="${slot}">
                <span class="slot-tag">${SLOT_LABELS[slot]}</span>
                ${def ? iconImgHtml(def.icon, def.name) : ''}
                ${durText}
              </div>`;
    }).join('');

    return `
      <h2 class="panel-title">🏠 Dashboard</h2>

      <div class="card">
        <div class="card-row"><span>Nama</span><span>${p.name}</span></div>
        <div class="card-row"><span>Level</span><span>${p.level}</span></div>
        <div class="card-row"><span>Lokasi</span><span>${(LocationDB.get(p.location) || {}).name || p.location}</span></div>
        <div class="card-row"><span>Faksi</span><span>${p.faction || 'Tidak ada'}</span></div>
        <div class="card-row"><span>Hari ke</span><span>${world.day}</span></div>
        <div class="card-row"><span>Cuaca</span><span>${world.weather}</span></div>
      </div>

      <div class="card">
        <div class="card-row"><span>Rupiah</span><span>Rp ${p.currency.rupiah.toLocaleString('id-ID')}</span></div>
        <div class="card-row"><span>Kredit</span><span>💎 ${p.currency.kredit}</span></div>
        <div class="card-row"><span>⚡ Energy</span><span>${p.energy}/${p.maxEnergy}</span></div>
      </div>

      ${renderQuestCard()}
      ${renderFactionCard()}

      <div style="color:var(--accent-orange); font-size:13px; margin:14px 0 8px;">ATRIBUT</div>
      <div class="attr-columns">
        <div class="card attr-col">
          <div class="attr-col-title">Dasar</div>
          <div class="card-row"><span>ATK</span><span>${p.stats.atk}</span></div>
          <div class="card-row"><span>DEF</span><span>${p.stats.def}</span></div>
          <div class="card-row"><span>DEX</span><span>${p.stats.dex}</span></div>
          <div class="card-row"><span>INT</span><span>${p.stats.int}</span></div>
        </div>
        <div class="card attr-col">
          <div class="attr-col-title">Efek (setelah equip)</div>
          <div class="card-row"><span>⚔️ Damage</span><span>${derived.totalDamage}</span></div>
          <div class="card-row"><span>💥 Crit</span><span>${derived.critChance}%</span></div>
          <div class="card-row"><span>🛡️ Defense</span><span>${derived.defensePct}%</span></div>
          <div class="card-row"><span>🌀 Evasion</span><span>${derived.evasionChance}%</span></div>
          <div class="card-row"><span>🏃 Flee</span><span>${derived.fleeChance}%</span></div>
          <div class="card-row"><span>🔧 Craft</span><span>+${derived.craftingBonus}%</span></div>
        </div>
      </div>
      <p style="font-size:10px; color:var(--text-dim); margin:4px 0 0;">
        ATK → Damage senjata • DEF → Defense • DEX → Crit & Evasion (+peluang Flee) •
        INT → bonus Crafting, Loot & kapasitas slot Tas.
      </p>

      <div style="color:var(--accent-orange); font-size:13px; margin:14px 0 8px; display:flex; justify-content:space-between; align-items:center;">
        <span>ATTRIBUTE POINT</span>
        <span style="color:var(--text-primary);">${p.attributePoints} poin tersedia</span>
      </div>
      <div class="card point-alloc-card">
        ${renderPointRow('atk', '⚔️ ATK (Damage)', p.stats.atk * Player.POINT_VALUE_PCT)}
        ${renderPointRow('def', '🛡️ DEF (Defense)', p.stats.def * Player.POINT_VALUE_PCT)}
        ${renderPointRow('dex', '🌀 DEX (Crit/Evasion)', p.stats.dex * Player.POINT_VALUE_PCT)}
        ${renderPointRow('int', '🔧 INT (Craft/Loot/Slot)', p.stats.int * Player.INT_VALUE_PCT)}
        <p style="font-size:10px; color:var(--text-dim); margin-top:8px;">
          1 poin ATK/DEF/DEX = +0.2% status. 1 poin INT = +0.4% Craft &amp; Loot,
          +1 slot Tas. +5 poin tiap naik level. Alokasi bersifat permanen.
        </p>
      </div>

      <div style="color:var(--accent-orange); font-size:13px; margin:14px 0 8px;">EQUIPMENT</div>
      <div class="equip-slot-grid">
        ${equipmentChips}
      </div>
      <p style="font-size:11px; color:var(--text-dim); margin-top:6px;">
        Tap slot untuk lihat detail, lepas, atau perbaiki.
      </p>
    `;
  }

  function renderPointRow(category, label, currentPct) {
    const canAdd = Player.canAllocate(category);
    return `
      <div class="point-row">
        <span class="point-label">${label}</span>
        <span class="point-value">+${Math.round(currentPct * 10) / 10}%</span>
        <button class="mini-btn point-add-btn" data-allocate="${category}" ${canAdd ? '' : 'disabled'}>+1</button>
      </div>
    `;
  }

  // Card ringkas misi di Dashboard (tap untuk buka daftar lengkap).
  // Sekarang bisa ada BANYAK quest aktif ditumpuk sekaligus (main+side),
  // jadi card ini cuma nunjukkin ringkasan: jumlah aktif & berapa yang
  // siap diklaim, bukan 1 judul quest tunggal seperti sebelumnya.
  function renderQuestCard() {
    if (!window.QuestSystem) return '';
    const accepted = QuestSystem.getAcceptedQuests();
    const readyCount = accepted.filter(q => QuestSystem.isQuestComplete(q.id)).length;
    const availableCount = QuestSystem.getAvailableQuests().length;

    if (accepted.length === 0 && availableCount === 0) {
      return `
        <div class="card" style="margin-top:0;">
          <div class="card-row"><span>🎯 Misi</span><span style="color:#22c55e;">Semua misi selesai!</span></div>
        </div>
      `;
    }

    const summaryText = accepted.length === 0
      ? `${availableCount} misi baru tersedia`
      : `${accepted.length} misi aktif${readyCount > 0 ? ` • ${readyCount} siap diklaim!` : ''}`;

    return `
      <div class="card quest-card" id="dash-quest-card" style="margin-top:0; cursor:pointer;">
        <div class="card-row"><span>🎯 Misi</span><span style="color:${readyCount > 0 ? '#22c55e' : 'var(--text-primary)'};">${summaryText}</span></div>
      </div>
    `;
  }

  function renderFactionCard() {
    if (!window.FactionSystem || !window.FactionDB) return '';
    const factionId = FactionSystem.getCurrentFactionId();

    if (!factionId) {
      return `
        <div class="card faction-card" id="dash-faction-card" style="margin-top:0; cursor:pointer;">
          <div class="card-row"><span>🏴 Faksi</span><span>Belum gabung — tap untuk pilih</span></div>
        </div>
      `;
    }

    const f = FactionDB.get(factionId);
    if (!f) return '';
    const rank = FactionSystem.getRankInfo(factionId);
    const coins = FactionSystem.getCoins(factionId);

    return `
      <div class="card faction-card" id="dash-faction-card" style="margin-top:0; cursor:pointer; border-color:${f.color};">
        <div class="card-row"><span>${f.icon} ${f.name}</span><span style="color:${f.color};">${rank.name}</span></div>
        <div class="card-row"><span>🪙 Koin Faksi</span><span>${coins}</span></div>
      </div>
    `;
  }

  function bindDashboardEvents() {
    const main = document.getElementById('main-panel');

    main.querySelectorAll('[data-allocate]').forEach(btn => {
      btn.addEventListener('click', () => {
        Player.allocatePoint(btn.dataset.allocate);
        render('dashboard');
        Renderer.renderHUD();
      });
    });

    main.querySelectorAll('[data-equip-slot]').forEach(cell => {
      cell.addEventListener('click', () => openEquipSlotPopup(cell.dataset.equipSlot));
    });

    const questCard = main.querySelector('#dash-quest-card');
    if (questCard) questCard.addEventListener('click', () => openQuestListOverlay());

    const factionCard = main.querySelector('#dash-faction-card');
    if (factionCard) factionCard.addEventListener('click', () => openFactionOverlay());
  }

  // =========================================================
  // JELAJAH - Menu utama (lokasi + 3 opsi)
  // =========================================================
  function renderExplorationMenu() {
    const p = GameState.get().player;
    const loc = Exploration.getCurrentLocation();
    if (!loc) return `<p>Data lokasi tidak ditemukan.</p>`;

    const scavengeDisabled = !Exploration.canScavenge();
    const huntDisabled = !Exploration.canHunt();
    const travelDisabled = !Exploration.canTravel();

    const scavengeLabel = Cooldown.isActive('scavenge')
      ? `⏳ Tunggu ${Cooldown.remainingSec('scavenge')}s`
      : `🧰 Scavenge (${Exploration.SCAVENGE_ENERGY_COST}⚡)`;
    const travelLabel = Cooldown.isActive('travel')
      ? `⏳ Tunggu ${Cooldown.remainingSec('travel')}s`
      : `🚚 Travel (${Exploration.TRAVEL_ENERGY_COST}⚡)`;

    return `
      <h2 class="panel-title">🗺️ Jelajah</h2>

      <div class="card">
        <div class="location-name">${loc.name}</div>
        <p class="location-desc">${loc.description}</p>
        <div class="card-row"><span>⚡ Energy</span><span>${p.energy}/${p.maxEnergy}</span></div>
      </div>

      <button class="action-btn" id="btn-do-scavenge" ${scavengeDisabled ? 'disabled' : ''}>
        ${scavengeLabel}
      </button>
      <button class="action-btn" id="btn-goto-hunting" ${huntDisabled ? 'disabled' : ''}>
        🏹 Hunting (${Exploration.HUNTING_ENERGY_COST}⚡)
      </button>
      <button class="action-btn" id="btn-goto-travel" ${travelDisabled ? 'disabled' : ''}>
        ${travelLabel}
      </button>
    `;
  }

  function bindExplorationMenuEvents() {
    const main = document.getElementById('main-panel');

    const btnScavenge = main.querySelector('#btn-do-scavenge');
    if (btnScavenge) {
      btnScavenge.addEventListener('click', () => {
        Exploration.scavenge();
        renderExploration();
      });
    }

    const btnHunting = main.querySelector('#btn-goto-hunting');
    if (btnHunting) {
      btnHunting.addEventListener('click', () => {
        explorationView = 'hunting';
        renderExploration();
      });
    }

    const btnTravel = main.querySelector('#btn-goto-travel');
    if (btnTravel) {
      btnTravel.addEventListener('click', () => {
        explorationView = 'travel';
        renderExploration();
      });
    }
  }

  // =========================================================
  // JELAJAH - Travel (pilih lokasi tujuan)
  // =========================================================
  function renderTravel() {
    const others = Exploration.getAllOtherLocations();
    const rows = others.map(loc => `
      <div class="card travel-row">
        <div>
          <div class="location-name" style="font-size:13px;">${loc.name}</div>
          <p class="location-desc" style="margin:2px 0 0;">${loc.description}</p>
        </div>
        <button class="mini-btn" data-travel-to="${loc.id}">Pergi</button>
      </div>
    `).join('');

    return `
      <h2 class="panel-title">🚚 Travel</h2>
      <button class="action-btn secondary" id="btn-back-menu">← Kembali</button>
      <div style="margin-top:10px;">${rows}</div>
    `;
  }

  function bindTravelEvents() {
    const main = document.getElementById('main-panel');
    main.querySelectorAll('[data-travel-to]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ok = Exploration.travelTo(btn.dataset.travelTo);
        if (ok) {
          explorationView = 'menu';
          renderExploration();
          Renderer.renderHUD();
        }
      });
    });
    bindBackButton();
  }

  // =========================================================
  // JELAJAH - Hunting (pilih target lalu masuk battle)
  // =========================================================
  function renderHuntingSelect() {
    const loc = Exploration.getCurrentLocation();
    const enemies = (loc && loc.enemies) || [];

    const rows = enemies.map(en => `
      <div class="card travel-row">
        <div>
          <div class="location-name" style="font-size:13px;">${en.name}</div>
          <p class="location-desc" style="margin:2px 0 0;">HP ${en.hp} • Damage ${en.damageMin}-${en.damageMax}</p>
        </div>
        <button class="mini-btn" data-hunt-target="${en.id}">Buru</button>
      </div>
    `).join('');

    return `
      <h2 class="panel-title">🏹 Hunting - ${loc ? loc.name : ''}</h2>
      <button class="action-btn secondary" id="btn-back-menu">← Kembali</button>
      <div style="margin-top:10px;">
        ${rows || '<p style="font-size:12px;color:var(--text-dim);">Tidak ada target buruan di sini.</p>'}
      </div>
    `;
  }

  function bindHuntingSelectEvents() {
    const main = document.getElementById('main-panel');
    main.querySelectorAll('[data-hunt-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = GameState.get().player;
        if (!Exploration.canHunt()) {
          Events.emit('notify', { message: 'Energy tidak cukup untuk berburu.', type: 'error' });
          return;
        }
        const loc = Exploration.getCurrentLocation();
        const enemyDef = loc.enemies.find(e => e.id === btn.dataset.huntTarget);
        if (!enemyDef) return;

        p.energy -= Exploration.HUNTING_ENERGY_COST;

        // Tandai battle sedang berlangsung + simpan, supaya kalau app
        // ditutup/reload di tengah battle, energy ini bisa dikembalikan
        // saat game dibuka lagi (lihat main.js recoverInterruptedBattle).
        p.battleInProgress = { energyCost: Exploration.HUNTING_ENERGY_COST, startedAt: Date.now() };
        GameState.save();
        Renderer.renderHUD();

        BattleBridge.startHunt(enemyDef, () => {
          explorationView = 'menu';
          render('exploration');
          Renderer.renderHUD();
        });
      });
    });
    bindBackButton();
  }

  function bindBackButton() {
    const main = document.getElementById('main-panel');
    const backBtn = main.querySelector('#btn-back-menu');
    if (backBtn) backBtn.addEventListener('click', () => {
      explorationView = 'menu';
      renderExploration();
    });
  }

  // Router internal untuk tab Jelajah
  function renderExploration() {
    const main = document.getElementById('main-panel');

    if (explorationView === 'travel') {
      main.innerHTML = renderTravel();
      bindTravelEvents();
    } else if (explorationView === 'hunting') {
      main.innerHTML = renderHuntingSelect();
      bindHuntingSelectEvents();
    } else {
      main.innerHTML = renderExplorationMenu();
      bindExplorationMenuEvents();
    }
  }

  // =========================================================
  // INVENTORY (grid icon compact + mini popup, ala referensi Day R)
  // =========================================================
  const EQUIP_SLOT_LABELS = {
    head: '🪖', chest: '👕', legs: '👖',
    weapon: '🗡️', offhand: '🛡️', accessory: '📿'
  };
  const EQUIP_SLOT_NAMES = {
    head: 'Kepala', chest: 'Badan', legs: 'Kaki',
    weapon: 'Senjata', offhand: 'Tangan Kiri', accessory: 'Aksesoris'
  };

  // Helper: <img> icon item dengan fallback blok putih kalau file belum ada
  function iconImgHtml(iconFilename, altText) {
    const src = iconFilename ? `assets/images/items/${iconFilename}` : 'assets/images/items/_placeholder.png';
    return `<img src="${src}" alt="${(altText || '').replace(/"/g, '')}" onerror="this.onerror=null;this.src='assets/images/items/_placeholder.png';">`;
  }

  function renderInventory() {
    const p = GameState.get().player;
    const inv = Inventory.getInventory();

    const equipSlotCells = Object.keys(EQUIP_SLOT_LABELS).map(slot => {
      const equipped = p.equipment[slot];
      const def = equipped && equipped.itemId ? ItemDB.get(equipped.itemId) : null;
      const durText = def && equipped.durability !== null && equipped.durability !== undefined && def.stats && def.stats.durability
        ? `${equipped.durability}/${def.stats.durability}` : '';
      return `
        <div class="equip-slot-cell ${def ? 'filled' : ''}" data-equip-slot="${slot}">
          <span class="slot-tag">${EQUIP_SLOT_LABELS[slot]}</span>
          ${def ? iconImgHtml(def.icon, def.name) : ''}
          ${durText ? `<span class="slot-dur">${durText}</span>` : ''}
        </div>`;
    }).join('');

    const itemCells = inv.length === 0
      ? `<p style="font-size:12px; color:var(--text-dim); grid-column:1/-1;">Tas kosong. Coba scavenge di tab Jelajah.</p>`
      : inv.map(entry => {
          const def = ItemDB.get(entry.itemId);
          if (!def) return '';
          return `
            <div class="icon-cell rarity-${def.rarity}" data-item-detail="${entry.itemId}">
              ${iconImgHtml(def.icon, def.name)}
              <span class="icon-cell-qty">x${entry.qty}</span>
            </div>`;
        }).join('');

    return `
      <h2 class="panel-title">🎒 Inventaris & Equipment</h2>

      <div style="color:var(--accent-orange); font-size:12px; margin-bottom:6px;">EQUIPMENT</div>
      <div class="equip-slot-grid">${equipSlotCells}</div>

      <button class="action-btn" id="btn-open-crafting">🔨 Crafting</button>

      <div style="margin-top:16px; color:var(--accent-orange); font-size:13px; margin-bottom:8px;">TAS (${inv.reduce((a,e)=>a+e.qty,0)} item)</div>
      <div class="icon-grid">${itemCells}</div>
    `;
  }

  // --- Mini popup: detail equip slot (Lepas / Perbaiki di dalam popup) ---
  function renderEquipSlotPopup(slot) {
    const p = GameState.get().player;
    const equipped = p.equipment[slot];
    const def = equipped && equipped.itemId ? ItemDB.get(equipped.itemId) : null;

    if (!def) {
      return `
        <div class="mini-popup-header">
          <div class="mini-popup-icon">${iconImgHtml(null, 'Kosong')}</div>
          <div class="mini-popup-titles">
            <div class="mini-popup-name">${EQUIP_SLOT_NAMES[slot]}</div>
            <div class="mini-popup-sub">Slot kosong</div>
          </div>
          <button class="overlay-close-btn" id="mp-close">✕</button>
        </div>
        <p style="font-size:11px; color:var(--text-dim);">Pasang item dari Tas untuk mengisi slot ini.</p>
      `;
    }

    const durText = equipped.durability !== null && equipped.durability !== undefined && def.stats && def.stats.durability
      ? `${equipped.durability}/${def.stats.durability} Durability` : '';
    const showRepair = equipped.durability !== null
      && def.stats && def.stats.durability && equipped.durability < def.stats.durability;

    return `
      <div class="mini-popup-header">
        <div class="mini-popup-icon">${iconImgHtml(def.icon, def.name)}</div>
        <div class="mini-popup-titles">
          <div class="mini-popup-name rarity-${def.rarity}">${def.name}</div>
          <div class="mini-popup-sub">${EQUIP_SLOT_NAMES[slot]}${durText ? ' • ' + durText : ''}</div>
        </div>
        <button class="overlay-close-btn" id="mp-close">✕</button>
      </div>
      <p style="font-size:11px; color:var(--text-dim); line-height:1.5;">${def.description}</p>
      <div class="mini-popup-actions">
        ${showRepair ? `<button class="action-btn" id="mp-repair">🔧 Perbaiki</button>` : ''}
        <button class="action-btn secondary" id="mp-unequip">Lepas</button>
      </div>
    `;
  }

  function openEquipSlotPopup(slot) {
    const ovId = OverlayManager.open(`<div class="mini-popup-panel">${renderEquipSlotPopup(slot)}</div>`, { closeOnBackdrop: true });
    const root = document.getElementById('overlay-root');
    requestAnimationFrame(() => {
      const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
      if (!panel) return;
      const closeBtn = panel.querySelector('#mp-close');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(ovId));

      const unequipBtn = panel.querySelector('#mp-unequip');
      if (unequipBtn) unequipBtn.addEventListener('click', () => {
        Inventory.unequipItem(slot);
        OverlayManager.close(ovId);
        render('inventory');
        Renderer.renderHUD();
      });

      const repairBtn = panel.querySelector('#mp-repair');
      if (repairBtn) repairBtn.addEventListener('click', () => {
        // PENTING: jangan close() lalu open() lagi secara berurutan di sini.
        // close() memanggil history.back() (async) dan kalau langsung disusul
        // open() baru (pushState sinkron), urutannya bisa balapan dan
        // merusak history stack (pernah menyebabkan navigasi ke about:blank).
        // Solusi aman: ganti konten popup yang SAMA di tempat, tanpa
        // menyentuh history sama sekali.
        panel.innerHTML = renderRepairOverlay(slot);
        bindRepairEvents(panel, ovId, slot);
      });
    });
  }

  // --- Mini popup: detail item di Tas (Pakai / Pasang di dalam popup) ---
  function renderItemDetailOverlay(itemId) {
    const def = ItemDB.get(itemId);
    const entry = Inventory.getInventory().find(e => e.itemId === itemId);
    if (!def || !entry) return '<p>Item tidak ditemukan.</p>';

    const canEquip = !!Inventory.getSlotForItem(def);
    const canUse = def.type === 'consumable';

    const statLines = def.stats ? Object.entries(def.stats).map(([k, v]) =>
      `<div class="card-row"><span>${k}</span><span>+${v}</span></div>`
    ).join('') : '';

    const onCooldown = Inventory.isBoostItem(def) && Cooldown.isActive('item:' + itemId);
    const useLabel = onCooldown ? `⏳ ${Cooldown.remainingSec('item:' + itemId)}s` : 'Pakai';

    return `
      <div class="mini-popup-panel">
        <div class="mini-popup-header">
          <div class="mini-popup-icon">${iconImgHtml(def.icon, def.name)}</div>
          <div class="mini-popup-titles">
            <div class="mini-popup-name rarity-${def.rarity}">${def.name}</div>
            <div class="mini-popup-sub">${Rarity.getName(def.rarity)} • x${entry.qty}</div>
          </div>
          <button class="overlay-close-btn" id="ov-close-item">✕</button>
        </div>
        <div class="card">${statLines}</div>
        <p style="font-size:11px; color:var(--text-dim); line-height:1.5;">${def.description}</p>
        <div class="mini-popup-actions">
          ${canUse ? `<button class="action-btn" id="ov-use-item" ${onCooldown ? 'disabled' : ''}>${useLabel}</button>` : ''}
          ${canEquip ? `<button class="action-btn" id="ov-equip-item">Pasang</button>` : ''}
        </div>
      </div>
    `;
  }

  function openItemDetail(itemId) {
    const ovId = OverlayManager.open(renderItemDetailOverlay(itemId), { closeOnBackdrop: true });
    const root = document.getElementById('overlay-root');

    const rebind = () => {
      const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
      if (!panel) return;
      const closeBtn = panel.querySelector('#ov-close-item');
      const useBtn = panel.querySelector('#ov-use-item');
      const equipBtn = panel.querySelector('#ov-equip-item');

      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(ovId));
      if (useBtn) useBtn.addEventListener('click', () => {
        Inventory.useItem(itemId);
        OverlayManager.close(ovId);
        render('inventory');
        Renderer.renderHUD();
      });
      if (equipBtn) equipBtn.addEventListener('click', () => {
        Inventory.equipItem(itemId);
        OverlayManager.close(ovId);
        render('inventory');
        Renderer.renderHUD();
      });
    };
    // Tunggu 1 frame supaya elemen sudah ter-attach ke DOM
    requestAnimationFrame(rebind);
  }

  function bindInventoryEvents() {
    const main = document.getElementById('main-panel');

    main.querySelectorAll('[data-item-detail]').forEach(row => {
      row.addEventListener('click', () => openItemDetail(row.dataset.itemDetail));
    });

    main.querySelectorAll('[data-equip-slot]').forEach(cell => {
      cell.addEventListener('click', () => openEquipSlotPopup(cell.dataset.equipSlot));
    });

    const craftBtn = main.querySelector('#btn-open-crafting');
    if (craftBtn) craftBtn.addEventListener('click', () => openCrafting());
  }

  // =========================================================
  // CRAFTING (overlay)
  // =========================================================
  function renderCraftingOverlay() {
    const items = Crafting.getCraftableItems();
    const rows = items.map(def => {
      const canMake = Crafting.canCraft(def.id);
      const recipeText = Object.entries(def.recipe).map(([matId, qty]) => {
        const matDef = ItemDB.get(matId);
        const have = Inventory.hasItem(matId, qty);
        const matName = matDef ? matDef.name : matId;
        return `<span style="color:${have ? '#22c55e' : 'var(--accent-red)'};">${matName} x${qty}</span>`;
      }).join(', ');

      return `
        <div class="card">
          <div class="item-name rarity-${def.rarity}">${def.name}</div>
          <div class="item-desc" style="margin-bottom:6px;">${def.description}</div>
          <div style="font-size:11px; margin-bottom:8px;">Butuh: ${recipeText}</div>
          <button class="action-btn" data-craft="${def.id}" ${canMake ? '' : 'disabled'} style="margin-top:0;">
            🔨 Buat
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">🔨 Crafting</span>
        <button class="overlay-close-btn" id="ov-close-craft">✕</button>
      </div>
      ${rows || '<p style="font-size:12px;color:var(--text-dim);">Belum ada resep tersedia.</p>'}
    `;
  }

  function openCrafting() {
    const ovId = OverlayManager.open(renderCraftingOverlay(), { closeOnBackdrop: true });
    bindCraftingEvents(ovId);
  }

  function bindCraftingEvents(ovId) {
    const root = document.getElementById('overlay-root');
    requestAnimationFrame(() => {
      const panel = root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel');
      if (!panel) return;

      const closeBtn = panel.querySelector('#ov-close-craft');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(ovId));

      panel.querySelectorAll('[data-craft]').forEach(btn => {
        btn.addEventListener('click', () => {
          Crafting.craft(btn.dataset.craft);
          panel.innerHTML = renderCraftingOverlay();
          bindCraftingEvents(ovId);
          Renderer.renderHUD();
        });
      });
    });
  }

  // =========================================================
  // REPAIR (overlay)
  // =========================================================
  function renderRepairOverlay(slot) {
    const p = GameState.get().player;
    const equipped = p.equipment[slot];
    if (!equipped || !equipped.itemId) return '<p>Tidak ada item terpasang di slot ini.</p>';

    const def = ItemDB.get(equipped.itemId);
    const missing = def.stats.durability - equipped.durability;
    const cost = Inventory.getRepairCost(equipped.itemId, missing);
    const canAfford = Inventory.canRepairSlot(slot);

    const matText = Object.entries(cost.materials).map(([matId, qty]) => {
      const matDef = ItemDB.get(matId);
      const have = Inventory.hasItem(matId, qty);
      return `<div class="card-row"><span>${matDef ? matDef.name : matId}</span><span style="color:${have ? '#22c55e' : 'var(--accent-red)'};">x${qty}</span></div>`;
    }).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">🔧 Perbaiki ${def.name}</span>
        <button class="overlay-close-btn" id="ov-close-repair">✕</button>
      </div>
      <div class="card">
        <div class="card-row"><span>Durability saat ini</span><span>${equipped.durability}/${def.stats.durability}</span></div>
        <div class="card-row"><span>Biaya Rupiah</span><span style="color:${p.currency.rupiah >= cost.rupiah ? '#22c55e' : 'var(--accent-red)'};">Rp ${cost.rupiah}</span></div>
        ${matText}
      </div>
      <button class="action-btn" id="btn-confirm-repair" ${canAfford ? '' : 'disabled'}>Perbaiki Sekarang</button>
    `;
  }

  // Dipanggil setelah swap innerHTML popup slot -> tampilan repair,
  // TETAP di layer overlay yang sama (ovId sama, tidak buka layer baru).
  function bindRepairEvents(panel, ovId, slot) {
    const closeBtn = panel.querySelector('#ov-close-repair');
    if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(ovId));

    const confirmBtn = panel.querySelector('#btn-confirm-repair');
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      Inventory.repairSlot(slot);
      OverlayManager.close(ovId);
      render('inventory');
      Renderer.renderHUD();
    });
  }



  // =========================================================
  // SKILLS
  // =========================================================
  function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function renderSkills() {
    const skills = Skills.getAllSkillsProgress();

    const cards = skills.map(s => {
      const glowColor = s.rankColor;
      const glowRgba = hexToRgba(glowColor, 0.45);
      return `
        <div class="skill-card-mini" style="--rank-color:${glowColor}; --rank-glow:${glowRgba};">
          <div class="skill-mini-title">${s.def.icon} ${s.def.name.toUpperCase()}</div>
          <div class="skill-mini-rank" style="color:${glowColor};">${s.maxed ? 'MASTER V' : s.label}</div>
          <div class="skill-mini-bonus">${s.bonusLabel}</div>
          <div class="bar-track small">
            <div class="bar-fill exp" style="width:${s.progressPct}%; background:${glowColor};"></div>
          </div>
          <div class="skill-mini-exp">${s.maxed ? 'MAX' : `${s.exp}/${s.required}`}</div>
        </div>
      `;
    }).join('');

    return `
      <h2 class="panel-title">🏅 Skills</h2>
      <div class="skills-grid">${cards}</div>
      <div class="card" style="margin-top:14px;">
        <p style="font-size:11px; color:var(--text-dim); line-height:1.7;">
          <b style="color:var(--text-primary);">Cara naik:</b><br>
          🏹 Hunter — menang Hunting (battle)<br>
          🧰 Scavenger — melakukan Scavenge<br>
          🧟 Survivor — menggunakan item makanan/minuman<br><br>
          Rank: <span style="color:${Skills.RANK_COLORS[0]}">Bronze</span> →
          <span style="color:${Skills.RANK_COLORS[1]}">Silver</span> →
          <span style="color:${Skills.RANK_COLORS[2]}">Gold</span> →
          <span style="color:${Skills.RANK_COLORS[3]}">Platinum</span> →
          <span style="color:${Skills.RANK_COLORS[4]}">Diamond</span> →
          <span style="color:${Skills.RANK_COLORS[5]}">Master</span>,
          tiap rank 5 tier (I-V). EXP dibutuhkan naik ×1.5 tiap tier.
        </p>
      </div>
    `;
  }

  // =========================================================
  // MENU FLYOUT (pengganti hamburger drawer) — trigger dari bottom nav
  // "☰ Menu", muncul strip pill icon-only melayang di atas nav. Tap
  // pill langsung eksekusi aksi (buka overlay atau toast), tidak lagi
  // lewat drawer 2-langkah seperti sebelumnya.
  // =========================================================
  const FLYOUT_ITEMS = [
    { id: 'pass', icon: '🎫', action: 'pass', title: 'Pass' },
    { id: 'shop', icon: '🛒', action: 'shop', title: 'Shop' },
    { id: 'quest', icon: '🎯', action: 'quest', title: 'Misi' },
    { id: 'spin', icon: '🎡', action: 'locked', title: 'Spin Wheel (terkunci)' },
    { id: 'mall', icon: '💎', action: 'toast-mall', title: 'Item Mall (segera)' },
    { id: 'faction', icon: '🏴', action: 'faction', title: 'Faksi' }
  ];

  let menuFlyoutOpen = false;

  function renderMenuFlyoutPills() {
    return FLYOUT_ITEMS.map(it => `
      <button class="menu-flyout-pill ${it.action === 'locked' ? 'locked' : ''}" data-flyout-action="${it.action}" title="${it.title}">${it.icon}</button>
    `).join('');
  }

  function openMenuFlyout() {
    if (menuFlyoutOpen) { closeMenuFlyout(); return; }

    const wrap = document.createElement('div');
    wrap.className = 'menu-flyout-wrap';
    wrap.id = 'menu-flyout-wrap';
    wrap.innerHTML = `<div class="menu-flyout-row">${renderMenuFlyoutPills()}</div>`;
    document.body.appendChild(wrap);

    const backdrop = document.createElement('div');
    backdrop.className = 'menu-flyout-backdrop';
    backdrop.id = 'menu-flyout-backdrop';
    backdrop.addEventListener('click', closeMenuFlyout);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => wrap.classList.add('show'));
    menuFlyoutOpen = true;

    const menuBtn = document.getElementById('btn-nav-menu');
    if (menuBtn) menuBtn.classList.add('flyout-open');

    wrap.querySelectorAll('[data-flyout-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleFlyoutAction(btn.dataset.flyoutAction);
      });
    });
  }

  function closeMenuFlyout() {
    const wrap = document.getElementById('menu-flyout-wrap');
    const backdrop = document.getElementById('menu-flyout-backdrop');
    if (wrap) { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 180); }
    if (backdrop) backdrop.remove();
    menuFlyoutOpen = false;

    const menuBtn = document.getElementById('btn-nav-menu');
    if (menuBtn) menuBtn.classList.remove('flyout-open');
  }

  function handleFlyoutAction(action) {
    closeMenuFlyout();
    switch (action) {
      case 'shop': {
        shopTab = 'buy';
        const shopId = OverlayManager.open(renderShopPanel(), { closeOnBackdrop: true });
        bindShopEvents(shopId);
        break;
      }
      case 'quest': {
        openQuestListOverlay();
        break;
      }
      case 'faction': {
        openFactionOverlay();
        break;
      }
      case 'pass': {
        openPassOverlay();
        break;
      }
      case 'locked':
        Events.emit('notify', { message: '🔒 Spin Wheel terkunci sementara (butuh integrasi iklan reward).', type: 'error' });
        break;
      case 'toast-mall':
        Events.emit('notify', { message: 'Fitur Item Mall masih tahap pengembangan.' });
        break;
    }
  }

  // =========================================================
  // ELITE PASS (overlay) — v0.1.9: reward table 100 level, 2 jalur
  // (Free & Premium). Pass level naik otomatis dari EXP karakter (1:1,
  // lihat hook di player.js), jadi pemain tidak perlu grind terpisah.
  // Jalur Premium perlu dibuka pakai Kredit, setelah itu semua reward
  // premium dari level 1 s/d level sekarang langsung bisa diklaim.
  // =========================================================
  function formatPassReward(reward) {
    if (reward.type === 'rupiah') return `Rp${reward.amount.toLocaleString('id-ID')}`;
    if (reward.type === 'kredit') return `💎${reward.amount}`;
    if (reward.type === 'item') {
      const def = window.ItemDB ? ItemDB.get(reward.itemId) : null;
      return `${def ? def.name : reward.itemId} x${reward.qty || 1}`;
    }
    return '';
  }

  function renderPassCell(levelData, track, currentLevel, premiumUnlocked) {
    const lvl = levelData.level;
    const rewards = levelData[track];
    if (!rewards || rewards.length === 0) {
      return `<div class="pass-cell empty">—</div>`;
    }
    const text = rewards.map(formatPassReward).join(', ');
    const claimed = PassSystem.isClaimed(lvl, track);
    const reached = lvl <= currentLevel;

    let actionHtml;
    if (claimed) {
      actionHtml = `<span class="pass-claimed">✅ Diklaim</span>`;
    } else if (track === 'premium' && !premiumUnlocked) {
      actionHtml = `<span class="pass-locked-icon">🔒 Premium</span>`;
    } else if (!reached) {
      actionHtml = `<span class="pass-locked-icon">🔒 Lv.${lvl}</span>`;
    } else {
      actionHtml = `<button class="mini-btn" data-pass-claim="${lvl}:${track}">Klaim</button>`;
    }

    return `<div class="pass-cell"><div class="pass-cell-text">${text}</div>${actionHtml}</div>`;
  }

  function renderPassOverlay() {
    if (!window.PassSystem || !window.PassDB) return '<p>Sistem Pass belum siap.</p>';

    const progress = PassSystem.getProgress();
    const claimableCount = PassSystem.countClaimable();
    const allLevels = PassDB.all();

    const rows = allLevels.map(levelData => `
      <div class="card pass-row ${levelData.level > progress.level ? 'pass-row-locked' : ''} ${levelData.level === progress.level ? 'pass-row-current' : ''}">
        <div class="pass-row-level">Lv.${levelData.level}</div>
        <div class="pass-row-tracks">
          ${renderPassCell(levelData, 'free', progress.level, progress.premiumUnlocked)}
          ${renderPassCell(levelData, 'premium', progress.level, progress.premiumUnlocked)}
        </div>
      </div>
    `).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">🎫 Elite Pass</span>
        <button class="overlay-close-btn" id="ov-close-pass">✕</button>
      </div>
      <div class="card">
        <div class="card-row"><span>Level Pass</span><span>${progress.level}/${progress.maxLevel}</span></div>
        <div class="bar-track small" style="margin:4px 0 8px;"><div class="bar-fill exp" style="width:${progress.progressPct}%;"></div></div>
        <div class="card-row"><span>EXP</span><span>${progress.level >= progress.maxLevel ? 'MAX' : `${progress.exp}/${progress.required}`}</span></div>
        <p style="font-size:10px; color:var(--text-dim); margin-top:6px;">Pass naik otomatis dari EXP yang kamu dapat main seperti biasa (Scavenge, Hunting, Misi).</p>
      </div>
      ${!progress.premiumUnlocked ? `
        <div class="card" style="border-color:#f5c518;">
          <div class="card-row"><span>🎫 Jalur Premium</span><span style="color:#f5c518;">Belum aktif</span></div>
          <p style="font-size:11px; color:var(--text-dim); margin:4px 0 8px;">Buka sekali untuk selamanya, langsung klaim semua reward Premium dari level 1 sampai level kamu sekarang.</p>
          <button class="action-btn" id="btn-unlock-premium">🔓 Buka Premium — 💎${PassSystem.PREMIUM_UNLOCK_COST_KREDIT} Kredit</button>
        </div>
      ` : ''}
      ${claimableCount > 0 ? `<button class="action-btn" id="btn-claim-all-pass">🎁 Klaim Semua (${claimableCount})</button>` : ''}
      <div class="pass-track-header">
        <div class="pass-row-level"></div>
        <div class="pass-row-tracks"><span>FREE</span><span>PREMIUM</span></div>
      </div>
      ${rows}
    `;
  }

  function refreshPassPanel() {
    const root = document.getElementById('overlay-root');
    const panel = root.firstElementChild && root.firstElementChild.querySelector('.overlay-panel');
    if (!panel) return;
    panel.innerHTML = renderPassOverlay();
    bindPassEvents(null, panel);
  }

  function bindPassEvents(ovId, existingPanel) {
    const root = document.getElementById('overlay-root');
    const attach = (panel) => {
      if (!panel) return;
      const closeBtn = panel.querySelector('#ov-close-pass');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.closeAll());

      const unlockBtn = panel.querySelector('#btn-unlock-premium');
      if (unlockBtn) unlockBtn.addEventListener('click', () => {
        PassSystem.unlockPremium();
        refreshPassPanel();
        Renderer.renderHUD();
      });

      const claimAllBtn = panel.querySelector('#btn-claim-all-pass');
      if (claimAllBtn) claimAllBtn.addEventListener('click', () => {
        PassSystem.claimAllAvailable();
        refreshPassPanel();
        Renderer.renderHUD();
      });

      panel.querySelectorAll('[data-pass-claim]').forEach(btn => {
        btn.addEventListener('click', () => {
          const [lvlStr, track] = btn.dataset.passClaim.split(':');
          PassSystem.claim(parseInt(lvlStr, 10), track);
          refreshPassPanel();
          Renderer.renderHUD();
        });
      });
    };

    if (existingPanel) {
      attach(existingPanel);
    } else {
      requestAnimationFrame(() => {
        const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
        attach(panel);
      });
    }
  }

  function openPassOverlay() {
    const ovId = OverlayManager.open(renderPassOverlay(), { closeOnBackdrop: true });
    bindPassEvents(ovId);
  }

  // =========================================================
  // FAKSI (overlay) — v0.1.8: join 1 dari 5 faksi tematik, naikkan
  // reputasi + Koin Faksi lewat Scavenge/Hunting, tukar koin itu di
  // Faction Shop untuk equipment/item eksklusif (rarity Rare ke atas).
  // Layer-1 = daftar/status faksi, Layer-2 = Faction Shop ATAU detail
  // beli item (Faction Shop dibuka sebagai layer-1 baru setelah daftar
  // ditutup, sama pola dengan Shop biasa dari Hamburger).
  // =========================================================
  function renderFactionListOverlay() {
    if (!window.FactionSystem || !window.FactionDB) return '<p>Sistem faksi belum siap.</p>';

    const factionId = FactionSystem.getCurrentFactionId();
    const allFactions = Object.values(FactionDB.all());

    let currentCardHtml = '';
    if (factionId) {
      const f = FactionDB.get(factionId);
      const rank = FactionSystem.getRankInfo(factionId);
      const coins = FactionSystem.getCoins(factionId);
      currentCardHtml = `
        <div class="card" style="border-color:${f.color};">
          <div class="card-row"><span>${f.icon} Faksi Kamu</span><span style="color:${f.color}; font-weight:bold;">${f.name}</span></div>
          <div class="card-row"><span>Rank</span><span>${rank.name}${rank.next ? ` (${rank.rep}/${rank.next.minRep})` : ' (MAX)'}</span></div>
          <div class="bar-track small" style="margin:4px 0 8px;"><div class="bar-fill exp" style="width:${rank.progressPct}%; background:${f.color};"></div></div>
          <div class="card-row"><span>🪙 Koin Faksi</span><span>${coins}</span></div>
        </div>
        <button class="action-btn" id="btn-open-faction-shop">🎁 Tukar Koin Faksi</button>
        <button class="action-btn secondary" id="btn-leave-faction">Keluar Faksi</button>
      `;
    } else {
      currentCardHtml = `
        <div class="card">
          <p style="font-size:11px; color:var(--text-dim); line-height:1.6;">
            Gabung 1 faksi untuk mulai kumpulkan reputasi & Koin Faksi dari
            Scavenge dan Hunting. Koin Faksi bisa ditukar equipment & item
            eksklusif (rarity Rare ke atas) yang cuma ada di Faction Shop.
          </p>
        </div>
      `;
    }

    const otherFactions = allFactions.filter(f => f.id !== factionId);
    const listRows = otherFactions.map(f => `
      <div class="card travel-row">
        <div>
          <div class="location-name" style="font-size:13px; color:${f.color};">${f.icon} ${f.name}</div>
          <p class="location-desc" style="margin:2px 0 0;">${f.theme} — ${f.description}</p>
        </div>
        <button class="mini-btn" data-join-faction="${f.id}">${factionId ? 'Pindah' : 'Gabung'}</button>
      </div>
    `).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">🏴 Faksi</span>
        <button class="overlay-close-btn" id="ov-close-faction">✕</button>
      </div>
      ${currentCardHtml}
      <div style="color:var(--accent-orange); font-size:11px; margin:10px 0 6px;">${factionId ? 'FAKSI LAIN' : 'PILIH FAKSI'}</div>
      ${listRows}
    `;
  }

  function refreshFactionListPanel() {
    const root = document.getElementById('overlay-root');
    const panel = root.firstElementChild && root.firstElementChild.querySelector('.overlay-panel');
    if (!panel) return;
    panel.innerHTML = renderFactionListOverlay();
    bindFactionListEvents(null, panel);
    if (currentNavPanel === 'dashboard') render('dashboard');
  }

  function bindFactionListEvents(ovId, existingPanel) {
    const root = document.getElementById('overlay-root');
    const attach = (panel) => {
      if (!panel) return;
      const closeBtn = panel.querySelector('#ov-close-faction');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.closeAll());

      const shopBtn = panel.querySelector('#btn-open-faction-shop');
      if (shopBtn) shopBtn.addEventListener('click', () => {
        OverlayManager.closeAll();
        openFactionShopOverlay();
      });

      const leaveBtn = panel.querySelector('#btn-leave-faction');
      if (leaveBtn) leaveBtn.addEventListener('click', () => {
        const confirmLeave = confirm('Keluar dari faksi sekarang? Reputasi & Koin Faksi tetap tersimpan kalau mau gabung lagi nanti.');
        if (!confirmLeave) return;
        FactionSystem.leaveFaction();
        refreshFactionListPanel();
      });

      panel.querySelectorAll('[data-join-faction]').forEach(btn => {
        btn.addEventListener('click', () => {
          FactionSystem.joinFaction(btn.dataset.joinFaction);
          refreshFactionListPanel();
        });
      });
    };

    if (existingPanel) {
      attach(existingPanel);
    } else {
      requestAnimationFrame(() => {
        const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
        attach(panel);
      });
    }
  }

  function openFactionOverlay() {
    const ovId = OverlayManager.open(renderFactionListOverlay(), { closeOnBackdrop: true });
    bindFactionListEvents(ovId);
  }

  // --- Faction Shop: tukar Koin Faksi dengan equipment/item eksklusif ---
  function renderFactionShopOverlay() {
    const factionId = FactionSystem.getCurrentFactionId();
    if (!factionId) return '<p>Gabung faksi dulu untuk buka Faction Shop.</p>';

    const f = FactionDB.get(factionId);
    const coins = FactionSystem.getCoins(factionId);
    const catalog = FactionSystem.getFactionShopCatalog(factionId);

    const cells = catalog.map(entry => {
      const rep = FactionSystem.getReputation(factionId);
      const locked = rep < entry.minRep;
      return `
        <div class="icon-cell rarity-${entry.def.rarity}" data-faction-item="${entry.def.id}">
          ${iconImgHtml(entry.def.icon, entry.def.name)}
          <span class="icon-cell-qty">${locked ? '🔒 Rep ' + entry.minRep : '🪙' + entry.price}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">${f.icon} Faction Shop — ${f.name}</span>
        <button class="overlay-close-btn" id="ov-close-fshop">✕</button>
      </div>
      <div class="card">
        <div class="card-row"><span>🪙 Koin Faksi kamu</span><span>${coins}</span></div>
      </div>
      <div class="icon-grid">${cells || '<p style="font-size:12px;color:var(--text-dim);">Belum ada item.</p>'}</div>
      <p style="font-size:10px; color:var(--text-dim); margin-top:4px;">
        Item di sini eksklusif faksi ini (rarity Rare ke atas). Item bergembok butuh reputasi lebih tinggi dulu.
      </p>
    `;
  }

  function refreshFactionShopPanel() {
    const root = document.getElementById('overlay-root');
    const panel = root.firstElementChild && root.firstElementChild.querySelector('.overlay-panel');
    if (!panel) return;
    panel.innerHTML = renderFactionShopOverlay();
    bindFactionShopEvents(null, panel);
  }

  function bindFactionShopEvents(ovId, existingPanel) {
    const root = document.getElementById('overlay-root');
    const attach = (panel) => {
      if (!panel) return;
      const closeBtn = panel.querySelector('#ov-close-fshop');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.closeAll());

      panel.querySelectorAll('[data-faction-item]').forEach(cell => {
        cell.addEventListener('click', () => openFactionItemPopup(cell.dataset.factionItem));
      });
    };

    if (existingPanel) {
      attach(existingPanel);
    } else {
      requestAnimationFrame(() => {
        const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
        attach(panel);
      });
    }
  }

  function openFactionShopOverlay() {
    const ovId = OverlayManager.open(renderFactionShopOverlay(), { closeOnBackdrop: true });
    bindFactionShopEvents(ovId);
  }

  // Mini popup detail item Faction Shop (layer ke-2, di atas Faction Shop)
  function renderFactionItemPopup(itemId) {
    const def = ItemDB.get(itemId);
    if (!def) return '<p>Item tidak ditemukan.</p>';
    const check = FactionSystem.canBuyFactionItem(itemId);

    const statLines = def.stats ? Object.entries(def.stats).map(([k, v]) =>
      `<div class="card-row"><span>${k}</span><span>+${v}</span></div>`
    ).join('') : '';

    return `
      <div class="mini-popup-panel">
        <div class="mini-popup-header">
          <div class="mini-popup-icon">${iconImgHtml(def.icon, def.name)}</div>
          <div class="mini-popup-titles">
            <div class="mini-popup-name rarity-${def.rarity}">${def.name}</div>
            <div class="mini-popup-sub">${Rarity.getName(def.rarity)} • ${check.price || FactionSystem.RARITY_GATE[def.rarity].price} 🪙</div>
          </div>
          <button class="overlay-close-btn" id="fi-close">✕</button>
        </div>
        <div class="card">${statLines}</div>
        <p style="font-size:11px; color:var(--text-dim); line-height:1.5;">${def.description}</p>
        <div class="mini-popup-actions">
          <button class="action-btn" id="fi-buy" ${check.ok ? '' : 'disabled'}>${check.ok ? 'Tukar Koin' : check.reason}</button>
        </div>
      </div>
    `;
  }

  function openFactionItemPopup(itemId) {
    const popId = OverlayManager.open(renderFactionItemPopup(itemId), { closeOnBackdrop: true });
    const root = document.getElementById('overlay-root');
    requestAnimationFrame(() => {
      const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
      if (!panel) return;

      const closeBtn = panel.querySelector('#fi-close');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(popId));

      const buyBtn = panel.querySelector('#fi-buy');
      if (buyBtn) buyBtn.addEventListener('click', () => {
        const ok = FactionSystem.buyFactionItem(itemId);
        if (ok) {
          OverlayManager.close(popId);
          refreshFactionShopPanel();
          Renderer.renderHUD();
        }
      });
    });
  }

  let shopTab = 'buy'; // 'buy' | 'sell'

  function renderShopPanel() {
    const p = GameState.get().player;

    const tabsHtml = `
      <div class="segmented-tabs">
        <div class="segmented-tab ${shopTab === 'buy' ? 'active' : ''}" id="shop-tab-buy">Beli</div>
        <div class="segmented-tab ${shopTab === 'sell' ? 'active' : ''}" id="shop-tab-sell">Jual</div>
      </div>
    `;

    let gridHtml;
    if (shopTab === 'buy') {
      const catalog = Shop.getCatalog();
      gridHtml = `<div class="icon-grid">${catalog.map(entry => `
        <div class="icon-cell rarity-${entry.def.rarity}" data-shop-item="${entry.itemId}">
          ${iconImgHtml(entry.def.icon, entry.def.name)}
          <span class="icon-cell-qty">Rp${entry.price}</span>
        </div>`).join('')}</div>`;
    } else {
      const inv = Inventory.getInventory();
      gridHtml = inv.length === 0
        ? `<p style="font-size:12px; color:var(--text-dim);">Tas kosong, tidak ada yang bisa dijual.</p>`
        : `<div class="icon-grid">${inv.map(entry => {
            const def = ItemDB.get(entry.itemId);
            if (!def) return '';
            const sellPrice = Shop.getSellPrice(entry.itemId);
            return `
              <div class="icon-cell rarity-${def.rarity}" data-shop-item="${entry.itemId}">
                ${iconImgHtml(def.icon, def.name)}
                <span class="icon-cell-qty">Rp${sellPrice}</span>
              </div>`;
          }).join('')}</div>`;
    }

    return `
      <div class="overlay-header">
        <span class="overlay-title">🛒 Shop</span>
        <button class="overlay-close-btn" id="ov-close-shop">✕</button>
      </div>
      <div class="card">
        <div class="card-row"><span>Rupiah kamu</span><span>Rp ${p.currency.rupiah.toLocaleString('id-ID')}</span></div>
      </div>
      ${tabsHtml}
      ${gridHtml}
    `;
  }

  // =========================================================
  // MISI / QUEST (overlay) — v0.1.7: daftar misi (bukan cuma 1 aktif),
  // ditumpuk per kategori Main/Side. Layer-1 = daftar (tab + list baris
  // tappable), Layer-2 = detail 1 misi (mini popup, sama pola dengan
  // detail item Tas / Shop) berisi objective, hadiah, dan tombol aksi
  // (Ambil / Klaim / Batalkan tergantung status misi itu).
  // =========================================================
  let questTab = 'main'; // 'main' | 'side'

  function renderQuestRow(quest, statusLabel, statusColor) {
    return `
      <div class="card travel-row" data-quest-row="${quest.id}" style="cursor:pointer;">
        <div>
          <div class="location-name" style="font-size:13px;">${quest.title}</div>
          <p class="location-desc" style="margin:2px 0 0; color:${statusColor};">${statusLabel}</p>
        </div>
        <span class="item-chevron">›</span>
      </div>
    `;
  }

  function renderQuestListOverlay() {
    if (!window.QuestSystem) return '<p>Sistem misi belum siap.</p>';

    const accepted = QuestSystem.getAcceptedQuestsByCategory(questTab);
    const available = QuestSystem.getAvailableQuestsByCategory(questTab);

    const acceptedRows = accepted.map(q => {
      const progress = QuestSystem.getObjectiveProgress(q.id);
      const done = progress.filter(o => o.done).length;
      const ready = QuestSystem.isQuestComplete(q.id);
      return renderQuestRow(q, ready ? '🎁 Siap diklaim!' : `Progres: ${done}/${progress.length} objective`, ready ? '#22c55e' : 'var(--text-dim)');
    }).join('');

    const availableRows = available.map(q =>
      renderQuestRow(q, 'Belum diambil — tap untuk lihat detail', 'var(--text-dim)')
    ).join('');

    const emptyMsg = (accepted.length === 0 && available.length === 0)
      ? `<p style="font-size:12px; color:var(--text-dim); text-align:center; padding:14px 0;">Tidak ada misi ${questTab === 'main' ? 'utama' : 'sampingan'} saat ini.</p>`
      : '';

    return `
      <div class="overlay-header">
        <span class="overlay-title">🎯 Misi</span>
        <button class="overlay-close-btn" id="ov-close-quest">✕</button>
      </div>
      <div class="segmented-tabs">
        <div class="segmented-tab ${questTab === 'main' ? 'active' : ''}" id="quest-tab-main">Main Quest</div>
        <div class="segmented-tab ${questTab === 'side' ? 'active' : ''}" id="quest-tab-side">Side Quest</div>
      </div>
      ${emptyMsg}
      ${accepted.length > 0 ? `<div style="color:var(--accent-orange); font-size:11px; margin:10px 0 6px;">SEDANG DIAMBIL (${accepted.length}${questTab === 'main' ? '/' + QuestSystem.MAX_ACTIVE_MAIN : '/' + QuestSystem.MAX_ACTIVE_SIDE})</div>${acceptedRows}` : ''}
      ${available.length > 0 ? `<div style="color:var(--accent-orange); font-size:11px; margin:10px 0 6px;">TERSEDIA</div>${availableRows}` : ''}
    `;
  }

  function refreshQuestListPanel() {
    const root = document.getElementById('overlay-root');
    const panel = root.firstElementChild && root.firstElementChild.querySelector('.overlay-panel');
    if (!panel) return;
    panel.innerHTML = renderQuestListOverlay();
    bindQuestListEvents(null, panel);
    if (currentNavPanel === 'dashboard') render('dashboard');
  }

  function bindQuestListEvents(ovId, existingPanel) {
    const root = document.getElementById('overlay-root');
    const attach = (panel) => {
      if (!panel) return;
      const closeBtn = panel.querySelector('#ov-close-quest');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.closeAll());

      const mainTab = panel.querySelector('#quest-tab-main');
      const sideTab = panel.querySelector('#quest-tab-side');
      if (mainTab) mainTab.addEventListener('click', () => { questTab = 'main'; refreshQuestListPanel(); });
      if (sideTab) sideTab.addEventListener('click', () => { questTab = 'side'; refreshQuestListPanel(); });

      panel.querySelectorAll('[data-quest-row]').forEach(row => {
        row.addEventListener('click', () => openQuestDetail(row.dataset.questRow));
      });
    };

    if (existingPanel) {
      attach(existingPanel);
    } else {
      requestAnimationFrame(() => {
        const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
        attach(panel);
      });
    }
  }

  function openQuestListOverlay() {
    questTab = 'main';
    const ovId = OverlayManager.open(renderQuestListOverlay(), { closeOnBackdrop: true });
    bindQuestListEvents(ovId);
  }

  // --- Mini popup detail 1 misi (layer ke-2, di atas daftar) ---
  function renderQuestDetailPopup(questId) {
    const quest = QuestSystem.getQuestDef(questId);
    if (!quest) return '<p>Misi tidak ditemukan.</p>';

    const accepted = QuestSystem.isAccepted(questId);
    const rewards = quest.rewards || {};
    const rewardParts = [];
    if (rewards.exp) rewardParts.push(`+${rewards.exp} EXP`);
    if (rewards.rupiah) rewardParts.push(`+Rp ${rewards.rupiah.toLocaleString('id-ID')}`);
    if (rewards.kredit) rewardParts.push(`+${rewards.kredit} 💎 Kredit`);

    let objectiveRows = '';
    let ready = false;
    if (accepted) {
      const progress = QuestSystem.getObjectiveProgress(questId);
      ready = QuestSystem.isQuestComplete(questId);
      objectiveRows = progress.map(o => `
        <div class="card-row">
          <span>${o.done ? '✅' : '⬜'} ${o.label}</span>
          <span style="color:${o.done ? '#22c55e' : 'var(--text-primary)'};">${o.have}/${o.target}</span>
        </div>
      `).join('');
    } else {
      objectiveRows = (quest.objectives || []).map(o => `
        <div class="card-row">
          <span>${o.name || (window.ItemDB && ItemDB.get(o.itemId) ? ItemDB.get(o.itemId).name : o.itemId)}</span>
          <span>0/${o.target}</span>
        </div>
      `).join('');
    }

    const categoryBadge = quest.category === 'main' ? '⭐ Main Quest' : '📌 Side Quest';

    let actionsHtml;
    if (accepted) {
      actionsHtml = `
        <button class="action-btn" id="qd-claim" ${ready ? '' : 'disabled'}>
          ${ready ? '🎁 Klaim Hadiah' : 'Objective belum lengkap'}
        </button>
        ${quest.category === 'side' ? '<button class="action-btn secondary" id="qd-abandon">Batalkan Misi</button>' : ''}
      `;
    } else {
      const check = QuestSystem.canAccept(questId);
      actionsHtml = `<button class="action-btn" id="qd-accept" ${check.ok ? '' : 'disabled'}>${check.ok ? '📋 Ambil Misi' : check.reason}</button>`;
    }

    return `
      <div class="mini-popup-panel">
        <div class="mini-popup-header">
          <div class="mini-popup-titles">
            <div class="mini-popup-name">${categoryBadge}</div>
            <div class="mini-popup-sub" style="font-size:12px; color:var(--text-primary); font-weight:bold;">${quest.title}</div>
          </div>
          <button class="overlay-close-btn" id="qd-close">✕</button>
        </div>
        <p style="font-size:11px; color:var(--text-dim); line-height:1.6; margin-bottom:10px;">${quest.description}</p>
        <div class="card">${objectiveRows}</div>
        <div class="card">
          <div class="card-row"><span>Hadiah</span><span>${rewardParts.join(', ')}</span></div>
        </div>
        ${actionsHtml}
        ${quest.type === 'collect' ? '<p style="font-size:10px; color:var(--text-dim); margin-top:8px;">Material akan otomatis diambil dari Tas saat diklaim.</p>' : ''}
      </div>
    `;
  }

  function openQuestDetail(questId) {
    const popId = OverlayManager.open(renderQuestDetailPopup(questId), { closeOnBackdrop: true });
    const root = document.getElementById('overlay-root');
    requestAnimationFrame(() => {
      const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
      if (!panel) return;

      const closeBtn = panel.querySelector('#qd-close');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(popId));

      const acceptBtn = panel.querySelector('#qd-accept');
      if (acceptBtn) acceptBtn.addEventListener('click', () => {
        QuestSystem.acceptQuest(questId);
        OverlayManager.close(popId);
        refreshQuestListPanel();
        Renderer.renderHUD();
      });

      const claimBtn = panel.querySelector('#qd-claim');
      if (claimBtn) claimBtn.addEventListener('click', () => {
        const ok = QuestSystem.claimQuest(questId);
        if (ok) {
          OverlayManager.close(popId);
          refreshQuestListPanel();
          Renderer.renderHUD();
        }
      });

      const abandonBtn = panel.querySelector('#qd-abandon');
      if (abandonBtn) abandonBtn.addEventListener('click', () => {
        QuestSystem.abandonQuest(questId);
        OverlayManager.close(popId);
        refreshQuestListPanel();
        Renderer.renderHUD();
      });
    });
  }

  // =========================================================
  // SPIN WHEEL (overlay) — 1x putar = 1x nonton Iklan Reward
  // =========================================================
  let spinBusy = false; // cegah double-tap saat ad/animasi berjalan

  function renderSpinWheelPanel() {
    const slices = SpinWheel.getSliceRanges();

    // conic-gradient stops sesuai proporsi peluang tiap hadiah
    const gradientStops = slices.map(s => `${s.color} ${s.startDeg}deg ${s.startDeg + s.sweepDeg}deg`).join(', ');

    // Label ditempatkan di tengah tiap juring pakai rotate + translate
    const labels = slices.map(s => `
      <div class="spin-wheel-label" style="transform: rotate(${s.midDeg}deg) translate(58px) rotate(${-s.midDeg}deg) translate(-50%, -50%);">
        ${s.label}
      </div>
    `).join('');

    const legend = SpinWheel.PRIZES.map(p => `
      <div class="spin-legend-item">
        <span class="spin-legend-dot" style="background:${p.color};"></span>
        <span>${p.label} — ${p.chance}%</span>
      </div>
    `).join('');

    return `
      <div class="overlay-header">
        <span class="overlay-title">🎡 Spin Wheel</span>
        <button class="overlay-close-btn" id="ov-close-spin">✕</button>
      </div>
      <div class="spin-wheel-wrap">
        <div class="spin-wheel-pointer"></div>
        <div class="spin-wheel" id="spin-wheel-el" style="background: conic-gradient(${gradientStops});">
          <div class="spin-wheel-hub"></div>
          ${labels}
        </div>
        <div class="spin-result-banner" id="spin-result-text"></div>
        <button class="action-btn spin-cta-btn" id="btn-spin-now">
          📺 Tonton Iklan &amp; Putar
        </button>
        <div class="spin-legend">${legend}</div>
        ${Ads.isTestMode() ? '<p style="font-size:9px; color:var(--text-dim); text-align:center; margin-top:8px;">⚠️ Mode Test aktif (bridge AdMob belum tersambung)</p>' : ''}
      </div>
    `;
  }

  function bindSpinWheelEvents(spinId) {
    const root = document.getElementById('overlay-root');
    requestAnimationFrame(() => {
      const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
      if (!panel) return;

      const closeBtn = panel.querySelector('#ov-close-spin');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(spinId));

      const spinBtn = panel.querySelector('#btn-spin-now');
      const wheelEl = panel.querySelector('#spin-wheel-el');
      const resultText = panel.querySelector('#spin-result-text');

      if (spinBtn) spinBtn.addEventListener('click', () => {
        if (spinBusy) return;
        spinBusy = true;
        spinBtn.disabled = true;
        resultText.textContent = '';

        Ads.showRewarded(
          () => {
            // Iklan selesai ditonton -> roll hadiah & putar roda ke sana
            const prize = SpinWheel.rollPrize();
            const slices = SpinWheel.getSliceRanges();
            const target = slices.find(s => s.id === prize.id);

            // Putar beberapa kali penuh + berhenti tepat di tengah juring
            // menang. Pointer ada di atas (0deg), jadi rotasi akhir harus
            // membuat midDeg juring itu berada di posisi pointer.
            const extraSpins = 5 * 360;
            const finalRotation = extraSpins + (360 - target.midDeg);
            wheelEl.style.transform = `rotate(${finalRotation}deg)`;

            setTimeout(() => {
              const detailText = SpinWheel.grantPrize(prize);
              resultText.textContent = `🎉 Selamat! ${detailText}`;
              Events.emit('notify', { message: `🎡 Hadiah: ${detailText}` });
              spinBtn.disabled = false;
              spinBusy = false;
            }, 4600); // sedikit lebih lama dari durasi transisi CSS (4.5s)
          },
          () => {
            spinBtn.disabled = false;
            spinBusy = false;
          }
        );
      });
    });
  }

  function openShop() {
    shopTab = 'buy';
    const shopId = OverlayManager.open(renderShopPanel(), { closeOnBackdrop: true });
    bindShopEvents(shopId);
  }

  function refreshShopPanel() {
    const root = document.getElementById('overlay-root');
    const panel = root.firstElementChild && root.firstElementChild.querySelector('.overlay-panel');
    if (!panel) return;
    panel.innerHTML = renderShopPanel();
    bindShopEvents(null, panel);
  }

  function bindShopEvents(shopId, existingPanel) {
    const root = document.getElementById('overlay-root');
    const attach = (panel) => {
      if (!panel) return;
      const closeBtn = panel.querySelector('#ov-close-shop');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.closeAll());

      const buyTab = panel.querySelector('#shop-tab-buy');
      const sellTab = panel.querySelector('#shop-tab-sell');
      if (buyTab) buyTab.addEventListener('click', () => { shopTab = 'buy'; refreshShopPanel(); });
      if (sellTab) sellTab.addEventListener('click', () => { shopTab = 'sell'; refreshShopPanel(); });

      panel.querySelectorAll('[data-shop-item]').forEach(cell => {
        cell.addEventListener('click', () => openShopItemPopup(cell.dataset.shopItem));
      });
    };

    if (existingPanel) {
      attach(existingPanel);
    } else {
      requestAnimationFrame(() => {
        const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
        attach(panel);
      });
    }
  }

  // Mini popup item Shop (Beli/Jual) - layer ke-2, di atas Shop (layer ke-1)
  function renderShopItemPopup(itemId) {
    const def = ItemDB.get(itemId);
    if (!def) return '<p>Item tidak ditemukan.</p>';
    const p = GameState.get().player;

    if (shopTab === 'buy') {
      const entry = Shop.getCatalog().find(e => e.itemId === itemId);
      const price = entry ? entry.price : 0;
      const canAfford = p.currency.rupiah >= price;
      return `
        <div class="mini-popup-panel">
          <div class="mini-popup-header">
            <div class="mini-popup-icon">${iconImgHtml(def.icon, def.name)}</div>
            <div class="mini-popup-titles">
              <div class="mini-popup-name rarity-${def.rarity}">${def.name}</div>
              <div class="mini-popup-sub">Harga: Rp ${price.toLocaleString('id-ID')}</div>
            </div>
            <button class="overlay-close-btn" id="sp-close">✕</button>
          </div>
          <p style="font-size:11px; color:var(--text-dim); line-height:1.5;">${def.description}</p>
          <div class="mini-popup-actions">
            <button class="action-btn" id="sp-buy" ${canAfford ? '' : 'disabled'}>Beli 1</button>
          </div>
        </div>
      `;
    } else {
      const entry = Inventory.getInventory().find(e => e.itemId === itemId);
      const qty = entry ? entry.qty : 0;
      const sellPrice = Shop.getSellPrice(itemId);
      return `
        <div class="mini-popup-panel">
          <div class="mini-popup-header">
            <div class="mini-popup-icon">${iconImgHtml(def.icon, def.name)}</div>
            <div class="mini-popup-titles">
              <div class="mini-popup-name rarity-${def.rarity}">${def.name}</div>
              <div class="mini-popup-sub">Jual: Rp ${sellPrice.toLocaleString('id-ID')} • Punya x${qty}</div>
            </div>
            <button class="overlay-close-btn" id="sp-close">✕</button>
          </div>
          <p style="font-size:11px; color:var(--text-dim); line-height:1.5;">${def.description}</p>
          <div class="mini-popup-actions">
            <button class="action-btn secondary" id="sp-sell" ${qty > 0 ? '' : 'disabled'}>Jual 1</button>
          </div>
        </div>
      `;
    }
  }

  function openShopItemPopup(itemId) {
    const popId = OverlayManager.open(renderShopItemPopup(itemId), { closeOnBackdrop: true });
    const root = document.getElementById('overlay-root');
    requestAnimationFrame(() => {
      const panel = (root.lastElementChild && root.lastElementChild.querySelector('.overlay-panel'));
      if (!panel) return;

      const closeBtn = panel.querySelector('#sp-close');
      if (closeBtn) closeBtn.addEventListener('click', () => OverlayManager.close(popId));

      const buyBtn = panel.querySelector('#sp-buy');
      if (buyBtn) buyBtn.addEventListener('click', () => {
        Shop.buy(itemId, 1);
        OverlayManager.close(popId);
        refreshShopPanel();
        Renderer.renderHUD();
      });

      const sellBtn = panel.querySelector('#sp-sell');
      if (sellBtn) sellBtn.addEventListener('click', () => {
        Shop.sell(itemId, 1);
        OverlayManager.close(popId);
        refreshShopPanel();
        Renderer.renderHUD();
      });
    });
  }

  // =========================================================
  // PLACEHOLDER (faction, belum diimplementasi)
  // =========================================================
  function renderPlaceholder(title, icon) {
    return `
      <h2 class="panel-title">${icon} ${title}</h2>
      <div class="card">
        <p style="font-size:12px; color:var(--text-dim); line-height:1.6;">
          Fitur ini akan hadir di update berikutnya.
        </p>
      </div>
    `;
  }

  // =========================================================
  // ROUTER UTAMA
  // =========================================================
  let currentNavPanel = 'dashboard';

  function render(panelName) {
    currentNavPanel = panelName;
    const main = document.getElementById('main-panel');
    switch (panelName) {
      case 'dashboard':
        main.innerHTML = renderDashboard();
        bindDashboardEvents();
        break;
      case 'exploration':
        renderExploration();
        break;
      case 'inventory':
        main.innerHTML = renderInventory();
        bindInventoryEvents();
        break;
      case 'skills':
        main.innerHTML = renderSkills();
        break;
      case 'faction':
        main.innerHTML = renderPlaceholder('Faksi', '🏴');
        break;
      default:
        main.innerHTML = renderDashboard();
    }
  }

  // Dipanggil tiap 1 detik dari main.js supaya countdown cooldown
  // (Scavenge/Travel) di menu Jelajah ter-update tanpa perlu tap ulang.
  // Selalu re-render saat berada di menu ini (murah, DOM kecil) supaya
  // transisi "cooldown baru saja habis" ikut tertangkap tepat waktu.
  function tick() {
    if (currentNavPanel === 'exploration' && explorationView === 'menu') {
      renderExploration();
    }
  }

  function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.id === 'btn-nav-menu') {
        btn.addEventListener('click', () => openMenuFlyout());
        return;
      }
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.panel === 'exploration') explorationView = 'menu';
        render(btn.dataset.panel);
      });
    });
  }

  return { render, initNav, tick };
})();

window.Panels = Panels;
