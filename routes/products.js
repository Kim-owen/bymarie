const express = require('express');
const collections = require('../lib/collections');
const { filterVisibleProducts } = require('../lib/productVisibility');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

// Get all products (with category, search & price filtering) -- applied
// consistently regardless of whether data came from Supabase or the local
// fallback (previously these filters only ran on the fallback path).
router.get('/products', asyncHandler(async (req, res) => {
  const all = await collections.products.list();
  let list = filterVisibleProducts(all);

  const { cat, search, maxPrice } = req.query;
  if (cat && cat !== 'All') {
    list = list.filter(p => p.category.toLowerCase() === cat.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => `${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(q));
  }
  if (maxPrice) {
    list = list.filter(p => p.price <= Number(maxPrice));
  }

  res.json(list);
}));

// Get single product
router.get('/products/:id', asyncHandler(async (req, res) => {
  const prod = await collections.products.get(req.params.id);
  if (!prod || filterVisibleProducts([prod]).length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(prod);
}));

// Create product package
router.post('/products', asyncHandler(async (req, res) => {
  const newProduct = {
    id: req.body.id || `bm-piece-${Date.now()}`,
    isCustom: true,
    name: req.body.name || 'New Piece',
    category: req.body.category || 'Clothing',
    price: Number(req.body.price || 0),
    old: Number(req.body.old || 0),
    stock: Number(req.body.stock || 10),
    tag: req.body.tag || '',
    image: req.body.image || '',
    images: req.body.images || [req.body.image].filter(Boolean),
    desc: req.body.desc || '',
    details: req.body.details || [],
    colors: req.body.colors || ['Standard'],
    sizes: req.body.sizes || [],
    rating: req.body.rating || 5.0,
    reviews: req.body.reviews || []
  };

  const saved = await collections.products.upsert(newProduct);
  res.status(201).json(saved);
}));

// Update product
router.put('/products/:id', asyncHandler(async (req, res) => {
  const existing = await collections.products.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const updated = { ...existing, ...req.body, id: req.params.id };
  const saved = await collections.products.upsert(updated);
  res.json(saved);
}));

// Delete product
router.delete('/products/:id', asyncHandler(async (req, res) => {
  await collections.products.remove(req.params.id);
  res.json({ success: true, id: req.params.id });
}));

module.exports = router;
