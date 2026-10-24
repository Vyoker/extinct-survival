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

## Rilis Terbaru — v0.6.4

- **Battle System v4 — Defense kini bekerja sungguhan:** poin
  Defense-mu adalah perisai aktif. Setiap damage yang masuk
  mengurangi Defense dulu sampai habis; HP baru berkurang setelah
  perisaimu pecah. Bilah Defense di layar battle dan bilah biru
  mini di token karaktermu kini menurun sesuai damage yang
  tertahan, dan popup "Perisai Hancur" muncul saat Defense habis.
- **Popup MISS & CRITICAL di karakter:** serangan yang meleset kini
  memunculkan popup "MISS" besar di karakter yang diserang, dan
  serangan kritis memunculkan popup "CRITICAL" dengan damage 1,5x
  lipat — peluang kritis mengikuti stat Critical karaktermu.
  Serangan musuh sekarang juga bisa meleset dan kritis.
- Fitur baru: **Barter** — kirim item langsung ke pemain lain yang
  sedang online di wilayah yang sama denganmu. Pilih pemainnya,
  pilih item dari tasmu, atur jumlahnya, kirim — item langsung
  masuk ke tas penerima dan ia menerima pemberitahuan. Hanya item
  yang bisa dikirim; Rupiah dan Kredit tidak bisa ditransfer.
- Set Seafire kini tampil lengkap dengan artwork-nya: Golok Bara
  Api, Baju Zirah Magma, dan Liontin Ember. Baju Zirah Magma
  tampil sebagai figur karakter full body saat dipakai.
- Semua musuh kini tampil dengan potretnya di battle dan daftar
  hunting, termasuk para bos dan musuh baru — potret dibedakan
  lewat warna lingkaran tier sesuai level musuh.

## Teknologi

Vanilla JavaScript (ES6, modul IIFE) · CSS custom properties ·
Netlify Functions + Netlify Blobs untuk backend Top Up & Cloud Save.

## Dibuat oleh

**Vyoker** — [YouTube](https://youtube.com/@Vyoker) ·
[TikTok](https://tiktok.com/@vyoker.mp4) ·
[Trakteer](https://trakteer.id/vyoker)
