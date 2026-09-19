/**
 * Helper kecil untuk membalas response JSON yang konsisten dari semua
 * Netlify Function di sistem topup ini.
 */
function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(data)
  };
}

module.exports = { json };
