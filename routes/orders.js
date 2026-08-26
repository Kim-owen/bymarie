const express = require('express');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');
const { calculateOrderTotalsServerSide } = require('../lib/pricing');
const { createOrder } = require('../lib/orders');

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

// Create new order directly -- for payment methods that don't need an
// external gateway round-trip: Cash on Delivery, or Float Wallet (verified
// and deducted server-side against the real stored balance). Card/mobile
// money orders go through /api/paystack/initialize -> Paystack's hosted
// checkout -> /api/paystack/confirm instead, which creates the order only
// after the payment is independently verified.
router.post('/orders', asyncHandler(async (req, res) => {
  const { name, email, phone, address, city, region, delivery, items, couponCode, payment, userId } = req.body;
  const paymentMethod = payment === 'wallet' ? 'wallet' : 'cod';

  try {
    const order = await createOrder({ name, email, phone, address, city, region, delivery, items, couponCode, paymentMethod, userId });
    res.status(201).json(order);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
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
