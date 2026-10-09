# Setup Fitur Top Up (QRIS Statis + Netlify Functions + Blobs)

## Yang perlu dipahami dulu

QRIS yang dipakai (`assets/images/qris-afistore.jpg`) adalah **QRIS STATIS**
(satu gambar sama untuk semua transaksi) — bukan QRIS dinamis dari payment
gateway (Midtrans/Xendit/dsb). Konsekuensinya:

- **Tidak ada callback otomatis** dari bank/e-wallet saat pembayaran masuk.
- Verifikasi **tetap manual**: kamu harus cek sendiri mutasi masuk di
  aplikasi e-wallet/bank penerima QRIS, cocokkan dengan nominal, lalu klik
  Approve di dashboard admin.
- Untuk memudahkan pencocokan, tiap order dapat **nominal unik**
  (harga paket + kode acak 1-899 rupiah, misalnya Rp10.000 jadi Rp10.437).

Kalau nanti volume topup sudah ramai dan mau full otomatis, baru worth
pindah ke QRIS dinamis lewat payment gateway (Midtrans/Xendit/Tripay) yang
punya webhook — tapi itu di luar scope build ini.

## Struktur yang ditambahkan

```
extinct-survival/
├── netlify.toml                    ← BARU: config build & functions
├── package.json                    ← BARU: dependency @netlify/blobs
├── netlify/functions/              ← BARU: backend serverless
│   ├── topup-packages.js           (GET daftar paket)
│   ├── topup-create.js             (POST bikin order baru)
│   ├── topup-status.js             (GET cek status + kirim kredit sekali)
│   ├── admin-login.js              (POST cek password admin)
│   ├── admin-orders.js             (GET daftar semua order, admin-only)
│   ├── admin-approve.js            (POST approve order, admin-only)
│   ├── admin-reject.js             (POST reject order, admin-only)
│   └── utils/                      (helper bersama: response, auth, dst)
├── admin/
│   └── index2.html                 ← BARU: dashboard verifikasi (TIDAK ikut APK)
├── assets/images/qris-afistore.jpg ← BARU: QRIS kamu (Afistore)
├── css/topup.css                   ← BARU
└── js/game/topup.js                ← BARU: modul topup di game
```

`admin/index2.html` **tidak pernah masuk ke build APK** — dia cuma dibuka
lewat browser biasa, terpisah dari game.

## Langkah deploy

1. **Push semua file ini** ke repo GitHub yang sudah terhubung ke Netlify
   (situs `extinct-survival.netlify.app`), atau upload manual lewat
   Netlify CLI / drag-drop deploy.
2. Di **Netlify Dashboard → Site settings → Environment variables**,
   tambahkan:
   - `ADMIN_PASSWORD` = password rahasia kamu (jangan pernah di-commit ke
     git, cukup di sini saja).
3. Netlify otomatis `npm install` (karena ada `package.json`) dan
   mendeteksi folder `netlify/functions` sebagai Functions — tidak perlu
   setting tambahan selama `netlify.toml` ikut ter-push.
4. **Netlify Blobs** aktif otomatis untuk semua situs Netlify modern, tidak
   perlu setup database terpisah.
5. Redeploy, tunggu build selesai.

## Cara pakai

**Player** (di dalam game): Menu ☰ → 💳 Top Up → pilih paket → scan QRIS
→ transfer **tepat** sesuai nominal unik yang ditampilkan → tekan "Cek
Status" (atau tunggu, karena otomatis polling tiap 6 detik).

**Kamu (admin)**: buka `https://extinct-survival.netlify.app/admin/index2.html`
di browser → login pakai `ADMIN_PASSWORD` → tab **Pending** akan
menampilkan semua order menunggu → cek mutasi masuk di aplikasi QRIS-mu,
cocokkan nominal (dan kalau perlu waktu/kode order) → klik **Approve**.
Begitu di-approve, kredit otomatis masuk ke player saat game-nya polling
status berikutnya (maksimal ~6 detik kalau layar topup masih terbuka, atau
saat mereka buka lagi menu Top Up kalau sempat ditutup).

## Ubah harga/paket

