/**
 * Firebase Web config — v0.7.0 (hybrid Netlify + Firebase RTDB).
 *
 * CARA MENGISI (lihat firebase/SETUP-v0.7.0.md):
 * 1. Firebase Console -> project "Extinct Survival" -> Project Settings
 *    -> Your apps -> tambah Web app (</>) -> salin config-nya.
 * 2. Tempel nilai config itu di bawah ini, ganti string kosong.
 * 3. JANGAN isi dengan Service Account JSON / private key. File ini
 *    adalah config web publik (apiKey web BUKAN rahasia server), dan
 *    TIDAK boleh berisi private_key, client_email, atau secret apa pun.
 *
 * Perilaku bila masih kosong (seperti file ini):
 * chat + presence OTOMATIS fallback ke Netlify Functions lama
 * (polling 15 detik / heartbeat 2 menit). Game tidak rusak, hanya
 * belum hemat kredit. Begitu config terisi + RTDB dibuat + rules
 * dipasang, game otomatis pindah ke RTDB tanpa ubah kode lain.
 *
 * databaseURL WAJIB diisi: itu alamat Realtime Database, contoh:
 * https://extinct-survival-XXXXX-default-rtdb.asia-southeast1.firebasedatabase.app
 * (salin persis dari halaman Realtime Database di console).
 */
window.ES_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDC-wAXZFxg-tdJwCZdrJAkHzPNCkqLq-Q',
  authDomain: 'extinct-survival.firebaseapp.com',
  databaseURL: 'https://extinct-survival-default-rtdb.firebaseio.com',
  projectId: 'extinct-survival',
  storageBucket: 'extinct-survival.firebasestorage.app',
  messagingSenderId: '1054829104682',
  appId: '1:1054829104682:web:009ba9f22924d0c5007d53',
  measurementId: 'G-ZCCTEDQKZ7'
};
