// utils/response.js — DIPERBAIKI 22 Nov 2026: tambah CORS untuk Play Store (AppMint)
//
// Penyebab error "Failed to fetch" di versi Play Store:
// - Di web, game jalan di origin yang sama (extinct-survival.netlify.app),
//   jadi fetch ke /.netlify/functions/* tidak kena CORS.
// - Di AppMint, game jalan di WebView dengan origin berbeda (bukan netlify.app),
//   jadi browser wajib kirim preflight OPTIONS dulu.
// - Versi lama: tidak ada header Access-Control-Allow-Origin sama sekali,
//   dan OPTIONS dijawab 405 Method Not Allowed.
//   Hasilnya: browser memblokir fetch, dan game hanya menampilkan "Failed to fetch".
//
// Perbaikan: setiap respons JSON membawa header CORS, dan ada helper
// corsPreflight() yang harus dipanggil di awal setiap handler:
//   const pre = corsPreflight(event); if (pre) return pre;
function json(statusCode, data, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign(
      {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-password'
      },
      extraHeaders || {}
    ),
    body: JSON.stringify(data)
  };
}

function corsPreflight(event) {
  if (event && event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
        'Cache-Control': 'no-store'
      },
      body: ''
    };
  }
  return null;
}

module.exports = { json, corsPreflight };
