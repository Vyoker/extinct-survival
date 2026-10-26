# Setup v0.7.0 — Hybrid Netlify (hosting + uang) + Firebase RTDB (chat + presence)

Keputusan terkunci 2026-10-25: hosting game, top-up QRIS, kredit, Play
Billing, cloud save, dan admin top-up TETAP di Netlify. Yang pindah ke
Firebase Realtime Database (RTDB) hanya: chat global, presence (pemain
online), dan sumber pencarian teman. Barter & permintaan teman tetap di
Netlify Blobs, tapi validasi online-nya membaca presence dari RTDB.

JANGAN kirim Service Account JSON ke Muse lewat chat, dan JANGAN
unggah file itu ke workspace/repo. Service Account hanya ditempel
langsung di Netlify (Langkah 4 di bawah).

## Langkah 1 — Buat Realtime Database (di HP, lewat Firebase Console)

1. Buka console.firebase.google.com -> project "Extinct Survival".
2. Menu kiri: Build -> Realtime Database -> Create Database.
3. Lokasi: pilih yang paling dekat (bila ada asia-southeast1, pilih
   itu; bila tidak ada, us-central1 tidak masalah).
4. Mode keamanan: pilih "Start in locked mode" (nanti kita ganti
   rules-nya di Langkah 3).
5. Setelah jadi, catat URL database-nya, bentuknya:
   https://<project-id>-default-rtdb.<region>.firebasedatabase.app
   URL ini yang nanti diisi ke `databaseURL` di config.

## Langkah 2 — Tambah Web app + isi config game

1. Di Firebase Console: Project Settings (ikon gir) -> Your apps
   -> tombol </> (Web) -> nickname: "Extinct Survival Web" ->
   Register app (Firebase Hosting TIDAK perlu dicentang — hosting
   tetap Netlify).
2. Salin blok `firebaseConfig` yang muncul (apiKey, authDomain,
   databaseURL, projectId, storageBucket, messagingSenderId, appId).
3. Buka file `js/firebase-config.js` di repo, ganti semua string
   kosong dengan nilai config itu. `databaseURL` harus sama persis
   dengan URL dari Langkah 1.
4. Config web ini BUKAN rahasia server (boleh dikirim ke asisten
   lewat chat bila perlu dibantu isi). Yang rahasia dan TIDAK boleh
   dikirim adalah Service Account / private key.

Catatan: bila config masih kosong, game otomatis fallback ke Netlify
lama — tidak rusak, hanya belum hemat kredit.

## Langkah 3 — Pasang Rules RTDB

1. Di Firebase Console: Realtime Database -> tab Rules.
2. Hapus isi lama, tempel SELURUH isi file
   `firebase/database.rules.json` dari repo ini, lalu Publish.
3. Artinya singkat: hanya user yang login anonymous boleh
   baca/tulis presence & chat; pesan wajib role 'player' (badge ADMIN
   tidak bisa dipalsukan dari klien), teks 1-200 karakter, nama
   maks 24 karakter; daftar ban hanya bisa diubah server (Admin SDK),
   bukan dari klien.
4. Aktifkan juga Anonymous auth bila belum: Build -> Authentication
   -> Sign-in method -> Anonymous -> Enable -> Save. Tanpa ini,
   game tidak bisa login ke RTDB dan akan fallback ke Netlify.

## Langkah 4 — WAJIB sebelum push live: server Netlify bisa baca RTDB

Tanpa langkah ini, chat + presence klien SUDAH jalan via RTDB, tapi
barter akan menolak ("pemain tidak online"), pencarian teman kosong,
dan dashboard admin presence/chat kosong — karena function Netlify
masih membaca presence lama di Blobs.

1. Di Firebase Console: Project Settings -> Service accounts ->
   "Generate new private key" -> file JSON terunduh.
   SIMPAN file itu baik-baik, jangan kirim ke siapa pun lewat chat.
2. Di Netlify: Site settings -> Environment variables -> Add:
   - Key: `FIREBASE_SERVICE_ACCOUNT_JSON`
     Value: SELURUH isi file JSON itu (tempel langsung di kolom
     Netlify, bukan di chat).
   - Key: `FIREBASE_DATABASE_URL`
     Value: URL database dari Langkah 1.
3. Deploy v0.7.0 SETELAH env di atas tersimpan (function baru
   membaca env saat deploy; env yang ditambah belakangan baru aktif
   di deploy berikutnya).
4. Bila env belum ada, function otomatis fallback ke Blobs lama
   (tidak crash) — tapi barter/teman/admin akan membaca data lama
   yang sudah tidak diperbarui klien. Jadi jangan push live sebelum
   Langkah 4 selesai.

## Langkah 5 — Tes sebelum push (di Termux, setelah ZIP diterima)

1. Ekstrak ZIP ke repo seperti biasa, JANGAN push dulu.
2. Buka game dari localhost/Deploy Preview (bukan GitHub Pages):
   - Chat: kirim pesan dari 2 perangkat/akun — pesan harus muncul
     di perangkat lain TANPA refresh dan TANPA menunggu 15 detik
     (listener realtime, bukan polling).
   - Presence: chip "N Online" harus naik saat perangkat kedua
     masuk, dan turun saat perangkat kedua ditutup (onDisconnect).
   - Barter: kirim item ke pemain sewilayah yang online — harus
     lolos validasi (bukti function Netlify sudah baca RTDB).
   - Teman: cari pemain yang sedang online — harus ketemu.
   - Dashboard admin: presence + chat harus tampil, hapus pesan
     dan ban harus bekerja dari dashboard.
   - Fallback: bila config dikosongkan sementara, chat + presence
     harus kembali jalan via Netlify (bukti fallback bekerja).
3. Bila semua lolos, baru push dengan commit v0.7.0. Satu deploy =
   15 kredit Netlify, tapi setelah live, bakar harian chat/presence
   di Netlify praktis hilang (yang tersisa bandwidth + function
   jarang: top-up, save/load).

## Yang TIDAK berubah di v0.7.0

- Hosting, domain Netlify, dan semua function uang tetap sama.
- Cloud save/load tetap Netlify Blobs (bukan Firebase).
- Permintaan teman (kirim/terima/tolak) tetap Netlify Blobs;
  hanya direktori pencariannya yang sumbernya RTDB.
- Moderasi chat dari dalam game (tombol Admin di panel chat)
  DINONAKTIFKAN di mode Firebase — moderasi hanya dari dashboard
  admin. Ini sengaja: badge ADMIN tidak boleh bisa diklaim klien.
