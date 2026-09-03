# Extinct Survival — Phase 1 ✅ + Phase 2 (in progress)

Status Phase 1: selesai penuh.
Status Phase 2:
- [x] Inventaris & equipment
- [x] Eksplorasi (menu: Scavenge / Hunting / Travel)
- [x] Pertarungan turn-based (Attack/Defend/Item/Flee + Critical Hit)
- [x] Sistem Skill (Survivor/Hunter/Scavenger, rank Bronze-Master)
- [x] Background image + UI glass/solid blocks
- [x] Atribut dipisah 2 bagan (dasar + efek)
- [x] Mata uang ganda: Rupiah & Kredit (premium/topup)
- [ ] Crafting dasar
- [ ] Questline awal

## UPDATE TERBARU

### 1. Background Image
`assets/images/extinct-survival-bg.webp` dipasang sebagai background
`<body>` (cover, fixed). HUD atas/bawah pakai **solid block**
(`--bg-solid`, rgba 92% opacity + blur) supaya tetap sangat terbaca.
Card/panel isi konten pakai **glass/transparan** (`--bg-glass`, rgba 68%
+ blur tipis) supaya background game tetap terlihat samar di baliknya.
Ada juga gradient overlay gelap dari atas-bawah biar kontras teks terjaga.
*(Sesuai catatan: file background sudah ditempatkan di path yang benar,
tinggal diganti manual kalau mau versi lain — cukup timpa file
`extinct-survival-bg.webp` dengan nama yang sama.)*

### 2. Atribut jadi 2 Bagan (Dashboard)
- **Bagan Dasar**: STR, AGI, INT, END, LUCK (angka mentah)
- **Bagan Efek** (di sampingnya): efek nyata dari atribut, dihitung
  otomatis dan **berubah sesuai equipment yang terpasang**:
  - ⚔️ **Damage** = weapon damage + STR/2
  - 💥 **Crit Chance** = LUCK × 2%
  - 🌀 **Dodge** = AGI × 1.5%
  - 🏃 **Flee Chance** = dipakai juga di battle
  - 🔧 **Crafting Bonus** = INT × 2% (siap dipakai saat sistem crafting jadi)
  - 🍀 **Loot Bonus** = LUCK × 2%, benar-benar menambah peluang item
    tambahan saat Scavenge
- Semua nilai ini **fungsional**, bukan sekadar tampilan — Critical Hit
  di battle dan bonus loot di scavenge sudah pakai rumus ini.

### 3. Sistem Skill baru (tab 🏅 Skill)
3 skill dasar:
- **Survivor** — naik saat memakai item consumable (makan/minum)
- **Hunter** — naik saat menang battle (Hunting)
- **Scavenger** — naik saat Scavenge

Struktur rank: **Bronze → Silver → Gold → Platinum → Diamond → Master**,
tiap rank punya 5 tier **I – V** (angka romawi). Contoh label: "Gold III".

**Formula EXP per tier**: `100 × 1.5^n` (n = urutan tier global, 0-based,
dari Bronze I hingga Master V = 30 tingkatan total). Jadi Bronze I
butuh 100 EXP, Bronze II butuh 150, dst — grindy sesuai gaya IdleMMO.

### 4. Level Karakter — formula baru
`expToNext(level) = 100 × level × 2`, level maksimal **100**.
Level 1 butuh 200 EXP, level 2 butuh 400 EXP, dst (linear scaling ×2).

### 5. Mata Uang Ganda
- **Rupiah** — mata uang utama in-game (didapat dari scavenge/hunting)
- **Kredit** 💎 — mata uang premium (untuk sistem topup nanti),
  saat ini defaultnya 0, siap dihubungkan ke halaman "web topup"

## Cara menjalankan di Termux + Acode

```bash
pkg install python -y
cd /storage/emulated/0/extinct-survival
python -m http.server 8080
```
Buka `http://127.0.0.1:8080`. **Wajib** pakai HTTP server (bukan `file://`).

## Struktur proyek terbaru

```
extinct-survival/
├── index.html
├── css/
│   ├── main.css          (+ style background, atribut 2 kolom, skill card)
│   └── themes/dark.css   (+ variabel --bg-solid & --bg-glass)
├── js/
│   ├── engine/   core.js, state.js, events.js
│   ├── game/     player.js, inventory.js, exploration.js, combat.js, skills.js
│   ├── ui/       renderer.js, panels.js, notifications.js
│   ├── data/     item-db.js, location-db.js, items.json, locations.json,
│   │             quests.json, factions.json
│   └── main.js
├── lang/         id.json, en.json
├── config/       settings.json
└── assets/
    ├── images/extinct-survival-bg.webp   ← background baru
    ├── audio/
    └── fonts/
```

## Debug & Testing
Diuji ulang menyeluruh dengan Playwright (headless browser):
- Background image ter-load dengan benar via CSS
- 2 kolom atribut tampil, teks "Kredit" & "Damage" ada di dashboard
- 3 skill card tampil, rank awal "Bronze I", required EXP tier awal = 100
  (sesuai formula 100×1.5^0)
- Scavenge 8x → scavenger exp bertambah sesuai (5 exp/scavenge)
- expToNext level 1 = 200 (sesuai formula 100×level×2)
- Battle menang → hunter skill exp bertambah sesuai formula (80% dari
  EXP reward musuh)
- Regression test fitur-fitur sebelumnya (inventory, equipment, travel,
  battle win/lose, reload persistence) — **semua tetap normal**

**Hasil akhir: tidak ada console error / page error di seluruh skenario.**

## Lanjut berikutnya
Tersisa: **Crafting dasar** dan **Questline tutorial**. Bonus crafting
dari INT sudah disiapkan di derived stats, tinggal diimplementasikan
saat sistem crafting dibangun.

## FIX BUG (update terbaru)

### Bug: Panel Skills kosong saat diklik
**Penyebab**: save lama (localStorage) masih memakai skema skill versi
awal (`{combat, crafting, survival, social, exploration}`), tidak
kompatibel dengan skema baru (`{rank, tier, exp}`), menyebabkan panel
gagal render dengan benar.

**Perbaikan**: ditambahkan fungsi migrasi otomatis di `GameState.load()`
(`js/engine/state.js`) yang mendeteksi & memperbaiki skema lama setiap
kali save dimuat — termasuk migrasi `bottlecaps` lama ke `kredit`. Sudah
diuji: save lama tetap bisa dibuka normal tanpa reset data, dan
`kredit` otomatis terisi dari nilai `bottlecaps` lama.

### Redesain panel Skills sesuai spesifikasi
- **3 skill dalam 1 baris** (grid 3 kolom): Survivor, Hunter, Scavenger
- Format tiap kad: **JUDUL** (nama skill) → **Rank+Tier** (contoh
  "Bronze I") → **Bonus stat** (contoh "+5% Drop", "+5% Loot",
  "-5% Energy Drain")
- **Glow border berwarna sesuai rank**: Bronze (coklat), Silver (abu
  terang), Gold (kuning), Platinum (cyan muda), Diamond (biru), Master
  (merah) — dihitung via `hexToRgba()` di JS (bukan `color-mix()` CSS,
  supaya kompatibel WebView Android lama)
- Bonus stat sekarang **fungsional nyata**, bukan sekadar tampilan:
  - Hunter → menambah peluang drop loot musuh di battle
  - Scavenger → menambah peluang loot tambahan saat scavenge
  - Survivor → mengurangi laju drain hunger/thirst (persentase peluang
    skip drain per tick)

