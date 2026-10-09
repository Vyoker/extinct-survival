/**
 * Helper kirim kredit manual (v0.3.3).
 * Grant di-key berdasarkan kode save cloud player (16 karakter acak,
 * tidak bisa ditebak) — bukan nama — supaya tidak bisa diintip/diklaim
 * orang lain.
 */
var CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/;

// Normalisasi: buang strip/spasi, uppercase. "ab12-cd34-..." -> "AB12CD34..."
function normCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isValidCode(norm) {
  return CODE_RE.test(norm);
}

// Format cantik untuk ditampilkan: "AB12CD34EF56GH78" -> "AB12-CD34-EF56-GH78"
function fmtCode(norm) {
  return norm.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

module.exports = { normCode, isValidCode, fmtCode };
