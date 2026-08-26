const express = require('express');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');
const { calculateOrderTotalsServerSide } = require('../lib/pricing');
const { sendAdminOrderNotifications } = require('../lib/notify');

const router = express.Router();

// Get all orders
router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await collections.orders.list();
  res.json(orders);
}));

// Quote calculation endpoint (Returns server-calculated price verification)
router.post('/orders/quote', asyncHandler(async (req, res) => {
  try {
    const { items, couponCode, delivery, city } = req.body;
    const calc = await calculateOrderTotalsServerSide(items, couponCode, delivery, city);
    res.json({ success: true, ...calc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

// Create new order (Protected with 100% Server-Side Price Calculation & Multi-Channel Notifications)
router.post('/orders', asyncHandler(async (req, res) => {
  const { name, email, phone, address, city, region, delivery, payment, items, couponCode } = req.body;

  if (!name || !phone || !address) {
    return res.status(400).json({ error: 'Missing required customer delivery information' });
  }

  // SERVER-SIDE PRICE CALCULATION (Zero trust on client-sent prices/totals)
  let calculation;
  try {
    calculation = await calculateOrderTotalsServerSide(items, couponCode, delivery, city);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const newOrder = {
    id: req.body.id || `BM-${Math.floor(100000 + Math.random() * 900000)}`,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    name: name.trim(),
    email: (email || '').trim(),
    phone: phone.trim(),
    address: address.trim(),
    city: (city || 'Accra').trim(),
    region: (region || 'Greater Accra').trim(),
    delivery: delivery || 'Standard Delivery',
    payment: payment || 'Mobile Money',
    status: 'Processing',
    items: calculation.verifiedItems,
    subtotal: calculation.subtotal,
    discountAmount: calculation.discountAmount,
    deliveryFee: calculation.deliveryFee,
    total: calculation.total,
    appliedCoupon: calculation.appliedCoupon,
    securedServerSide: true
  };

  // This is the critical write -- let it throw (-> asyncHandler -> 500) if
  // the database is unreachable, instead of returning 201 for an order that
  // never actually landed anywhere durable.
  const savedOrder = await collections.orders.insert(newOrder);

  // Deduct inventory stock and write it back to the same store the order was
  // validated against, so Supabase stock never drifts from local state.
  // Best-effort: an already-placed order should not fail the customer's
  // request just because the follow-up stock sync hiccups -- log loudly
  // instead of swallowing silently, so it's visible for manual reconciliation.
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

  // Trigger Admin Multi-Channel Notifications (Dashboard, SMS & Email) -- this
  // already handles its own errors internally and never blocks the response.
  await sendAdminOrderNotifications(savedOrder);

  res.status(201).json(savedOrder);
}));

// Update order status
router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  const updated = await collections.orders.update(req.params.id, { status });
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json(updated);
}));

module.exports = router;
