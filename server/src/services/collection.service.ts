import fsp from 'node:fs/promises';
import { db } from '../database/db.js';
import { mapCollection } from '../models/mappers.js';
import { slugify } from '../utils/slug.js';
import { badRequest, notFound } from '../utils/http.js';
import { IMAGE_MIME, removeObjects, storeImage, storeVideo } from './storage.service.js';

/** Collections are promotional/display content only — never products, never priced. */

async function withMedia(rows: any[]) {
  if (!rows.length) return [];
  const media = await db.query('SELECT * FROM collection_media WHERE collection_id = ANY($1::int[]) ORDER BY sort_order, id', [rows.map((r) => r.id)]);
  return rows.map((r) => mapCollection(r, media.filter((m) => m.collection_id === r.id)));
}

export async function listPublicCollections(opts: { homeOnly?: boolean } = {}) {
  const rows = await db.query(
    `SELECT * FROM collections WHERE is_published = true AND is_visible = true ${opts.homeOnly ? 'AND show_on_home = true' : ''} ORDER BY sort_order, id`
  );
  return withMedia(rows);
}

export async function getPublicCollection(slug: string) {
  const r = await db.one('SELECT * FROM collections WHERE slug = $1 AND is_published = true AND is_visible = true', [slug]);
  if (!r) throw notFound('This collection is not available.');
  return (await withMedia([r]))[0];
}

export async function getPublicCollectionById(id: number) {
  const r = await db.one('SELECT * FROM collections WHERE id = $1 AND is_published = true AND is_visible = true', [id]);
  if (!r) return null;
  return (await withMedia([r]))[0];
}

export async function listAllCollections() {
  const rows = await db.query('SELECT * FROM collections ORDER BY sort_order, id');
  return withMedia(rows);
}

export async function getCollection(id: number) {
  const r = await db.one('SELECT * FROM collections WHERE id = $1', [id]);
  if (!r) throw notFound('Collection not found.');
  return (await withMedia([r]))[0];
}

async function uniqueSlug(base: string, excludeId?: number) {
  let slug = slugify(base);
  let i = 1;
  while (await db.one('SELECT id FROM collections WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)', [slug, excludeId ?? null])) {
    i += 1;
    slug = `${slugify(base)}-${i}`;
  }
  return slug;
}

export interface CollectionInput {
  title: string;
  description?: string;
  isPublished?: boolean;
  isVisible?: boolean;
  showOnHome?: boolean;
  sortOrder?: number;
}

export async function createCollection(input: CollectionInput) {
  const max = await db.one<{ m: number }>('SELECT coalesce(max(sort_order), -1)::int AS m FROM collections');
  const r = await db.one(
    `INSERT INTO collections (slug, title, description, is_published, is_visible, show_on_home, sort_order, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $4 THEN now() ELSE NULL END) RETURNING id`,
    [await uniqueSlug(input.title), input.title.trim(), (input.description || '').trim(), input.isPublished ?? false, input.isVisible ?? true, input.showOnHome ?? true, input.sortOrder ?? (max?.m ?? -1) + 1]
  );
  return getCollection(r!.id);
}

export async function updateCollection(id: number, input: Partial<CollectionInput>) {
  const existing = await db.one('SELECT * FROM collections WHERE id = $1', [id]);
  if (!existing) throw notFound('Collection not found.');
  const sets: string[] = [];
  const p: unknown[] = [];
  const set = (col: string, v: unknown) => {
    p.push(v);
    sets.push(`${col} = $${p.length}`);
  };
  if (input.title !== undefined) {
    set('title', input.title.trim());
    if (input.title.trim() !== existing.title) set('slug', await uniqueSlug(input.title, id));
  }
  if (input.description !== undefined) set('description', input.description.trim());
  if (input.isVisible !== undefined) set('is_visible', input.isVisible);
  if (input.showOnHome !== undefined) set('show_on_home', input.showOnHome);
  if (input.sortOrder !== undefined) set('sort_order', input.sortOrder);
  if (input.isPublished !== undefined) {
    set('is_published', input.isPublished);
    if (input.isPublished && !existing.is_published) sets.push('published_at = now()');
  }
  if (sets.length) {
    p.push(id);
    await db.query(`UPDATE collections SET ${sets.join(', ')}, updated_at = now() WHERE id = $${p.length}`, p);
  }
  return getCollection(id);
}

