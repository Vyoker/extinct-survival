const { isAdminAuthorized } = require('./utils/auth');
const { json, corsPreflight } = require('./utils/response');
const { getTopupStore } = require('./utils/blob-store');

exports.handler = async (event) => {
  const pre = corsPreflight(event);
  if (pre) return pre;
  if (!isAdminAuthorized(event)) return json(401, { error: 'Unauthorized' });

  const store = getTopupStore();
  const { blobs } = await store.list({ prefix: 'order:' });

  const orders = [];
  for (const b of blobs) {
    const order = await store.get(b.key, { type: 'json' });
    if (order) orders.push(order);
  }
  orders.sort((a, b) => b.createdAt - a.createdAt);

  return json(200, { orders: orders.slice(0, 300) });
};
