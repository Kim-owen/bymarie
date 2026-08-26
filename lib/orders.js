const collections = require('./collections');
const { calculateOrderTotalsServerSide } = require('./pricing');
const { sendAdminOrderNotifications } = require('./notify');

class PaymentError extends Error {
  constructor(message, status = 402) {
    super(message);
    this.status = status;
  }
}

// Single, authoritative order-creation path, used both by the direct
// checkout endpoint (Cash on Delivery, Float Wallet) and by the Paystack
// payment-completion flow (lib/paymentCompletion.js), so there is exactly
// one place that computes totals, moves money, decrements stock, and
// notifies -- not two divergent copies of that logic.
async function createOrder({ name, email, phone, address, city, region, delivery, items, couponCode, paymentMethod, userId, orderId, paymentReference }) {
  if (!name || !phone || !address) {
    const err = new Error('Missing required customer delivery information');
    err.status = 400;
    throw err;
  }

  const calculation = await calculateOrderTotalsServerSide(items, couponCode, delivery, city);

  let paymentLabel = 'Cash on Delivery';
  let chargedUser = null;
  let previousBalance = null;

  if (paymentMethod === 'wallet') {
    const users = await collections.users.list();
    const emailLower = (email || '').toLowerCase();
    chargedUser = users.find(u => (u.email && u.email.toLowerCase() === emailLower) || u.id === userId);
    if (!chargedUser) throw new PaymentError('No matching account was found to charge the Float Wallet.', 404);

    previousBalance = Number(chargedUser.walletBalance) || 0;
    if (previousBalance < calculation.total) {
      throw new PaymentError(`Insufficient Float Wallet balance (GH₵ ${previousBalance.toFixed(2)}) for this order (GH₵ ${calculation.total.toFixed(2)}).`);
    }

    // Deduct now, against the real server-side balance -- never a
    // client-reported number. Rolled back below if order insert fails.
    const newBalance = Number((previousBalance - calculation.total).toFixed(2));
    await collections.users.update(chargedUser.id, { walletBalance: newBalance });
    paymentLabel = 'ByMarie Float Wallet';
  } else if (paymentMethod === 'paystack') {
    paymentLabel = 'Paystack (Verified)';
  }

  const newOrder = {
    id: orderId || `BM-${Math.floor(100000 + Math.random() * 900000)}`,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    name: name.trim(),
    email: (email || '').trim(),
    phone: phone.trim(),
    address: address.trim(),
    city: (city || 'Accra').trim(),
    region: (region || 'Greater Accra').trim(),
    delivery: delivery || 'Standard Delivery',
    payment: paymentLabel,
    status: 'Processing',
    items: calculation.verifiedItems,
    subtotal: calculation.subtotal,
    discountAmount: calculation.discountAmount,
    deliveryFee: calculation.deliveryFee,
    total: calculation.total,
    appliedCoupon: calculation.appliedCoupon,
    securedServerSide: true,
    paymentReference: paymentReference || null
  };

  let savedOrder;
  try {
    savedOrder = await collections.orders.insert(newOrder);
  } catch (err) {
    // The order never landed -- refund the wallet deduction rather than
    // leaving the customer charged with nothing to show for it.
    if (chargedUser) {
      try {
        await collections.users.update(chargedUser.id, { walletBalance: previousBalance });
      } catch (rollbackErr) {
        console.error(`CRITICAL: failed to roll back Float Wallet deduction for user ${chargedUser.id} after a failed order insert:`, rollbackErr.message);
      }
    }
    throw err;
  }

  // Best-effort: an already-placed, already-paid order should not fail the
  // customer's request just because the stock write-back hiccups -- log
  // loudly instead of swallowing silently, so it's visible for reconciliation.
  try {
    await Promise.all(calculation.verifiedItems.map(async (item) => {
      const prod = await collections.products.get(item.id);
      if (prod && prod.stock !== undefined) {
        const newStock = Math.max(0, Number(prod.stock) - item.qty);
        await collections.products.update(item.id, { stock: newStock });
      }
    }));
  } catch (err) {
    console.error(`Stock write-back failed for order ${savedOrder.id}:`, err.message);
  }

  await sendAdminOrderNotifications(savedOrder);

  return savedOrder;
}

module.exports = { createOrder, PaymentError };
