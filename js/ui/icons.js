/**
 * Icons — sistem ikon SVG internal (pengganti emoticon).
 *
 * Semua ikon digambar sebagai <symbol> 24x24 dalam satu sprite yang
 * disuntik ke <body> saat pertama dipakai. Gaya konsisten: garis
 * 1.8px, ujung membulat, warna mengikuti currentColor sehingga bisa
 * diwarnai lewat CSS (color / .xicon).
 *
 * Pakai: Icons.svg('heart', 'cls-tambahan')
 * Untuk data lama berbasis emoticon: Icons.fromEmoji('🐺')
 */
const Icons = (function () {
  'use strict';

  var SPRITE_ID = 'xi-sprite';

  // name -> isi <symbol> (tanpa wrapper symbol)
  var DEFS = {
    /* ---------- status & survival ---------- */
    heart: '<path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3z"/>',
    meat: '<circle cx="14.5" cy="9.5" r="5.2"/><path d="M10.9 13.1 4.8 19.2"/><circle cx="3.6" cy="18" r="1.6"/><circle cx="6" cy="20.4" r="1.6"/>',
    droplet: '<path d="M12 3s6 6.2 6 10.4a6 6 0 0 1-12 0C6 9.2 12 3 12 3z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/>',
    shield: '<path d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6L12 3z"/>',
    shieldCheck: '<path d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6L12 3z"/><path d="m9 11.6 2.2 2.2 4.3-4.3"/>',
    swords: '<path d="M5 4l9.5 9.5M19 4l-9.5 9.5"/><path d="M13.2 13.2 15.5 15.5M10.8 13.2 8.5 15.5"/><path d="M4 20l3.5-.8M20 20l-3.5-.8"/>',
    burst: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8"/><circle cx="12" cy="12" r="2.5"/>',
    flame: '<path d="M12 3s5.5 4.5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2 1-3.8 2.2-5.2.3 1.2 1 2.2 2 2.7C10.5 7.5 11 5 12 3z"/>',
    skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.9 1.7 5 3.7 6.2V19a1.5 1.5 0 0 0 1.5 1.5h4.6a1.5 1.5 0 0 0 1.5-1.5v-2.3c2-1.2 3.7-3.3 3.7-6.2A7.5 7.5 0 0 0 12 3z"/><circle cx="9.3" cy="10.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.7" cy="10.6" r="1.5" fill="currentColor" stroke="none"/><path d="M12 13.5v2.8"/>',

    /* ---------- navigasi & menu ---------- */
    home: '<path d="M3.5 10.5 12 3l8.5 7.5"/><path d="M5.5 9.3V20h13V9.3"/><path d="M10 20v-5.5h4V20"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    backpack: '<path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8"/><path d="M5.5 8h13l-1 12h-11l-1-12z"/><path d="M9.5 12.5h5V17h-5z"/>',
    medal: '<circle cx="12" cy="9" r="5"/><path d="M9.2 13.4 7.5 21l4.5-2.6L16.5 21l-1.7-7.6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.8-1.3"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.5l6.1-.9L12 3z"/>',
    trophy: '<path d="M8 4h8v4.5a4 4 0 0 1-8 0V4z"/><path d="M8 5.5H4.8a3.2 3.2 0 0 0 3.3 3.6M16 5.5h3.2a3.2 3.2 0 0 1-3.3 3.6"/><path d="M12 12.5V16"/><path d="M8.5 20h7M10 16.5h4"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    move: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    run: '<circle cx="14.5" cy="4.5" r="2"/><path d="M6 20l3.5-4 2 1 1.5 3M9.5 16 7 13l4-2 2-3 3 1 3 2M13 8l-2 5 3 1 4-1"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    flag: '<path d="M5.5 21.5v-17"/><path d="M5.5 5h12l-2.6 3.5 2.6 3.5h-12"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/>',

    /* ---------- ekonomi & item ---------- */
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.3 9.7c0-1 1.2-1.7 2.7-1.7 1.6 0 2.8.7 2.8 1.8 0 2.4-5.6 1.6-5.6 4 0 1.1 1.2 1.8 2.8 1.8 1.5 0 2.7-.7 2.7-1.7"/>',
    gem: '<path d="M7 3.5h10l4 5.5-9 11.5L3 9l4-5.5z"/><path d="M3 9h18M9.3 9 12 20.5 14.7 9M7 3.5 9.3 9 12 3.5 14.7 9 17 3.5"/>',
    ticket: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5V8z"/><path d="M13.5 6.5v2M13.5 11v2M13.5 15.5v2"/>',
    card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><path d="M7 15h4"/>',
    gift: '<rect x="4" y="9.5" width="16" height="3.5"/><path d="M6 13v7.5h12V13M12 9.5V20.5"/><path d="M12 9.5S8.5 9.5 7 8A1.9 1.9 0 0 1 9.8 5.6C11 6.6 12 9.5 12 9.5zM12 9.5s3.5 0 5-1.5a1.9 1.9 0 0 0-2.8-2.4C13 6.6 12 9.5 12 9.5z"/>',
    sparkles: '<path d="M12 3l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7L12 3z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
    box: '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>',
    store: '<path d="M4 9.5 5.3 5h13.4L20 9.5"/><path d="M4 9.5V19h16V9.5"/><path d="M4 9.5h16"/><path d="M9.5 19v-4.5h5V19"/>',
    scroll: '<path d="M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8"/><path d="M8 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2"/><path d="M11 9.5h5M11 13h5"/>',
    hammer: '<path d="M13.5 4.5 19 10l-2.2 2.2L11.3 6.7l2.2-2.2z"/><path d="M11.8 8.2 5 15l2.8 2.8 6.8-6.8"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.7 2.7-2.5-.7-.7-2.5 2.9-2.5z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.5V8h-4.5"/>',
    alert: '<path d="M12 3.5 22 20H2L12 3.5z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/>',

    /* ---------- cloud save ---------- */
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.3 11a3.8 3.8 0 0 1-.8 7.5H7z"/>',
    cloudUp: '<path d="M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.3 11a3.8 3.8 0 0 1-.8 7.5H7z"/><path d="M12 12.5v5.5M9.7 14.7 12 12.4l2.3 2.3"/>',
    cloudDown: '<path d="M7 18.5a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.3 11a3.8 3.8 0 0 1-.8 7.5H7z"/><path d="M12 12.5v5.5M9.7 15.7 12 18l2.3-2.3"/>',
    play: '<path d="M7 4.5v15l12-7.5-12-7.5z"/>',
    door: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15.3" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
    question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6A2.5 2.5 0 0 1 12 8c1.4 0 2.5 1 2.5 2.2 0 1.7-2.1 2-2.5 3.3"/><circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none"/>',

    /* ---------- senjata ---------- */
    knife: '<path d="M4.5 19.5 13.5 10.5"/><path d="M13.5 10.5 18 4l2.5 2.5-6.5 6.5-2.5-2.5z"/><path d="M4.5 19.5l2-2"/>',
    fist: '<path d="M7.5 11.5V7a1.6 1.6 0 0 1 3.2 0v3M10.7 10V5.5a1.6 1.6 0 0 1 3.2 0V10M13.9 10V7a1.6 1.6 0 0 1 3.2 0v5.5"/><path d="M7.5 11.5 5.8 13a4.6 4.6 0 0 0 3.4 7.5h5.6a4.6 4.6 0 0 0 4.5-3.7l-1.4-4.3"/>',
    pistol: '<path d="M2.5 7.5h13l2.5 3.5h-5.5l-.8 7H8.2l.6-5H4.5l-2-5.5z"/><path d="M9.5 11l-.4 3"/>',
    rifle: '<path d="M2.5 9.5h15l4 2-1.8 2h-7.4l-.9 5.5H8l.9-4.5H4.5l-2-5z"/><path d="M14 9.5V7h3v2.5"/>',
    bow: '<path d="M6.5 3.5c4.5 4 4.5 13 0 17"/><path d="M6.5 3.5v17"/><path d="M6.5 12H17"/><path d="M17 12l-3.2-2.6M17 12l-3.2 2.6"/>',
    axe: '<path d="M5.5 20.5 13.5 9"/><path d="M12.5 4.5 19 8l-2.3 4.2-6.2-3.5 2-4.2z"/>',

    /* ---------- musuh & karakter (siluet tegas, cocok untuk token) ---------- */
    survivor: '<path d="M12 2.8a5.2 5.2 0 0 1 5.2 5.2v1.2H6.8V8A5.2 5.2 0 0 1 12 2.8z"/><circle cx="12" cy="13" r="3.8"/><path d="M4.5 20.5c.8-3.4 3.8-5.5 7.5-5.5s6.7 2.1 7.5 5.5"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
    wolf: '<path d="M4 3.5 7.6 6 12 2.8l4.4 3.2L20 3.5l-.9 8.2-3.4 2.4v4.4H8.3v-4.4L4.9 11.7 4 3.5z" fill="currentColor" stroke="none"/><circle cx="9.3" cy="10.5" r="1.1" fill="#0d0c09" stroke="none"/><circle cx="14.7" cy="10.5" r="1.1" fill="#0d0c09" stroke="none"/>',
    tiger: '<path d="M4 3.5 7.6 6 12 2.8l4.4 3.2L20 3.5l-.9 8.2-3.4 2.4v4.4H8.3v-4.4L4.9 11.7 4 3.5z" fill="currentColor" stroke="none"/><path d="M12 2.8v4M8.5 4.5 10 8M15.5 4.5 14 8" stroke="#0d0c09" stroke-width="1.2"/>',
    snake: '<path d="M6.5 20.5c6.5 0 2.5-7.5 9-7.5 3.8 0 3.8-3.2 2.8-7" stroke-width="3"/><circle cx="18.6" cy="5" r="1.7" fill="currentColor" stroke="none"/>',
    dog: '<path d="M7.5 4.5C5.5 2.8 3.5 4 4.5 7l1 2.6c-1.2 1.2-1.8 3-1.2 4.9 1 3.2 3.4 5 7.7 5s6.7-1.8 7.7-5c.6-1.9 0-3.7-1.2-4.9l1-2.6c1-3-1-4.2-3-2.5"/><circle cx="9.6" cy="12.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="12.8" r="1.1" fill="currentColor" stroke="none"/><path d="M10.8 15.8h2.4L12 17.3l-1.2-1.5z" fill="currentColor" stroke="none"/>',
    boar: '<path d="M5 5.5 8 7.5M19 5.5 16 7.5"/><path d="M12 4c4.2 0 7 3.2 7 7.5S16.2 19.5 12 19.5 5 16.3 5 11.5 7.8 4 12 4z"/><path d="M8.5 15.5 6.5 19M15.5 15.5l2 3.5"/><circle cx="9.8" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="14.2" cy="10.5" r="1" fill="currentColor" stroke="none"/>',
    bear: '<circle cx="6.8" cy="6.8" r="2.6"/><circle cx="17.2" cy="6.8" r="2.6"/><circle cx="12" cy="12.5" r="6.8"/><circle cx="9.7" cy="11.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.3" cy="11.3" r="1.1" fill="currentColor" stroke="none"/><ellipse cx="12" cy="14.8" rx="2" ry="1.4" fill="currentColor" stroke="none"/>',
    ninja: '<path d="M12 2.8c4.6 0 7.7 3.1 7.7 7.7v4.3L12 21.2 4.3 14.8v-4.3c0-4.6 3.1-7.7 7.7-7.7z"/><path d="M4.3 10.8h15.4"/><path d="M8.6 13.8c1.2.7 2.3 1 3.4 1s2.2-.3 3.4-1"/>',
    glove: '<path d="M8.5 11V7.5a3 3 0 0 1 6 0V9"/><path d="M8.5 11l-3.2 1a4.2 4.2 0 0 0 3.2 7.3c.6 1.4 2.1 2.2 3.9 2.2 3.4 0 6-2.6 6-6v-1.7a3 3 0 0 0-3-3H8.5z"/>',
    bandit: '<circle cx="12" cy="12" r="8"/><path d="M4.8 10.2c2.4-1 4.8-1.4 7.2-1.4s4.8.4 7.2 1.4c-.4 1.9-1.4 3-2.9 3.4-1.4-1-2.9-1.4-4.3-1.4s-2.9.4-4.3 1.4c-1.5-.4-2.5-1.5-2.9-3.4z" fill="currentColor" stroke="none"/><path d="M9.5 16.5c1.5 1 3.5 1 5 0"/>',
    ghost: '<path d="M12 3a7 7 0 0 0-7 7v11l2.3-1.8L9.7 21l2.3-1.8L14.3 21l2.4-1.8L19 21V10a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.5" cy="10" r="1.2" fill="currentColor" stroke="none"/>',

    /* ---------- tile medan ---------- */
    pine: '<path d="M12 2.5 7 10h2.8L5.5 16.5h13L14.2 10H17L12 2.5z"/><path d="M12 16.5v5"/>',
    rock: '<path d="M3.5 17 8 8.5 13 6l6.5 4.5 1 6.5h-17z"/><path d="M8 8.5 10.5 14M13 6l1.5 6"/>',
    bush: '<path d="M4.5 20.5c0-4.5 1.2-8.5 3.2-11.5.2 4 1.2 7 3 9 1-4 2.2-7.5 4.3-10.5.3 5 1.3 9.3 3.5 13"/>',
    stump: '<path d="M7 10.5h10V20H7z"/><ellipse cx="12" cy="10.5" rx="5" ry="2.2"/><path d="M9.3 10.5c1 1.4 4.4 1.4 5.4 0"/>',
    wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3.5V7M12 17v3.5M3.5 12H7M17 12h3.5M6 6l2.4 2.4M15.6 15.6 18 18M18 6l-2.4 2.4M8.4 15.6 6 18"/>',
    hourglass: '<path d="M6.5 2.5h11M6.5 21.5h11"/><path d="M8 2.5c0 5.2 3.4 6.6 3.4 9.5S8 16.3 8 21.5M16 2.5c0 5.2-3.4 6.6-3.4 9.5s3.4 4.3 3.4 9.5"/>',
    crosshair: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    bullet: '<path d="M12 2.5c2.6 2.6 3.6 5.2 3.6 8.2v8.8h-7.2v-8.8c0-3 1-5.6 3.6-8.2z"/><path d="M8.4 13.5h7.2"/>',
    fang: '<path d="M7.5 3.5c-.5 6 .8 11.5 3.5 17M16.5 3.5c.5 6-.8 11.5-3.5 17"/>',
  };

  /* =========================================================
     Pemetaan emoticon lama -> nama ikon.
     Dipakai supaya data lama (locations.json, dsb) yang masih
     menyimpan emoticon tetap tampil sebagai SVG tanpa migrasi data.
     ========================================================= */
  var EMOJI_MAP = {
    '🧑': 'survivor', '👤': 'person', '🧍': 'person',
    '🐺': 'wolf', '🐯': 'tiger', '🐍': 'snake', '🐕': 'dog', '🐗': 'boar',
    '🐻': 'bear', '🥷': 'ninja', '🥊': 'glove', '🔫': 'bandit', '🏹': 'bow',
    '🔪': 'knife', '👊': 'fist', '🎯': 'target',
    '🌲': 'pine', '🪨': 'rock', '🌿': 'bush', '🪵': 'stump', '🚪': 'door',
    '❤': 'heart', '❤️': 'heart', '🛡': 'shield', '🛡️': 'shield',
    '⚡': 'bolt', '🍖': 'meat', '💧': 'droplet', '🧠': 'eye',
    '🏠': 'home', '🗺': 'map', '🗺️': 'map', '🎒': 'backpack', '🏅': 'medal',
    '☰': 'menu', '🎫': 'ticket', '🛒': 'store', '💳': 'card', '🎡': 'wheel',
    '💎': 'gem', '🏴': 'flag', '🔒': 'lock', '🔓': 'unlock', '✅': 'check',
    '⚔': 'swords', '⚔️': 'swords', '💥': 'burst', '🌀': 'refresh',
    '🏃': 'run', '🔧': 'wrench', '🔨': 'hammer', '🧰': 'box', '📋': 'scroll',
    '🎁': 'gift', '🎉': 'sparkles', '🪙': 'coin', '💵': 'coin', '⭐': 'star',
    '📌': 'flag', '🚩': 'flag', '✨': 'sparkles', '🔥': 'flame', '💀': 'skull',
    '💠': 'gem', '🪓': 'axe', '👻': 'ghost', '☣': 'alert', '⚠': 'alert',
    '⚠️': 'alert', '➕': 'plus', '✕': 'x', '🔄': 'refresh', '⏳': 'clock',
    '🚚': 'compass',
  };

  function ensureSprite() {
    if (document.getElementById(SPRITE_ID)) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', SPRITE_ID);
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    Object.keys(DEFS).forEach(function (name) {
      var sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
      sym.setAttribute('id', 'xi-' + name);
      sym.setAttribute('viewBox', '0 0 24 24');
      sym.setAttribute('fill', 'none');
      sym.setAttribute('stroke', 'currentColor');
      sym.setAttribute('stroke-width', '1.8');
      sym.setAttribute('stroke-linecap', 'round');
      sym.setAttribute('stroke-linejoin', 'round');
      sym.innerHTML = DEFS[name];
      defs.appendChild(sym);
    });
    svg.appendChild(defs);
    // Sisipkan di awal body supaya <use> di mana pun bisa resolve
    if (document.body) document.body.insertBefore(svg, document.body.firstChild);
    else document.documentElement.appendChild(svg);
  }

  function iconName(emoji) {
    return EMOJI_MAP[emoji] || 'question';
  }

  // <svg class="xicon ..."><use href="#xi-..."/></svg>
  function svg(name, cls) {
    ensureSprite();
    return '<svg class="xicon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#xi-' + name + '"></use></svg>';
  }

  // Langsung dari emoticon lama (data JSON dsb)
  function fromEmoji(emoji, cls) {
    return svg(iconName(emoji), cls);
  }

  // Suntik sprite sedini mungkin (script dimuat di <head> / awal body)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSprite);
  } else {
    ensureSprite();
  }

  return { svg: svg, fromEmoji: fromEmoji, iconName: iconName, ensureSprite: ensureSprite, DEFS: DEFS };
})();

window.Icons = Icons;
