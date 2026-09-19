const { json } = require('./utils/response');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return json(500, { error: 'ADMIN_PASSWORD belum diset di Environment Variables Netlify.' });
  }
  if (payload.password === expected) return json(200, { ok: true });
  return json(401, { ok: false, error: 'Password salah.' });
};
