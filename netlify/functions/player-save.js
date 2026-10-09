const { json } = require('./utils/response');
const { getSaveStore } = require('./utils/save-store');

const MAX_BYTES = 512 * 1024; // 512 KB — cukup untuk save JSON game ini
const CODE_RE = /^[A-Z2-9-]{8,64}$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Body tidak valid.' });
  }

  const code = String(payload.code || '').toUpperCase().trim();
  if (!CODE_RE.test(code)) return json(400, { error: 'Kode save tidak valid.' });

  const data = payload.data;
  if (!data || typeof data !== 'object' || !data.save || !data.save.player) {
    return json(400, { error: 'Data save tidak valid.' });
  }
  if (JSON.stringify(data).length > MAX_BYTES) {
    return json(413, { error: 'Data save terlalu besar (maks 512 KB).' });
  }

  const store = getSaveStore();
  const record = {
    data: data,
    updatedAt: Date.now(),
    appVersion: data.appVersion || null
  };
  await store.setJSON('player/' + code + '.json', record);

  return json(200, { ok: true, updatedAt: record.updatedAt });
};
