/**
 * Daftar paket Top Up (sumber kebenaran tunggal — di-fetch client lewat
 * fungsi topup-packages, jangan duplikasi angka ini di kode client).
 * Ubah harga/kredit di sini kalau mau menyesuaikan.
 */
const PACKAGES = [
  { id: 'starter', label: 'Starter', priceRupiah: 1000, kredit: 100, bonusLabel: '', playSku: 'kredit_starter', playPriceRupiah: 3000, playKredit: 275, playBonusLabel: '' },
  { id: 'value', label: 'Value', priceRupiah: 2500, kredit: 275, bonusLabel: '+10% Bonus', playSku: 'kredit_value', playPriceRupiah: 5000, playKredit: 600, playBonusLabel: '+20% Bonus' },
  { id: 'popular', label: 'Popular', priceRupiah: 5000, kredit: 600, bonusLabel: '+20% Bonus', playSku: 'kredit_popular', playPriceRupiah: 10000, playKredit: 1300, playBonusLabel: '+30% Bonus' },
  { id: 'best', label: 'Best Deal', priceRupiah: 10000, kredit: 1300, bonusLabel: '+30% Bonus', playSku: 'kredit_best', playPriceRupiah: 15000, playKredit: 1950, playBonusLabel: '+30% Bonus' }
];
// v0.4.5: playSku = ID produk INAPP yang harus dibuat di Play Console
// (Play Console -> Monetize -> Products -> In-app products). Selama SKU asli
// belum dibuat, game otomatis memakai SKU uji bawaan Google
// (android.test.purchased) bila dijalankan di wrapper Play.
// Tangga Play (playPriceRupiah/playKredit) = "Opsi 2" keputusan user
// 2026-10-21: tangga QRIS digeser satu tingkat ke atas karena harga minimum
// in-app Indonesia Rp 3.000 dan potongan Google 15%. Harga aktual diatur di
// Play Console; playPriceRupiah hanya label cadangan di client.

function getPackage(id) {
  return PACKAGES.find((p) => p.id === id) || null;
}

module.exports = { PACKAGES, getPackage };
