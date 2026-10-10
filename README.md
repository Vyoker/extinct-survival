<div align="center">

# 🧟 EXTINCT SURVIVAL

**20 tahun pasca *The Great Collapse* — bertahan hidup di reruntuhan Nusantara.**

`v0.3.9` · WebView Android (HTML5) · Vanilla JS, no framework · 🇮🇩 ID / 🇬🇧 EN

</div>

---

## 📖 Tentang

**Extinct Survival** adalah survival RPG berbasis web, dirancang untuk
dibungkus sebagai APK WebView Android. Pemain menjelajahi lima wilayah
pasca-kiamat di Indonesia — dari benteng militer Surabaya hingga hutan
liar Kalimantan — sambil mengelola hunger, thirst, health, dan sanity,
bertarung lewat sistem *tactical grid battle*, serta membangun karakter
lewat skill, equipment, dan faksi.

Seluruh game jalan **tanpa build step** (HTML/CSS/JS murni) dan
menyimpan progres di `localStorage`, jadi bisa langsung dijalankan dari
Termux + Acode maupun di-deploy sebagai situs statis di Netlify.

## ✨ Fitur Utama

| Kategori | Fitur |
|---|---|
| 🗺️ **Eksplorasi** | Scavenge, Hunting, Travel antar 5 lokasi dengan lore & musuh unik |
| ⚔️ **Battle** | Tactical grid turn-based (AP system, BFS movement, AI musuh) |
| 🎒 **Inventory** | Equipment 6 slot (paperdoll), durability senjata, icon grid ala Day R |
| 🔨 **Crafting** | Recipe berbasis material, bonus hasil dari attribut INT |
| 🏅 **Skill** | Survivor / Hunter / Scavenger — rank Bronze → Master, 5 tier tiap rank |
| 💪 **Attribute Point** | Alokasi permanen ke Damage / Defense / Evasion / Crit tiap level up |
| 🎫 **Elite Pass** | 100 level, jalur Free & Premium, reward menyatu dengan EXP karakter |
| 🏴 **Faksi** | Bergabung, reputasi, dan Faction Shop eksklusif |
| 🛒 **Shop** | Beli & jual item dengan harga dinamis sesuai rarity |
| 🎯 **Quest** | Misi bertahap dengan reward Rupiah, EXP, dan item |
| 💳 **Top Up** | QRIS statis + verifikasi manual, backend Netlify Functions & Blobs |
| ☁️ **Cloud Save** | Simpan & pulihkan progres via kode rahasia, backend Netlify Blobs |

## 🆕 Rilis Terbaru — `v0.3.9`

- **Splash screen** — layar loading dengan logo + progress bar bertahap
  (data item → lokasi → misi → faksi → pass → karakter), versi app
  tampil di splash.
- **Auto-sync cloud (opsi B)** — saat startup, game memeriksa simpanan
  cloud; kalau versi cloud lebih baru dari terakhir di-push, muncul
  tawaran "Pulihkan dari Cloud / Tetap Data Lokal" (tidak ditimpa
  diam-diam). Timeout 9 detik, gagal koneksi dilewati diam-diam.
- **Redesign UI Elite Pass** — hero header (level besar + progress +
  badge premium), roadmap reward horizontal snap-scroll (node berdenyut
  emas kalau bisa diklaim), panel detail per level dengan chip reward
  (ikon + glow rarity), kartu upsell premium baru, tombol "Klaim Semua"
  sticky di bawah.
- **Infra BGM battle** — `AudioManager.playBgm('battle')` otomatis saat
  masuk battle dan kembali ke main saat selesai; fallback ke track utama
  sampai file `bgm-battle.mp3` (Suno) tersedia.

## Rilis `v0.3.8`

- **Sistem audio penuh (SFX + BGM)** — modul baru `js/game/audio.js`
  (`AudioManager`):
  - 19 SFX disintesis real-time via Web Audio API (tanpa file, 0 KB):
    klik/tab UI, buka-tutup, error, koin, heal, level-up, ayunan,
    tembakan, kena, crit, meleset, menang, kalah, kabur, craft,
    mail, skill.
  - BGM loop `assets/audio/bgm-main.mp3` — "Ashes of the Archipelago"
    buatan Suno (dikompres 128kbps), mulai otomatis saat masuk game
    dengan fade-in, jeda saat tab disembunyikan.
  - Volume BGM & SFX terpisah + mute, tersimpan di localStorage;
    pengaturan via Menu → Audio (pill speaker).
  - Hook battle: suara senjata jarak dekat/jauh, hit/crit/miss,
    victory/defeat di `battle-engine.js`; SFX level-up, craft,
    topup approved, klaim mail.
  - AudioContext dibuka saat gesture pertama (aturan autoplay browser).

## Rilis `v0.3.7`

- **Endpoint monitoring publik** `watch-pending` — mengembalikan
  hanya agregat (jumlah pending/paid + lama menunggu terlama), tanpa
  data sensitif, untuk dipoll cron monitoring tiap 5 menit.

## Rilis `v0.3.6`

- **Fix kritis: klaim Mail tidak menambah kredit** — `mail.js`
  memakai `window.GameState`, padahal `state.js` dideklarasikan
  dengan `const` yang tidak menempel di `window`, sehingga blok
  penambah kredit selalu dilewati diam-diam (toast sukses tetap
  muncul!). Sekarang pakai pengecekan aman + `GameState` di-export
  ke `window` seperti modul lain. Audit seluruh modul: tidak ada
  pola bug yang sama di tempat lain.