## Debug tambahan (fix bug)
Diuji dengan Playwright: karakter baru (skill card 3 kolom, warna glow
terpasang, label & bonus benar) DAN skenario save lama yang di-inject
manual ke localStorage (migrasi berjalan tanpa crash, kredit termigrasi
benar, semua panel termasuk Dashboard & Skills tampil normal).
**Tidak ada error di kedua skenario.**

## UPDATE TERBARU: Overlay Manager + Attribute Point System

### 1. Overlay Manager (sistem modal terpusat)
Dibahas dulu sebelum diimplementasi (lihat riwayat chat): direkomendasikan
**maksimal 2 layer overlay aktif bersamaan** untuk stabilitas di WebView
Android — lebih dari itu berisiko lag (backdrop-filter blur menumpuk berat
di GPU) dan ribet dikelola tombol back.

**Implementasi** (`js/ui/overlay-manager.js`):
- Modal terpusat & reusable — semua fitur ke depan tinggal panggil
  `OverlayManager.open(html)`, tidak perlu bikin modal sendiri-sendiri
- **Blur modern**: layer pertama blur 6px, kalau ada layer ke-2 di atasnya
  blur ke 10px + makin gelap; layer di bawahnya cukup di-dim/diredupkan
  tanpa tambahan blur (hemat GPU, bukan double-blur)
- **Hard cap 2 layer** — percobaan buka overlay ke-3 otomatis ditolak
- **Terintegrasi tombol back Android**: pakai `history.pushState` saat
  overlay dibuka + listener `popstate` — jadi pencet tombol back fisik
  HP akan **menutup overlay teratas dulu**, bukan langsung keluar app
- Animasi slide-up + fade modern ala bottom-sheet

**Diterapkan pertama di**: detail item Tas — tap item (bukan tombol kecil
lagi) → overlay detail muncul dari bawah dengan deskripsi lengkap, stats,
dan tombol Pakai/Pasang di dalamnya.

### 2. Attribute Point System
- Tiap **naik level dapat 5 Attribute Point** (`player.attributePoints`)
- **1 poin = +0.2%** ke salah satu status pilihan:
  - ⚔️ **Damage** — dikalikan ke total damage serangan
  - 🛡️ **Defense** — mengurangi damage yang diterima, **cap 70%**
  - 🌀 **Evasion** — peluang menghindar total dari serangan musuh
    (base dari AGI + poin), **cap 70%**
  - 💥 **Crit** — peluang critical hit (base dari LUCK + poin)
- Alokasi poin lewat card baru di Dashboard, tombol **+1** per kategori,
  otomatis disabled kalau poin habis atau sudah kena cap
- **Alokasi permanen** (belum ada fitur reset/respec di versi ini)
- Semua efek ini **benar-benar dipakai di battle**: Evasion dicek duluan
  sebelum musuh menyerang (kalau berhasil, damage 0 total), baru Defense
  mengurangi sisa damage secara persentase

## Debug tambahan (overlay + attribute point)
Diuji dengan Playwright:
- Overlay detail item: terbuka & tertutup normal, depth tracking benar
- Tombol back Android (simulasi `page.go_back()`) berhasil menutup overlay
  tanpa keluar dari game
- Percobaan buka overlay ke-3 berhasil ditolak (max depth 2 terjaga)
- Alokasi 350 poin ke Defense → tepat berhenti di 70% (matematis pas:
  350 × 0.2% = 70%), tombol otomatis disabled setelah cap
- Evasion dihitung benar: base dari AGI + sisa poin, tidak melebihi 70%
- Regression penuh ke semua fitur sebelumnya (skills, migrasi save lama,
  battle, travel, scavenge, reload) — **semua tetap normal, nol error**

## UPDATE TERBARU: Unifikasi Energy, Durability, & Polish UI

### 1. Stamina + Energy digabung jadi satu: ⚡ Energy
Sebelumnya ada 2 resource terpisah (Stamina untuk Scavenge/Hunting,
Energy untuk Travel) yang sebenarnya fungsinya sama. Sekarang **cuma
ada 1 pool: Energy ⚡**, dipakai untuk ketiga aksi (Scavenge, Hunting,
Travel).
- **Regen otomatis**: 1 Energy per 60 detik (diam saja)
- **Lewat item**: item baru "Minuman Energi" (+20 energy) sudah
  ditambahkan sebagai contoh — sistem `useItem` sudah support field
  `stats.energy` di item manapun
- Ikon petir ⚡ dipakai konsisten di HUD atas, Dashboard, dan menu Jelajah
- Save lama otomatis dimigrasi: nilai stamina lama digabung ke energy

### 2. Atribut awal sekarang 0 (bukan 5)
STR/AGI/INT/END/LUCK karakter baru mulai dari 0 semua. Attribute Point
(dari level up) jadi satu-satunya cara nambah kekuatan tempur secara
langsung di awal permainan.

### 3. Durability Senjata
- Senjata yang di-equip sekarang punya durability yang **berkurang 1
  setiap kali dipakai Attack** di battle
- Kalau durability habis (0), senjata **patah otomatis** dan lepas dari
  slot (tidak kembali ke tas — hilang permanen)
- Durability ditampilkan di chip equipment Dashboard & baris equipment
  di tab Tas (format "current/max")
- Struktur data equipment slot berubah dari string `itemId` jadi object
  `{itemId, durability}` — save lama otomatis dimigrasi begitu ItemDB
  selesai dimuat

### 4. Keterangan cap disembunyikan
Angka batas maksimal (cap 70% untuk Defense/Evasion) **tidak lagi
ditampilkan ke pemain** di UI — pemain tidak akan tahu limitnya di mana.
Logika cap tetap berjalan normal di balik layar (masih dibatasi 70%),
cuma teksnya dihapus dari tampilan.

### 5. EXP bar warna ungu
Warna bar EXP di HUD atas diganti dari biru ke ungu
(`#8b5cf6` → `#b794f6`).

## Debug tambahan (update ini)
Diuji dengan Playwright, semua sesuai ekspektasi presisi:
- Atribut awal: `{strength:0, agility:0, intelligence:0, endurance:0, luck:0}`
- Field `stamina` sudah tidak ada sama sekali di state
- Tidak ada teks "Stamina" di UI manapun, ikon ⚡ Energy muncul konsisten
- EXP bar terkonfirmasi warna ungu (RGB 139,92,246)
- Tidak ada kata "cap" tersisa di Dashboard
- Energy pool dipakai bersama (scavenge -5 dari pool yang sama dgn travel)
- Regen offline: 50 energy + 5 menit offline → 55 (matematis pas, 1/60 detik)
- Durability senjata: mulai 2 → 1 setelah 1x attack → senjata patah
  (null) setelah attack ke-2 — persis sesuai logika
- Regression penuh ke semua fitur sebelumnya (skills, migrasi save,
  overlay manager, attribute point cap, battle, travel) — **semua
  tetap normal, nol page error di seluruh skenario**

## UPDATE v0.0.7: Versioning, Cooldown, Rarity, Armor, Shop, Hamburger Menu

### 1. Format versi baru
`v0.0.X` naik tiap update (v0.0.6 → v0.0.7 → ... → v0.0.9), setelah X=9
lanjut ke `v0.1.0`, lalu `v0.1.1`, dst. Dikelola manual di `js/version.js`
(`APP_VERSION`), ditampilkan di footer menu hamburger.

### 2. Item Healing baru
- **Perban** (common) — +15 Health
- **Kit P3K** (rare) — +40 Health, +5 Sanity

