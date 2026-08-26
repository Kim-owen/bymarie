const express = require('express');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get('/wholesale', asyncHandler(async (req, res) => {
  const inquiries = await collections.wholesale.list();
  res.json(inquiries);
}));

router.post('/wholesale', asyncHandler(async (req, res) => {
  const newInquiry = {
    id: req.body.id || `WS-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    company: req.body.company || 'Direct Wholesale Client',
    contact: req.body.contact || 'Store Buyer',
    phone: req.body.phone || '',
    email: req.body.email || '',
    city: req.body.city || 'Accra, Ghana',
    volume: req.body.volume || '50 – 100 units',
    notes: req.body.notes || 'Standard bulk purchase inquiry',
    status: 'New'
  };
  const saved = await collections.wholesale.insert(newInquiry);
  res.status(201).json(saved);
}));

router.patch('/wholesale/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  const existing = await collections.wholesale.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Wholesale inquiry not found' });

  const updated = await collections.wholesale.update(req.params.id, { status: status || existing.status });
  res.json(updated);
}));

router.delete('/wholesale/:id', asyncHandler(async (req, res) => {
  await collections.wholesale.remove(req.params.id);
  res.json({ success: true, id: req.params.id });
}));

module.exports = router;
