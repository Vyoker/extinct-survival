const { getStore } = require('@netlify/blobs');
const { isAdminAuthorized } = require('./utils/auth');
const { json } = require('./utils/response');

exports.handler = async (event) => {
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });

  const store = getStore('topup');
  const { blobs } = await store.list({ prefix: 'order:' });

  const orders = [];
  for (const b of blobs) {
    const order = await store.get(b.key, { type: 'json' });
    if (order) orders.push(order);
  }
  orders.sort((a, b) => b.createdAt - a.createdAt);

  return json(200, { orders: orders.slice(0, 300) });
};