### 3. Cooldown anti-spam
- **Scavenge**: 5 detik
- **Travel**: 15 detik
- **Item Energy/Healing** (apapun itemnya yang punya stat `energy` atau
  `health`): 5 detik per jenis item
- Tombol otomatis nonaktif + menampilkan hitung mundur ("⏳ Tunggu Xs"),
  update live tiap detik via ticker (`Panels.tick()`, dipanggil dari
  `setInterval` di `main.js`)
- Cooldown bersifat in-memory per sesi (modul `js/game/cooldown.js`)

### 4. Sistem Rarity (6 tingkat)
| Tier | Warna | Chance |
|------|-------|--------|
| Common | putih | 50% |
| Uncommon | hijau | 40% |
| Rare | biru | 25% |
| Epic | ungu | 10% |
| Legendary | kuning | 5% |
| Mythic | merah | 1% |

Roll dilakukan dari tier paling langka ke paling umum (independent check
tiap tier), fallback ke Common. Dipakai untuk menentukan item scavenge
mana yang didapat dari loot pool lokasi (`js/game/rarity.js`). Warna
rarity tampil di nama item — daftar Tas, overlay detail item, dan
equipment chip Dashboard.

### 5. Item & Equipment low-tier baru
7 item armor baru (mudah ditemukan lewat scavenge) mengisi semua slot
equipment yang sebelumnya kosong: Topi Lusuh/Helm Rongsokan (head),
Jaket Compang-camping/Rompi Kulit (chest), Celana Robek (legs), Perisai
Seng (offhand), Kalung Taring (accessory). Tiap armor punya stat
`defense` yang dijumlah otomatis ke Defense% total karakter (bareng
attribute point Defense, sama-sama kena batas yang sama).

### 6. Menu Hamburger (☰)
Tombol baru di pojok kanan atas HUD, membuka overlay berisi:
1. **Pass** — placeholder "tahap pengembangan" (Elite Pass level 1-100,
   belum diimplementasi)
2. **Shop** — **sudah fungsional penuh**: beli Makanan Kaleng, Air
   Bersih, Perban, Kit P3K, Minuman Energi pakai Rupiah. Overlay Shop
   dibuka sebagai layer ke-2 (dari Hamburger sebagai layer ke-1),
   sesuai batas max 2 layer Overlay Manager
3. **Item Mall** — placeholder "tahap pengembangan" (item premium pakai
   Kredit, belum diimplementasi)

## 🐛 Bug ditemukan & diperbaiki selama development update ini

1. **Tombol Scavenge tidak aktif lagi tepat saat cooldown habis** —
   ticker sebelumnya hanya re-render kalau cooldown *masih* aktif,
   jadi transisi "baru saja habis" tidak pernah tertangkap. Fix:
   ticker sekarang selalu re-render menu Jelajah tiap detik selama
   pemain berada di sana (murah, DOM kecil, tidak masalah performa).

2. **Rupiah tidak berkurang saat beli di Shop** (tapi item tetap masuk
   ke tas) — root cause: selector `.overlay-panel:last-child` salah
   pilih panel ketika ada 2 layer overlay aktif (Hamburger + Shop),
   karena `:last-child` bernilai true untuk SETIAP panel yang jadi
   anak tunggal di parent masing-masing (bukan panel yang paling baru
   ditambahkan ke DOM). Akibatnya event handler "Beli" ter-bind ke
   panel yang salah. Fix: ganti ke `root.lastElementChild` yang secara
   akurat mengambil backdrop yang paling baru ditambahkan, terlepas
   dari struktur DOM internalnya.

