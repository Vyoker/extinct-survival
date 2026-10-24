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

## Rilis Terbaru — v0.6.6

- **Ammo per senjata:** Peluru dan Selongsong lama dipecah jadi 4
  jenis — 9mm Ammo untuk pistol, 5.56mm Ammo untuk rifle,
  12 Gauge Ammo untuk shotgun, dan 7.62mm Ammo untuk sniper.
  Di Item Mall, keempatnya rata: pak ×50 seharga 10 Kredit.
  Resep craftingnya sama seperti sebelumnya.
- **Scavenge lebih royal:** sekali Scavenge kini dapat 1–3 jenis
  item sekaligus (bukan 1 item pelit lagi), plus peluang bonus dari
  INT dan skill Scavenger seperti biasa.
- **Loot sesuai geografis:** tiap wilayah punya ciri khasnya —
  Kalimantan sering memberi kayu dan tali, Bali sering memberi
  air dan herbal, Jakarta dan Bandung kaya besi rongsokan dan
  suku cadang, Surabaya kaya makanan kaleng.
- **Musuh auto-generate dari levelmu:** level musuh kini mengikuti
  level pemain ditambah offset tier-nya — musuh putih sama dengan
  levelmu, ungu +5, boss +10 (mentok level 100). HP, damage, EXP,
  dan Rupiah musuh ikut dihitung ulang dari level barunya, jadi
  musuh yang lebih tinggi levelnya benar-benar lebih berat.
- **Penalti kalah battle:** kehilangan 5% EXP (dari kebutuhan naik
  level) dan semua equipment yang terpasang rusak 75% — durability
  tersisa 25%, hampir rusak tapi tidak langsung patah. HP tetap
  dipulihkan ke 15 supaya tidak softlock.
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
