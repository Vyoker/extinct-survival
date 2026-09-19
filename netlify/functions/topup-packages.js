const { PACKAGES } = require('./utils/packages');
const { json } = require('./utils/response');

exports.handler = async () => {
  return json(200, { packages: PACKAGES });
};
