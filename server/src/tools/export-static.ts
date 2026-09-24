/**
 * Exports the public catalogue (settings, rates, home, products, collections + media files)
 * into client/public/static-data so the frontend can be hosted on GitHub Pages without a backend.
 * Usage: start the server, then  npm --prefix server run export:static
 * Owner-only data and customer data are never exported.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, env } from '../config/env.js';

const API = process.env.API_URL || `http://localhost:${env.port}`;
const OUT = path.join(ROOT_DIR, 'client', 'public', 'static-data');
const MEDIA_OUT = path.join(OUT, 'media');

async function get(p: string) {
  const r = await fetch(API + p);
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status}`);
  return r.json();
}

const mediaKeys = new Set<string>();
function rewrite(o: any): any {
  if (typeof o === 'string' && o.startsWith('/api/media/')) {
    const key = o.slice('/api/media/'.length);
    mediaKeys.add(key);
    return `static-data/media/${key}`;
  }
  if (Array.isArray(o)) return o.map(rewrite);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rewrite(v)]));
  return o;
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(MEDIA_OUT, { recursive: true });
  const [settings, rates, home, list, collections] = await Promise.all([
    get('/api/settings'), get('/api/rates'), get('/api/home'), get('/api/products?limit=200'), get('/api/collections'),
  ]);
  const collectionDetails = await Promise.all((collections as any[]).map((c) => get(`/api/collections/${c.slug}`)));
  const data = rewrite({ exportedAt: new Date().toISOString(), settings, rates, home, products: list.items, facets: list.facets, collections, collectionDetails });
  fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(data));
  for (const key of mediaKeys) {
    const src = path.join(env.localStorageDir, key);
    const dst = path.join(MEDIA_OUT, key);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (fs.existsSync(src)) fs.copyFileSync(src, dst);
    else console.warn('missing media', key);
  }
  console.log(`Exported ${list.items.length} products, ${(collections as any[]).length} collections, ${mediaKeys.size} media files → ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
