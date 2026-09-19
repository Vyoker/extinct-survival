const crypto = require('crypto');

// Tanpa 0/O/1/I biar tidak ambigu saat dibaca/diketik ulang manual.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateOrderCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return 'AS-' + code;
}

module.exports = { generateOrderCode };
