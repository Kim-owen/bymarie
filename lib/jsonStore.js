const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR, DATA_DIR, DB_FILE, SEED_DB_FILE, isVercel } = require('./config');

try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.warn('Directory init warning:', e.message);
}

// Local-dev-only fallback store, used only when Supabase is not configured
// (see lib/supabaseClient.js#isSupabaseConfigured). On Vercel this file lives
// under /tmp, which is ephemeral per serverless instance -- never treat it as
// durable storage once Supabase is configured.
function readDB() {
  try {
    if (isVercel && !fs.existsSync(DB_FILE) && fs.existsSync(SEED_DB_FILE)) {
      try {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        fs.copyFileSync(SEED_DB_FILE, DB_FILE);
      } catch (e) {}
    }
    const targetFile = fs.existsSync(DB_FILE) ? DB_FILE : (fs.existsSync(SEED_DB_FILE) ? SEED_DB_FILE : null);
    if (!targetFile) return { products: [], orders: [], coupons: [], site_settings: {} };
    const content = fs.readFileSync(targetFile, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading JSON DB:', err);
    return { products: [], orders: [], coupons: [], site_settings: {} };
  }
}

function writeDB(data) {
  try {
    if (fs.existsSync(path.dirname(DB_FILE))) {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error writing JSON DB:', err);
  }
}

module.exports = { readDB, writeDB };
