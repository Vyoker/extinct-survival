/**
 * Ads Module
 * Lapisan abstraksi ke AdMob Rewarded Ad. Game logic (Spin Wheel, dll)
 * cukup panggil Ads.showRewarded(onEarned, onFail) tanpa perlu tau
 * detail bridge JS dari tool pembungkus APK (Appmint, dsb).
 *
 * ID AdMob (dari dashboard AdMob, unit "Extinct Survival" > Iklan Reward):
 *   App ID          : ca-app-pub-2117214602260321~5175491939
 *   Rewarded Unit ID: ca-app-pub-2117214602260321/7759468841
 *
 * ⚠️ WAJIB dilakukan MANUAL di dashboard Appmint (bukan cuma di sini):
 * Kedua ID di atas juga harus di-paste ke pengaturan project APK kamu
 * di Appmint (menu AdMob Integration -> App ID & Rewarded Ad Unit ID).
 * Appmint butuh ID itu buat inisialisasi SDK AdMob native di sisi
 * Android — nilai ADMOB_REWARDED_UNIT_ID di bawah ini cuma dipakai
 * kalau bridge JS Appmint kamu memang menerima ad unit ID sebagai
 * parameter (lihat TODO callNativeBridge() di bawah).
 *
 * ⚠️ TODO WAJIB sebelum build APK final:
 * Isi bagian `callNativeBridge()` di bawah dengan nama fungsi JS yang
 * benar sesuai dokumentasi Appmint (cek dashboard project APK kamu ->
 * menu AdMob Integration / JS Bridge API). Appmint biasanya expose
 * salah satu pola berikut setelah APK berjalan (BUKAN saat dibuka di
 * browser Termux biasa):
 *   - window.Appmint.showRewardedAd(ADMOB_REWARDED_UNIT_ID, callbackName)
 *   - window.AppmintAds.showRewarded(onSuccess, onFail)
 *   - event listener custom, misal document.addEventListener('appmint:adReward', ...)
 * Ganti isi callNativeBridge() sesuai yang tertulis di dashboard kamu.
 *
 * Sampai bridge asli diisi, module ini otomatis jalan di "mode test"
 * (simulasi delay 2 detik lalu auto-reward) supaya development &
 * testing di Termux/Acode tetap lancar tanpa APK.
 */
const Ads = (function () {
  'use strict';

  const ADMOB_APP_ID = 'ca-app-pub-2117214602260321~5175491939';
  const ADMOB_REWARDED_UNIT_ID = 'ca-app-pub-2117214602260321/7759468841';

  // Deteksi apakah game sedang jalan di dalam APK yang sudah pasang
  // bridge Appmint. Selama belum ketemu bridge aslinya, ini akan false
  // dan module otomatis pakai mode test.
  function hasNativeBridge() {
    return !!(window.Appmint || window.AppmintAds || window.AndroidAds);
  }

  function callNativeBridge(onEarned, onFail) {
    // ⚠️ ISI DI SINI sesuai dokumentasi Appmint kamu. Contoh pola umum
    // (SESUAIKAN nama fungsi & parameter dengan dashboard Appmint):
    //
    // window.Appmint.showRewardedAd(ADMOB_REWARDED_UNIT_ID, function (result) {
    //   if (result && result.rewarded) onEarned();
    //   else onFail('Iklan ditutup sebelum selesai.');
    // });

    console.warn('[Ads] Bridge Appmint belum dikonfigurasi di ads.js. Pakai mode test.');
    runTestMode(onEarned, onFail);
  }

  // Mode simulasi untuk development di browser/Termux (tanpa APK asli).
  // Supaya alur reward tetap bisa dites end-to-end sebelum APK jadi.
  function runTestMode(onEarned, onFail) {
    Events.emit('notify', { message: '🎬 (Mode Test) Memuat iklan reward...' });
    setTimeout(() => {
      Events.emit('notify', { message: '✅ (Mode Test) Iklan selesai ditonton.' });
      onEarned();
    }, 2000);
  }

  let adInProgress = false;

  /**
   * Tampilkan rewarded ad. onEarned dipanggil kalau user berhasil
   * nonton sampai selesai (dapat reward). onFail dipanggil kalau iklan
   * gagal load / ditutup sebelum selesai / user belum bisa nonton lagi.
   */
  function showRewarded(onEarned, onFail) {
    if (adInProgress) {
      Events.emit('notify', { message: 'Iklan sedang diproses, tunggu sebentar.', type: 'error' });
      if (onFail) onFail('busy');
      return;
    }
    adInProgress = true;

    const wrappedEarned = () => { adInProgress = false; onEarned(); };
    const wrappedFail = (reason) => {
      adInProgress = false;
      Events.emit('notify', { message: 'Iklan tidak tersedia atau belum selesai ditonton.', type: 'error' });
      if (onFail) onFail(reason);
    };

    if (hasNativeBridge()) {
      callNativeBridge(wrappedEarned, wrappedFail);
    } else {
      runTestMode(wrappedEarned, wrappedFail);
    }
  }

  function isTestMode() {
    return !hasNativeBridge();
  }

  return { showRewarded, isTestMode };
})();

window.Ads = Ads;
