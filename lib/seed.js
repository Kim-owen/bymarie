const { getSupabaseClient } = require('./supabaseClient');
const { readDB } = require('./jsonStore');

// Seeds Supabase's products/coupons tables from the local JSON fallback file
// the first time it finds the products table empty. Only ever a startup
// convenience for local development -- once real data exists in Supabase
// this is a no-op.
async function autoSeedSupabase() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data: existingProds } = await client.from('products').select('id');
    const db = readDB();
    if (!existingProds || existingProds.length === 0) {
      if (db.products && db.products.length) {
        console.log('Seeding initial products to Supabase Cloud...');
        await client.from('products').upsert(db.products);
      }
      if (db.coupons && db.coupons.length) {
        await client.from('coupons').upsert(db.coupons);
      }
    }

    const { data: existingUsers } = await client.from('users').select('id');
    if (!existingUsers || existingUsers.length === 0) {
      if (db.users && db.users.length) {
        console.log('Seeding initial users to Supabase Cloud...');
        await client.from('users').upsert(db.users, { onConflict: 'email' });
      }
    }
    console.log('⚡ Supabase Auto-Seeding Verified!');
  } catch (err) {
    console.warn('Supabase auto-seed note:', err.message);
  }
}

module.exports = { autoSeedSupabase };
