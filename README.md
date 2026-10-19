# EXTINCT SURVIVAL

Survival RPG berbasis web, berlatar 20 tahun setelah *The Great Collapse*
di reruntuhan Nusantara. Jelajahi lima wilayah pasca-kiamat Indonesia —
dari benteng Surabaya hingga hutan liar Kalimantan — kelola hunger, thirst,
health, dan sanity, bertarung dalam tactical grid battle, dan bangun
karakter lewat skill, equipment, serta faksi.

Dibangun dengan HTML/CSS/JavaScript murni (tanpa build step, tanpa
framework). Progres tersimpan di `localStorage`.

## Mainkan

- **Web:** https://extinct-survival.netlify.app
- **Android:** dibungkus sebagai APK WebView (via Appmint)

## Fitur Utama

- Eksplorasi: Scavenge, Hunting, dan Travel antar 5 lokasi dengan lore
  serta musuh unik
- Tactical grid battle turn-based (sistem AP, AI musuh)
- Inventory 6 slot equipment dengan paperdoll, durability senjata
- Crafting berbasis material, bonus hasil dari atribut INT
- Skill Survivor / Hunter / Scavenger, rank Bronze hingga Master
- Attribute point permanen tiap level up (Damage / Defense / Evasion / Crit)
- Elite Pass 100 level, jalur Free & Premium
- Faksi: reputasi dan faction shop eksklusif
- Shop dengan harga dinamis, quest bertahap, dan sistem Mail
- Top Up QRIS dengan verifikasi manual admin
- Cloud Save: simpan dan pulihkan progres antar perangkat

## Rilis Terbaru — v0.5.0

- Sistem misi faksi: 3 misi harian acak untuk faksi aktif, reset setiap
  hari. Hadiahnya reputasi dan Koin Faksi. Daftar misi ada di panel
  Faksi, di bawah kartu faksimu.

## v0.4.9

- Contract Faction: setiap faksi kini punya 1 misi kontrak wajib yang
  harus diselesaikan sebelum bisa bergabung (berlaku juga untuk anggota
  lama — Faction Shop dan progres reputasi dibekukan sampai kontrak
  selesai). Daftar kontrak ada di tab "Kontrak Faksi" pada menu Misi.

## v0.4.8

- Crafting diperluas: 20 resep baru, total 24. Termasuk 6 senjata baru
  (Kapak Batu hingga Parang Baja Tempa), 7 armor baru (Zirah Bulu
  Beruang, Perisai Anti Huru-Hara), 5 consumable baru (Tapal Herbal,
  Penawar Bisa, Ransum Lapangan), dan 2 material olahan (Logam Tempa,
  Kulit Samak) yang menjadi bahan peralatan tier Rare.

## v0.4.7

- Cerita utama baru: arc "Jejak Proyek Fajar" — 8 chapter lanjutan dari
  prolog, satu chapter per wilayah, dari sinyal misterius di Jakarta
  Ruins hingga fasilitas rahasia di jantung Kalimantan Wilds.
- 7 misi sampingan baru, 2 per wilayah (Jakarta, Surabaya, Bandung,
  Bali, Kalimantan). Total misi kini 20: 10 misi utama + 10 sampingan.

## v0.4.6

- Splash screen baru: artwork reruntuhan Nusantara full-screen dengan
  kredit developer VyokerDEV (nama akun developer di Google Play Store).

## v0.4.5

- Persiapan build Google Play Store: pembelian kredit via Google Play
  Billing otomatis aktif saat game dijalankan di aplikasi Play Store
  (kredit masuk instan tanpa verifikasi manual); di luar itu top up
  QRIS manual tetap berjalan seperti biasa.

## Teknologi

Vanilla JavaScript (ES6, modul IIFE) · CSS custom properties ·
Netlify Functions + Netlify Blobs untuk backend Top Up & Cloud Save.

## Dibuat oleh

**Vyoker** — [YouTube](https://youtube.com/@Vyoker) ·
[TikTok](https://tiktok.com/@vyoker.mp4) ·
[Trakteer](https://trakteer.id/vyoker)
