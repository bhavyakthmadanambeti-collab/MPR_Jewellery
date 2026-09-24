import { z } from 'zod';
import { db } from '../database/db.js';
import { parse } from '../middleware/validate.js';
import { ah, badRequest, intParam } from '../utils/http.js';
import { AVAILABILITY, CATEGORIES, METALS, ORDER_STATUSES, RATE_KEYS } from '../models/mappers.js';
import * as products from '../services/product.service.js';
import * as collections from '../services/collection.service.js';
import * as orders from '../services/order.service.js';
import * as rates from '../services/rates.service.js';
import { getSettings, saveSettings } from '../services/settings.service.js';
import { mediaUrl, removeObjects, storeImage } from '../services/storage.service.js';

// ---------- dashboard ----------
export const dashboard = ah(async (_req, res) => {
  const counts = await db.one(`
    SELECT
      (SELECT count(*) FROM products)::int AS total_products,
      (SELECT count(*) FROM products WHERE metal_type = 'gold')::int AS gold_products,
      (SELECT count(*) FROM products WHERE metal_type = 'silver')::int AS silver_products,
      (SELECT count(*) FROM orders)::int AS total_orders,
      (SELECT count(*) FROM orders WHERE payment_status = 'paid')::int AS paid_orders,
      (SELECT count(*) FROM orders WHERE payment_status IN ('awaiting_payment','pending_verification'))::int AS pending_orders,
      (SELECT count(*) FROM orders WHERE payment_status = 'pending_verification')::int AS pending_verification,
      (SELECT count(*) FROM messages)::int AS messages,
      (SELECT count(*) FROM messages WHERE is_read = false)::int AS unread_messages,
      (SELECT count(*) FROM collections)::int AS collections,
      (SELECT coalesce(sum(total_amount),0) FROM orders WHERE payment_status = 'paid') AS paid_revenue
  `);
  const [recentOrders, confirmations, recentMessages, r] = await Promise.all([
    orders.listOrders({ limit: 6 }),
    db.query(`SELECT o.id, o.order_number, o.customer_name, o.total_amount, p.customer_confirmed_at, p.customer_reference, o.payment_status
                FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.customer_confirmed_at IS NOT NULL ORDER BY p.customer_confirmed_at DESC LIMIT 6`),
    db.query('SELECT id, name, email, message, is_read, created_at FROM messages ORDER BY created_at DESC LIMIT 5'),
    rates.currentRates(),
  ]);
  res.json({
    counts: { ...counts, paid_revenue: Number(counts?.paid_revenue ?? 0) },
    recentOrders: recentOrders.items,
    recentConfirmations: confirmations.map((c) => ({ id: c.id, orderNumber: c.order_number, customerName: c.customer_name, amount: Number(c.total_amount), confirmedAt: c.customer_confirmed_at, reference: c.customer_reference, paymentStatus: c.payment_status })),
    recentMessages: recentMessages.map((m) => ({ id: m.id, name: m.name, email: m.email, message: m.message, isRead: m.is_read, createdAt: m.created_at })),
    rates: r,
  });
});

// ---------- products ----------
const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required').max(140),
  description: z.string().trim().max(4000).default(''),
  category: z.enum(CATEGORIES, { message: 'Choose a category' }),
  metalType: z.enum(METALS, { message: 'Choose a metal' }),
  purity: z.string().trim().max(40).default(''),
  weightGrams: z.coerce.number().min(0, 'Weight cannot be negative').max(100000),
  price: z.coerce.number().positive('Price must be greater than 0').max(100000000),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative').max(100000),
  availability: z.enum(AVAILABILITY),
  sku: z.string().trim().min(2, 'SKU is required').max(40).regex(/^[A-Za-z0-9-_]+$/, 'SKU may contain letters, numbers, - and _ only'),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const listProducts = ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  res.json(
    await products.listProducts({
      q: q.q || undefined,
      category: q.category || undefined,
      metal: q.metal || undefined,
      availability: q.availability || undefined,
      includeInactive: true,
      sort: (q.sort as any) || 'newest',
      limit: 200,
    })
  );
});

export const getProduct = ah(async (req, res) => res.json(await products.getProductById(intParam(req.params.id))));
export const createProduct = ah(async (req, res) => res.status(201).json(await products.createProduct(parse(productSchema, req.body))));
export const updateProduct = ah(async (req, res) => res.json(await products.updateProduct(intParam(req.params.id), parse(productSchema.partial(), req.body))));
export const deleteProduct = ah(async (req, res) => {
  await products.deleteProduct(intParam(req.params.id));
  res.json({ ok: true });
});

const idsSchema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) });

