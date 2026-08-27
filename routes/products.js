const express = require('express');
const collections = require('../lib/collections');
const { filterVisibleProducts } = require('../lib/productVisibility');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

/**
 * 1. GET /api/products
 * Retrieves all catalog products with optional category, search, and maxPrice filters.
 */
router.get('/products', asyncHandler(async (req, res) => {
  const all = await collections.products.list();
  let list = filterVisibleProducts(all);

  const { cat, search, maxPrice } = req.query;
  if (cat && cat !== 'All') {
    list = list.filter(p => p.category && p.category.toLowerCase() === cat.toLowerCase());
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => `${p.name || ''} ${p.category || ''} ${p.desc || ''}`.toLowerCase().includes(q));
  }
  if (maxPrice) {
    list = list.filter(p => Number(p.price) <= Number(maxPrice));
  }

  res.json(list);
}));

/**
 * 2. GET /api/products/:id
 * Retrieves single product by ID.
 */
router.get('/products/:id', asyncHandler(async (req, res) => {
  const prod = await collections.products.get(req.params.id);
  if (!prod) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(prod);
}));

/**
 * 3. POST /api/products
 * Creates a new product package in local disk store & Supabase Cloud.
 */
router.post('/products', asyncHandler(async (req, res) => {
  const { name, category, price, old, stock, tag, image, images, desc, details, colors, sizes, rating } = req.body;
  
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Product name and price are required' });
  }

  const newProduct = {
    id: req.body.id || `bm-prod-${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    isCustom: true,
    adminCreated: true,
    name: String(name).trim(),
    category: String(category || 'Clothing').trim(),
    price: Number(price || 0),
    old: Number(old || 0),
    stock: Number(stock !== undefined ? stock : 15),
    tag: String(tag || '').trim(),
    image: String(image || (Array.isArray(images) && images[0]) || '').trim(),
    images: Array.isArray(images) && images.length ? images : [image].filter(Boolean),
    desc: String(desc || '').trim(),
    details: Array.isArray(details) ? details : ['High grade craftsmanship', 'Guaranteed authentic'],
    colors: Array.isArray(colors) && colors.length ? colors : ['Standard'],
    sizes: Array.isArray(sizes) ? sizes : [],
    rating: Number(rating || 5.0),
    createdAt: new Date().toISOString()
  };

  const saved = await collections.products.upsert(newProduct);
  res.status(201).json(saved);
}));

/**
 * 4. PUT /api/products/:id
 * Updates an existing product.
 */
router.put('/products/:id', asyncHandler(async (req, res) => {
  const existing = await collections.products.get(req.params.id);
  const updated = {
    ...(existing || {}),
    ...req.body,
    id: req.params.id,
    price: req.body.price !== undefined ? Number(req.body.price) : Number(existing ? existing.price : 0),
    old: req.body.old !== undefined ? Number(req.body.old) : Number(existing ? existing.old : 0),
    isCustom: true,
    adminCreated: true,
    updatedAt: new Date().toISOString()
  };

  const saved = await collections.products.upsert(updated);
  res.json(saved);
}));

/**
 * 5. DELETE /api/products/:id
 * Removes product from catalog.
 */
router.delete('/products/:id', asyncHandler(async (req, res) => {
  await collections.products.remove(req.params.id);
  res.json({ success: true, id: req.params.id });
}));

module.exports = router;
