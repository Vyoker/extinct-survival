/**
 * credit-pending.js (v0.3.3) — Game mengambil kiriman kredit manual
 * yang belum diklaim untuk kode save-nya.
 * GET ?who=<KODE> -> { grants: [...] } (hanya yang claimed:false)
 * Publik (tanpa auth admin): kode 16 karakter tidak bisa ditebak,
 * dan grant memang ditujukan untuk pemilik kode tersebut.
 */
const { json } = require('./utils/response');
const { getCreditStore } = require('./utils/blob-store');
const { normCode, isValidCode } = require('./utils/credit');

exports.handler = async (event) => {
  const code = normCode(event.queryStringParameters && event.queryStringParameters.who);
  if (!isValidCode(code)) return json(200, { grants: [] });

  const store = getCreditStore();
  const grants = (await store.get('grant:' + code, { type: 'json' })) || [];
  return json(200, { grants: grants.filter(function (g) { return !g.claimed; }) });
};
