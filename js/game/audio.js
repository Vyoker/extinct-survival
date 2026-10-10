/**
 * AudioManager (v0.3.8) — sistem audio game: SFX + BGM.
 *
 * - SFX disintesis real-time via Web Audio API (tanpa file, 0 KB,
 *   bunyi instan): klik UI, battle, notifikasi.
 * - BGM: file MP3 loop (assets/audio/bgm-main.mp3, buatan Suno).
 * - Volume BGM & SFX terpisah + mute, tersimpan di localStorage
 *   (tidak ikut save game agar tidak merusak skema save lama).
 * - AudioContext dibuat saat gesture pertama user (aturan autoplay
 *   browser/WebView); semua API aman dipanggil sebelum init.
 */
const AudioManager = (function () {
  'use strict';

  const PREF_KEY = 'extinct_survival_audio';
  const BGM_SRC = 'assets/audio/bgm-main.mp3';

  const prefs = { bgm: 70, sfx: 80, muted: false };

  let actx = null;
  let sfxBus = null;
  let noiseBuf = null;
  let bgmEl = null;
  let fadeTimer = null;

  /* ---------------- preferensi ---------------- */

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p.bgm === 'number') prefs.bgm = clampNum(p.bgm, 0, 100);
      if (typeof p.sfx === 'number') prefs.sfx = clampNum(p.sfx, 0, 100);
      prefs.muted = !!p.muted;
    } catch (e) { /* abaikan */ }
  }

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* abaikan */ }
  }

  function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------------- Web Audio: SFX bus ---------------- */

  function ensureCtx() {
    if (actx) {
      if (actx.state === 'suspended') actx.resume().catch(function () {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      actx = new AC();
      sfxBus = actx.createGain();
      sfxBus.gain.value = prefs.sfx / 100;
      sfxBus.connect(actx.destination);
    } catch (e) { return false; }
    return true;
  }

  function unlock() { ensureCtx(); }

  function getNoiseBuf() {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(actx.sampleRate * 1.2);
    noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // Nada sederhana dengan envelope attack/decay.
  function tone(o) {
    if (prefs.muted || !ensureCtx()) return;
    const t0 = actx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.15;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(1, o.f || 440), t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol || 0.3), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // Derau tersaring (untuk tebasan, ledakan, dsb).
  function noise(o) {
    if (prefs.muted || !ensureCtx()) return;
    const t0 = actx.currentTime + (o.delay || 0);
    const dur = o.dur || 0.2;
    const src = actx.createBufferSource();
    src.buffer = getNoiseBuf();
    src.loop = true;
    const flt = actx.createBiquadFilter();
    flt.type = o.type || 'lowpass';
    flt.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
    flt.Q.value = o.q || 0.8;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol || 0.3), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ---------------- definisi SFX ---------------- */

  const SFX = {
    click: function () { tone({ f: 1350, f2: 900, type: 'square', dur: 0.055, vol: 0.16 }); },
    tab: function () { tone({ f: 760, f2: 520, type: 'triangle', dur: 0.07, vol: 0.2 }); },
    open: function () {
      tone({ f: 480, f2: 920, type: 'sine', dur: 0.1, vol: 0.2 });
      noise({ dur: 0.1, vol: 0.1, type: 'highpass', f: 900 });
    },
    close: function () { tone({ f: 920, f2: 480, type: 'sine', dur: 0.1, vol: 0.18 }); },
    error: function () {
      tone({ f: 165, f2: 110, type: 'sawtooth', dur: 0.2, vol: 0.28 });
      tone({ f: 165, f2: 110, type: 'sawtooth', dur: 0.2, vol: 0.22, delay: 0.16 });
    },
    coin: function () {
      tone({ f: 950, type: 'sine', dur: 0.08, vol: 0.28 });
      tone({ f: 1420, type: 'sine', dur: 0.14, vol: 0.28, delay: 0.07 });
    },
    heal: function () { tone({ f: 380, f2: 940, type: 'sine', dur: 0.3, vol: 0.22 }); },
    levelup: function () {
      const seq = [523, 659, 784, 1046];
      seq.forEach(function (f, i) {
        tone({ f: f, type: 'triangle', dur: 0.14, vol: 0.26, delay: i * 0.09 });
      });
    },
    swing: function () { noise({ dur: 0.18, vol: 0.3, type: 'bandpass', f: 1900, f2: 380, q: 1.2 }); },
    shoot: function () {
      noise({ dur: 0.09, vol: 0.4, type: 'highpass', f: 1300 });
      tone({ f: 230, f2: 55, type: 'square', dur: 0.13, vol: 0.3 });
    },
    hit: function () {
      noise({ dur: 0.12, vol: 0.42, type: 'lowpass', f: 950 });
      tone({ f: 130, f2: 48, type: 'sine', dur: 0.16, vol: 0.5 });
    },
    crit: function () {
      SFX.hit();
      tone({ f: 1750, f2: 2400, type: 'square', dur: 0.09, vol: 0.18, delay: 0.02 });
      noise({ dur: 0.2, vol: 0.25, type: 'highpass', f: 2500, delay: 0.02 });
    },
    miss: function () { noise({ dur: 0.16, vol: 0.16, type: 'highpass', f: 2800, f2: 6200 }); },
    victory: function () {
      const seq = [220, 261.6, 329.6, 440];
      seq.forEach(function (f, i) {
        tone({ f: f, type: 'triangle', dur: 0.2, vol: 0.3, delay: i * 0.13 });
      });
      tone({ f: 440, type: 'triangle', dur: 0.5, vol: 0.22, delay: 0.55 });
    },
    defeat: function () {
      tone({ f: 330, f2: 82, type: 'sawtooth', dur: 0.9, vol: 0.24 });
      noise({ dur: 0.9, vol: 0.18, type: 'lowpass', f: 300, f2: 90 });
    },
    flee: function () { noise({ dur: 0.32, vol: 0.2, type: 'bandpass', f: 500, f2: 2600, q: 1.4 }); },
    craft: function () {
      tone({ f: 320, type: 'square', dur: 0.05, vol: 0.25 });
      noise({ dur: 0.08, vol: 0.25, type: 'bandpass', f: 2600, q: 2, delay: 0.03 });
      tone({ f: 470, type: 'square', dur: 0.07, vol: 0.22, delay: 0.09 });
    },
    mail: function () {
      tone({ f: 880, type: 'sine', dur: 0.1, vol: 0.24 });
      tone({ f: 1174, type: 'sine', dur: 0.16, vol: 0.24, delay: 0.09 });
    },
    skill: function () {
      tone({ f: 600, f2: 1800, type: 'sine', dur: 0.24, vol: 0.2 });
      tone({ f: 900, f2: 2700, type: 'sine', dur: 0.24, vol: 0.12, delay: 0.05 });
    }
  };

  function sfx(name) {
    if (prefs.muted) return;
    try {
      const fn = SFX[name];
      if (typeof fn === 'function') fn();
    } catch (e) { /* SFX tidak boleh merusak game */ }
  }

  /* ---------------- BGM ---------------- */

  function ensureBgm() {
    if (bgmEl) return bgmEl;
    try {
      bgmEl = new Audio(BGM_SRC);
      bgmEl.loop = true;
      bgmEl.preload = 'auto';
      applyBgmVol();
    } catch (e) { bgmEl = null; }
    return bgmEl;
  }

  function applyBgmVol() {
    if (bgmEl) bgmEl.volume = prefs.muted ? 0 : (prefs.bgm / 100) * 0.9;
  }

  function playBgm() {
    const el = ensureBgm();
    if (!el) return;
    try {
      // Fade-in halus 1.2 detik supaya tidak "jedug".
      if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
      const target = prefs.muted ? 0 : (prefs.bgm / 100) * 0.9;
      el.volume = 0;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
      const step = target / 12;
      let n = 0;
      fadeTimer = setInterval(function () {
        n++;
        if (!bgmEl || prefs.muted) { clearInterval(fadeTimer); fadeTimer = null; if (bgmEl) bgmEl.volume = 0; return; }
        bgmEl.volume = Math.min(target, bgmEl.volume + step);
        if (n >= 12 || bgmEl.volume >= target) { clearInterval(fadeTimer); fadeTimer = null; }
      }, 100);
    } catch (e) { /* abaikan */ }
  }

  function stopBgm() {
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    if (bgmEl) { try { bgmEl.pause(); } catch (e) {} }
  }

  /* ---------------- mute & volume ---------------- */

  function setMuted(m) {
    prefs.muted = !!m;
    savePrefs();
    applyBgmVol();
    refreshMuteBtn();
  }

  function toggleMute() { setMuted(!prefs.muted); }

  function setBgmVol(v) {
    prefs.bgm = clampNum(Math.round(v), 0, 100);
    savePrefs();
    applyBgmVol();
  }

  function setSfxVol(v) {
    prefs.sfx = clampNum(Math.round(v), 0, 100);
    savePrefs();
    if (sfxBus) sfxBus.gain.value = prefs.sfx / 100;
  }

  function isMuted() { return prefs.muted; }
  function getPrefs() { return { bgm: prefs.bgm, sfx: prefs.sfx, muted: prefs.muted }; }

  function refreshMuteBtn() {
    const btn = document.getElementById('btn-audio-mute');
    if (!btn) return;
    const icon = prefs.muted ? 'volumeX' : 'volume';
    btn.innerHTML = window.Icons ? Icons.svg(icon) : (prefs.muted ? 'MUTE' : 'SUARA');
    btn.classList.toggle('muted', prefs.muted);
    btn.title = prefs.muted ? 'Nyalakan suara' : 'Matikan suara';
  }

  /* ---------------- panel pengaturan ---------------- */

  function openSettings() {
    if (!window.OverlayManager) return;
    const p = getPrefs();
    const html =
      '<div class="audio-settings">' +
      '<h2 class="panel-title">' + (window.Icons ? Icons.svg('volume') : '') + ' Pengaturan Audio</h2>' +
      '<div class="audio-row">' +
      '<label>Musik (BGM)</label>' +
      '<input type="range" id="audio-bgm-range" min="0" max="100" value="' + p.bgm + '">' +
      '<span id="audio-bgm-val">' + p.bgm + '%</span>' +
      '</div>' +
      '<div class="audio-row">' +
      '<label>Efek Suara (SFX)</label>' +
      '<input type="range" id="audio-sfx-range" min="0" max="100" value="' + p.sfx + '">' +
      '<span id="audio-sfx-val">' + p.sfx + '%</span>' +
      '</div>' +
      '<div class="audio-row">' +
      '<label>Suara</label>' +
      '<button id="audio-mute-toggle" class="btn ' + (p.muted ? '' : 'btn-primary') + '">' +
      (p.muted ? 'DIMATIKAN — tap untuk nyalakan' : 'MENYALA — tap untuk matikan') +
      '</button>' +
      '</div>' +
      '<p class="audio-hint">BGM: "Ashes of the Archipelago" — dibuat dengan Suno.</p>' +
      '</div>';
    const id = OverlayManager.open(html, { closeOnBackdrop: true });
    if (!id) return;
    sfx('open');
    const root = document.querySelector('.audio-settings');
    if (!root) return;
    const bgmRange = root.querySelector('#audio-bgm-range');
    const sfxRange = root.querySelector('#audio-sfx-range');
    const bgmVal = root.querySelector('#audio-bgm-val');
    const sfxVal = root.querySelector('#audio-sfx-val');
    const muteBtn = root.querySelector('#audio-mute-toggle');
    bgmRange.addEventListener('input', function () {
      setBgmVol(parseInt(bgmRange.value, 10));
      bgmVal.textContent = bgmRange.value + '%';
    });
    sfxRange.addEventListener('input', function () {
      setSfxVol(parseInt(sfxRange.value, 10));
      sfxVal.textContent = sfxRange.value + '%';
      sfx('click');
    });
    muteBtn.addEventListener('click', function () {
      toggleMute();
      const np = getPrefs();
      muteBtn.textContent = np.muted ? 'DIMATIKAN — tap untuk nyalakan' : 'MENYALA — tap untuk matikan';
      muteBtn.classList.toggle('btn-primary', !np.muted);
    });
  }

  /* ---------------- init & hook global ---------------- */

  function onDocClick(e) {
    if (prefs.muted) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    // Jangan bunyikan slider volume sendiri / area panel audio.
    if (t.closest('input[type="range"]') || t.closest('.audio-settings')) return;
    if (t.closest('.nav-btn[data-panel]')) { sfx('tab'); return; }
    if (t.closest('#btn-audio-mute')) { /* ditangani toggleMute sendiri */ return; }
    if (t.closest('button, a, [role="button"]')) sfx('click');
  }

  function init() {
    loadPrefs();
    const unlockOnce = function () { unlock(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, unlockOnce, { once: true, passive: true });
    });
    document.addEventListener('click', onDocClick);
    if (window.Events) {
      Events.on('notify', function (p) {
        if (p && p.type === 'error') sfx('error');
      });
    }
    // Hemat baterai: jeda BGM saat tab disembunyikan.
    document.addEventListener('visibilitychange', function () {
      if (!bgmEl) return;
      try {
        if (document.hidden) bgmEl.pause();
        else if (!prefs.muted && bgmEl.paused && bgmEl.dataset.started === '1') bgmEl.play().catch(function () {});
      } catch (e) {}
    });
    // Tandai BGM sudah pernah dimulai (untuk resume visibilitychange).
    const origPlay = playBgm;
    playBgm = function () { // eslint-disable-line no-func-assign
      origPlay();
      if (bgmEl) { try { bgmEl.dataset.started = '1'; } catch (e) {} }
    };
    refreshMuteBtn();
  }

  return {
    init: init,
    unlock: unlock,
    sfx: sfx,
    playBgm: function () { playBgm(); },
    stopBgm: stopBgm,
    toggleMute: toggleMute,
    setMuted: setMuted,
    isMuted: isMuted,
    setBgmVol: setBgmVol,
    setSfxVol: setSfxVol,
    getPrefs: getPrefs,
    openSettings: openSettings,
    refreshMuteBtn: refreshMuteBtn
  };
})();

window.AudioManager = AudioManager;
