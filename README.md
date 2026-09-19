<div align="center">

# 🧟 EXTINCT SURVIVAL

**20 tahun pasca *The Great Collapse* — bertahan hidup di reruntuhan Nusantara.**

`v0.2.5` · WebView Android (HTML5) · Vanilla JS, no framework · 🇮🇩 ID / 🇬🇧 EN

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

## 🆕 Rilis Terbaru — `v0.2.5`

- **Sistem Top Up** resmi aktif — QRIS statis terintegrasi, dashboard
  verifikasi khusus developer (`admin/index2.html`), backend serverless
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
[TikTok @vyoker.mp4](https://tiktok.com/@vyoker.mp4) ·
[Trakteer](https://trakteer.id/vyoker)
