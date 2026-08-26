// Excludes legacy/demo seed products that may still exist in the Supabase
// table so the storefront and the pricing engine only ever see real,
// admin-added catalog items. Applied consistently everywhere products are
// read (list, single lookup, order pricing) -- previously this exclusion
// only ran on the Supabase read path and the local JSON path used a
// different (isCustom) check, so the two paths disagreed on what "real"
// inventory was.
const LEGACY_ID_PREFIXES = ['p-', 'p_', 'prod-0', 'prod-1', 'prod-2'];
const LEGACY_NAME_FRAGMENTS = [
  'linen edit',
  'tailored ease',
  'atelier blazer',
  'suede slingback',
  'woven leather',
  'leather slide'
];

function isLegacySeedProduct(p) {
  if (!p || !p.id || !p.name) return true;
  const id = String(p.id).toLowerCase();
  if (LEGACY_ID_PREFIXES.some(prefix => id.startsWith(prefix))) return true;
  const name = String(p.name).toLowerCase();
  if (LEGACY_NAME_FRAGMENTS.some(fragment => name.includes(fragment))) return true;
  return false;
}

function filterVisibleProducts(products) {
  return (products || []).filter(p => !isLegacySeedProduct(p));
}

module.exports = { isLegacySeedProduct, filterVisibleProducts };