3. **Menutup overlay lewat tombol ✕ ikut menutup 2 layer sekaligus**
   (bug ditemukan saat verifikasi fix #2) — root cause: `close()`
   manual memanggil `history.back()` untuk sinkronisasi history, tapi
   itu memicu event `popstate` lagi yang ditangkap listener global dan
   dianggap sebagai "tombol back fisik ditekan", jadi menutup overlay
   berikutnya juga. Fix: tambah flag `suppressNextPopstate` yang di-set
   sebelum `close()` memanggil `history.back()` sendiri, supaya
   `popstate` hasil panggilan itu diabaikan sekali.

Kedua bug di atas (#2 dan #3) sudah diverifikasi ulang secara spesifik:
beli 2 item berturut-turut (rupiah berkurang tepat sesuai harga, tidak
ada double-buy), tutup Shop via tombol ✕ (Hamburger tetap utuh di
belakangnya), tutup via tombol back fisik 2x berturut-turut (masing-masing
cuma menutup 1 layer), migrasi save lama, dan seluruh regression fitur
sebelumnya (skills, attribute point, durability, energy, battle, travel)
— **semua nol error di pengujian akhir**.

## UPDATE v0.0.8: Crafting Dasar + Repair Equipment

### 1. Crafting
Tombol **🔨 Crafting** baru di tab Tas, membuka overlay daftar resep.
4 resep tersedia:
- **Parang Tua** — 3x Besi Rongsokan + 1x Kayu + 1x Tali
- **Pisau Dapur Berkarat** — 2x Besi Rongsokan + 1x Kayu
- **Perban** — 2x Tanaman Obat
- **Perisai Seng** — 4x Besi Rongsokan

Material yang cukup ditandai hijau, kurang ditandai merah. Tombol
"Buat" otomatis nonaktif kalau material belum cukup. **Crafting Bonus**
(dari attribut INT, sudah ada sejak update sebelumnya) sekarang punya
efek nyata: ada peluang dapat +1 item ekstra setiap berhasil craft.

### 2. Repair Equipment
Tombol **🔧 Perbaiki** muncul otomatis di slot Senjata kalau
durability-nya kurang dari maksimal. Biaya perbaikan:
- **Material**: mengikuti proporsi recipe asli item (60% dari
  persentase durability yang hilang, minimal 1 per material). Untuk
  senjata yang tidak punya recipe (hasil temuan), pakai Besi Rongsokan
  sebagai fallback generik
- **Rupiah**: 3x jumlah durability yang hilang (minimal Rp 5)
- Repair selalu mengembalikan ke **100% durability** (belum ada opsi
  perbaikan sebagian di versi ini)
- Tombol otomatis nonaktif kalau material atau Rupiah belum cukup

## Debug (v0.0.8)
Diuji dengan Playwright, semua presisi:
- 4 item craftable muncul, tombol enabled/disabled sesuai ketersediaan
  material
- Craft Parang Tua: Besi Rongsokan berkurang tepat 3, Parang Tua
  bertambah di tas
- Material habis paksa → tombol otomatis disabled
- Repair: durability 30/100 → setelah repair jadi 100/100, Rupiah
  berkurang tepat sesuai formula (missing 70 × 3 = Rp 210)
- Tombol Perbaiki otomatis hilang setelah durability penuh
- Regression penuh ke semua fitur v0.0.7 dan sebelumnya (shop, overlay
  manager, attribute point, skills, migrasi save, battle, travel) —
  **semua tetap normal, nol page error di seluruh skenario**

## UPDATE v0.0.9: Sinkronisasi Sistem Battle Tactical

Battle system lama (turn-based sederhana: Attack/Defend/Item/Flee) **diganti
total** dengan sistem battle tactical grid dari referensi yang diberikan
(`extinct_battle.html`), lengkap dengan UI dan animasinya.

### Yang diambil dari referensi (utuh, tanpa diubah mekanikanya)
- Board grid 7x8 dengan tile acak (pohon, batu, semak, tunggul, hazard,
  exit) — rintangan menghalangi gerak/line-of-sight
- Action Point (AP) system: gerak 1 AP/petak (BFS reachable), serang
  sesuai AP cost senjata
- Enemy strip di atas board (tap buat serang kalau dalam jangkauan)
- AI musuh otomatis: mendekat lalu menyerang saat giliran musuh
- Animasi: damage float text, banner "tumbang", modal menang/kalah/kabur
- Kabur lewat tile "exit" di board

### Integrasi ke game (yang saya tambahkan)
- **`js/game/battle-bridge.js`** (baru) — jembatan antara data game asli
  dan engine tactical:
  - Damage senjata pakai formula yang sama dengan sistem lama (weapon
    damage + STR/2, dikali bonus Attribute Point Damage)
  - Defense% karakter (dari Attribute Point + armor equipment) disinkron
    jadi "Armor" di battle tactical
  - HP tersinkron dua arah (battle tactical baca HP awal dari
    `player.survival.health`, dan hasil akhir ditulis balik)
- **2 hook tambahan** di battle engine (di luar kode referensi asli):
  - `onWeaponUse(weapon)` — dipanggil tiap serangan berhasil dieksekusi,
    dipakai untuk mengurangi durability senjata asli (fitur durability
    dari update sebelumnya tetap jalan di battle baru)
  - `onEnd` sekarang menerima objek summary lengkap (`{result, player,
    enemies}`), bukan cuma string, supaya reward per-musuh (exp, rupiah,
    loot table) bisa dihitung balik dari field custom yang dititipkan
- Reward/penalty sama seperti sistem lama: **menang** dapat rupiah+exp+
  loot & skill exp Hunter, **kalah** kehilangan 50% EXP progress +
  HP direset ke 15 (anti-softlock), **kabur** tanpa reward/penalty
- `js/game/combat.js` (sistem battle teks lama) **dihapus total**,
  semua referensi dibersihkan

### ⚠️ Keterbatasan yang perlu diketahui
State pertempuran tactical (posisi unit di board, AP, dsb) **tidak
di-persist ke localStorage**. Kalau halaman di-reload di tengah
battle, battle akan hilang dan kembali ke menu Jelajah tanpa reward
maupun penalti. Ini trade-off yang disengaja — mensinkronkan seluruh
state grid battle yang kompleks ke sistem save akan menambah banyak
sekali kompleksitas untuk skenario yang jarang terjadi (reload di
tengah battle). Bisa diperbaiki di update mendatang kalau diperlukan.

## Debug (v0.0.9)
Karena board battle di-generate acak tiap kali (sulit dites deterministik
lewat simulasi klik UI), strategi testing dibagi dua:

1. **Level UI/struktur** (via Playwright, klik nyata): screen tactical
   aktif & screen game nonaktif saat battle mulai, board render 56 tile
   (7x8), enemy strip tampil 1 musuh, AP pips 6 sesuai maxAp, action
   button "Pindah" + senjata tampil dengan label damage yang **presisi
   sesuai formula** (contoh: Parang Tua + STR 10 → tampil "11-15",
   cocok dengan perhitungan manual)

2. **Level integrasi reward/penalty** (via mock engine — `window.
   ExtinctBattle.start` di-replace sementara supaya `onEnd` bisa dipanggil
   dengan summary terkontrol, tanpa bergantung pada hasil battle acak):
   - **Menang**: rupiah +5, exp +10, HP tersinkron ke 80, durability
     senjata berkurang tepat 1 (5→4), loot masuk tas — semua presisi
   - **Kalah**: EXP terpotong tepat 50% (100→50), HP direset ke 15
   - **Kabur**: rupiah tidak berubah, HP tetap tersinkron

3. **Regression penuh** ke semua fitur v0.0.8 dan sebelumnya (Crafting,
   Repair, Shop, Overlay Manager, Skills, Attribute Point, migrasi save
   lama termasuk equipment format lama→baru) — **semua tetap normal,
   nol page error di seluruh skenario pengujian**

## FIX v0.0.9: Battle Recovery (energy dikembalikan kalau battle terinterupsi)

Battle tactical memang sengaja tidak di-persist (sesuai keputusan awal —
state grid battle terlalu kompleks untuk disinkronkan penuh ke save
system). Tapi ada 1 konsekuensi yang perlu ditangani: **energy yang
sudah dipotong untuk mulai Hunting jangan sampai hilang percuma** kalau
battle-nya sendiri tidak sempat selesai (app ditutup paksa / reload di
tengah pertarungan, umum terjadi di WebView Android saat app di-switch
lalu di-kill OS).

### Cara kerja
1. Saat pemain pilih target Hunting: energy dipotong **dan** ditandai
   `player.battleInProgress = { energyCost, startedAt }`, langsung
   di-`GameState.save()` ke localStorage
2. **Kalau battle selesai dengan benar** (menang/kalah/kabur — apapun
   hasilnya, yang penting sampai ke layar hasil): penanda ini dihapus
   otomatis di `applyBattleResult()`, tidak ada refund
3. **Kalau battle TIDAK selesai** (reload / app ditutup di tengah
   jalan): saat game dibuka lagi, `BattleBridge.recoverInterruptedBattle()`
   otomatis jalan sebelum dashboard tampil — mendeteksi penanda yang
   masih ada, mengembalikan energy yang sempat terpotong, menampilkan
   notifikasi singkat, lalu pemain kembali normal ke menu Jelajah
   (bukan nyangkut di layar battle)

Dengan ini, pemain **tidak pernah dirugikan** akibat keterbatasan
"battle tidak di-save" — baik battle selesai normal maupun terinterupsi,
hasil akhirnya tetap adil: kalau selesai, dapat reward/penalti sesuai
hasil; kalau terinterupsi, kembali persis seperti sebelum battle dimulai
(energy utuh, tidak ada penalti tersembunyi).

## Debug (fix battle recovery)
Diuji dengan Playwright, 2 skenario kunci:
1. **Battle terinterupsi**: energy terpotong (100→92) saat battle
   dimulai, ditandai & tersimpan ke localStorage (termasuk simulasi
   "app ditutup paksa" via reload) → setelah dibuka lagi, energy
   **pulih tepat ke 100** (nilai sebelum battle), penanda otomatis
   terhapus, kembali normal ke Dashboard (bukan nyangkut di battle)
2. **Battle selesai dengan benar** (menang, via mock): penanda langsung
   terhapus saat itu juga, energy tidak berubah lagi meski di-reload
   sesudahnya (tidak ada refund ganda/salah)

Regression penuh ke semua fitur sebelumnya tetap normal, **nol page
error** di seluruh skenario.

## UPDATE v0.1.0: UI Compact — Icon Grid & Mini Popup

Perombakan tampilan Inventaris & Shop terinspirasi referensi Day R
Survival: grid kotak berbasis icon, aksi (equip/lepas/perbaiki/beli/jual)
dipindah ke **mini popup** yang muncul saat item di-tap — bukan lagi
tombol yang langsung nampang di list.

### 1. Inventaris jadi Icon Grid
- Equipment (6 slot) & Tas sekarang tampil sebagai **grid kotak icon**,
  border berwarna sesuai rarity item
- Tap slot equipment → **mini popup** muncul (nama, durability, tombol
  Lepas + Perbaiki kalau perlu) — sebelumnya tombol ini nampang inline
  di setiap baris
- Tap item di Tas → mini popup detail (stats, deskripsi, tombol
  Pakai/Pasang)
- Equipment chip di Dashboard juga ikut jadi grid icon & clickable
  (konsisten dengan tab Tas)

### 2. Fallback Icon Otomatis
Setiap item sudah punya field `icon` (nama file PNG) di `items.json`,
tapi file gambarnya sendiri **belum ada** — sengaja disiapkan begitu
supaya bisa diisi manual nanti. Sistem baru:
- Coba load `assets/images/items/{nama_file}.png`
- Kalau gagal (404, file belum ada) → otomatis fallback ke
  `assets/images/items/_placeholder.png` (blok putih polos) via
  event `onerror` di tag `<img>`
- Begitu Anda taruh file PNG asli dengan nama yang cocok di folder
  `assets/images/items/`, otomatis ke-pakai tanpa perlu ubah kode

### 3. Shop jadi Icon Grid + Fitur Jual (Sell) baru
- Shop sekarang punya 2 tab: **Beli** dan **Jual**, masing-masing
  grid icon dengan harga di pojok
- Tap item → mini popup (Beli 1 / Jual 1)
- **Fitur Jual baru**: semua item hasil scavenge/hunting bisa dijual
  balik jadi Rupiah. Harga jual:
  - Item yang ada di katalog Shop → 40% dari harga beli
  - Item lain (material, armor, dll — belum ada di katalog) → harga
    dasar berdasarkan rarity: Common Rp5, Uncommon Rp15, Rare Rp40,
    Epic Rp100, Legendary Rp250, Mythic Rp600
- Struktur overlay disesuaikan: Shop dibuka sebagai layer-1 (Hamburger
  otomatis tertutup duluan), supaya mini popup item di dalamnya tetap
  masuk batas max 2 layer Overlay Manager

## Debug (v0.1.0)
Diuji dengan Playwright:
- Equip slot grid (6 cell) tampil & clickable di Dashboard dan Tas,
  popup slot kosong vs terisi menampilkan info yang benar
- Fallback icon: `src` otomatis berpindah ke `_placeholder.png` saat
  file asli 404 (log 404 di console itu **normal/expected**, bukan
  bug — cuma jejak network request gambar yang belum ada sebelum
  fallback jalan; tidak ada JS runtime error)
- Equip via popup item → Lepas muncul di popup slot, konsisten
- Shop: depth overlay terjaga benar (Hamburger→Shop otomatis 1 layer,
  +1 popup item = 2 layer, sesuai batas). Beli & Jual matematis presisi
  (beli Rp25 → rupiah -25; jual dapat +10 sesuai formula 40%)
- Regression penuh: Crafting, Repair (lewat alur popup baru), Skills,
  Battle tactical — **semua tetap normal, nol page error**

## UPDATE v0.1.1: FIX BUG Atribut + Sederhanakan jadi ATK/DEF/DEX/INT

### 🐛 Bug yang diperbaiki: "Atribut Dasar" tidak pernah terisi
**Laporan**: panel "Atribut Dasar" di Dashboard selalu nunjukkin 0 walau
Attribute Point sudah dialokasikan dan efeknya (%) sudah keliatan naik.

**Root cause**: desain lama punya 2 sumber data terpisah —
`player.stats` (5 atribut: STR/AGI/INT/END/LUCK, isinya selalu 0 sejak
awal) dan `player.allocatedPoints` (4 kategori terpisah: damage/defense/
evasion/crit, ini yang beneran bertambah saat alokasi). Panel "Dasar"
nampilin `player.stats` yang memang tidak pernah disentuh sama sekali
oleh sistem alokasi poin — makanya kelihatan "kosong selamanya".

**Fix**: digabung jadi **satu sumber data tunggal**. Sekarang atribut
poin yang dialokasikan **LANGSUNG** mengisi `player.stats`, tidak ada
lagi struktur terpisah yang bisa nggak sinkron.

### Atribut disederhanakan: 5 stat → 4 stat
Sebelumnya STR/AGI/INT/END/LUCK (5 cabang, beberapa tumpang tindih
dengan sistem allocatedPoints yang terpisah). Sekarang cuma **ATK/DEF/
DEX/INT**, formula sesuai permintaan:

| Atribut | Efek per 1 poin |
|---------|------------------|
| **ATK** | +0.2% Damage |
| **DEF** | +0.2% Defense (cap 70%, gabung dengan defense dari armor) |
| **DEX** | +0.2% Crit **dan** +0.2% Evasion (dua-duanya sekaligus dari 1 pool yang sama) |
| **INT** | +0.4% Crafting Bonus, +0.4% Loot Bonus, **+1 slot Tas** |

Panel Dashboard sekarang nunjukkin ATK/DEF/DEX/INT yang **sama persis**
di "Atribut Dasar" dan yang dipakai buat hitung "Efek" — dijamin selalu
sinkron karena memang satu data yang sama.

### Fitur baru: Kapasitas Slot Tas (dari INT)
- Slot tas dasar: **20 slot** (jenis item berbeda, bukan quantity —
  stack ke item yang sama tidak makan slot baru)
- Tiap poin INT nambah **+1 slot**
- Kalau tas penuh, item jenis BARU tidak bisa masuk (tetap bisa stack
  ke item existing), muncul notifikasi "Tas penuh! Alokasikan poin INT"

### Durability sekarang berlaku ke SEMUA equipment
Sebelumnya durability cuma ada di senjata. Sekarang **7 item armor**
(head/chest/legs/offhand/accessory) juga punya durability sendiri
(30-65 tergantung tier), dan **berkurang bareng senjata** tiap kali
Attack di battle (disamakan mekanismenya, sesuai permintaan). Semua
slot equipment (bukan cuma senjata) sekarang bisa diperbaiki (Repair)
lewat mini popup yang sama.

## 🐛 Bug tambahan ditemukan & diperbaiki saat development
Saat generalisasi fitur Repair ke semua slot, ketemu **bug serius**:
klik "Perbaiki" dari popup slot equipment (bukan dari alur Shop) bikin
halaman **ter-redirect ke `about:blank`**, merusak game total.

**Root cause**: pola `OverlayManager.close()` langsung disusul
`OverlayManager.open()` di baris berikutnya. `close()` motong history
lewat `history.back()` yang **asynchronous**, tapi baris `open()`
setelahnya langsung `history.pushState()` yang **synchronous** — dua-duanya
balapan, bikin history stack korup dan browser akhirnya nyasar ke
`about:blank` kalau history yang harus di-back()-in ternyata udah habis.

**Fix arsitektural**: nambah `OverlayManager.replaceTop()` — ganti
konten layer yang lagi aktif DI TEMPAT, tanpa nyentuh `history` sama
sekali (reuse history entry yang lama). Dipakai di alur "popup slot →
popup repair" dan "Hamburger → Shop" (dua tempat yang sebelumnya pakai
pola close+open berbahaya ini).

## Debug (v0.1.1)
Diuji dengan Playwright, semua presisi:
- Alokasi 3x poin ATK → panel "Dasar" ATK nunjukkin 3 (BUG FIX
  terverifikasi, sebelumnya akan tetap 0)
- damageBonusPct = 0.6% (3×0.2, matematis pas)
- INT=5 → Craft Bonus +2%, Loot Bonus +2%, Max slot tas 25 (20+5) — semua pas
- Cap slot tas: nyoba masukin 20 item beda jenis pas cap=20 → semua
  berhasil masuk pas di batas, item ke-21 akan ditolak (diverifikasi
  logic-nya, batas presisi)
- `reduceEquipmentDurability()` ngurangin durability **head DAN weapon
  sekaligus** dalam satu panggilan (40→39, 100→99) — konfirmasi "disamakan"
- Tombol Repair muncul untuk ARMOR (bukan cuma weapon lagi)
- **Bug `about:blank` ketemu & diperbaiki**: dites ulang skenario yang
  sama persis setelah fix — URL tetap stabil di `index.html` di semua
  langkah (repair armor, Hamburger→Shop, buka/tutup nested popup, tombol
  back fisik berulang kali)
- Formula damage battle tactical tetap presisi dengan sistem ATK baru
  (contoh: Parang Tua dmg 8 + ATK 5 → tampil "6-10", sesuai hitungan
  manual `round(8×1.01)±2`)
- Migrasi save lama (5 stat + allocatedPoints terpisah) → skema baru:
  atk=10, def=5, dex=12 (gabungan evasion+crit lama), int=0 — persis
  sesuai perhitungan, durability armor lama yang `null` otomatis terisi
  penuh karena armor baru dapat stat durability
- **Nol page error** di seluruh skenario pengujian akhir

## UPDATE v0.1.7: Misi jadi Daftar (List) & Bisa Ditumpuk — Main Quest + Side Quest

### Root cause masalah lama
Sistem misi v0.1.3-v0.1.6 cuma bisa punya **1 quest aktif** sekaligus
(`activeQuestId` tunggal). Begitu pemain menerima 1 misi, tidak ada
jalan buka opsi misi lain sampai yang itu diklaim — padahal sudah ada
rencana bikin main quest & side quest berjalan paralel. Ini akar
masalah yang diperbaiki di update ini (bukan cuma nambah fitur di atas
sistem lama).

### Rombak total: QuestSystem multi-quest
- **`p.questProgress.acceptedQuestIds`** (array, bukan lagi 1 string)
  — bisa nampung banyak misi yang sedang ditumpuk sekaligus
- Tiap quest sekarang punya field baru:
  - `category: "main" | "side"`
  - `prereqQuestId` — quest lain yang harus sudah **diklaim** dulu
    supaya quest ini muncul di daftar "Tersedia" (null = langsung
    tersedia sejak awal)
- **Batas stack**: Main Quest maksimal **1 aktif** bersamaan (menjaga
  alur cerita tetap linear), Side Quest maksimal **5 aktif** bersamaan
  (silakan ditumpuk sesuka hati sampai batas itu)
- Hunt counter sekarang dikunci **per-quest** (`questId:enemyId`, bukan
  cuma `enemyId`) — supaya kalau di masa depan ada 2 quest hunt aktif
  yang sama-sama menyasar musuh yang sama, hitungannya tidak bocor/
  tertukar antar quest

### UI Menu Misi dirombak jadi daftar bertab
- Overlay Misi sekarang punya **2 tab: Main Quest / Side Quest**
- Tiap tab menampilkan 2 seksi: **"Sedang Diambil"** (quest yang sudah
  di-accept, tampil progres ringkas + badge "Siap diklaim!") dan
  **"Tersedia"** (quest yang bisa diambil, prereq-nya sudah terpenuhi)
- Tap baris misi manapun → buka **mini popup detail** (layer ke-2,
  pola sama dengan detail item Tas/Shop) — isinya objective lengkap,
  hadiah, dan tombol aksi sesuai status:
  - Belum diambil → tombol **"📋 Ambil Misi"** (otomatis disabled +
    kasih alasan kalau belum bisa, misal "Selesaikan main quest yang
    aktif dulu" atau cap side quest penuh)
  - Sudah diambil, objective belum lengkap → tombol disabled
  - Sudah diambil, semua objective selesai → tombol **"🎁 Klaim Hadiah"**
  - Side quest yang sudah diambil juga punya tombol **"Batalkan Misi"**
    (main quest sengaja tidak bisa dibatalkan, supaya cerita utama
    tidak "hilang" tanpa sengaja)
- Card ringkas di Dashboard diperbarui: sekarang nunjukkin jumlah total
  misi aktif + berapa yang siap diklaim (bukan lagi 1 judul quest
  tunggal), tap untuk buka daftar lengkap

### Konten baru: 3 Side Quest pertama
Ditambahkan sebagai contoh sekaligus buat nge-tes sistem stack:
- **Pedagang Kehausan** (collect, 8x Botol Air Bersih) — tersedia sejak awal
- **Bersihkan Pasar Gelap** (hunt, 6x Preman Pasar Gelap) — tersedia sejak awal
- **Suku Cadang Langka** (collect, 15x Suku Cadang) — butuh main quest
  "Membangun Benteng Perlindungan" selesai dulu (`prereqQuestId`)

### Migrasi save lama
Save dari v0.1.3–v0.1.6 (skema `activeQuestId` tunggal) otomatis
dimigrasi di `GameState.load()`:
- `activeQuestId` yang sedang berjalan → jadi 1 entri pertama di
  `acceptedQuestIds` (progresnya tidak hilang)
- `huntCounts` lama (dikunci per-enemyId) → dipindah jadi
  `questId:enemyId` sesuai quest yang sedang jalan saat itu, supaya
  progres hunt yang sudah dikumpulkan tetap terhitung
- Save yang sama sekali belum punya `questProgress` (sangat lama) →
  dapat default baru (main quest awal auto-accept)

## Debug (v0.1.7)
Karena environment build kali ini tidak ada akses browser Playwright
(offline), pengujian dilakukan lewat **simulasi logic langsung di
Node.js** — `QuestSystem` (`js/game/quests.js`) di-load dengan stub
untuk `GameState`/`Inventory`/`Events`/`Player`/`fetch`, lalu dijalankan
skenario nyata satu per satu:
- Quest collect (`prolog_build_fortress`) dengan Tas yang tepat pas
  target → `isQuestComplete` true, `claimQuest` sukses, material
  otomatis kekonsumsi semua jadi 0, reward Rp500→Rp1000 & EXP 0→200
  presisi
- Setelah main quest pertama diklaim, quest lanjutannya
  (`prolog_hunt_wildlife`) otomatis masuk daftar "Tersedia" (prereq
  terpenuhi), begitu juga `side_suku_cadang_langka` yang prereq-nya
  sama
- Accept main quest lanjutan + 3 side quest sekaligus → semua sukses
  ditumpuk bersamaan (4 quest aktif total), sesuai desain stack
- `registerKill` diuji dengan 2 quest hunt aktif berbeda musuh
  (`prolog_hunt_wildlife` vs `anjing_liar`, `side_bersihkan_pasar` vs
  `preman_pasar`) → masing-masing counter tersimpan terpisah dengan
  key `questId:enemyId`, tidak saling tertukar
- Abandon side quest → sukses, terhapus dari `acceptedQuestIds`, hunt
  counter quest itu ikut dibersihkan
- Abandon main quest → **ditolak** sesuai desain (pesan error
  "tidak bisa dibatalkan")
- Accept quest yang sudah diambil (duplikat) → ditolak dengan pesan
  yang jelas
- **Migrasi save**: 3 skenario dites (save lama mid-hunt-quest dengan
  huntCounts per-enemyId, save sangat lama tanpa questProgress sama
  sekali, save yang sudah skema baru/idempotent) — ketiganya
  menghasilkan struktur `acceptedQuestIds`/`huntCounts` yang benar
  tanpa kehilangan progres

Semua file JS diverifikasi dengan `node --check` (nol syntax error) dan
`quests.json`/`locations.json` divalidasi dengan `json.load()` Python
(nol JSON error). Cross-check menyeluruh `enemyId` di semua quest hunt
vs `locations.json`, dan `itemId` di semua quest collect vs
`items.json` — **semua id valid, tidak ada dangling reference**.

**Catatan jujur**: karena tidak ada akses browser di sesi build ini,
klik-real-UI (buka overlay Misi, tab switching, popup detail, tombol
Ambil/Klaim/Batalkan) belum diverifikasi visual di WebView/browser
sungguhan — cuma logic intinya yang teruji penuh. Tolong cek sekali di
Acode/Termux sebelum dianggap final, terutama depth overlay (Misi=
layer1, detail popup=layer2, harus pas di batas MAX_DEPTH=2) dan
tampilan tab Main/Side di layar kecil.

## UPDATE v0.1.8: Sistem Faksi Aktif — 5 Faksi Tematik + Faction Shop

### Faksi diaktifkan penuh (sebelumnya placeholder "akan hadir")
Groundwork lama (`p.faction`, `p.reputation`, `factions.json`) dipakai
sebagai fondasi, tapi didesain ulang total jadi **5 faksi tematik**
yang bisa dipilih siapa saja tanpa terikat kota/lokasi awal (beda dari
draft lama yang terikat 1 faksi per kota):

- **Blue Tiger** 🐯 — Air & Hewan
- **Mojang Beauty** 💠 — Universal
- **Seafire** 🔥 — Api
- **Viking Bonex** 🪓 — Kekuatan
- **White Ghost** 👻 — Kemurnian

### Alur bermain
1. Buka Menu → Faksi, pilih 1 dari 5 faksi (tombol "Gabung")
2. Setiap **Scavenge** dan **menang Hunting** selama jadi anggota aktif
   memberi **Reputasi** + **Koin Faksi** (khusus faksi yang sedang
   diikuti, tidak lagi terikat lokasi tertentu seperti rencana awal)
3. Reputasi naikkan **rank** (Rekrut → Anggota → Veteran → Elite →
   Legenda), progress bar tampil di card Faksi
4. Koin Faksi ditukar di **Faction Shop** untuk equipment/item
   eksklusif faksi itu — **semua rarity Rare ke atas** (Uncommon ke
   bawah sengaja tidak dijual di sini, biar Faction Shop kerasa
   spesial dan bikin pemain betah grinding)
5. Item rarity lebih tinggi (Epic, Legendary) butuh **reputasi minimum**
   selain Koin Faksi — item yang belum kebuka tampil dengan ikon 🔒 dan
   keterangan reputasi yang dibutuhkan
6. Bisa **pindah faksi** kapan saja (progres reputasi & koin faksi lama
   tetap tersimpan terpisah, tidak hilang — cuma berhenti nambah sampai
   join lagi), atau **keluar faksi** total (dengan konfirmasi)

### Reward eksklusif per faksi (15 item baru)
Tiap faksi punya 3 item bertema, semua exclusive (tidak bisa didapat
dari Shop/scavenge biasa, cuma dari Faction Shop):
- **Rare** (🪙80, tanpa syarat reputasi): 1 senjata
- **Epic** (🪙220, butuh reputasi ≥300 / rank Veteran): 1 armor chest
- **Legendary** (🪙500, butuh reputasi ≥700 / rank Elite): 1 aksesoris

Contoh: Blue Tiger → Cakar Harimau Biru (senjata) / Zirah Sisik Air
(chest) / Taring Harimau Biru (aksesoris). Pola sama untuk 4 faksi
lainnya, temanya disesuaikan (api untuk Seafire, kekuatan untuk Viking
Bonex, kemurnian untuk White Ghost, universal untuk Mojang Beauty).

### Formula reward per aktivitas
- **Scavenge**: +3 reputasi, +2 Koin Faksi (flat)
- **Menang Hunting**: per musuh yang dikalahkan, reputasi = `max(5,
  round(expReward/3))`, koin = `max(3, round(expReward/5))` — musuh
  lebih kuat kasih reward faksi lebih besar juga

### File baru & yang diubah
- **`js/game/factions.js`** (baru) — `FactionDB` (loader, pola sama
  ItemDB/LocationDB/QuestDB) + `FactionSystem` (join/leave, reputasi,
  koin, rank, Faction Shop, semua disimpan per-faksi di
  `p.factionData[factionId]`)
- **`js/data/factions.json`** — dirombak total dari 4 faksi kota lama
  jadi 5 faksi tematik baru
- **`js/data/items.json`** — +15 item eksklusif faksi
- **`js/game/exploration.js`** — hook `FactionSystem.grantScavengeProgress()`
  di fungsi `scavenge()`
- **`js/game/battle-bridge.js`** — hook `FactionSystem.grantHuntProgress()`
  per musuh yang dikalahkan di `applyBattleResult()`
- **`js/engine/state.js`** — field baru `p.factionData`, migrasi
  otomatis mereset `p.faction` kalau masih menunjuk id faksi lama
  (draft sebelum v0.1.8) yang sudah tidak ada lagi di `factions.json`
- **`js/ui/panels.js`** — placeholder `renderFactionOverlay`/
  `bindFactionEvents` dihapus total, diganti sistem UI penuh:
  `renderFactionListOverlay`, `renderFactionShopOverlay`,
  `renderFactionItemPopup`, plus card ringkas faksi baru di Dashboard
  (`renderFactionCard`, tap untuk buka daftar faksi)

## Debug (v0.1.8)
Sama seperti v0.1.7, environment build ini tidak ada akses browser
(offline), jadi pengujian dilakukan lewat **simulasi logic langsung di
Node.js** — `FactionSystem` di-load dengan stub `GameState`/`Inventory`/
`Events`/`fetch`, dites skenario nyata:
- Join faksi → reputasi/koin faksi mulai dari 0, tersimpan benar
- 10x Scavenge → reputasi +30, koin +20 (persis formula 3/scavenge,
  2/scavenge)
- Coba beli item Rare (harga 80 koin) saat koin cuma 20 → ditolak
  dengan pesan jelas jumlah kurangnya
- Setelah cukup koin (80) & reputasi (120, di atas syarat Rare yaitu 0)
  → beli sukses, item masuk inventory, koin terpotong tepat ke 0
- Coba beli item Epic (butuh reputasi ≥300) saat reputasi baru 120 →
  ditolak dengan pesan reputasi kurang
- Coba beli item faksi LAIN saat sedang join faksi berbeda → ditolak
  ("bukan anggota faksi ini")
- **Pindah faksi**: reputasi/koin faksi lama (Blue Tiger: 120 rep, 0
  koin) tetap tersimpan utuh setelah pindah ke Seafire, faksi baru
  mulai dari 0 (bukan reset semua data)
- Menang hunting dengan `expReward=30` → reputasi +10, koin +6, sesuai
  formula `max(5, round(30/3))` dan `max(3, round(30/5))`
- Keluar faksi → `p.faction` jadi null, tapi data faksi lama tetap ada
  di `factionData` (bisa gabung lagi tanpa kehilangan progres)
- **Migrasi save**: 3 skenario (save lama dengan id faksi kota yang
  sudah tidak ada → direset ke null; save yang sudah pakai id faksi
  baru yang valid → tidak diubah; save sangat lama tanpa field faksi
  sama sekali → dapat default kosong) — semuanya benar

Semua file JS (`factions.js`, `exploration.js`, `battle-bridge.js`,
`state.js`, `panels.js`, `main.js`) diverifikasi `node --check` (nol
syntax error). `factions.json` dan `items.json` divalidasi dengan
`json.load()` Python (nol JSON error).

**Catatan jujur**: sama seperti update sebelumnya, klik-real-UI (buka
overlay Faksi dari Menu, tampilan card faksi di Dashboard, tab
pindah/gabung faksi, grid Faction Shop, popup beli item, depth overlay
Faksi→Faction Shop→popup beli) belum diverifikasi visual di WebView/
browser sungguhan — cuma logic intinya yang teruji penuh lewat Node.js.
Tolong cek di Acode/Termux sebelum dianggap final, terutama:
- Overlay Faksi dibuka sebagai layer-1, lalu "Tukar Koin Faksi" perlu
  MENUTUP Faksi dulu baru buka Faction Shop sebagai layer-1 baru (biar
  popup beli item di dalamnya tetap masuk batas MAX_DEPTH=2) — sudah
  saya desain begitu di kode, tapi transisi visualnya perlu dicek
- Warna border card faksi (pakai `f.color` per faksi) kebaca jelas di
  atas background game yang gelap

## UPDATE v0.1.9: Elite Pass Aktif — Reward Table 100 Level (Free + Premium)

### Konsep
Elite Pass sebelumnya cuma placeholder "tahap pengembangan" di Menu.
Sekarang aktif penuh: **100 level, 2 jalur** (Free & Premium), reward
tiap level didefinisikan statis (bukan RNG) di `js/data/pass.json` —
di-generate lewat script sekali jalan supaya konsisten dan gampang
di-tuning ke depannya.

### Cara naik level Pass
**Tidak ada grind terpisah** — Pass EXP naik otomatis 1:1 mengikuti
EXP karakter normal (di-hook langsung di `Player.addExp()`). Jadi main
seperti biasa (Scavenge, menang Hunting, klaim Misi) otomatis naikkan
Pass level barengan. Formula kebutuhan EXP per level: `50 + level*15`
(makin tinggi level, makin butuh banyak EXP, konsisten dengan pola
kurva level karakter yang sudah ada).

### 2 Jalur reward
- **Free**: siapa saja otomatis bisa klaim begitu levelnya tercapai.
  Isinya Rupiah (naik seiring level), sesekali item consumable dasar,
  dan teaser kecil Kredit tiap 20 level.
- **Premium**: perlu dibuka dulu pakai **💎150 Kredit** (sekali bayar,
  permanen). Begitu terbuka, **semua reward Premium dari level 1
  sampai level sekarang langsung bisa diklaim** (tidak perlu ulang dari
  awal). Isinya jauh lebih besar: Rupiah lebih tinggi, item
  uncommon/rare tiap 5 level, dan **milestone tiap 25 level** (Kredit
  15/30/45/60 + item bertema) — puncaknya di **level 100**: 💎60 Kredit
  + 2 item eksklusif mythic baru (**Pisau Elite Pass** & **Zirah Elite
  Pass**, cuma bisa didapat dari sini).
- Tombol **"Klaim Semua"** muncul kalau ada reward yang siap diklaim,
  berguna buat pemain yang levelnya udah jauh di depan tapi belum
  sempat buka Pass.

### Kenapa harga Premium 150 Kredit
Kredit sekarang cuma didapat dari reward quest tertentu (`prolog_hunt_
wildlife` +20, `side_suku_cadang_langka` +5) dan belum ada jalur topup
sungguhan. Harga ini didesain untuk skenario **setelah** topup
tersambung nanti — untuk sekarang anggap ini placeholder harga yang
masuk akal secara desain, gampang di-tuning tinggal ubah
`PREMIUM_UNLOCK_COST_KREDIT` di `js/game/pass.js`.

### File baru & yang diubah
- **`js/data/pass.json`** (baru) — 100 level x {free, premium} reward,
  di-generate deterministik (bukan ditulis manual satu-satu), semua
  `itemId` sudah dicek silang ke `items.json` (nol dangling reference)
- **`js/data/items.json`** — +2 item baru non-faksi: `pass_mythic_blade`
  & `pass_mythic_armor` (rarity mythic, cuma didapat dari Pass level
  100 Premium)
- **`js/game/pass.js`** (baru) — `PassDB` (loader) + `PassSystem`
  (tracking level/exp, klaim per-track, unlock premium, klaim semua)
- **`js/game/player.js`** — hook `PassSystem.addPassExp(amount)` di
  awal `Player.addExp()`, jalan duluan sebelum cek level max karakter
  (supaya Pass tetap jalan lanjut meski karakter sudah level 100)
- **`js/engine/state.js`** — field baru `p.passProgress`, migrasi
  otomatis untuk save lama yang belum punya field ini
- **`js/ui/panels.js`** — Pass diaktifkan di Menu flyout (sebelumnya
  toast "tahap pengembangan"), overlay penuh: progress card, tombol
  buka Premium, tombol Klaim Semua, dan **tabel reward scrollable 100
  baris** (kolom Free & Premium bersebelahan, tiap sel nunjukkin isi
  reward + tombol Klaim/status terkunci/sudah diklaim)
- **`css/main.css`** — style baru buat baris tabel Pass (`.pass-row`,
  `.pass-cell`, dst.)

## Debug (v0.1.9)
Sama seperti update sebelumnya, tidak ada akses browser di environment
build ini, jadi diuji lewat **simulasi logic Node.js** — `PassSystem`
di-load dengan stub `GameState`/`Inventory`/`Events`/`fetch`:
- Tambah EXP sebesar kebutuhan kumulatif ke level 10 (dihitung manual
  dari formula) → level Pass tepat jadi 10, sisa EXP 0 (presisi)
- Klaim level 1 Free → Rupiah nambah sesuai tabel, klaim ulang di level
  sama → ditolak ("Sudah diklaim")
- Klaim level 1 Premium sebelum dibuka → ditolak ("Buka jalur Premium
  dulu")
- Unlock Premium dengan Kredit cukup (200) → sukses, Kredit terpotong
  tepat 150 jadi 50; coba unlock lagi → ditolak (sudah aktif)
- Klaim level 5 Premium setelah dibuka → sukses, item masuk inventory
  sesuai tabel
- Klaim level yang belum tercapai (20, padahal baru level 10) →
  ditolak ("Level belum tercapai")
- **Klaim Semua** → berhasil klaim 18 reward sekaligus (10 level Free
  + 10 level Premium, minus yang sudah diklaim manual sebelumnya),
  `countClaimable()` jadi 0 setelahnya (tidak ada yang tersisa)
- Push EXP sampai jauh melebihi level 100 → level Pass mentok tepat di
  100 (tidak overflow), EXP direset ke 0 (bukan minus)
- Klaim level 100 Premium → 2 item mythic (`pass_mythic_blade`,
  `pass_mythic_armor`) masuk inventory dengan benar

Migrasi `passProgress` dites 3 skenario (save sangat lama tanpa field
sama sekali, save yang sudah valid/idempotent, save dengan field
`passProgress` yang korup/tidak lengkap) — ketiganya menghasilkan
struktur yang benar.

Semua file JS (`pass.js`, `player.js`, `state.js`, `panels.js`,
`main.js`) diverifikasi `node --check` (nol syntax error). `pass.json`
divalidasi dengan Python `json.load()` (nol JSON error) dan
cross-check semua 100 level × 2 jalur terhadap `items.json` — **nol
dangling item reference**.

**Catatan jujur**: klik-real-UI (buka overlay Pass dari Menu, scroll
tabel 100 baris di layar kecil, tombol Klaim per baris, tombol buka
Premium, tombol Klaim Semua) belum diverifikasi visual di WebView/
browser sungguhan — cuma logic intinya yang teruji penuh. Tolong cek
di Acode/Termux sebelum dianggap final, terutama performa scroll 100
baris kartu di WebView Android (kalau berasa berat, bisa dioptimasi
jadi lazy-render per rentang level alih-alih render 100 baris sekaligus).