Edit satu file saja: `netlify/functions/utils/packages.js`. Client
(`js/game/topup.js`) selalu fetch daftar paket dari server lewat
`topup-packages`, jadi tidak ada duplikasi angka yang perlu disinkronkan
manual.

## Keamanan yang perlu diperhatikan

- Ganti `ADMIN_PASSWORD` ke sesuatu yang kuat, jangan dipakai ulang dari
  akun lain.
- `/admin/index2.html` dikasih header `noindex` (lihat `netlify.toml`)
  supaya tidak muncul di hasil pencarian — tapi ini cuma privasi
  tambahan, bukan pengaman utama. Pengaman utama tetap di password yang
  divalidasi server-side di setiap fungsi `admin-*`.
- Order otomatis kedaluwarsa 30 menit (`ORDER_TTL_MS` di
  `topup-create.js`) — order lama yang tidak diapprove tetap tersimpan
  berstatus `expired` tapi masih bisa di-approve manual kalau ternyata
  transfernya baru ketahuan belakangan.

## Kirim Kredit Manual (v0.3.3)

Kalau order topup bermasalah (mis. player menutup panel sebelum admin
approve sehingga kredit tidak ter-klaim), admin bisa kirim kredit
langsung tanpa lewat order:

1. Minta **kode save** player (player: Menu → Simpan Online → salin kode).
2. Buka `/admin/index2.html` → kartu **Kirim Kredit Manual**.
3. Isi kode save + jumlah kredit + catatan (opsional) → **Kirim Kredit**.
4. Kredit masuk otomatis di game player (±30 detik, perlu internet),
   lengkap dengan notifikasi "Kredit masuk!". Riwayat di dashboard
   berubah dari TERKIRIM menjadi DITERIMA setelah game player ack.

Catatan teknis:
- Grant disimpan di Netlify Blobs store `credits`, key `grant:<KODE16>`.
- Player yang belum pernah Simpan Online tidak punya kode → tidak bisa
  menerima kiriman manual (minta player Simpan Online dulu).
- Tidak perlu environment variable baru — pakai `ADMIN_PASSWORD`
  yang sama seperti order topup.

## Status "paid" — tombol "Saya Sudah Bayar" (v0.3.4)

Alur topup sekarang:

1. Player pilih paket → order `pending`, bayar via QRIS tepat nominal unik.
2. Player klik **"Saya Sudah Bayar"** → `POST topup-confirm` → order
   dikunci jadi `paid`. Layar berubah jadi "Menunggu verifikasi admin".
3. Order `paid` **tidak bisa kedaluwarsa sendiri** (server tidak
   meng-expire-nya). Menu Top Up selalu me-resume order ini, bahkan
   setelah app ditutup.
4. Admin lihat badge **SUDAH BAYAR** (+ jam bayar) di tab Pending →
   cek mutasi → Approve/Reject manual seperti biasa.
5. Saat approved, polling client mengubahnya jadi `claimed` dan kredit
   masuk otomatis.

Kenapa: sebelumnya countdown 30 menit menghapus pending order dari HP
player; kalau admin approve belakangan, kredit approved tidak pernah
ter-klaim (tidak ada yang polling). Sekarang kasus itu tertutup —
kecuali player menekan "Batalkan Order" sendiri, order tidak hilang.

## Mail — klaim kiriman manual (v0.3.5)

Sejak v0.3.5, kiriman kredit manual TIDAK lagi masuk otomatis. Alurnya:

1. Admin kirim dari dashboard (kode save + kredit + judul + pesan).
2. Di game player muncul badge di pill **Mail** (Menu) + notifikasi
   "Ada mail baru dari admin!".
3. Player buka Menu → Mail → tekan **Klaim** → kredit masuk.

Fungsi yang sama dipakai sebagai **backup topup yang gagal**:
kalau ada order nyangkut (mis. approved tapi tidak ter-klaim),
admin kirim mail kompensasi dengan judul mis. "Kompensasi Topup"
dan catatan kode ordernya. Player klaim seperti biasa.

Teknis: mail = grant di store Blobs `credits` (endpoint lama
`credit-send`/`credit-pending`/`credit-ack` dipakai ulang, tanpa
fungsi baru). Modul client: `js/game/mail.js` (menggantikan
`js/game/credit.js` yang dihapus).
