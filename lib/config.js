const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PORT = process.env.PORT || 5000;
const isVercel = !!process.env.VERCEL;

const UPLOADS_DIR = isVercel ? '/tmp/uploads' : path.join(ROOT_DIR, 'uploads');
const DATA_DIR = isVercel ? '/tmp/data' : path.join(ROOT_DIR, 'data');
const DB_FILE = isVercel ? '/tmp/data/db.json' : path.join(DATA_DIR, 'db.json');
const SEED_DB_FILE = path.join(ROOT_DIR, 'data', 'db.json');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'adichieifeoma@gmail.com').trim();
const ADMIN_PHONE = (process.env.ADMIN_PHONE || '+233241002000').trim();

// Known operator accounts that are always treated as Super Admin, plus whatever
// email is configured via ADMIN_EMAIL. Centralized here so every route checks
// the same list instead of each re-declaring it.
const ADMIN_EMAILS = [
  'sunumanfred14@gmail.com',
  'adichieifeoma@gmail.com',
  (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
].filter(Boolean);

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

const PAYSTACK_SECRET_KEY = (process.env.PAYSTACK_SECRET_KEY || 'paystack_secret_key_demo').trim();
const PAYSTACK_PUBLIC_KEY = (process.env.PAYSTACK_PUBLIC_KEY || 'paystack_public_key_demo').trim();

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'ByMarie Orders <concierge@bymarie.shop>';

const MNOTIFY_API_KEY = process.env.MNOTIFY_API_KEY || process.env.BMS_API_KEY || '';
const MNOTIFY_SENDER = process.env.MNOTIFY_SENDER || 'Bymarie';

module.exports = {
  ROOT_DIR,
  PORT,
  isVercel,
  UPLOADS_DIR,
  DATA_DIR,
  DB_FILE,
  SEED_DB_FILE,
  ADMIN_EMAIL,
  ADMIN_PHONE,
  ADMIN_EMAILS,
  isAdminEmail,
  PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC_KEY,
  RESEND_API_KEY,
  RESEND_FROM_EMAIL,
  MNOTIFY_API_KEY,
  MNOTIFY_SENDER
};
