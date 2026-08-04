const Fuse = require('fuse.js');

function searchProducts(query, products, limit = 5) {

  const normalized = String(query || '')
    .trim()
    .toLowerCase();

  if (!normalized || !Array.isArray(products)) {
    return [];
  }

  const startsWithMatches = products.filter(product =>
    String(product.name || '')
      .toLowerCase()
      .startsWith(normalized)
  );

  if (startsWithMatches.length > 0) {
    return startsWithMatches.slice(0, limit);
  }

  const fuse = new Fuse(products, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.25,
    keys: [
      { name: 'name', weight: 0.8 },
      { name: 'generic_name', weight: 0.2 }
    ]
  });

  return fuse
    .search(normalized)
    .map(r => r.item)
    .slice(0, limit);
}

module.exports = {
  searchProducts
};
