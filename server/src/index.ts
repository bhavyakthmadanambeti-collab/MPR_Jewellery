import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { initDb, db } from './database/db.js';
import { migrate } from './database/migrate.js';
import { seedAll } from './database/seed.js';
import publicRoutes from './routes/public.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { safeLocalPath } from './services/storage.service.js';
import { getSettings } from './services/settings.service.js';

async function main() {
  await initDb();
  await migrate();
  await seedAll({ demo: process.env.SEED_DEMO !== 'false' });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false, // SPA served separately / via CDN; configure CSP at the edge
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: false }));
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Local object storage (used when STORAGE_DRIVER=local). Supports HTTP range requests for video.
  app.get('/api/media/*', (req, res) => {
    const key = (req.params as any)[0] as string;
    let full: string;
    try {
      full = safeLocalPath(key);
    } catch {
      return res.status(400).end();
    }
    if (!fs.existsSync(full)) return res.status(404).json({ error: 'Media not found' });
    res.sendFile(full, { maxAge: '365d', immutable: true, acceptRanges: true });
  });

  app.use('/api', publicRoutes);
  app.use('/api/owner', ownerRoutes);
  app.use('/api', notFoundHandler);

  // Production: serve the built React app with per-page SEO tags for crawlers
  if (fs.existsSync(env.clientDist)) {
    const indexHtml = fs.readFileSync(path.join(env.clientDist, 'index.html'), 'utf8');
    app.use(express.static(env.clientDist, { index: false, maxAge: '7d' }));
    app.get('*', async (req, res) => {
      let title = 'MPR JEWELLERY — Gold, Silver & Diamond Jewellery';
      let description = 'Shop hallmarked gold, sterling silver and diamond jewellery from MPR JEWELLERY. Daily gold and silver rates, secure UPI checkout.';
      let image = '';
      try {
        const s = await getSettings();
        const m = req.path.match(/^\/(products|collections)\/([a-z0-9-]+)$/);
        if (m?.[1] === 'products') {
          const p = await db.one('SELECT p.name, p.description, (SELECT storage_path FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS img FROM products p WHERE slug = $1 AND is_active', [m[2]]);
          if (p) { title = `${p.name} | ${s.brand.name}`; description = p.description.slice(0, 155); image = p.img ? `/api/media/${p.img}` : ''; }
        } else if (m?.[1] === 'collections') {
          const c = await db.one('SELECT title, description FROM collections WHERE slug = $1 AND is_published', [m[2]]);
          if (c) { title = `${c.title} | ${s.brand.name}`; description = c.description || description; }
        }
      } catch { /* fall back to defaults */ }
      const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
      const html = indexHtml
        .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(description)}"`)
        .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(title)}"`)
        .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(description)}"`)
        .replace(/(<meta property="og:image" content=")[^"]*"/, image ? `$1${esc(image)}"` : '$&');
      res.type('html').send(html);
    });
  }

  app.use(errorHandler);

  app.listen(env.port, () => console.log(`[server] MPR JEWELLERY API listening on http://localhost:${env.port}`));
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
