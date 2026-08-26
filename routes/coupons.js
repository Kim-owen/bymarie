const express = require('express');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get('/coupons', asyncHandler(async (req, res) => {
  const coupons = await collections.coupons.list();
  res.json(coupons);
}));

router.post('/coupons', asyncHandler(async (req, res) => {
  const newCoupon = {
    code: (req.body.code || '').toUpperCase().trim(),
    discount: Number(req.body.discount || 0),
    type: req.body.type || 'percent',
    label: req.body.label || ''
  };
  const saved = await collections.coupons.upsert(newCoupon);
  res.status(201).json(saved);
}));

router.delete('/coupons/:code', asyncHandler(async (req, res) => {
  await collections.coupons.remove(String(req.params.code).toUpperCase());
  res.json({ success: true, code: req.params.code });
}));

module.exports = router;
