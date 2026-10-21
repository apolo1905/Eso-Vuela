// Catálogo persistente local. SQLite permite desarrollar sin instalar ni operar un servidor adicional.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

function catalogDatabase(root) {
  const folder = process.env.CATALOG_DATA_DIR || path.join(root, 'data');
  fs.mkdirSync(folder, { recursive: true });
  const db = new DatabaseSync(path.join(folder, 'catalog.sqlite'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('A', 'AA', 'AAA')),
      name TEXT NOT NULL,
      eggs INTEGER NOT NULL CHECK(eggs > 0),
      price_cop INTEGER NOT NULL CHECK(price_cop >= 0),
      image_url TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
      display_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS products_home_index ON products(active, display_order);
  `);
  const total = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (!total) {
    const insert = db.prepare('INSERT INTO products (id, category, name, eggs, price_cop, image_url, active, display_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)');
    const stamp = new Date().toISOString();
    db.exec('BEGIN');
    try {
      insert.run('huevos-a-30', 'A', 'Huevos categoría A', 30, 14100, 'https://cdn.shopify.com/s/files/1/0271/6634/3237/products/cartoneggs_1200x1200.jpg?v=1605907391', 1, stamp);
      insert.run('huevos-aa-30', 'AA', 'Huevos categoría AA', 30, 15500, 'https://4rfreshandfrozen.com/cdn/shop/products/Whiteegg_4472x.jpg?v=1587294486', 2, stamp);
      insert.run('huevos-aaa-30', 'AAA', 'Huevos categoría AAA', 30, 19800, 'https://s3.localdatacdn.com/ne/omaha/5441611/original/bf86a183c9.jpeg', 3, stamp);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const listHome = db.prepare(`SELECT id, category, name, eggs, price_cop AS price, image_url AS image, updated_at AS updatedAt FROM products WHERE active = 1 ORDER BY display_order ASC, name ASC`);
  return { home: () => listHome.all().map(product => ({ ...product, unitPrice: Math.round(product.price / product.eggs) })) };
}
module.exports = { catalogDatabase };
