const collections = require('./collections');
const { verifyTransaction } = require('./paystack');
const { createOrder } = require('./orders');
const { formatPhoneForGhana } = require('./phone');
const config = require('./config');

function isDuplicateKeyError(err) {
  const code = err && err.cause && err.cause.code;
  const message = String((err && err.message) || '').toLowerCase();
  return code === '23505' || message.includes('duplicate key');
}

async function creditWalletTopup(verification) {
  const { reference, amountGHS, currency, channel, raw, metadata } = verification;

  const existingTx = await collections.walletTransactions.get(reference);
  if (existingTx) {
    const users = await collections.users.list();
    const existingUser = users.find(u => u.id === existingTx.userId || (u.email && existingTx.email && u.email.toLowerCase() === existingTx.email.toLowerCase()));
    return { alreadyProcessed: true, balance: existingUser ? existingUser.walletBalance : undefined, user: existingUser || null };
  }

  const { userId, email, name, phone } = metadata || {};
  const users = await collections.users.list();
  const emailLower = (email || '').toLowerCase();
  let user = users.find(u => (u.email && u.email.toLowerCase() === emailLower) || u.id === userId);

  if (user) {
    user = { ...user, walletBalance: Number(((Number(user.walletBalance) || 0) + amountGHS).toFixed(2)) };
  } else {
    user = {
      id: userId || `usr-${Date.now()}`,
      name: name || 'Valued Member',
      email: email || '',
      phone: phone || '',
      walletBalance: amountGHS,
      joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      ordersCount: 0,
      status: 'Active'
    };
  }

  const savedUser = await collections.users.upsert(user, { conflict: 'email' });

  try {
    await collections.walletTransactions.insert({
      reference,
      userId: savedUser.id,
      email: savedUser.email,
      amount: amountGHS,
      currency,
      status: 'success',
      paymentMethod: channel || 'Paystack',
      rawGatewayResponse: raw
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    console.warn(`Wallet transaction ${reference} was already recorded by a concurrent request.`);
  }

  try {
    await collections.notifications.insert({
      id: `notif-${Date.now()}`,
      type: 'wallet',
      title: `💳 Float Wallet Top-Up: GH₵ ${amountGHS.toFixed(2)}`,
      message: `${savedUser.name} deposited GH₵ ${amountGHS.toFixed(2)} via Paystack (${channel || 'verified'}). Reference: ${reference}.`,
      date: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' • Today',
      target: 'admin',
      read: false
    });
  } catch (e) {
    console.warn('Wallet deposit notification record could not be saved:', e.message);
  }

  try {
    const mnotifyKey = config.MNOTIFY_API_KEY;
    if (mnotifyKey) {
      const fetchFn = typeof fetch !== 'undefined' ? fetch : global.fetch;
      const custPhone = formatPhoneForGhana(savedUser.phone || phone);
      if (custPhone && custPhone.length >= 10) {
        await fetchFn(`https://api.mnotify.com/api/sms/quick?key=${mnotifyKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: [custPhone],
            sender: config.MNOTIFY_SENDER,
            message: `ByMarie: Your Float Wallet has been credited with GH₵ ${amountGHS.toFixed(2)}! New available balance: GH₵ ${Number(savedUser.walletBalance).toFixed(2)}.`,
            is_schedule: false,
            schedule_date: ''
          })
        });
      }
    }
  } catch (err) {
    console.warn('Wallet deposit SMS dispatch note:', err.message);
  }

  return { alreadyProcessed: false, balance: savedUser.walletBalance, user: savedUser };
}

async function completeOrderPayment(verification) {
  const { reference, metadata } = verification;

  const existing = await collections.orders.findOne('paymentReference', reference);
  if (existing) {
    return { alreadyProcessed: true, order: existing };
  }

  const order = await createOrder({
    ...(metadata.orderInput || {}),
    paymentMethod: 'paystack',
    paymentReference: reference
  });

  return { alreadyProcessed: false, order };
}

// The single entry point for turning a Paystack reference into a completed
// wallet credit or a created order. Called from two places -- the webhook
// (the authoritative, server-to-server path) and the endpoint the frontend
// calls right after the customer is redirected back -- and safe to call
// more than once for the same reference (both paths above are idempotent).
async function completePaystackTransaction(reference) {
  const verification = await verifyTransaction(reference);
  if (!verification.verified) {
    return { success: false, reason: verification.reason };
  }
  verification.reference = reference;

  const purpose = verification.metadata && verification.metadata.purpose;

  if (purpose === 'wallet_topup') {
    const result = await creditWalletTopup(verification);
    return { success: true, purpose, ...result };
  }

  if (purpose === 'order') {
    const result = await completeOrderPayment(verification);
    return { success: true, purpose, ...result };
  }

  return { success: false, reason: `Unrecognized payment purpose: ${purpose || '(none)'}` };
}

module.exports = { completePaystackTransaction };
