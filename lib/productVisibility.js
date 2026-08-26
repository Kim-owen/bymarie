/**
 * Product Visibility Helper
 * Filters out null/invalid objects while preserving all valid products
 * (including custom admin-added items).
 */
function isLegacySeedProduct(p) {
  if (!p || typeof p !== 'object') return true;
  if (!p.id || !p.name) return true;
  // Admin-created or custom products are always preserved
  if (p.isCustom || p.adminCreated) return false;
  return false;
}

function filterVisibleProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.filter(p => p && p.id && p.name && !isLegacySeedProduct(p));
}

module.exports = { isLegacySeedProduct, filterVisibleProducts };
