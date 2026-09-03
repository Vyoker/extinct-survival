/**
 * Main
 * Titik masuk aplikasi: menangani layar login, inisialisasi state,
 * dan menyalakan loop game.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    Notifications.init();

    const btnStart = document.getElementById('btn-start-game');
    const btnContinue = document.getElementById('btn-continue-game');
    const inputName = document.getElementById('input-username');
    const inputLocation = document.getElementById('input-start-location');

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
      enterGame();
    };
  }

  async function enterGame() {
    await ItemDB.load();
    await LocationDB.load();
    await QuestDB.load();
    if (window.QuestSystem) QuestSystem.ensureShape();
    await FactionDB.load();
    if (window.FactionSystem) FactionSystem.ensureShape();
    await PassDB.load();
    if (window.PassSystem) PassSystem.ensureShape();
    GameState.migrateEquipmentDurability();

    Player.applyOfflineProgress();
    GameState.save();

    Renderer.showScreen('screen-game');

    if (window.BattleBridge) BattleBridge.recoverInterruptedBattle();
    Renderer.renderHUD();

    Panels.initNav();
    Panels.render('dashboard');

    Player.startLoop();
    GameState.startAutosave();

    // Ticker 1 detik untuk update countdown cooldown (Scavenge/Travel)
    setInterval(() => Panels.tick(), 1000);

    Events.on('player:updated', () => Renderer.renderHUD());

    // Save saat tab ditutup/di-minimize (penting untuk mobile webview)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) GameState.save();
    });
    window.addEventListener('beforeunload', () => GameState.save());

    Events.emit('notify', { message: `Selamat datang di dunia yang hancur, ${GameState.get().player.name}.` });
  }
})();
