const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { calculateOrderTotalsServerSide } = require('../lib/pricing');
const paystack = require('../lib/paystack');
const { completePaystackTransaction } = require('../lib/paymentCompletion');

const router = express.Router();

// Starts a Paystack transaction for either a cart checkout ("order") or a
// Float Wallet top-up ("wallet_topup"). The amount is always computed or
// validated server-side -- never taken as-is from the client -- and the
// full order input (or wallet credit target) is stashed in Paystack's
// metadata, to be read back and acted on only after the payment is
// independently verified.
router.post('/paystack/initialize', asyncHandler(async (req, res) => {
  const { purpose, email } = req.body;
  if (!email) return res.status(400).json({ status: false, message: 'Email is required' });
  if (purpose !== 'order' && purpose !== 'wallet_topup') {
    return res.status(400).json({ status: false, message: 'purpose must be "order" or "wallet_topup"' });
  }

  let amountGHS;
  let metadata;

  if (purpose === 'order') {
    const { name, phone, address, city, region, delivery, items, couponCode } = req.body;
    if (!name || !phone || !address) {
      return res.status(400).json({ status: false, message: 'Missing required customer delivery information' });
    }

    let calculation;
    try {
      calculation = await calculateOrderTotalsServerSide(items, couponCode, delivery, city);
    } catch (err) {
      return res.status(400).json({ status: false, message: err.message });
    }

    amountGHS = calculation.total;
    metadata = {
      purpose: 'order',
      orderInput: { name, email, phone, address, city, region, delivery, items, couponCode }
    };
  } else {
    const { amountGHS: requestedAmount, userId, name, phone } = req.body;
    amountGHS = Number(requestedAmount);
    if (!(amountGHS >= 5)) {
      return res.status(400).json({ status: false, message: 'Minimum top-up amount is GH₵ 5' });
    }
    metadata = { purpose: 'wallet_topup', userId, email, name, phone };
  }

  const reference = `bm_${purpose === 'order' ? 'ord' : 'topup'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${origin}/?paystack_ref=${reference}`;

  const result = await paystack.initializeTransaction({ email, amountGHS, reference, callbackUrl, metadata });
  if (!result.ok) {
    return res.status(502).json({ status: false, message: result.reason });
  }

  res.json({ status: true, authorizationUrl: result.authorizationUrl, reference: result.reference });
}));

// Read-only status check, for UI display/polling only -- never credits or
// creates anything. Completion only ever happens through /confirm or the
// webhook, both of which route through the same idempotent function.
router.get('/paystack/verify/:reference', asyncHandler(async (req, res) => {
  const verification = await paystack.verifyTransaction(req.params.reference);
  res.json({
    status: verification.verified,
    message: verification.verified ? 'Verification successful' : verification.reason,
    data: verification.raw || null
  });
}));

// Called by the frontend right after the customer is redirected back from
// Paystack's hosted checkout. Safe to call more than once (idempotent) and
// safe to race with the webhook -- whichever arrives first completes it.
router.post('/paystack/confirm', asyncHandler(async (req, res) => {
  const { reference } = req.body;
  if (!reference) return res.status(400).json({ success: false, message: 'A payment reference is required' });

  const result = await completePaystackTransaction(reference);
  if (!result.success) {
    return res.status(402).json(result);
  }
  res.json(result);
}));

// Server-to-server confirmation -- the authoritative path in production,
// independent of whether the customer's browser makes it back to /confirm.
// Requires server.js to capture the raw request body (req.rawBody) so the
// HMAC-SHA512 signature can be verified against exactly what Paystack sent.
router.post('/paystack/webhook', asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const isValid = paystack.verifyWebhookSignature(req.rawBody, signature);

  if (!isValid) {
    console.warn('⚠️ Paystack webhook: signature verification failed, rejecting.');
    return res.sendStatus(401);
  }

  const event = req.body;
  if (event && event.event === 'charge.success' && event.data && event.data.reference) {
    try {
      const result = await completePaystackTransaction(event.data.reference);
      if (!result.success) {
        console.warn(`Paystack webhook: could not complete ${event.data.reference}: ${result.reason}`);
      }
    } catch (err) {
      console.error(`Paystack webhook: error completing ${event.data.reference}:`, err.message);
    }
  }

  // Acknowledge quickly regardless of outcome so Paystack doesn't retry-storm
  // this endpoint; failures above are logged for investigation.
  res.sendStatus(200);
}));

module.exports = router;
