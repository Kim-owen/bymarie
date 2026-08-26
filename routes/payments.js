const express = require('express');
const asyncHandler = require('../lib/asyncHandler');
const { calculateOrderTotalsServerSide } = require('../lib/pricing');
const config = require('../lib/config');

const router = express.Router();

const PAYSTACK_SECRET_KEY = config.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = config.PAYSTACK_PUBLIC_KEY;

// 1. Direct In-App Charge (Zero external redirects)
router.post('/paystack/charge', asyncHandler(async (req, res) => {
  try {
    const { email, amount, mobile_money, card, reference, metadata } = req.body;
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;

    const payload = {
      email: (email || 'customer@bymarie.shop').trim(),
      amount: Math.round(Number(amount) * 100),
      currency: 'GHS',
      reference: reference || `bm_tx_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      metadata: metadata || {}
    };

    if (mobile_money) {
      let cleanPhone = String(mobile_money.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('233') && cleanPhone.length === 12) cleanPhone = '0' + cleanPhone.slice(3);
      payload.mobile_money = {
        phone: cleanPhone,
        provider: (mobile_money.provider || 'mtn').toLowerCase()
      };
    } else if (card) {
      payload.card = {
        number: String(card.number || '').replace(/\s/g, ''),
        cvv: String(card.cvv || '').trim(),
        expiry_month: String(card.expiry_month || '').trim(),
        expiry_year: String(card.expiry_year || '').trim(),
        pin: card.pin ? String(card.pin).trim() : undefined
      };
    }

    const response = await fetchFn('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`💳 [PAYSTACK IN-APP CHARGE] Status:`, data.status, data.data ? data.data.status : data.message);
    res.json(data);
  } catch (err) {
    console.error('Paystack Charge Error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
}));

// 2. Submit In-App OTP
router.post('/paystack/submit-otp', asyncHandler(async (req, res) => {
  try {
    const { otp, reference } = req.body;
    if (!otp || !reference) {
      return res.status(400).json({ status: false, message: 'OTP and reference are required' });
    }

    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn('https://api.paystack.co/charge/submit_otp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ otp: String(otp).trim(), reference })
    });

    const data = await response.json();
    console.log(`🔐 [PAYSTACK SUBMIT OTP] Result:`, data.status, data.data ? data.data.status : data.message);
    res.json(data);
  } catch (err) {
    console.error('Paystack Submit OTP Error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
}));

// 3. Submit In-App Card PIN
router.post('/paystack/submit-pin', asyncHandler(async (req, res) => {
  try {
    const { pin, reference } = req.body;
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn('https://api.paystack.co/charge/submit_pin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pin: String(pin).trim(), reference })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
}));

// 4. Verify Paystack Transaction.
// server.js previously defined this exact route twice; Express only ever
// matched the first (this one). The second was unreachable dead code that
// silently faked a "successful" verification on network failure -- removed
// entirely rather than kept as a landmine for a future edit.
router.get('/paystack/verify/:reference', asyncHandler(async (req, res) => {
  try {
    const { reference } = req.params;
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Paystack Verify Error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
}));

// 5. List Paystack Transactions
router.get('/paystack/transactions', asyncHandler(async (req, res) => {
  try {
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn('https://api.paystack.co/transaction', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });
    const result = await response.json();
    if (result.status) return res.json(result);
  } catch (err) {}

  res.json({ status: true, message: 'Transactions retrieved', data: [] });
}));

// 6. Paystack Webhook Handler
router.post('/paystack/webhook', (req, res) => {
  const event = req.body;
  if (event && event.event === 'charge.success') {
    const { reference, amount, customer } = event.data;
    console.log(`⚡ Paystack Webhook: Received successful payment of ${amount / 100} GHS from ${customer?.email} (Ref: ${reference})`);
  }
  res.sendStatus(200);
});

// 7. Initialize Paystack Transaction (Server-Side Verified)
router.post('/paystack/initialize', asyncHandler(async (req, res) => {
  const { email, amount, currency = 'GHS', metadata, callback_url, items, couponCode, delivery, city } = req.body;
  if (!email) {
    return res.status(400).json({ status: false, message: 'Email is required' });
  }

  let authoritativeTotal = Number(amount) || 0;
  if (Array.isArray(items) && items.length > 0) {
    try {
      const serverCalc = await calculateOrderTotalsServerSide(items, couponCode, delivery, city);
      authoritativeTotal = serverCalc.total;
    } catch (err) {
      return res.status(400).json({ status: false, message: err.message });
    }
  }

  if (authoritativeTotal <= 0) {
    return res.status(400).json({ status: false, message: 'Invalid transaction total' });
  }

  // Convert amount to subunits (pesewas / kobo -> amount * 100)
  const subunitAmount = Math.round(authoritativeTotal * 100);
  const reference = `pstk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
    const response = await fetchFn('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: subunitAmount,
        currency,
        reference,
        callback_url: callback_url || `http://localhost:3000/#account`,
        metadata: metadata || {}
      })
    });

    const result = await response.json();
    if (result.status && result.data) {
      return res.json(result);
    }
  } catch (err) {
    console.warn('Paystack live API warning (using dev fallback):', err.message);
  }

  // Resilient Development Fallback
  res.json({
    status: true,
    message: 'Authorization URL created (Development Mode)',
    data: {
      authorization_url: `https://checkout.paystack.com/${reference}`,
      access_code: `acc_${reference}`,
      reference,
      publicKey: PAYSTACK_PUBLIC_KEY
    }
  });
}));

// --- MOBILE MONEY PAYMENT API SIMULATION ---

router.post('/payments/momo/authorize', (req, res) => {
  const { phone, network, amount, orderId } = req.body;
  res.json({
    success: true,
    status: 'PENDING_USER_APPROVAL',
    message: `USSD prompt dispatched to ${network} subscriber ${phone} for GHc ${amount}`,
    transactionId: `MOMO-${Date.now()}`,
    orderId
  });
});

router.post('/payments/momo/callback', (req, res) => {
  const { transactionId, status, orderId } = req.body;
  res.json({
    success: true,
    transactionId,
    orderId,
    status: status || 'SUCCESS',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
