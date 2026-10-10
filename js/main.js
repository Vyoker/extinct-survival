/**
 * Main
 * Titik masuk aplikasi: menangani layar login, inisialisasi state,
 * dan menyalakan loop game.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    Notifications.init();
    // v0.3.8: sistem audio (SFX + BGM)
    if (window.AudioManager) AudioManager.init();

    const btnStart = document.getElementById('btn-start-game');
    const btnContinue = document.getElementById('btn-continue-game');
    const btnCloudRestore = document.getElementById('btn-cloud-restore');
    const inputName = document.getElementById('input-username');
    const inputLocation = document.getElementById('input-start-location');

    // Tampilkan versi app di layar login
    const versionEl = document.getElementById('login-version');
    if (versionEl && window.APP_VERSION) versionEl.textContent = 'v' + window.APP_VERSION;

    if (btnCloudRestore) {
      btnCloudRestore.addEventListener('click', () => {
        if (window.CloudSave) CloudSave.open('restore');
        else Events.emit('notify', { message: 'Modul cloud save belum termuat.', type: 'error' });
      });
    }

    // Jika ada save sebelumnya, tampilkan tombol lanjutkan
    if (GameState.hasSave()) {
      btnContinue.classList.remove('hidden');
      btnStart.textContent = 'MULAI KARAKTER BARU';
    }

    btnStart.addEventListener('click', () => {
      const name = inputName.value.trim();
      if (!name) {
        Events.emit('notify', { message: 'Masukkan nama karaktermu dulu.', type: 'error' });
        return;
      }
      if (GameState.hasSave()) {
        const confirmReset = confirm('Karakter baru akan menghapus save lama. Lanjutkan?');
        if (!confirmReset) return;
        GameState.reset();
      }
      GameState.init(name, inputLocation.value);
      const cityName = inputLocation.options[inputLocation.selectedIndex].text;
      showProlog(cityName);
    });

    btnContinue.addEventListener('click', () => {
      GameState.load();
      enterGame();
    });
  });

  // Cerita pembuka, tampil sekali sesudah karakter BARU dibuat (bukan
  // saat Lanjutkan/Continue save lama). Bisa di-skip kapan saja lewat
  // tombol Lanjutkan di bawah.
  function buildPrologHTML(cityName) {
    return `
      <p>Dua puluh tahun sudah berlalu sejak <strong>The Great Collapse</strong> meruntuhkan segalanya yang pernah kita kenal.</p>
      <p>Kota-kota berubah jadi reruntuhan. Langit tak lagi sebiru dulu. Dan manusia yang tersisa belajar satu hal: bertahan hidup bukan lagi pilihan, tapi keharusan.</p>
      <p>Kau terbangun di pinggiran <span class="prolog-city-name">${cityName}</span>, tanpa banyak yang tersisa selain nafasmu sendiri dan tekad untuk tetap hidup satu hari lagi.</p>
      <p>Tak ada yang tahu berapa lama kau bisa bertahan. Tak ada yang menjamin esok hari akan datang.</p>
      <p>Tapi selama jantung ini masih berdetak, kau akan terus melawan — mengais reruntuhan, membangun kembali, dan menghadapi apa pun yang datang.</p>
      <p class="prolog-iconic-line">INILAH BAGAIMANA AKU MATI.</p>
    `;
  }

  function showProlog(cityName) {
    const crawlEl = document.getElementById('prolog-crawl-text');
    crawlEl.innerHTML = buildPrologHTML(cityName);
    // Reset animasi crawl tiap kali screen ini dibuka (karakter baru)
    crawlEl.style.animation = 'none';
    void crawlEl.offsetWidth; // force reflow
    crawlEl.style.animation = '';

    Renderer.showScreen('screen-prolog');

    const btnContinueProlog = document.getElementById('btn-prolog-continue');
    btnContinueProlog.onclick = () => {
      enterGame({ isNew: true });
    };
  }

  // v0.3.9: alur masuk game lewat SPLASH SCREEN — loading data
  // bertahap dengan progress bar + cek cloud save otomatis (opsi B:
  // kalau simpanan cloud lebih baru, tawarkan pulihkan).
  async function enterGame(opts) {
    opts = opts || {};
    Renderer.showScreen('screen-splash');

    const barFill = document.getElementById('splash-bar-fill');
    const statusEl = document.getElementById('splash-status');
    const versionEl = document.getElementById('splash-version');
    if (versionEl && window.APP_VERSION) versionEl.textContent = 'v' + window.APP_VERSION;
    const setP = (pct, label) => {
      if (barFill) barFill.style.width = Math.min(100, Math.max(0, pct)) + '%';
      if (statusEl && label) statusEl.textContent = label;
    };
    // Beri kesempatan browser render splash dulu sebelum kerja berat.
    const paint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));

    try {
      setP(4, 'Menyiapkan...');
      await paint();

      const stages = [
        ['Memuat data item...', async () => { await ItemDB.load(); }],
        ['Memuat data lokasi...', async () => { await LocationDB.load(); }],
        ['Memuat data misi...', async () => { await QuestDB.load(); }],
        ['Memuat data faksi...', async () => { await FactionDB.load(); }],
        ['Memuat data pass...', async () => { await PassDB.load(); }]
      ];
      for (let i = 0; i < stages.length; i++) {
        setP(8 + i * 13, stages[i][0]);
        await paint();
        await stages[i][1]();
      }

      // Cek cloud save (opsi B) — lewati untuk karakter baru.
      if (!opts.isNew) {
        setP(78, 'Memeriksa simpanan cloud...');
        await paint();
        await maybeCloudRestore();
      }

      setP(88, 'Menyiapkan karakter...');
      await paint();
      if (window.QuestSystem) QuestSystem.ensureShape();
      if (window.FactionSystem) FactionSystem.ensureShape();
      if (window.PassSystem) PassSystem.ensureShape();
      GameState.migrateEquipmentDurability();

      Player.applyOfflineProgress();
      GameState.save();

      setP(96, 'Menyelesaikan...');
      await paint();

      Renderer.showScreen('screen-game');

      if (window.BattleBridge) BattleBridge.recoverInterruptedBattle();
      Renderer.renderHUD();

      Panels.initNav();
      Panels.render('dashboard');

      Player.startLoop();
      GameState.startAutosave();

      // v0.3.8: mulai BGM (gesture user dari tombol tadi = izin autoplay)
      if (window.AudioManager) AudioManager.playBgm();

      // Ticker 1 detik untuk update countdown cooldown (Scavenge/Travel)
      setInterval(() => Panels.tick(), 1000);

      // v0.3.5: cek mail (kiriman admin) berkala untuk badge
      if (window.Mail) Mail.start();

      Events.on('player:updated', () => Renderer.renderHUD());

      // Save saat tab ditutup/di-minimize (penting untuk mobile webview)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) GameState.save();
      });
      window.addEventListener('beforeunload', () => GameState.save());

      Events.emit('notify', { message: `Selamat datang di dunia yang hancur, ${GameState.get().player.name}.` });
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = 'Gagal memuat: ' + (e.message || e);
        statusEl.style.color = 'var(--accent-red)';
      }
    }
  }

  // v0.3.9: cek cloud save saat startup. Kalau versi cloud lebih baru
  // dari terakhir kita push, tawarkan pulihkan (tidak ditimpa diam-diam).
  // Mengembalikan Promise<boolean>: true jika user memilih pulihkan.
  function maybeCloudRestore() {
    return new Promise((resolve) => {
      (async () => {
        try {
          if (!window.CloudSave) return resolve(false);
          const code = CloudSave.getCode();
          if (!code) return resolve(false);
          const ctrl = new AbortController();
          const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 9000);
          let res;
          try {
            res = await fetch('/.netlify/functions/player-load?code=' + encodeURIComponent(code), { signal: ctrl.signal });
          } catch (e) {
            clearTimeout(timer);
            return resolve(false); // offline / bukan Netlify → lewati diam-diam
          }
          clearTimeout(timer);
          if (!res.ok) return resolve(false);
          const data = await res.json().catch(() => null);
          const cloudTs = data && data.updatedAt;
          const lastPushed = CloudSave.getLastSaved();
          // Cloud dianggap lebih baru kalau timestamp-nya melampaui
          // terakhir kita simpan ke cloud.
          if (!cloudTs || (lastPushed && cloudTs <= lastPushed + 2000)) return resolve(false);

          const box = document.getElementById('splash-cloud-box');
          const desc = document.getElementById('splash-cloud-desc');
          const btnR = document.getElementById('splash-cloud-restore');
          const btnL = document.getElementById('splash-cloud-local');
          const statusEl = document.getElementById('splash-status');
          let cloudName = '';
          try {
            const sp = data && data.data && data.data.save && data.data.save.player;
            if (sp && sp.name) cloudName = ' • ' + sp.name;
          } catch (e) {}
          if (desc) desc.textContent = 'Versi cloud: ' + fmtCloudTime(cloudTs) + cloudName + '. Pulihkan dan timpa data lokal di perangkat ini?';
          if (box) box.classList.remove('hidden');
          const done = async (restore) => {
            if (box) box.classList.add('hidden');
            if (btnR) btnR.onclick = null;
            if (btnL) btnL.onclick = null;
            if (restore) {
              try {
                if (statusEl) statusEl.textContent = 'Memulihkan dari cloud...';
                await CloudSave.loadFrom(code);
                Events.emit('notify', { message: 'Save cloud dipulihkan.' });
                resolve(true);
              } catch (e) {
                Events.emit('notify', { message: 'Gagal pulihkan cloud: ' + e.message, type: 'error' });
                resolve(false);
              }
            } else {
              resolve(false);
            }
          };
          if (btnR) btnR.onclick = () => done(true);
          if (btnL) btnL.onclick = () => done(false);
        } catch (e) {
          resolve(false);
        }
      })();
    });
  }

  function fmtCloudTime(ts) {
    try {
      return new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }
})();