export async function reorderCollections(ids: number[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) await tx.query('UPDATE collections SET sort_order = $1 WHERE id = $2', [i, ids[i]]);
  });
  return listAllCollections();
}

export async function deleteCollection(id: number) {
  const media = await db.query('SELECT storage_path, thumb_path, poster_path FROM collection_media WHERE collection_id = $1', [id]);
  const r = await db.query('DELETE FROM collections WHERE id = $1 RETURNING id', [id]);
  if (!r.length) throw notFound('Collection not found.');
  await removeObjects(media.flatMap((m) => [m.storage_path, m.thumb_path, m.poster_path]));
}

type DiskFile = { path: string; mimetype: string; originalname: string };

async function storeMediaFile(collectionId: number, f: DiskFile) {
  if (IMAGE_MIME.includes(f.mimetype)) {
    const buf = await fsp.readFile(f.path);
    await fsp.rm(f.path, { force: true });
    const s = await storeImage(buf, `collections/${collectionId}`);
    return { type: 'image', storage_path: s.storagePath, thumb_path: s.thumbPath, poster_path: null, storage_id: s.storageId, driver: s.driver, mime: s.mime, width: s.width, height: s.height, size: s.sizeBytes };
  }
  const s = await storeVideo(f.path, f.mimetype, `collections/${collectionId}/videos`);
  return { type: 'video', storage_path: s.storagePath, thumb_path: null, poster_path: s.posterPath, storage_id: s.storageId, driver: s.driver, mime: s.mime, width: null, height: null, size: s.sizeBytes };
}

export async function addCollectionMedia(collectionId: number, files: DiskFile[]) {
  const c = await db.one('SELECT id, title FROM collections WHERE id = $1', [collectionId]);
  if (!c) throw notFound('Collection not found.');
  if (!files?.length) throw badRequest('Please choose at least one image or video.');
  const max = await db.one<{ m: number }>('SELECT coalesce(max(sort_order), -1)::int AS m FROM collection_media WHERE collection_id = $1', [collectionId]);
  let order = (max?.m ?? -1) + 1;
  for (const f of files) {
    const s = await storeMediaFile(collectionId, f);
    await db.query(
      `INSERT INTO collection_media (collection_id, media_type, storage_path, thumb_path, poster_path, storage_id, storage_driver, mime, width, height, size_bytes, alt, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [collectionId, s.type, s.storage_path, s.thumb_path, s.poster_path, s.storage_id, s.driver, s.mime, s.width, s.height, s.size, c.title, order++]
    );
  }
  await db.query('UPDATE collections SET updated_at = now() WHERE id = $1', [collectionId]);
  return getCollection(collectionId);
}

export async function replaceCollectionMedia(collectionId: number, mediaId: number, f: DiskFile) {
  const m = await db.one('SELECT * FROM collection_media WHERE id = $1 AND collection_id = $2', [mediaId, collectionId]);
  if (!m) throw notFound('Media not found.');
  const s = await storeMediaFile(collectionId, f);
  await db.query(
    `UPDATE collection_media SET media_type=$1, storage_path=$2, thumb_path=$3, poster_path=$4, storage_id=$5, storage_driver=$6, mime=$7, width=$8, height=$9, size_bytes=$10 WHERE id=$11`,
    [s.type, s.storage_path, s.thumb_path, s.poster_path, s.storage_id, s.driver, s.mime, s.width, s.height, s.size, mediaId]
  );
  await removeObjects([m.storage_path, m.thumb_path, m.poster_path]);
  return getCollection(collectionId);
}

export async function updateMediaAlt(collectionId: number, mediaId: number, alt: string) {
  await db.query('UPDATE collection_media SET alt = $1 WHERE id = $2 AND collection_id = $3', [alt, mediaId, collectionId]);
  return getCollection(collectionId);
}

export async function deleteCollectionMedia(collectionId: number, mediaId: number) {
  const m = await db.one('DELETE FROM collection_media WHERE id = $1 AND collection_id = $2 RETURNING *', [mediaId, collectionId]);
  if (!m) throw notFound('Media not found.');
  await removeObjects([m.storage_path, m.thumb_path, m.poster_path]);
  return getCollection(collectionId);
}

export async function reorderCollectionMedia(collectionId: number, ids: number[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.query('UPDATE collection_media SET sort_order = $1 WHERE id = $2 AND collection_id = $3', [i, ids[i], collectionId]);
    }
  });
  return getCollection(collectionId);
}
