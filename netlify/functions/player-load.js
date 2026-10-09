const { json } = require('./utils/response');
const { getSaveStore } = require('./utils/save-store');

const CODE_RE = /^[A-Z2-9-]{8,64}$/;

exports.handler = async (event) => {
  const code = String(
    (event.queryStringParameters && event.queryStringParameters.code) || ''
  ).toUpperCase().trim();
  if (!CODE_RE.test(code)) return json(400, { error: 'Kode save tidak valid.' });

  const store = getSaveStore();
  const record = await store.get('player/' + code + '.json', { type: 'json' });
  if (!record || !record.data) return json(404, { error: 'Kode tidak ditemukan. Periksa lagi kode savemu.' });

  return json(200, { ok: true, data: record.data, updatedAt: record.updatedAt });
};
