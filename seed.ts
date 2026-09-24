/**
 * Seeds: owner account (hashed password from env), default settings, initial metal
 * rates, demo products with images, and demo homepage collections.
 * Idempotent — safe to run on every boot. Existing data is never overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db, initDb } from './db.js';
import { migrate } from './migrate.js';
import { env, ROOT_DIR } from '../config/env.js';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../services/settings.service.js';
import { createProduct, addProductImages } from '../services/product.service.js';
import { createCollection, addCollectionMedia } from '../services/collection.service.js';
import { fileURLToPath } from 'node:url';

const SEED_DIR = path.join(ROOT_DIR, 'storage', 'seed');

export async function seedOwner() {
  const count = await db.one<{ c: number }>('SELECT count(*)::int AS c FROM owners');
  if ((count?.c ?? 0) > 0) return;
  if (!env.seedOwnerEmail || !env.seedOwnerPassword) {
    console.warn('[seed] No owner exists. Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD, then restart to create one.');
    return;
  }
  const hash = await bcrypt.hash(env.seedOwnerPassword, 12);
  await db.query('INSERT INTO owners (email, name, password_hash, role) VALUES ($1, $2, $3, $4)', [env.seedOwnerEmail.toLowerCase(), 'MPR Owner', hash, 'owner']);
  console.log(`[seed] owner account created for ${env.seedOwnerEmail} (password stored as bcrypt hash)`);
}

async function seedSettings() {
  const has = await db.one('SELECT key FROM site_settings LIMIT 1');
  if (!has) await saveSettings(DEFAULT_SETTINGS);
}

async function seedRates() {
  const has = await db.one('SELECT id FROM metal_rates LIMIT 1');
  if (has) return;
  // Initial reference values entered at setup (Chennai market, 24 Sep 2026). The owner should
  // review and update these from the Owner Portal → Gold/Silver Rates.
  const initial: [string, number, string][] = [
    ['gold_24k', 15273, 'gram'], ['gold_22k', 14000, 'gram'], ['gold_916', 14000, 'gram'],
    ['gold_18k', 11770, 'gram'], ['silver', 250, 'gram'], ['diamond', 65000, 'carat'],
  ];
  for (const [k, v, u] of initial) {
    await db.query(`INSERT INTO metal_rates (metal_key, value, unit, source, source_type) VALUES ($1,$2,$3,$4,'owner')`, [k, v, u, 'Initial setup rate — owner to verify']);
  }
}

const readSeed = (f: string) => {
  const p = path.join(SEED_DIR, f);
  return fs.existsSync(p) ? { buffer: fs.readFileSync(p), originalname: f } : null;
};

async function seedProducts() {
  const has = await db.one('SELECT id FROM products LIMIT 1');
  if (has) return;
  const demo = [
    { name: 'Floral Filigree Gold Ring', sku: 'MPR-GR-001', category: 'rings', metalType: 'gold', purity: '22K (916)', weightGrams: 4.2, price: 66500, stock: 6, img: 'p-gold-ring.png',
      description: 'A hand-finished 22K hallmarked gold ring with an open floral filigree crown. Lightweight, comfortable for daily wear and elegant for occasions.' },
    { name: 'Lakshmi Kasu Gold Necklace', sku: 'MPR-GN-001', category: 'necklaces', metalType: 'gold', purity: '22K (916)', weightGrams: 28.5, price: 438000, stock: 2, img: 'p-gold-necklace.png',
      description: 'Traditional kasu mala with Lakshmi coin motifs and ruby accents, crafted in BIS-hallmarked 22K gold. A timeless piece for weddings and festivals.' },
    { name: 'Kundan Jhumka Gold Earrings', sku: 'MPR-GE-001', category: 'earrings', metalType: 'gold', purity: '22K (916)', weightGrams: 8.6, price: 132500, stock: 4, img: 'p-gold-earrings.png',
      description: 'Dome jhumkas with a kundan flower stud and fine pearl drops. Secure screw-back fastening, finished by hand.' },
    { name: 'Temple Carved Gold Bangles (Set of 4)', sku: 'MPR-GB-001', category: 'bangles', metalType: 'gold', purity: '22K (916)', weightGrams: 32.0, price: 495000, stock: 2, img: 'p-gold-bangles.png',
      description: 'A set of four intricately carved 22K gold bangles with temple-inspired motifs. Available in sizes 2.4 and 2.6.' },
    { name: 'Textured Link Silver Bracelet', sku: 'MPR-SB-001', category: 'bracelets', metalType: 'silver', purity: '925 Sterling', weightGrams: 24.0, price: 8900, stock: 10, img: 'p-silver-bracelet.png',
      description: 'Bold paperclip links in 925 sterling silver with alternating hammered texture and a secure lobster clasp.' },
    { name: 'Classic Rope Silver Chain', sku: 'MPR-SC-001', category: 'chains', metalType: 'silver', purity: '925 Sterling', weightGrams: 18.0, price: 6200, stock: 12, img: 'p-silver-chain.png',
      description: 'A 20-inch rope-twist chain in 925 sterling silver. Tarnish-resistant finish, perfect on its own or with a pendant.' },
  ];
  for (const d of demo) {
    const p = await createProduct({ ...d, availability: 'in_stock', isFeatured: true, isActive: true });
    const file = readSeed(d.img);
    if (file) await addProductImages(p.id, [file]);
  }
  console.log('[seed] demo products created');
}

async function seedCollections() {
  const has = await db.one('SELECT id FROM collections LIMIT 1');
  if (has) return;
  const tmpCopy = (f: string) => {
    const src = path.join(SEED_DIR, f);
    if (!fs.existsSync(src)) return null;
    const dst = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'mpr-')), f);
    fs.copyFileSync(src, dst);
    const mimetype = f.endsWith('.mp4') ? 'video/mp4' : 'image/png';
    return { path: dst, mimetype, originalname: f };
  };
  const hero = await createCollection({ title: 'New Collection', description: 'Temple gold, crafted for the season of celebrations.', isPublished: true, showOnHome: true });
  await addCollectionMedia(hero.id, ['hero-wide.png', 'showcase-video.mp4', 'hero-bridal.png'].map(tmpCopy).filter(Boolean) as any);

  const bridal = await createCollection({ title: 'Bridal Collection', description: 'Heirloom gold for the most important day.', isPublished: true, showOnHome: true });
  await addCollectionMedia(bridal.id, ['col-festive.png', 'hero-bridal.png', 'p-gold-bangles.png'].map(tmpCopy).filter(Boolean) as any);

  const diamond = await createCollection({ title: 'Diamond Collection', description: 'Brilliant-cut solitaires set in gold.', isPublished: true, showOnHome: true });
  await addCollectionMedia(diamond.id, ['col-diamond.png'].map(tmpCopy).filter(Boolean) as any);

  await createCollection({ title: 'Festive Collection', description: 'Draft — add media and publish when ready.', isPublished: false, showOnHome: true });

  const s = await getSettings();
  await saveSettings({ home: { ...s.home, heroCollectionId: hero.id } });
  console.log('[seed] demo collections created');
}

export async function seedAll(opts: { demo?: boolean } = { demo: true }) {
  await seedOwner();
  await seedSettings();
  await seedRates();
  if (opts.demo !== false) {
    await seedProducts();
    await seedCollections();
  }
}

// CLI: npm run seed
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    await initDb();
    await migrate();
    await seedAll({ demo: process.env.SEED_DEMO !== 'false' });
    console.log('[seed] done');
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