export const uploadProductImages = ah(async (req, res) => {
  res.json(await products.addProductImages(intParam(req.params.id), (req.files as Express.Multer.File[]) || []));
});
export const replaceProductImage = ah(async (req, res) => {
  if (!req.file) throw badRequest('Please choose an image.');
  res.json(await products.replaceProductImage(intParam(req.params.id), intParam(req.params.imageId), req.file));
});
export const deleteProductImage = ah(async (req, res) => res.json(await products.deleteProductImage(intParam(req.params.id), intParam(req.params.imageId))));
export const reorderProductImages = ah(async (req, res) => res.json(await products.reorderProductImages(intParam(req.params.id), parse(idsSchema, req.body).ids)));
export const uploadProductVideos = ah(async (req, res) => res.json(await products.addProductVideos(intParam(req.params.id), (req.files as Express.Multer.File[]) || [])));
export const replaceProductVideo = ah(async (req, res) => {
  if (!req.file) throw badRequest('Please choose a video.');
  res.json(await products.replaceProductVideo(intParam(req.params.id), intParam(req.params.videoId), req.file));
});
export const deleteProductVideo = ah(async (req, res) => res.json(await products.deleteProductVideo(intParam(req.params.id), intParam(req.params.videoId))));

// ---------- collections ----------
const collectionSchema = z.object({
  title: z.string().trim().min(2, 'Collection title is required').max(120),
  description: z.string().trim().max(1000).optional(),
  isPublished: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const listCollections = ah(async (_req, res) => {
  const s = await getSettings();
  res.json({ items: await collections.listAllCollections(), heroCollectionId: s.home.heroCollectionId });
});
export const getCollection = ah(async (req, res) => res.json(await collections.getCollection(intParam(req.params.id))));
export const createCollection = ah(async (req, res) => res.status(201).json(await collections.createCollection(parse(collectionSchema, req.body))));
export const updateCollection = ah(async (req, res) => res.json(await collections.updateCollection(intParam(req.params.id), parse(collectionSchema.partial(), req.body))));
export const deleteCollection = ah(async (req, res) => {
  const id = intParam(req.params.id);
  await collections.deleteCollection(id);
  const s = await getSettings();
  if (s.home.heroCollectionId === id) await saveSettings({ home: { ...s.home, heroCollectionId: null } });
  res.json({ ok: true });
});
export const reorderCollections = ah(async (req, res) => res.json(await collections.reorderCollections(parse(idsSchema, req.body).ids)));
export const uploadCollectionMedia = ah(async (req, res) => res.json(await collections.addCollectionMedia(intParam(req.params.id), (req.files as Express.Multer.File[]) || [])));
export const replaceCollectionMedia = ah(async (req, res) => {
  if (!req.file) throw badRequest('Please choose a file.');
  res.json(await collections.replaceCollectionMedia(intParam(req.params.id), intParam(req.params.mediaId), req.file));
});
export const updateCollectionMedia = ah(async (req, res) => {
  const { alt } = parse(z.object({ alt: z.string().trim().max(200) }), req.body);
  res.json(await collections.updateMediaAlt(intParam(req.params.id), intParam(req.params.mediaId), alt));
});
export const deleteCollectionMedia = ah(async (req, res) => res.json(await collections.deleteCollectionMedia(intParam(req.params.id), intParam(req.params.mediaId))));
export const reorderCollectionMedia = ah(async (req, res) => res.json(await collections.reorderCollectionMedia(intParam(req.params.id), parse(idsSchema, req.body).ids)));

// ---------- orders ----------
export const listOrders = ah(async (req, res) => {
  const q = req.query as Record<string, string>;
  res.json(await orders.listOrders({ q: q.q || undefined, paymentStatus: q.paymentStatus || undefined, orderStatus: q.orderStatus || undefined, limit: 200 }));
});
export const getOrder = ah(async (req, res) => res.json(await orders.getOrderForOwner(intParam(req.params.id))));

const payStatusSchema = z.object({ status: z.enum(['pending_verification', 'paid', 'failed', 'cancelled']), note: z.string().trim().max(500).optional() });
export const updatePaymentStatus = ah(async (req, res) => {
  const b = parse(payStatusSchema, req.body);
  res.json(await orders.setPaymentStatus(intParam(req.params.id), b.status, req.auth!.sub, b.note));
});

const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(500).optional() });
export const updateOrderStatus = ah(async (req, res) => {
  const b = parse(orderStatusSchema, req.body);
  res.json(await orders.setOrderStatus(intParam(req.params.id), b.status, req.auth!.sub, b.note));
});

