/**
 * Daftar paket Top Up (sumber kebenaran tunggal — di-fetch client lewat
 * fungsi topup-packages, jangan duplikasi angka ini di kode client).
 * Ubah harga/kredit di sini kalau mau menyesuaikan.
 */
const PACKAGES = [
  { id: 'starter', label: 'Starter', priceRupiah: 1000, kredit: 100, bonusLabel: '', playSku: 'kredit_starter' },
  { id: 'value', label: 'Value', priceRupiah: 2500, kredit: 275, bonusLabel: '+10% Bonus', playSku: 'kredit_value' },
  { id: 'popular', label: 'Popular', priceRupiah: 5000, kredit: 600, bonusLabel: '+20% Bonus', playSku: 'kredit_popular' },
  { id: 'best', label: 'Best Deal', priceRupiah: 10000, kredit: 1300, bonusLabel: '+30% Bonus', playSku: 'kredit_best' }
];
// v0.4.5: playSku = ID produk INAPP yang harus dibuat di Play Console
// (Play Console -> Monetize -> Products -> In-app products). Selama SKU asli
// belum dibuat, game otomatis memakai SKU uji bawaan Google
// (android.test.purchased) bila dijalankan di wrapper Play.

function getPackage(id) {
  return PACKAGES.find((p) => p.id === id) || null;
}

module.exports = { PACKAGES, getPackage };
