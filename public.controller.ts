import { z } from 'zod';
import { db } from '../database/db.js';
import { parse } from '../middleware/validate.js';
import { ah, badRequest } from '../utils/http.js';
import { CATEGORIES, METALS, AVAILABILITY } from '../models/mappers.js';
import * as products from '../services/product.service.js';
import * as collections from '../services/collection.service.js';
import * as orders from '../services/order.service.js';
import { quote } from '../services/pricing.service.js';
import { currentRates } from '../services/rates.service.js';
import { getSettings } from '../services/settings.service.js';
import { mediaUrl } from '../services/storage.service.js';
import { getWebhookProvider } from '../services/payments/index.js';

export async function publicSettings() {
  const s = await getSettings();
  return {
    brand: { name: s.brand.name, tagline: s.brand.tagline, logoUrl: mediaUrl(s.brand.logoPath) },
    contact: s.contact,
    payment: { upiId: s.payment.upiId, upiDisplayName: s.payment.upiDisplayName, upiPhone: s.payment.upiPhone, instructions: s.payment.instructions, supportMessage: s.payment.supportMessage },
    commerce: s.commerce,
  };
}

export const getPublicSettings = ah(async (_req, res) => {
  res.json(await publicSettings());
});

export const getRates = ah(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json(await currentRates());
});

export const getHome = ah(async (_req, res) => {
  const s = await getSettings();
  const [allHome, featured, rates] = await Promise.all([
    collections.listPublicCollections({ homeOnly: true }),
    products.listProducts({ featured: true, limit: 8 }),
    currentRates(),
  ]);
  let hero = s.home.heroCollectionId ? allHome.find((c) => c.id === s.home.heroCollectionId) ?? (await collections.getPublicCollectionById(s.home.heroCollectionId)) : null;
  if (!hero) hero = allHome[0] ?? null;
  res.json({
    hero,
    home: { eyebrow: s.home.heroEyebrow, subtitle: s.home.heroSubtitle, sections: s.home.sections },
    collections: allHome.filter((c) => c.id !== hero?.id),
    featured: featured.items,
    rates,
  });
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  metal: z.enum(METALS).optional(),
  purity: z.string().max(40).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availability: z.enum(AVAILABILITY).optional(),
  featured: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).optional(),
  limit: z.coerce.number().int().optional(),
  offset: z.coerce.number().int().optional(),
});

export const listProducts = ah(async (req, res) => {
  const clean = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== '' && v !== undefined));
  const f = parse(listQuery, clean);
  const [list, facets] = await Promise.all([products.listProducts(f), products.facets()]);
  res.json({ ...list, facets });
});

export const getProduct = ah(async (req, res) => {
  res.json(await products.getProductBySlug(String(req.params.slug)));
});

export const listCollections = ah(async (_req, res) => {
  res.json(await collections.listPublicCollections());
});

export const getCollection = ah(async (req, res) => {
  res.json(await collections.getPublicCollection(String(req.params.slug)));
});

const lineSchema = z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) });
const quoteSchema = z.object({ items: z.array(lineSchema).min(1, 'Your cart is empty.').max(50) });

export const cartQuote = ah(async (req, res) => {
  const { items } = parse(quoteSchema, req.body);
  const q = await quote(items);
  res.json({ ...q, items: q.items.map(({ thumbPath, storageDriver, ...i }) => ({ ...i, thumbUrl: mediaUrl(thumbPath, storageDriver || 'local') })) });
});

// Note: any `price`, `total`, `amount` fields in the body are ignored by design.
const checkoutSchema = z.object({
  items: z.array(lineSchema).min(1, 'Your cart is empty.').max(50),
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().trim().email('Enter a valid email'),
  address: z.string().trim().min(5, 'Enter your address').max(400),
  city: z.string().trim().min(2, 'Enter your city').max(80),
  state: z.string().trim().min(2, 'Enter your state').max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  saveAddress: z.boolean().optional(),
});

export const createOrder = ah(async (req, res) => {
  const input = parse(checkoutSchema, req.body);
  const r = await orders.createOrder(input, req.auth?.role === 'customer' ? req.auth.sub : undefined);
  const detail = await orders.getOrderForCustomer(r.orderNumber, { token: r.accessToken });
  res.status(201).json({ ...detail, message: 'Your order was created successfully.' });
});

const lookupSchema = z.object({ token: z.string().max(100).optional(), phone: z.string().max(20).optional() });

export const getOrderStatus = ah(async (req, res) => {
  const { token, phone } = parse(lookupSchema, req.query);
  if (!token && !phone && req.auth?.role !== 'customer') throw badRequest('Enter the mobile number used for the order.');
  const r = await orders.getOrderForCustomer(String(req.params.orderNumber), { token, phone, customerId: req.auth?.role === 'customer' ? req.auth.sub : undefined });
  res.json(r);
});

const confirmSchema = z.object({ token: z.string().max(100).optional(), phone: z.string().max(20).optional(), reference: z.string().trim().max(60).optional() });

export const confirmPayment = ah(async (req, res) => {
  const b = parse(confirmSchema, req.body);
  const r = await orders.confirmPayment(String(req.params.orderNumber), { ...b, customerId: req.auth?.role === 'customer' ? req.auth.sub : undefined });
  res.json({ ...r, message: 'Your payment confirmation has been submitted. The owner will verify your payment.' });
});

const messageSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  message: z.string().trim().min(5, 'Message is too short').max(3000),
});

export const sendMessage = ah(async (req, res) => {
  const m = parse(messageSchema, req.body);
  await db.query('INSERT INTO messages (name, email, phone, message) VALUES ($1,$2,$3,$4)', [m.name, m.email, m.phone || null, m.message]);
  res.status(201).json({ ok: true, message: 'Thank you. Your message has been sent — we will get back to you soon.' });
});

export const customerOrders = ah(async (req, res) => {
  res.json(await orders.listCustomerOrders(req.auth!.sub));
});

/** Future automatic verification: signed webhooks from a real payment gateway */
export const paymentWebhook = ah(async (req, res) => {
  const provider = getWebhookProvider(String(req.params.provider));
  if (!provider) return res.status(404).json({ error: 'Payment provider not configured.' });
  const result = await provider.verifyWebhook!(req); // must validate signature
  const o = await db.one('SELECT id, total_amount FROM orders WHERE order_number = $1', [result.orderNumber]);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (Math.round(Number(o.total_amount) * 100) !== Math.round(result.amount * 100)) {
    return res.status(400).json({ error: 'Amount mismatch' });
  }
  await orders.setPaymentStatus(o.id, result.status, 0, `Gateway ${provider.name}`, 'gateway', result.providerReference);
  res.json({ ok: true });
});
