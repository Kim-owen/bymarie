const collections = require('./collections');
const { filterVisibleProducts } = require('./productVisibility');

// Authoritative server-side price/stock/coupon/delivery-fee calculation.
// Never trusts client-sent prices or totals -- looks everything up from the
// product/coupon store (Supabase when configured, otherwise the local JSON
// fallback) so a tampered client payload can't change what a customer pays.
async function calculateOrderTotalsServerSide(rawItems, rawCouponCode, rawDeliveryMethod, city = '') {
  const allProducts = await collections.products.list();
  const products = filterVisibleProducts(allProducts);
  const allCoupons = await collections.coupons.list();

  if (!Array.isArray(rawItems) || !rawItems.length) {
    throw new Error('Order items array cannot be empty');
  }

  let subtotal = 0;
  const verifiedItems = [];

  for (const item of rawItems) {
    const prod = products.find(p => String(p.id) === String(item.id));
    if (!prod) {
      throw new Error(`Product "${item.name || item.id}" does not exist in catalog.`);
    }

    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    if (prod.stock !== undefined && prod.stock < qty) {
      throw new Error(`Insufficient stock for "${prod.name}". Available stock: ${prod.stock}`);
    }

    // Authoritative Price looked up securely from Server Database
    const authoritativePrice = Number(prod.price) || 0;
    const lineTotal = authoritativePrice * qty;
    subtotal += lineTotal;

    verifiedItems.push({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      price: authoritativePrice, // Verified server-side price
      qty,
      size: item.size || 'Standard',
      color: item.color || 'Standard',
      image: prod.image || (prod.images && prod.images[0]) || '',
      lineTotal: Number(lineTotal.toFixed(2))
    });
  }

  // Authoritative Server-Side Coupon Verification
  let discountAmount = 0;
  let appliedCoupon = null;
  if (rawCouponCode) {
    const code = String(rawCouponCode).toUpperCase().trim();
    const foundCoupon = allCoupons.find(c => (c.code || '').toUpperCase().trim() === code);
    if (foundCoupon) {
      if (foundCoupon.type === 'percent') {
        discountAmount = (subtotal * (Number(foundCoupon.discount) || 0)) / 100;
      } else {
        discountAmount = Number(foundCoupon.discount) || 0;
      }
      discountAmount = Math.min(subtotal, Math.max(0, discountAmount));
      appliedCoupon = { code: foundCoupon.code, discount: foundCoupon.discount, type: foundCoupon.type };
    }
  }

  // Authoritative Server-Side Delivery Fee
  let deliveryFee = 35; // Standard Greater Accra
  const method = String(rawDeliveryMethod || '').toLowerCase();
  const isAccra = (city || '').toLowerCase().includes('accra') || (city || '').toLowerCase().includes('cantonments') || (city || '').toLowerCase().includes('legon');

  if (method.includes('express') || method.includes('vip')) {
    deliveryFee = 60;
  } else if (method.includes('nationwide') || method.includes('regional')) {
    deliveryFee = 50;
  } else if (isAccra && subtotal >= 300) {
    deliveryFee = 0; // Complimentary delivery over GH₵ 300 in Accra
  }

  const total = Number((subtotal - discountAmount + deliveryFee).toFixed(2));

  return {
    verifiedItems,
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    total,
    appliedCoupon
  };
}

module.exports = { calculateOrderTotalsServerSide };
