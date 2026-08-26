const { createCollection, createSingleton } = require('./store');

// One instance per domain, shared by every route module -- this is the only
// place table/idField mappings are declared.
module.exports = {
  products: createCollection('products', { idField: 'id' }),
  orders: createCollection('orders', { idField: 'id' }),
  coupons: createCollection('coupons', { idField: 'code' }),
  users: createCollection('users', { idField: 'id' }),
  notifications: createCollection('notifications', { idField: 'id' }),
  campaigns: createCollection('campaigns', { idField: 'id' }),
  wholesale: createCollection('wholesale_inquiries', { idField: 'id', jsonKey: 'wholesale_inquiries' }),
  walletTransactions: createCollection('wallet_transactions', { idField: 'reference', jsonKey: 'wallet_transactions' }),
  settings: createSingleton('site_settings')
};
