// Ejecuta: MONGODB_URI="..." node scripts/migrate-to-mongodb.js
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { MongoClient } = require('mongodb');

const envFile = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('Configura MONGODB_URI antes de migrar.');
  const root = path.resolve(__dirname, '..');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'esovuela');
  try {
    const catalogFile = path.join(root, 'data', 'catalog.sqlite');
    if (fs.existsSync(catalogFile)) {
      const sqlite = new DatabaseSync(catalogFile);
      const products = sqlite.prepare('SELECT id, category, name, eggs, price_cop AS price, image_url AS image, active, display_order AS displayOrder, updated_at AS updatedAt FROM products').all().map(product => ({ ...product, active: Boolean(product.active), updatedAt: new Date(product.updatedAt) }));
      for (const product of products) await db.collection('products').replaceOne({ id: product.id }, product, { upsert: true });
      console.log(`Catálogo migrado: ${products.length} productos.`);
    }
    const legacyFile = path.join(root, 'data', 'esovuela.json');
    if (fs.existsSync(legacyFile)) {
      const legacy = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
      for (const account of legacy.accounts || []) {
        const collection = account.role === 'merchant' ? 'merchants' : 'clients';
        await db.collection(collection).replaceOne({ id: account.id }, { ...account, createdAt: new Date(account.createdAt) }, { upsert: true });
      }
      for (const order of legacy.orders || []) await db.collection('orders').replaceOne({ id: order.id }, { ...order, createdAt: new Date(order.createdAt), updatedAt: order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt) }, { upsert: true });
      for (const redemption of legacy.redemptions || []) await db.collection('redemptions').replaceOne({ id: redemption.id }, { ...redemption, createdAt: new Date(redemption.createdAt) }, { upsert: true });
      for (const rating of legacy.ratings || []) await db.collection('ratings').replaceOne({ id: rating.id }, { ...rating, createdAt: new Date(rating.createdAt) }, { upsert: true });
      console.log(`Datos migrados: ${(legacy.accounts || []).length} usuarios, ${(legacy.orders || []).length} pedidos.`);
    }
    // Conserva los documentos antiguos como respaldo y los copia a las
    // colecciones separadas utilizadas por la API actual.
    const oldAccounts = await db.collection('accounts').find({}).toArray();
    for (const account of oldAccounts) {
      const { _id, ...user } = account;
      const collection = user.role === 'merchant' ? 'merchants' : 'clients';
      await db.collection(collection).replaceOne({ id: user.id }, user, { upsert: true });
    }
    if (oldAccounts.length) console.log(`Cuentas organizadas: ${oldAccounts.length} movidas a clients y merchants.`);
    console.log('Migración completada. Las sesiones no se migran por seguridad: inicia sesión nuevamente.');
  } finally { await client.close(); }
}
run().catch(error => { console.error(`Migración fallida: ${error.message}`); process.exitCode = 1; });
