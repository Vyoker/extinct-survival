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
- Event Karhutla sekali jalan, dialog Visual Novel di semua misi, dan Sub Skill Karhutla
- Top Up QRIS dengan verifikasi manual admin
- Cloud Save: simpan dan pulihkan progres antar perangkat

## Rilis Terbaru — v0.7.3

- **Chat & presence realtime:** chat global dan pemain online kini
  realtime tanpa polling tiap 15 detik, jadi lebih ringan dan status
  online langsung hilang saat koneksi putus. Bila layanan realtime
  belum tersedia, game otomatis kembali ke cara lama — game tidak
  rusak. Hosting, top-up, kredit, dan cloud save tetap seperti
  sebelumnya.
- **Event Karhutla (sekali jalan):** setelah cerita utama selesai,
  kebakaran hutan dan lahan melanda Kalimantan Wilds. Ikuti 20 misi
  berantai: ekspedisi, penyelamatan warga, pemadaman, sampai
  menghadapi dalang di balik api, King Redbull.
- **Visual Novel untuk semua misi:** setiap misi kini dibuka dan
  ditutup dengan dialog karakter — 20 misi karhutla, 10 main quest,
  10 side quest, dan 5 kontrak faksi — dengan potret pembicara dan
  papan nama, gaya panel dialog Day R.
- **Sub Skill Karhutla:** selesaikan event sampai akhir untuk
  membuka skill pasif ini. Kayu dari Scavenge menjadi 2x lipat dan
  peluang mendapat kayu naik 20%.
- **Potret Visual Novel faksi:** dialog kini menampilkan potret
  pembicara untuk Blue Tiger, Seafire, dan White Ghost, termasuk
  figur karakter White Ghost lengkap.
- **Efek atribut senjata & set armor:** senjata langka yang dipakai
  kini bisa membakar, meracuni, melukai, atau membuat musuh pingsan
  selama beberapa giliran (boss kebal pingsan). Set armor faksi yang
  lengkap memberi bonus bertahan masing-masing, dan Zirah Elite Pass
  memulihkan Defense tiap giliran.
- **Musuh event lebih sulit:** selama misi event aktif, musuh event
  (dan semua musuh di Kalimantan Wilds) punya HP, damage, dan Defense
  dikali 5 dengan metode scaling yang sama seperti sebelumnya.
  Hadiah EXP dan Rupiah tidak ikut naik.


## Teknologi

Vanilla JavaScript (ES6, modul IIFE) · CSS custom properties ·
Netlify Functions + Netlify Blobs untuk backend Top Up & Cloud Save, plus Firebase Realtime Database untuk chat & presence (v0.7.0).

## Dibuat oleh

**Vyoker** — [YouTube](https://youtube.com/@Vyoker) ·
[TikTok](https://tiktok.com/@vyoker.mp4) ·
[Trakteer](https://trakteer.id/vyoker)
