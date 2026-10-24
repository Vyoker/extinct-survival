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

## Rilis Terbaru — v0.6.9

- **Perbaikan bug crafting:** item hasil craft tidak lagi bisa
  hilang. Dulu, kalau tas penuh saat membuat item jenis baru
  (mis. Homemade Pistol pertama), material sudah terpotong tapi
  itemnya gagal masuk tas — dan game tetap bilang "Berhasil
  membuat". Kini game memeriksa dulu apakah hasil craft muat di
  tas sebelum memotong material; kalau tidak muat, craft ditolak
  dan materialmu utuh. Lapisan pengaman kedua: bila hasil tetap
  gagal masuk, semua material dikembalikan. Semua 32 resep sudah
  diaudit dan dites satu per satu.
- **UI Crafting v2:** tiap kartu resep kini menampilkan ikon item
  hasil, ikon tiap material (dengan hitungan punya/butuh, mis.
  Logam Tempa 1/2 — hijau kalau cukup, merah kalau kurang), badge
  jumlah hasil (peluru x5/x3), dan ringkasan stat hasil (Damage,
  Durabilitas, Crit, Jarak) supaya tidak perlu menebak sebelum
  membuat.

## Teknologi

Vanilla JavaScript (ES6, modul IIFE) · CSS custom properties ·
Netlify Functions + Netlify Blobs untuk backend Top Up & Cloud Save.

## Dibuat oleh

**Vyoker** — [YouTube](https://youtube.com/@Vyoker) ·
[TikTok](https://tiktok.com/@vyoker.mp4) ·
[Trakteer](https://trakteer.id/vyoker)
