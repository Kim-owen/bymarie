const express = require('express');
const collections = require('../lib/collections');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get('/settings', asyncHandler(async (req, res) => {
  const data = await collections.settings.get();
  if (!data) return res.json({});
  res.json({
    ...data,
    heroMediaType: data.heroMediaType || 'video',
    heroVideos: data.heroVideos || [],
    heroVideoInterval: data.heroVideoInterval || 30,
    categoryCovers: data.categoryCovers || {}
  });
}));

router.post('/settings', asyncHandler(async (req, res) => {
  const existing = await collections.settings.get();
  const merged = { ...(existing || {}), ...req.body };
  delete merged.id; // the singleton row's id is always 1, never part of the patch body

  const saved = await collections.settings.upsert(merged);
  res.json(saved);
}));

module.exports = router;
