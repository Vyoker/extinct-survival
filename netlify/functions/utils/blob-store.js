const { getStore } = require('@netlify/blobs');

function getTopupStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'topup', siteID, token });
  }
  return getStore('topup');
}

module.exports = { getTopupStore };
