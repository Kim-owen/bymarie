const crypto = require('crypto');

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 1000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, storedHash, salt) {
  if (!storedHash || !salt) return false;
  try {
    const hash = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sanitizeUser(u) {
  if (!u) return null;
  const safe = { ...u };
  delete safe.passwordHash;
  delete safe.salt;
  return safe;
}

// In-memory OTP store (10-minute expiry). Deliberately not persisted to the
// database -- OTPs are short-lived and single-process-instance is fine for
// this app's traffic; this was never part of the sync problem being fixed.
const otpStore = new Map();

module.exports = {
  generateSalt,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  sanitizeUser,
  otpStore
};
