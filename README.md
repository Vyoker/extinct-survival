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

## Rilis Terbaru — v0.4.2

- Ikon musuh di battle kini memakai artwork khusus bergaya gritty
  (potret bulat transparan), menggantikan ikon generik sebelumnya.
  Tampil di panel musuh, token papan taktis, dan daftar Hunting.
- Musuh yang artwork-nya belum tersedia otomatis memakai ikon lama —
  tidak ada tampilan yang rusak.

## Teknologi

Vanilla JavaScript (ES6, modul IIFE) · CSS custom properties ·
Netlify Functions + Netlify Blobs untuk backend Top Up & Cloud Save.

## Dibuat oleh

**Vyoker** — [YouTube](https://youtube.com/@Vyoker) ·
[TikTok](https://tiktok.com/@vyoker.mp4) ·
[Trakteer](https://trakteer.id/vyoker)
