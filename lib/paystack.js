const crypto = require('crypto');
const config = require('./config');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

async function paystackRequest(path, options = {}) {
  const secretKey = config.PAYSTACK_SECRET_KEY;
  const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;

  let response, data;
  try {
    response = await fetchFn(`${PAYSTACK_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    data = await response.json();
  } catch (err) {
    return { status: false, message: `Could not reach Paystack: ${err.message}` };
  }

  return data;
}

// Starts a transaction on Paystack's hosted checkout. The customer is
// redirected to `authorizationUrl` and enters card/mobile-money details
// entirely on Paystack's own page -- this server never sees raw card
// numbers, CVVs, or OTPs, and no client-side public key is required for
// this flow at all.
async function initializeTransaction({ email, amountGHS, reference, callbackUrl, metadata }) {
  const amount = Number(amountGHS);
  if (!email || !(amount > 0)) {
    return { ok: false, reason: 'A customer email and a positive amount are required' };
  }

  const result = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email).trim(),
      amount: Math.round(amount * 100),
      currency: 'GHS',
      reference,
      callback_url: callbackUrl,
      metadata: metadata || {}
    })
  });

  if (!result.status || !result.data) {
    return { ok: false, reason: result.message || 'Paystack declined to start this transaction' };
  }

  return {
    ok: true,
    authorizationUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    reference: result.data.reference
  };
}

// Authoritative, server-side verification. This is the ONLY thing that is
// ever allowed to decide a payment succeeded -- never a client-reported
// status, never a widget callback.
async function verifyTransaction(reference) {
  if (!reference) return { verified: false, reason: 'Missing transaction reference' };

  const result = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET'
  });

  if (!result.status || !result.data) {
    return { verified: false, reason: result.message || 'Paystack could not find this transaction' };
  }

  if (result.data.status !== 'success') {
    return { verified: false, reason: `Payment status: ${result.data.status}`, raw: result.data };
  }

  return {
    verified: true,
    amountGHS: Number(result.data.amount || 0) / 100,
    currency: result.data.currency || 'GHS',
    channel: result.data.channel,
    paidAt: result.data.paid_at,
    customerEmail: result.data.customer && result.data.customer.email,
    metadata: result.data.metadata || {},
    raw: result.data
  };
}

// Paystack signs webhook payloads with HMAC-SHA512 of the raw request body,
// using the secret key. Verifying this is what makes the webhook trustworthy
// as a server-to-server confirmation instead of an unauthenticated POST
// anyone could forge.
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) return false;
  const expected = crypto.createHmac('sha512', config.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signatureHeader, 'hex'));
  } catch (e) {
    return false;
  }
}

module.exports = { initializeTransaction, verifyTransaction, verifyWebhookSignature };
