# Setup Cloud Save (Netlify Functions + Blobs)

## Cara kerja

- Pemain menekan **Simpan Sekarang** (menu ☰ → Simpan Online). Game
  mengunggah seluruh `GameState` ke Netlify Blobs dengan key
  `player/<KODE>.json`.
- **Kode save** = 16 karakter acak (tanpa 0/1/O agar tidak ambigu),
  dibuat otomatis di perangkat pemain dan disimpan di `localStorage`.
  Kode ini adalah *kuncinya*: siapa pun yang memegang kode bisa
  membaca & menimpa save tersebut. Tidak ada akun, tidak ada password
  tambahan — simpel dan cukup untuk game single-player.
- **Muat dari Cloud**: pemain memasukkan kode di perangkat lain →
  data diunduh → `GameState.importSave()` memvalidasi + memigrasi
  skema lama → halaman reload dan pemain lanjut dari save tersebut.

## File yang ditambahkan

```
netlify/functions/
├── player-save.js          (POST {code, data} → simpan ke Blobs)
├── player-load.js          (GET ?code= → ambil dari Blobs)
└── utils/save-store.js     (store Blobs bernama "saves", terpisah dari topup)
js/game/cloudsave.js        (modul client: kode, API, overlay UI)
js/engine/state.js          (+ exportSave() / importSave())
```

## Langkah deploy

1. Push semua file ke repo yang terhubung ke Netlify (sama seperti
   setup topup — tidak perlu environment variable tambahan).
2. Netlify Blobs aktif otomatis; store `saves` dibuat saat pertama
   kali ada yang menyimpan.
3. Tidak ada konfigurasi tambahan. `ADMIN_PASSWORD` tidak dipakai di
   sini (kode save adalah rahasianya masing-masing pemain).

## Batasan yang perlu diketahui

- **Hanya jalan di Netlify** (butuh Functions). Di GitHub Pages /
  build statis murni, tombol Simpan Online menampilkan pesan error
  yang jelas.
- Maksimal **512 KB** per save (lebih dari cukup untuk save JSON game
  ini yang biasanya < 50 KB).
- Model "last write wins": kalau dua perangkat menyimpan dengan kode
  yang sama, yang terakhir menang. Tidak ada merge konflik otomatis.
- Jangan bagikan kode save ke orang lain — pemilik kode bisa menimpa
  progresmu.

## Testing cepat

1. Buka versi Netlify → mainkan sebentar → ☰ → Simpan Online →
   **Simpan Sekarang** → salin kode.
2. Buka tab incognito / HP lain → layar login → **Muat dari Cloud** →
   tempel kode → data dipulihkan.
