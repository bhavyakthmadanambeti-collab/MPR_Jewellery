import { db } from '../database/db.js';
import { mapProduct } from '../models/mappers.js';
import { slugify } from '../utils/slug.js';
import { badRequest, notFound } from '../utils/http.js';
import { removeObjects, storeImage, storeVideo } from './storage.service.js';

export interface ProductFilters {
  q?: string;
  category?: string;
  metal?: string;
  purity?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  featured?: boolean;
  includeInactive?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name';
  limit?: number;
  offset?: number;
}

// Keyword synonyms so "ring" finds category "rings", etc.
const SYNONYMS: Record<string, string> = {
  ring: 'rings', necklace: 'necklaces', earring: 'earrings', jhumka: 'earrings', bangle: 'bangles',
  bracelet: 'bracelets', chain: 'chains', kada: 'bangles', haram: 'necklaces', stud: 'earrings',
};

async function attachMedia(rows: any[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [imgs, vids] = await Promise.all([
    db.query('SELECT * FROM product_images WHERE product_id = ANY($1::int[]) ORDER BY sort_order, id', [ids]),
    db.query('SELECT * FROM product_videos WHERE product_id = ANY($1::int[]) ORDER BY sort_order, id', [ids]),
  ]);
  return rows.map((r) => mapProduct(r, imgs.filter((i) => i.product_id === r.id), vids.filter((v) => v.product_id === r.id)));
}

export async function listProducts(f: ProductFilters) {
  const where: string[] = [];
  const p: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    p.push(v);
    where.push(sql.replace('?', `$${p.length}`));
  };
  if (!f.includeInactive) where.push('is_active = true');
  if (f.q) {
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const t of terms) {
      const syn = SYNONYMS[t] || SYNONYMS[t.replace(/s$/, '')] || t;
      // word-start match (\m) so "ring" finds rings but not ear-rings
      p.push('\\m' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const a = p.length;
      p.push(syn);
      const b = p.length;
      where.push(`(name ~* $${a} OR description ~* $${a} OR sku ~* $${a} OR category ~* $${a} OR metal_type ~* $${a} OR purity ~* $${a} OR category = $${b})`);
    }
  }
  if (f.category) {
    // A metal-named category (gold/silver/diamond) also matches products of that metal
    p.push(f.category);
    const i = p.length;
    where.push(['gold', 'silver', 'diamond'].includes(f.category) ? `(category = $${i} OR metal_type = $${i})` : `category = $${i}`);
  }
  if (f.metal) add('metal_type = ?', f.metal);
  if (f.purity) add('purity = ?', f.purity);
  if (f.minPrice !== undefined) add('price >= ?', f.minPrice);
  if (f.maxPrice !== undefined) add('price <= ?', f.maxPrice);
  if (f.availability) add('availability = ?', f.availability);
  if (f.featured) where.push('is_featured = true');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order =
    f.sort === 'price_asc' ? 'price ASC' : f.sort === 'price_desc' ? 'price DESC' : f.sort === 'name' ? 'name ASC' : 'created_at DESC, id DESC';
  const limit = Math.min(Math.max(f.limit ?? 60, 1), 200);
  const offset = Math.max(f.offset ?? 0, 0);
  const [rows, countRow] = await Promise.all([
    db.query(`SELECT * FROM products ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, p),
    db.one<{ c: number }>(`SELECT count(*)::int AS c FROM products ${whereSql}`, p),
  ]);
  return { items: await attachMedia(rows), total: countRow?.c ?? 0 };
}

export async function getProductBySlug(slug: string, includeInactive = false) {
  const r = await db.one(`SELECT * FROM products WHERE slug = $1 ${includeInactive ? '' : 'AND is_active = true'}`, [slug]);
  if (!r) throw notFound('This product could not be found.');
  return (await attachMedia([r]))[0];
}

export async function getProductById(id: number) {
  const r = await db.one('SELECT * FROM products WHERE id = $1', [id]);
  if (!r) throw notFound('Product not found.');
  return (await attachMedia([r]))[0];
}

export async function facets() {
  const purities = await db.query<{ purity: string }>(`SELECT DISTINCT purity FROM products WHERE is_active = true AND purity <> '' ORDER BY purity`);
  const range = await db.one<{ min: string; max: string }>('SELECT min(price) AS min, max(price) AS max FROM products WHERE is_active = true');
  return { purities: purities.map((p) => p.purity), priceMin: Number(range?.min ?? 0), priceMax: Number(range?.max ?? 0) };
}

async function uniqueSlug(base: string, excludeId?: number) {
  let slug = slugify(base);
  let i = 1;
  while (await db.one('SELECT id FROM products WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)', [slug, excludeId ?? null])) {
    i += 1;
    slug = `${slugify(base)}-${i}`;
  }
  return slug;
}

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  metalType: string;
  purity: string;
  weightGrams: number;
  price: number;
  stock: number;
  availability: string;
  sku: string;
  isFeatured?: boolean;
  isActive?: boolean;
  slug?: string;
}

export async function createProduct(input: ProductInput) {
  const slug = await uniqueSlug(input.slug || input.name);
  const r = await db.one(
    `INSERT INTO products (slug, sku, name, description, category, metal_type, purity, weight_grams, price, stock, availability, is_featured, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [slug, input.sku.trim().toUpperCase(), input.name.trim(), input.description.trim(), input.category, input.metalType, input.purity, input.weightGrams, input.price, input.stock, input.availability, input.isFeatured ?? false, input.isActive ?? true]
  );
  return getProductById(r!.id);
}

export async function updateProduct(id: number, input: Partial<ProductInput>) {
  const existing = await db.one('SELECT * FROM products WHERE id = $1', [id]);
  if (!existing) throw notFound('Product not found.');
  const map: Record<string, string> = {
    name: 'name', description: 'description', category: 'category', metalType: 'metal_type', purity: 'purity',
    weightGrams: 'weight_grams', price: 'price', stock: 'stock', availability: 'availability', sku: 'sku',
    isFeatured: 'is_featured', isActive: 'is_active',
  };
  const sets: string[] = [];
  const p: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    const v = (input as any)[k];
    if (v === undefined) continue;
    p.push(k === 'sku' ? String(v).trim().toUpperCase() : typeof v === 'string' ? v.trim() : v);
    sets.push(`${col} = $${p.length}`);
  }
  if (input.name && input.name.trim() !== existing.name) {
    p.push(await uniqueSlug(input.name, id));
    sets.push(`slug = $${p.length}`);
  }
  if (!sets.length) return getProductById(id);
  p.push(id);
  await db.query(`UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = $${p.length}`, p);
  return getProductById(id);
}

export async function deleteProduct(id: number) {
  const imgs = await db.query('SELECT storage_path, thumb_path FROM product_images WHERE product_id = $1', [id]);
  const vids = await db.query('SELECT storage_path, poster_path FROM product_videos WHERE product_id = $1', [id]);
  const r = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
  if (!r.length) throw notFound('Product not found.');
  await removeObjects([...imgs.flatMap((i) => [i.storage_path, i.thumb_path]), ...vids.flatMap((v) => [v.storage_path, v.poster_path])]);
}

// ---------- images ----------
export async function addProductImages(productId: number, files: { buffer: Buffer; originalname: string }[]) {
  const product = await db.one('SELECT id, name FROM products WHERE id = $1', [productId]);
  if (!product) throw notFound('Product not found.');
  if (!files?.length) throw badRequest('Please choose at least one image.');
  const max = await db.one<{ m: number }>('SELECT coalesce(max(sort_order), -1)::int AS m FROM product_images WHERE product_id = $1', [productId]);
  let order = (max?.m ?? -1) + 1;
  for (const f of files) {
    const s = await storeImage(f.buffer, `products/${productId}`);
    await db.query(
      `INSERT INTO product_images (product_id, storage_path, thumb_path, storage_id, storage_driver, mime, width, height, size_bytes, alt, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [productId, s.storagePath, s.thumbPath, s.storageId, s.driver, s.mime, s.width, s.height, s.sizeBytes, product.name, order++]
    );
  }
  return getProductById(productId);
}

export async function replaceProductImage(productId: number, imageId: number, file: { buffer: Buffer }) {
  const img = await db.one('SELECT * FROM product_images WHERE id = $1 AND product_id = $2', [imageId, productId]);
  if (!img) throw notFound('Image not found.');
  const s = await storeImage(file.buffer, `products/${productId}`);
  await db.query(
    `UPDATE product_images SET storage_path=$1, thumb_path=$2, storage_id=$3, storage_driver=$4, mime=$5, width=$6, height=$7, size_bytes=$8 WHERE id=$9`,
    [s.storagePath, s.thumbPath, s.storageId, s.driver, s.mime, s.width, s.height, s.sizeBytes, imageId]
  );
  await removeObjects([img.storage_path, img.thumb_path]);
  return getProductById(productId);
}

export async function deleteProductImage(productId: number, imageId: number) {
  const img = await db.one('DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING *', [imageId, productId]);
  if (!img) throw notFound('Image not found.');
  await removeObjects([img.storage_path, img.thumb_path]);
  return getProductById(productId);
}

export async function reorderProductImages(productId: number, ids: number[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.query('UPDATE product_images SET sort_order = $1 WHERE id = $2 AND product_id = $3', [i, ids[i], productId]);
    }
  });
  return getProductById(productId);
}

// ---------- videos ----------
export async function addProductVideos(productId: number, files: { path: string; mimetype: string }[]) {
  const product = await db.one('SELECT id FROM products WHERE id = $1', [productId]);
  if (!product) throw notFound('Product not found.');
  if (!files?.length) throw badRequest('Please choose a video.');
  const max = await db.one<{ m: number }>('SELECT coalesce(max(sort_order), -1)::int AS m FROM product_videos WHERE product_id = $1', [productId]);
  let order = (max?.m ?? -1) + 1;
  for (const f of files) {
    const s = await storeVideo(f.path, f.mimetype, `products/${productId}/videos`);
    await db.query(
      `INSERT INTO product_videos (product_id, storage_path, poster_path, storage_id, storage_driver, mime, size_bytes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [productId, s.storagePath, s.posterPath, s.storageId, s.driver, s.mime, s.sizeBytes, order++]
    );
  }
  return getProductById(productId);
}

export async function replaceProductVideo(productId: number, videoId: number, file: { path: string; mimetype: string }) {
  const v = await db.one('SELECT * FROM product_videos WHERE id = $1 AND product_id = $2', [videoId, productId]);
  if (!v) throw notFound('Video not found.');
  const s = await storeVideo(file.path, file.mimetype, `products/${productId}/videos`);
  await db.query('UPDATE product_videos SET storage_path=$1, poster_path=$2, storage_id=$3, storage_driver=$4, mime=$5, size_bytes=$6 WHERE id=$7', [
    s.storagePath, s.posterPath, s.storageId, s.driver, s.mime, s.sizeBytes, videoId,
  ]);
  await removeObjects([v.storage_path, v.poster_path]);
  return getProductById(productId);
}

export async function deleteProductVideo(productId: number, videoId: number) {
  const v = await db.one('DELETE FROM product_videos WHERE id = $1 AND product_id = $2 RETURNING *', [videoId, productId]);
  if (!v) throw notFound('Video not found.');
  await removeObjects([v.storage_path, v.poster_path]);
  return getProductById(productId);
}