// ---------- rates ----------
const rateValue = z.coerce.number().min(0).max(10000000);
const ratesSchema = z.object({
  values: z.object(Object.fromEntries(RATE_KEYS.map((k) => [k, rateValue.optional()])) as Record<(typeof RATE_KEYS)[number], z.ZodOptional<typeof rateValue>>),
  source: z.string().trim().max(120).optional(),
});
export const getRates = ah(async (_req, res) => res.json({ ...(await rates.currentRates()), history: await rates.rateHistory() }));
export const updateRates = ah(async (req, res) => {
  const b = parse(ratesSchema, req.body);
  res.json(await rates.updateRates(b.values, b.source || 'Owner (manual entry)', req.auth!.sub));
});
export const fetchLiveRates = ah(async (req, res) => res.json(await rates.fetchLiveRates(req.auth!.sub)));

// ---------- messages ----------
export const listMessages = ah(async (req, res) => {
  const filter = req.query.filter === 'unread' ? 'WHERE is_read = false' : '';
  const rows = await db.query(`SELECT * FROM messages ${filter} ORDER BY created_at DESC LIMIT 500`);
  res.json(rows.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, isRead: m.is_read, createdAt: m.created_at })));
});
export const markMessage = ah(async (req, res) => {
  const { isRead } = parse(z.object({ isRead: z.boolean() }), req.body);
  await db.query('UPDATE messages SET is_read = $1 WHERE id = $2', [isRead, intParam(req.params.id)]);
  res.json({ ok: true });
});
export const deleteMessage = ah(async (req, res) => {
  await db.query('DELETE FROM messages WHERE id = $1', [intParam(req.params.id)]);
  res.json({ ok: true });
});

// ---------- settings ----------
const settingsSchema = z.object({
  brand: z.object({ name: z.string().trim().min(2).max(60), tagline: z.string().trim().max(160) }).partial().optional(),
  contact: z
    .object({
      phone: z.string().trim().max(20),
      email: z.string().trim().email('Enter a valid contact email'),
      address: z.string().trim().max(300),
      whatsapp: z.string().trim().max(20),
      hours: z.string().trim().max(120),
    })
    .partial()
    .optional(),
  payment: z
    .object({
      upiId: z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Enter a valid UPI ID (e.g. name@bank)'),
      upiDisplayName: z.string().trim().min(2).max(60),
      upiPhone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit UPI phone number'),
      instructions: z.string().trim().max(800),
      supportMessage: z.string().trim().max(400),
    })
    .partial()
    .optional(),
  commerce: z
    .object({
      currency: z.literal('INR'),
      delivery: z.object({ flatCharge: z.coerce.number().min(0).max(100000), freeAbove: z.coerce.number().min(0).max(100000000) }),
      tax: z.object({ mode: z.enum(['none', 'inclusive', 'exclusive']), ratePercent: z.coerce.number().min(0).max(40), label: z.string().trim().max(20) }),
    })
    .partial()
    .optional(),
  home: z
    .object({
      heroCollectionId: z.number().int().positive().nullable(),
      heroEyebrow: z.string().trim().max(60),
      heroSubtitle: z.string().trim().max(200),
      sections: z.array(z.object({ key: z.enum(['hero', 'showcase', 'categories', 'featured', 'collections', 'craft']), enabled: z.boolean() })).max(10),
    })
    .partial()
    .optional(),
});

export const getOwnerSettings = ah(async (_req, res) => {
  const s = await getSettings();
  res.json({ ...s, brand: { ...s.brand, logoUrl: mediaUrl(s.brand.logoPath) } });
});

export const updateSettings = ah(async (req, res) => {
  const patch = parse(settingsSchema, req.body);
  // Explicitly reject attempts to store banking secrets
  const keys: string[] = [];
  const walk = (o: any) => o && typeof o === 'object' && Object.entries(o).forEach(([k, v]) => (keys.push(k.toLowerCase()), walk(v)));
  walk(req.body);
  if (keys.some((k) => /^(upi_?pin|pin|bank_?password|otp|password)$/.test(k))) throw badRequest('UPI PINs, OTPs and bank passwords must never be stored.');
  const s = await saveSettings(patch as any);
  res.json({ ...s, brand: { ...s.brand, logoUrl: mediaUrl(s.brand.logoPath) } });
});

export const uploadLogo = ah(async (req, res) => {
  if (!req.file) throw badRequest('Please choose a logo image.');
  const current = await getSettings();
  const img = await storeImage(req.file.buffer, 'branding');
  await removeObjects([img.thumbPath, current.brand.logoPath]);
  const s = await saveSettings({ brand: { ...current.brand, logoPath: img.storagePath } });
  res.json({ ...s, brand: { ...s.brand, logoUrl: mediaUrl(s.brand.logoPath) } });
});

export const removeLogo = ah(async (_req, res) => {
  const current = await getSettings();
  await removeObjects([current.brand.logoPath]);
  const s = await saveSettings({ brand: { ...current.brand, logoPath: null } });
  res.json({ ...s, brand: { ...s.brand, logoUrl: null } });
});