## Rilis `v0.3.5`

- **Fitur Mail** — kiriman kredit manual dari admin kini masuk sebagai
  **mail** yang harus di-**klaim** player lewat Menu → Mail (pill baru
  di menu flyout, lengkap dengan badge jumlah). Menggantikan auto-apply
  diam-diam v0.3.3. Mail juga jadi backup resmi untuk topup yang
  gagal/nyangkut: admin tinggal kirim mail kompensasi dari dashboard.
- Form kirim manual admin dapat kolom **Judul mail**.
- Icon amplop baru di library (`mail`).

## Rilis `v0.3.4`

- **Topup: tombol "Saya Sudah Bayar"** — player klik tombol ini setelah
  transfer; order dikunci berstatus `paid` (badge "SUDAH BAYAR" di
  dashboard admin + jam bayar). Status paid **tidak bisa kedaluwarsa
  sendiri** — menunggu verifikasi manual admin. Keputusan approve
  tetap manual seperti sebelumnya.
- **Menu Top Up tidak lagi kembali ke pilih paket sendiri** — order
  pending selalu di-resume ke layar pembayaran saat menu dibuka
  (termasuk setelah app ditutup). Countdown habis tidak lagi menghapus
  order diam-diam; kalau benar expired, tampil layar expired dengan
  tombol eksplisit "Buat Order Baru". Ini memperbaiki kasus kredit
  approved tapi tidak pernah ter-klaim.
- Endpoint baru `topup-confirm`; `topup-status` & `admin-approve`
  mendukung status `paid`.

## Rilis `v0.3.3`

- **Kirim kredit manual dari admin** — dashboard admin punya form baru:
  input kode save player + jumlah kredit + catatan. Kredit masuk
  **otomatis** di game (poll tiap 30 detik), tanpa perlu klaim.
  Ada riwayat kiriman (TERKIRIM/DITERIMA). Endpoint:
  `credit-send` (admin), `credit-pending` + `credit-ack` (game),
  `admin-credits` (riwayat). Grant di-key pakai kode save 16 karakter
  (tidak bisa ditebak) supaya tidak bisa diklaim orang lain.
- **Panel Top Up menampilkan kode save** player supaya gampang
  diberikan ke admin untuk kiriman manual.
- **Fix bug menu flyout "langsung hilang"** — WebView Android kadang
  mengirim klik ganda hantu ~300ms setelah tap; sekarang klik-tutup
  dalam 450ms setelah dibuka diabaikan.

## Rilis `v0.3.2`

- **Fix blink di menu Jelajah** — animasi entrance kartu tidak lagi
  ke-replay tiap detik saat countdown cooldown me-refresh panel
  (kelas `no-anim` saat tick, animasi tetap jalan saat navigasi).
- **Icon senjata battle pakai gambar aset asli** — kartu senjata kini
  menampilkan gambar item yang dipakai (mis. `machete.webp`) dengan
  fallback placeholder bila file tidak ada; SVG generik hanya dipakai
  bila item tidak punya gambar.

## Rilis `v0.3.1`

- **Battle UI ala Day R Survival** — layout 3 kolom (panel aksi kiri,
  arena tengah, panel musuh kanan), kartu pemain & musuh gaya rivet
  gelap, kartu aksi parchment dengan badge AP jam pasir, arena khaki
  dengan highlight hijau terang. Otomatis menumpuk vertikal di layar
  portrait sempit. Animasi battle v0.3.0 (lunge, hit flash, shake)
  dipertahankan.
- Tombol "Akhiri Giliran" diganti "Akhiri Putaran" mengikuti istilah
  Day R.

## Rilis `v0.3.0`

- **Cloud Save** — simpan progres ke cloud (Netlify Blobs) dengan kode
  rahasia 16 karakter; pulihkan di HP lain lewat menu ☰ → Simpan Online
  atau tombol "Muat dari Cloud" di layar login.
- **Visual overhaul "Ashfall Professional"** — seluruh emoticon diganti
  ikon SVG konsisten (`js/ui/icons.js`), tipografi modern, animasi battle
  baru (lunge attack, hit flash, screen shake, damage crit), HUD & navigasi
  dipoles ulang.
- Perbaikan: toast & overlay kini tampil juga di layar login
  (sebelumnya tersembunyi karena berada di dalam `#screen-game`).

## 🆕 Rilis `v0.2.5`

- **Sistem Top Up** resmi aktif — QRIS statis terintegrasi, dashboard
  verifikasi khusus developer, backend serverless
  tanpa perlu server pihak ketiga.
- **Balancing reward** Elite Pass, Items, dan Shop menyesuaikan ekonomi
  Rupiah & Kredit pasca aktifnya Top Up.
- Berbagai pembaruan & perbaikan pendukung lainnya.

## ☁️ Deploy — Netlify

Situs live: **[extinct-survival.netlify.app](https://extinct-survival.netlify.app)**

## 🛠️ Tech Stack

Vanilla JavaScript (ES6, IIFE modules) · CSS custom properties (tema
dark, siap multi-tema) · `localStorage` sebagai penyimpanan progres ·
Netlify Functions + Netlify Blobs untuk backend Top Up.

## 👤 Dibuat oleh

**Vyoker** — [YouTube](https://youtube.com/@Vyoker) ·
[TikTok](https://tiktok.com/@vyoker.mp4) ·
[Trakteer](https://trakteer.id/vyoker)
