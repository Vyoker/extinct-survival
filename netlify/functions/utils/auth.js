/**
 * Autentikasi admin sederhana (shared secret), cukup untuk 1 developer.
 * Password dikirim client lewat header x-admin-password, dibandingkan
 * langsung ke environment variable ADMIN_PASSWORD (diset di Netlify
 * dashboard, JANGAN di-commit ke git).
 */
function isAdminAuthorized(event) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // belum diset -> tolak semua akses admin demi aman
  const provided = event.headers && (event.headers['x-admin-password'] || event.headers['X-Admin-Password']);
  return !!provided && provided === expected;
}

module.exports = { isAdminAuthorized };
